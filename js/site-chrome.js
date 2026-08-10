/**
 * Reji Fashions - Shared page chrome.
 *
 * The header, bag drawer, modals, concierge and footer are identical on every
 * page, so they are defined once here and injected on load. Pages only contain
 * the markup that is unique to them.
 *
 * Usage: <div data-rf-chrome="header"></div> ... <div data-rf-chrome="footer"></div>
 */

const SiteChrome = {
  header({ compact = false } = {}) {
    return `
      <div class="rf-announcement">
        <div class="rf-announcement-text">
          <span><i class=ico-sparkle></i> Festive Season Gala: Flat 20% off with code</span>
          <span class="rf-announcement-code">REJI20</span>
          <span>• Free express delivery across India on orders above ₹1,999</span>
        </div>
        <div class="rf-announcement-timer">
          <span><i class=ico-clock></i> Ends in:</span>
          <strong id="saleCountdown">--:--:--</strong>
        </div>
      </div>

      <header class="rf-header">
        <div class="container">
          <div class="rf-nav-wrapper">
            <a href="index.html" class="brand-logo-wrap">
              <div class="brand-monogram">RF</div>
              <div class="brand-text">
                <span class="brand-title">REJI <span>FASHIONS</span></span>
                <span class="brand-tagline">Artisanal Ethnic Couture</span>
              </div>
            </a>

            ${
              compact
                ? ""
                : `<ul class="rf-nav-links">
                     <li><a href="index.html#catalog" class="rf-nav-link">All collections</a></li>
                     <li><a href="index.html#catalog" data-jump-cat="kurtis" class="rf-nav-link">Kurtis</a></li>
                     <li><a href="index.html#catalog" data-jump-cat="churidars" class="rf-nav-link">Churidars</a></li>
                     <li><a href="index.html#catalog" data-jump-cat="fusion" class="rf-nav-link">Indo-Western</a></li>
                     <li><a href="index.html#lookbook" class="rf-nav-link">Lookbook</a></li>
                     <li><a href="orders.html" class="rf-nav-link">Track order</a></li>
                   </ul>`
            }

            <div class="rf-search-box">
              <svg class="rf-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" id="searchInput" class="rf-search-input" placeholder="Search Chanderi, velvet, Anarkali…" autocomplete="off">
              <div class="rf-search-dropdown" id="searchDropdown"></div>
            </div>

            <div class="rf-nav-actions">
              <select id="currencySelector" class="rf-currency-select" title="Change currency" aria-label="Currency">
                <option value="INR">🇮🇳 INR</option>
                <option value="USD">🇺🇸 USD</option>
                <option value="GBP">🇬🇧 GBP</option>
                <option value="AED">🇦🇪 AED</option>
                <option value="EUR">🇪🇺 EUR</option>
              </select>

              <button class="rf-icon-btn" onclick="AppState.toggleTheme()" title="Toggle theme" aria-label="Toggle theme"><i class=ico-moon></i></button>

              <button class="rf-icon-btn" onclick="AppState.toggleWishlistView()" title="Wishlist" aria-label="Wishlist">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <span class="rf-badge-counter" id="wishlistCountBadge" style="display:none">0</span>
              </button>

              <button class="rf-icon-btn" onclick="AppState.openCartDrawer()" title="Shopping bag" aria-label="Bag">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                <span class="rf-badge-counter" id="cartCountBadge" style="display:none">0</span>
              </button>
            </div>
          </div>
        </div>
      </header>`;
  },

  overlays() {
    return `
      <!-- Shopping bag drawer -->
      <div class="rf-drawer-overlay" id="cartDrawerOverlay" onclick="if(event.target===this) AppState.closeCartDrawer()">
        <aside class="rf-cart-drawer">
          <div class="rf-drawer-header">
            <h3 class="rf-drawer-title"><span><i class=ico-bag></i></span> Your shopping bag</h3>
            <button class="rf-close-btn" onclick="AppState.closeCartDrawer()" aria-label="Close">✕</button>
          </div>

          <div class="rf-shipping-progress">
            <div class="rf-progress-text" id="shippingProgressText">Add items to unlock free express delivery.</div>
            <div class="rf-progress-track"><div class="rf-progress-fill" id="shippingProgressBar" style="width:0%"></div></div>
          </div>

          <div class="rf-cart-items-wrap" id="cartItemsContainer"></div>

          <div class="rf-drawer-footer">
            <div class="rf-coupon-box">
              <input type="text" id="couponInput" class="rf-coupon-input" placeholder="Promo code (e.g. REJI20)">
              <button class="btn btn-gold btn-sm" onclick="AppState.applyCouponCode()">Apply</button>
            </div>

            <div class="rf-bill-summary">
              <div class="rf-bill-row"><span>Bag subtotal</span><span id="cartSubtotal">₹0</span></div>
              <div class="rf-bill-row rf-bill-row--save" id="cartDiscountRow" style="display:none">
                <span>Promo discount</span><span class="amount">-₹0</span>
              </div>
              <div class="rf-bill-row"><span>Express delivery</span><span id="cartShipping">—</span></div>
              <div class="rf-bill-row total"><span>Grand total</span><span id="cartTotal">₹0</span></div>
            </div>

            <button class="btn btn-wine btn-lg rf-checkout-btn" onclick="CheckoutEngine.openCheckoutModal()">
              Proceed to secure checkout →
            </button>
          </div>
        </aside>
      </div>

      <div class="rf-modal-backdrop" id="quickViewModal" onclick="if(event.target===this) UIInteractions.closeQuickView()">
        <div class="rf-modal-content" id="quickViewContent"></div>
      </div>

      <div class="rf-modal-backdrop" id="customStudioModal" onclick="if(event.target===this) UIInteractions.closeCustomStudio()">
        <div class="rf-modal-content" id="customStudioContent" style="max-width:680px"></div>
      </div>

      <div class="rf-modal-backdrop" id="sizeGuideModal" onclick="if(event.target===this) UIInteractions.closeSizeGuideModal()">
        <div class="rf-modal-content" id="sizeGuideBody" style="max-width:680px"></div>
      </div>

      <!-- Checkout -->
      <div class="rf-modal-backdrop" id="checkoutModal" onclick="if(event.target===this) CheckoutEngine.closeCheckoutModal()">
        <div class="rf-modal-content rf-checkout-modal">
          <div class="rf-checkout-steps" id="checkoutStepsHeader">
            <div class="rf-step-item active"><div class="rf-step-circle">1</div><span class="rf-step-label">Delivery</span></div>
            <div class="rf-step-item"><div class="rf-step-circle">2</div><span class="rf-step-label">Payment</span></div>
            <div class="rf-step-item"><div class="rf-step-circle">3</div><span class="rf-step-label">Confirmation</span></div>
            <button class="rf-close-btn" onclick="CheckoutEngine.closeCheckoutModal()" aria-label="Close">✕</button>
          </div>
          <div class="rf-checkout-body" id="checkoutModalBody"></div>
        </div>
      </div>

      <!-- Concierge -->
      <button class="rf-bot-trigger" onclick="UIInteractions.toggleBot()" title="Chat with our stylist">
        <span><i class=ico-sparkle></i></span> Stylist &amp; order help
      </button>

      <div class="rf-bot-window" id="botWindow">
        <div class="rf-bot-header">
          <div>
            <h5>Reji stylist concierge</h5>
            <span class="rf-bot-online">● Online · instant assistance</span>
          </div>
          <button onclick="UIInteractions.toggleBot()" aria-label="Close chat">✕</button>
        </div>
        <div class="rf-bot-chat" id="botChat">
          <div class="rf-bot-msg bot">Namaste! How can I help — custom sizing, fabric care, payment or an order update?</div>
        </div>
        <div class="rf-bot-quick-chips">
          <button class="rf-chip-btn" onclick="UIInteractions.askBot('How do I track my order?')"><i class=ico-package></i> Track order</button>
          <button class="rf-chip-btn" onclick="UIInteractions.askBot('How do I pay by UPI?')"><i class=ico-bolt></i> UPI payment</button>
          <button class="rf-chip-btn" onclick="UIInteractions.askBot('Tell me about custom stitching')"><i class=ico-scissors></i> Custom sizing</button>
          <button class="rf-chip-btn" onclick="UIInteractions.askBot('What is your return policy?')"><i class=ico-refresh></i> Returns</button>
        </div>
      </div>`;
  },

  footer() {
    const cfg = (typeof RejiAPI !== "undefined" && RejiAPI.config) || {
      merchant: { whatsappNumber: "919074666413", supportPhone: "+91 90746 66413", address: "Bengaluru & Kochi" }
    };
    const wa = `https://wa.me/${cfg.merchant.whatsappNumber}`;

    return `
      <footer class="rf-footer">
        <div class="container">
          <div class="rf-footer-grid">
            <div>
              <div class="brand-logo-wrap">
                <div class="brand-monogram">RF</div>
                <div class="brand-text">
                  <span class="brand-title" style="color:#FFF">REJI <span>FASHIONS</span></span>
                  <span class="brand-tagline">Artisanal Ethnic Couture</span>
                </div>
              </div>
              <p class="rf-footer-blurb">
                Celebrating Indian textile heritage with artisanal churidars, handloom Chanderi kurtis
                and royal velvet wedding ensembles.
              </p>
              <div class="rf-footer-contact">
                <div><i class=ico-pin></i> ${Media.escapeHtml(cfg.merchant.address)}</div>
                <div><i class=ico-chat></i> <a href="${wa}" target="_blank" rel="noopener">WhatsApp ${Media.escapeHtml(
                  cfg.merchant.supportPhone
                )}</a></div>
              </div>
            </div>

            <div>
              <h4>Collections</h4>
              <ul>
                <li><a href="index.html#catalog">Chanderi silk kurtis</a></li>
                <li><a href="index.html#catalog">Maharani velvet churidars</a></li>
                <li><a href="index.html#catalog">Lucknowi chikankari</a></li>
                <li><a href="index.html#catalog">Banarasi brocade sets</a></li>
                <li><a href="index.html#catalog">Jaipur mulmul daily wear</a></li>
              </ul>
            </div>

            <div>
              <h4>Help &amp; orders</h4>
              <ul>
                <li><a href="orders.html"><i class=ico-package></i> Track your order</a></li>
                <li><a href="javascript:void(0)" onclick="UIInteractions.openSizeGuideModal()"><i class=ico-ruler></i> Size guide</a></li>
                <li><a href="javascript:void(0)" onclick="UIInteractions.askBot('How do I pay by UPI?')"><i class=ico-bolt></i> How UPI payment works</a></li>
                <li><a href="javascript:void(0)" onclick="UIInteractions.askBot('What is your return policy?')"><i class=ico-refresh></i> Returns &amp; exchange</a></li>
                <li><a href="javascript:void(0)" onclick="UIInteractions.askBot('Fabric care')"><i class=ico-thread></i> Fabric care</a></li>
              </ul>
            </div>

            <div>
              <h4>Join the inner circle</h4>
              <p class="rf-footer-blurb">Private lookbook previews, trunk shows and 15% off your next curation.</p>
              <div class="rf-newsletter">
                <input type="email" id="newsletterEmail" placeholder="Your email address" aria-label="Email">
                <button class="btn btn-gold btn-sm" onclick="SiteChrome.subscribe()">Join</button>
              </div>
            </div>
          </div>

          <div class="rf-footer-bottom">
            <div>© ${new Date().getFullYear()} Reji Fashions. Handcrafted with pride in India.</div>
            <div class="rf-footer-trust">
              <span><i class=ico-lock></i> Secure checkout</span>
              <span><i class=ico-bolt></i> UPI · RuPay · Cash on delivery</span>
              <span><i class=ico-shield></i> Verified authentic silks</span>
              <a href="studio.html">Studio view</a>
              <a href="admin.html">Shop admin</a>
            </div>
          </div>
        </div>
      </footer>`;
  },

  subscribe() {
    const input = document.getElementById("newsletterEmail");
    const value = input?.value.trim() || "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      UIInteractions.showToast("Please enter a valid email address");
      return;
    }
    try {
      const list = JSON.parse(localStorage.getItem("rf_subscribers") || "[]");
      if (!list.includes(value)) list.push(value);
      localStorage.setItem("rf_subscribers", JSON.stringify(list));
    } catch {
      /* ignore */
    }
    input.value = "";
    UIInteractions.showToast("<i class=ico-sparkle></i> Thank you for subscribing to Reji Fashions!");
  },

  /** Replace every <div data-rf-chrome="..."> placeholder with its markup. */
  mount() {
    document.querySelectorAll("[data-rf-chrome]").forEach(slot => {
      const kind = slot.dataset.rfChrome;
      const compact = slot.dataset.compact === "true";
      if (kind === "header") slot.outerHTML = this.header({ compact });
      else if (kind === "overlays") slot.outerHTML = this.overlays();
      else if (kind === "footer") slot.outerHTML = this.footer();
    });

    // Category shortcuts in the nav: jump to the catalog and select the tab.
    document.querySelectorAll("[data-jump-cat]").forEach(link => {
      link.addEventListener("click", () => {
        const category = link.dataset.jumpCat;
        sessionStorage.setItem("rf_jump_cat", category);
        if (location.pathname.endsWith("index.html") || location.pathname.endsWith("/")) {
          document.querySelector(`.rf-cat-tab[data-cat="${category}"]`)?.click();
        }
      });
    });
  },

  /** Honour a category chosen from another page's nav. */
  applyPendingCategory() {
    const category = sessionStorage.getItem("rf_jump_cat");
    if (!category) return;
    sessionStorage.removeItem("rf_jump_cat");
    document.querySelector(`.rf-cat-tab[data-cat="${category}"]`)?.click();
  }
};

window.SiteChrome = SiteChrome;
