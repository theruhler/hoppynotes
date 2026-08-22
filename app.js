// Free sample notes shown when the paid library has not been loaded.
// The full 225-message library lives in worker/messages.js, served only
// to verified buyers and valid share links.
const TEASER_MESSAGES = [
  "{name}, you make every ordinary day feel like an adventure.",
  "You are my favorite notification.",
  "Whatever today throws at you, {name}, it has no idea who it is dealing with.",
  "Thank you for being the person I never have to pretend around.",
  "Still choosing you. Scheduled to repeat daily, forever."
];

const BUNNY_IMAGES = [
  "bunny1.png",
  "assets/bunny2.png",
  "assets/bunny3.png",
  "assets/bunny4.png",
  "assets/bunny5.png"
];

const THEME_MAP = {
  sunset: { bg1: "#fff7e7", bg2: "#ffe8ee", accent: "#ff8a5c", ink: "#3b2f2f" },
  mint: { bg1: "#ebfff8", bg2: "#ddf4ff", accent: "#2ea789", ink: "#1f3932" },
  sky: { bg1: "#ecf4ff", bg2: "#dff0ff", accent: "#377dff", ink: "#22324d" },
  rose: { bg1: "#fff0f5", bg2: "#ffe3ea", accent: "#d85f86", ink: "#4f2a35" }
};

const PAYWALL = {
  // Stripe Payment Link URL from the Stripe Dashboard (see README).
  // Its after-payment redirect must be: https://theruhler.github.io/hoppynotes/?session_id={CHECKOUT_SESSION_ID}
  paymentLinkUrl: "",
  // URL of the deployed verification Worker (see worker/ and README),
  // e.g. "https://hoppynotes-verify.YOUR-SUBDOMAIN.workers.dev"
  verifyEndpoint: ""
};

const SETTINGS_KEY = "hoppynotes-settings-v1";
const PERSONALIZATION_KEY = "hoppynotes-personalization-v1";
const UNLOCK_STORAGE_KEY = "hoppynotes-unlocked-v1";
const MESSAGES_CACHE_KEY = "hoppynotes-messages-v1";
const SHARE_TOKEN_KEY = "hoppynotes-share-token-v1";

const paywallScreen = document.getElementById("paywallScreen");
const unlockBtn = document.getElementById("unlockBtn");
const paywallStatus = document.getElementById("paywallStatus");
const creatorScreen = document.getElementById("creatorScreen");
const noteScreen = document.getElementById("noteScreen");
const creatorRecipientInput = document.getElementById("creatorRecipientInput");
const creatorSenderInput = document.getElementById("creatorSenderInput");
const generateLinkBtn = document.getElementById("generateLinkBtn");
const generatedLinkArea = document.getElementById("generatedLinkArea");
const generatedLinkOutput = document.getElementById("generatedLinkOutput");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const shareGeneratedBtn = document.getElementById("shareGeneratedBtn");
const previewLinkBtn = document.getElementById("previewLinkBtn");
const makeMyOwnBtn = document.getElementById("makeMyOwnBtn");

const messageText = document.getElementById("messageText");
const noteHint = document.getElementById("noteHint");
const bunnyImage = document.getElementById("bunnyImage");
const bunnyTint = document.getElementById("bunnyTint");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const shuffleBunnyBtn = document.getElementById("shuffleBunnyBtn");
const installBtn = document.getElementById("installBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const fontSizeInput = document.getElementById("fontSizeInput");
const signatureToggle = document.getElementById("signatureToggle");
const signatureToggleLabel = document.getElementById("signatureToggleLabel");
const themeSelect = document.getElementById("themeSelect");
const bunnyColorInput = document.getElementById("bunnyColorInput");
const bunnyColorToggle = document.getElementById("bunnyColorToggle");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");

let messages = TEASER_MESSAGES;
let index = Math.floor(Math.random() * messages.length);
let deferredPrompt = null;

const personalization = {
  recipient: "",
  sender: ""
};

const settings = {
  fontSize: 18,
  showSignature: true,
  theme: "rose",
  bunnyColor: "#d9a5ff",
  bunnyColorEnabled: false
};

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if (Number.isFinite(parsed.fontSize)) {
      settings.fontSize = Math.min(30, Math.max(14, Number(parsed.fontSize)));
    }
    if (typeof parsed.showSignature === "boolean") {
      settings.showSignature = parsed.showSignature;
    }
    if (typeof parsed.theme === "string" && THEME_MAP[parsed.theme]) {
      settings.theme = parsed.theme;
    }
    if (typeof parsed.bunnyColor === "string" && /^#[0-9a-fA-F]{6}$/.test(parsed.bunnyColor)) {
      settings.bunnyColor = parsed.bunnyColor;
    }
    if (typeof parsed.bunnyColorEnabled === "boolean") {
      settings.bunnyColorEnabled = parsed.bunnyColorEnabled;
    }
  } catch {
    // Keep defaults when storage is unavailable.
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function setMessages(list) {
  if (Array.isArray(list) && list.length) {
    messages = list;
    index = Math.floor(Math.random() * messages.length);
  }
}

function cacheMessages(list) {
  try {
    localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable — the library still works for this page load.
  }
}

function hydrateMessagesFromCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MESSAGES_CACHE_KEY) || "null");
    if (Array.isArray(parsed) && parsed.length) {
      setMessages(parsed);
      return true;
    }
  } catch {
    // Fall through to teasers.
  }
  return false;
}

// Recipients load the library with the opaque share token from their link.
async function fetchMessagesWithShareToken(token) {
  if (!PAYWALL.verifyEndpoint || !token) {
    return false;
  }
  try {
    const resp = await fetch(`${PAYWALL.verifyEndpoint}?share=${encodeURIComponent(token)}`);
    const data = await resp.json();
    if (Array.isArray(data.messages) && data.messages.length) {
      cacheMessages(data.messages);
      setMessages(data.messages);
      return true;
    }
  } catch {
    // Offline or bad token — teasers remain.
  }
  return false;
}

// Buyers whose message cache was cleared re-fetch with their stored session.
async function refreshMessagesWithSession(sessionId) {
  if (!PAYWALL.verifyEndpoint || !sessionId) {
    return false;
  }
  try {
    const resp = await fetch(`${PAYWALL.verifyEndpoint}?session_id=${encodeURIComponent(sessionId)}`);
    const data = await resp.json();
    if (data.unlocked === true && Array.isArray(data.messages) && data.messages.length) {
      if (typeof data.shareToken === "string" && data.shareToken) {
        try {
          localStorage.setItem(SHARE_TOKEN_KEY, data.shareToken);
        } catch {
          // Ignore.
        }
      }
      cacheMessages(data.messages);
      setMessages(data.messages);
      return true;
    }
  } catch {
    // Offline — teasers remain.
  }
  return false;
}

function readUrlPersonalization() {
  const params = new URLSearchParams(window.location.search);
  const to = params.get("to");
  const from = params.get("from");
  if (!to && !from) {
    return null;
  }
  return {
    recipient: (to || "").slice(0, 40),
    sender: (from || "").slice(0, 40),
    shareToken: params.get("st") || ""
  };
}

function buildShareUrl(recipient, sender) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("to", recipient);
  url.searchParams.set("from", sender);
  let shareToken = "";
  try {
    shareToken = localStorage.getItem(SHARE_TOKEN_KEY) || "";
  } catch {
    // Links still work without a token; the recipient just sees samples.
  }
  if (shareToken) {
    url.searchParams.set("st", shareToken);
  }
  return url.toString();
}

function applyTheme(themeName) {
  const theme = THEME_MAP[themeName] || THEME_MAP.rose;
  const root = document.documentElement;
  root.style.setProperty("--bg-1", theme.bg1);
  root.style.setProperty("--bg-2", theme.bg2);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--ink", theme.ink);
}

function applyBunnyTint() {
  bunnyTint.style.setProperty("--bunny-color", settings.bunnyColor);
  bunnyTint.style.setProperty("--bunny-mask-image", `url("${bunnyImage.getAttribute("src")}")`);
  bunnyTint.classList.toggle("active", settings.bunnyColorEnabled);
}

function applySettingsToUI() {
  document.documentElement.style.setProperty("--message-font-size", `${settings.fontSize}px`);
  applyTheme(settings.theme);
  fontSizeInput.value = String(settings.fontSize);
  signatureToggle.checked = settings.showSignature;
  themeSelect.value = settings.theme;
  bunnyColorInput.value = settings.bunnyColor;
  bunnyColorToggle.checked = settings.bunnyColorEnabled;
  signatureToggleLabel.textContent = `Show signature (- ${personalization.sender || "your name"})`;
  applyBunnyTint();
}

// Fills {name} placeholders, or removes them gracefully when no name was supplied.
function personalizeTemplate(template, name) {
  if (name) {
    return template.replace(/\{name\}, /g, `${name}, `).replace(/, \{name\}/g, `, ${name}`).replace(/\{name\}/g, name);
  }
  return template
    .replace(/\{name\}, /g, "")
    .replace(/, \{name\}, /g, ", ")
    .replace(/, \{name\}/g, "")
    .replace(/\{name\}/g, "you")
    .replace(/^./, (c) => c.toUpperCase());
}

function renderMessage() {
  const withName = personalizeTemplate(messages[index], personalization.recipient);
  const signature = settings.showSignature && personalization.sender ? ` - ${personalization.sender}` : "";
  messageText.textContent = `${withName}${signature}`;
}

function nextMessage() {
  index = (index + 1) % messages.length;
  renderMessage();
}

function prevMessage() {
  index = (index - 1 + messages.length) % messages.length;
  renderMessage();
}

function randomBunny() {
  const current = bunnyImage.getAttribute("src");
  const options = BUNNY_IMAGES.filter((src) => src !== current);
  const next = options[Math.floor(Math.random() * options.length)] || BUNNY_IMAGES[0];
  bunnyImage.setAttribute("src", next);
  applyBunnyTint();
}

function showNoteScreen() {
  creatorScreen.classList.add("hidden");
  paywallScreen.classList.add("hidden");
  noteScreen.classList.remove("hidden");
  noteHint.textContent =
    messages === TEASER_MESSAGES
      ? "Only a few sample notes are loaded. Open your note link while online to see them all."
      : "Tip: Tap the bunny for a fresh note. Swipe left/right to browse.";
  applySettingsToUI();
  renderMessage();
  randomBunny();
}

function showCreatorScreen() {
  noteScreen.classList.add("hidden");
  paywallScreen.classList.add("hidden");
  creatorScreen.classList.remove("hidden");
  generatedLinkArea.classList.add("hidden");
}

function showPaywallScreen() {
  noteScreen.classList.add("hidden");
  creatorScreen.classList.add("hidden");
  paywallScreen.classList.remove("hidden");
}

function isUnlocked() {
  try {
    return Boolean(localStorage.getItem(UNLOCK_STORAGE_KEY));
  } catch {
    return false;
  }
}

function setPaywallStatus(text, isError) {
  paywallStatus.textContent = text;
  paywallStatus.classList.toggle("error", Boolean(isError));
  paywallStatus.classList.toggle("hidden", !text);
}

function openCreator() {
  if (isUnlocked()) {
    showCreatorScreen();
  } else {
    showPaywallScreen();
  }
}

// Handles the ?session_id= param from the Stripe Payment Link's after-payment
// redirect: asks the verification Worker whether the checkout session was
// actually paid, stores the unlock on success, always strips it from the URL.
async function consumeCheckoutSession() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");
  if (!sessionId) {
    return false;
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("session_id");
  history.replaceState(null, "", url.pathname + url.search + url.hash);
  if (!PAYWALL.verifyEndpoint) {
    showPaywallScreen();
    setPaywallStatus("Payment verification isn't set up yet. Deploy the Worker and add its URL in app.js.", true);
    return false;
  }
  showPaywallScreen();
  setPaywallStatus("Confirming your payment…", false);
  try {
    const resp = await fetch(`${PAYWALL.verifyEndpoint}?session_id=${encodeURIComponent(sessionId)}`);
    const data = await resp.json();
    if (data.unlocked === true) {
      try {
        localStorage.setItem(UNLOCK_STORAGE_KEY, sessionId);
        if (typeof data.shareToken === "string" && data.shareToken) {
          localStorage.setItem(SHARE_TOKEN_KEY, data.shareToken);
        }
      } catch {
        // Storage unavailable — the unlock still applies to this page load.
      }
      if (Array.isArray(data.messages) && data.messages.length) {
        cacheMessages(data.messages);
        setMessages(data.messages);
      }
      setPaywallStatus("", false);
      return true;
    }
    setPaywallStatus("We couldn't confirm this payment. If you just paid, wait a moment and open the link from your receipt again.", true);
    return false;
  } catch {
    setPaywallStatus("Couldn't reach the payment checker. Check your connection and open your receipt link again.", true);
    return false;
  }
}

function openSettings() {
  settingsModal.classList.remove("hidden");
  settingsModal.setAttribute("aria-hidden", "false");
}

function closeSettings() {
  settingsModal.classList.add("hidden");
  settingsModal.setAttribute("aria-hidden", "true");
}

generateLinkBtn.addEventListener("click", () => {
  const recipient = creatorRecipientInput.value.trim().slice(0, 40);
  const sender = creatorSenderInput.value.trim().slice(0, 40);
  if (!recipient || !sender) {
    return;
  }
  const shareUrl = buildShareUrl(recipient, sender);
  generatedLinkOutput.value = shareUrl;
  generatedLinkArea.classList.remove("hidden");
  generatedLinkArea.dataset.recipient = recipient;
  generatedLinkArea.dataset.sender = sender;
});

copyLinkBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(generatedLinkOutput.value);
  } catch {
    generatedLinkOutput.select();
  }
});

shareGeneratedBtn.addEventListener("click", async () => {
  const recipient = generatedLinkArea.dataset.recipient || "";
  if (navigator.share) {
    try {
      await navigator.share({
        title: "HoppyNotes",
        text: `A personalized note for ${recipient}`,
        url: generatedLinkOutput.value
      });
      return;
    } catch {
      // Ignore cancellation and fall back to clipboard copy above.
    }
  }
  try {
    await navigator.clipboard.writeText(generatedLinkOutput.value);
  } catch {
    generatedLinkOutput.select();
  }
});

previewLinkBtn.addEventListener("click", () => {
  personalization.recipient = generatedLinkArea.dataset.recipient || "";
  personalization.sender = generatedLinkArea.dataset.sender || "";
  showNoteScreen();
});

makeMyOwnBtn.addEventListener("click", () => {
  openCreator();
});

unlockBtn.addEventListener("click", () => {
  if (!PAYWALL.paymentLinkUrl) {
    setPaywallStatus("Checkout isn't set up yet. Add your Stripe Payment Link URL in app.js.", true);
    return;
  }
  window.location.href = PAYWALL.paymentLinkUrl;
});

nextBtn.addEventListener("click", nextMessage);
prevBtn.addEventListener("click", prevMessage);
shuffleBunnyBtn.addEventListener("click", randomBunny);
bunnyImage.addEventListener("click", nextMessage);
messageText.addEventListener("click", nextMessage);
settingsBtn.addEventListener("click", openSettings);
closeSettingsBtn.addEventListener("click", closeSettings);

saveSettingsBtn.addEventListener("click", () => {
  settings.fontSize = Number(fontSizeInput.value);
  settings.showSignature = signatureToggle.checked;
  settings.theme = themeSelect.value;
  settings.bunnyColor = bunnyColorInput.value;
  settings.bunnyColorEnabled = bunnyColorToggle.checked;
  saveSettings();
  applySettingsToUI();
  renderMessage();
  closeSettings();
});

let startX = 0;
window.addEventListener(
  "touchstart",
  (event) => {
    startX = event.changedTouches[0].clientX;
  },
  { passive: true }
);

window.addEventListener(
  "touchend",
  (event) => {
    if (noteScreen.classList.contains("hidden")) {
      return;
    }
    const endX = event.changedTouches[0].clientX;
    const delta = endX - startX;
    if (Math.abs(delta) < 40) {
      return;
    }
    if (delta < 0) {
      nextMessage();
    } else {
      prevMessage();
    }
  },
  { passive: true }
);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) {
    return;
  }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {
    // Ignore registration failures to keep the app usable.
  });
}

loadSettings();

(async () => {
  const justUnlocked = await consumeCheckoutSession();
  const fromUrl = readUrlPersonalization();
  if (justUnlocked) {
    showCreatorScreen();
  } else if (fromUrl) {
    personalization.recipient = fromUrl.recipient;
    personalization.sender = fromUrl.sender;
    localStorage.setItem(PERSONALIZATION_KEY, JSON.stringify(personalization));
    if (!hydrateMessagesFromCache()) {
      await fetchMessagesWithShareToken(fromUrl.shareToken);
    }
    showNoteScreen();
  } else {
    if (!hydrateMessagesFromCache() && isUnlocked()) {
      try {
        await refreshMessagesWithSession(localStorage.getItem(UNLOCK_STORAGE_KEY));
      } catch {
        // Teasers remain until the buyer is back online.
      }
    }
    try {
      const stored = JSON.parse(localStorage.getItem(PERSONALIZATION_KEY) || "{}");
      if (stored.recipient && stored.sender) {
        personalization.recipient = stored.recipient;
        personalization.sender = stored.sender;
        showNoteScreen();
      } else {
        openCreator();
      }
    } catch {
      openCreator();
    }
  }
})();
