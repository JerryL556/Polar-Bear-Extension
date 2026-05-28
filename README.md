# Polar Bear Extension

`Polar Bear Extension` is a Chrome Manifest V3 extension that places a persistent animated polar bear at the bottom of web pages. The bear acts like a virtual pet with mood, minigames, page-chaos effects, and a local AI text-analysis helper.

## What It Does

- Injects a bottom-fixed polar bear overlay onto normal web pages.
- Tracks a `happiness` value from `0` to `100`, starting at `80`.
- Decreases happiness over time and changes behavior based on mood:
  - high happiness: calmer movement
  - medium happiness: normal behavior
  - low happiness: faster, redder, more chaotic behavior
- Lets the user click the bear to open its action menu.
- Keeps the dot on the bear as the visual cue for menu access.

## Core Pet Interactions

- `Sleep`
  - freezes the bear
  - flips it upside down
  - shows blue `Z` effects
  - restores happiness over `10s`

- `Play Game`
  - the bear follows the cursor along the bottom of the page
  - apples fall from the top
  - caught apples reward happiness
  - heart effects appear on successful catches

- `Pet`
  - freezes the bear for a short petting session
  - the user pets by moving the mouse from above the bear onto its top edge
  - valid petting cycles score points
  - each valid pet triggers a bounce reaction and heart effect

- Feeding event
  - the bear occasionally asks for an apple
  - an apple appears and must be dragged to the bear
  - while waiting, happiness drops faster
  - if fed in time, happiness is restored

## Text Analysis Flow

The extension includes a local-only AI helper that works by dragging highlighted text onto the bear.

1. Highlight text on a page.
2. Drag the highlighted text onto the bear.
3. The bear opens an analysis bubble with:
   - `Summarize`
   - `Fact Check`
   - `Rewrite`
   - `Cancel`
4. If `Rewrite` is chosen, the bear opens a second step with:
   - `Clearer`
   - `Shorter`
   - `More Formal`
   - `More Friendly`
   - `Back`
   - `Cancel`
5. Results appear in a speech bubble above the bear.
6. A `Copy` button copies the current output without closing the bubble.

Important behavior:
- The bear refuses text analysis when happiness is below `30`.
- `Summarize` returns a short summary.
- `Fact Check` uses web search through the local backend and can show clickable sources.
- `Rewrite` tries to replace only the originally highlighted editable selection when possible.
- For complex editors or non-editable text, rewrite can fall back to showing the rewritten result in the bubble.
- The bear can also describe images dragged from webpages in 1 to 3 neutral sentences.

## Chaos System

When happiness gets too low, the bear starts disturbing the page.

Chaos effects include:
- temporary text replacement
- image replacement using level-specific asset pools
- twitching / drifting page elements
- flashing visual anomalies

Chaos is reduced or cleared again when happiness rises back above the configured thresholds.

## Settings Popup

Clicking the extension tray icon opens a popup settings page.

Current controls include:
- turning the pet on or off
- changing text/image chaos occurrence
- changing twitch occurrence
- changing flash occurrence
- changing happiness drop interval
- changing minimum wait between apple events
- resetting everything back to defaults

## Local Backend

The AI features are intentionally local-only.

The extension does **not** store your real API key.

Safe design:
- the extension sends selected text to a local Flask backend on `127.0.0.1`
- the backend reads `OPENAI_API_KEY` from a local `.env`
- the backend calls OpenAI
- only the backend ever sees the secret

This keeps the API key out of:
- `content.js`
- `background.js`
- `manifest.json`
- extension storage
- committed frontend code

## Tech Stack

- `Chrome Extension Manifest V3`
  - defined in [manifest.json](./manifest.json)
  - uses a content script, popup UI, and background service worker

- `Vanilla JavaScript`
  - pet runtime and UI: [content.js](./content.js)
  - background localhost proxy: [background.js](./background.js)
  - popup logic: [popup.js](./popup.js)

- `HTML + CSS`
  - popup markup: [popup.html](./popup.html)
  - popup styling: [popup.css](./popup.css)

- `Python + Flask`
  - local backend: [summarize_backend.py](./summarize_backend.py)
  - Windows launcher: [start_backend.bat](./start_backend.bat)

- `OpenAI Responses API`
  - used only from the local Python backend
  - default low-cost model: `gpt-5-nano`
  - supports summarization, rewriting, and fact checking

- `chrome.storage.sync`
  - used for popup settings persistence

- Web platform APIs
  - Shadow DOM
  - pointer events
  - drag and drop
  - timers
  - DOM mutation and overlay rendering

## File Overview

- [manifest.json](./manifest.json): extension manifest, popup registration, permissions
- [content.js](./content.js): pet runtime, interactions, minigames, chaos system, drag-to-bear analysis UI
- [background.js](./background.js): localhost analysis requests from the extension
- [popup.html](./popup.html): settings UI markup
- [popup.css](./popup.css): settings UI styling
- [popup.js](./popup.js): popup settings persistence and controls
- [summarize_backend.py](./summarize_backend.py): local Flask backend for summarize / fact-check / rewrite
- [start_backend.bat](./start_backend.bat): Windows launcher for the local backend
- [requirements.txt](./requirements.txt): Python backend dependencies
- [.env.example](./.env.example): environment variable template for local setup
- [.gitignore](./.gitignore): excludes local secrets and generated files
- `walking-polar-bear.gif`: main bear asset
- `apple.webp`, `rotten-apple.png`, `level2a.webp`, `level3a.jpg`, `level3b.jpg`: gameplay and chaos assets

## How It Works Internally

- The extension injects a bottom-fixed pet layer into each page with a Shadow DOM wrapper to reduce style conflicts.
- A runtime state machine in `content.js` controls:
  - wandering
  - feeding
  - sleeping
  - petting
  - minigame mode
  - dragged-text analysis
  - chaos effects
- The normal pet action menu and the dragged-text analysis bubble are separate UI flows.
- The popup writes settings to `chrome.storage.sync`.
- The content script reacts to live settings changes.
- Text analysis requests are routed through the extension background worker to a Flask backend on `127.0.0.1`.

## Loading The Extension

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this folder

## Running The Local Backend

1. Copy `.env.example` to `.env`
2. Put your OpenAI key in `OPENAI_API_KEY`
3. Double-click [start_backend.bat](./start_backend.bat)
4. Keep that local server running while using drag-to-bear text analysis

The backend uses `gpt-5-nano` by default to minimize cost.
