/**
 * Reji Fashions - WhatsApp notification dispatch.
 *
 * Four providers, all optional, selected by whatsapp.provider in data/config.json:
 *
 *   link      (default) No automatic send. Every notification still produces a
 *             one-tap wa.me link with the whole message pre-typed, shown in the
 *             admin dashboard and on the customer's confirmation screen.
 *             Zero setup, zero cost, works today.
 *
 *   callmebot Free automatic push to the shop owner's own WhatsApp. Send
 *             "I allow callmebot to send me messages" to +34 644 51 95 23 from
 *             9074666413, paste the apikey it replies with into config.
 *
 *   cloud     Official Meta WhatsApp Cloud API. Needs a verified business.
 *             Free-form text only reaches a number inside a 24h service window;
 *             outside it you must use an approved template.
 *
 *   twilio    Twilio WhatsApp sender (sandbox or approved sender).
 */

const https = require("https");
const { URL, URLSearchParams } = require("url");
const config = require("./config");

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function money(n) {
  return `₹${INR.format(Math.round(Number(n) || 0))}`;
}

/* ------------------------------------------------------------ messages --- */

function orderPlacedMessage(order) {
  const c = order.customer;
  const lines = [
    `🛍️ *NEW ORDER — ${order.id}*`,
    "",
    `*Customer:* ${c.name}`,
    `*Phone:* ${c.phone}`,
    `*Address:* ${c.address}, ${c.city} - ${c.pincode}`,
    "",
    "*Items*"
  ];

  order.items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name}`);
    lines.push(`   Size ${item.size} × ${item.quantity} — ${money(item.price * item.quantity)}`);
    if (item.customNotes) lines.push(`   ✂️ Custom: ${item.customNotes}`);
  });

  lines.push("");
  lines.push(`Subtotal: ${money(order.pricing.subtotal)}`);
  if (order.pricing.discount > 0) {
    lines.push(`Discount${order.coupon ? ` (${order.coupon})` : ""}: -${money(order.pricing.discount)}`);
  }
  if (order.pricing.shipping > 0) lines.push(`Shipping: ${money(order.pricing.shipping)}`);
  lines.push(`*TOTAL: ${money(order.pricing.total)}*`);
  lines.push("");
  lines.push(
    order.paymentMethod === "cod"
      ? "💵 *Payment: Cash on Delivery*"
      : `⚡ *Payment: UPI — awaiting customer transfer*`
  );
  if (c.notes) {
    lines.push("");
    lines.push(`📝 Note from customer: ${c.notes}`);
  }
  lines.push("");
  lines.push(`Placed ${new Date(order.createdAt).toLocaleString("en-IN")}`);
  return lines.join("\n");
}

function paymentClaimedMessage(order) {
  return [
    `💰 *PAYMENT CLAIMED — ${order.id}*`,
    "",
    `${order.customer.name} (${order.customer.phone}) has marked this order as paid.`,
    "",
    `*Amount:* ${money(order.pricing.total)}`,
    `*UPI reference / UTR:* ${order.payment.upiRef || "not provided"}`,
    order.payment.payerNote ? `*Customer note:* ${order.payment.payerNote}` : null,
    order.payment.proofImage ? `*Screenshot attached:* yes (see dashboard)` : null,
    "",
    "👉 Check your bank / UPI app for this amount, then mark it *Verified* or *Failed* in the admin dashboard."
  ]
    .filter(Boolean)
    .join("\n");
}

function paymentVerifiedMessage(order) {
  return [
    `✅ *PAYMENT VERIFIED — ${order.id}*`,
    "",
    `${money(order.pricing.total)} received from ${order.customer.name}.`,
    `UTR: ${order.payment.upiRef || "—"}`,
    "",
    "Order moved to *Confirmed*. Time to start tailoring & dispatch."
  ].join("\n");
}

function statusChangeMessage(order, label) {
  return [
    `📦 *${order.id} — ${label}*`,
    "",
    `Customer: ${order.customer.name} (${order.customer.phone})`,
    `Value: ${money(order.pricing.total)}`,
    `Payment: ${order.paymentStatus}`
  ].join("\n");
}

/** The message the *customer* sends to the shop, from their own WhatsApp. */
function customerConfirmationMessage(order) {
  const lines = [
    `Hi ${config.load().merchant.name}, I've just placed order *${order.id}*.`,
    "",
    ...order.items.map(i => `• ${i.name} — Size ${i.size} × ${i.quantity}`),
    "",
    `Total: ${money(order.pricing.total)}`,
    order.paymentMethod === "cod"
      ? "Payment: Cash on Delivery"
      : `Payment: UPI${order.payment?.upiRef ? ` — UTR ${order.payment.upiRef}` : ""}`,
    "",
    `Name: ${order.customer.name}`,
    `Deliver to: ${order.customer.address}, ${order.customer.city} - ${order.customer.pincode}`
  ];
  return lines.join("\n");
}

/* ------------------------------------------------------------ providers --- */

/**
 * wa.me only accepts a full international number. Customers type a bare
 * 10-digit mobile at checkout, so add the country code before building a link
 * — without this every customer-facing WhatsApp link silently fails to resolve.
 */
function normalizeNumber(number, defaultCountryCode = "91") {
  let digits = String(number || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  // A leading 0 is the Indian domestic trunk prefix, not part of the number.
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = defaultCountryCode + digits;
  return digits;
}

function waLink(number, text) {
  return `https://wa.me/${normalizeNumber(number)}?text=${encodeURIComponent(text)}`;
}

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
      });
    });
    req.setTimeout(12000, () => req.destroy(new Error("WhatsApp request timed out")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function sendViaCallmebot(number, text, apiKey) {
  const url = new URL("https://api.callmebot.com/whatsapp.php");
  url.searchParams.set("phone", `+${normalizeNumber(number)}`);
  url.searchParams.set("text", text);
  url.searchParams.set("apikey", apiKey);
  await httpsRequest({
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: "GET",
    headers: { "User-Agent": "reji-fashions/1.0" }
  });
}

async function sendViaCloud(number, text, { phoneNumberId, accessToken }) {
  const body = JSON.stringify({
    messaging_product: "whatsapp",
    to: normalizeNumber(number),
    type: "text",
    text: { preview_url: false, body: text }
  });
  await httpsRequest(
    {
      hostname: "graph.facebook.com",
      path: `/v21.0/${phoneNumberId}/messages`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Authorization: `Bearer ${accessToken}`
      }
    },
    body
  );
}

async function sendViaTwilio(number, text, { accountSid, authToken, from }) {
  const body = new URLSearchParams({
    From: from,
    To: `whatsapp:+${normalizeNumber(number)}`,
    Body: text
  }).toString();
  await httpsRequest(
    {
      hostname: "api.twilio.com",
      path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`
      }
    },
    body
  );
}

/**
 * Send `text` to the shop's WhatsApp. Never throws — a notification failure must
 * not lose an order, so failures are returned as data and surfaced in the
 * dashboard alongside the manual wa.me fallback link.
 */
async function notifyOwner(text, kind = "generic") {
  const c = config.load();
  const number = c.merchant.whatsappNumber;
  const link = waLink(number, text);
  const result = { kind, to: number, provider: c.whatsapp.provider, link, sent: false, error: null };

  try {
    switch (c.whatsapp.provider) {
      case "callmebot":
        if (!c.whatsapp.callmebot.apiKey) throw new Error("callmebot.apiKey not configured");
        await sendViaCallmebot(number, text, c.whatsapp.callmebot.apiKey);
        result.sent = true;
        break;
      case "cloud":
        if (!c.whatsapp.cloud.accessToken) throw new Error("cloud.accessToken not configured");
        await sendViaCloud(number, text, c.whatsapp.cloud);
        result.sent = true;
        break;
      case "twilio":
        if (!c.whatsapp.twilio.authToken) throw new Error("twilio.authToken not configured");
        await sendViaTwilio(number, text, c.whatsapp.twilio);
        result.sent = true;
        break;
      case "link":
      default:
        // Manual mode: the link is the deliverable.
        break;
    }
  } catch (e) {
    result.error = e.message;
    console.warn(`[notify] ${kind} -> WhatsApp failed (${e.message}). Fallback link available.`);
  }

  const tag = result.sent ? "sent" : c.whatsapp.provider === "link" ? "link-only" : "FAILED";
  console.log(`[notify] ${kind} to +${number}: ${tag}`);
  return result;
}

module.exports = {
  notifyOwner,
  waLink,
  normalizeNumber,
  orderPlacedMessage,
  paymentClaimedMessage,
  paymentVerifiedMessage,
  statusChangeMessage,
  customerConfirmationMessage,
  money
};
