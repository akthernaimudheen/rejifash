/**
 * Reji Fashions - Product detail page.
 *
 * Modelled on how the big marketplaces present apparel, because the pattern
 * works: a fixed-geometry gallery with a thumbnail rail and hover zoom, a
 * scannable highlights list before the prose, a full specification table, and
 * — the part most small shops skip — a written description of what each
 * photograph is actually showing.
 */

const ProductPage = {
  product: null,
  activeIndex: 0,
  selectedSize: null,
  quantity: 1,

  async init() {
    await RejiAPI.init();
    // The header, bag drawer and checkout modal all come from SiteChrome, and
    // everything below depends on those nodes existing.
    SiteChrome.mount();

    const { products, coupons } = await RejiAPI.getProducts();
    AppState.products = products;
    AppState.coupons = coupons;
    AppState.loadPersistedState();
    AppState.updateCounters();
    AppState.startAnnouncementCountdown();

    const id = new URLSearchParams(location.search).get("id");
    this.product = products.find(p => p.id === id);

    if (!this.product) {
      document.getElementById("pdpRoot").innerHTML = `
        <div class="rf-empty-state">
          <div class="rf-empty-icon">🧵</div>
          <h3>We couldn't find that design</h3>
          <p>It may have sold out or been renamed.</p>
          <a class="btn btn-wine" href="index.html#catalog">Browse the collection</a>
        </div>`;
      return;
    }

    document.title = `${this.product.name} | Reji Fashions`;
    this.selectedSize = this.product.sizes.includes("M") ? "M" : this.product.sizes[0];

    this.render();
    this.renderRelated(products);
    AppState.bindSearch();
    this.bindHeader();
  },

  bindHeader() {
    const currency = document.getElementById("currencySelector");
    if (currency) {
      currency.value = AppState.currentCurrency;
      currency.addEventListener("change", e => {
        AppState.setCurrency(e.target.value);
        this.render();
      });
    }
    window.addEventListener("scroll", () => {
      document.querySelector(".rf-header")?.classList.toggle("scrolled", window.scrollY > 30);
    });
  },

  esc(text) {
    return Media.escapeHtml(text);
  },

  /* ---------------------------------------------------------- gallery --- */

  renderGallery() {
    const shots = Media.gallery(this.product);

    if (!shots.length) {
      // No photographs uploaded yet — show the generated artwork, and say so
      // rather than pretending it's a photo.
      return `
        <div class="rf-pdp-gallery">
          <div class="rf-pdp-stage">
            ${Media.frame(this.product, { variant: "hero", eager: true })}
            <div class="rf-pdp-art-note">
              Illustrated preview · studio photography for this design is being shot
            </div>
          </div>
        </div>`;
    }

    const active = shots[this.activeIndex] || shots[0];

    return `
      <div class="rf-pdp-gallery">
        <div class="rf-pdp-rail">
          ${shots
            .map(
              (shot, i) => `
            <button class="rf-pdp-thumb ${i === this.activeIndex ? "active" : ""}"
                    onmouseenter="ProductPage.setImage(${i})"
                    onclick="ProductPage.setImage(${i})"
                    aria-label="${this.esc(shot.alt)}">
              <img src="${this.esc(shot.src)}" alt="" loading="lazy" decoding="async">
              <span>${this.esc(shot.shot)}</span>
            </button>`
            )
            .join("")}
        </div>

        <div class="rf-pdp-stage">
          <figure class="rf-pdp-main" id="pdpZoomTarget"
                  onmousemove="ProductPage.zoomMove(event)"
                  onmouseleave="ProductPage.zoomEnd()">
            <img id="pdpMainImage" src="${this.esc(active.zoomSrc || active.src)}"
                 alt="${this.esc(active.alt)}" decoding="async">
          </figure>
          ${
            active.caption || active.detail
              ? `<figcaption class="rf-pdp-caption">
                   <strong>${this.esc(active.caption)}</strong>
                   ${active.detail ? `<span>${this.esc(active.detail)}</span>` : ""}
                 </figcaption>`
              : ""
          }
          <p class="rf-pdp-zoom-hint">🔍 Hover over the image to zoom</p>
        </div>
      </div>`;
  },

  setImage(index) {
    this.activeIndex = index;
    const gallery = document.querySelector(".rf-pdp-gallery");
    if (gallery) gallery.outerHTML = this.renderGallery();
  },

  /** Background-position zoom: cheap, smooth, and no library needed. */
  zoomMove(event) {
    const figure = event.currentTarget;
    const img = figure.querySelector("img");
    if (!img) return;
    const rect = figure.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    img.style.transformOrigin = `${x}% ${y}%`;
    img.style.transform = "scale(2.2)";
  },

  zoomEnd() {
    const img = document.getElementById("pdpMainImage");
    if (img) img.style.transform = "scale(1)";
  },

  /* -------------------------------------------------------- buy panel --- */

  renderBuyPanel() {
    const p = this.product;
    const saving = p.originalPrice - p.price;

    return `
      <div class="rf-pdp-buy">
        <nav class="rf-breadcrumb">
          <a href="index.html">Home</a> ›
          <a href="index.html#catalog">${this.esc(p.category)}</a> ›
          <span>${this.esc(p.subCategory)}</span>
        </nav>

        <h1 class="rf-pdp-title">${this.esc(p.name)}</h1>
        <p class="rf-pdp-tagline">${this.esc(p.tagline)}</p>

        <div class="rf-pdp-rating-row">
          <span class="rf-rating-pill">${p.rating} ★</span>
          <span class="rf-rating-count">${p.reviewsCount} ratings</span>
          ${p.isBestseller ? `<span class="rf-badge rf-badge-gold">Bestseller</span>` : ""}
          ${p.isNew ? `<span class="rf-badge rf-badge-emerald">New arrival</span>` : ""}
        </div>

        <div class="rf-pdp-price-row">
          <span class="rf-pdp-price">${AppState.formatPrice(p.price)}</span>
          <span class="rf-pdp-mrp">${AppState.formatPrice(p.originalPrice)}</span>
          <span class="rf-pdp-off">${this.esc(p.discount)}</span>
        </div>
        <p class="rf-pdp-saving">You save ${AppState.formatPrice(saving)} · inclusive of all taxes</p>

        <div class="rf-pdp-offers">
          <h4>Available offers</h4>
          <ul>
            ${Object.entries(AppState.coupons)
              .map(
                ([code, c]) =>
                  `<li><span class="rf-offer-tag">${code}</span> ${this.esc(c.description)}
                   <em>on orders above ${AppState.formatPrice(c.minSpend)}</em></li>`
              )
              .join("")}
            <li><span class="rf-offer-tag">FREE</span> Express delivery on orders above
              ${AppState.formatPrice(RejiAPI.config.store.freeShippingThreshold)}</li>
          </ul>
        </div>

        <div class="rf-pdp-block">
          <div class="rf-pdp-block-head">
            <h4>Select size</h4>
            <button class="rf-text-link" onclick="UIInteractions.openSizeGuideModal()">📏 Size guide</button>
          </div>
          <div class="rf-pdp-sizes">
            ${p.sizes
              .map(
                size => `
              <button class="rf-size-chip ${size === this.selectedSize ? "selected" : ""}"
                      onclick="ProductPage.selectSize('${size}')">${size}</button>`
              )
              .join("")}
          </div>
          <button class="rf-text-link" onclick="UIInteractions.openCustomStudio('${p.id}')">
            ✂️ None of these fit? Get it stitched to your measurements — no extra charge
          </button>
        </div>

        <div class="rf-pdp-block rf-pdp-qty-row">
          <h4>Quantity</h4>
          <div class="rf-qty-selector">
            <button class="rf-qty-btn" onclick="ProductPage.setQuantity(-1)" aria-label="Decrease">−</button>
            <span class="rf-qty-num" id="pdpQty">${this.quantity}</span>
            <button class="rf-qty-btn" onclick="ProductPage.setQuantity(1)" aria-label="Increase">+</button>
          </div>
          <span class="rf-pdp-stock ${p.stock <= 5 ? "low" : ""}">
            ${p.stock <= 5 ? `Only ${p.stock} left in stock` : "In stock"}
          </span>
        </div>

        <div class="rf-pdp-cta">
          <button class="btn btn-outline btn-lg" onclick="ProductPage.addToBag()">🛍️ Add to bag</button>
          <button class="btn btn-wine btn-lg" onclick="ProductPage.buyNow()">⚡ Buy now</button>
        </div>

        <div class="rf-pdp-delivery">
          <label for="pdpPincode">Delivery</label>
          <div class="rf-pdp-pin-row">
            <input type="text" id="pdpPincode" maxlength="6" inputmode="numeric" placeholder="Enter PIN code">
            <button class="rf-text-link" onclick="ProductPage.checkDelivery()">Check</button>
          </div>
          <div id="pdpDeliveryResult" class="rf-pdp-delivery-result"></div>
        </div>

        <ul class="rf-pdp-assurance">
          <li>🧵 100% pure fabric, verified weave</li>
          <li>✂️ Free made-to-measure tailoring</li>
          <li>🔄 7-day easy returns</li>
          <li>⚡ Pay securely by UPI or on delivery</li>
        </ul>
      </div>`;
  },

  selectSize(size) {
    this.selectedSize = size;
    this.render();
  },

  setQuantity(delta) {
    this.quantity = Math.max(1, Math.min(10, this.quantity + delta));
    const el = document.getElementById("pdpQty");
    if (el) el.textContent = this.quantity;
  },

  addToBag() {
    for (let i = 0; i < this.quantity; i++) {
      AppState.addToCart(this.product.id, this.selectedSize);
    }
  },

  buyNow() {
    this.addToBag();
    AppState.closeCartDrawer();
    CheckoutEngine.openCheckoutModal();
  },

  checkDelivery() {
    const pin = document.getElementById("pdpPincode")?.value.trim() || "";
    const target = document.getElementById("pdpDeliveryResult");
    if (!target) return;

    if (!/^\d{6}$/.test(pin)) {
      target.innerHTML = `<span class="rf-inline-warn">Enter a valid 6-digit PIN code</span>`;
      return;
    }
    const metro = /^[15678]/.test(pin);
    const eta = new Date(Date.now() + (metro ? 3 : 5) * 86400000);
    target.innerHTML = `<span class="rf-inline-ok">✓ Delivers by ${eta.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short"
    })} · ${metro ? "FREE express" : "Standard"} delivery</span>`;
  },

  /* ----------------------------------------------------------- detail --- */

  renderHighlights() {
    const highlights = this.product.highlights?.length
      ? this.product.highlights
      : [this.product.fabric, this.product.subCategory, this.product.occasion].filter(Boolean);

    return `
      <section class="rf-pdp-section">
        <h3>Highlights</h3>
        <ul class="rf-pdp-highlights">
          ${highlights.map(h => `<li>${this.esc(h)}</li>`).join("")}
        </ul>
      </section>`;
  },

  renderDescription() {
    return `
      <section class="rf-pdp-section">
        <h3>About this garment</h3>
        <p class="rf-pdp-description">${this.esc(this.product.description)}</p>
        ${
          this.product.inTheBox
            ? `<p class="rf-pdp-inbox"><strong>What's in the box:</strong> ${this.esc(this.product.inTheBox)}</p>`
            : ""
        }
      </section>`;
  },

  renderSpecifications() {
    const p = this.product;
    // Skip anything not filled in yet rather than printing an empty row —
    // a blank "Fabric:" reads as a broken page, not as missing data.
    const general = Object.fromEntries(
      Object.entries({
        "Product code": p.id,
        Category: p.subCategory,
        Colour: p.color,
        Fabric: p.fabric,
        Occasion: p.occasion,
        "Available sizes": (p.sizes || []).join(", ")
      }).filter(([, v]) => v)
    );

    const table = (title, rows) => `
      <div class="rf-spec-group">
        <h4>${title}</h4>
        <table class="rf-spec-table">
          <tbody>
            ${Object.entries(rows)
              .map(([k, v]) => `<tr><th>${this.esc(k)}</th><td>${this.esc(v)}</td></tr>`)
              .join("")}
          </tbody>
        </table>
      </div>`;

    return `
      <section class="rf-pdp-section">
        <h3>Specifications</h3>
        ${table("General", general)}
        ${table("Fabric &amp; construction", p.details || {})}
      </section>`;
  },

  /**
   * The written guide to the photographs. Shoppers buying ethnic wear online
   * mostly want to know "what am I looking at in this picture" — colour under
   * daylight, where the zari sits, how sheer the dupatta is. This makes that
   * explicit instead of leaving it to the image.
   */
  renderImageGuide() {
    const shots = Media.gallery(this.product);
    if (!shots.length) return "";

    return `
      <section class="rf-pdp-section">
        <h3>What you're seeing in each photo</h3>
        <div class="rf-image-guide">
          ${shots
            .map(
              (shot, i) => `
            <div class="rf-image-guide-row">
              <button class="rf-image-guide-thumb" onclick="ProductPage.setImage(${i}); window.scrollTo({top:0,behavior:'smooth'})">
                <img src="${this.esc(shot.src)}" alt="${this.esc(shot.alt)}" loading="lazy">
              </button>
              <div>
                <h5>${this.esc(shot.caption || shot.shot)}</h5>
                <p>${this.esc(shot.detail || shot.alt)}</p>
              </div>
            </div>`
            )
            .join("")}
        </div>
        <p class="rf-pdp-colour-note">
          📸 All photographs are shot on the same studio backdrop under neutral light.
          Screen calibration can still shift colour slightly — the colour name above
          (<strong>${this.esc(this.product.color)}</strong>) is the reference.
        </p>
      </section>`;
  },

  renderReviews() {
    const relevant = (typeof REJI_REVIEWS !== "undefined" ? REJI_REVIEWS : []).filter(r =>
      this.product.name.toLowerCase().includes(r.product.split(" ")[0].toLowerCase())
    );
    const reviews = relevant.length ? relevant : (typeof REJI_REVIEWS !== "undefined" ? REJI_REVIEWS : []).slice(0, 2);
    if (!reviews.length) return "";

    return `
      <section class="rf-pdp-section">
        <h3>Ratings &amp; reviews</h3>
        <div class="rf-pdp-rating-summary">
          <div class="rf-pdp-rating-big">${this.product.rating}<span>★</span></div>
          <div>
            <strong>${this.product.reviewsCount} ratings</strong>
            <p>Based on verified purchases</p>
          </div>
        </div>
        <div class="rf-pdp-reviews">
          ${reviews
            .map(
              r => `
            <div class="rf-pdp-review">
              <div class="rf-pdp-review-head">
                <span class="rf-rating-pill">${r.rating} ★</span>
                <strong>${this.esc(r.name)}</strong>
                <span class="rf-verified">✓ Verified buyer · ${this.esc(r.city)}</span>
              </div>
              <p>${this.esc(r.text)}</p>
              <span class="rf-pdp-review-date">${this.esc(r.date)}</span>
            </div>`
            )
            .join("")}
        </div>
      </section>`;
  },

  renderRelated(products) {
    const container = document.getElementById("pdpRelated");
    if (!container) return;

    const related = products
      .filter(p => p.id !== this.product.id && p.category === this.product.category)
      .slice(0, 4);
    if (!related.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
      <div class="container">
        <div class="section-header">
          <span class="section-subtitle">You may also like</span>
          <h2 class="section-title">Similar <em>Designs</em></h2>
        </div>
        <div class="rf-products-grid">
          ${related.map((p, i) => AppState.renderProductCard(p, i)).join("")}
        </div>
      </div>`;
  },

  render() {
    const root = document.getElementById("pdpRoot");
    if (!root) return;

    root.innerHTML = `
      <div class="rf-pdp-layout">
        <div class="rf-pdp-left">${this.renderGallery()}</div>
        <div class="rf-pdp-right">${this.renderBuyPanel()}</div>
      </div>

      <div class="rf-pdp-detail">
        ${this.renderHighlights()}
        ${this.renderDescription()}
        ${this.renderImageGuide()}
        ${this.renderSpecifications()}
        ${this.renderReviews()}
      </div>

      <div class="rf-pdp-sticky">
        <div class="rf-pdp-sticky-price">
          <strong>${AppState.formatPrice(this.product.price)}</strong>
          <span>Size ${this.esc(this.selectedSize)}</span>
        </div>
        <button class="btn btn-outline btn-sm" onclick="ProductPage.addToBag()">Add to bag</button>
        <button class="btn btn-wine btn-sm" onclick="ProductPage.buyNow()">Buy now</button>
      </div>`;
  }
};

window.ProductPage = ProductPage;
document.addEventListener("DOMContentLoaded", () => ProductPage.init());
