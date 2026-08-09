/**
 * Reji Fashions - Admin dashboard.
 *
 * Built around the one job that actually matters each morning: work through
 * the orders whose payment is claimed but not yet verified, confirm them
 * against the bank, and push them down the tailoring pipeline. Everything else
 * — catalog, photography, settings — sits behind that.
 */

const Admin = {
  data: null,
  tab: "orders",
  filter: "attention",
  openOrderId: null,
  editingProduct: null,
  studio: { file: null, result: null, shot: "front" },
  refreshTimer: null,

  /* ------------------------------------------------------------- boot --- */

  async init() {
    await RejiAPI.init();
    this.bindLogin();

    if (RejiAPI.isAdminSignedIn()) {
      try {
        await this.load();
        this.showDashboard();
        return;
      } catch {
        RejiAPI.adminLogout();
      }
    }
    this.showLogin();
  },

  bindLogin() {
    document.getElementById("loginForm").addEventListener("submit", async e => {
      e.preventDefault();
      const error = document.getElementById("loginError");
      const button = e.target.querySelector("button[type=submit]");
      error.textContent = "";
      button.disabled = true;
      button.textContent = "Signing in…";

      try {
        await RejiAPI.adminLogin(
          document.getElementById("adminUser").value.trim(),
          document.getElementById("adminPass").value
        );
        await this.load();
        this.showDashboard();
      } catch (err) {
        error.textContent = err.message;
      } finally {
        button.disabled = false;
        button.textContent = "Sign in";
      }
    });
  },

  showLogin() {
    document.getElementById("adminLogin").style.display = "flex";
    document.getElementById("adminApp").style.display = "none";
    const note = document.getElementById("loginMode");
    note.textContent =
      RejiAPI.mode === "local"
        ? "Offline mode — reading orders stored in this browser. Start `node server/server.js` for the live dashboard."
        : "Connected to the Reji Fashions server.";
  },

  showDashboard() {
    document.getElementById("adminLogin").style.display = "none";
    document.getElementById("adminApp").style.display = "block";
    this.render();
    // Poll so a phone order placed while the dashboard is open shows up.
    if (!this.refreshTimer) {
      this.refreshTimer = setInterval(() => this.load().then(() => this.render()).catch(() => {}), 20000);
    }
  },

  signOut() {
    RejiAPI.adminLogout();
    clearInterval(this.refreshTimer);
    this.refreshTimer = null;
    location.reload();
  },

  async load() {
    this.data = await RejiAPI.adminOverview();
    return this.data;
  },

  async reload() {
    await this.load();
    this.render();
  },

  esc(text) {
    return Media.escapeHtml(text);
  },

  money(value) {
    return `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
  },

  toast(message) {
    UIInteractions.showToast(message);
  },

  /* ----------------------------------------------------------- render --- */

  render() {
    if (!this.data) return;
    document.getElementById("adminStats").innerHTML = this.renderStats();
    document.getElementById("adminTabs").innerHTML = this.renderTabs();
    const body = document.getElementById("adminBody");

    if (this.tab === "orders") body.innerHTML = this.renderOrders();
    else if (this.tab === "products") body.innerHTML = this.renderProducts();
    else if (this.tab === "studio") body.innerHTML = this.renderStudio();
    else body.innerHTML = this.renderSettings();

    document.getElementById("adminModeChip").textContent =
      this.data.local ? "Offline · browser storage" : "Live · server";
    document.getElementById("adminModeChip").className = `rf-admin-chip ${
      this.data.local ? "rf-admin-chip--warn" : "rf-admin-chip--ok"
    }`;
  },

  renderStats() {
    const s = this.data.stats;
    const tiles = [
      { label: "Needs verification", value: s.awaitingVerification, accent: s.awaitingVerification > 0 },
      { label: "Awaiting payment", value: s.awaitingPayment },
      { label: "To dispatch", value: s.toDispatch },
      { label: "Orders today", value: s.todayOrders },
      { label: "Total orders", value: s.totalOrders },
      { label: "Revenue collected", value: this.money(s.revenue) },
      { label: "Average order", value: this.money(s.averageOrderValue) }
    ];
    return tiles
      .map(
        t => `
      <div class="rf-admin-stat ${t.accent ? "rf-admin-stat--alert" : ""}">
        <span class="rf-admin-stat-value">${t.value}</span>
        <span class="rf-admin-stat-label">${t.label}</span>
      </div>`
      )
      .join("");
  },

  renderTabs() {
    const tabs = [
      { key: "orders", label: "Orders" },
      { key: "products", label: "Catalog" },
      { key: "studio", label: "Image studio" },
      { key: "settings", label: "Settings" }
    ];
    return tabs
      .map(
        t =>
          `<button class="rf-admin-tab ${this.tab === t.key ? "active" : ""}"
                   onclick="Admin.setTab('${t.key}')">${t.label}</button>`
      )
      .join("");
  },

  setTab(tab) {
    this.tab = tab;
    this.editingProduct = null;
    this.render();
  },

  /* ----------------------------------------------------------- orders --- */

  filteredOrders() {
    const orders = this.data.orders || [];
    switch (this.filter) {
      case "attention":
        return orders.filter(o => o.paymentStatus === "submitted" || o.paymentStatus === "pending");
      case "verify":
        return orders.filter(o => o.paymentStatus === "submitted");
      case "dispatch":
        return orders.filter(o =>
          ["confirmed", "tailoring", "quality_check", "packed"].includes(o.orderStatus)
        );
      case "shipped":
        return orders.filter(o => ["shipped", "delivered"].includes(o.orderStatus));
      default:
        return orders;
    }
  },

  renderOrders() {
    const filters = [
      { key: "attention", label: "Needs action" },
      { key: "verify", label: "Verify payment" },
      { key: "dispatch", label: "To dispatch" },
      { key: "shipped", label: "Shipped" },
      { key: "all", label: "All orders" }
    ];

    const orders = this.filteredOrders();

    return `
      <div class="rf-admin-toolbar">
        <div class="rf-admin-filters">
          ${filters
            .map(
              f =>
                `<button class="rf-admin-filter ${this.filter === f.key ? "active" : ""}"
                         onclick="Admin.setFilter('${f.key}')">${f.label}</button>`
            )
            .join("")}
        </div>
        <button class="btn btn-outline btn-sm" onclick="Admin.reload()">↻ Refresh</button>
      </div>

      ${
        orders.length
          ? `<div class="rf-admin-orders">${orders.map(o => this.renderOrderCard(o)).join("")}</div>`
          : `<div class="rf-admin-empty">
               <div class="rf-empty-icon">✨</div>
               <h3>Nothing here right now</h3>
               <p>New orders appear automatically — this view refreshes every 20 seconds.</p>
             </div>`
      }`;
  },

  setFilter(filter) {
    this.filter = filter;
    this.render();
  },

  paymentPill(order) {
    const map = {
      pending: "warn",
      submitted: "alert",
      verified: "ok",
      failed: "bad",
      cod: "info",
      refunded: "info"
    };
    return `<span class="rf-pill rf-pill--${map[order.paymentStatus] || "info"}">${this.esc(
      this.data.labels.payment[order.paymentStatus] || order.paymentStatus
    )}</span>`;
  },

  renderOrderCard(order) {
    const isOpen = this.openOrderId === order.id;
    const urgent = order.paymentStatus === "submitted";

    return `
      <article class="rf-admin-order ${urgent ? "urgent" : ""} ${isOpen ? "open" : ""}">
        <button class="rf-admin-order-head" onclick="Admin.toggleOrder('${order.id}')">
          <div class="rf-admin-order-id">
            <strong>${this.esc(order.id)}</strong>
            <span>${new Date(order.createdAt).toLocaleString("en-IN")}</span>
          </div>
          <div class="rf-admin-order-customer">
            <strong>${this.esc(order.customer.name)}</strong>
            <span>${this.esc(order.customer.phone)} · ${this.esc(order.customer.city || order.customer.pincode)}</span>
          </div>
          <div class="rf-admin-order-status">
            ${this.paymentPill(order)}
            <span class="rf-pill rf-pill--muted">${this.esc(
              this.data.labels.order[order.orderStatus] || order.orderStatus
            )}</span>
          </div>
          <div class="rf-admin-order-total">${this.money(order.pricing.total)}</div>
          <span class="rf-admin-order-caret">${isOpen ? "▲" : "▼"}</span>
        </button>

        ${isOpen ? this.renderOrderDetail(order) : ""}
      </article>`;
  },

  toggleOrder(id) {
    this.openOrderId = this.openOrderId === id ? null : id;
    this.render();
  },

  renderOrderDetail(order) {
    const waCustomer = RejiAPI.waLink(
      order.customer.phone,
      `Hi ${order.customer.name}, this is Reji Fashions about your order ${order.id}.`
    );

    return `
      <div class="rf-admin-order-body">
        <div class="rf-admin-order-cols">
          <section>
            <h4>Items</h4>
            <ul class="rf-admin-items">
              ${order.items
                .map(
                  item => `
                <li>
                  <strong>${this.esc(item.name)}</strong>
                  <span>Size ${this.esc(item.size)} · Qty ${item.quantity} · ${this.money(
                    item.price * item.quantity
                  )}</span>
                  ${item.customNotes ? `<em>✂️ ${this.esc(item.customNotes)}</em>` : ""}
                </li>`
                )
                .join("")}
            </ul>

            <div class="rf-admin-totals">
              <div><span>Subtotal</span><span>${this.money(order.pricing.subtotal)}</span></div>
              ${
                order.pricing.discount
                  ? `<div><span>Discount${order.coupon ? ` (${order.coupon})` : ""}</span><span>-${this.money(
                      order.pricing.discount
                    )}</span></div>`
                  : ""
              }
              <div><span>Delivery</span><span>${
                order.pricing.shipping === 0 ? "FREE" : this.money(order.pricing.shipping)
              }</span></div>
              <div class="rf-admin-grand"><span>Total</span><span>${this.money(order.pricing.total)}</span></div>
            </div>
          </section>

          <section>
            <h4>Delivery</h4>
            <p class="rf-admin-address">
              ${this.esc(order.customer.name)}<br>
              ${this.esc(order.customer.address)}<br>
              ${this.esc(order.customer.city)} ${this.esc(order.customer.pincode)}<br>
              📞 ${this.esc(order.customer.phone)}
              ${order.customer.email ? `<br>✉️ ${this.esc(order.customer.email)}` : ""}
            </p>
            ${order.customer.notes ? `<p class="rf-admin-note">📝 ${this.esc(order.customer.notes)}</p>` : ""}
            <div class="rf-admin-copy-row">
              <button class="btn btn-outline btn-sm" onclick="Admin.copyAddress('${order.id}')">Copy address</button>
              <a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${waCustomer}">💬 WhatsApp customer</a>
            </div>
          </section>

          <section>
            <h4>Payment</h4>
            <p class="rf-admin-address">
              Method: <strong>${order.paymentMethod === "cod" ? "Cash on delivery" : "UPI"}</strong><br>
              Status: ${this.paymentPill(order)}<br>
              UTR: <strong>${this.esc(order.payment.upiRef || "— not provided —")}</strong><br>
              ${order.payment.claimedAt ? `Claimed ${new Date(order.payment.claimedAt).toLocaleString("en-IN")}<br>` : ""}
              ${
                order.payment.verifiedAt
                  ? `Verified ${new Date(order.payment.verifiedAt).toLocaleString("en-IN")}`
                  : ""
              }
            </p>

            ${
              order.payment.proofImage
                ? `<a class="rf-admin-proof" href="${this.esc(order.payment.proofImage)}" target="_blank" rel="noopener">
                     <img src="${this.esc(order.payment.proofImage)}" alt="Payment screenshot">
                     <span>View screenshot</span>
                   </a>`
                : ""
            }

            ${
              order.paymentStatus === "submitted" || order.paymentStatus === "pending"
                ? `<div class="rf-admin-verify">
                     <p class="rf-admin-verify-hint">
                       Check your bank or UPI app for ${this.money(order.pricing.total)}${
                         order.payment.upiRef ? ` with UTR ${this.esc(order.payment.upiRef)}` : ""
                       }.
                     </p>
                     <div class="rf-admin-actions">
                       <button class="btn btn-emerald btn-sm" onclick="Admin.setPayment('${order.id}','verified')">
                         ✅ Payment received
                       </button>
                       <button class="btn btn-outline btn-sm" onclick="Admin.setPayment('${order.id}','failed')">
                         ⚠️ Not found
                       </button>
                     </div>
                   </div>`
                : order.paymentStatus === "verified"
                ? `<button class="btn btn-outline btn-sm" onclick="Admin.setPayment('${order.id}','refunded')">
                     ↩︎ Mark refunded
                   </button>`
                : ""
            }
          </section>
        </div>

        <section class="rf-admin-pipeline">
          <h4>Move this order along</h4>
          <div class="rf-admin-pipeline-row">
            ${Object.entries(this.data.labels.order)
              .filter(([key]) => key !== "placed")
              .map(
                ([key, label]) => `
              <button class="rf-admin-stage ${order.orderStatus === key ? "current" : ""}
                             ${key === "cancelled" ? "danger" : ""}"
                      onclick="Admin.setStatus('${order.id}','${key}')">${label}</button>`
              )
              .join("")}
          </div>
        </section>

        <section class="rf-admin-timeline">
          <h4>History</h4>
          <ol>
            ${(order.events || [])
              .slice()
              .reverse()
              .map(
                event => `
              <li>
                <span>${new Date(event.at).toLocaleString("en-IN")}</span>
                <strong>${this.esc(event.label)}</strong>
                ${event.note ? `<em>${this.esc(event.note)}</em>` : ""}
              </li>`
              )
              .join("")}
          </ol>
          ${
            (order.notifications || []).length
              ? `<details class="rf-admin-notifications">
                   <summary>WhatsApp alerts (${order.notifications.length})</summary>
                   <ul>
                     ${order.notifications
                       .map(
                         n => `<li>
                           ${new Date(n.at).toLocaleString("en-IN")} · ${this.esc(n.kind || "alert")} ·
                           ${n.sent ? "✅ sent automatically" : n.error ? `⚠️ ${this.esc(n.error)}` : "link only"}
                           ${n.link ? ` · <a href="${this.esc(n.link)}" target="_blank" rel="noopener">open in WhatsApp</a>` : ""}
                         </li>`
                       )
                       .join("")}
                   </ul>
                 </details>`
              : ""
          }
        </section>
      </div>`;
  },

  copyAddress(orderId) {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return;
    const text = [
      order.customer.name,
      order.customer.address,
      `${order.customer.city} ${order.customer.pincode}`,
      order.customer.phone
    ].join("\n");
    navigator.clipboard.writeText(text).then(
      () => this.toast("Address copied — paste it straight into the courier form"),
      () => this.toast("Could not copy automatically")
    );
  },

  async setPayment(orderId, status) {
    let reason = null;
    if (status === "failed") {
      reason = prompt("What should we tell the customer?", "We couldn't find this payment in our bank statement.");
      if (reason === null) return;
    }
    if (status === "refunded" && !confirm("Mark this payment as refunded?")) return;

    try {
      const response = await RejiAPI.adminSetPayment(orderId, status, reason);
      await this.reload();
      if (response.customerLink) {
        this.showFollowUp(
          status === "verified" ? "Payment verified ✅" : "Marked as not found",
          "Send the customer a WhatsApp update?",
          response.customerLink
        );
      }
    } catch (e) {
      this.toast(`⚠️ ${e.message}`);
    }
  },

  async setStatus(orderId, status) {
    const note =
      status === "shipped"
        ? prompt("Courier and tracking number (optional):", "")
        : null;
    if (status === "cancelled" && !confirm("Cancel this order?")) return;

    try {
      const response = await RejiAPI.adminSetStatus(orderId, status, note || undefined);
      await this.reload();
      if (response.customerLink) {
        this.showFollowUp(
          this.data.labels.order[status],
          "Let the customer know on WhatsApp?",
          response.customerLink
        );
      }
    } catch (e) {
      this.toast(`⚠️ ${e.message}`);
    }
  },

  /** A one-tap prompt so status changes actually reach the customer. */
  showFollowUp(title, message, link) {
    const existing = document.getElementById("rfFollowUp");
    if (existing) existing.remove();

    const node = document.createElement("div");
    node.id = "rfFollowUp";
    node.className = "rf-followup";
    node.innerHTML = `
      <div>
        <strong>${this.esc(title)}</strong>
        <span>${this.esc(message)}</span>
      </div>
      <a class="btn btn-wine btn-sm" href="${this.esc(link)}" target="_blank" rel="noopener"
         onclick="document.getElementById('rfFollowUp').remove()">💬 Send</a>
      <button class="rf-followup-close" onclick="document.getElementById('rfFollowUp').remove()">✕</button>`;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 15000);
  },

  /* --------------------------------------------------------- products --- */

  renderProducts() {
    if (this.editingProduct) return this.renderProductEditor();

    const products = this.data.products || [];
    return `
      ${this.renderPersistenceWarning()}

      <div class="rf-admin-toolbar">
        <div class="rf-admin-hint">
          ${products.filter(p => !Media.hasPhotos(p)).length} of ${products.length} designs still use
          illustrated artwork. Upload real photos through the Image Studio to replace them.
        </div>
        <div class="rf-admin-actions">
          <button class="btn btn-outline btn-sm" onclick="Admin.exportCatalog()">⬇ Export catalog</button>
          <button class="btn btn-wine btn-sm" onclick="Admin.newProduct()">+ New design</button>
        </div>
      </div>

      <div class="rf-admin-products">
        ${products
          .map(
            p => `
          <div class="rf-admin-product">
            <div class="rf-admin-product-thumb">${Media.thumb(p)}</div>
            <div class="rf-admin-product-info">
              <strong>${this.esc(p.name)}</strong>
              <span>${this.esc(p.id)} · ${this.esc(p.fabric)} · ${this.money(p.price)}</span>
              <span class="rf-admin-product-flags">
                ${Media.hasPhotos(p)
                  ? `<span class="rf-pill rf-pill--ok">${Media.gallery(p).length} photo${
                      Media.gallery(p).length === 1 ? "" : "s"
                    }</span>`
                  : `<span class="rf-pill rf-pill--warn">illustration only</span>`}
                <span class="rf-pill rf-pill--muted">stock ${p.stock}</span>
                ${p.active === false ? `<span class="rf-pill rf-pill--bad">hidden</span>` : ""}
              </span>
            </div>
            <div class="rf-admin-product-actions">
              <button class="btn btn-outline btn-sm" onclick="Admin.editProduct('${p.id}')">Edit</button>
              <button class="btn btn-gold btn-sm" onclick="Admin.openStudioFor('${p.id}')">📷 Photos</button>
            </div>
          </div>`
          )
          .join("")}
      </div>`;
  },

  /**
   * Warn when photographs are being written somewhere that will be destroyed.
   *
   * Render's free plan (and most container hosts without a mounted volume)
   * wipe the filesystem on every deploy and every idle spin-down. Uploading a
   * catalog of photography there and assuming it is safe is a genuinely painful
   * way to find that out, so say it before the work is lost rather than after.
   */
  renderPersistenceWarning() {
    if (this.data.local) return "";
    if (/^(localhost|127\.0\.0\.1)/.test(location.hostname)) return "";

    // Photographs are already safe — say so, and be clear about what still isn't.
    if (this.data.config?.storage?.provider === "github") {
      const repo = this.data.config.storage.github?.repository || "your repository";
      return `
        <div class="rf-admin-banner rf-admin-banner--ok">
          <strong>Photographs are being committed to ${this.esc(repo)}.</strong>
          <p>
            Uploads and catalog changes are permanent — they survive every deploy.
            Orders are not: this host still has no disk, so treat the WhatsApp alert on
            your phone as the durable copy of an order until you move to a VPS.
          </p>
        </div>`;
    }

    return `
      <div class="rf-admin-banner rf-admin-banner--warn">
        <strong>Photographs uploaded here will not survive the next deploy.</strong>
        <p>
          This host has no persistent disk, so anything written at runtime — uploaded
          photos and catalog edits — is wiped when the service redeploys or sleeps.
          The free fix is to commit them to your GitHub repository instead:
          <strong>Settings → Where photographs are stored</strong>.
        </p>
        <p>
          Or do the photography on your own machine: run <code>node server/server.js</code>
          locally, upload there, press <strong>Export catalog</strong>, save it as
          <code>catalog.json</code> and commit that along with <code>assets/products</code>.
        </p>
      </div>`;
  },

  /** Download the catalog as the committable catalog.json seed file. */
  exportCatalog() {
    const catalog = (this.data.products || []).map(p => ({ ...p }));
    const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "catalog.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    const withPhotos = catalog.filter(p => (p.media || []).length).length;
    this.toast(
      `Exported ${catalog.length} designs (${withPhotos} with photos). ` +
        `Save as <strong>catalog.json</strong> in the project root and commit it.`
    );
  },

  newProduct() {
    this.editingProduct = {
      id: `RF-N${Date.now().toString().slice(-4)}`,
      name: "",
      tagline: "",
      category: "kurtis",
      subCategory: "",
      price: 1999,
      originalPrice: 2499,
      discount: "20% OFF",
      rating: 4.8,
      reviewsCount: 0,
      color: "",
      colorHex: "#5A1322",
      accentHex: "#D4AF37",
      fabric: "",
      fabricCategory: "Silk",
      occasion: "Festive",
      sizes: ["S", "M", "L", "XL"],
      stock: 10,
      badge: "New Arrival",
      isNew: true,
      featured: false,
      description: "",
      details: {},
      inTheBox: "",
      media: [],
      highlights: [],
      active: true
    };
    this.render();
  },

  editProduct(id) {
    this.editingProduct = JSON.parse(JSON.stringify(this.data.products.find(p => p.id === id)));
    this.render();
  },

  renderProductEditor() {
    const p = this.editingProduct;
    const field = (label, key, type = "text", extra = "") => `
      <div class="rf-field">
        <label>${label}</label>
        <input type="${type}" value="${this.esc(p[key] ?? "")}" ${extra}
               oninput="Admin.editingProduct['${key}'] = this.${type === "number" ? "valueAsNumber" : "value"}">
      </div>`;

    return `
      <div class="rf-admin-editor">
        <div class="rf-admin-toolbar">
          <button class="rf-text-link" onclick="Admin.editingProduct=null; Admin.render()">← Back to catalog</button>
          <div>
            <button class="btn btn-outline btn-sm" onclick="Admin.deleteProduct()">Delete</button>
            <button class="btn btn-wine btn-sm" onclick="Admin.saveProduct()">Save design</button>
          </div>
        </div>

        <div class="rf-admin-editor-grid">
          ${field("Product code", "id")}
          ${field("Name", "name")}
          ${field("Tagline", "tagline")}
          <div class="rf-field">
            <label>Category</label>
            <select onchange="Admin.editingProduct.category = this.value">
              <option value="kurtis" ${p.category === "kurtis" ? "selected" : ""}>Kurtis</option>
              <option value="churidars" ${p.category === "churidars" ? "selected" : ""}>Churidars</option>
              <option value="fusion" ${p.category === "fusion" ? "selected" : ""}>Indo-western</option>
            </select>
          </div>
          ${field("Sub-category", "subCategory")}
          ${field("Fabric", "fabric")}
          <div class="rf-field">
            <label>Fabric group (filter)</label>
            <select onchange="Admin.editingProduct.fabricCategory = this.value">
              ${["Silk", "Cotton", "Velvet", "Georgette", "Organza", "Silk Blend"]
                .map(f => `<option ${p.fabricCategory === f ? "selected" : ""}>${f}</option>`)
                .join("")}
            </select>
          </div>
          ${field("Occasion", "occasion")}
          ${field("Colour name", "color")}
          ${field("Price (₹)", "price", "number")}
          ${field("MRP (₹)", "originalPrice", "number")}
          ${field("Discount label", "discount")}
          ${field("Stock", "stock", "number")}
          ${field("Badge", "badge")}
          <div class="rf-field">
            <label>Sizes (comma separated)</label>
            <input type="text" value="${this.esc((p.sizes || []).join(", "))}"
                   oninput="Admin.editingProduct.sizes = this.value.split(',').map(s=>s.trim()).filter(Boolean)">
          </div>
          <div class="rf-field">
            <label>Colour swatch</label>
            <div class="rf-swatch-row">
              <input type="color" value="${this.esc(p.colorHex)}" oninput="Admin.editingProduct.colorHex = this.value">
              <input type="color" value="${this.esc(p.accentHex)}" oninput="Admin.editingProduct.accentHex = this.value">
              <span>base · accent</span>
            </div>
          </div>
          <div class="rf-field rf-field--full">
            <label>Description</label>
            <textarea rows="4" oninput="Admin.editingProduct.description = this.value">${this.esc(
              p.description
            )}</textarea>
          </div>
          <div class="rf-field rf-field--full">
            <label>What's in the box</label>
            <input type="text" value="${this.esc(p.inTheBox)}" oninput="Admin.editingProduct.inTheBox = this.value">
          </div>
          <div class="rf-field rf-field--full">
            <label>Highlights (one per line — these are the bullets shoppers scan first)</label>
            <textarea rows="4" oninput="Admin.editingProduct.highlights = this.value.split('\\n').map(s=>s.trim()).filter(Boolean)">${this.esc(
              (p.highlights || []).join("\n")
            )}</textarea>
          </div>
          <div class="rf-field rf-field--full">
            <label>Specifications (one per line, as <code>Label: value</code>)</label>
            <textarea rows="6" oninput="Admin.updateDetails(this.value)">${this.esc(
              Object.entries(p.details || {})
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n")
            )}</textarea>
          </div>
          <div class="rf-field rf-field--full">
            <label class="rf-checkbox">
              <input type="checkbox" ${p.active !== false ? "checked" : ""}
                     onchange="Admin.editingProduct.active = this.checked">
              Visible in the storefront
            </label>
          </div>
        </div>

        <div class="rf-admin-media-manager">
          <h4>Photographs</h4>
          ${
            (p.media || []).length
              ? `<div class="rf-admin-media-grid">
                   ${p.media
                     .map(
                       (m, i) => `
                     <div class="rf-admin-media-item ${m.primary ? "primary" : ""}">
                       <img src="${this.esc(m.src)}" alt="">
                       <input type="text" value="${this.esc(m.caption || "")}" placeholder="Caption"
                              oninput="Admin.editingProduct.media[${i}].caption = this.value">
                       <input type="text" value="${this.esc(m.detail || "")}" placeholder="What this photo shows"
                              oninput="Admin.editingProduct.media[${i}].detail = this.value">
                       <div class="rf-admin-media-actions">
                         <button class="rf-text-link" onclick="Admin.makePrimary(${i})">
                           ${m.primary ? "★ Primary" : "Make primary"}
                         </button>
                         <button class="rf-text-link rf-danger" onclick="Admin.removeMedia(${i})">Remove</button>
                       </div>
                     </div>`
                     )
                     .join("")}
                 </div>`
              : `<p class="rf-admin-hint">No photographs yet — the storefront shows generated artwork for this design.</p>`
          }
          <button class="btn btn-gold btn-sm" onclick="Admin.openStudioFor('${p.id}')">📷 Add photos in the Image Studio</button>
        </div>
      </div>`;
  },

  updateDetails(text) {
    const details = {};
    text.split("\n").forEach(line => {
      const idx = line.indexOf(":");
      if (idx > 0) details[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    });
    this.editingProduct.details = details;
  },

  makePrimary(index) {
    this.editingProduct.media = this.editingProduct.media.map((m, i) => ({ ...m, primary: i === index }));
    this.render();
  },

  removeMedia(index) {
    this.editingProduct.media.splice(index, 1);
    this.render();
  },

  async saveProduct() {
    const p = this.editingProduct;
    if (!p.name.trim()) return this.toast("Please give the design a name");
    if (!p.id.trim()) return this.toast("Please give the design a product code");

    try {
      await RejiAPI.adminSaveProduct(p);
      this.editingProduct = null;
      await this.reload();
      this.toast("✅ Design saved");
    } catch (e) {
      this.toast(`⚠️ ${e.message}`);
    }
  },

  async deleteProduct() {
    if (!confirm(`Delete ${this.editingProduct.name}? This cannot be undone.`)) return;
    try {
      await RejiAPI.adminDeleteProduct(this.editingProduct.id);
      this.editingProduct = null;
      await this.reload();
      this.toast("Design deleted");
    } catch (e) {
      this.toast(`⚠️ ${e.message}`);
    }
  },

  /* ----------------------------------------------------- image studio --- */

  openStudioFor(productId) {
    this.studio = { file: null, result: null, shot: "front", productId };
    this.tab = "studio";
    this.editingProduct = null;
    this.render();
  },

  renderStudio() {
    const products = this.data.products || [];
    const s = this.studio;

    return `
      <div class="rf-studio">
        <div class="rf-studio-intro">
          <h3>Image studio</h3>
          <p>
            Drop in a photo straight off your phone. It gets straightened, cropped to the catalog's
            3:4 frame, colour-corrected, lifted onto a clean studio backdrop and exported at every
            size the site needs — so a quick shot on a bedsheet ends up looking like the rest of the shop.
            Nothing leaves your browser until you attach it.
          </p>
        </div>

        <div class="rf-studio-grid">
          <div class="rf-studio-controls">
            <div class="rf-field">
              <label for="studioProduct">Attach to design</label>
              <select id="studioProduct" onchange="Admin.studio.productId = this.value">
                ${products
                  .map(
                    p =>
                      `<option value="${this.esc(p.id)}" ${
                        s.productId === p.id ? "selected" : ""
                      }>${this.esc(p.name)}</option>`
                  )
                  .join("")}
              </select>
            </div>

            <div class="rf-field">
              <label for="studioFile">Raw photograph</label>
              <input type="file" id="studioFile" accept="image/*" onchange="Admin.studioLoad(this)">
            </div>

            <div class="rf-field">
              <label for="studioShot">What does this photo show?</label>
              <select id="studioShot" onchange="Admin.studio.shot = this.value; Admin.studioRefresh()">
                ${ImageStudio.SHOT_TYPES.map(
                  t => `<option value="${t.key}" ${s.shot === t.key ? "selected" : ""}>${t.label}</option>`
                ).join("")}
              </select>
            </div>

            <div class="rf-field">
              <label for="studioBackdrop">Backdrop</label>
              <select id="studioBackdrop" onchange="Admin.studioRefresh()">
                ${Object.entries(ImageStudio.BACKDROPS)
                  .map(([key, b]) => `<option value="${key}">${b.label}</option>`)
                  .join("")}
              </select>
            </div>

            <label class="rf-checkbox">
              <input type="checkbox" id="studioClean" checked onchange="Admin.studioRefresh()">
              Replace the background with a clean studio backdrop
            </label>
            <label class="rf-checkbox">
              <input type="checkbox" id="studioBalance" checked onchange="Admin.studioRefresh()">
              Correct white balance &amp; exposure
            </label>

            <div class="rf-field">
              <label for="studioThreshold">Subject sensitivity — <span id="studioThresholdVal">34</span></label>
              <input type="range" id="studioThreshold" min="12" max="70" value="34"
                     oninput="document.getElementById('studioThresholdVal').textContent=this.value; Admin.studioRefresh()">
              <span class="rf-field-hint">Lower keeps more of the photo; raise it if the backdrop isn't being removed cleanly.</span>
            </div>

            <div class="rf-field">
              <label for="studioSat">Colour richness — <span id="studioSatVal">1.06</span></label>
              <input type="range" id="studioSat" min="0.8" max="1.4" step="0.02" value="1.06"
                     oninput="document.getElementById('studioSatVal').textContent=this.value; Admin.studioRefresh()">
            </div>

            <div class="rf-field">
              <label for="studioCaption">Caption shown under the photo</label>
              <input type="text" id="studioCaption" placeholder="e.g. Front view — antique gold zari yoke">
            </div>
            <div class="rf-field">
              <label for="studioDetail">Longer description of what's in the photo</label>
              <textarea id="studioDetail" rows="2"
                        placeholder="e.g. Hand-embroidered zari yoke with keyhole mandarin collar, shot in daylight"></textarea>
            </div>

            <button class="btn btn-wine" id="studioAttachBtn" onclick="Admin.studioAttach()" ${
              s.result ? "" : "disabled"
            }>
              Attach to design
            </button>
          </div>

          <div class="rf-studio-preview">
            ${
              s.result
                ? `<div class="rf-studio-compare">
                     <figure>
                       <img src="${s.originalUrl}" alt="Original photo">
                       <figcaption>Original · ${s.result.meta.sourceWidth}×${s.result.meta.sourceHeight}</figcaption>
                     </figure>
                     <figure>
                       <img src="${s.result.outputs.main.dataUrl}" alt="Processed photo">
                       <figcaption>Catalog ready · ${s.result.outputs.main.width}×${s.result.outputs.main.height}</figcaption>
                     </figure>
                   </div>
                   <div class="rf-studio-meta">
                     <span class="rf-pill ${s.result.meta.subjectFound ? "rf-pill--ok" : "rf-pill--warn"}">
                       ${
                         s.result.meta.subjectFound
                           ? "Garment detected and centred"
                           : "Couldn't isolate the garment — using the full frame"
                       }
                     </span>
                     <span class="rf-pill rf-pill--muted">Detected colour ${s.result.colours.dominant}</span>
                     <span class="rf-swatch" style="background:${s.result.colours.dominant}"></span>
                     <span class="rf-swatch" style="background:${s.result.colours.accent}"></span>
                   </div>

                   ${this.renderBackdropVerdict(s.result.meta)}
                   <div class="rf-studio-sizes">
                     ${Object.entries(s.result.outputs)
                       .map(
                         ([key, out]) =>
                           `<div><img src="${out.dataUrl}" alt="${out.label}"><span>${out.label}<br>${out.width}×${out.height}</span></div>`
                       )
                       .join("")}
                   </div>`
                : `<div class="rf-studio-placeholder">
                     <div class="rf-empty-icon">📷</div>
                     <h4>Choose a photograph to begin</h4>
                     <p>Shoot the garment flat or on a hanger against a plain wall or bedsheet, in daylight, with the whole piece in frame. The studio does the rest.</p>
                     <ul>
                       <li>Plain, light background works best</li>
                       <li>Avoid direct flash — window light is ideal</li>
                       <li>Leave a little space around the garment</li>
                       <li>Shoot portrait, not landscape</li>
                     </ul>
                   </div>`
            }
            <div id="studioBusy" class="rf-studio-busy" hidden>Processing…</div>
          </div>
        </div>
      </div>`;
  },

  /**
   * Say plainly whether the backdrop actually got replaced. Silently handing
   * back a photo that looks the same as the original is the worst outcome —
   * the shop owner attaches it thinking it was cleaned up.
   */
  renderBackdropVerdict(meta) {
    if (!meta.options.cleanBackground) return "";

    if (meta.backdropRemovalWorked) {
      return `<div class="rf-studio-verdict rf-studio-verdict--ok">
                ✓ Background replaced — ${Math.round(meta.backdropRemoved * 100)}% of the frame
              </div>`;
    }

    return `<div class="rf-studio-verdict rf-studio-verdict--warn">
              <strong>The background could not be removed from this photo.</strong>
              <p>
                ${
                  meta.backdropBusy
                    ? `The background is too detailed to separate — a patterned curtain, furniture
                       or a cluttered room. Colour-matching can't tell that apart from the garment.`
                    : `Too little of the frame matched the backdrop, usually because the garment
                       colour is close to the wall behind it.`
                }
                Only ${Math.round(meta.backdropRemoved * 100)}% was replaced, so what you see on the
                right is essentially the original photo, just cropped and colour-corrected.
              </p>
              <p><strong>What helps:</strong> hang the garment against a plain light wall, bedsheet
                 or curtain with nothing else in frame, in daylight, and leave a little space around
                 it. Or raise <em>Subject sensitivity</em> and try again — and if the photo is fine
                 as it is, just untick background replacement.</p>
            </div>`;
  },

  studioOptions() {
    const backdrop = document.getElementById("studioBackdrop")?.value || "ivory";
    return {
      backdrop,
      cleanBackground: document.getElementById("studioClean")?.checked ?? true,
      whiteBalance: document.getElementById("studioBalance")?.checked ?? true,
      autoLevels: document.getElementById("studioBalance")?.checked ?? true,
      subjectThreshold: Number(document.getElementById("studioThreshold")?.value || 34),
      saturation: Number(document.getElementById("studioSat")?.value || 1.06)
    };
  },

  async studioLoad(input) {
    const file = input.files?.[0];
    if (!file) return;
    this.studio.file = file;
    if (this.studio.originalUrl) URL.revokeObjectURL(this.studio.originalUrl);
    this.studio.originalUrl = URL.createObjectURL(file);
    await this.studioRefresh();
  },

  async studioRefresh() {
    if (!this.studio.file) return;
    const busy = document.getElementById("studioBusy");
    if (busy) busy.hidden = false;

    // Keep the form values across the re-render.
    const caption = document.getElementById("studioCaption")?.value;
    const detail = document.getElementById("studioDetail")?.value;

    try {
      this.studio.result = await ImageStudio.process(this.studio.file, this.studioOptions());
      this.render();

      const product = this.data.products.find(p => p.id === this.studio.productId);
      const suggestion = ImageStudio.describeShot(this.studio.shot, product);
      const captionEl = document.getElementById("studioCaption");
      const detailEl = document.getElementById("studioDetail");
      if (captionEl) captionEl.value = caption || suggestion.caption;
      if (detailEl) detailEl.value = detail || suggestion.detail;
    } catch (e) {
      this.toast(`⚠️ ${e.message}`);
    } finally {
      const el = document.getElementById("studioBusy");
      if (el) el.hidden = true;
    }
  },

  async studioAttach() {
    const s = this.studio;
    if (!s.result) return;

    const product = this.data.products.find(p => p.id === s.productId);
    if (!product) return this.toast("Pick a design to attach this photo to");

    const button = document.getElementById("studioAttachBtn");
    if (button) {
      button.disabled = true;
      button.textContent = "Saving…";
    }

    try {
      // A modest source photo can crop smaller than the zoom target, in which
      // case both exports are the same pixels — don't store the file twice.
      const separateZoom = s.result.outputs.zoom.width > s.result.outputs.main.width;
      const main = await RejiAPI.adminUpload(s.result.outputs.main.dataUrl, `${product.id}-${s.shot}`);
      const zoom = separateZoom
        ? await RejiAPI.adminUpload(s.result.outputs.zoom.dataUrl, `${product.id}-${s.shot}-zoom`)
        : main;

      const suggestion = ImageStudio.describeShot(s.shot, product);
      const media = [...(product.media || [])];
      media.push({
        src: main.src,
        zoomSrc: zoom.src,
        shot: s.shot,
        caption: document.getElementById("studioCaption")?.value || suggestion.caption,
        detail: document.getElementById("studioDetail")?.value || suggestion.detail,
        alt: suggestion.alt,
        primary: media.length === 0
      });

      const updated = { ...product, media };
      // First photo also fixes the swatch colours to match the real garment.
      if (media.length === 1) {
        updated.colorHex = s.result.colours.dominant;
        updated.accentHex = s.result.colours.accent;
      }

      await RejiAPI.adminSaveProduct(updated);
      await this.reload();

      this.studio.file = null;
      this.studio.result = null;
      this.tab = "products";
      this.render();
      this.toast(`✅ Photo attached to ${product.name}`);
    } catch (e) {
      this.toast(`⚠️ ${e.message}`);
      if (button) {
        button.disabled = false;
        button.textContent = "Attach to design";
      }
    }
  },

  /* --------------------------------------------------------- settings --- */

  renderSettings() {
    const cfg = this.data.config;
    const provider = cfg.whatsapp?.provider || "link";

    return `
      <div class="rf-admin-settings">
        ${
          this.data.local
            ? `<div class="rf-admin-banner rf-admin-banner--warn">
                 Settings can only be saved when the server is running.
                 Start it with <code>node server/server.js</code>.
               </div>`
            : ""
        }

        <section class="rf-settings-card">
          <h3>💰 UPI payment</h3>
          <p class="rf-admin-hint">
            This is the account every customer QR pays into. Copy it exactly from your UPI app
            (Profile → UPI IDs). Get this wrong and money goes to the wrong place.
          </p>
          <div class="rf-field">
            <label for="setVpa">UPI ID (VPA)</label>
            <input type="text" id="setVpa" value="${this.esc(cfg.merchant.upiVpa)}" placeholder="name@bank">
            <span class="rf-field-hint" id="vpaHint"></span>
          </div>
          <div class="rf-field">
            <label for="setPayee">Payee name shown in the customer's app</label>
            <input type="text" id="setPayee" value="${this.esc(cfg.merchant.upiPayeeName)}">
          </div>
          <div class="rf-field">
            <label for="setGstin">GSTIN (printed on invoices)</label>
            <input type="text" id="setGstin" value="${this.esc(cfg.merchant.gstin)}">
          </div>
        </section>

        <section class="rf-settings-card">
          <h3>💬 WhatsApp alerts</h3>
          <div class="rf-field">
            <label for="setWaNumber">Shop WhatsApp number (country code + number)</label>
            <input type="text" id="setWaNumber" value="${this.esc(cfg.merchant.whatsappNumber)}">
          </div>

          <div class="rf-field">
            <label for="setWaProvider">How should alerts be delivered?</label>
            <select id="setWaProvider" onchange="Admin.toggleProviderFields(this.value)">
              <option value="link" ${provider === "link" ? "selected" : ""}>
                Manual — one-tap send links in this dashboard (no setup)
              </option>
              <option value="callmebot" ${provider === "callmebot" ? "selected" : ""}>
                CallMeBot — free automatic messages to your own number
              </option>
              <option value="cloud" ${provider === "cloud" ? "selected" : ""}>
                Meta WhatsApp Cloud API — official, needs a verified business
              </option>
              <option value="twilio" ${provider === "twilio" ? "selected" : ""}>
                Twilio WhatsApp
              </option>
            </select>
          </div>

          <div id="providerFields">${this.renderProviderFields(provider, cfg)}</div>

          <button class="btn btn-outline btn-sm" onclick="Admin.testWhatsApp()">Send a test message</button>
          <div id="waTestResult" class="rf-admin-hint"></div>
        </section>

        <section class="rf-settings-card">
          <h3>📷 Where photographs are stored</h3>
          <p class="rf-admin-hint">
            This host rebuilds its filesystem on every deploy, so photos saved to disk are lost.
            Committing them to your GitHub repository keeps them permanently, at no cost.
          </p>
          <div class="rf-field">
            <label for="setStorageProvider">Storage</label>
            <select id="setStorageProvider" onchange="Admin.toggleStorageFields(this.value)">
              <option value="local" ${cfg.storage?.provider !== "github" ? "selected" : ""}>
                Server disk — only safe with a persistent disk or on your own machine
              </option>
              <option value="github" ${cfg.storage?.provider === "github" ? "selected" : ""}>
                GitHub repository — free and permanent
              </option>
            </select>
          </div>
          <div id="storageFields">${this.renderStorageFields(cfg.storage?.provider, cfg)}</div>
          <button class="btn btn-outline btn-sm" onclick="Admin.testStorage()">Test connection</button>
          <div id="storageTestResult" class="rf-admin-hint"></div>
        </section>

        <section class="rf-settings-card">
          <h3>🖼️ Homepage hero</h3>
          <p class="rf-admin-hint">
            The large garment on the front page. Only designs with a real photograph can be
            chosen — anything still on illustrated artwork is skipped.
          </p>
          <div class="rf-field">
            <label for="setHeroProduct">Featured design</label>
            <select id="setHeroProduct">
              <option value="">Choose automatically (highest rated featured design)</option>
              ${(this.data.products || [])
                .filter(p => Media.hasPhotos(p))
                .map(
                  p =>
                    `<option value="${this.esc(p.id)}" ${
                      cfg.store.heroProductId === p.id ? "selected" : ""
                    }>${this.esc(p.name)}</option>`
                )
                .join("")}
            </select>
          </div>
        </section>

        <section class="rf-settings-card">
          <h3>🛍️ Store rules</h3>
          <div class="rf-settings-grid">
            <div class="rf-field">
              <label for="setFreeShip">Free delivery above (₹)</label>
              <input type="number" id="setFreeShip" value="${cfg.store.freeShippingThreshold}">
            </div>
            <div class="rf-field">
              <label for="setCodMax">Max order value for cash on delivery (₹)</label>
              <input type="number" id="setCodMax" value="${cfg.store.codMaxOrderValue}">
            </div>
            <div class="rf-field">
              <label for="setUpiWindow">UPI QR validity (minutes)</label>
              <input type="number" id="setUpiWindow" value="${cfg.store.upiWindowMinutes}">
            </div>
            <div class="rf-field">
              <label class="rf-checkbox">
                <input type="checkbox" id="setCodEnabled" ${cfg.store.codEnabled ? "checked" : ""}>
                Offer cash on delivery
              </label>
            </div>
          </div>
        </section>

        <section class="rf-settings-card">
          <h3>🔐 Admin password</h3>
          <div class="rf-field">
            <label for="setPassword">New password <span class="rf-optional">(leave blank to keep the current one)</span></label>
            <input type="password" id="setPassword" placeholder="At least 6 characters" autocomplete="new-password">
          </div>
        </section>

        <div class="rf-settings-actions">
          <button class="btn btn-wine" onclick="Admin.saveSettings()">Save settings</button>
          <button class="btn btn-outline" onclick="Admin.signOut()">Sign out</button>
        </div>
      </div>`;
  },

  renderStorageFields(provider, cfg) {
    if (provider !== "github") {
      return `<p class="rf-admin-hint">
        Photographs are written to the server's disk. Correct on a VPS or your own machine —
        but on a free container host they disappear on the next deploy.
      </p>`;
    }
    return `
      <div class="rf-field">
        <label for="setGithubRepo">Repository</label>
        <input type="text" id="setGithubRepo" placeholder="akthernaimudheen/rejifash"
               value="${this.esc(cfg.storage?.github?.repository || "")}">
      </div>
      <div class="rf-field">
        <label for="setGithubBranch">Branch</label>
        <input type="text" id="setGithubBranch" value="${this.esc(cfg.storage?.github?.branch || "main")}">
      </div>
      <div class="rf-field">
        <label for="setGithubToken">Access token</label>
        <input type="password" id="setGithubToken" autocomplete="off"
               value="${this.esc(cfg.storage?.github?.token || "")}">
        <span class="rf-field-hint">
          github.com → Settings → Developer settings → <strong>Fine-grained tokens</strong>.
          Give it access to this one repository only, with <strong>Contents: Read and write</strong>.
          Better still, set <code>GITHUB_TOKEN</code> in your host's environment variables so it
          never passes through this page.
        </span>
      </div>`;
  },

  toggleStorageFields(provider) {
    document.getElementById("storageFields").innerHTML = this.renderStorageFields(provider, this.data.config);
  },

  async testStorage() {
    const target = document.getElementById("storageTestResult");
    target.textContent = "Checking…";
    try {
      const data = await RejiAPI.adminTestStorage();
      target.innerHTML =
        data.provider === "github"
          ? `✅ Connected to <strong>${this.esc(data.result.repository)}</strong>
             (branch ${this.esc(data.result.branch)}). Photographs will be committed there.`
          : `Storage is set to the server disk. Nothing to test — but on this host, uploads will
             not survive a redeploy.`;
    } catch (e) {
      target.innerHTML = `⚠️ ${this.esc(e.message)}`;
    }
  },

  renderProviderFields(provider, cfg) {
    if (provider === "callmebot") {
      return `
        <div class="rf-field">
          <label for="setCallmebotKey">CallMeBot API key</label>
          <input type="text" id="setCallmebotKey" value="${this.esc(cfg.whatsapp?.callmebot?.apiKey || "")}">
          <span class="rf-field-hint">
            Send "I allow callmebot to send me messages" to +34 644 51 95 23 from your shop number.
            It replies with the key — paste it here.
          </span>
        </div>`;
    }
    if (provider === "cloud") {
      return `
        <div class="rf-field">
          <label for="setCloudPhoneId">Phone number ID</label>
          <input type="text" id="setCloudPhoneId" value="${this.esc(cfg.whatsapp?.cloud?.phoneNumberId || "")}">
        </div>
        <div class="rf-field">
          <label for="setCloudToken">Access token</label>
          <input type="password" id="setCloudToken" value="${this.esc(cfg.whatsapp?.cloud?.accessToken || "")}">
          <span class="rf-field-hint">
            Free-form messages only reach a number inside a 24-hour window; outside it, use an approved template.
          </span>
        </div>`;
    }
    if (provider === "twilio") {
      return `
        <div class="rf-field">
          <label for="setTwilioSid">Account SID</label>
          <input type="text" id="setTwilioSid" value="${this.esc(cfg.whatsapp?.twilio?.accountSid || "")}">
        </div>
        <div class="rf-field">
          <label for="setTwilioToken">Auth token</label>
          <input type="password" id="setTwilioToken" value="${this.esc(cfg.whatsapp?.twilio?.authToken || "")}">
        </div>
        <div class="rf-field">
          <label for="setTwilioFrom">From (WhatsApp sender)</label>
          <input type="text" id="setTwilioFrom" value="${this.esc(cfg.whatsapp?.twilio?.from || "")}">
        </div>`;
    }
    return `<p class="rf-admin-hint">
      Every order still produces a one-tap WhatsApp link in this dashboard and on the customer's
      confirmation screen — nothing is lost, it just isn't automatic.
    </p>`;
  },

  toggleProviderFields(provider) {
    document.getElementById("providerFields").innerHTML = this.renderProviderFields(provider, this.data.config);
  },

  async testWhatsApp() {
    const target = document.getElementById("waTestResult");
    target.textContent = "Sending…";
    try {
      const { result } = await RejiAPI.adminTestWhatsApp();
      target.innerHTML = result.sent
        ? `✅ Sent to +${this.esc(result.to)} via ${this.esc(result.provider)}. Check your WhatsApp.`
        : `${result.error ? `⚠️ ${this.esc(result.error)}. ` : ""}Open the message manually:
           <a href="${this.esc(result.link)}" target="_blank" rel="noopener">send test on WhatsApp</a>`;
    } catch (e) {
      target.textContent = `⚠️ ${e.message}`;
    }
  },

  async saveSettings() {
    const value = id => document.getElementById(id)?.value.trim();
    const vpa = value("setVpa");

    if (vpa && !UPI.isValidVpa(vpa)) {
      document.getElementById("vpaHint").innerHTML =
        `<span class="rf-danger">"${this.esc(vpa)}" doesn't look like a UPI ID (expected name@bank)</span>`;
      return;
    }

    const storageProvider = value("setStorageProvider");
    const provider = value("setWaProvider");
    const patch = {
      storage: {
        provider: storageProvider,
        ...(storageProvider === "github"
          ? {
              github: {
                repository: value("setGithubRepo"),
                branch: value("setGithubBranch") || "main",
                token: value("setGithubToken")
              }
            }
          : {})
      },
      merchant: {
        upiVpa: vpa,
        upiPayeeName: value("setPayee"),
        gstin: value("setGstin"),
        whatsappNumber: (value("setWaNumber") || "").replace(/\D/g, "")
      },
      whatsapp: { provider },
      store: {
        freeShippingThreshold: Number(value("setFreeShip")),
        codMaxOrderValue: Number(value("setCodMax")),
        upiWindowMinutes: Number(value("setUpiWindow")),
        codEnabled: document.getElementById("setCodEnabled")?.checked ?? true,
        heroProductId: value("setHeroProduct") || null
      }
    };

    if (provider === "callmebot") patch.whatsapp.callmebot = { apiKey: value("setCallmebotKey") };
    if (provider === "cloud") {
      patch.whatsapp.cloud = { phoneNumberId: value("setCloudPhoneId"), accessToken: value("setCloudToken") };
    }
    if (provider === "twilio") {
      patch.whatsapp.twilio = {
        accountSid: value("setTwilioSid"),
        authToken: value("setTwilioToken"),
        from: value("setTwilioFrom")
      };
    }

    const password = value("setPassword");
    if (password) patch.newPassword = password;

    try {
      await RejiAPI.adminSaveSettings(patch);
      await this.reload();
      this.toast("✅ Settings saved");
    } catch (e) {
      this.toast(`⚠️ ${e.message}`);
    }
  }
};

window.Admin = Admin;
document.addEventListener("DOMContentLoaded", () => Admin.init());
