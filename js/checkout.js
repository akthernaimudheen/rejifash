/**
 * Reji Fashions - Checkout & UPI payment flow.
 *
 * Three screens: Delivery -> Pay -> Confirmed.
 *
 * The important design decision is the order of operations. The order record is
 * created BEFORE the customer pays, not after. That means:
 *
 *   - a customer who scans the QR and then loses signal still exists in the
 *     admin dashboard as "awaiting payment" and can be chased on WhatsApp,
 *     instead of silently disappearing;
 *   - the UPI transaction note carries the real order id, so a payment landing
 *     in the bank statement can always be matched back to an order;
 *   - the shop owner gets the WhatsApp alert the moment intent is shown.
 *
 * Payment itself is honest about what it can and cannot know. A static UPI QR
 * has no callback, so the customer confirms with their UTR and the shop owner
 * verifies against the bank before the order moves to Confirmed.
 */

const CheckoutEngine = {
  step: 1,
  paymentMethod: "upi",
  order: null,
  whatsapp: null,
  quote: null,
  countdownTimer: null,
  proofDataUrl: null,
  busy: false,

  /* -------------------------------------------------------------- open --- */

  async openCheckoutModal() {
    if (AppState.cart.length === 0) {
      UIInteractions.showToast("Your shopping bag is empty!");
      return;
    }

    AppState.closeCartDrawer();
    this.step = 1;
    this.order = null;
    this.proofDataUrl = null;
    this.whatsapp = null;

    const modal = document.getElementById("checkoutModal");
    if (modal) modal.classList.add("active");
    document.body.style.overflow = "hidden";

    await this.refreshQuote();
    this.render();
  },

  closeCheckoutModal() {
    const modal = document.getElementById("checkoutModal");
    if (modal) modal.classList.remove("active");
    document.body.style.overflow = "";
    this.stopCountdown();

    // Leaving the confirmation screen should return to a clean storefront.
    if (this.step === 3) {
      this.step = 1;
      this.order = null;
    }
  },

  async refreshQuote() {
    try {
      this.quote = await RejiAPI.quote(AppState.cartPayload(), AppState.appliedCoupon);
    } catch (e) {
      this.quote = RejiAPI.computePricing(
        AppState.cartPayload(),
        AppState.appliedCoupon,
        AppState.products,
        AppState.coupons
      );
      console.warn("[checkout] quote fell back to local pricing:", e.message);
    }
    return this.quote;
  },

  /* ------------------------------------------------------------ render --- */

  render() {
    const body = document.getElementById("checkoutModalBody");
    const header = document.getElementById("checkoutStepsHeader");
    if (!body) return;

    if (header) {
      header.querySelectorAll(".rf-step-item").forEach((item, idx) => {
        item.classList.toggle("active", idx + 1 === this.step);
        item.classList.toggle("done", idx + 1 < this.step);
      });
    }

    if (this.step === 1) body.innerHTML = this.renderDeliveryStep();
    else if (this.step === 2) body.innerHTML = this.renderPaymentStep();
    else body.innerHTML = this.renderConfirmationStep();

    body.scrollTop = 0;
    if (this.step === 1) this.restoreSavedAddress();
    if (this.step === 2 && this.paymentMethod === "upi" && this.order) this.mountUpiPanel();
  },

  money(value) {
    return AppState.formatPrice(value);
  },

  renderSummaryCard(actionHtml) {
    const q = this.quote;
    if (!q) return "";
    return `
      <aside class="rf-checkout-summary">
        <h4 class="rf-summary-title">Order Summary</h4>
        <div class="rf-summary-items">
          ${q.items
            .map(
              item => `
            <div class="rf-summary-item">
              <span class="rf-summary-item-name">
                ${Media.escapeHtml(item.name)}
                <em>Size ${Media.escapeHtml(item.size)} · Qty ${item.quantity}</em>
                ${item.customNotes ? `<em class="rf-summary-custom"><i class=ico-scissors></i> Custom fit</em>` : ""}
              </span>
              <strong>${this.money(item.lineTotal)}</strong>
            </div>`
            )
            .join("")}
        </div>

        <div class="rf-bill-summary">
          <div class="rf-bill-row"><span>Subtotal</span><span>${this.money(q.pricing.subtotal)}</span></div>
          ${
            q.pricing.discount > 0
              ? `<div class="rf-bill-row rf-bill-row--save"><span>Discount${
                  q.coupon ? ` (${q.coupon})` : ""
                }</span><span>-${this.money(q.pricing.discount)}</span></div>`
              : ""
          }
          <div class="rf-bill-row">
            <span>Delivery</span>
            <span class="${q.pricing.shipping === 0 ? "rf-free" : ""}">${
              q.pricing.shipping === 0 ? "FREE" : this.money(q.pricing.shipping)
            }</span>
          </div>
          <div class="rf-bill-row total"><span>Total Payable</span><span>${this.money(q.pricing.total)}</span></div>
        </div>
        ${actionHtml || ""}
      </aside>`;
  },

  /* ----------------------------------------------------------- step 1 --- */

  renderDeliveryStep() {
    return `
      <div class="rf-checkout-grid">
        <section>
          <h3 class="rf-checkout-heading">Delivery details</h3>
          <p class="rf-checkout-sub">We'll send order updates to this mobile number on WhatsApp.</p>

          <div class="rf-form-grid">
            <div class="rf-field">
              <label for="shipName">Full name *</label>
              <input type="text" id="shipName" autocomplete="name" placeholder="e.g. Priya Sharma">
            </div>
            <div class="rf-field">
              <label for="shipPhone">Mobile number *</label>
              <input type="tel" id="shipPhone" autocomplete="tel" inputmode="numeric" placeholder="10-digit mobile">
            </div>
            <div class="rf-field">
              <label for="shipPincode">PIN code *</label>
              <input type="text" id="shipPincode" maxlength="6" inputmode="numeric" autocomplete="postal-code"
                     placeholder="560001" oninput="CheckoutEngine.checkPincode()">
            </div>
            <div class="rf-field">
              <label for="shipCity">City / State</label>
              <input type="text" id="shipCity" autocomplete="address-level2" placeholder="Bengaluru, Karnataka">
            </div>
            <div class="rf-field rf-field--full">
              <label for="shipAddress">Complete address *</label>
              <textarea id="shipAddress" rows="2" autocomplete="street-address"
                        placeholder="House / flat no., building, street, landmark"></textarea>
            </div>
            <div class="rf-field rf-field--full">
              <label for="shipEmail">Email <span class="rf-optional">(optional — for the invoice)</span></label>
              <input type="email" id="shipEmail" autocomplete="email" placeholder="you@example.com">
            </div>
            <div class="rf-field rf-field--full">
              <label for="shipNotes">Note for the tailor <span class="rf-optional">(optional)</span></label>
              <input type="text" id="shipNotes" placeholder="e.g. deliver after 6pm, gift wrap please">
            </div>
          </div>

          <div id="pincodeResult" class="rf-pincode-result"></div>

          <label class="rf-save-address">
            <input type="checkbox" id="saveAddress" checked>
            <span>Remember these details on this device for faster checkout</span>
          </label>
        </section>

        ${this.renderSummaryCard(`
          <button class="btn btn-wine btn-lg rf-summary-cta" onclick="CheckoutEngine.goToPayment()">
            Continue to payment →
          </button>
          <p class="rf-summary-note"><i class=ico-lock></i> You'll review everything before paying.</p>
        `)}
      </div>`;
  },

  restoreSavedAddress() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem("rf_address") || "{}");
    } catch {
      /* ignore */
    }
    const map = {
      shipName: saved.name,
      shipPhone: saved.phone,
      shipPincode: saved.pincode,
      shipCity: saved.city,
      shipAddress: saved.address,
      shipEmail: saved.email
    };
    for (const [id, value] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el && value) el.value = value;
    }
    if (saved.pincode) this.checkPincode();
  },

  checkPincode() {
    const pin = document.getElementById("shipPincode")?.value.trim() || "";
    const target = document.getElementById("pincodeResult");
    if (!target) return;

    if (!pin) {
      target.innerHTML = "";
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      target.innerHTML = `<span class="rf-inline-warn">Enter a valid 6-digit PIN code</span>`;
      return;
    }

    // Dispatch is next working day; delivery estimate is metro-vs-rest by the
    // first digit of the PIN, which is how Indian postal regions are grouped.
    const metro = /^[15678]/.test(pin);
    const days = metro ? 3 : 5;
    const eta = new Date(Date.now() + days * 86400000);
    target.innerHTML = `<span class="rf-inline-ok">✓ Delivers by ${eta.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short"
    })}</span>`;
  },

  collectCustomer() {
    const get = id => document.getElementById(id)?.value.trim() || "";
    return {
      name: get("shipName"),
      phone: get("shipPhone"),
      pincode: get("shipPincode"),
      city: get("shipCity"),
      address: get("shipAddress"),
      email: get("shipEmail"),
      notes: get("shipNotes")
    };
  },

  validateCustomer(c) {
    if (c.name.length < 2) return "Please enter the full name";
    if (c.phone.replace(/\D/g, "").length < 10) return "Please enter a valid 10-digit mobile number";
    if (!/^\d{6}$/.test(c.pincode)) return "Please enter a valid 6-digit PIN code";
    if (c.address.length < 10) return "Please enter the complete street address";
    return null;
  },

  async goToPayment() {
    const customer = this.collectCustomer();
    const error = this.validateCustomer(customer);
    if (error) {
      UIInteractions.showToast(error);
      return;
    }

    if (document.getElementById("saveAddress")?.checked) {
      try {
        localStorage.setItem("rf_address", JSON.stringify(customer));
      } catch {
        /* private mode */
      }
    }

    this.customer = customer;
    await this.refreshQuote();
    this.step = 2;
    this.render();
  },

  /* ----------------------------------------------------------- step 2 --- */

  renderPaymentStep() {
    const cfg = RejiAPI.config;
    const total = this.quote?.pricing.total || 0;
    const codAvailable = cfg.store.codEnabled && total <= cfg.store.codMaxOrderValue;

    return `
      <div class="rf-checkout-grid">
        <section>
          <button class="rf-back-link" onclick="CheckoutEngine.backToDelivery()">← Delivery details</button>
          <h3 class="rf-checkout-heading">Payment</h3>
          <p class="rf-checkout-sub">
            Delivering to <strong>${Media.escapeHtml(this.customer.name)}</strong>,
            ${Media.escapeHtml(this.customer.address)}, ${Media.escapeHtml(this.customer.pincode)}
          </p>

          <div class="rf-pay-methods">
            <label class="rf-pay-method ${this.paymentMethod === "upi" ? "selected" : ""}">
              <input type="radio" name="payMethod" ${this.paymentMethod === "upi" ? "checked" : ""}
                     onchange="CheckoutEngine.selectPaymentMethod('upi')">
              <span class="rf-pay-method-body">
                <strong><i class=ico-bolt></i> UPI — Scan &amp; Pay</strong>
                <em>Google Pay · PhonePe · Paytm · BHIM · any UPI app</em>
              </span>
              <span class="rf-pay-badge">Recommended</span>
            </label>

            <label class="rf-pay-method ${this.paymentMethod === "cod" ? "selected" : ""} ${
              codAvailable ? "" : "disabled"
            }">
              <input type="radio" name="payMethod" ${this.paymentMethod === "cod" ? "checked" : ""}
                     ${codAvailable ? "" : "disabled"}
                     onchange="CheckoutEngine.selectPaymentMethod('cod')">
              <span class="rf-pay-method-body">
                <strong><i class=ico-cash></i> Cash on Delivery</strong>
                <em>${
                  codAvailable
                    ? "Pay the courier at your doorstep"
                    : `Not available above ${this.money(cfg.store.codMaxOrderValue)}`
                }</em>
              </span>
            </label>
          </div>

          <div id="paymentPanel" class="rf-payment-panel">
            ${this.paymentMethod === "cod" ? this.renderCodPanel() : this.renderUpiPlaceholder()}
          </div>
        </section>

        ${this.renderSummaryCard("")}
      </div>`;
  },

  backToDelivery() {
    this.stopCountdown();
    this.step = 1;
    this.render();
  },

  selectPaymentMethod(method) {
    if (this.paymentMethod === method) return;
    this.paymentMethod = method;
    this.stopCountdown();
    this.render();
  },

  renderCodPanel() {
    return `
      <div class="rf-cod-panel">
        <div class="rf-cod-icon"><i class=ico-cash></i></div>
        <h4>Cash on Delivery</h4>
        <p>Pay ${this.money(this.quote.pricing.total)} in cash — or scan the courier's UPI QR — when your parcel arrives.</p>
        <button class="btn btn-wine btn-lg" onclick="CheckoutEngine.placeOrder()" id="codPlaceBtn">
          Place order · ${this.money(this.quote.pricing.total)}
        </button>
      </div>`;
  },

  renderUpiPlaceholder() {
    return `
      <div class="rf-upi-intro">
        <h4>Pay ${this.money(this.quote.pricing.total)} by UPI</h4>
        <ol class="rf-upi-steps">
          <li>We create your order and show a QR with the exact amount already filled in.</li>
          <li>Scan it with any UPI app and pay.</li>
          <li>Enter the UPI reference number so we can match it — you're done.</li>
        </ol>
        <button class="btn btn-wine btn-lg" onclick="CheckoutEngine.placeOrder()" id="upiStartBtn">
          Generate payment QR →
        </button>
        <p class="rf-upi-legal">
          Your order is saved before payment, so nothing is lost if the app closes mid-way.
        </p>
      </div>`;
  },

  /* ------------------------------------------------------ place order --- */

  async placeOrder() {
    if (this.busy) return;
    this.busy = true;

    const button = document.getElementById(this.paymentMethod === "cod" ? "codPlaceBtn" : "upiStartBtn");
    const original = button?.innerHTML;
    if (button) {
      button.disabled = true;
      button.innerHTML = "Placing your order…";
    }

    try {
      const response = await RejiAPI.placeOrder({
        customer: this.customer,
        items: AppState.cartPayload(),
        coupon: AppState.appliedCoupon,
        paymentMethod: this.paymentMethod
      });

      this.order = response.order;
      this.whatsapp = response.whatsapp;

      // The bag has done its job; the order record owns the items now.
      AppState.clearCart();

      if (this.paymentMethod === "cod") {
        this.step = 3;
        this.render();
        UIInteractions.showToast(`<i class=ico-sparkle></i> Order <strong>${this.order.id}</strong> placed!`);
      } else {
        // Stay on step 2 and swap the panel for the live QR.
        const panel = document.getElementById("paymentPanel");
        if (panel) panel.innerHTML = this.renderUpiPanel();
        this.mountUpiPanel();
        UIInteractions.showToast(`Order <strong>${this.order.id}</strong> reserved — complete the payment`);
      }
    } catch (e) {
      UIInteractions.showToast(`<i class=ico-alert></i> ${e.message}`);
      if (button) {
        button.disabled = false;
        button.innerHTML = original;
      }
    } finally {
      this.busy = false;
    }
  },

  /* -------------------------------------------------------- UPI panel --- */

  upiOptions() {
    const cfg = RejiAPI.config;
    return {
      vpa: cfg.merchant.upiVpa,
      payeeName: cfg.merchant.upiPayeeName || cfg.merchant.name,
      amount: this.order.pricing.total,
      note: `Reji ${this.order.id}`,
      ref: this.order.id.replace(/-/g, "")
    };
  },

  renderUpiPanel() {
    const cfg = RejiAPI.config;
    const options = this.upiOptions();
    const total = this.order.pricing.total;

    let qr;
    let vpaError = null;
    try {
      qr = UPI.qrSvg(options);
    } catch (e) {
      vpaError = e.message;
    }

    if (vpaError) {
      // Never surface the raw validation error — the shopper did nothing wrong
      // and "" is not a valid UPI ID means nothing to them.
      console.warn("[checkout] UPI unavailable:", vpaError);
      return `
        <div class="rf-upi-error">
          <h4>Online payment isn't available right now</h4>
          <p>
            Good news — your order <strong>${this.order.id}</strong> is saved and we've been notified.
            Send it to us on WhatsApp and we'll share payment details straight away.
          </p>
          <a class="btn btn-wine" target="_blank" rel="noopener"
             href="${this.whatsapp?.customerLink || "#"}"><i class=ico-chat></i> Send order on WhatsApp</a>
          <button class="rf-text-link" onclick="CheckoutEngine.skipToConfirmation()">
            Show my order details
          </button>
        </div>`;
    }

    const appButtons = UPI.isMobile()
      ? `<div class="rf-upi-apps">
           <span class="rf-upi-apps-label">Or pay directly in</span>
           <div class="rf-upi-app-row">
             ${UPI.appLinks(options)
               .map(
                 app =>
                   `<a class="rf-upi-app" style="--app:${app.color}" href="${app.url}">
                      <span class="rf-upi-app-dot">${app.glyph}</span>${app.label}
                    </a>`
               )
               .join("")}
           </div>
         </div>`
      : `<p class="rf-upi-desktop-hint">On your phone? Open this page there to pay with one tap.</p>`;

    return `
      <div class="rf-upi-panel">
        <div class="rf-upi-order-chip">Order <strong>${this.order.id}</strong></div>

        <div class="rf-upi-qr-wrap">
          <div class="rf-upi-qr">${qr}</div>
          <div class="rf-upi-qr-meta">
            <div class="rf-upi-amount">${this.money(total)}</div>
            <div class="rf-upi-payee">to ${Media.escapeHtml(options.payeeName)}</div>
            <button class="rf-copy-chip" onclick="CheckoutEngine.copyText('${Media.escapeHtml(
              cfg.merchant.upiVpa
            )}', this)">
              ${Media.escapeHtml(cfg.merchant.upiVpa)} <span>Copy</span>
            </button>
            <div class="rf-upi-timer" id="upiTimer"></div>
          </div>
        </div>

        <p class="rf-upi-instruction">
          Scan with any UPI app. The amount and the reference <strong>${this.order.id}</strong>
          are already filled in — please don't change them, that's how we match your payment.
        </p>

        ${appButtons}

        <div class="rf-upi-confirm">
          <h5>Paid already? Confirm it here</h5>
          <p class="rf-upi-confirm-sub">
            Enter the UPI reference / UTR number from your payment app so we can match it against the bank.
          </p>
          <div class="rf-field">
            <label for="upiRefInput">UPI reference / UTR number</label>
            <input type="text" id="upiRefInput" inputmode="numeric" maxlength="24"
                   placeholder="12-digit number from your UPI app">
          </div>
          <div class="rf-field">
            <label for="upiProofInput">Payment screenshot <span class="rf-optional">(optional, speeds up verification)</span></label>
            <input type="file" id="upiProofInput" accept="image/*" onchange="CheckoutEngine.attachProof(this)">
            <div id="upiProofPreview" class="rf-proof-preview"></div>
          </div>
          <button class="btn btn-wine btn-lg" id="confirmPaidBtn" onclick="CheckoutEngine.confirmPayment()">
            I've paid ${this.money(total)}
          </button>
          <button class="rf-text-link" onclick="CheckoutEngine.skipToConfirmation()">
            I'll pay later — just show my order
          </button>
        </div>
      </div>`;
  },

  mountUpiPanel() {
    this.startCountdown();
  },

  startCountdown() {
    this.stopCountdown();
    const minutes = RejiAPI.config.store.upiWindowMinutes || 15;
    let remaining = minutes * 60;
    const el = () => document.getElementById("upiTimer");
    if (!el()) return;

    const tick = () => {
      const target = el();
      if (!target) return this.stopCountdown();
      if (remaining <= 0) {
        target.innerHTML = `<span class="rf-timer-expired">QR expired —
          <button class="rf-text-link" onclick="CheckoutEngine.regenerateQr()">show a fresh one</button></span>`;
        return this.stopCountdown();
      }
      const m = Math.floor(remaining / 60);
      const s = String(remaining % 60).padStart(2, "0");
      target.innerHTML = `<span class="rf-timer"><i class=ico-clock></i> Valid for ${m}:${s}</span>`;
      remaining--;
    };

    tick();
    this.countdownTimer = setInterval(tick, 1000);
  },

  stopCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  },

  regenerateQr() {
    const panel = document.getElementById("paymentPanel");
    if (!panel || !this.order) return;
    panel.innerHTML = this.renderUpiPanel();
    this.mountUpiPanel();
  },

  async copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      const label = button.querySelector("span");
      if (label) {
        label.textContent = "Copied ✓";
        setTimeout(() => (label.textContent = "Copy"), 1800);
      }
    } catch {
      UIInteractions.showToast(`UPI ID: <strong>${text}</strong>`);
    }
  },

  /** Downscale the screenshot in the browser — no need to ship a 4 MB PNG. */
  async attachProof(input) {
    const file = input.files?.[0];
    const preview = document.getElementById("upiProofPreview");
    if (!file || !preview) return;

    try {
      const bitmap = await ImageStudio.loadImage(file);
      const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      this.proofDataUrl = canvas.toDataURL("image/jpeg", 0.75);
      preview.innerHTML = `<img src="${this.proofDataUrl}" alt="Payment screenshot preview">
        <button class="rf-text-link" onclick="CheckoutEngine.clearProof()">Remove</button>`;
    } catch (e) {
      UIInteractions.showToast(`Could not read that image: ${e.message}`);
    }
  },

  clearProof() {
    this.proofDataUrl = null;
    const preview = document.getElementById("upiProofPreview");
    const input = document.getElementById("upiProofInput");
    if (preview) preview.innerHTML = "";
    if (input) input.value = "";
  },

  async confirmPayment() {
    const refInput = document.getElementById("upiRefInput");
    const ref = (refInput?.value || "").replace(/[^\w]/g, "");

    if (!ref && !this.proofDataUrl) {
      UIInteractions.showToast("Please enter the UPI reference number, or attach a screenshot");
      refInput?.focus();
      return;
    }
    if (ref && ref.length < 6) {
      UIInteractions.showToast("That reference looks too short — it's usually 12 digits");
      refInput?.focus();
      return;
    }

    const button = document.getElementById("confirmPaidBtn");
    if (button) {
      button.disabled = true;
      button.textContent = "Sending…";
    }

    try {
      const response = await RejiAPI.claimPayment(this.order.id, {
        upiRef: ref,
        payerNote: this.customer?.notes || "",
        proofImage: this.proofDataUrl
      });
      this.order = response.order;
      if (response.whatsapp) this.whatsapp = { ...this.whatsapp, ...response.whatsapp };
      this.stopCountdown();
      this.step = 3;
      this.render();
    } catch (e) {
      UIInteractions.showToast(`<i class=ico-alert></i> ${e.message}`);
      if (button) {
        button.disabled = false;
        button.textContent = `I've paid ${this.money(this.order.pricing.total)}`;
      }
    }
  },

  skipToConfirmation() {
    this.stopCountdown();
    this.step = 3;
    this.render();
  },

  /* ----------------------------------------------------------- step 3 --- */

  renderConfirmationStep() {
    const order = this.order;
    if (!order) return `<div class="rf-checkout-empty">No active order.</div>`;

    const cfg = RejiAPI.config;
    const awaitingPayment = order.paymentStatus === "pending";
    const claimed = order.paymentStatus === "submitted";

    const statusBlock = awaitingPayment
      ? `<div class="rf-confirm-status rf-confirm-status--warn">
           <strong>Payment still pending</strong>
           <p>Your order is reserved. Pay by UPI to <strong>${Media.escapeHtml(
             cfg.merchant.upiVpa
           )}</strong> quoting <strong>${order.id}</strong>, then confirm it on the tracking page.</p>
         </div>`
      : claimed
      ? `<div class="rf-confirm-status rf-confirm-status--ok">
           <strong>Payment received — verifying</strong>
           <p>Thank you! We're matching ${
             order.payment.upiRef ? `UTR <strong>${Media.escapeHtml(order.payment.upiRef)}</strong>` : "your payment"
           } against our bank. You'll get a WhatsApp confirmation shortly — usually within a couple of hours.</p>
         </div>`
      : `<div class="rf-confirm-status rf-confirm-status--ok">
           <strong>Cash on Delivery confirmed</strong>
           <p>Keep ${this.money(order.pricing.total)} ready when the parcel arrives.</p>
         </div>`;

    return `
      <div class="rf-confirmation">
        <div class="rf-success-badge">✓</div>
        <span class="rf-badge rf-badge-gold">Order ${order.id}</span>
        <h2 class="rf-confirm-title">Thank you, ${Media.escapeHtml(order.customer.name.split(" ")[0])}!</h2>
        <p class="rf-confirm-sub">
          We've saved your order and alerted the boutique. Updates go to
          <strong>${Media.escapeHtml(order.customer.phone)}</strong>.
        </p>

        ${statusBlock}

        <div class="rf-confirm-actions">
          <a class="btn btn-wine" target="_blank" rel="noopener" href="${
            this.whatsapp?.customerLink || RejiAPI.waLink(cfg.merchant.whatsappNumber, RejiAPI.customerMessage(order))
          }">
            <i class=ico-chat></i> Send order on WhatsApp
          </a>
          <a class="btn btn-outline" href="orders.html?id=${encodeURIComponent(
            order.id
          )}&phone=${encodeURIComponent(order.customer.phone)}">
            <i class=ico-package></i> Track this order
          </a>
          <button class="btn btn-outline" onclick="CheckoutEngine.printInvoice()"><i class=ico-printer></i> Invoice</button>
        </div>

        ${this.renderTimeline(order)}
        ${this.renderInvoice(order)}

        <button class="btn btn-primary" onclick="CheckoutEngine.closeCheckoutModal()">Continue shopping</button>
      </div>`;
  },

  renderTimeline(order) {
    const stages = [
      { key: "placed", icon: "<i class=ico-receipt></i>", label: "Order Placed" },
      { key: "confirmed", icon: "<i class=ico-check></i>", label: "Payment Confirmed" },
      { key: "tailoring", icon: "<i class=ico-scissors></i>", label: "Tailoring" },
      { key: "packed", icon: "<i class=ico-package></i>", label: "Packed" },
      { key: "shipped", icon: "<i class=ico-truck></i>", label: "Shipped" },
      { key: "delivered", icon: "<i class=ico-home></i>", label: "Delivered" }
    ];
    const order_ = ["placed", "confirmed", "tailoring", "quality_check", "packed", "shipped", "delivered"];
    const currentIndex = order_.indexOf(order.orderStatus);

    return `
      <div class="rf-timeline-track">
        ${stages
          .map(stage => {
            const idx = order_.indexOf(stage.key);
            const state = idx < currentIndex ? "completed" : idx === currentIndex ? "current" : "";
            return `
              <div class="rf-timeline-node ${state}">
                <div class="rf-node-dot">${state === "completed" ? "✓" : stage.icon}</div>
                <span class="rf-node-label">${stage.label}</span>
              </div>`;
          })
          .join("")}
      </div>`;
  },

  renderInvoice(order) {
    const cfg = RejiAPI.config;
    return `
      <div id="printableInvoice" class="rf-invoice">
        <div class="rf-invoice-head">
          <div>
            <h4>${Media.escapeHtml(cfg.merchant.name.toUpperCase())}</h4>
            <div class="rf-invoice-meta">Tax Invoice · GSTIN ${Media.escapeHtml(cfg.merchant.gstin)}</div>
            <div class="rf-invoice-meta">${Media.escapeHtml(cfg.merchant.address)}</div>
          </div>
          <div class="rf-invoice-head-right">
            <div><strong>${order.id}</strong></div>
            <div class="rf-invoice-meta">${new Date(order.createdAt).toLocaleString("en-IN")}</div>
          </div>
        </div>

        <div class="rf-invoice-address">
          <strong>Bill to</strong><br>
          ${Media.escapeHtml(order.customer.name)}<br>
          ${Media.escapeHtml(order.customer.address)}<br>
          ${Media.escapeHtml(order.customer.city)} ${Media.escapeHtml(order.customer.pincode)}<br>
          ${Media.escapeHtml(order.customer.phone)}
        </div>

        <table class="rf-invoice-table">
          <thead>
            <tr><th>Item</th><th>Size</th><th>Qty</th><th>Amount</th></tr>
          </thead>
          <tbody>
            ${order.items
              .map(
                item => `
              <tr>
                <td>${Media.escapeHtml(item.name)}${
                  item.customNotes ? `<br><em>${Media.escapeHtml(item.customNotes)}</em>` : ""
                }</td>
                <td>${Media.escapeHtml(item.size)}</td>
                <td>${item.quantity}</td>
                <td>${this.money(item.price * item.quantity)}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>

        <div class="rf-invoice-totals">
          <div><span>Subtotal</span><span>${this.money(order.pricing.subtotal)}</span></div>
          ${
            order.pricing.discount > 0
              ? `<div><span>Discount${order.coupon ? ` (${order.coupon})` : ""}</span><span>-${this.money(
                  order.pricing.discount
                )}</span></div>`
              : ""
          }
          <div><span>Delivery</span><span>${
            order.pricing.shipping === 0 ? "FREE" : this.money(order.pricing.shipping)
          }</span></div>
          <div class="rf-invoice-grand">
            <span>Total (${order.paymentMethod.toUpperCase()})</span>
            <span>${this.money(order.pricing.total)}</span>
          </div>
        </div>
      </div>`;
  },

  printInvoice() {
    document.body.classList.add("rf-printing-invoice");
    window.print();
    setTimeout(() => document.body.classList.remove("rf-printing-invoice"), 500);
  }
};

window.CheckoutEngine = CheckoutEngine;
