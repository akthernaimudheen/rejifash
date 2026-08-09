/**
 * Reji Fashions - Master application state & store engine.
 *
 * Owns the catalog, bag, wishlist, filters, currency and live search.
 * Product data comes from the API when the server is running and falls back to
 * the bundled catalog otherwise — see js/api.js.
 */

const AppState = {
  products: [],
  coupons: {},
  cart: [],
  wishlist: [],
  activeCategory: "all",
  activeFabric: "all",
  activeOccasion: "all",
  maxPrice: 9000,
  activeSort: "featured",
  currentCurrency: "INR",
  appliedCoupon: null,
  showWishlistOnly: false,
  activeTheme: "light",

  async init() {
    this.loadPersistedState();
    await RejiAPI.init();

    const { products, coupons } = await RejiAPI.getProducts();
    this.products = products;
    this.coupons = coupons;

    this.pruneCart();
    this.renderHero();
    this.renderProducts();
    this.renderLookbooks();
    this.renderTestimonials();
    this.bindEvents();
    this.updateCounters();
    this.startAnnouncementCountdown();
    this.reflectConnectionMode();
  },

  /** A quiet badge so it's obvious whether orders are going to the server. */
  reflectConnectionMode() {
    if (RejiAPI.mode !== "local") return;
    const bar = document.querySelector(".rf-announcement");
    if (!bar || document.getElementById("rfOfflineChip")) return;
    const chip = document.createElement("span");
    chip.id = "rfOfflineChip";
    chip.className = "rf-offline-chip";
    chip.title = "Run `node server/server.js` to store orders on the server and send WhatsApp alerts automatically";
    chip.textContent = "Demo mode — orders saved in this browser";
    bar.appendChild(chip);
  },

  /* ------------------------------------------------------ persistence --- */

  loadPersistedState() {
    try {
      const savedCart = localStorage.getItem("rf_cart");
      if (savedCart) this.cart = JSON.parse(savedCart);

      const savedWishlist = localStorage.getItem("rf_wishlist");
      if (savedWishlist) this.wishlist = JSON.parse(savedWishlist);

      const savedCurrency = localStorage.getItem("rf_currency");
      if (savedCurrency && CURRENCIES[savedCurrency]) this.currentCurrency = savedCurrency;

      const savedCoupon = localStorage.getItem("rf_coupon");
      if (savedCoupon) this.appliedCoupon = savedCoupon;

      const savedTheme = localStorage.getItem("rf_theme");
      if (savedTheme) {
        this.activeTheme = savedTheme;
        document.documentElement.setAttribute("data-theme", savedTheme);
      }
    } catch (e) {
      console.warn("Storage fallback active", e);
    }
  },

  /** Drop bag lines for products that have since been removed or delisted. */
  pruneCart() {
    if (!this.products.length) return;
    const before = this.cart.length;
    this.cart = this.cart.filter(item => this.products.some(p => p.id === item.id));
    if (this.cart.length !== before) {
      this.persistCart();
      UIInteractions.showToast("Some items in your bag are no longer available and were removed.");
    }
  },

  persistCart() {
    try {
      localStorage.setItem("rf_cart", JSON.stringify(this.cart));
    } catch {
      /* private mode */
    }
    this.updateCounters();
  },

  persistWishlist() {
    try {
      localStorage.setItem("rf_wishlist", JSON.stringify(this.wishlist));
    } catch {
      /* private mode */
    }
    this.updateCounters();
  },

  /** Minimal shape the server needs — it re-prices everything itself. */
  cartPayload() {
    return this.cart.map(item => ({
      id: item.id,
      size: item.size,
      quantity: item.quantity,
      customNotes: item.customNotes || null
    }));
  },

  clearCart() {
    this.cart = [];
    this.appliedCoupon = null;
    try {
      localStorage.removeItem("rf_coupon");
    } catch {
      /* ignore */
    }
    this.persistCart();
  },

  /* ---------------------------------------------------------- currency --- */

  formatPrice(inrAmount) {
    const currency = CURRENCIES[this.currentCurrency] || CURRENCIES.INR;
    const converted = inrAmount * currency.rate;
    if (this.currentCurrency === "INR") {
      return `${currency.symbol}${Math.round(converted).toLocaleString("en-IN")}`;
    }
    return `${currency.symbol}${converted.toFixed(2)}`;
  },

  setCurrency(code) {
    if (!CURRENCIES[code]) return;
    this.currentCurrency = code;
    try {
      localStorage.setItem("rf_currency", code);
    } catch {
      /* ignore */
    }
    this.renderProducts();
    this.renderCartDrawer();
    UIInteractions.showToast(`Prices now shown in <strong>${code}</strong>. Payment is charged in INR.`);
  },

  /* --------------------------------------------------------- catalogue --- */

  getFilteredProducts() {
    return this.products
      .filter(item => {
        if (this.showWishlistOnly && !this.wishlist.includes(item.id)) return false;
        if (this.activeCategory !== "all" && item.category !== this.activeCategory) return false;
        if (this.activeFabric !== "all" && item.fabricCategory !== this.activeFabric) return false;
        if (
          this.activeOccasion !== "all" &&
          !item.occasion.toLowerCase().includes(this.activeOccasion.toLowerCase())
        ) {
          return false;
        }
        if (item.price > this.maxPrice) return false;
        return true;
      })
      .sort((a, b) => {
        if (this.activeSort === "price-low") return a.price - b.price;
        if (this.activeSort === "price-high") return b.price - a.price;
        if (this.activeSort === "rating") return b.rating - a.rating;
        if (this.activeSort === "newest") return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      });
  },

  /**
   * Pick the garment that fronts the site.
   *
   * Preference order: whatever the shop pinned in Settings, then the highest
   * rated featured piece that actually has a photograph, then any photographed
   * piece. Only if nothing has been shot does the illustration stay.
   */
  heroProduct() {
    const pinned = RejiAPI.config.store?.heroProductId;
    const photographed = this.products.filter(p => Media.hasPhotos(p));
    if (!photographed.length) return null;

    return (
      photographed.find(p => p.id === pinned) ||
      photographed.filter(p => p.featured).sort((a, b) => b.rating - a.rating)[0] ||
      photographed[0]
    );
  },

  renderHero() {
    const mount = document.getElementById("heroVisual");
    if (!mount) return;

    const product = this.heroProduct();
    if (!product) return; // no photography yet — keep the illustration

    const shot = Media.gallery(product)[0];
    const href = `product.html?id=${encodeURIComponent(product.id)}`;

    mount.innerHTML = `
      <a class="rf-hero-card rf-hero-card--photo" href="${href}"
         aria-label="${Media.escapeHtml(product.name)}">
        <div class="rf-hero-image-wrap">
          <span class="rf-badge rf-badge-gold rf-hero-card-badge">
            ${Media.escapeHtml(product.badge || "Featured")}
          </span>
          <img class="rf-hero-photo"
               src="${Media.escapeHtml(shot.zoomSrc || shot.src)}"
               alt="${Media.escapeHtml(shot.alt || product.name)}"
               fetchpriority="high" decoding="async">
          <div class="rf-hero-float-tag">
            <h5>${Media.escapeHtml(product.name)}</h5>
            <p>${Media.escapeHtml(product.tagline || product.fabric)}</p>
            <span class="rf-hero-float-price">
              ${this.formatPrice(product.price)}
              <em>${Media.escapeHtml(product.discount || "")}</em>
            </span>
          </div>
        </div>
      </a>`;
  },

  renderProducts() {
    const grid = document.getElementById("productsGrid");
    const countEl = document.getElementById("catalogProductCount");
    if (!grid) return;

    const filtered = this.getFilteredProducts();
    if (countEl) {
      countEl.textContent = `${filtered.length} ${filtered.length === 1 ? "design" : "designs"}${
        this.showWishlistOnly ? " in your wishlist" : ""
      }`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="rf-empty-state">
          <div class="rf-empty-icon">✨</div>
          <h3>No matching garments found</h3>
          <p>Try widening the price range or clearing the fabric filter.</p>
          <button class="btn btn-outline" onclick="AppState.resetFilters()">Reset all filters</button>
        </div>`;
      return;
    }

    grid.innerHTML = filtered.map((product, index) => this.renderProductCard(product, index)).join("");
  },

  renderProductCard(product, index) {
    const isWishlisted = this.wishlist.includes(product.id);
    const href = `product.html?id=${encodeURIComponent(product.id)}`;
    const lowStock = product.stock <= 5;

    return `
      <article class="rf-product-card" data-id="${product.id}">
        <a class="rf-card-media" href="${href}" aria-label="${Media.escapeHtml(product.name)}">
          ${Media.frame(product, { variant: "card", eager: index < 4 })}
          <div class="rf-card-badges">
            <span class="rf-badge ${product.category === "churidars" ? "rf-badge-wine" : "rf-badge-gold"}">
              ${Media.escapeHtml(product.badge || "Artisanal")}
            </span>
            ${lowStock ? `<span class="rf-badge rf-badge-alert">Only ${product.stock} left</span>` : ""}
          </div>
        </a>

        <button class="rf-wishlist-btn ${isWishlisted ? "active" : ""}"
                onclick="AppState.toggleWishlist('${product.id}')"
                title="${isWishlisted ? "Remove from wishlist" : "Save to wishlist"}"
                aria-label="Wishlist">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${
            isWishlisted ? "currentColor" : "none"
          }" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>

        <div class="rf-card-quick-actions">
          <button class="rf-quickview-btn" onclick="UIInteractions.openQuickView('${product.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            Quick view
          </button>
        </div>

        <div class="rf-card-info">
          <div class="rf-card-meta">
            <span class="rf-card-category">${Media.escapeHtml(product.subCategory)}</span>
            <span class="rf-card-rating">
              <span class="rf-star-icon">★</span> ${product.rating}
              <span class="rf-review-count">(${product.reviewsCount})</span>
            </span>
          </div>

          <h3 class="rf-card-title"><a href="${href}">${Media.escapeHtml(product.name)}</a></h3>
          <p class="rf-card-fabric">${Media.escapeHtml(product.fabric)}</p>

          <div class="rf-card-sizes" id="sizes_${product.id}">
            ${product.sizes
              .slice(0, 5)
              .map(
                (size, i) => `
              <button class="rf-size-chip ${i === 1 ? "selected" : ""}"
                      onclick="AppState.selectCardSize('${product.id}', '${size}', this)">${size}</button>`
              )
              .join("")}
          </div>

          <div class="rf-card-footer">
            <div class="rf-price-box">
              <span class="rf-current-price">${this.formatPrice(product.price)}</span>
              <div class="rf-orig-price-wrap">
                <span class="rf-original-price">${this.formatPrice(product.originalPrice)}</span>
                <span class="rf-discount-tag">${Media.escapeHtml(product.discount)}</span>
              </div>
            </div>

            <button class="rf-add-bag-btn" onclick="AppState.addToCart('${product.id}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
              Add to bag
            </button>
          </div>
        </div>
      </article>`;
  },

  selectCardSize(productId, size, el) {
    const parent = el.closest(".rf-card-sizes");
    if (!parent) return;
    parent.querySelectorAll(".rf-size-chip").forEach(btn => btn.classList.remove("selected"));
    el.classList.add("selected");
  },

  getSelectedCardSize(productId) {
    const container = document.getElementById(`sizes_${productId}`);
    const selected = container?.querySelector(".rf-size-chip.selected");
    return selected ? selected.textContent.trim() : "M";
  },

  /* -------------------------------------------------------------- bag --- */

  addToCart(productId, customSize = null, customNotes = null) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const size = customSize || this.getSelectedCardSize(productId);
    const existing = this.cart.findIndex(
      item => item.id === productId && item.size === size && !item.customNotes && !customNotes
    );

    if (existing > -1) {
      this.cart[existing].quantity += 1;
    } else {
      this.cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        color: product.color,
        fabric: product.fabric,
        size,
        quantity: 1,
        visualType: product.visualType,
        colorHex: product.colorHex,
        accentHex: product.accentHex,
        customNotes: customNotes || null
      });
    }

    this.persistCart();

    // Deliberately do NOT open the bag drawer here. Slamming it over the page
    // on every add stops you browsing, which makes adding three or four things
    // from the grid needlessly slow. The toast carries the link instead.
    const count = this.cart.reduce((sum, i) => sum + i.quantity, 0);
    UIInteractions.showToast(
      `✨ <strong>${Media.escapeHtml(product.name)}</strong> · size ${Media.escapeHtml(size)}
       <button class="rf-toast-action" onclick="AppState.openCartDrawer()">View bag (${count})</button>`,
      { key: "cart" }
    );
    this.bumpCartBadge();
  },

  /** Small pulse on the bag icon — the feedback the drawer used to provide. */
  bumpCartBadge() {
    const badge = document.getElementById("cartCountBadge");
    if (!badge) return;
    badge.classList.remove("rf-badge-bump");
    void badge.offsetWidth; // restart the animation
    badge.classList.add("rf-badge-bump");
  },

  updateCartQuantity(index, change) {
    if (!this.cart[index]) return;
    this.cart[index].quantity += change;
    if (this.cart[index].quantity <= 0) {
      this.cart.splice(index, 1);
      UIInteractions.showToast("Item removed from your bag");
    }
    this.persistCart();
  },

  removeFromCart(index) {
    const item = this.cart[index];
    if (!item) return;
    this.cart.splice(index, 1);
    this.persistCart();
    UIInteractions.showToast(`Removed <strong>${Media.escapeHtml(item.name)}</strong>`);
  },

  cartTotals() {
    return RejiAPI.computePricing(this.cart, this.appliedCoupon, this.products, this.coupons);
  },

  updateCounters() {
    const cartBadge = document.getElementById("cartCountBadge");
    const wishlistBadge = document.getElementById("wishlistCountBadge");

    const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartBadge) {
      cartBadge.textContent = totalItems;
      cartBadge.style.display = totalItems > 0 ? "flex" : "none";
    }
    if (wishlistBadge) {
      wishlistBadge.textContent = this.wishlist.length;
      wishlistBadge.style.display = this.wishlist.length > 0 ? "flex" : "none";
    }
    this.renderCartDrawer();
  },

  renderCartDrawer() {
    const container = document.getElementById("cartItemsContainer");
    if (!container) return;

    const subtotalEl = document.getElementById("cartSubtotal");
    const totalEl = document.getElementById("cartTotal");
    const discountRow = document.getElementById("cartDiscountRow");
    const shippingEl = document.getElementById("cartShipping");
    const progressBar = document.getElementById("shippingProgressBar");
    const progressText = document.getElementById("shippingProgressText");

    if (this.cart.length === 0) {
      container.innerHTML = `
        <div class="rf-empty-state rf-empty-state--drawer">
          <div class="rf-empty-icon">🛍️</div>
          <h4>Your shopping bag is empty</h4>
          <p>Explore our festive churidars and handblock kurtis.</p>
          <button class="btn btn-primary" onclick="AppState.closeCartDrawer()">Start exploring</button>
        </div>`;
      if (subtotalEl) subtotalEl.textContent = this.formatPrice(0);
      if (totalEl) totalEl.textContent = this.formatPrice(0);
      if (shippingEl) shippingEl.textContent = "—";
      if (discountRow) discountRow.style.display = "none";
      if (progressBar) progressBar.style.width = "0%";
      if (progressText) progressText.textContent = "Add items to unlock free express delivery.";
      return;
    }

    const { pricing } = this.cartTotals();
    const threshold = RejiAPI.config.store.freeShippingThreshold;
    const remaining = threshold - (pricing.subtotal - pricing.discount);

    if (progressBar) {
      progressBar.style.width = `${Math.min(100, Math.round(((pricing.subtotal - pricing.discount) / threshold) * 100))}%`;
    }
    if (progressText) {
      progressText.innerHTML =
        remaining > 0
          ? `Add <strong>${this.formatPrice(remaining)}</strong> more for <strong>FREE express delivery</strong>`
          : `🎉 You've unlocked <strong>FREE express delivery</strong>`;
    }

    if (subtotalEl) subtotalEl.textContent = this.formatPrice(pricing.subtotal);
    if (totalEl) totalEl.textContent = this.formatPrice(pricing.total);
    if (shippingEl) {
      shippingEl.textContent = pricing.shipping === 0 ? "FREE" : this.formatPrice(pricing.shipping);
      shippingEl.classList.toggle("rf-free", pricing.shipping === 0);
    }
    if (discountRow) {
      discountRow.style.display = pricing.discount > 0 ? "flex" : "none";
      const amount = discountRow.querySelector(".amount");
      if (amount) amount.textContent = `-${this.formatPrice(pricing.discount)}`;
    }

    container.innerHTML = this.cart
      .map((item, idx) => {
        const product = this.products.find(p => p.id === item.id) || item;
        return `
        <div class="rf-cart-item">
          <a class="rf-cart-thumb" href="product.html?id=${encodeURIComponent(item.id)}">
            ${Media.thumb(product)}
          </a>
          <div class="rf-cart-details">
            <h4 class="rf-cart-item-title">
              <a href="product.html?id=${encodeURIComponent(item.id)}">${Media.escapeHtml(item.name)}</a>
            </h4>
            <div class="rf-cart-item-meta">
              <span>Size <strong>${Media.escapeHtml(item.size)}</strong></span> ·
              <span>${Media.escapeHtml(item.color || "")}</span>
              ${item.customNotes ? `<div class="rf-cart-custom">✂️ ${Media.escapeHtml(item.customNotes)}</div>` : ""}
            </div>
            <div class="rf-cart-item-actions">
              <div class="rf-qty-selector">
                <button class="rf-qty-btn" onclick="AppState.updateCartQuantity(${idx}, -1)" aria-label="Decrease">−</button>
                <span class="rf-qty-num">${item.quantity}</span>
                <button class="rf-qty-btn" onclick="AppState.updateCartQuantity(${idx}, 1)" aria-label="Increase">+</button>
              </div>
              <span class="rf-cart-item-price">${this.formatPrice(item.price * item.quantity)}</span>
              <button class="rf-item-remove-btn" onclick="AppState.removeFromCart(${idx})" title="Remove">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>`;
      })
      .join("");
  },

  applyCouponCode() {
    const input = document.getElementById("couponInput");
    if (!input) return;
    const code = input.value.trim().toUpperCase();

    if (!code) {
      UIInteractions.showToast("Enter a promo code — try <strong>REJI20</strong>");
      return;
    }

    const coupon = this.coupons[code];
    if (!coupon) {
      UIInteractions.showToast("That code isn't valid. Try <strong>REJI20</strong> or <strong>FESTIVE500</strong>.");
      return;
    }

    const subtotal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (subtotal < coupon.minSpend) {
      UIInteractions.showToast(`This code needs a minimum bag value of ${this.formatPrice(coupon.minSpend)}`);
      return;
    }

    this.appliedCoupon = code;
    try {
      localStorage.setItem("rf_coupon", code);
    } catch {
      /* ignore */
    }
    this.renderCartDrawer();
    UIInteractions.showToast(`🎉 <strong>${code}</strong> applied — ${Media.escapeHtml(coupon.description)}`);
  },

  toggleWishlist(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const idx = this.wishlist.indexOf(productId);
    if (idx > -1) {
      this.wishlist.splice(idx, 1);
      UIInteractions.showToast("Removed from wishlist");
    } else {
      this.wishlist.push(productId);
      UIInteractions.showToast(`❤️ <strong>${Media.escapeHtml(product.name)}</strong> saved to wishlist`);
    }
    this.persistWishlist();
    this.renderProducts();
  },

  toggleWishlistView() {
    if (!this.wishlist.length) {
      UIInteractions.showToast("Your wishlist is empty — tap the ♡ on any design to save it.");
      return;
    }
    this.showWishlistOnly = !this.showWishlistOnly;
    this.renderProducts();
    document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
    UIInteractions.showToast(
      this.showWishlistOnly ? "Showing your saved designs" : "Showing the full collection"
    );
  },

  openCartDrawer() {
    document.getElementById("cartDrawerOverlay")?.classList.add("active");
  },

  closeCartDrawer() {
    document.getElementById("cartDrawerOverlay")?.classList.remove("active");
  },

  toggleTheme() {
    this.activeTheme = this.activeTheme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", this.activeTheme);
    try {
      localStorage.setItem("rf_theme", this.activeTheme);
    } catch {
      /* ignore */
    }
  },

  resetFilters() {
    this.activeCategory = "all";
    this.activeFabric = "all";
    this.activeOccasion = "all";
    this.maxPrice = 9000;
    this.activeSort = "featured";
    this.showWishlistOnly = false;

    document.querySelectorAll(".rf-cat-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.cat === "all"));
    const slider = document.getElementById("priceSlider");
    if (slider) slider.value = 9000;
    const priceLabel = document.getElementById("priceValDisplay");
    if (priceLabel) priceLabel.textContent = this.formatPrice(9000);
    const fabric = document.getElementById("fabricFilter");
    if (fabric) fabric.value = "all";
    const occasion = document.getElementById("occasionFilter");
    if (occasion) occasion.value = "all";

    this.renderProducts();
  },

  /* -------------------------------------------------------- lookbooks --- */

  renderLookbooks() {
    const container = document.getElementById("lookbooksContainer");
    if (!container) return;

    container.innerHTML = REJI_LOOKBOOKS.map(lb => {
      const items = lb.productIds.map(id => this.products.find(p => p.id === id)).filter(Boolean);
      if (!items.length) return "";
      const total = items.reduce((sum, p) => sum + p.price, 0);

      return `
        <div class="rf-lookbook-card">
          <div class="rf-lookbook-visual">
            ${Media.frame(items[0], { variant: "lookbook" })}
            ${items
              .slice(0, 2)
              .map(
                (item, i) => `
              <button class="rf-hotspot-pin" style="top:${i === 0 ? 35 : 68}%; left:${i === 0 ? 42 : 55}%;"
                      onclick="UIInteractions.openQuickView('${item.id}')"
                      title="View ${Media.escapeHtml(item.name)}">+</button>`
              )
              .join("")}
          </div>
          <div class="rf-lookbook-content">
            <span class="rf-badge rf-badge-gold">${Media.escapeHtml(lb.tag)}</span>
            <h3>${Media.escapeHtml(lb.title)}</h3>
            <p class="rf-lookbook-subtitle">${Media.escapeHtml(lb.subtitle)}</p>
            <p class="rf-lookbook-notes">${Media.escapeHtml(lb.curatedNotes)}</p>
            <div class="rf-lookbook-items">
              ${items
                .map(
                  item =>
                    `<a href="product.html?id=${encodeURIComponent(item.id)}">${Media.escapeHtml(
                      item.name
                    )} · ${this.formatPrice(item.price)}</a>`
                )
                .join("")}
            </div>
            <div class="rf-lookbook-cta">
              <button class="btn btn-wine btn-sm" onclick="AppState.addLookbookToBag('${lb.id}')">
                Shop the look · ${this.formatPrice(total)}
              </button>
              <a class="btn btn-outline btn-sm" href="product.html?id=${encodeURIComponent(items[0].id)}">
                Explore details
              </a>
            </div>
          </div>
        </div>`;
    }).join("");
  },

  addLookbookToBag(lookbookId) {
    const lb = REJI_LOOKBOOKS.find(l => l.id === lookbookId);
    if (!lb) return;
    lb.productIds.forEach(id => {
      const product = this.products.find(p => p.id === id);
      if (product) this.addToCart(id, "M");
    });
    // Adding a whole styled look is a deliberate, one-off action, so showing
    // the bag here is help rather than interruption.
    this.openCartDrawer();
  },

  renderTestimonials() {
    const container = document.getElementById("testimonialsGrid");
    if (!container) return;

    container.innerHTML = REJI_REVIEWS.map(
      review => `
      <div class="rf-review-card">
        <div class="rf-review-head">
          <div class="rf-review-person">
            <div class="rf-review-avatar">${Media.escapeHtml(review.avatar)}</div>
            <div>
              <h5>${Media.escapeHtml(review.name)}</h5>
              <span>${Media.escapeHtml(review.city)} · Verified buyer</span>
            </div>
          </div>
          <span class="rf-review-stars">${"★".repeat(review.rating)}</span>
        </div>
        <p class="rf-review-text">"${Media.escapeHtml(review.text)}"</p>
        <div class="rf-review-product">Purchased: ${Media.escapeHtml(review.product)}</div>
      </div>`
    ).join("");
  },

  /**
   * Countdown to the real end of the day rather than a hardcoded number, so it
   * doesn't reset to the same fake value on every page load.
   */
  startAnnouncementCountdown() {
    const el = document.getElementById("saleCountdown");
    if (!el) return;

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const tick = () => {
      const remaining = Math.max(0, Math.floor((endOfDay - Date.now()) / 1000));
      const hrs = String(Math.floor(remaining / 3600)).padStart(2, "0");
      const mins = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
      const secs = String(remaining % 60).padStart(2, "0");
      el.textContent = `${hrs}:${mins}:${secs}`;
    };

    tick();
    setInterval(tick, 1000);
  },

  /* ----------------------------------------------------------- events --- */

  bindEvents() {
    window.addEventListener("scroll", () => {
      document.querySelector(".rf-header")?.classList.toggle("scrolled", window.scrollY > 30);
    });

    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      this.closeCartDrawer();
      UIInteractions.closeQuickView();
      UIInteractions.closeSizeGuideModal();
      UIInteractions.closeCustomStudio();
    });

    this.bindSearch();

    document.querySelectorAll(".rf-cat-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".rf-cat-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        this.activeCategory = tab.dataset.cat || "all";
        this.showWishlistOnly = false;
        this.renderProducts();
      });
    });

    const on = (id, event, handler) => document.getElementById(id)?.addEventListener(event, handler);

    on("fabricFilter", "change", e => {
      this.activeFabric = e.target.value;
      this.renderProducts();
    });
    on("occasionFilter", "change", e => {
      this.activeOccasion = e.target.value;
      this.renderProducts();
    });
    on("priceSlider", "input", e => {
      this.maxPrice = Number(e.target.value);
      const label = document.getElementById("priceValDisplay");
      if (label) label.textContent = this.formatPrice(this.maxPrice);
      this.renderProducts();
    });
    on("sortSelector", "change", e => {
      this.activeSort = e.target.value;
      this.renderProducts();
    });

    const currency = document.getElementById("currencySelector");
    if (currency) {
      currency.value = this.currentCurrency;
      currency.addEventListener("change", e => this.setCurrency(e.target.value));
    }
  },

  bindSearch() {
    const input = document.getElementById("searchInput");
    const dropdown = document.getElementById("searchDropdown");
    if (!input || !dropdown) return;

    input.addEventListener("input", e => {
      const query = e.target.value.toLowerCase().trim();
      if (query.length < 2) {
        dropdown.classList.remove("active");
        return;
      }

      const matches = this.products
        .filter(p =>
          [p.name, p.fabric, p.category, p.subCategory, p.occasion, p.color]
            .join(" ")
            .toLowerCase()
            .includes(query)
        )
        .slice(0, 6);

      dropdown.innerHTML = matches.length
        ? matches
            .map(
              m => `
          <a class="rf-search-item" href="product.html?id=${encodeURIComponent(m.id)}">
            <div class="rf-search-thumb">${Media.thumb(m)}</div>
            <div>
              <div class="rf-search-name">${Media.escapeHtml(m.name)}</div>
              <div class="rf-search-meta">${Media.escapeHtml(m.fabric)} · ${this.formatPrice(m.price)}</div>
            </div>
          </a>`
            )
            .join("")
        : `<div class="rf-search-empty">No garments match "${Media.escapeHtml(e.target.value)}"</div>`;
      dropdown.classList.add("active");
    });

    document.addEventListener("click", e => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.remove("active");
    });
  }
};

window.AppState = AppState;
