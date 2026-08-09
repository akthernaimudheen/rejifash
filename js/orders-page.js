/**
 * Reji Fashions - Customer order tracking.
 *
 * Doubles as the "finish paying later" screen: if an order is still awaiting
 * payment, the same UPI QR reappears here with the right amount and reference,
 * and the customer can submit their UTR. Without this, an interrupted payment
 * would have no route back.
 */

const OrdersPage = {
  order: null,
  proofDataUrl: null,

  async init() {
    await RejiAPI.init();
    SiteChrome.mount();

    const { products, coupons } = await RejiAPI.getProducts();
    AppState.products = products;
    AppState.coupons = coupons;
    AppState.loadPersistedState();
    AppState.updateCounters();
    AppState.startAnnouncementCountdown();
    AppState.bindSearch();

    // Deep link from the confirmation screen.
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    const phone = params.get("phone");
    if (id) document.getElementById("lookupId").value = id;
    if (phone) document.getElementById("lookupPhone").value = phone;

    this.renderRecent();
    if (id && phone) this.lookup();

    document.getElementById("lookupForm").addEventListener("submit", e => {
      e.preventDefault();
      this.lookup();
    });
  },

  esc(text) {
    return Media.escapeHtml(text);
  },

  /** Order ids seen on this device, so returning customers don't have to type. */
  rememberOrder(order) {
    try {
      const list = JSON.parse(localStorage.getItem("rf_my_orders") || "[]");
      const next = [
        { id: order.id, phone: order.customer.phone, at: order.createdAt, total: order.pricing.total },
        ...list.filter(o => o.id !== order.id)
      ].slice(0, 8);
      localStorage.setItem("rf_my_orders", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  },

  renderRecent() {
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem("rf_my_orders") || "[]");
    } catch {
      /* ignore */
    }
    const container = document.getElementById("recentOrders");
    if (!container) return;

    if (!list.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
      <h4 class="rf-track-recent-title">Orders from this device</h4>
      <div class="rf-track-recent-list">
        ${list
          .map(
            o => `
          <button class="rf-track-recent-item" onclick="OrdersPage.quickLookup('${this.esc(o.id)}','${this.esc(
              o.phone
            )}')">
            <strong>${this.esc(o.id)}</strong>
            <span>${new Date(o.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              · ${AppState.formatPrice(o.total)}</span>
          </button>`
          )
          .join("")}
      </div>`;
  },

  quickLookup(id, phone) {
    document.getElementById("lookupId").value = id;
    document.getElementById("lookupPhone").value = phone;
    this.lookup();
  },

  async lookup() {
    const id = document.getElementById("lookupId").value.trim().toUpperCase();
    const phone = document.getElementById("lookupPhone").value.trim();
    const result = document.getElementById("trackResult");

    if (!id || !phone) {
      result.innerHTML = `<div class="rf-track-error">Please enter both your order ID and mobile number.</div>`;
      return;
    }

    result.innerHTML = `<div class="rf-track-loading">Looking up ${this.esc(id)}…</div>`;

    try {
      this.order = await RejiAPI.getOrder(id, phone);
      this.rememberOrder(this.order);
      this.renderOrder();
      this.renderRecent();
    } catch (e) {
      this.order = null;
      result.innerHTML = `
        <div class="rf-track-error">
          <strong>${this.esc(e.message)}</strong>
          <p>Double-check the order ID from your confirmation, or message us on WhatsApp and we'll find it.</p>
          <a class="btn btn-wine btn-sm" target="_blank" rel="noopener"
             href="${RejiAPI.waLink(
               RejiAPI.config.merchant.whatsappNumber,
               `Hi Reji Fashions, I need help tracking order ${id}.`
             )}">💬 Ask on WhatsApp</a>
        </div>`;
    }
  },

  /* ---------------------------------------------------------- render --- */

  paymentBanner(order) {
    const cfg = RejiAPI.config;

    if (order.paymentStatus === "pending") {
      let qr = "";
      let error = null;
      try {
        qr = UPI.qrSvg({
          vpa: cfg.merchant.upiVpa,
          payeeName: cfg.merchant.upiPayeeName || cfg.merchant.name,
          amount: order.pricing.total,
          note: `Reji ${order.id}`,
          ref: order.id.replace(/-/g, "")
        });
      } catch (e) {
        error = e.message;
      }

      return `
        <div class="rf-track-pay">
          <h3>⚡ Complete your payment</h3>
          <p>Your order is reserved but not yet paid. Scan below — the amount and reference are pre-filled.</p>
          ${
            error
              ? `<div class="rf-track-error">
                   <strong>Online payment isn't available right now</strong>
                   <p>Message us on WhatsApp and we'll share payment details for this order.</p>
                   <a class="btn btn-wine btn-sm" target="_blank" rel="noopener"
                      href="${RejiAPI.waLink(
                        cfg.merchant.whatsappNumber,
                        `Hi Reji Fashions, I'd like to pay for order ${order.id} (${AppState.formatPrice(
                          order.pricing.total
                        )}).`
                      )}">💬 Ask for payment details</a>
                 </div>`
              : `<div class="rf-track-pay-grid">
                   <div class="rf-upi-qr">${qr}</div>
                   <div>
                     <div class="rf-upi-amount">${AppState.formatPrice(order.pricing.total)}</div>
                     <div class="rf-upi-payee">to ${this.esc(cfg.merchant.upiPayeeName)}</div>
                     <div class="rf-upi-vpa">${this.esc(cfg.merchant.upiVpa)}</div>
                     ${
                       UPI.isMobile()
                         ? `<div class="rf-upi-app-row">${UPI.appLinks({
                             vpa: cfg.merchant.upiVpa,
                             payeeName: cfg.merchant.upiPayeeName || cfg.merchant.name,
                             amount: order.pricing.total,
                             note: `Reji ${order.id}`,
                             ref: order.id.replace(/-/g, "")
                           })
                             .map(
                               app =>
                                 `<a class="rf-upi-app" style="--app:${app.color}" href="${app.url}">
                                    <span class="rf-upi-app-dot">${app.glyph}</span>${app.label}</a>`
                             )
                             .join("")}</div>`
                         : ""
                     }
                   </div>
                 </div>

                 <div class="rf-upi-confirm">
                   <div class="rf-field">
                     <label for="trackUtr">UPI reference / UTR number</label>
                     <input type="text" id="trackUtr" inputmode="numeric" maxlength="24" placeholder="12-digit number">
                   </div>
                   <div class="rf-field">
                     <label for="trackProof">Screenshot <span class="rf-optional">(optional)</span></label>
                     <input type="file" id="trackProof" accept="image/*" onchange="OrdersPage.attachProof(this)">
                     <div id="trackProofPreview" class="rf-proof-preview"></div>
                   </div>
                   <button class="btn btn-wine" id="trackConfirmBtn" onclick="OrdersPage.confirmPayment()">
                     I've paid ${AppState.formatPrice(order.pricing.total)}
                   </button>
                 </div>`
          }
        </div>`;
    }

    if (order.paymentStatus === "submitted") {
      return `
        <div class="rf-track-banner rf-track-banner--info">
          <strong>⏳ Verifying your payment</strong>
          <p>We've received your confirmation${
            order.payment.upiRef ? ` (UTR <strong>${this.esc(order.payment.upiRef)}</strong>)` : ""
          } and are matching it against our bank. You'll get a WhatsApp message once it clears.</p>
        </div>`;
    }

    if (order.paymentStatus === "verified") {
      return `
        <div class="rf-track-banner rf-track-banner--ok">
          <strong>✅ Payment verified</strong>
          <p>${AppState.formatPrice(order.pricing.total)} received${
            order.payment.verifiedAt
              ? ` on ${new Date(order.payment.verifiedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short"
                })}`
              : ""
          }. Your order is in production.</p>
        </div>`;
    }

    if (order.paymentStatus === "failed") {
      return `
        <div class="rf-track-banner rf-track-banner--warn">
          <strong>⚠️ We couldn't trace your payment</strong>
          <p>${this.esc(order.payment.failureReason || "Not found in our bank statement.")}
             Please re-check the UTR or message us — if money left your account we'll sort it out.</p>
          <a class="btn btn-wine btn-sm" target="_blank" rel="noopener"
             href="${RejiAPI.waLink(
               RejiAPI.config.merchant.whatsappNumber,
               `Hi Reji Fashions, my payment for order ${order.id} shows as not found. I paid ${AppState.formatPrice(
                 order.pricing.total
               )}${order.payment.upiRef ? ` with UTR ${order.payment.upiRef}` : ""}.`
             )}">💬 Sort this out on WhatsApp</a>
        </div>`;
    }

    return `
      <div class="rf-track-banner rf-track-banner--ok">
        <strong>💵 Cash on delivery</strong>
        <p>Keep ${AppState.formatPrice(order.pricing.total)} ready when your parcel arrives.</p>
      </div>`;
  },

  timeline(order) {
    const stages = [
      { key: "placed", icon: "🧾", label: "Order placed" },
      { key: "confirmed", icon: "✅", label: "Confirmed" },
      { key: "tailoring", icon: "✂️", label: "Tailoring" },
      { key: "quality_check", icon: "🔍", label: "Quality check" },
      { key: "packed", icon: "📦", label: "Packed" },
      { key: "shipped", icon: "🚚", label: "Shipped" },
      { key: "delivered", icon: "🏠", label: "Delivered" }
    ];
    const currentIndex = stages.findIndex(s => s.key === order.orderStatus);

    if (order.orderStatus === "cancelled") {
      return `<div class="rf-track-banner rf-track-banner--warn"><strong>This order was cancelled.</strong></div>`;
    }

    return `
      <div class="rf-timeline-track rf-timeline-track--wide">
        ${stages
          .map((stage, i) => {
            const state = i < currentIndex ? "completed" : i === currentIndex ? "current" : "";
            return `
            <div class="rf-timeline-node ${state}">
              <div class="rf-node-dot">${state === "completed" ? "✓" : stage.icon}</div>
              <span class="rf-node-label">${stage.label}</span>
            </div>`;
          })
          .join("")}
      </div>`;
  },

  renderOrder() {
    const order = this.order;
    const cfg = RejiAPI.config;
    const result = document.getElementById("trackResult");

    result.innerHTML = `
      <article class="rf-track-card">
        <header class="rf-track-head">
          <div>
            <span class="rf-badge rf-badge-gold">${this.esc(order.id)}</span>
            <h2>${this.esc(RejiAPI.ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus)}</h2>
            <p>Placed ${new Date(order.createdAt).toLocaleString("en-IN")}</p>
          </div>
          <div class="rf-track-total">
            <span>Order total</span>
            <strong>${AppState.formatPrice(order.pricing.total)}</strong>
          </div>
        </header>

        ${this.paymentBanner(order)}
        ${this.timeline(order)}

        <section class="rf-track-section">
          <h3>Items</h3>
          <div class="rf-track-items">
            ${order.items
              .map(item => {
                const product = AppState.products.find(p => p.id === item.id) || item;
                return `
              <div class="rf-track-item">
                <div class="rf-track-item-thumb">${Media.thumb(product)}</div>
                <div>
                  <strong>${this.esc(item.name)}</strong>
                  <span>Size ${this.esc(item.size)} · Qty ${item.quantity}</span>
                  ${item.customNotes ? `<em>✂️ ${this.esc(item.customNotes)}</em>` : ""}
                </div>
                <div class="rf-track-item-price">${AppState.formatPrice(item.price * item.quantity)}</div>
              </div>`;
              })
              .join("")}
          </div>
        </section>

        <section class="rf-track-section rf-track-two-col">
          <div>
            <h3>Delivering to</h3>
            <p class="rf-track-address">
              ${this.esc(order.customer.name)}<br>
              ${this.esc(order.customer.address)}<br>
              ${this.esc(order.customer.city)} ${this.esc(order.customer.pincode)}<br>
              ${this.esc(order.customer.phone)}
            </p>
          </div>
          <div>
            <h3>Payment</h3>
            <p class="rf-track-address">
              Method: <strong>${order.paymentMethod === "cod" ? "Cash on delivery" : "UPI"}</strong><br>
              Status: <strong>${this.esc(RejiAPI.PAYMENT_STATUS_LABELS[order.paymentStatus])}</strong><br>
              ${order.payment.upiRef ? `UTR: ${this.esc(order.payment.upiRef)}<br>` : ""}
              Subtotal ${AppState.formatPrice(order.pricing.subtotal)}
              ${order.pricing.discount ? ` · Discount -${AppState.formatPrice(order.pricing.discount)}` : ""}
              · Delivery ${order.pricing.shipping === 0 ? "FREE" : AppState.formatPrice(order.pricing.shipping)}
            </p>
          </div>
        </section>

        <section class="rf-track-section">
          <h3>Activity</h3>
          <ol class="rf-track-events">
            ${(order.events || [])
              .slice()
              .reverse()
              .map(
                event => `
              <li>
                <span class="rf-track-event-time">${new Date(event.at).toLocaleString("en-IN")}</span>
                <strong>${this.esc(event.label)}</strong>
                ${event.note ? `<em>${this.esc(event.note)}</em>` : ""}
              </li>`
              )
              .join("")}
          </ol>
        </section>

        <footer class="rf-track-actions">
          <a class="btn btn-wine btn-sm" target="_blank" rel="noopener"
             href="${RejiAPI.waLink(
               cfg.merchant.whatsappNumber,
               `Hi Reji Fashions, I have a question about order ${order.id}.`
             )}">💬 Message us about this order</a>
          <button class="btn btn-outline btn-sm" onclick="window.print()">🖨️ Print</button>
          <a class="btn btn-outline btn-sm" href="index.html#catalog">Continue shopping</a>
        </footer>
      </article>`;
  },

  async attachProof(input) {
    const file = input.files?.[0];
    const preview = document.getElementById("trackProofPreview");
    if (!file || !preview) return;
    try {
      const bitmap = await ImageStudio.loadImage(file);
      const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      this.proofDataUrl = canvas.toDataURL("image/jpeg", 0.75);
      preview.innerHTML = `<img src="${this.proofDataUrl}" alt="Payment screenshot preview">`;
    } catch (e) {
      UIInteractions.showToast(`Could not read that image: ${e.message}`);
    }
  },

  async confirmPayment() {
    const ref = (document.getElementById("trackUtr")?.value || "").replace(/[^\w]/g, "");
    if (!ref && !this.proofDataUrl) {
      UIInteractions.showToast("Please enter the UPI reference number, or attach a screenshot");
      return;
    }

    const button = document.getElementById("trackConfirmBtn");
    if (button) {
      button.disabled = true;
      button.textContent = "Sending…";
    }

    try {
      const response = await RejiAPI.claimPayment(this.order.id, {
        upiRef: ref,
        payerNote: "",
        proofImage: this.proofDataUrl
      });
      this.order = response.order;
      this.proofDataUrl = null;
      this.renderOrder();
      UIInteractions.showToast("✅ Thank you — we're verifying your payment now.");
    } catch (e) {
      UIInteractions.showToast(`⚠️ ${e.message}`);
      if (button) {
        button.disabled = false;
        button.textContent = `I've paid ${AppState.formatPrice(this.order.pricing.total)}`;
      }
    }
  }
};

window.OrdersPage = OrdersPage;
document.addEventListener("DOMContentLoaded", () => OrdersPage.init());
