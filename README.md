# Polar Bear Extension

`Polar Bear Extension` is a Chrome extension built with Manifest V3 that places a persistent animated polar bear at the bottom of web pages. The bear acts like a small virtual pet with mood, interactions, minigames, and page-disturbing chaos effects when its happiness gets too low.

## What It Does

- Injects a polar bear overlay onto normal web pages and keeps it pinned to the bottom of the viewport.
- Tracks a `happiness` value from `0` to `100`, starting at `80`.
- Decreases happiness over time and lets the user restore it through interactions.
- Changes the bear’s behavior based on happiness:
  - high happiness: calmer behavior
  - medium happiness: normal behavior
  - low happiness: faster, redder, more aggressive behavior
- Lets the user click the bear to gain happiness.
- Includes a feeding event:
  - the bear freezes and requests an apple
  - the user drags an apple to the bear
  - success restores happiness
- Includes an action menu opened from a small dot on the bear:
  - `Sleep`
  - `Play Game`
  - `Pet`
- Includes a cursor-following apple-catching minigame:
  - the bear follows the cursor horizontally along the bottom
  - apples fall from the top of the page
  - caught apples reward happiness
- Includes a petting interaction mode:
  - the user moves the mouse above and onto the top of the bear
  - valid petting cycles are counted
  - each successful pet rewards happiness
- Adds page chaos effects at low happiness:
  - text replacement
  - image replacement using level-specific asset pools
  - layout twitching
  - flashing visual anomalies
- Clears active page chaos when happiness climbs back above the relevant thresholds.
- Includes a popup settings page from the extension tray for:
  - turning the pet on or off
  - changing visual occurrence intensity
  - changing happiness decay speed
  - changing minimum apple-event wait time
  - changing petting click happiness gain

## Tech Stack

- `Chrome Extension Manifest V3`
  - defined in [manifest.json](./manifest.json)
  - uses a content script and popup UI
- `Vanilla JavaScript`
  - all runtime logic is implemented in [content.js](./content.js)
  - popup logic is implemented in [popup.js](./popup.js)
- `HTML + CSS`
  - popup interface in [popup.html](./popup.html)
  - popup styling in [popup.css](./popup.css)
- `chrome.storage.sync`
  - used for persistent user settings across popup and content script
- `Web platform APIs`
  - DOM injection
  - pointer events
  - timers
  - Shadow DOM isolation for the pet overlay
  - Web Animations API for some visual effects

## File Overview

- [manifest.json](./manifest.json): extension manifest, popup registration, permissions
- [content.js](./content.js): pet runtime, interactions, chaos system, minigames
- [popup.html](./popup.html): settings UI markup
- [popup.css](./popup.css): settings UI styling
- [popup.js](./popup.js): settings persistence and input handling
- `walking-polar-bear.gif`: main bear animation asset
- `apple.webp`, `rotten-apple.png`, `level2a.webp`, `level3a.jpg`, `level3b.jpg`: gameplay and chaos assets

## How It Works Internally

- The extension injects a bottom-fixed pet layer into each page with a Shadow DOM wrapper to reduce style conflicts.
- A state machine in `content.js` controls:
  - wandering
  - feeding
  - sleeping
  - petting
  - minigame mode
  - chaos effects
- The popup writes settings to `chrome.storage.sync`.
- The content script listens for storage changes and applies new settings live.

## Loading the Extension

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this folder

