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
    sleepDurationMs: 10000,
    sleepTickMs: 1000,
    sleepHappinessPerTick: 2,
    gameDurationMs: 15000,
    gameTickMs: 1000,
    gameSpawnMinMs: 700,
    gameSpawnMaxMs: 950,
    gameAppleMinSpeed: 220,
    gameAppleMaxSpeed: 330,
    gameAppleMinSize: 44,
    gameAppleMaxSize: 66,
    gameRewardPerCatch: 3,
    gameFollowSpeed: 2,
    gameResultMessageMs: 2200,
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
  const activeChaosTargets = new WeakSet();
  const activeRedBlinkTargets = new WeakSet();

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
        transform-origin: center center;
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

      .menu-toggle {
        position: absolute;
        top: 10px;
        right: 8px;
        width: 16px;
        height: 16px;
        border: 0;
        border-radius: 999px;
        background: #fff3de;
        box-shadow: 0 0 0 2px rgba(81, 59, 40, 0.18);
        cursor: pointer;
        pointer-events: auto;
        z-index: 3;
        transition: opacity 140ms ease, transform 140ms ease, background 140ms ease;
      }

      .menu-toggle::after {
        content: "";
        position: absolute;
        inset: 4px;
        border-radius: inherit;
        background: #9d3f32;
      }

      .menu-toggle:hover {
        transform: scale(1.08);
      }

      .menu-toggle.disabled {
        opacity: 0.32;
        cursor: not-allowed;
      }

      .action-menu {
        position: absolute;
        left: 50%;
        bottom: calc(100% - 8px);
        transform: translateX(-50%);
        width: 186px;
        padding: 10px;
        border-radius: 14px;
        background: rgba(18, 20, 26, 0.88);
        color: #f5f7fa;
        font-family: Arial, sans-serif;
        font-size: 12px;
        line-height: 1.3;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
        backdrop-filter: blur(6px);
      }

      .action-menu.hidden {
        display: none;
      }

      .menu-row {
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

      .menu-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 10px;
      }

      .menu-button {
        border: 0;
        border-radius: 10px;
        padding: 8px 10px;
        background: rgba(255, 255, 255, 0.12);
        color: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }

      .menu-button.primary {
        background: rgba(255, 108, 82, 0.26);
      }

      .menu-button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .game-ui {
        position: absolute;
        top: 14px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(18, 20, 26, 0.82);
        color: #f8f4ee;
        font-family: Arial, sans-serif;
        font-size: 12px;
        font-weight: 700;
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.22);
        pointer-events: none;
      }

      .game-ui.hidden {
        display: none;
      }

      .game-result {
        position: absolute;
        top: 56px;
        left: 50%;
        transform: translateX(-50%);
        padding: 10px 14px;
        border-radius: 12px;
        background: rgba(18, 20, 26, 0.88);
        color: #fff4ea;
        font-family: Arial, sans-serif;
        font-size: 13px;
        font-weight: 700;
        box-shadow: 0 10px 22px rgba(0, 0, 0, 0.24);
        pointer-events: none;
      }

      .game-result.hidden {
        display: none;
      }

      .game-apples {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .game-apple {
        position: absolute;
        left: 0;
        top: 0;
        width: 52px;
        height: 52px;
        object-fit: contain;
        filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.28));
        pointer-events: none;
      }

      @keyframes bob {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
    </style>
    <div class="pet-layer">
      <div class="pet-shell">
        <button class="menu-toggle" type="button" aria-label="Open pet menu"></button>
        <div class="action-menu hidden">
          <div class="menu-row">
            <span>Happiness</span>
            <span class="menu-value">80</span>
          </div>
          <div class="bar">
            <div class="bar-fill menu-bar-fill"></div>
          </div>
          <div class="menu-row" style="margin-top: 6px; margin-bottom: 0;">
            <span class="menu-state">normal</span>
            <span class="hint menu-hint">menu</span>
          </div>
          <div class="menu-actions">
            <button class="menu-button primary action-sleep" type="button">Sleep</button>
            <button class="menu-button action-play" type="button">Play Game</button>
            <button class="menu-button" type="button" disabled>Feed Soon</button>
            <button class="menu-button action-close" type="button">Close</button>
          </div>
        </div>
        <div class="pet" title="Click to cheer up the pet">
          <div class="pet-visual">
            <img src="${gifUrl}" alt="Extension pet">
            <img class="pet-still hidden" alt="Frozen pet">
          </div>
        </div>
      </div>
      <div class="game-ui hidden">
        <span class="game-score">Caught: 0</span>
        <span class="game-time">15s</span>
      </div>
      <div class="game-result hidden"></div>
      <div class="game-apples"></div>
      <img class="apple" alt="Apple">
    </div>
  `;

  const appleUrl = chrome.runtime.getURL("apple.webp");
  const rottenAppleUrl = chrome.runtime.getURL("rotten-apple.png");
  const level2aUrl = chrome.runtime.getURL("level2a.webp");
  const level3aUrl = chrome.runtime.getURL("level3a.jpg");
  const level3bUrl = chrome.runtime.getURL("level3b.jpg");
  const shell = shadow.querySelector(".pet-shell");
  const pet = shadow.querySelector(".pet");
  const petVisual = shadow.querySelector(".pet-visual");
  const petImg = shadow.querySelector(".pet-visual img:not(.pet-still)");
  const petStill = shadow.querySelector(".pet-still");
  const apple = shadow.querySelector(".apple");
  const menuToggle = shadow.querySelector(".menu-toggle");
  const actionMenu = shadow.querySelector(".action-menu");
  const valueLabel = shadow.querySelector(".menu-value");
  const stateLabel = shadow.querySelector(".menu-state");
  const barFill = shadow.querySelector(".menu-bar-fill");
  const menuHint = shadow.querySelector(".menu-hint");
  const sleepButton = shadow.querySelector(".action-sleep");
  const playButton = shadow.querySelector(".action-play");
  const closeButton = shadow.querySelector(".action-close");
  const gameUi = shadow.querySelector(".game-ui");
  const gameScore = shadow.querySelector(".game-score");
  const gameTime = shadow.querySelector(".game-time");
  const gameResult = shadow.querySelector(".game-result");
  const gameApplesLayer = shadow.querySelector(".game-apples");

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
    sleeping: false,
    sleepTimerId: null,
    sleepTicksRemaining: 0,
    menuOpen: false,
    gameActive: false,
    gameTimerId: null,
    gameSpawnTimerId: null,
    gameTimeRemainingMs: 0,
    gameCaughtCount: 0,
    gameTargetX: null,
    gameApples: [],
    nextGameAppleId: 0,
    gameResultTimerId: null,
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
  const isBearPaused = () => state.feeding || state.menuOpen || state.sleeping || state.gameActive;

  const updateActionMenuState = () => {
    actionMenu.classList.toggle("hidden", !state.menuOpen);
    menuToggle.classList.toggle("disabled", state.feeding || state.gameActive);
    sleepButton.disabled = state.feeding || state.sleeping || state.gameActive;
    playButton.disabled = state.feeding || state.sleeping || state.gameActive;
    menuHint.textContent = state.feeding
      ? "busy"
      : state.gameActive
        ? "playing"
      : state.sleeping
        ? "sleeping"
        : state.menuOpen
          ? "actions"
          : "menu";
  };

  const openActionMenu = () => {
    if (state.feeding || state.gameActive) {
      return;
    }
    state.menuOpen = true;
    freezePet();
    updateActionMenuState();
    updateHud();
  };

  const closeActionMenu = () => {
    state.menuOpen = false;
    if (!state.feeding && !state.sleeping) {
      unfreezePet();
    }
    updateActionMenuState();
  };

  const applyPetEnabledState = () => {
    const enabled = activeSettings.petEnabled;
    host.style.display = enabled ? "" : "none";

    if (enabled) {
      renderApple();
      updateHud();
      updateActionMenuState();
      updateGameUi();
      return;
    }

    clearFeedingTimeout();
    if (state.sleepTimerId !== null) {
      window.clearInterval(state.sleepTimerId);
      state.sleepTimerId = null;
    }
    endGame(false);
    state.feeding = false;
    state.sleeping = false;
    state.menuOpen = false;
    state.draggingApple = false;
    state.appleVisible = false;
    renderApple();
    restoreChaos();
    updateActionMenuState();
  };

  const setNextFeedingCooldown = () => {
    state.nextFeedingAllowedAt =
      performance.now() +
      activeSettings.feedingMinCooldownMs +
      Math.random() * CONFIG.feedingExtraCooldownMs;
  };

  const getMood = () => {
    if (state.sleeping) {
      return "sleeping";
    }
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
      actionMenu.style.border = "1px solid rgba(116, 201, 113, 0.35)";
    } else if (state.happiness >= 50) {
      actionMenu.style.border = "1px solid rgba(247, 201, 72, 0.35)";
    } else {
      actionMenu.style.border = "1px solid rgba(255, 90, 90, 0.42)";
    }
  };

  const updateGameUi = () => {
    gameUi.classList.toggle("hidden", !state.gameActive);
    gameScore.textContent = `Caught: ${state.gameCaughtCount}`;
    gameTime.textContent = `${Math.max(0, Math.ceil(state.gameTimeRemainingMs / 1000))}s`;
  };

  const showGameResult = (message) => {
    if (state.gameResultTimerId !== null) {
      window.clearTimeout(state.gameResultTimerId);
      state.gameResultTimerId = null;
    }

    gameResult.textContent = message;
    gameResult.classList.remove("hidden");
    state.gameResultTimerId = window.setTimeout(() => {
      gameResult.classList.add("hidden");
      state.gameResultTimerId = null;
    }, CONFIG.gameResultMessageMs);
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
    const facingScale = state.direction < 0 ? 1 : -1;
    petVisual.style.transform = `scaleX(${facingScale})${state.sleeping ? " rotate(180deg)" : ""}`;
  };

  const clearGameApples = () => {
    for (const appleState of state.gameApples) {
      appleState.el.remove();
    }
    state.gameApples = [];
  };

  const scheduleNextGameApple = () => {
    if (!state.gameActive) {
      return;
    }

    const delay = CONFIG.gameSpawnMinMs + Math.random() * (CONFIG.gameSpawnMaxMs - CONFIG.gameSpawnMinMs);
    state.gameSpawnTimerId = window.setTimeout(() => {
      if (!state.gameActive) {
        return;
      }

      const size = CONFIG.gameAppleMinSize + Math.random() * (CONFIG.gameAppleMaxSize - CONFIG.gameAppleMinSize);
      const x = Math.random() * Math.max(16, window.innerWidth - size - 16);
      const img = document.createElement("img");
      img.className = "game-apple";
      img.src = appleUrl;
      img.alt = "Falling apple";
      img.style.width = `${Math.round(size)}px`;
      img.style.height = `${Math.round(size)}px`;
      gameApplesLayer.appendChild(img);

      state.gameApples.push({
        id: state.nextGameAppleId += 1,
        x,
        y: -size,
        size,
        speed: CONFIG.gameAppleMinSpeed + Math.random() * (CONFIG.gameAppleMaxSpeed - CONFIG.gameAppleMinSpeed),
        el: img
      });

      scheduleNextGameApple();
    }, delay);
  };

  const endGame = (grantReward = true) => {
    if (state.gameTimerId !== null) {
      window.clearInterval(state.gameTimerId);
      state.gameTimerId = null;
    }
    if (state.gameSpawnTimerId !== null) {
      window.clearTimeout(state.gameSpawnTimerId);
      state.gameSpawnTimerId = null;
    }

    const caughtCount = state.gameCaughtCount;
    const reward = grantReward ? caughtCount * CONFIG.gameRewardPerCatch : 0;

    state.gameActive = false;
    state.gameTimeRemainingMs = 0;
    state.gameTargetX = null;
    state.gameCaughtCount = 0;
    clearGameApples();
    updateGameUi();

    if (reward > 0) {
      setHappiness(state.happiness + reward);
    }

    showGameResult(`Caught ${caughtCount} apples, +${reward} happiness`);

    if (!state.menuOpen && !state.feeding && !state.sleeping) {
      unfreezePet();
    }
    updateActionMenuState();
    scheduleNextAction(performance.now());
  };

  const startGame = () => {
    if (state.feeding || state.sleeping || state.gameActive) {
      return;
    }

    state.menuOpen = false;
    state.gameActive = true;
    state.action = "idle";
    state.gameCaughtCount = 0;
    state.gameTimeRemainingMs = CONFIG.gameDurationMs;
    state.gameTargetX = state.x;
    freezePet();
    updateActionMenuState();
    updateGameUi();

    clearGameApples();
    scheduleNextGameApple();

    if (state.gameTimerId !== null) {
      window.clearInterval(state.gameTimerId);
    }
    state.gameTimerId = window.setInterval(() => {
      state.gameTimeRemainingMs -= CONFIG.gameTickMs;
      updateGameUi();
      if (state.gameTimeRemainingMs <= 0) {
        endGame(true);
      }
    }, CONFIG.gameTickMs);
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

  const pickChaosImageUrl = () => {
    const chaosConfig = getChaosLevelConfig();
    if (chaosConfig === CONFIG.chaosLevels.level3) {
      const pool = [rottenAppleUrl, level3aUrl, level3bUrl];
      return pool[Math.floor(Math.random() * pool.length)];
    }

    if (chaosConfig === CONFIG.chaosLevels.level2) {
      const pool = [rottenAppleUrl, level2aUrl];
      return pool[Math.floor(Math.random() * pool.length)];
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
      if (!isVisibleElement(input) || input.disabled || input.readOnly || activeChaosTargets.has(input)) {
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
      if (!isVisibleElement(image) || image === apple || host.contains(image) || activeChaosTargets.has(image)) {
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
        if (activeChaosTargets.has(textNode)) {
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
      if (host.contains(element) || !isVisibleElement(element) || activeRedBlinkTargets.has(element)) {
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
      activeRedBlinkTargets.add(element);
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

      const restoreElement = registerChaosRestorer(() => {
        if (element.isConnected) {
          element.style.opacity = restoreInline.opacity;
          element.style.filter = restoreInline.filter;
          element.style.color = restoreInline.color;
          element.style.backgroundColor = restoreInline.backgroundColor;
          element.style.boxShadow = restoreInline.boxShadow;
          element.style.transition = restoreInline.transition;
        }
        activeRedBlinkTargets.delete(element);
      });

      const finishRedBlinkPulse = () => {
        restoreElement();
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
        finishRedBlinkPulse,
        startDelay + hideDuration * 2 + showDuration * 2
      );
    }
  };

  const createChaosMutation = (target, chaosConfig) => {
    if (target.kind === "input") {
      const input = target.node;
      activeChaosTargets.add(input);
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
            activeChaosTargets.delete(input);
            return;
          }
          input.value = originalValue;
          input.placeholder = originalPlaceholder;
          activeChaosTargets.delete(input);
        }
      };
    }

    if (target.kind === "image") {
      const image = target.node;
      activeChaosTargets.add(image);
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
          image.setAttribute("src", pickChaosImageUrl());
          image.removeAttribute("srcset");
          image.removeAttribute("sizes");
        },
        restore() {
          if (!image.isConnected) {
            activeChaosTargets.delete(image);
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
          activeChaosTargets.delete(image);
        }
      };
    }

    const textNode = target.node;
    activeChaosTargets.add(textNode);
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
          activeChaosTargets.delete(textNode);
          return;
        }
        textNode.textContent = originalText;
        activeChaosTargets.delete(textNode);
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
    if (!state.menuOpen && !state.sleeping) {
      unfreezePet();
    }
    renderApple();
    updateHud();
    updateActionMenuState();
    scheduleNextAction(performance.now());
  };

  const endSleep = () => {
    if (state.sleepTimerId !== null) {
      window.clearInterval(state.sleepTimerId);
      state.sleepTimerId = null;
    }
    state.sleeping = false;
    state.sleepTicksRemaining = 0;
    if (!state.menuOpen && !state.feeding) {
      unfreezePet();
    }
    renderPosition();
    updateHud();
    updateActionMenuState();
    scheduleNextAction(performance.now());
  };

  const startSleep = () => {
    if (state.feeding || state.sleeping) {
      return;
    }

    state.menuOpen = false;
    state.sleeping = true;
    state.action = "idle";
    state.sleepTicksRemaining = Math.floor(CONFIG.sleepDurationMs / CONFIG.sleepTickMs);
    freezePet();
    renderPosition();
    updateActionMenuState();
    updateHud();

    if (state.sleepTimerId !== null) {
      window.clearInterval(state.sleepTimerId);
    }

    state.sleepTimerId = window.setInterval(() => {
      if (state.sleepTicksRemaining <= 0) {
        endSleep();
        return;
      }

      state.sleepTicksRemaining -= 1;
      setHappiness(state.happiness + CONFIG.sleepHappinessPerTick);

      if (state.sleepTicksRemaining <= 0) {
        endSleep();
      }
    }, CONFIG.sleepTickMs);
  };

  const tryStartFeeding = (now) => {
    if (
      !activeSettings.petEnabled ||
      state.menuOpen ||
      state.sleeping ||
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
    updateActionMenuState();
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

    if (!isBearPaused() && now >= state.actionUntil) {
      scheduleNextAction(now);
    }

    if (!isBearPaused() && state.action === "walk") {
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

    if (state.gameActive) {
      if (state.gameTargetX !== null) {
        const targetX = clamp(state.gameTargetX - CONFIG.petWidth / 2, 0, Math.max(0, window.innerWidth - CONFIG.petWidth - 8));
        state.x += (targetX - state.x) * clamp(CONFIG.gameFollowSpeed * deltaSeconds, 0, 1);
      }

      const petLeft = state.x;
      const petRight = state.x + CONFIG.petWidth;
      const petTop = window.innerHeight - CONFIG.groundOffset - CONFIG.petHeight;
      const petBottom = window.innerHeight - CONFIG.groundOffset;

      state.gameApples = state.gameApples.filter((appleState) => {
        appleState.y += appleState.speed * deltaSeconds;
        appleState.el.style.transform = `translate(${appleState.x}px, ${appleState.y}px)`;

        const appleLeft = appleState.x;
        const appleRight = appleState.x + appleState.size;
        const appleTop = appleState.y;
        const appleBottom = appleState.y + appleState.size;
        const caught =
          appleLeft < petRight &&
          appleRight > petLeft &&
          appleTop < petBottom &&
          appleBottom > petTop;

        if (caught) {
          state.gameCaughtCount += 1;
          updateGameUi();
          appleState.el.remove();
          return false;
        }

        if (appleTop > window.innerHeight + appleState.size) {
          appleState.el.remove();
          return false;
        }

        return true;
      });
    }

    renderPosition();
    requestAnimationFrame(animate);
  };

  const setHappiness = (nextValue) => {
    const previousHappiness = state.happiness;
    state.happiness = clamp(nextValue, CONFIG.minHappiness, CONFIG.maxHappiness);

    const crossedAboveLevel2 = previousHappiness <= 30 && state.happiness > 30;
    const crossedAboveLevel1 = previousHappiness <= 60 && state.happiness > 60;
    if (crossedAboveLevel2 || crossedAboveLevel1) {
      restoreChaos();
    }

    updateMoodStyles();
    updateHud();
  };

  pet.addEventListener("click", () => {
    if (!activeSettings.petEnabled || state.menuOpen || state.sleeping || state.feeding) {
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
    if (state.gameActive) {
      state.gameTargetX = event.clientX;
    }
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
  menuToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    if (state.feeding) {
      return;
    }
    if (state.menuOpen) {
      closeActionMenu();
    } else {
      openActionMenu();
    }
  });
  sleepButton.addEventListener("click", (event) => {
    event.stopPropagation();
    startSleep();
  });
  playButton.addEventListener("click", (event) => {
    event.stopPropagation();
    startGame();
  });
  closeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    closeActionMenu();
  });
  shadow.addEventListener("pointerdown", (event) => {
    const path = event.composedPath();
    if (!state.menuOpen) {
      return;
    }
    if (path.includes(actionMenu) || path.includes(menuToggle)) {
      return;
    }
    closeActionMenu();
  });

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
    if (state.gameActive) {
      state.gameTargetX = clamp(state.gameTargetX ?? state.x, 0, window.innerWidth);
    }
  });

  updateMoodStyles();
  updateHud();
  updateActionMenuState();
  renderPosition();
  renderApple();
  updateGameUi();
  scheduleNextAction(performance.now());
  applyPetEnabledState();
  startDecayLoop();
  void loadSettings();
  requestAnimationFrame(animate);
})();
