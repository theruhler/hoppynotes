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

// --- Occasion calendar ---------------------------------------------------
// Lunar-calendar holidays can't be derived arithmetically, so they use
// verified tables. Past the last entry the app simply skips those two.
const CHINESE_NEW_YEAR = {
  2026: { date: "02-17", animal: "Horse" },
  2027: { date: "02-06", animal: "Goat" },
  2028: { date: "01-26", animal: "Monkey" },
  2029: { date: "02-13", animal: "Rooster" },
  2030: { date: "02-03", animal: "Dog" },
  2031: { date: "01-23", animal: "Pig" },
  2032: { date: "02-11", animal: "Rat" },
  2033: { date: "01-31", animal: "Ox" },
  2034: { date: "02-19", animal: "Tiger" },
  2035: { date: "02-08", animal: "Rabbit" }
};

const PASSOVER_FIRST_DAY = {
  2026: "04-01",
  2027: "04-21",
  2028: "04-10",
  2029: "03-30",
  2030: "04-17",
  2031: "04-07",
  2032: "03-26",
  2033: "04-13",
  2034: "04-03",
  2035: "04-23"
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function dateAt(year, month, day) {
  return new Date(year, month - 1, day);
}

function startOfDay(date) {
  return dateAt(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function monthDayOf(date) {
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function isSameDay(a, b) {
  return a.getTime() === startOfDay(b).getTime();
}

// Anonymous Gregorian computus.
function easterFor(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return dateAt(year, month, day);
}

// nth (1-based) weekday of a month; weekday 0 = Sunday.
function nthWeekday(year, month, weekday, nth) {
  const first = dateAt(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return dateAt(year, month, 1 + offset + (nth - 1) * 7);
}

function lastWeekday(year, month, weekday) {
  const lastDay = new Date(year, month, 0);
  const offset = (lastDay.getDay() - weekday + 7) % 7;
  return dateAt(year, month, lastDay.getDate() - offset);
}

// Accepts "MM-DD" (no year) or "YYYY-MM-DD".
function parseOccasionDate(value) {
  if (typeof value !== "string") {
    return null;
  }
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }
  match = /^(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    return { year: null, month: Number(match[1]), day: Number(match[2]) };
  }
  return null;
}

function formatOccasionDate(parsed) {
  if (!parsed || !parsed.month || !parsed.day) {
    return "";
  }
  const monthDay = `${pad2(parsed.month)}-${pad2(parsed.day)}`;
  return parsed.year ? `${parsed.year}-${monthDay}` : monthDay;
}

function ordinal(value) {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) {
    return `${value}th`;
  }
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function personalOccasion(id, value, monthDay, year) {
  const parsed = parseOccasionDate(value);
  if (!parsed || `${pad2(parsed.month)}-${pad2(parsed.day)}` !== monthDay) {
    return null;
  }
  const years = parsed.year && year > parsed.year ? year - parsed.year : null;
  return { id, years };
}

// Personal dates outrank holidays; the first match wins.
function detectOccasion(now) {
  const today = startOfDay(now);
  const year = today.getFullYear();
  const monthDay = monthDayOf(today);

  const birthday = personalOccasion("birthday", personalization.birthday, monthDay, year);
  if (birthday) {
    return birthday;
  }
  const anniversary = personalOccasion("anniversary", personalization.anniversary, monthDay, year);
  if (anniversary) {
    return anniversary;
  }

  if (settings.faithHolidays) {
    const easter = easterFor(year);
    if (isSameDay(easter, today)) {
      return { id: "easter" };
    }
    if (isSameDay(addDays(easter, -2), today)) {
      return { id: "goodFriday" };
    }
    if (monthDay === "12-25") {
      return { id: "christmas" };
    }
    if (monthDay === "12-24") {
      return { id: "christmasEve" };
    }
    if (PASSOVER_FIRST_DAY[year] === monthDay) {
      return { id: "passover" };
    }
  }

  if (settings.funHolidays) {
    if (monthDay === "01-01") {
      return { id: "newYear" };
    }
    if (monthDay === "12-31") {
      return { id: "newYearEve" };
    }
    const lunar = CHINESE_NEW_YEAR[year];
    if (lunar && lunar.date === monthDay) {
      return {
        id: lunar.animal === "Rabbit" ? "chineseNewYearRabbit" : "chineseNewYear",
        animal: lunar.animal
      };
    }
    if (monthDay === "02-14") {
      return { id: "valentines" };
    }
    if (monthDay === "03-17") {
      return { id: "stPatricks" };
    }
    if (isSameDay(nthWeekday(year, 5, 0, 2), today)) {
      return { id: "mothersDay" };
    }
    if (isSameDay(lastWeekday(year, 5, 1), today)) {
      return { id: "memorialDay" };
    }
    if (isSameDay(nthWeekday(year, 6, 0, 3), today)) {
      return { id: "fathersDay" };
    }
    if (monthDay === "07-04") {
      return { id: "julyFourth" };
    }
    if (isSameDay(nthWeekday(year, 9, 1, 1), today)) {
      return { id: "laborDay" };
    }
    if (monthDay === "10-31") {
      return { id: "halloween" };
    }
    if (isSameDay(nthWeekday(year, 11, 4, 4), today)) {
      return { id: "thanksgiving" };
    }
  }

  // Lent is a season, not a day, so it only applies when nothing more
  // specific landed today — otherwise it would swallow every holiday inside
  // it, including St. Patrick's Day, which falls in Lent every year.
  if (settings.faithHolidays) {
    const easter = easterFor(year);
    if (today >= addDays(easter, -46) && today < easter) {
      return { id: "lent" };
    }
  }

  return null;
}

const PAYWALL = {
  // Stripe Payment Link URL from the Stripe Dashboard (see README).
  // Its after-payment redirect must be: https://theruhler.github.io/hoppynotes/?session_id={CHECKOUT_SESSION_ID}
  paymentLinkUrl: "",
  // Deployed verification Worker (MadMooze Mfg Cloudflare account).
  verifyEndpoint: "https://hoppynotes-verify.madmoozemfg.workers.dev"
};

const SETTINGS_KEY = "hoppynotes-settings-v1";
const PERSONALIZATION_KEY = "hoppynotes-personalization-v1";
const UNLOCK_STORAGE_KEY = "hoppynotes-unlocked-v1";
const MESSAGES_CACHE_KEY = "hoppynotes-messages-v1";
const OCCASIONS_CACHE_KEY = "hoppynotes-occasions-v1";
const SHARE_TOKEN_KEY = "hoppynotes-share-token-v1";
const ADMIN_CODE_KEY = "hoppynotes-admin-code-v1";

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
const occasionBanner = document.getElementById("occasionBanner");
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
const birthdayMonth = document.getElementById("birthdayMonth");
const birthdayDay = document.getElementById("birthdayDay");
const birthdayYear = document.getElementById("birthdayYear");
const anniversaryMonth = document.getElementById("anniversaryMonth");
const anniversaryDay = document.getElementById("anniversaryDay");
const anniversaryYear = document.getElementById("anniversaryYear");
const faithHolidayToggle = document.getElementById("faithHolidayToggle");
const funHolidayToggle = document.getElementById("funHolidayToggle");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");

let library = TEASER_MESSAGES;
let messages = library;
let occasionContent = null;
let activeOccasion = null;
let index = Math.floor(Math.random() * messages.length);
let deferredPrompt = null;

const personalization = {
  recipient: "",
  sender: "",
  birthday: "",
  anniversary: ""
};

const settings = {
  fontSize: 18,
  showSignature: true,
  theme: "rose",
  bunnyColor: "#d9a5ff",
  bunnyColorEnabled: false,
  faithHolidays: true,
  funHolidays: true
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
    if (typeof parsed.faithHolidays === "boolean") {
      settings.faithHolidays = parsed.faithHolidays;
    }
    if (typeof parsed.funHolidays === "boolean") {
      settings.funHolidays = parsed.funHolidays;
    }
  } catch {
    // Keep defaults when storage is unavailable.
  }
}

function savePersonalization() {
  try {
    localStorage.setItem(PERSONALIZATION_KEY, JSON.stringify(personalization));
  } catch {
    // Storage unavailable — the dates still apply to this page load.
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Today's occasion decides the rotation: themed notes come first, then the
// rest of the library. Called on load, on settings save, and on unlock.
function refreshOccasion() {
  activeOccasion = detectOccasion(new Date());
  const set = activeOccasion && occasionContent ? occasionContent[activeOccasion.id] : null;
  const themed = set && Array.isArray(set.notes) ? set.notes : [];
  messages = themed.length ? themed.concat(library) : library;
  index = themed.length ? 0 : Math.floor(Math.random() * messages.length);
}

function cacheMessages(list) {
  try {
    localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable — the library still works for this page load.
  }
}

function cacheOccasions(content) {
  try {
    localStorage.setItem(OCCASIONS_CACHE_KEY, JSON.stringify(content));
  } catch {
    // Storage unavailable — greetings still work for this page load.
  }
}

function hydrateMessagesFromCache() {
  let found = false;
  try {
    const parsed = JSON.parse(localStorage.getItem(MESSAGES_CACHE_KEY) || "null");
    if (Array.isArray(parsed) && parsed.length) {
      library = parsed;
      found = true;
    }
  } catch {
    // Fall through to teasers.
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(OCCASIONS_CACHE_KEY) || "null");
    if (parsed && typeof parsed === "object") {
      occasionContent = parsed;
    }
  } catch {
    // Greetings stay hidden until the next successful fetch.
  }
  refreshOccasion();
  return found;
}

// Stores whatever gated content a Worker response carried.
function absorbContent(data) {
  if (Array.isArray(data.messages) && data.messages.length) {
    cacheMessages(data.messages);
    library = data.messages;
  }
  if (data.occasions && typeof data.occasions === "object") {
    cacheOccasions(data.occasions);
    occasionContent = data.occasions;
  }
  refreshOccasion();
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
      absorbContent(data);
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
      absorbContent(data);
      return true;
    }
  } catch {
    // Offline — teasers remain.
  }
  return false;
}

// Owner/tester unlock: the Worker checks the code against its ADMIN_CODES
// secret, so nothing in the public app can be edited to fake it.
async function applyAdminCode(code) {
  if (!PAYWALL.verifyEndpoint || !code) {
    return false;
  }
  try {
    const resp = await fetch(`${PAYWALL.verifyEndpoint}?admin=${encodeURIComponent(code)}`);
    const data = await resp.json();
    if (data.unlocked === true) {
      try {
        localStorage.setItem(UNLOCK_STORAGE_KEY, `admin:${data.label || "tester"}`);
        localStorage.setItem(ADMIN_CODE_KEY, code);
        if (typeof data.shareToken === "string" && data.shareToken) {
          localStorage.setItem(SHARE_TOKEN_KEY, data.shareToken);
        }
      } catch {
        // Storage unavailable — the unlock still applies to this page load.
      }
      absorbContent(data);
      return true;
    }
  } catch {
    // Offline or rejected — the paywall stays up.
  }
  return false;
}

// Reads ?admin=CODE, then strips it so the code isn't left in the address
// bar, history, or a screenshot.
async function consumeAdminCode() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("admin");
  if (!code) {
    return false;
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("admin");
  history.replaceState(null, "", url.pathname + url.search + url.hash);
  if (!PAYWALL.verifyEndpoint) {
    showPaywallScreen();
    setPaywallStatus("Tester unlock isn't set up yet. Deploy the Worker and add its URL in app.js.", true);
    return false;
  }
  const ok = await applyAdminCode(code);
  if (!ok) {
    showPaywallScreen();
    setPaywallStatus("That tester code wasn't recognized. Check the code, or deploy the Worker's ADMIN_CODES secret.", true);
  }
  return ok;
}

function storedAdminCode() {
  try {
    return localStorage.getItem(ADMIN_CODE_KEY) || "";
  } catch {
    return "";
  }
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
    birthday: formatOccasionDate(parseOccasionDate(params.get("bd") || "")),
    anniversary: formatOccasionDate(parseOccasionDate(params.get("an") || "")),
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
  if (personalization.birthday) {
    url.searchParams.set("bd", personalization.birthday);
  }
  if (personalization.anniversary) {
    url.searchParams.set("an", personalization.anniversary);
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

function addOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

function populateDateSelects(monthSelect, daySelect) {
  addOption(monthSelect, "", "Month");
  MONTH_NAMES.forEach((name, i) => addOption(monthSelect, String(i + 1), name));
  addOption(daySelect, "", "Day");
  for (let day = 1; day <= 31; day++) {
    addOption(daySelect, String(day), String(day));
  }
}

function writeDateFields(value, monthSelect, daySelect, yearInput) {
  const parsed = parseOccasionDate(value);
  monthSelect.value = parsed ? String(parsed.month) : "";
  daySelect.value = parsed ? String(parsed.day) : "";
  yearInput.value = parsed && parsed.year ? String(parsed.year) : "";
}

function readDateFields(monthSelect, daySelect, yearInput) {
  const month = Number(monthSelect.value);
  const day = Number(daySelect.value);
  if (!month || !day) {
    return "";
  }
  const year = Number(yearInput.value);
  const validYear = Number.isInteger(year) && year >= 1900 && year <= 2200 ? year : null;
  return formatOccasionDate({ month, day, year: validYear });
}

function applySettingsToUI() {
  document.documentElement.style.setProperty("--message-font-size", `${settings.fontSize}px`);
  applyTheme(settings.theme);
  fontSizeInput.value = String(settings.fontSize);
  signatureToggle.checked = settings.showSignature;
  themeSelect.value = settings.theme;
  bunnyColorInput.value = settings.bunnyColor;
  bunnyColorToggle.checked = settings.bunnyColorEnabled;
  faithHolidayToggle.checked = settings.faithHolidays;
  funHolidayToggle.checked = settings.funHolidays;
  writeDateFields(personalization.birthday, birthdayMonth, birthdayDay, birthdayYear);
  writeDateFields(personalization.anniversary, anniversaryMonth, anniversaryDay, anniversaryYear);
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

// Banner tokens differ from note tokens: no trailing period, and the name is
// dropped along with its comma when there isn't one.
function fillBannerTokens(template) {
  let text = template;
  if (activeOccasion && activeOccasion.animal) {
    text = text.replace(/\{animal\}/g, activeOccasion.animal);
  }
  if (activeOccasion && activeOccasion.years) {
    text = text
      .replace(/\{ordinal\}/g, ordinal(activeOccasion.years))
      .replace(/\{years\}/g, String(activeOccasion.years));
  }
  return personalization.recipient
    ? text.replace(/\{name\}/g, personalization.recipient)
    : text.replace(/,?\s*\{name\}/g, "");
}

function renderBanner() {
  const set = activeOccasion && occasionContent ? occasionContent[activeOccasion.id] : null;
  const lines =
    set && activeOccasion.years && Array.isArray(set.bannerWithYears) && set.bannerWithYears.length
      ? set.bannerWithYears
      : set && Array.isArray(set.banner)
        ? set.banner
        : [];
  if (!lines.length) {
    occasionBanner.textContent = "";
    occasionBanner.classList.add("hidden");
    return;
  }
  occasionBanner.textContent = fillBannerTokens(lines[index % lines.length]);
  occasionBanner.classList.remove("hidden");
}

function renderMessage() {
  const withName = personalizeTemplate(messages[index], personalization.recipient);
  const signature = settings.showSignature && personalization.sender ? ` - ${personalization.sender}` : "";
  messageText.textContent = `${withName}${signature}`;
  renderBanner();
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
    library === TEASER_MESSAGES
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
      absorbContent(data);
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
  refreshOccasion();
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
  settings.faithHolidays = faithHolidayToggle.checked;
  settings.funHolidays = funHolidayToggle.checked;
  personalization.birthday = readDateFields(birthdayMonth, birthdayDay, birthdayYear);
  personalization.anniversary = readDateFields(anniversaryMonth, anniversaryDay, anniversaryYear);
  saveSettings();
  savePersonalization();
  refreshOccasion();
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

function loadStoredPersonalization() {
  try {
    return JSON.parse(localStorage.getItem(PERSONALIZATION_KEY) || "{}");
  } catch {
    return {};
  }
}

loadSettings();
populateDateSelects(birthdayMonth, birthdayDay);
populateDateSelects(anniversaryMonth, anniversaryDay);

(async () => {
  const justUnlocked = (await consumeCheckoutSession()) || (await consumeAdminCode());
  const fromUrl = readUrlPersonalization();
  const stored = loadStoredPersonalization();

  // Dates the buyer set travel in the link; otherwise keep this device's own.
  personalization.birthday = (fromUrl && fromUrl.birthday) || stored.birthday || "";
  personalization.anniversary = (fromUrl && fromUrl.anniversary) || stored.anniversary || "";

  if (justUnlocked) {
    savePersonalization();
    showCreatorScreen();
  } else if (fromUrl) {
    personalization.recipient = fromUrl.recipient;
    personalization.sender = fromUrl.sender;
    savePersonalization();
    if (!hydrateMessagesFromCache()) {
      await fetchMessagesWithShareToken(fromUrl.shareToken);
    }
    refreshOccasion();
    showNoteScreen();
  } else {
    if (stored.recipient && stored.sender) {
      personalization.recipient = stored.recipient;
      personalization.sender = stored.sender;
    }
    if (!hydrateMessagesFromCache() && isUnlocked()) {
      try {
        const adminCode = storedAdminCode();
        if (adminCode) {
          await applyAdminCode(adminCode);
        } else {
          await refreshMessagesWithSession(localStorage.getItem(UNLOCK_STORAGE_KEY));
        }
      } catch {
        // Teasers remain until the tester or buyer is back online.
      }
    }
    refreshOccasion();
    if (personalization.recipient && personalization.sender) {
      showNoteScreen();
    } else {
      openCreator();
    }
  }
})();
