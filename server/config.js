/**
 * Reji Fashions - Runtime configuration.
 *
 * Everything a shop owner realistically needs to change lives in data/config.json.
 * That file is created from DEFAULTS on first boot and can be edited from the
 * Admin Dashboard > Settings tab (no server restart needed).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// DATA_DIR is overridable so a hosted deployment can point it at a mounted
// persistent disk. Without that, most platforms wipe the filesystem on every
// restart and every order placed since the last deploy disappears.
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..", "data");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

function sha256(text) {
  return crypto.createHash("sha256").update(String(text)).digest("hex");
}

const DEFAULTS = {
  merchant: {
    name: "Reji Fashions",
    legalName: "Reji Fashions",
    gstin: "29AAAFR1234F1Z8",
    // ---------------------------------------------------------------
    // IMPORTANT: replace upiVpa with the shop's real UPI ID before
    // taking live orders. Anything scanned will pay THIS address.
    // Check it in your UPI app: Profile > UPI IDs.
    // ---------------------------------------------------------------
    upiVpa: "9074666413@upi",
    upiPayeeName: "Reji Fashions",
    whatsappNumber: "919074666413", // country code + number, digits only
    supportPhone: "+91 90746 66413",
    address: "Indiranagar, Bengaluru & Marine Drive, Kochi"
  },

  admin: {
    username: "admin",
    // default password: reji@admin  (change it from Settings immediately)
    passwordHash: sha256("reji@admin")
  },

  storage: {
    // "local"  -> write uploads to disk. Right for a VPS, a mounted volume, or
    //             running on your own machine.
    // "github" -> commit uploads into the repository and serve them from
    //             raw.githubusercontent.com. Free and permanent on hosts with
    //             no persistent disk, such as Render's free plan.
    provider: "local",
    github: {
      repository: "", // "owner/repo"
      branch: "main",
      token: "" // set GITHUB_TOKEN in the environment instead of storing it here
    }
  },

  whatsapp: {
    // "link"      -> no automatic send; the dashboard + customer screen show a
    //                one-tap wa.me link with the full order pre-typed. Zero setup.
    // "callmebot" -> free automatic push to the owner's own WhatsApp.
    //                Setup: message "I allow callmebot to send me messages" to
    //                +34 644 51 95 23, it replies with an apikey. Paste below.
    // "cloud"     -> official Meta WhatsApp Cloud API (business verified).
    // "twilio"    -> Twilio WhatsApp sender.
    provider: "link",
    callmebot: { apiKey: "" },
    cloud: { phoneNumberId: "", accessToken: "" },
    twilio: { accountSid: "", authToken: "", from: "whatsapp:+14155238886" }
  },

  store: {
    freeShippingThreshold: 1999,
    codEnabled: true,
    codExtraFee: 0,
    // Orders above this need a prepaid UPI payment (COD hidden).
    codMaxOrderValue: 8000,
    currency: "INR",
    // Minutes a customer has to complete the UPI payment before the QR expires.
    upiWindowMinutes: 15,
    // Which design fronts the homepage. null = pick automatically.
    heroProductId: null
  }
};

function deepMerge(base, override) {
  if (override === null || typeof override !== "object" || Array.isArray(override)) {
    return override === undefined ? base : override;
  }
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(override)) {
    out[key] = key in out ? deepMerge(out[key], override[key]) : override[key];
  }
  return out;
}

/**
 * Environment overrides, applied on top of data/config.json.
 *
 * A hosted deployment must never keep credentials in the repo, so anything
 * sensitive can be supplied as an env var instead. Env always wins, and these
 * values are deliberately not written back to disk.
 */
function envOverrides() {
  const patch = {};
  const set = (path, value) => {
    if (value === undefined || value === "") return;
    let node = patch;
    const keys = path.split(".");
    keys.slice(0, -1).forEach(k => (node = node[k] = node[k] || {}));
    node[keys[keys.length - 1]] = value;
  };

  set("merchant.upiVpa", process.env.UPI_VPA);
  set("merchant.upiPayeeName", process.env.UPI_PAYEE_NAME);
  set("merchant.whatsappNumber", process.env.WHATSAPP_NUMBER);
  set("merchant.name", process.env.MERCHANT_NAME);
  set("merchant.gstin", process.env.MERCHANT_GSTIN);

  set("admin.username", process.env.ADMIN_USERNAME);
  if (process.env.ADMIN_PASSWORD) set("admin.passwordHash", sha256(process.env.ADMIN_PASSWORD));

  set("storage.provider", process.env.STORAGE_PROVIDER);
  set("storage.github.repository", process.env.GITHUB_REPOSITORY);
  set("storage.github.branch", process.env.GITHUB_BRANCH);
  set("storage.github.token", process.env.GITHUB_TOKEN);

  set("whatsapp.provider", process.env.WHATSAPP_PROVIDER);
  set("whatsapp.callmebot.apiKey", process.env.CALLMEBOT_API_KEY);
  set("whatsapp.cloud.phoneNumberId", process.env.WHATSAPP_CLOUD_PHONE_ID);
  set("whatsapp.cloud.accessToken", process.env.WHATSAPP_CLOUD_TOKEN);
  set("whatsapp.twilio.accountSid", process.env.TWILIO_ACCOUNT_SID);
  set("whatsapp.twilio.authToken", process.env.TWILIO_AUTH_TOKEN);
  set("whatsapp.twilio.from", process.env.TWILIO_WHATSAPP_FROM);

  return patch;
}

let cached = null;

function load() {
  if (cached) return cached;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  let onDisk = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      onDisk = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch (e) {
      console.warn("[config] config.json unreadable, using defaults:", e.message);
    }
  }
  if (!fs.existsSync(CONFIG_PATH)) save(deepMerge(DEFAULTS, onDisk));
  cached = deepMerge(deepMerge(DEFAULTS, onDisk), envOverrides());
  return cached;
}

/** True while the admin account still uses the documented default password. */
function usingDefaultPassword() {
  return load().admin.passwordHash === sha256("reji@admin");
}

/** True when the UPI ID is still the shipped placeholder. */
function usingPlaceholderVpa() {
  return load().merchant.upiVpa === DEFAULTS.merchant.upiVpa;
}

function save(next) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), "utf8");
  // Env vars outrank anything written from the dashboard, so re-apply them.
  cached = deepMerge(next, envOverrides());
  return cached;
}

function update(patch) {
  const onDisk = fs.existsSync(CONFIG_PATH)
    ? deepMerge(DEFAULTS, JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")))
    : DEFAULTS;
  return save(deepMerge(onDisk, patch));
}

/** The subset of config that is safe to hand to the browser. */
function publicConfig() {
  const c = load();

  // In production, refuse to hand out the shipped placeholder UPI ID. It is a
  // guess at the owner's address, and a QR pointing at the wrong VPA sends real
  // customer money somewhere unrecoverable. Blanking it makes the checkout show
  // its "UPI is not configured" panel with a WhatsApp fallback instead.
  const vpaIsPlaceholder = process.env.NODE_ENV === "production" && usingPlaceholderVpa();

  return {
    merchant: {
      name: c.merchant.name,
      gstin: c.merchant.gstin,
      upiVpa: vpaIsPlaceholder ? "" : c.merchant.upiVpa,
      upiPayeeName: c.merchant.upiPayeeName,
      whatsappNumber: c.merchant.whatsappNumber,
      supportPhone: c.merchant.supportPhone,
      address: c.merchant.address
    },
    store: c.store,
    whatsappAutomatic: c.whatsapp.provider !== "link"
  };
}

module.exports = {
  load,
  save,
  update,
  publicConfig,
  usingDefaultPassword,
  usingPlaceholderVpa,
  sha256,
  DATA_DIR,
  CONFIG_PATH,
  DEFAULTS
};
