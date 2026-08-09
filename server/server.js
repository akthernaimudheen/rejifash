/**
 * Reji Fashions - storefront + order API + admin API.
 *
 * Runs on Node's standard library alone: `node server/server.js`.
 * No npm install, no build step, no external services required.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const config = require("./config");
const store = require("./store");
const notify = require("./notify");
const storage = require("./storage");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 4173;
const MAX_BODY = 8 * 1024 * 1024; // generous: payment screenshots arrive as base64

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};

/* ----------------------------------------------------------------- auth --- */

/** In-memory admin sessions. Restarting the server logs admins out — fine here. */
const sessions = new Map(); // token -> { user, expires }
const SESSION_TTL = 12 * 60 * 60 * 1000;

function issueToken(user) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, { user, expires: Date.now() + SESSION_TTL });
  return token;
}

function currentUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.user;
}

/* ----------------------------------------------------------------- http --- */

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(payload);
}

function fail(res, status, message) {
  send(res, status, { ok: false, error: message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Body is not valid JSON"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Static file serving, allowlist-only.
 *
 * An earlier blocklist version leaked /server/*.js and — once DATA_DIR was
 * pointed elsewhere for hosting — the in-repo data/config.json with the admin
 * password hash in it. Enumerating what must stay private is a losing game, so
 * only these paths are reachable and everything else is a flat 404.
 */
const PUBLIC_PAGES = new Set(["index.html", "product.html", "orders.html", "admin.html"]);
const PUBLIC_DIRS = new Set(["js", "styles", "assets"]);

function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
  res.end("<h1>404</h1><p>Not found. <a href='/'>Back to Reji Fashions</a></p>");
}

function serveStatic(req, res, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return notFound(res); // malformed percent-encoding
  }

  if (rel === "/" || rel === "") rel = "/index.html";
  if (!path.extname(rel)) rel += ".html"; // /admin -> /admin.html

  const segments = rel.split("/").filter(Boolean);
  // Reject traversal, dotfiles (.env, .git) and anything with a path separator
  // smuggled through the decode.
  if (segments.some(s => s === ".." || s === "." || s.startsWith(".") || s.includes("\\"))) {
    return notFound(res);
  }

  // Product photographs can legitimately live in two places at once, and both
  // must be served:
  //
  //   UPLOADS_DIR  images uploaded at runtime. Follows DATA_DIR onto a mounted
  //                disk when one is configured.
  //   the repo     images committed alongside catalog.json, which is how a host
  //                with no persistent disk keeps a catalog at all.
  //
  // Serving only the first meant that setting DATA_DIR silently made every
  // committed photograph unreachable.
  let candidates;
  if (segments.length === 1) {
    if (!PUBLIC_PAGES.has(segments[0])) return notFound(res);
    candidates = [path.join(ROOT, segments[0])];
  } else if (PUBLIC_DIRS.has(segments[0])) {
    if (segments[0] === "assets" && segments[1] === "products") {
      const name = segments.slice(2).join(path.sep);
      candidates = [path.join(store.UPLOADS_DIR, name), path.join(ROOT, "assets", "products", name)];
    } else {
      candidates = [path.join(ROOT, ...segments)];
    }
  } else {
    return notFound(res);
  }

  // Keep every candidate inside its own root — no traversal out of either.
  const roots = [path.resolve(store.UPLOADS_DIR), path.resolve(ROOT)];
  candidates = candidates.filter(p => roots.some(r => path.resolve(p).startsWith(r)));
  if (!candidates.length) return notFound(res);

  const tryNext = index => {
    if (index >= candidates.length) return notFound(res);
    const filePath = candidates[index];
    fs.readFile(filePath, (err, buf) => {
      if (err) return tryNext(index + 1);
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": segments[0] === "assets" ? "public, max-age=86400" : "no-cache",
        "X-Content-Type-Options": "nosniff"
      });
      res.end(buf);
    });
  };
  tryNext(0);
}

/* -------------------------------------------------------------- pricing --- */

/**
 * Recompute every rupee from the server-side catalog. The browser sends ids,
 * sizes and quantities; prices, discounts and totals are never taken on trust.
 */
function priceCart(items, couponCode) {
  const catalog = store.getProducts();
  const coupons = store.getCoupons();
  const priced = [];

  for (const raw of items || []) {
    const product = catalog.find(p => p.id === raw.id);
    if (!product) throw new Error(`Product no longer available: ${raw.id}`);
    const quantity = Math.max(1, Math.min(20, parseInt(raw.quantity, 10) || 1));
    const size = String(raw.size || "M").slice(0, 24);
    priced.push({
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice,
      fabric: product.fabric,
      color: product.color,
      colorHex: product.colorHex,
      accentHex: product.accentHex,
      visualType: product.visualType,
      image: (product.media || []).find(m => m.primary)?.src || (product.media || [])[0]?.src || null,
      size,
      quantity,
      customNotes: raw.customNotes ? String(raw.customNotes).slice(0, 400) : null,
      lineTotal: product.price * quantity
    });
  }

  if (!priced.length) throw new Error("Your bag is empty");

  const subtotal = priced.reduce((sum, i) => sum + i.lineTotal, 0);

  let discount = 0;
  let appliedCoupon = null;
  const coupon = couponCode ? coupons[String(couponCode).toUpperCase()] : null;
  if (coupon && subtotal >= (coupon.minSpend || 0)) {
    discount = coupon.discountPercent
      ? Math.round((subtotal * coupon.discountPercent) / 100)
      : coupon.flatDiscount || 0;
    appliedCoupon = String(couponCode).toUpperCase();
  }

  const { freeShippingThreshold } = config.load().store;
  const shipping = subtotal - discount >= freeShippingThreshold ? 0 : 99;
  const total = Math.max(0, subtotal - discount + shipping);

  return { items: priced, pricing: { subtotal, discount, shipping, total }, coupon: appliedCoupon };
}

function validateCustomer(c = {}) {
  const name = String(c.name || "").trim();
  const phone = String(c.phone || "").replace(/[^\d+]/g, "");
  const pincode = String(c.pincode || "").trim();
  const address = String(c.address || "").trim();

  if (name.length < 2) throw new Error("Please enter the full name");
  if (phone.replace(/\D/g, "").length < 10) throw new Error("Please enter a valid 10-digit mobile number");
  if (!/^\d{6}$/.test(pincode)) throw new Error("Please enter a valid 6-digit PIN code");
  if (address.length < 10) throw new Error("Please enter the complete street address");

  return {
    name: name.slice(0, 120),
    phone: phone.slice(0, 20),
    email: String(c.email || "").trim().slice(0, 160),
    pincode,
    city: String(c.city || "").trim().slice(0, 120),
    address: address.slice(0, 400),
    notes: String(c.notes || "").trim().slice(0, 400)
  };
}

/* -------------------------------------------------------------- secrets --- */

// Access tokens must not travel to the browser, even an authenticated one. The
// dashboard shows this sentinel so a field reads as "already set", and sending
// it back unchanged on save means "leave it alone".
const SECRET_MASK = "••••••••";

const SECRET_PATHS = [
  ["storage", "github", "token"],
  ["whatsapp", "callmebot", "apiKey"],
  ["whatsapp", "cloud", "accessToken"],
  ["whatsapp", "twilio", "authToken"],
  ["admin", "passwordHash"]
];

function maskSecrets(cfg) {
  const clone = JSON.parse(JSON.stringify(cfg));
  for (const keys of SECRET_PATHS) {
    let node = clone;
    for (const key of keys.slice(0, -1)) {
      if (!node) break;
      node = node[key];
    }
    const last = keys[keys.length - 1];
    if (node && node[last]) node[last] = SECRET_MASK;
  }
  return clone;
}

/** Strip masked values out of an incoming settings patch. */
function dropMaskedSecrets(patch) {
  for (const keys of SECRET_PATHS) {
    let node = patch;
    for (const key of keys.slice(0, -1)) {
      if (!node) break;
      node = node[key];
    }
    const last = keys[keys.length - 1];
    if (node && node[last] === SECRET_MASK) delete node[last];
  }
  return patch;
}

/* --------------------------------------------------------------- routes --- */

async function handleApi(req, res, url) {
  const { pathname } = url;
  const method = req.method.toUpperCase();
  const segments = pathname.split("/").filter(Boolean); // ["api", ...]

  /* ---- public ---- */

  if (pathname === "/api/config" && method === "GET") {
    return send(res, 200, { ok: true, config: config.publicConfig() });
  }

  if (pathname === "/api/products" && method === "GET") {
    return send(res, 200, { ok: true, products: store.getProducts(), coupons: store.getCoupons() });
  }

  if (pathname === "/api/quote" && method === "POST") {
    const body = await readBody(req);
    const quote = priceCart(body.items, body.coupon);
    return send(res, 200, { ok: true, ...quote });
  }

  // Place an order. Payment has NOT happened yet at this point.
  if (pathname === "/api/orders" && method === "POST") {
    const body = await readBody(req);
    const customer = validateCustomer(body.customer);
    const { items, pricing, coupon } = priceCart(body.items, body.coupon);

    const cfg = config.load();
    let paymentMethod = body.paymentMethod === "cod" ? "cod" : "upi";
    if (paymentMethod === "cod" && (!cfg.store.codEnabled || pricing.total > cfg.store.codMaxOrderValue)) {
      return fail(res, 400, "Cash on Delivery is not available for this order value. Please pay via UPI.");
    }

    const order = store.createOrder({
      customer,
      items,
      pricing,
      coupon,
      paymentMethod,
      payment: { vpa: cfg.merchant.upiVpa }
    });

    const result = await notify.notifyOwner(notify.orderPlacedMessage(order), "order_placed");
    store.recordNotification(order.id, result);

    return send(res, 201, {
      ok: true,
      order: store.getOrder(order.id),
      whatsapp: {
        ownerLink: result.link,
        customerLink: notify.waLink(cfg.merchant.whatsappNumber, notify.customerConfirmationMessage(order)),
        automatic: result.sent
      }
    });
  }

  // Customer says "I've paid" and hands over the UTR.
  if (/^\/api\/orders\/[\w-]+\/payment$/.test(pathname) && method === "POST") {
    const id = segments[2];
    const existing = store.getOrder(id);
    if (!existing) return fail(res, 404, "Order not found");
    if (existing.paymentStatus === "verified") {
      return send(res, 200, { ok: true, order: existing, alreadyVerified: true });
    }

    const body = await readBody(req);
    const upiRef = String(body.upiRef || "").replace(/[^\w]/g, "").slice(0, 32);
    if (upiRef && upiRef.length < 6) {
      return fail(res, 400, "A UPI reference / UTR number is usually 12 digits. Please re-check.");
    }

    let proofImage = null;
    if (body.proofImage) {
      try {
        proofImage = store.saveImage(body.proofImage, `payment-${id}`);
      } catch (e) {
        return fail(res, 400, `Could not save the screenshot: ${e.message}`);
      }
    }

    const order = store.claimPayment(id, {
      upiRef,
      payerNote: String(body.payerNote || "").slice(0, 300),
      proofImage
    });

    const result = await notify.notifyOwner(notify.paymentClaimedMessage(order), "payment_claimed");
    store.recordNotification(id, result);

    return send(res, 200, {
      ok: true,
      order: store.getOrder(id),
      whatsapp: { ownerLink: result.link, automatic: result.sent }
    });
  }

  // Order lookup for the customer-facing tracking page.
  if (/^\/api\/orders\/[\w-]+$/.test(pathname) && method === "GET") {
    const order = store.getOrder(segments[2]);
    if (!order) return fail(res, 404, "No order found with that ID");

    // Phone acts as the shared secret so order IDs alone can't be enumerated.
    const claimed = String(url.searchParams.get("phone") || "").replace(/\D/g, "");
    const actual = order.customer.phone.replace(/\D/g, "");
    if (!claimed || !actual.endsWith(claimed.slice(-10))) {
      return fail(res, 403, "Please enter the mobile number used when placing the order");
    }
    return send(res, 200, { ok: true, order });
  }

  /* ---- admin ---- */

  if (pathname === "/api/admin/login" && method === "POST") {
    const body = await readBody(req);
    const cfg = config.load();
    const okUser = String(body.username || "").trim() === cfg.admin.username;
    const okPass = config.sha256(String(body.password || "")) === cfg.admin.passwordHash;
    if (!okUser || !okPass) return fail(res, 401, "Incorrect username or password");
    return send(res, 200, { ok: true, token: issueToken(cfg.admin.username), user: cfg.admin.username });
  }

  if (pathname.startsWith("/api/admin/")) {
    const user = currentUser(req);
    if (!user) return fail(res, 401, "Session expired — please sign in again");

    if (pathname === "/api/admin/overview" && method === "GET") {
      return send(res, 200, {
        ok: true,
        stats: store.stats(),
        orders: store.getOrders().slice().reverse(),
        products: store.getProducts({ includeInactive: true }),
        config: maskSecrets(config.load()),
        labels: {
          order: store.ORDER_STATUS_LABELS,
          payment: store.PAYMENT_STATUS_LABELS
        }
      });
    }

    if (/^\/api\/admin\/orders\/[\w-]+\/payment$/.test(pathname) && method === "POST") {
      const id = segments[3];
      const body = await readBody(req);
      const order = store.setPaymentStatus(id, body.status, { by: user, reason: body.reason });
      if (!order) return fail(res, 404, "Order not found");

      let result = null;
      if (body.status === "verified") {
        result = await notify.notifyOwner(notify.paymentVerifiedMessage(order), "payment_verified");
        store.recordNotification(id, result);
      }
      return send(res, 200, {
        ok: true,
        order: store.getOrder(id),
        customerLink: notify.waLink(
          order.customer.phone,
          body.status === "verified"
            ? `Hi ${order.customer.name}, we've received your payment of ${notify.money(
                order.pricing.total
              )} for order ${order.id}. Your Reji Fashions order is now confirmed and moves into tailoring. 🧵`
            : `Hi ${order.customer.name}, we could not trace the payment for order ${order.id}. ${
                body.reason || ""
              } Could you share the UTR again?`
        ),
        whatsapp: result
      });
    }

    if (/^\/api\/admin\/orders\/[\w-]+\/status$/.test(pathname) && method === "POST") {
      const id = segments[3];
      const body = await readBody(req);
      const order = store.setOrderStatus(id, body.status, body.note);
      if (!order) return fail(res, 404, "Order not found");

      const label = store.ORDER_STATUS_LABELS[body.status];
      const result = await notify.notifyOwner(notify.statusChangeMessage(order, label), "status_change");
      store.recordNotification(id, result);

      return send(res, 200, {
        ok: true,
        order: store.getOrder(id),
        customerLink: notify.waLink(
          order.customer.phone,
          `Hi ${order.customer.name}, update on your Reji Fashions order ${order.id}: *${label}*.${
            body.note ? `\n${body.note}` : ""
          }\n\nTrack it any time: order ID ${order.id}`
        )
      });
    }

    if (pathname === "/api/admin/products" && method === "POST") {
      const body = await readBody(req);
      if (!body.id) return fail(res, 400, "Product id is required");
      const product = store.saveProduct(body);

      // With GitHub storage the images are permanent but the catalog that
      // points at them still lives on a disposable disk, so commit it too.
      let catalogSaved = null;
      if (storage.provider() === "github") {
        try {
          await storage.saveCatalog(store.getProducts({ includeInactive: true }));
          catalogSaved = true;
        } catch (e) {
          catalogSaved = false;
          console.warn("[storage] catalog commit failed:", e.message);
        }
      }
      return send(res, 200, { ok: true, product, catalogSaved });
    }

    if (/^\/api\/admin\/products\/[\w-]+$/.test(pathname) && method === "DELETE") {
      return send(res, 200, { ok: store.deleteProduct(segments[3]) });
    }

    if (pathname === "/api/admin/upload" && method === "POST") {
      const body = await readBody(req);
      const src = await storage.saveImage(body.dataUrl, body.hint || "product", store.saveImage);
      return send(res, 201, { ok: true, src, provider: storage.provider() });
    }

    if (pathname === "/api/admin/test-storage" && method === "POST") {
      try {
        return send(res, 200, { ok: true, provider: storage.provider(), result: await storage.testConnection() });
      } catch (e) {
        return fail(res, 400, e.message);
      }
    }

    if (pathname === "/api/admin/settings" && method === "POST") {
      const body = dropMaskedSecrets(await readBody(req));
      if (body.newPassword) {
        if (String(body.newPassword).length < 6) return fail(res, 400, "Password must be at least 6 characters");
        body.admin = { ...(body.admin || {}), passwordHash: config.sha256(body.newPassword) };
        delete body.newPassword;
      }
      return send(res, 200, { ok: true, config: config.update(body) });
    }

    if (pathname === "/api/admin/test-whatsapp" && method === "POST") {
      const cfg = config.load();
      const text = `🔔 Test message from ${cfg.merchant.name} admin dashboard. If you can read this, order alerts will reach you here.`;
      const result = await notify.notifyOwner(text, "test");
      return send(res, 200, { ok: true, result });
    }

    return fail(res, 404, "Unknown admin endpoint");
  }

  return fail(res, 404, "Unknown endpoint");
}

/* --------------------------------------------------------------- server --- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
    });
    return res.end();
  }

  if (url.pathname.startsWith("/api/")) {
    try {
      await handleApi(req, res, url);
    } catch (e) {
      console.error(`[api] ${req.method} ${url.pathname}:`, e.message);
      if (!res.headersSent) fail(res, 400, e.message || "Something went wrong");
    }
    return;
  }

  serveStatic(req, res, url.pathname);
});

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * A publicly reachable admin dashboard whose password is printed in the README
 * is not a warning, it's an open door. Refuse to boot in production until it's
 * changed — ADMIN_PASSWORD is all it takes.
 */
function guardProductionSecrets() {
  if (!IS_PRODUCTION) return;

  if (config.usingDefaultPassword()) {
    console.error("");
    console.error("  ✖  Refusing to start in production with the default admin password.");
    console.error("     The default is published in the README, so /admin would be open");
    console.error("     to anyone who finds the URL.");
    console.error("");
    console.error("     Set ADMIN_PASSWORD in your host's environment variables and redeploy.");
    console.error("");
    process.exit(1);
  }

  if (config.usingPlaceholderVpa()) {
    console.warn("");
    console.warn("  ⚠  UPI_VPA is still the shipped placeholder. Every payment QR will point");
    console.warn("     at an address you may not own. Set UPI_VPA before taking real orders.");
    console.warn("");
  }
}

guardProductionSecrets();

server.listen(PORT, () => {
  const cfg = config.load();
  const base = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

  console.log("");
  console.log("  ╭──────────────────────────────────────────────────────────╮");
  console.log("  │  REJI FASHIONS                                           │");
  console.log("  ╰──────────────────────────────────────────────────────────╯");
  console.log(`     Storefront  ${base}/`);
  console.log(`     Admin       ${base}/admin`);
  console.log(`     Track order ${base}/orders`);
  console.log("");
  console.log(`     UPI payee   ${cfg.merchant.upiVpa}`);
  console.log(`     WhatsApp    +${cfg.merchant.whatsappNumber}  (provider: ${cfg.whatsapp.provider})`);
  console.log(`     Data dir    ${store.DATA_DIR}`);
  console.log(`     Uploads     ${store.UPLOADS_DIR}`);

  if (cfg.whatsapp.provider === "link") {
    console.log("                 ↳ manual mode: one-tap send links appear in the dashboard.");
    console.log("                   Settings > WhatsApp to switch on automatic alerts.");
  }
  if (!IS_PRODUCTION && config.usingDefaultPassword()) {
    console.log("");
    console.log("     Sign in with admin / reji@admin  (development only)");
  }
  console.log("");
});
