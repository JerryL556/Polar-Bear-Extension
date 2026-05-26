const DEFAULT_SETTINGS = {
  petEnabled: true,
  chaosOccurrence: 100,
  twitchOccurrence: 100,
  flashOccurrence: 100,
  decayIntervalMs: 900,
  feedingMinCooldownMs: 10000,
  clickGain: 8
};

const SETTINGS_KEY = "petSettings";

const FIELD_FORMATTERS = {
  chaosOccurrence: (value) => `${value}%`,
  twitchOccurrence: (value) => `${value}%`,
  flashOccurrence: (value) => `${value}%`,
  decayIntervalMs: (value) => `${(value / 1000).toFixed(1)}s`,
  feedingMinCooldownMs: (value) => `${Math.round(value / 1000)}s`,
  clickGain: (value) => `${value}`
};

const formFields = {
  petEnabled: document.getElementById("petEnabled"),
  chaosOccurrence: document.getElementById("chaosOccurrence"),
  twitchOccurrence: document.getElementById("twitchOccurrence"),
  flashOccurrence: document.getElementById("flashOccurrence"),
  decayIntervalMs: document.getElementById("decayIntervalMs"),
  feedingMinCooldownMs: document.getElementById("feedingMinCooldownMs"),
  clickGain: document.getElementById("clickGain")
};

const outputFields = {
  chaosOccurrence: document.getElementById("chaosOccurrenceValue"),
  twitchOccurrence: document.getElementById("twitchOccurrenceValue"),
  flashOccurrence: document.getElementById("flashOccurrenceValue"),
  decayIntervalMs: document.getElementById("decayIntervalMsValue"),
  feedingMinCooldownMs: document.getElementById("feedingMinCooldownMsValue"),
  clickGain: document.getElementById("clickGainValue")
};

const updateOutput = (key, value) => {
  const output = outputFields[key];
  if (!output) {
    return;
  }
  output.textContent = FIELD_FORMATTERS[key](Number(value));
};

const readSettings = async () => {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] ?? {}) };
};

const writeSettings = async () => {
  const nextSettings = {
    petEnabled: formFields.petEnabled.checked,
    chaosOccurrence: Number(formFields.chaosOccurrence.value),
    twitchOccurrence: Number(formFields.twitchOccurrence.value),
    flashOccurrence: Number(formFields.flashOccurrence.value),
    decayIntervalMs: Number(formFields.decayIntervalMs.value),
    feedingMinCooldownMs: Number(formFields.feedingMinCooldownMs.value),
    clickGain: Number(formFields.clickGain.value)
  };

  await chrome.storage.sync.set({ [SETTINGS_KEY]: nextSettings });
};

const applySettingsToForm = (settings) => {
  formFields.petEnabled.checked = settings.petEnabled;

  for (const [key, input] of Object.entries(formFields)) {
    if (key === "petEnabled") {
      continue;
    }
    input.value = `${settings[key]}`;
    updateOutput(key, settings[key]);
  }
};

const bindFieldEvents = () => {
  for (const [key, input] of Object.entries(formFields)) {
    input.addEventListener("input", () => {
      if (key !== "petEnabled") {
        updateOutput(key, input.value);
      }
      void writeSettings();
    });

    if (key === "petEnabled") {
      input.addEventListener("change", () => {
        void writeSettings();
      });
    }
  }
};

const init = async () => {
  const settings = await readSettings();
  applySettingsToForm(settings);
  bindFieldEvents();
};

void init();
