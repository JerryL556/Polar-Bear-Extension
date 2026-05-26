(() => {
  if (window.__extensionPetMounted) {
    return;
  }
  window.__extensionPetMounted = true;

  const CONFIG = {
    startHappiness: 80,
    minHappiness: 0,
    maxHappiness: 100,
    decayPerTick: 2,
    decayIntervalMs: 900,
    feedingDecayMultiplier: 3,
    clickGain: 8,
    appleFeedGain: 20,
    devHudVisible: true,
    petWidth: 140,
    petHeight: 140,
    appleSize: 72,
    groundOffset: 8,
    idleChance: 0.22,
    feedingChance: 0.18,
    feedingDurationMs: 10000,
    feedingMinCooldownMs: 10000,
    feedingExtraCooldownMs: 18000,
    appleDropPadding: 64,
    chaosLevels: {
      level1: {
        minHappiness: 31,
        maxHappiness: 60,
        chancePerCheck: 0.1,
        durationMs: 5000,
        targetRatio: 0.25,
        minTargets: 4,
        minFlickerMs: 1000,
        maxFlickerMs: 2500,
        maxConcurrentMutations: 10,
        phrases: [
          "ARE YOU THERE?",
          "FEED ME!"
        ]
      },
      level2: {
        minHappiness: 1,
        maxHappiness: 30,
        chancePerCheck: 0.24,
        durationMs: 8000,
        targetRatio: 0.5,
        minTargets: 10,
        minFlickerMs: 2000,
        maxFlickerMs: 6000,
        maxConcurrentMutations: 18,
        phrases: [
          "NEED APPLE",
          "THE END IS NEVER",
          "FEED ME!",
          "LOOK AT ME"
        ],
        redBlink: {
          chancePerCheck: 0.32,
          pulseCount: 4,
          minStartDelayMs: 0,
          maxStartDelayMs: 500,
          hideDurationMs: 140,
          showDurationMs: 240
        },
        layoutDrift: {
          elementAmplitudePx: 4,
          elementCount: 18,
          pulseCount: 6,
          cycleDurationMs: 420,
          minStartDelayMs: 0,
          maxStartDelayMs: 260,
          horizontalAmplitudePx: 2
        }
      },
      level3: {
        minHappiness: 0,
        maxHappiness: 0,
        chancePerCheck: 0.5,
        durationMs: 11000,
        targetRatio: 0.8,
        minTargets: 16,
        minFlickerMs: 3500,
        maxFlickerMs: 9000,
        maxConcurrentMutations: 32,
        phrases: [
          "LOOK AT ME",
          "STARVING HUNGER"
        ],
        redBlink: {
          chancePerCheck: 0.58,
          pulseCount: 9,
          minStartDelayMs: 0,
          maxStartDelayMs: 320,
          hideDurationMs: 110,
          showDurationMs: 190
        },
        layoutDrift: {
          elementAmplitudePx: 7,
          elementCount: 36,
          pulseCount: 12,
          cycleDurationMs: 260,
          minStartDelayMs: 0,
          maxStartDelayMs: 180,
          horizontalAmplitudePx: 4
        }
      }
    },
    chaosShortPhrases: [
      "HELLO??",
      "APPLE!!",
      "HELP!!",
      "ANYONE??"
    ]
  };

  const SETTINGS_KEY = "petSettings";
  const DEFAULT_SETTINGS = {
    petEnabled: true,
    chaosOccurrence: 100,
    twitchOccurrence: 100,
    flashOccurrence: 100,
    decayIntervalMs: CONFIG.decayIntervalMs,
    feedingMinCooldownMs: CONFIG.feedingMinCooldownMs,
    clickGain: CONFIG.clickGain
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const activeSettings = { ...DEFAULT_SETTINGS };

  const host = document.createElement("div");
  host.id = "extension-pet-host";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const gifUrl = chrome.runtime.getURL("walking-polar-bear.gif");

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
      }

      .pet-layer {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        top: 0;
        pointer-events: none;
        z-index: 2147483647;
        overflow: hidden;
      }

      .pet-shell {
        position: absolute;
        left: 0;
        bottom: ${CONFIG.groundOffset}px;
        width: ${CONFIG.petWidth}px;
        pointer-events: auto;
        user-select: none;
        -webkit-user-select: none;
        touch-action: manipulation;
      }

      .pet {
        position: relative;
        width: ${CONFIG.petWidth}px;
        height: ${CONFIG.petHeight}px;
        cursor: pointer;
        transform-origin: center bottom;
        transition:
          filter 240ms linear,
          opacity 180ms ease;
        animation: bob 1.8s ease-in-out infinite;
      }

      .pet-visual {
        width: 100%;
        height: 100%;
        transform-origin: center bottom;
        transition: transform 180ms ease;
      }

      .pet:active .pet-visual {
        transform: scale(0.95);
      }

      .pet img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
        display: block;
      }

      .pet img.hidden {
        display: none;
      }

      .apple {
        position: fixed;
        width: ${CONFIG.appleSize}px;
        height: ${CONFIG.appleSize}px;
        left: 0;
        top: 0;
        pointer-events: auto;
        cursor: grab;
        display: none;
        z-index: 1;
        filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.28));
        touch-action: none;
      }

      .apple.visible {
        display: block;
      }

      .apple.dragging {
        cursor: grabbing;
        filter: drop-shadow(0 14px 24px rgba(0, 0, 0, 0.34));
      }

      .hud {
        position: absolute;
        left: 50%;
        bottom: calc(100% - 6px);
        transform: translateX(-50%);
        width: 150px;
        padding: 8px;
        border-radius: 10px;
        background: rgba(18, 20, 26, 0.88);
        color: #f5f7fa;
        font-family: Arial, sans-serif;
        font-size: 12px;
        line-height: 1.3;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
        backdrop-filter: blur(6px);
      }

      .hud.hidden {
        display: none;
      }

      .hud-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
      }

      .bar {
        height: 10px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.14);
      }

      .bar-fill {
        height: 100%;
        width: 80%;
        border-radius: inherit;
        background: linear-gradient(90deg, #ff5a5a 0%, #f7c948 55%, #5bd972 100%);
        transition: width 180ms ease;
      }

      .hint {
        opacity: 0.72;
      }

      @keyframes bob {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
    </style>
    <div class="pet-layer">
      <div class="pet-shell">
        <div class="hud${CONFIG.devHudVisible ? "" : " hidden"}">
          <div class="hud-row">
            <span>Happiness</span>
            <span class="value">80</span>
          </div>
          <div class="bar">
            <div class="bar-fill"></div>
          </div>
          <div class="hud-row" style="margin-top: 6px; margin-bottom: 0;">
            <span class="state">normal</span>
            <span class="hint">click pet</span>
          </div>
        </div>
        <div class="pet" title="Click to cheer up the pet">
          <div class="pet-visual">
            <img src="${gifUrl}" alt="Extension pet">
            <img class="pet-still hidden" alt="Frozen pet">
          </div>
        </div>
      </div>
      <img class="apple" alt="Apple">
    </div>
  `;

  const appleUrl = chrome.runtime.getURL("apple.webp");
  const rottenAppleUrl = chrome.runtime.getURL("rotten-apple.png");
  const shell = shadow.querySelector(".pet-shell");
  const pet = shadow.querySelector(".pet");
  const petVisual = shadow.querySelector(".pet-visual");
  const petImg = shadow.querySelector(".pet-visual img:not(.pet-still)");
  const petStill = shadow.querySelector(".pet-still");
  const apple = shadow.querySelector(".apple");
  const hud = shadow.querySelector(".hud");
  const valueLabel = shadow.querySelector(".value");
  const stateLabel = shadow.querySelector(".state");
  const barFill = shadow.querySelector(".bar-fill");

  apple.src = appleUrl;

  const state = {
    happiness: CONFIG.startHappiness,
    x: Math.max(24, Math.min(window.innerWidth - CONFIG.petWidth - 24, 40)),
    direction: 1,
    action: "walk",
    actionUntil: 0,
    lastFrameTime: performance.now(),
    bounceDurationMs: 1800,
    feeding: false,
    feedingTimeoutId: null,
    appleVisible: false,
    appleX: 0,
    appleY: 0,
    draggingApple: false,
    nextFeedingAllowedAt: performance.now() + DEFAULT_SETTINGS.feedingMinCooldownMs + Math.random() * CONFIG.feedingExtraCooldownMs,
    activePointerId: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    pointerX: 0,
    pointerY: 0,
    chaosRestorers: [],
    chaosTimers: [],
    layoutDriftAnimations: [],
    activeRedBlinkPulses: 0,
    activeChaosMutations: 0,
    decayTimerId: null
  };

  const getOccurrenceMultiplier = (key) => clamp((activeSettings[key] ?? 100) / 100, 0, 2);
  const scaleCount = (value, key) => Math.max(0, Math.round(value * getOccurrenceMultiplier(key)));
  const scaleChance = (value, key) => clamp(value * getOccurrenceMultiplier(key), 0, 1);

  const applyPetEnabledState = () => {
    const enabled = activeSettings.petEnabled;
    host.style.display = enabled ? "" : "none";

    if (enabled) {
      renderApple();
      updateHud();
      return;
    }

    clearFeedingTimeout();
    state.feeding = false;
    state.draggingApple = false;
    state.appleVisible = false;
    renderApple();
    restoreChaos();
  };

  const setNextFeedingCooldown = () => {
    state.nextFeedingAllowedAt =
      performance.now() +
      activeSettings.feedingMinCooldownMs +
      Math.random() * CONFIG.feedingExtraCooldownMs;
  };

  const getMood = () => {
    if (state.happiness > 80) {
      return "content";
    }
    if (state.feeding) {
      return "waiting";
    }
    if (state.happiness >= 50) {
      return "normal";
    }
    if (state.happiness > 0) {
      return "hungry";
    }
    return "critical";
  };

  const getMovementSpeed = () => {
    if (state.happiness > 80) {
      return 18;
    }
    if (state.happiness >= 50) {
      return 62;
    }

    const lowRatio = 1 - state.happiness / 50;
    return 62 + lowRatio * 320;
  };

  const getIdleDuration = () => {
    if (state.happiness > 80) {
      return 2200 + Math.random() * 1800;
    }
    if (state.happiness >= 50) {
      return 1000 + Math.random() * 900;
    }
    return 350 + Math.random() * 500;
  };

  const getWalkDuration = () => {
    if (state.happiness > 80) {
      return 1800 + Math.random() * 1800;
    }
    if (state.happiness >= 50) {
      return 1500 + Math.random() * 1300;
    }
    return 900 + Math.random() * 1000;
  };

  const updateMoodStyles = () => {
    const redness = state.happiness >= 50 ? 0 : (50 - state.happiness) / 50;
    const hueShift = -52 * redness;
    const saturate = 1 + 3.2 * redness;
    const sepia = 1.15 * redness;
    const brightness = 1 - 0.24 * redness;
    const contrast = 1 + 0.58 * redness;
    const dropShadow = `drop-shadow(0 0 ${10 + redness * 24}px rgba(255, 44, 44, ${0.15 + redness * 0.65}))`;
    const grayscale = 0.18 * redness;

    pet.style.filter = [
      `sepia(${sepia})`,
      `saturate(${saturate})`,
      `hue-rotate(${hueShift}deg)`,
      `brightness(${brightness})`,
      `contrast(${contrast})`,
      `grayscale(${grayscale})`,
      dropShadow
    ].join(" ");

    const speed = getMovementSpeed();
    const bobDuration = clamp(2600 - speed * 10, 260, 2600);
    if (Math.abs(state.bounceDurationMs - bobDuration) > 40) {
      state.bounceDurationMs = bobDuration;
      pet.style.animationDuration = `${bobDuration}ms`;
    }

    petVisual.style.opacity = `${1 - redness * 0.04}`;
  };

  const updateHud = () => {
    valueLabel.textContent = `${Math.round(state.happiness)}`;
    stateLabel.textContent = getMood();
    barFill.style.width = `${state.happiness}%`;

    if (state.happiness > 80) {
      hud.style.border = "1px solid rgba(116, 201, 113, 0.35)";
    } else if (state.happiness >= 50) {
      hud.style.border = "1px solid rgba(247, 201, 72, 0.35)";
    } else {
      hud.style.border = "1px solid rgba(255, 90, 90, 0.42)";
    }
  };

  const renderApple = () => {
    apple.style.transform = `translate(${state.appleX}px, ${state.appleY}px)`;
    apple.classList.toggle("visible", state.appleVisible);
    apple.classList.toggle("dragging", state.draggingApple);
  };

  const renderPosition = () => {
    const maxX = Math.max(0, window.innerWidth - CONFIG.petWidth - 8);
    state.x = clamp(state.x, 0, maxX);
    shell.style.transform = `translateX(${state.x}px)`;
    petVisual.style.transform = `scaleX(${state.direction < 0 ? 1 : -1})`;
  };

  const captureStillFrame = () => {
    const canvas = document.createElement("canvas");
    const width = petImg.naturalWidth || CONFIG.petWidth;
    const height = petImg.naturalHeight || CONFIG.petHeight;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    try {
      ctx.drawImage(petImg, 0, 0, width, height);
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  };

  const freezePet = () => {
    const frameData = captureStillFrame();
    if (frameData) {
      petStill.src = frameData;
      petStill.classList.remove("hidden");
      petImg.classList.add("hidden");
    }
    pet.style.animationPlayState = "paused";
  };

  const unfreezePet = () => {
    pet.style.animationPlayState = "running";
    petStill.classList.add("hidden");
    petStill.removeAttribute("src");
    petImg.classList.remove("hidden");
  };

  const clearFeedingTimeout = () => {
    if (state.feedingTimeoutId !== null) {
      window.clearTimeout(state.feedingTimeoutId);
      state.feedingTimeoutId = null;
    }
  };

  const clearChaosTimers = () => {
    for (const timerId of state.chaosTimers) {
      window.clearTimeout(timerId);
    }
    state.chaosTimers = [];
  };

  const finishChaosIfIdle = () => {
    if (
      state.activeChaosMutations > 0 ||
      state.activeRedBlinkPulses > 0 ||
      state.chaosTimers.length > 0
    ) {
      return;
    }

    stopLayoutDrift();
    state.chaosRestorers = [];
  };

  const startDecayLoop = () => {
    if (state.decayTimerId !== null) {
      window.clearInterval(state.decayTimerId);
    }

    state.decayTimerId = window.setInterval(() => {
      if (!activeSettings.petEnabled) {
        return;
      }

      const decay = state.feeding
        ? CONFIG.decayPerTick * CONFIG.feedingDecayMultiplier
        : CONFIG.decayPerTick;
      setHappiness(state.happiness - decay);

      const chaosConfig = getChaosLevelConfig();
      if (
        chaosConfig?.redBlink &&
        Math.random() < scaleChance(chaosConfig.redBlink.chancePerCheck, "flashOccurrence")
      ) {
        startRedBlinkPulse(chaosConfig);
      }

      if (
        chaosConfig &&
        Math.random() < scaleChance(chaosConfig.chancePerCheck, "chaosOccurrence")
      ) {
        triggerChaos();
      }
    }, activeSettings.decayIntervalMs);
  };

  const stopLayoutDrift = () => {
    for (const animation of state.layoutDriftAnimations) {
      animation.cancel();
    }
    state.layoutDriftAnimations = [];
  };

  const startLayoutDrift = (chaosConfig) => {
    const drift = chaosConfig.layoutDrift;
    if (
      !drift ||
      typeof document.documentElement.animate !== "function" ||
      !document.body ||
      scaleCount(drift.pulseCount ?? 0, "twitchOccurrence") <= 0
    ) {
      return;
    }

    const driftTargets = [];
    const selectors = [
      "img",
      "p",
      "span",
      "label",
      "small",
      "strong",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "li",
      "button",
      "a",
      "input",
      "textarea",
      "select",
      "[role='button']",
      "[role='link']",
      ".card",
      ".tile",
      ".item"
    ];

    for (const element of document.body.querySelectorAll(selectors.join(","))) {
      if (host.contains(element) || !isVisibleElement(element)) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      if (rect.width < 36 || rect.height < 18) {
        continue;
      }

      const viewportArea = window.innerWidth * window.innerHeight;
      const elementArea = rect.width * rect.height;
      if (elementArea > viewportArea * 0.12) {
        continue;
      }

      if (element.children.length > 8) {
        continue;
      }

      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.position === "fixed" || computedStyle.position === "sticky") {
        continue;
      }

      driftTargets.push(element);
    }

    for (let i = driftTargets.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [driftTargets[i], driftTargets[j]] = [driftTargets[j], driftTargets[i]];
    }

    const selectedTargets = driftTargets
      .slice(0, Math.min(drift.elementCount, driftTargets.length))
      .slice(0, Math.min(scaleCount(drift.pulseCount ?? drift.elementCount, "twitchOccurrence"), driftTargets.length));

    const elementAnimations = selectedTargets.map((element) => {
      const amplitude = drift.elementAmplitudePx * (0.55 + Math.random() * 0.7);
      const horizontalAmplitude = drift.horizontalAmplitudePx * (0.6 + Math.random() * 0.8);
      const duration = Math.round(drift.cycleDurationMs * (0.94 + Math.random() * 0.12));
      const delay = Math.round(
        drift.minStartDelayMs + Math.random() * Math.max(0, drift.maxStartDelayMs - drift.minStartDelayMs)
      );
      const twitchUp = Math.round(-amplitude);
      const twitchDown = Math.round(amplitude * (0.88 + Math.random() * 0.18));
      const twitchSideA = Math.round(horizontalAmplitude);
      const twitchSideB = Math.round(-horizontalAmplitude * (0.75 + Math.random() * 0.2));
      const settleY = Math.round(amplitude * (0.14 + Math.random() * 0.12));

      return element.animate(
        [
          { transform: "translate3d(0px, 0px, 0px)" },
          { transform: `translate3d(${twitchSideA}px, ${twitchUp}px, 0px)` },
          { transform: `translate3d(${twitchSideB}px, ${twitchDown}px, 0px)` },
          { transform: `translate3d(${Math.round(twitchSideA * 0.45)}px, ${settleY}px, 0px)` },
          { transform: `translate3d(${Math.round(twitchSideB * 0.3)}px, ${Math.round(-settleY * 0.5)}px, 0px)` },
          { transform: "translate3d(0px, 0px, 0px)" }
        ],
        {
          duration,
          iterations: 1,
          easing: "linear",
          fill: "none",
          delay
        }
      );
    });

    for (const animation of elementAnimations) {
      state.layoutDriftAnimations.push(animation);
      animation.addEventListener("finish", () => {
        state.layoutDriftAnimations = state.layoutDriftAnimations.filter((item) => item !== animation);
      }, { once: true });
      animation.addEventListener("cancel", () => {
        state.layoutDriftAnimations = state.layoutDriftAnimations.filter((item) => item !== animation);
      }, { once: true });
    }
  };

  const buildChaosText = (targetLength, chaosConfig) => {
    const phrases = chaosConfig?.phrases ?? CONFIG.chaosLevels.level2.phrases;
    const shortPhrases = CONFIG.chaosShortPhrases;
    const shortestMainPhraseLength = Math.min(...phrases.map((phrase) => phrase.length));
    const phrasePool = targetLength > 0 && targetLength < shortestMainPhraseLength
      ? shortPhrases
      : phrases;
    const phrase = phrasePool[Math.floor(Math.random() * phrasePool.length)];

    if (targetLength <= 0) {
      return phrase;
    }

    let output = "";
    while (output.length < targetLength) {
      output += output ? ` ${phrase}` : phrase;
    }
    return output.slice(0, targetLength);
  };

  const isVisibleElement = (element) => {
    if (!element || host.contains(element)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      return false;
    }

    return element.getClientRects().length > 0;
  };

  const getChaosLevelConfig = () => {
    if (state.happiness === 0) {
      return CONFIG.chaosLevels.level3;
    }
    if (state.happiness <= 30) {
      return CONFIG.chaosLevels.level2;
    }
    if (state.happiness <= 60) {
      return CONFIG.chaosLevels.level1;
    }
    return null;
  };

  const getActiveAppleUrl = () => {
    const chaosConfig = getChaosLevelConfig();
    if (chaosConfig === CONFIG.chaosLevels.level2 || chaosConfig === CONFIG.chaosLevels.level3) {
      return rottenAppleUrl;
    }
    return appleUrl;
  };

  const collectChaosTargets = (chaosConfig) => {
    const targets = [];
    const seen = new Set();
    const selectors = [
      "input[type='text']",
      "input[type='search']",
      "input[type='email']",
      "input[type='url']",
      "input[type='tel']",
      "textarea"
    ];

    for (const input of document.querySelectorAll(selectors.join(","))) {
      if (!isVisibleElement(input) || input.disabled || input.readOnly) {
        continue;
      }

      const sourceText = input.value || input.placeholder || "";
      if (sourceText.trim().length < 3) {
        continue;
      }

      targets.push({ kind: "input", node: input, text: sourceText });
      seen.add(input);
    }

    for (const image of document.querySelectorAll("img")) {
      if (!isVisibleElement(image) || image === apple || host.contains(image)) {
        continue;
      }

      const rect = image.getBoundingClientRect();
      if (rect.width < 24 || rect.height < 24) {
        continue;
      }

      if (!image.currentSrc && !image.src) {
        continue;
      }

      targets.push({
        kind: "image",
        node: image
      });
      seen.add(image);
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(textNode) {
        const parent = textNode.parentElement;
        if (!parent || seen.has(parent) || host.contains(parent)) {
          return NodeFilter.FILTER_REJECT;
        }

        const tag = parent.tagName;
        if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }

        const text = textNode.textContent?.trim() ?? "";
        if (text.length < 4 || text.length > 140 || !isVisibleElement(parent)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (parent.children.length > 0) {
          const directTextLength = Array.from(parent.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent?.trim() ?? "")
            .join(" ")
            .trim()
            .length;

          if (directTextLength < 4) {
            return NodeFilter.FILTER_REJECT;
          }
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let currentNode = walker.nextNode();
    while (currentNode) {
      targets.push({
        kind: "text",
        node: currentNode,
        text: currentNode.textContent ?? ""
      });
      currentNode = walker.nextNode();
    }

    for (let i = targets.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [targets[i], targets[j]] = [targets[j], targets[i]];
    }

    const targetCount = clamp(
      Math.ceil(targets.length * clamp(chaosConfig.targetRatio * getOccurrenceMultiplier("chaosOccurrence"), 0, 1)),
      Math.min(scaleCount(chaosConfig.minTargets, "chaosOccurrence"), targets.length),
      targets.length
    );

    return targets.slice(0, targetCount);
  };

  const restoreChaos = () => {
    clearChaosTimers();
    stopLayoutDrift();
    for (const restore of state.chaosRestorers) {
      restore();
    }
    state.chaosRestorers = [];
    state.activeRedBlinkPulses = 0;
    state.activeChaosMutations = 0;
  };

  const registerChaosRestorer = (restore) => {
    let restored = false;
    const wrappedRestore = () => {
      if (restored) {
        return;
      }
      restored = true;
      restore();
    };

    state.chaosRestorers.push(wrappedRestore);
    return wrappedRestore;
  };

  const scheduleChaosTimer = (callback, delayMs) => {
    const timerId = window.setTimeout(() => {
      state.chaosTimers = state.chaosTimers.filter((id) => id !== timerId);
      callback();
      finishChaosIfIdle();
    }, delayMs);

    state.chaosTimers.push(timerId);
  };

  const triggerLayoutDriftPulse = (chaosConfig) => {
    if (Math.random() > getOccurrenceMultiplier("twitchOccurrence")) {
      return;
    }
    startLayoutDrift(chaosConfig);
  };

  const collectRedBlinkTargets = (pulseCount) => {
    const targets = [];
    const selectors = [
      "img",
      "p",
      "span",
      "label",
      "small",
      "strong",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "li",
      "button",
      "a",
      "input",
      "textarea",
      "select",
      "[role='button']",
      "[role='link']",
      ".card",
      ".tile",
      ".item"
    ];

    for (const element of document.body.querySelectorAll(selectors.join(","))) {
      if (host.contains(element) || !isVisibleElement(element)) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 12) {
        continue;
      }

      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.position === "fixed" || computedStyle.position === "sticky") {
        continue;
      }

      targets.push(element);
    }

    for (let i = targets.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [targets[i], targets[j]] = [targets[j], targets[i]];
    }

    return targets.slice(0, Math.min(pulseCount, targets.length));
  };

  const startRedBlinkPulse = (chaosConfig) => {
    const blink = chaosConfig.redBlink;
    if (!blink || !document.body || scaleCount(blink.pulseCount, "flashOccurrence") <= 0) {
      return;
    }

    const targets = collectRedBlinkTargets(scaleCount(blink.pulseCount, "flashOccurrence"));
    for (const element of targets) {
      const startDelay = Math.round(
        blink.minStartDelayMs + Math.random() * Math.max(0, blink.maxStartDelayMs - blink.minStartDelayMs)
      );
      const hideDuration = Math.round(blink.hideDurationMs * (0.9 + Math.random() * 0.25));
      const showDuration = Math.round(blink.showDurationMs * (0.9 + Math.random() * 0.25));
      const restoreInline = {
        opacity: element.style.opacity,
        filter: element.style.filter,
        color: element.style.color,
        backgroundColor: element.style.backgroundColor,
        boxShadow: element.style.boxShadow,
        transition: element.style.transition
      };

      const hideElement = () => {
        if (!element.isConnected) {
          return;
        }
        element.style.transition = "none";
        element.style.opacity = "0";
      };

      const showRedElement = () => {
        if (!element.isConnected) {
          return;
        }
        element.style.transition = "none";
        element.style.opacity = "1";
        element.style.filter = "sepia(1) saturate(5) hue-rotate(-35deg) brightness(0.78) contrast(1.35)";
        element.style.color = "#ff3b3b";
        element.style.backgroundColor = "rgba(255, 0, 0, 0.14)";
        element.style.boxShadow = "0 0 12px rgba(255, 0, 0, 0.82)";
      };

      const restoreElement = () => {
        if (element.isConnected) {
          element.style.opacity = restoreInline.opacity;
          element.style.filter = restoreInline.filter;
          element.style.color = restoreInline.color;
          element.style.backgroundColor = restoreInline.backgroundColor;
          element.style.boxShadow = restoreInline.boxShadow;
          element.style.transition = restoreInline.transition;
        }

        if (state.activeRedBlinkPulses > 0) {
          state.activeRedBlinkPulses -= 1;
        }
      };

      state.activeRedBlinkPulses += 1;
      scheduleChaosTimer(hideElement, startDelay);
      scheduleChaosTimer(showRedElement, startDelay + hideDuration);
      scheduleChaosTimer(hideElement, startDelay + hideDuration + showDuration);
      scheduleChaosTimer(showRedElement, startDelay + hideDuration * 2 + showDuration);
      scheduleChaosTimer(
        restoreElement,
        startDelay + hideDuration * 2 + showDuration * 2
      );
    }
  };

  const createChaosMutation = (target, chaosConfig) => {
    if (target.kind === "input") {
      const input = target.node;
      const originalValue = input.value;
      const originalPlaceholder = input.placeholder;
      const useValue = originalValue.trim().length > 0;
      const replacement = buildChaosText(
        (useValue ? originalValue : originalPlaceholder).length,
        chaosConfig
      );

      return {
        apply() {
          if (!input.isConnected) {
            return;
          }
          if (useValue) {
            input.value = replacement;
          } else {
            input.placeholder = replacement;
          }
        },
        restore() {
          if (!input.isConnected) {
            return;
          }
          input.value = originalValue;
          input.placeholder = originalPlaceholder;
        }
      };
    }

    if (target.kind === "image") {
      const image = target.node;
      const rect = image.getBoundingClientRect();
      const originalSrc = image.getAttribute("src");
      const originalSrcset = image.getAttribute("srcset");
      const originalSizes = image.getAttribute("sizes");
      const originalWidth = image.style.width;
      const originalHeight = image.style.height;
      const originalObjectFit = image.style.objectFit;

      return {
        apply() {
          if (!image.isConnected) {
            return;
          }
          image.style.width = `${Math.round(rect.width)}px`;
          image.style.height = `${Math.round(rect.height)}px`;
          image.style.objectFit = "contain";
          image.setAttribute("src", getActiveAppleUrl());
          image.removeAttribute("srcset");
          image.removeAttribute("sizes");
        },
        restore() {
          if (!image.isConnected) {
            return;
          }

          if (originalSrc === null) {
            image.removeAttribute("src");
          } else {
            image.setAttribute("src", originalSrc);
          }

          if (originalSrcset === null) {
            image.removeAttribute("srcset");
          } else {
            image.setAttribute("srcset", originalSrcset);
          }

          if (originalSizes === null) {
            image.removeAttribute("sizes");
          } else {
            image.setAttribute("sizes", originalSizes);
          }

          image.style.width = originalWidth;
          image.style.height = originalHeight;
          image.style.objectFit = originalObjectFit;
        }
      };
    }

    const textNode = target.node;
    const originalText = textNode.textContent ?? "";

    return {
      apply() {
        if (!textNode.isConnected) {
          return;
        }
        textNode.textContent = buildChaosText(originalText.length, chaosConfig);
      },
      restore() {
        if (!textNode.isConnected) {
          return;
        }
        textNode.textContent = originalText;
      }
    };
  };

  const triggerChaos = () => {
    const chaosConfig = getChaosLevelConfig();
    if (!chaosConfig || !activeSettings.petEnabled) {
      return;
    }

    if (state.activeChaosMutations >= scaleCount(chaosConfig.maxConcurrentMutations, "chaosOccurrence")) {
      return;
    }

    const targets = collectChaosTargets(chaosConfig);
    if (targets.length === 0) {
      return;
    }

    triggerLayoutDriftPulse(chaosConfig);

    for (const target of targets) {
      const mutation = createChaosMutation(target, chaosConfig);
      const restore = registerChaosRestorer(mutation.restore);
      const latestStart = Math.max(0, chaosConfig.durationMs - chaosConfig.minFlickerMs);
      const startDelay = Math.floor(Math.random() * (latestStart + 1));
      const maxVisibleDuration = Math.min(
        chaosConfig.maxFlickerMs,
        chaosConfig.durationMs - startDelay
      );
      const minVisibleDuration = Math.min(chaosConfig.minFlickerMs, maxVisibleDuration);
      const visibleDuration = minVisibleDuration + Math.floor(
        Math.random() * Math.max(1, maxVisibleDuration - minVisibleDuration + 1)
      );

      scheduleChaosTimer(() => {
        if (state.activeChaosMutations >= scaleCount(chaosConfig.maxConcurrentMutations, "chaosOccurrence")) {
          return;
        }
        state.activeChaosMutations += 1;
        mutation.apply();
      }, startDelay);

      scheduleChaosTimer(() => {
        if (state.activeChaosMutations > 0) {
          state.activeChaosMutations -= 1;
        }
        restore();
      }, startDelay + visibleDuration);
    }
  };

  const endFeeding = () => {
    clearFeedingTimeout();
    state.feeding = false;
    state.draggingApple = false;
    setNextFeedingCooldown();
    if (state.activePointerId !== null) {
      apple.releasePointerCapture?.(state.activePointerId);
      state.activePointerId = null;
    }
    state.appleVisible = false;
    unfreezePet();
    renderApple();
    updateHud();
    scheduleNextAction(performance.now());
  };

  const tryStartFeeding = (now) => {
    if (
      !activeSettings.petEnabled ||
      state.feeding ||
      now < state.nextFeedingAllowedAt ||
      Math.random() >= CONFIG.feedingChance
    ) {
      return false;
    }

    state.feeding = true;
    state.action = "idle";
    state.actionUntil = now + CONFIG.feedingDurationMs;
    state.draggingApple = false;
    state.appleVisible = true;
    apple.src = getActiveAppleUrl();
    state.appleX = 32 + Math.random() * Math.max(40, window.innerWidth - 120);
    state.appleY = 32 + Math.random() * Math.max(40, window.innerHeight - 220);
    freezePet();
    renderApple();
    updateHud();
    clearFeedingTimeout();
    state.feedingTimeoutId = window.setTimeout(() => {
      endFeeding();
    }, CONFIG.feedingDurationMs);
    return true;
  };

  const scheduleNextAction = (now) => {
    if (!activeSettings.petEnabled) {
      return;
    }

    if (tryStartFeeding(now)) {
      return;
    }

    const shouldIdle = Math.random() < CONFIG.idleChance + (state.happiness > 80 ? 0.18 : 0);
    if (shouldIdle) {
      state.action = "idle";
      state.actionUntil = now + getIdleDuration();
    } else {
      state.action = "walk";
      state.actionUntil = now + getWalkDuration();
      if (Math.random() < 0.35) {
        state.direction *= -1;
      }
    }
  };

  const animate = (now) => {
    const deltaSeconds = Math.min((now - state.lastFrameTime) / 1000, 0.05);
    state.lastFrameTime = now;

    if (!activeSettings.petEnabled) {
      requestAnimationFrame(animate);
      return;
    }

    if (!state.feeding && now >= state.actionUntil) {
      scheduleNextAction(now);
    }

    if (!state.feeding && state.action === "walk") {
      state.x += getMovementSpeed() * state.direction * deltaSeconds;
      const maxX = Math.max(0, window.innerWidth - CONFIG.petWidth - 8);
      if (state.x <= 0) {
        state.x = 0;
        state.direction = 1;
        state.actionUntil = now + getWalkDuration() * 0.7;
      } else if (state.x >= maxX) {
        state.x = maxX;
        state.direction = -1;
        state.actionUntil = now + getWalkDuration() * 0.7;
      }
    }

    renderPosition();
    requestAnimationFrame(animate);
  };

  const setHappiness = (nextValue) => {
    state.happiness = clamp(nextValue, CONFIG.minHappiness, CONFIG.maxHappiness);
    updateMoodStyles();
    updateHud();
  };

  pet.addEventListener("click", () => {
    if (!activeSettings.petEnabled) {
      return;
    }
    setHappiness(state.happiness + activeSettings.clickGain);
    petVisual.style.transform = `scaleX(${state.direction < 0 ? 1 : -1}) scale(1.08)`;
    window.setTimeout(() => {
      petVisual.style.transform = `scaleX(${state.direction < 0 ? 1 : -1})`;
    }, 140);
  });

  const isPointOverPet = (x, y) => {
    const petLeft = state.x - CONFIG.appleDropPadding;
    const petRight = state.x + CONFIG.petWidth + CONFIG.appleDropPadding;
    const petTop = window.innerHeight - CONFIG.groundOffset - CONFIG.petHeight - CONFIG.appleDropPadding;
    const petBottom = window.innerHeight - CONFIG.groundOffset + CONFIG.appleDropPadding;

    return (
      x >= petLeft &&
      x <= petRight &&
      y >= petTop &&
      y <= petBottom
    );
  };

  const tryFeedBear = () => {
    if (!activeSettings.petEnabled || !state.feeding || !state.appleVisible) {
      return false;
    }

    const appleCenterX = state.appleX + CONFIG.appleSize / 2;
    const appleCenterY = state.appleY + CONFIG.appleSize / 2;
    const pointerNearPet = isPointOverPet(state.pointerX, state.pointerY);
    const appleNearPet = isPointOverPet(appleCenterX, appleCenterY);

    if (!pointerNearPet && !appleNearPet) {
      return false;
    }

    setHappiness(state.happiness + CONFIG.appleFeedGain);
    endFeeding();
    return true;
  };

  const moveAppleToPointer = (clientX, clientY) => {
    state.pointerX = clientX;
    state.pointerY = clientY;
    state.appleX = clamp(clientX - state.dragOffsetX, 8, window.innerWidth - CONFIG.appleSize - 8);
    state.appleY = clamp(clientY - state.dragOffsetY, 8, window.innerHeight - CONFIG.appleSize - 8);
    renderApple();
    tryFeedBear();
  };

  apple.addEventListener("pointerdown", (event) => {
    if (!state.feeding) {
      return;
    }
    event.preventDefault();
    state.draggingApple = true;
    state.activePointerId = event.pointerId;
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    state.dragOffsetX = event.clientX - state.appleX;
    state.dragOffsetY = event.clientY - state.appleY;
    apple.setPointerCapture(event.pointerId);
    renderApple();
  });

  const handlePointerMove = (event) => {
    if (!state.draggingApple || event.pointerId !== state.activePointerId) {
      return;
    }
    moveAppleToPointer(event.clientX, event.clientY);
  };

  const finishAppleDrag = (event) => {
    if (!state.draggingApple || event.pointerId !== state.activePointerId) {
      return;
    }

    state.pointerX = event.clientX;
    state.pointerY = event.clientY;

    if (tryFeedBear()) {
      return;
    }

    apple.releasePointerCapture(event.pointerId);
    state.draggingApple = false;
    state.activePointerId = null;
    renderApple();
  };

  const cancelAppleDrag = (event) => {
    if (!state.draggingApple || event.pointerId !== state.activePointerId) {
      return;
    }

    apple.releasePointerCapture(event.pointerId);
    state.draggingApple = false;
    state.activePointerId = null;
    renderApple();
  };

  window.addEventListener("pointermove", handlePointerMove, true);
  window.addEventListener("pointerup", finishAppleDrag, true);
  window.addEventListener("pointercancel", cancelAppleDrag, true);

  const applySettings = (nextSettings) => {
    Object.assign(activeSettings, DEFAULT_SETTINGS, nextSettings ?? {});
    setNextFeedingCooldown();
    applyPetEnabledState();
    startDecayLoop();
  };

  const loadSettings = async () => {
    try {
      const stored = await chrome.storage.sync.get(SETTINGS_KEY);
      applySettings(stored[SETTINGS_KEY]);
    } catch {
      applySettings();
    }
  };

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes[SETTINGS_KEY]) {
      return;
    }

    applySettings(changes[SETTINGS_KEY].newValue);
  });

  window.addEventListener("resize", () => {
    renderPosition();
    if (state.appleVisible) {
      state.appleX = clamp(state.appleX, 8, window.innerWidth - CONFIG.appleSize - 8);
      state.appleY = clamp(state.appleY, 8, window.innerHeight - CONFIG.appleSize - 8);
      renderApple();
    }
  });

  updateMoodStyles();
  updateHud();
  renderPosition();
  renderApple();
  scheduleNextAction(performance.now());
  applyPetEnabledState();
  startDecayLoop();
  void loadSettings();
  requestAnimationFrame(animate);
})();
