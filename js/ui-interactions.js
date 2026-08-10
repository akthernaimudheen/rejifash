/**
 * Reji Fashions - UI Interactions, Modals, Size Guide, Custom Stitching Studio & Chat Assistant
 */

const UIInteractions = {
  activeQuickProduct: null,
  selectedUnit: "inches",

  /**
   * @param {string} messageHtml
   * @param {{key?: string}} [options] Pass a `key` to make the toast a
   *   singleton: a new one with the same key replaces the old instead of
   *   stacking. Adding four things to the bag in a row should leave one
   *   up-to-date toast, not four covering half a phone screen.
   */
  showToast(messageHtml, options = {}) {
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "rf-toast-container";
      document.body.appendChild(container);
    }

    if (options.key) {
      container.querySelector(`[data-toast-key="${options.key}"]`)?.remove();
    }

    const toast = document.createElement("div");
    toast.className = "rf-toast";
    if (options.key) toast.dataset.toastKey = options.key;
    toast.innerHTML = `
      <div style="color: var(--rf-gold-600); font-size: 1.1rem;"><i class=ico-sparkle></i></div>
      <div>${messageHtml}</div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  },

  openQuickView(productId) {
    const product = AppState.products.find(p => p.id === productId);
    if (!product) return;

    this.activeQuickProduct = product;
    const modal = document.getElementById("quickViewModal");
    const container = document.getElementById("quickViewContent");
    if (!modal || !container) return;

    container.innerHTML = `
      <div class="rf-quickview-grid">
        <div class="rf-modal-gallery">
          ${Media.frame(product, { variant: "hero", eager: true, showCaption: true })}
          <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
            <span class="rf-badge rf-badge-gold"><i class=ico-sparkle></i> 100% Handcrafted</span>
            <span class="rf-badge rf-badge-wine">Authentic Zari</span>
          </div>
        </div>

        <div class="rf-modal-info">
          <button class="rf-close-btn" style="position: absolute; top: 1.25rem; right: 1.25rem;" onclick="UIInteractions.closeQuickView()">✕</button>
          
          <div>
            <span class="rf-badge rf-badge-gold" style="margin-bottom: 0.4rem;">${product.category.toUpperCase()} • ${product.fabric}</span>
            <h2 style="font-family: var(--font-serif); font-size: 1.75rem; font-weight: 800; color: var(--rf-text-primary); line-height: 1.25; margin-bottom: 0.35rem;">
              ${product.name}
            </h2>
            <p style="font-family: var(--font-editorial); font-style: italic; font-size: 1.1rem; color: var(--rf-wine-700); margin-bottom: 0.85rem;">
              ${product.tagline}
            </p>
            <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 700;">
              <span style="color: #F59E0B;">★★★★★</span>
              <span>${product.rating}</span>
              <span style="color: var(--rf-text-muted);">(${product.reviewsCount} verified patrons)</span>
            </div>
          </div>

          <div style="display: flex; align-items: baseline; gap: 0.85rem;">
            <span style="font-family: var(--font-serif); font-size: 1.85rem; font-weight: 800; color: var(--rf-wine-700);">
              ${AppState.formatPrice(product.price)}
            </span>
            <span style="font-size: 1rem; color: var(--rf-text-muted); text-decoration: line-through;">
              ${AppState.formatPrice(product.originalPrice)}
            </span>
            <span class="rf-badge rf-badge-emerald">${product.discount}</span>
          </div>

          <p style="font-size: 0.9rem; color: var(--rf-text-secondary); line-height: 1.6;">
            ${product.description}
          </p>

          <!-- Specifications Table -->
          <div style="background: var(--rf-bg-surface-alt); border-radius: var(--rf-radius-sm); padding: 1rem; border: 1px solid var(--rf-border-subtle); font-size: 0.825rem;">
            ${Object.entries(product.details).map(([k, v]) => `
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
                <span style="color: var(--rf-text-muted);">${k}:</span>
                <strong style="color: var(--rf-text-primary); text-align: right;">${v}</strong>
              </div>
            `).join('')}
          </div>

          <!-- Size Select & Custom Fit Trigger -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="font-size: 0.82rem; font-weight: 700; text-transform: uppercase;">SELECT SIZE</span>
              <button style="font-size: 0.8rem; font-weight: 700; color: var(--rf-wine-700); text-decoration: underline;" 
                      onclick="UIInteractions.openSizeGuideModal()">
                <i class=ico-ruler></i> Size & Measurement Guide
              </button>
            </div>
            
            <div class="rf-card-sizes" id="modalSizesContainer">
              ${product.sizes.map((s, i) => `
                <button class="rf-size-chip ${i === 1 ? 'selected' : ''}" 
                        style="width: 38px; height: 38px; font-size: 0.85rem;"
                        onclick="UIInteractions.selectModalSize('${s}', this)">
                  ${s}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; gap: 0.85rem; flex-wrap: wrap; margin-top: 0.5rem;">
            <button class="btn btn-primary" style="flex: 1;" onclick="UIInteractions.addQuickProductToBag()">
              Add to Shopping Bag
            </button>
            <button class="btn btn-gold" onclick="UIInteractions.openCustomStudio('${product.id}')">
              <i class=ico-scissors></i> Custom Tailoring Fit
            </button>
          </div>

          <a class="rf-text-link" href="product.html?id=${encodeURIComponent(product.id)}">
            View full details, photographs &amp; reviews →
          </a>
        </div>
      </div>
    `;

    modal.classList.add("active");
  },

  selectModalSize(size, el) {
    const parent = el.closest("#modalSizesContainer");
    if (!parent) return;
    parent.querySelectorAll(".rf-size-chip").forEach(btn => btn.classList.remove("selected"));
    el.classList.add("selected");
  },

  getModalSelectedSize() {
    const container = document.getElementById("modalSizesContainer");
    if (!container) return "M";
    const sel = container.querySelector(".rf-size-chip.selected");
    return sel ? sel.textContent.trim() : "M";
  },

  addQuickProductToBag() {
    if (!this.activeQuickProduct) return;
    const size = this.getModalSelectedSize();
    AppState.addToCart(this.activeQuickProduct.id, size);
    this.closeQuickView();
  },

  closeQuickView() {
    const modal = document.getElementById("quickViewModal");
    if (modal) modal.classList.remove("active");
  },

  /* Custom Stitching Studio */
  openCustomStudio(productId) {
    const product = AppState.products.find(p => p.id === productId) || this.activeQuickProduct;
    if (!product) return;

    this.closeQuickView();
    const modal = document.getElementById("customStudioModal");
    const container = document.getElementById("customStudioContent");
    if (!modal || !container) return;

    container.innerHTML = `
      <div style="padding: 2.25rem;">
        <button class="rf-close-btn" style="position: absolute; top: 1.25rem; right: 1.25rem;" onclick="UIInteractions.closeCustomStudio()">✕</button>
        
        <div style="text-align: center; max-width: 580px; margin: 0 auto 2rem;">
          <span class="rf-badge rf-badge-gold" style="margin-bottom: 0.5rem;">Bespoke Tailoring Studio</span>
          <h2 style="font-family: var(--font-serif); font-size: 1.85rem; font-weight: 800; color: var(--rf-text-primary); margin-bottom: 0.35rem;">
            Made-to-Measure: ${product.name}
          </h2>
          <p style="font-size: 0.875rem; color: var(--rf-text-secondary);">
            Enter your exact body measurements for a custom artisanal fit stitched by master craftsmen.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <label style="font-size: 0.78rem; font-weight: 700; color: var(--rf-text-muted); display: block; margin-bottom: 0.35rem;">BUST (INCHES) *</label>
            <input type="number" id="customBust" value="36" style="width: 100%; padding: 0.65rem; border: 1px solid var(--rf-border-subtle); border-radius: var(--rf-radius-sm);">
          </div>
          <div>
            <label style="font-size: 0.78rem; font-weight: 700; color: var(--rf-text-muted); display: block; margin-bottom: 0.35rem;">WAIST (INCHES) *</label>
            <input type="number" id="customWaist" value="30" style="width: 100%; padding: 0.65rem; border: 1px solid var(--rf-border-subtle); border-radius: var(--rf-radius-sm);">
          </div>
          <div>
            <label style="font-size: 0.78rem; font-weight: 700; color: var(--rf-text-muted); display: block; margin-bottom: 0.35rem;">HIP (INCHES) *</label>
            <input type="number" id="customHip" value="40" style="width: 100%; padding: 0.65rem; border: 1px solid var(--rf-border-subtle); border-radius: var(--rf-radius-sm);">
          </div>
          <div>
            <label style="font-size: 0.78rem; font-weight: 700; color: var(--rf-text-muted); display: block; margin-bottom: 0.35rem;">KURTI LENGTH (INCHES)</label>
            <input type="number" id="customLength" value="45" style="width: 100%; padding: 0.65rem; border: 1px solid var(--rf-border-subtle); border-radius: var(--rf-radius-sm);">
          </div>
          <div>
            <label style="font-size: 0.78rem; font-weight: 700; color: var(--rf-text-muted); display: block; margin-bottom: 0.35rem;">SLEEVE LENGTH (INCHES)</label>
            <input type="number" id="customSleeve" value="17" style="width: 100%; padding: 0.65rem; border: 1px solid var(--rf-border-subtle); border-radius: var(--rf-radius-sm);">
          </div>
          <div>
            <label style="font-size: 0.78rem; font-weight: 700; color: var(--rf-text-muted); display: block; margin-bottom: 0.35rem;">CHURIDAR INSEAM (INCHES)</label>
            <input type="number" id="customInseam" value="40" style="width: 100%; padding: 0.65rem; border: 1px solid var(--rf-border-subtle); border-radius: var(--rf-radius-sm);">
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <label style="font-size: 0.78rem; font-weight: 700; color: var(--rf-text-muted); display: block; margin-bottom: 0.35rem;">SPECIAL STITCHING INSTRUCTIONS / NECK DEPTH PREFERENCE</label>
          <textarea id="customNotes" rows="2" placeholder="e.g., Please keep modest front neck depth (6.5 inches) and add extra inner seam margin"
                    style="width: 100%; padding: 0.65rem; border: 1px solid var(--rf-border-subtle); border-radius: var(--rf-radius-sm);"></textarea>
        </div>

        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
          <button class="btn btn-outline" onclick="UIInteractions.closeCustomStudio()">Cancel</button>
          <button class="btn btn-wine" onclick="UIInteractions.saveCustomStudioToBag('${product.id}')">
            Save & Add Custom Fit to Bag (No Extra Charge)
          </button>
        </div>
      </div>
    `;

    modal.classList.add("active");
  },

  saveCustomStudioToBag(productId) {
    const bust = document.getElementById("customBust")?.value || 36;
    const waist = document.getElementById("customWaist")?.value || 30;
    const hip = document.getElementById("customHip")?.value || 40;
    const len = document.getElementById("customLength")?.value || 45;
    const notes = document.getElementById("customNotes")?.value || "";

    const customSummary = `Custom (${bust}"-${waist}"-${hip}", Len: ${len}") ${notes ? `| Note: ${notes}` : ''}`;
    AppState.addToCart(productId, "Custom Fit", customSummary);
    this.closeCustomStudio();
  },

  closeCustomStudio() {
    const modal = document.getElementById("customStudioModal");
    if (modal) modal.classList.remove("active");
  },

  /* Size Guide Modal */
  openSizeGuideModal() {
    const modal = document.getElementById("sizeGuideModal");
    const body = document.getElementById("sizeGuideBody");
    if (!modal || !body) return;

    this.renderSizeGuideTable();
    modal.classList.add("active");
  },

  toggleSizeUnit(unit) {
    this.selectedUnit = unit;
    this.renderSizeGuideTable();
  },

  renderSizeGuideTable() {
    const body = document.getElementById("sizeGuideBody");
    if (!body) return;

    const data = this.selectedUnit === "inches" ? REJI_SIZE_CHART.inches : REJI_SIZE_CHART.cm;
    const unitLabel = this.selectedUnit === "inches" ? "Inches (in)" : "Centimeters (cm)";

    body.innerHTML = `
      <div style="padding: 2rem;">
        <button class="rf-close-btn" style="position: absolute; top: 1.25rem; right: 1.25rem;" onclick="UIInteractions.closeSizeGuideModal()">✕</button>
        
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <h3 style="font-family: var(--font-serif); font-size: 1.6rem; font-weight: 800; color: var(--rf-text-primary);">
            Standard Sizing Matrix
          </h3>
          <p style="font-size: 0.85rem; color: var(--rf-text-secondary); margin-bottom: 1rem;">
            All garments tailored with 2-inch inner margins for effortless alteration.
          </p>

          <div style="display: inline-flex; background: var(--rf-bg-surface-alt); padding: 3px; border-radius: 99px; border: 1px solid var(--rf-border-subtle);">
            <button class="btn btn-sm ${this.selectedUnit === 'inches' ? 'btn-wine' : ''}" 
                    style="border-radius: 99px; padding: 0.35rem 1rem;"
                    onclick="UIInteractions.toggleSizeUnit('inches')">Inches</button>
            <button class="btn btn-sm ${this.selectedUnit === 'cm' ? 'btn-wine' : ''}" 
                    style="border-radius: 99px; padding: 0.35rem 1rem;"
                    onclick="UIInteractions.toggleSizeUnit('cm')">CM</button>
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: center;">
            <thead>
              <tr style="background: var(--rf-bg-surface-alt); border-bottom: 2px solid var(--rf-border-gold);">
                <th style="padding: 0.75rem; font-weight: 800;">Size</th>
                <th style="padding: 0.75rem;">Bust (${unitLabel})</th>
                <th style="padding: 0.75rem;">Waist (${unitLabel})</th>
                <th style="padding: 0.75rem;">Hip (${unitLabel})</th>
                <th style="padding: 0.75rem;">Kurti Length</th>
                <th style="padding: 0.75rem;">Churidar Inseam</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(r => `
                <tr style="border-bottom: 1px solid var(--rf-border-subtle);">
                  <td style="padding: 0.75rem; font-weight: 800; color: var(--rf-wine-700);">${r.size}</td>
                  <td style="padding: 0.75rem;">${r.bust}</td>
                  <td style="padding: 0.75rem;">${r.waist}</td>
                  <td style="padding: 0.75rem;">${r.hip}</td>
                  <td style="padding: 0.75rem;">${r.kurtiLen}</td>
                  <td style="padding: 0.75rem;">${r.churidarInseam}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  closeSizeGuideModal() {
    const modal = document.getElementById("sizeGuideModal");
    if (modal) modal.classList.remove("active");
  },

  /* Boutique AI Assistant Chat */
  toggleBot() {
    const win = document.getElementById("botWindow");
    if (win) win.classList.toggle("active");
  },

  askBot(query) {
    const chat = document.getElementById("botChat");
    if (!chat) return;

    // Append user query
    const userMsg = document.createElement("div");
    userMsg.className = "rf-bot-msg user";
    userMsg.textContent = query;
    chat.appendChild(userMsg);

    // Bot Response Logic
    let botReply = "Namaste! Our master stylists are happy to help with sizing, fabric details, payment or an order update.";
    const q = query.toLowerCase();

    if (q.includes("upi") || q.includes("pay") || q.includes("qr") || q.includes("utr")) {
      botReply =
        "<i class=ico-bolt></i> At checkout choose UPI. We show a QR with the amount and your order number already filled in — scan it with Google Pay, PhonePe, Paytm or BHIM. " +
        "Afterwards enter the 12-digit reference (UTR) your app shows so we can match the payment. We confirm on WhatsApp once it clears. " +
        "Prefer to pay later? Cash on delivery is available too.";
    } else if (q.includes("track") || q.includes("order") || q.includes("status")) {
      botReply =
        "<i class=ico-package></i> Head to the Track Order page and enter your order ID (e.g. RF-260808-0001) with the mobile number you used at checkout. " +
        "You'll see the live status, and if the payment is still pending you can finish it right there.";
    } else if (q.includes("custom") || q.includes("stitch") || q.includes("tailor") || q.includes("size")) {
      botReply =
        "<i class=ico-scissors></i> Made-to-measure stitching is free. Open any design and choose 'Custom Tailoring Fit' to enter your exact bust, waist, hip, length and sleeve in inches.";
    } else if (q.includes("fabric") || q.includes("care") || q.includes("silk") || q.includes("wash")) {
      botReply =
        "<i class=ico-thread></i> Our Chanderi silks and Banarasi brocades are pure weaves. Dry clean the first wash to protect the zari; mulmul cottons can be machine washed cold.";
    } else if (q.includes("return") || q.includes("exchange") || q.includes("refund")) {
      botReply =
        "<i class=ico-sparkle></i> 7-day doorstep return and exchange across India. Custom-stitched pieces can be altered free of charge but aren't returnable.";
    } else if (q.includes("discount") || q.includes("coupon") || q.includes("offer")) {
      botReply = "<i class=ico-sparkle></i> Use REJI20 for flat 20% off, or FESTIVE500 for ₹500 off orders above ₹2,999.";
    } else if (q.includes("deliver") || q.includes("ship")) {
      botReply =
        "<i class=ico-truck></i> Dispatch is within 24 hours. Metro PIN codes usually receive in 3 days, elsewhere around 5. Delivery is free above ₹1,999.";
    }

    setTimeout(() => {
      const botMsg = document.createElement("div");
      botMsg.className = "rf-bot-msg bot";
      botMsg.textContent = botReply;
      chat.appendChild(botMsg);
      chat.scrollTop = chat.scrollHeight;
    }, 450);
  }
};

window.UIInteractions = UIInteractions;
