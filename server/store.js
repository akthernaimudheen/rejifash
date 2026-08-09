/**
 * Reji Fashions - File-backed data store.
 *
 * Deliberately dependency-free: orders and products live in data/*.json.
 * Writes are atomic (write temp -> rename) so a crash mid-save can never
 * leave a half-written orders file behind.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
// Both directories follow DATA_DIR so a hosted deployment can put orders and
// uploaded photographs on a mounted persistent disk instead of the ephemeral
// container filesystem.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, "data");
const ORDERS_PATH = path.join(DATA_DIR, "orders.json");
const PRODUCTS_PATH = path.join(DATA_DIR, "products.json");
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : process.env.DATA_DIR
  ? path.join(DATA_DIR, "uploads")
  : path.join(ROOT, "assets", "products");

const PAYMENT_STATUSES = ["pending", "submitted", "verified", "failed", "cod", "refunded"];
const ORDER_STATUSES = [
  "placed",
  "confirmed",
  "tailoring",
  "quality_check",
  "packed",
  "shipped",
  "delivered",
  "cancelled"
];

const ORDER_STATUS_LABELS = {
  placed: "Order Placed",
  confirmed: "Confirmed",
  tailoring: "In Tailoring",
  quality_check: "Quality Check",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled"
};

const PAYMENT_STATUS_LABELS = {
  pending: "Awaiting Payment",
  submitted: "Payment Claimed — Verify",
  verified: "Payment Verified",
  failed: "Payment Failed",
  cod: "Cash on Delivery",
  refunded: "Refunded"
};

/* ------------------------------------------------------------------ io --- */

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.warn(`[store] could not read ${path.basename(file)}:`, e.message);
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDirs();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

/* ------------------------------------------------------------ products --- */

/**
 * Seed the catalog from js/products-data.js so the browser file stays the
 * single source of truth for the starting 16 designs.
 */
function seedProductsFromBrowserFile() {
  const src = path.join(ROOT, "js", "products-data.js");
  if (!fs.existsSync(src)) return [];
  try {
    const code = fs.readFileSync(src, "utf8");
    const sandbox = {};
    vm.runInNewContext(`${code}\n;__out = { products: REJI_PRODUCTS, lookbooks: REJI_LOOKBOOKS };`, sandbox, {
      timeout: 4000
    });
    return (sandbox.__out.products || []).map(normalizeProduct);
  } catch (e) {
    console.warn("[store] product seed failed:", e.message);
    return [];
  }
}

let couponCache = null;

/** Promo codes also live in js/products-data.js — read them, don't duplicate them. */
function getCoupons() {
  if (couponCache) return couponCache;
  const src = path.join(ROOT, "js", "products-data.js");
  try {
    const sandbox = {};
    vm.runInNewContext(`${fs.readFileSync(src, "utf8")}\n;__out = REJI_COUPONS;`, sandbox, { timeout: 4000 });
    couponCache = sandbox.__out || {};
  } catch (e) {
    console.warn("[store] coupon load failed:", e.message);
    couponCache = {};
  }
  return couponCache;
}

/** Give every product the media/highlight shape the new PDP expects. */
function normalizeProduct(p) {
  return {
    ...p,
    // media: array of { src, kind:'photo'|'art', alt, caption, detail, primary }
    media: Array.isArray(p.media) ? p.media : [],
    highlights: Array.isArray(p.highlights) ? p.highlights : deriveHighlights(p),
    active: p.active !== false,
    updatedAt: p.updatedAt || new Date().toISOString()
  };
}

/** Flipkart-style bullet highlights, derived from the structured fields. */
function deriveHighlights(p) {
  const out = [];
  if (p.fabric) out.push(`${p.fabric} fabric`);
  if (p.subCategory) out.push(p.subCategory);
  if (p.details && p.details["Set Contents"]) out.push(p.details["Set Contents"]);
  if (p.color) out.push(`Colour: ${p.color}`);
  if (p.occasion) out.push(`Ideal for ${p.occasion}`);
  if (p.details && p.details["Care Instructions"]) out.push(p.details["Care Instructions"]);
  return out.slice(0, 6);
}

function getProducts({ includeInactive = false } = {}) {
  let list = readJson(PRODUCTS_PATH, null);
  if (!list) {
    list = seedProductsFromBrowserFile();
    if (list.length) writeJson(PRODUCTS_PATH, list);
  }
  list = (list || []).map(normalizeProduct);
  return includeInactive ? list : list.filter(p => p.active);
}

function getProduct(id) {
  return getProducts({ includeInactive: true }).find(p => p.id === id) || null;
}

function saveProduct(product) {
  const list = getProducts({ includeInactive: true });
  const idx = list.findIndex(p => p.id === product.id);
  const merged = normalizeProduct({
    ...(idx > -1 ? list[idx] : {}),
    ...product,
    updatedAt: new Date().toISOString()
  });
  if (idx > -1) list[idx] = merged;
  else list.push(merged);
  writeJson(PRODUCTS_PATH, list);
  return merged;
}

function deleteProduct(id) {
  const list = getProducts({ includeInactive: true });
  const next = list.filter(p => p.id !== id);
  writeJson(PRODUCTS_PATH, next);
  return list.length !== next.length;
}

/* -------------------------------------------------------------- uploads --- */

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

/**
 * Persist a browser-processed image. The Image Studio hands us a data URL that
 * has already been cropped, colour-corrected and resized, so all we do is
 * decode and write the bytes.
 */
function saveImage(dataUrl, hint = "product") {
  ensureDirs();
  const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(String(dataUrl || ""));
  if (!match) throw new Error("Expected a base64 data URL");
  const mime = match[1].toLowerCase();
  const ext = EXT_BY_MIME[mime];
  if (!ext) throw new Error(`Unsupported image type: ${mime}`);

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 6 * 1024 * 1024) throw new Error("Image exceeds 6 MB after processing");

  const slug = String(hint).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";
  const name = `${slug}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), bytes);
  return `assets/products/${name}`;
}

/* --------------------------------------------------------------- orders --- */

function getOrders() {
  return readJson(ORDERS_PATH, []);
}

function getOrder(id) {
  return getOrders().find(o => o.id === id) || null;
}

function nextOrderId(existing) {
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
  const todayCount = existing.filter(o => o.id.includes(`-${stamp}-`)).length;
  return `RF-${stamp}-${String(todayCount + 1).padStart(4, "0")}`;
}

function createOrder(payload) {
  const orders = getOrders();
  const now = new Date().toISOString();
  const id = nextOrderId(orders);

  const order = {
    id,
    createdAt: now,
    updatedAt: now,
    customer: payload.customer,
    items: payload.items,
    pricing: payload.pricing,
    coupon: payload.coupon || null,
    paymentMethod: payload.paymentMethod, // "upi" | "cod"
    paymentStatus: payload.paymentMethod === "cod" ? "cod" : "pending",
    orderStatus: "placed",
    payment: {
      vpa: payload.payment?.vpa || null,
      upiRef: null,
      payerNote: null,
      proofImage: null,
      claimedAt: null,
      verifiedAt: null,
      verifiedBy: null,
      failureReason: null
    },
    // Every state change is appended here — the customer timeline and the
    // admin audit trail are both rendered from this one list.
    events: [
      { at: now, type: "order", label: "Order placed", note: `${payload.items.length} item(s)` }
    ],
    notifications: []
  };

  orders.push(order);
  writeJson(ORDERS_PATH, orders);
  return order;
}

function updateOrder(id, mutate) {
  const orders = getOrders();
  const idx = orders.findIndex(o => o.id === id);
  if (idx === -1) return null;
  const next = mutate({ ...orders[idx] });
  next.updatedAt = new Date().toISOString();
  orders[idx] = next;
  writeJson(ORDERS_PATH, orders);
  return next;
}

function addEvent(order, type, label, note) {
  order.events = order.events || [];
  order.events.push({ at: new Date().toISOString(), type, label, note: note || null });
  return order;
}

/** Customer tells us they've paid; nothing is trusted until admin verifies. */
function claimPayment(id, { upiRef, payerNote, proofImage }) {
  return updateOrder(id, order => {
    if (order.paymentStatus === "verified") return order;
    order.paymentStatus = "submitted";
    order.payment = {
      ...order.payment,
      upiRef: upiRef || order.payment.upiRef,
      payerNote: payerNote || order.payment.payerNote,
      proofImage: proofImage || order.payment.proofImage,
      claimedAt: new Date().toISOString()
    };
    return addEvent(order, "payment", "Payment marked as paid by customer", upiRef ? `UTR ${upiRef}` : null);
  });
}

function setPaymentStatus(id, status, { by = "admin", reason = null } = {}) {
  if (!PAYMENT_STATUSES.includes(status)) throw new Error(`Unknown payment status: ${status}`);
  return updateOrder(id, order => {
    order.paymentStatus = status;
    if (status === "verified") {
      order.payment.verifiedAt = new Date().toISOString();
      order.payment.verifiedBy = by;
      order.payment.failureReason = null;
      if (order.orderStatus === "placed") order.orderStatus = "confirmed";
    }
    if (status === "failed") order.payment.failureReason = reason || "Not found in bank statement";
    return addEvent(order, "payment", `Payment ${PAYMENT_STATUS_LABELS[status]}`, reason);
  });
}

function setOrderStatus(id, status, note) {
  if (!ORDER_STATUSES.includes(status)) throw new Error(`Unknown order status: ${status}`);
  return updateOrder(id, order => {
    order.orderStatus = status;
    return addEvent(order, "fulfilment", ORDER_STATUS_LABELS[status], note);
  });
}

function recordNotification(id, entry) {
  return updateOrder(id, order => {
    order.notifications = order.notifications || [];
    order.notifications.push({ at: new Date().toISOString(), ...entry });
    return order;
  });
}

/** Dashboard tiles. */
function stats() {
  const orders = getOrders();
  const paid = orders.filter(o => o.paymentStatus === "verified" || o.paymentStatus === "cod");
  const revenue = paid.reduce((sum, o) => sum + (o.pricing?.total || 0), 0);
  const today = new Date().toDateString();
  return {
    totalOrders: orders.length,
    todayOrders: orders.filter(o => new Date(o.createdAt).toDateString() === today).length,
    awaitingVerification: orders.filter(o => o.paymentStatus === "submitted").length,
    awaitingPayment: orders.filter(o => o.paymentStatus === "pending").length,
    toDispatch: orders.filter(
      o => ["confirmed", "tailoring", "quality_check", "packed"].includes(o.orderStatus)
    ).length,
    revenue,
    averageOrderValue: paid.length ? Math.round(revenue / paid.length) : 0
  };
}

module.exports = {
  DATA_DIR,
  UPLOADS_DIR,
  PAYMENT_STATUSES,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  getProducts,
  getProduct,
  getCoupons,
  saveProduct,
  deleteProduct,
  saveImage,
  getOrders,
  getOrder,
  createOrder,
  claimPayment,
  setPaymentStatus,
  setOrderStatus,
  recordNotification,
  stats,
  deriveHighlights
};
