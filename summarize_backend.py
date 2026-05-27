import os
from pathlib import Path
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from openai import OpenAI


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

MODEL = os.getenv("OPENAI_MODEL", "gpt-5-nano")
PORT = int(os.getenv("SUMMARY_SERVER_PORT", "4317"))
MAX_TEXT_CHARS = 5000
SUMMARY_MAX_OUTPUT_TOKENS = 400
FACT_CHECK_MAX_OUTPUT_TOKENS = 700

api_key = os.getenv("OPENAI_API_KEY", "").strip()
if not api_key:
    raise RuntimeError("OPENAI_API_KEY is missing. Add it to a local .env file before starting the summary server.")

client = OpenAI(api_key=api_key)
app = Flask(__name__)


def build_summary_prompt(user_text: str) -> str:
    text_length = len(user_text)
    if text_length < 280:
        target = "Return exactly 1 sentence if possible, or at most 2 short sentences if absolutely necessary."
    elif text_length < 1200:
        target = "Return exactly 2 short sentences if possible, or at most 3 short sentences if necessary."
    else:
        target = "Return exactly 3 short sentences."

    return (
        "Summarize the following text. "
        f"{target} "
        "Use plain language. Be concise. Do not use markdown, bullet points, or headings.\n\n"
        f"Text:\n{user_text}"
    )


def build_fact_check_prompt(user_text: str) -> str:
    return (
        "Fact-check the following text against current web information. "
        "Respond in 2 or 3 short sentences. "
        "Sentence 1 must start with one of: Likely true:, Likely false:, Mixed:, or Unclear:. "
        "Then briefly explain why. Keep it concise and plain text only.\n\n"
        f"Text:\n{user_text}"
    )


def extract_text_and_sources(response) -> tuple[str, list[dict[str, str]]]:
    direct_text = (getattr(response, "output_text", "") or "").strip()
    collected_parts: list[str] = []
    sources: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    output_items = getattr(response, "output", None) or []
    for item in output_items:
        if getattr(item, "type", None) != "message":
            continue

        content_items = getattr(item, "content", None) or []
        for content in content_items:
            content_type = getattr(content, "type", None)
            if content_type in {"output_text", "text"}:
                text_value = (getattr(content, "text", "") or "").strip()
                if text_value:
                    collected_parts.append(text_value)

                annotations = getattr(content, "annotations", None) or []
                for annotation in annotations:
                    if getattr(annotation, "type", None) != "url_citation":
                        continue
                    url = (getattr(annotation, "url", "") or "").strip()
                    title = (getattr(annotation, "title", "") or url).strip()
                    if not url or url in seen_urls:
                        continue
                    seen_urls.add(url)
                    sources.append({
                        "title": title,
                        "url": url,
                    })

    summary_text = direct_text or "\n".join(collected_parts).strip()
    return summary_text, sources


def build_error_message(response, prefix: str) -> str:
    response_error = getattr(response, "error", None)
    incomplete_details = getattr(response, "incomplete_details", None)
    status = getattr(response, "status", None)
    diagnostic = []
    if status:
        diagnostic.append(f"status={status}")
    if response_error:
        diagnostic.append(f"error={response_error}")
    if incomplete_details:
        diagnostic.append(f"incomplete_details={incomplete_details}")
    detail = f" ({', '.join(diagnostic)})" if diagnostic else ""
    return f"{prefix}{detail}."


def extract_text_and_sources_from_json(payload: dict) -> tuple[str, list[dict[str, str]], str]:
    direct_text = str(payload.get("output_text") or "").strip()
    collected_parts: list[str] = []
    sources: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    for item in payload.get("output", []) or []:
        if item.get("type") != "message":
            continue

        for content in item.get("content", []) or []:
            if content.get("type") not in {"output_text", "text"}:
                continue

            text_value = str(content.get("text") or "").strip()
            if text_value:
                collected_parts.append(text_value)

            for annotation in content.get("annotations", []) or []:
                if annotation.get("type") != "url_citation":
                    continue
                url = str(annotation.get("url") or "").strip()
                title = str(annotation.get("title") or url).strip()
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                sources.append({
                    "title": title,
                    "url": url,
                })

    summary_text = direct_text or "\n".join(collected_parts).strip()
    status = str(payload.get("status") or "").strip()
    return summary_text, sources, status


def build_json_error_message(payload: dict, prefix: str) -> str:
    diagnostic = []
    status = payload.get("status")
    response_error = payload.get("error")
    incomplete_details = payload.get("incomplete_details")
    if status:
        diagnostic.append(f"status={status}")
    if response_error:
        diagnostic.append(f"error={response_error}")
    if incomplete_details:
        diagnostic.append(f"incomplete_details={incomplete_details}")
    detail = f" ({', '.join(diagnostic)})" if diagnostic else ""
    return f"{prefix}{detail}."


def fact_check_with_web_search(user_text: str) -> tuple[str, list[dict[str, str]]]:
    body = {
        "model": MODEL,
        "input": build_fact_check_prompt(user_text),
        "reasoning": {"effort": "low"},
        "tools": [{"type": "web_search"}],
        "tool_choice": "auto",
        "include": ["web_search_call.action.sources"],
        "max_output_tokens": FACT_CHECK_MAX_OUTPUT_TOKENS,
    }
    request_body = json.dumps(body).encode("utf-8")
    request_obj = Request(
        "https://api.openai.com/v1/responses",
        data=request_body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urlopen(request_obj, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI request failed: HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"OpenAI request failed: {exc}") from exc

    summary, sources, _status = extract_text_and_sources_from_json(payload)
    if not summary:
        raise RuntimeError(build_json_error_message(payload, "The model returned no readable fact-check text"))

    return summary, sources


@app.post("/analyze")
def analyze():
    payload = request.get_json(silent=True) or {}
    text = str(payload.get("text", "")).strip()
    mode = str(payload.get("mode", "summarize")).strip()
    if mode not in {"summarize", "fact_check"}:
        mode = "summarize"

    if not text:
        return jsonify({"error": "No text was provided."}), 400

    if len(text) > MAX_TEXT_CHARS:
        text = text[:MAX_TEXT_CHARS]

    try:
        if mode == "fact_check":
            summary, sources = fact_check_with_web_search(text)
        else:
            response = client.responses.create(
                model=MODEL,
                input=build_summary_prompt(text),
                reasoning={"effort": "minimal"},
                max_output_tokens=SUMMARY_MAX_OUTPUT_TOKENS,
            )
            summary, sources = extract_text_and_sources(response)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": f"OpenAI request failed: {exc}"}), 500

    if not summary:
        if mode == "fact_check":
            message = "The model returned no readable fact-check text."
        else:
            message = build_error_message(response, "The model returned no readable summary text")
        return jsonify({"error": message}), 502

    return jsonify({
        "summary": summary,
        "sources": sources,
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=PORT, debug=False)
