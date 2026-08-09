/**
 * Reji Fashions - API client.
 *
 * Talks to the Node backend when one is running. When the site is opened
 * straight off disk (file://) or the server is down it transparently falls back
 * to a localStorage-backed store, so the storefront, checkout and admin
 * dashboard all still work — orders just live in the browser instead of on the
 * server, and WhatsApp alerts become one-tap send links.
 *
 * Every method returns the same shape in both modes, so nothing above this
 * layer needs to know which one is active.
 */

const RejiAPI = (() => {
  "use strict";

  const LS_ORDERS = "rf_local_orders";
  const LS_TOKEN = "rf_admin_token";

  const state = {
    mode: "unknown", // "server" | "local"
    config: null,
    ready: null
  };

  const FALLBACK_CONFIG = {
    merchant: {
      name: "Reji Fashions",
      gstin: "29AAAFR1234F1Z8",
      upiVpa: "9074666413@upi",
      upiPayeeName: "Reji Fashions",
      whatsappNumber: "919074666413",
      supportPhone: "+91 90746 66413",
      address: "Indiranagar, Bengaluru & Marine Drive, Kochi"
    },
    store: {
      freeShippingThreshold: 1999,
      codEnabled: true,
      codExtraFee: 0,
      codMaxOrderValue: 8000,
      currency: "INR",
      upiWindowMinutes: 15
    },
    whatsappAutomatic: false
  };

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

  /* ------------------------------------------------------------- http --- */

  function token() {
    try {
      return localStorage.getItem(LS_TOKEN);
    } catch {
      return null;
    }
  }

  async function request(path, { method = "GET", body, auth = false } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (auth && token()) headers.Authorization = `Bearer ${token()}`;

    const res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      /* non-JSON error page */
    }
    if (!res.ok || data.ok === false) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ------------------------------------------------------- local store --- */

  function localOrders() {
    try {
      return JSON.parse(localStorage.getItem(LS_ORDERS) || "[]");
    } catch {
      return [];
    }
  }

  function saveLocalOrders(list) {
    try {
      localStorage.setItem(LS_ORDERS, JSON.stringify(list));
    } catch (e) {
      console.warn("[api] could not persist orders locally", e);
    }
  }

  function localOrderId() {
    const d = new Date();
    const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(
      d.getDate()
    ).padStart(2, "0")}`;
    const today = localOrders().filter(o => o.id.includes(`-${stamp}-`)).length;
    return `RF-${stamp}-${String(today + 1).padStart(4, "0")}`;
  }

  /* ----------------------------------------------------------- pricing --- */

  /**
   * Mirror of the server's pricing rules, used for live cart display and as the
   * authority in local mode. On the server path the returned total is always
   * replaced by the server's own figure before payment.
   */
  function computePricing(items, couponCode, catalog, coupons, storeConfig) {
    const cfg = storeConfig || (state.config || FALLBACK_CONFIG).store;
    const priced = (items || []).map(raw => {
      const product = (catalog || []).find(p => p.id === raw.id) || raw;
      const quantity = Math.max(1, parseInt(raw.quantity, 10) || 1);
      return {
        ...raw,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        quantity,
        lineTotal: product.price * quantity
      };
    });

    const subtotal = priced.reduce((sum, i) => sum + i.lineTotal, 0);

    let discount = 0;
    let applied = null;
    const coupon = couponCode ? (coupons || {})[String(couponCode).toUpperCase()] : null;
    if (coupon && subtotal >= (coupon.minSpend || 0)) {
      discount = coupon.discountPercent
        ? Math.round((subtotal * coupon.discountPercent) / 100)
        : coupon.flatDiscount || 0;
      applied = String(couponCode).toUpperCase();
    }

    const shipping = subtotal - discount >= cfg.freeShippingThreshold ? 0 : 99;
    return {
      items: priced,
      coupon: applied,
      pricing: { subtotal, discount, shipping, total: Math.max(0, subtotal - discount + shipping) }
    };
  }

  /* -------------------------------------------------------- whatsapp --- */

  const inr = n => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

  function ownerMessage(order) {
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
      lines.push(`   Size ${item.size} × ${item.quantity} — ${inr(item.price * item.quantity)}`);
      if (item.customNotes) lines.push(`   ✂️ Custom: ${item.customNotes}`);
    });
    lines.push("");
    lines.push(`Subtotal: ${inr(order.pricing.subtotal)}`);
    if (order.pricing.discount > 0) lines.push(`Discount: -${inr(order.pricing.discount)}`);
    if (order.pricing.shipping > 0) lines.push(`Shipping: ${inr(order.pricing.shipping)}`);
    lines.push(`*TOTAL: ${inr(order.pricing.total)}*`);
    lines.push("");
    lines.push(order.paymentMethod === "cod" ? "💵 *Payment: Cash on Delivery*" : "⚡ *Payment: UPI*");
    if (order.payment?.upiRef) lines.push(`UTR: ${order.payment.upiRef}`);
    if (c.notes) lines.push(`\n📝 ${c.notes}`);
    return lines.join("\n");
  }

  function customerMessage(order) {
    const merchant = (state.config || FALLBACK_CONFIG).merchant;
    return [
      `Hi ${merchant.name}, I've just placed order *${order.id}*.`,
      "",
      ...order.items.map(i => `• ${i.name} — Size ${i.size} × ${i.quantity}`),
      "",
      `Total: ${inr(order.pricing.total)}`,
      order.paymentMethod === "cod"
        ? "Payment: Cash on Delivery"
        : `Payment: UPI${order.payment?.upiRef ? ` — UTR ${order.payment.upiRef}` : ""}`,
      "",
      `Name: ${order.customer.name}`,
      `Deliver to: ${order.customer.address}, ${order.customer.city} - ${order.customer.pincode}`
    ].join("\n");
  }

  /**
   * wa.me only accepts a full international number. Customers type a bare
   * 10-digit mobile at checkout, so add the country code — without this every
   * customer-facing WhatsApp link silently fails to resolve.
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

  /* -------------------------------------------------------------- api --- */

  async function init() {
    if (state.ready) return state.ready;
    state.ready = (async () => {
      try {
        const data = await request("/api/config");
        state.config = data.config;
        state.mode = "server";
      } catch {
        state.config = FALLBACK_CONFIG;
        state.mode = "local";
        console.info(
          "%c[Reji] Running in offline mode — orders are stored in this browser.\n" +
            "Start the server with `node server/server.js` for the full experience.",
          "color:#8a6d1f"
        );
      }
      return state;
    })();
    return state.ready;
  }

  async function getProducts() {
    if (state.mode === "server") {
      try {
        const data = await request("/api/products");
        if (data.products?.length) return { products: data.products, coupons: data.coupons };
      } catch (e) {
        console.warn("[api] product fetch failed, using bundled catalog", e.message);
      }
    }
    return {
      products: (typeof REJI_PRODUCTS !== "undefined" ? REJI_PRODUCTS : []).map(p => ({
        ...p,
        media: p.media || [],
        highlights: p.highlights || [],
        active: p.active !== false
      })),
      coupons: typeof REJI_COUPONS !== "undefined" ? REJI_COUPONS : {}
    };
  }

  async function quote(items, coupon) {
    if (state.mode === "server") return request("/api/quote", { method: "POST", body: { items, coupon } });
    const { products, coupons } = await getProducts();
    return computePricing(items, coupon, products, coupons);
  }

  async function placeOrder({ customer, items, coupon, paymentMethod }) {
    if (state.mode === "server") {
      return request("/api/orders", { method: "POST", body: { customer, items, coupon, paymentMethod } });
    }

    const { products, coupons } = await getProducts();
    const priced = computePricing(items, coupon, products, coupons);
    const now = new Date().toISOString();
    const order = {
      id: localOrderId(),
      createdAt: now,
      updatedAt: now,
      customer,
      items: priced.items,
      pricing: priced.pricing,
      coupon: priced.coupon,
      paymentMethod,
      paymentStatus: paymentMethod === "cod" ? "cod" : "pending",
      orderStatus: "placed",
      payment: {
        vpa: state.config.merchant.upiVpa,
        upiRef: null,
        payerNote: null,
        proofImage: null,
        claimedAt: null,
        verifiedAt: null,
        verifiedBy: null,
        failureReason: null
      },
      events: [{ at: now, type: "order", label: "Order placed", note: `${priced.items.length} item(s)` }],
      notifications: []
    };

    saveLocalOrders([...localOrders(), order]);
    const number = state.config.merchant.whatsappNumber;
    return {
      ok: true,
      order,
      whatsapp: {
        ownerLink: waLink(number, ownerMessage(order)),
        customerLink: waLink(number, customerMessage(order)),
        automatic: false
      }
    };
  }

  async function claimPayment(orderId, { upiRef, payerNote, proofImage }) {
    if (state.mode === "server") {
      return request(`/api/orders/${orderId}/payment`, {
        method: "POST",
        body: { upiRef, payerNote, proofImage }
      });
    }

    const orders = localOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) throw new Error("Order not found");
    const order = orders[idx];
    order.paymentStatus = "submitted";
    order.payment = { ...order.payment, upiRef, payerNote, proofImage, claimedAt: new Date().toISOString() };
    order.events.push({
      at: new Date().toISOString(),
      type: "payment",
      label: "Payment marked as paid by customer",
      note: upiRef ? `UTR ${upiRef}` : null
    });
    order.updatedAt = new Date().toISOString();
    orders[idx] = order;
    saveLocalOrders(orders);

    return {
      ok: true,
      order,
      whatsapp: {
        ownerLink: waLink(state.config.merchant.whatsappNumber, ownerMessage(order)),
        automatic: false
      }
    };
  }

  async function getOrder(orderId, phone) {
    if (state.mode === "server") {
      const data = await request(`/api/orders/${orderId}?phone=${encodeURIComponent(phone || "")}`);
      return data.order;
    }
    const order = localOrders().find(o => o.id === orderId);
    if (!order) throw new Error("No order found with that ID");
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits || !order.customer.phone.replace(/\D/g, "").endsWith(digits.slice(-10))) {
      throw new Error("Please enter the mobile number used when placing the order");
    }
    return order;
  }

  /* ------------------------------------------------------------ admin --- */

  async function adminLogin(username, password) {
    if (state.mode === "server") {
      const data = await request("/api/admin/login", { method: "POST", body: { username, password } });
      try {
        localStorage.setItem(LS_TOKEN, data.token);
      } catch {
        /* private mode */
      }
      return data;
    }
    // Offline mode has no server to check against; the data is local anyway.
    if (username !== "admin" || password !== "reji@admin") throw new Error("Incorrect username or password");
    try {
      localStorage.setItem(LS_TOKEN, "local");
    } catch {
      /* ignore */
    }
    return { ok: true, token: "local", user: "admin", local: true };
  }

  function adminLogout() {
    try {
      localStorage.removeItem(LS_TOKEN);
    } catch {
      /* ignore */
    }
  }

  function isAdminSignedIn() {
    return Boolean(token());
  }

  function localStats(orders) {
    const paid = orders.filter(o => o.paymentStatus === "verified" || o.paymentStatus === "cod");
    const revenue = paid.reduce((sum, o) => sum + (o.pricing?.total || 0), 0);
    const today = new Date().toDateString();
    return {
      totalOrders: orders.length,
      todayOrders: orders.filter(o => new Date(o.createdAt).toDateString() === today).length,
      awaitingVerification: orders.filter(o => o.paymentStatus === "submitted").length,
      awaitingPayment: orders.filter(o => o.paymentStatus === "pending").length,
      toDispatch: orders.filter(o =>
        ["confirmed", "tailoring", "quality_check", "packed"].includes(o.orderStatus)
      ).length,
      revenue,
      averageOrderValue: paid.length ? Math.round(revenue / paid.length) : 0
    };
  }

  async function adminOverview() {
    if (state.mode === "server") return request("/api/admin/overview", { auth: true });
    const orders = localOrders().slice().reverse();
    const { products } = await getProducts();
    return {
      ok: true,
      local: true,
      stats: localStats(orders),
      orders,
      products,
      config: { ...state.config, whatsapp: { provider: "link" } },
      labels: { order: ORDER_STATUS_LABELS, payment: PAYMENT_STATUS_LABELS }
    };
  }

  function localMutateOrder(orderId, mutate) {
    const orders = localOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) throw new Error("Order not found");
    orders[idx] = mutate(orders[idx]);
    orders[idx].updatedAt = new Date().toISOString();
    saveLocalOrders(orders);
    return orders[idx];
  }

  async function adminSetPayment(orderId, status, reason) {
    if (state.mode === "server") {
      return request(`/api/admin/orders/${orderId}/payment`, {
        method: "POST",
        auth: true,
        body: { status, reason }
      });
    }
    const order = localMutateOrder(orderId, o => {
      o.paymentStatus = status;
      if (status === "verified") {
        o.payment.verifiedAt = new Date().toISOString();
        o.payment.verifiedBy = "admin";
        if (o.orderStatus === "placed") o.orderStatus = "confirmed";
      }
      if (status === "failed") o.payment.failureReason = reason || "Not found in bank statement";
      o.events.push({
        at: new Date().toISOString(),
        type: "payment",
        label: `Payment ${PAYMENT_STATUS_LABELS[status]}`,
        note: reason || null
      });
      return o;
    });
    return {
      ok: true,
      order,
      customerLink: waLink(
        order.customer.phone,
        status === "verified"
          ? `Hi ${order.customer.name}, we've received your payment of ${inr(order.pricing.total)} for order ${
              order.id
            }. Your Reji Fashions order is now confirmed. 🧵`
          : `Hi ${order.customer.name}, we could not trace the payment for order ${order.id}. ${
              reason || ""
            } Could you share the UTR again?`
      )
    };
  }

  async function adminSetStatus(orderId, status, note) {
    if (state.mode === "server") {
      return request(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        auth: true,
        body: { status, note }
      });
    }
    const order = localMutateOrder(orderId, o => {
      o.orderStatus = status;
      o.events.push({
        at: new Date().toISOString(),
        type: "fulfilment",
        label: ORDER_STATUS_LABELS[status],
        note: note || null
      });
      return o;
    });
    return {
      ok: true,
      order,
      customerLink: waLink(
        order.customer.phone,
        `Hi ${order.customer.name}, update on your Reji Fashions order ${order.id}: *${
          ORDER_STATUS_LABELS[status]
        }*.${note ? `\n${note}` : ""}`
      )
    };
  }

  async function adminSaveProduct(product) {
    if (state.mode === "server") {
      return request("/api/admin/products", { method: "POST", auth: true, body: product });
    }
    throw new Error("Saving products needs the server running: node server/server.js");
  }

  async function adminDeleteProduct(id) {
    if (state.mode === "server") {
      return request(`/api/admin/products/${id}`, { method: "DELETE", auth: true });
    }
    throw new Error("Deleting products needs the server running: node server/server.js");
  }

  async function adminUpload(dataUrl, hint) {
    if (state.mode === "server") {
      return request("/api/admin/upload", { method: "POST", auth: true, body: { dataUrl, hint } });
    }
    // Offline: keep the processed image inline so previews still work.
    return { ok: true, src: dataUrl, inline: true };
  }

  async function adminSaveSettings(patch) {
    if (state.mode === "server") {
      const data = await request("/api/admin/settings", { method: "POST", auth: true, body: patch });
      state.config = {
        merchant: data.config.merchant,
        store: data.config.store,
        whatsappAutomatic: data.config.whatsapp.provider !== "link"
      };
      return data;
    }
    throw new Error("Saving settings needs the server running: node server/server.js");
  }

  async function adminTestStorage() {
    if (state.mode === "server") return request("/api/admin/test-storage", { method: "POST", auth: true });
    return { ok: true, provider: "local", result: null };
  }

  async function adminTestWhatsApp() {
    if (state.mode === "server") return request("/api/admin/test-whatsapp", { method: "POST", auth: true });
    const text = "🔔 Test message from Reji Fashions admin dashboard.";
    return { ok: true, result: { sent: false, provider: "link", link: waLink(state.config.merchant.whatsappNumber, text) } };
  }

  return {
    init,
    get mode() {
      return state.mode;
    },
    get config() {
      return state.config || FALLBACK_CONFIG;
    },
    ORDER_STATUS_LABELS,
    PAYMENT_STATUS_LABELS,
    computePricing,
    normalizeNumber,
    getProducts,
    quote,
    placeOrder,
    claimPayment,
    getOrder,
    waLink,
    ownerMessage,
    customerMessage,
    adminLogin,
    adminLogout,
    isAdminSignedIn,
    adminOverview,
    adminSetPayment,
    adminSetStatus,
    adminSaveProduct,
    adminDeleteProduct,
    adminUpload,
    adminSaveSettings,
    adminTestStorage,
    adminTestWhatsApp
  };
})();

if (typeof window !== "undefined") window.RejiAPI = RejiAPI;
