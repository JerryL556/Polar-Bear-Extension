const BACKEND_URL = "http://127.0.0.1:4317/analyze";
const REQUEST_TIMEOUT_MS = 20000;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "analyzeSelectedText") {
    return false;
  }

  const text = typeof message.text === "string" ? message.text.trim() : "";
  const mode = message.mode === "fact_check"
    ? "fact_check"
    : message.mode === "rewrite"
      ? "rewrite"
      : "summarize";
  const rewriteStyle = typeof message.rewriteStyle === "string" ? message.rewriteStyle.trim() : "";
  if (!text) {
    sendResponse({ ok: false, error: "No text was provided." });
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  fetch(BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text, mode, rewriteStyle }),
    signal: controller.signal
  })
    .then(async (response) => {
      clearTimeout(timeoutId);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        sendResponse({
          ok: false,
          error: payload?.error || "The local summary server returned an error."
        });
        return;
      }

      sendResponse({
        ok: true,
        mode,
        summary: typeof payload?.summary === "string" ? payload.summary : "",
        sources: Array.isArray(payload?.sources) ? payload.sources : []
      });
    })
    .catch(() => {
      clearTimeout(timeoutId);
      sendResponse({
        ok: false,
        error: "The local summary server is unavailable or timed out. Start it and try again."
      });
    });

  return true;
});
