/**
 * Reji Fashions — Studio storefront.
 *
 * The futuristic-minimal alternative to index.html. Same catalog, same cart,
 * same checkout; a completely different surface.
 *
 * Two rules held throughout:
 *
 *   Never hijack the scroll. The hero is scrubbed by reading a sticky
 *   section's own position, so momentum, keyboard paging and the scrollbar all
 *   behave exactly as the browser intends. No wheel handlers, no fake inertia.
 *
 *   Fail visible. Every reveal begins hidden, so any of them failing to fire
 *   would leave a blank page. All of it opens after a timeout regardless.
 */

const Studio = {
  products: [],

  async init() {
    await RejiAPI.init();
    SiteChrome.mount();

    const { products, coupons } = await RejiAPI.getProducts();
    AppState.products = products;
    AppState.coupons = coupons;
    AppState.loadPersistedState();

    // Only photographed pieces belong on a page this bare — generated artwork
    // would be obvious against full-bleed photography.
    this.products = products.filter(p => Media.hasPhotos(p));

    this.renderHero();
    this.renderTicker();
    this.renderRail();
    this.renderMade();
    this.bindNav();
    this.bindCursor();
    this.bindHeroScrub();
    this.bindReveals();
    this.syncBag();

    document.getElementById("stWhatsapp").href = RejiAPI.waLink(
      RejiAPI.config.merchant.whatsappNumber,
      "Hi Reji Fashions, I have a question about a churidar set."
    );

    requestAnimationFrame(() => document.body.classList.add("is-ready"));
  },

  esc(t) {
    return Media.escapeHtml(t);
  },

  /* ---------------------------------------------------------------- hero --- */

  renderHero() {
    const p = this.products[0];
    const figure = document.getElementById("stHeroFigure");
    if (!p || !figure) return;
    const shot = Media.gallery(p)[0];

    figure.innerHTML = `
      <img src="${this.esc(shot.zoomSrc || shot.src)}" alt="${this.esc(shot.alt || p.name)}"
           fetchpriority="high" decoding="async">
      <figcaption>
        <b>${this.esc(p.name)}</b>
        <span>${AppState.formatPrice(p.price)}</span>
      </figcaption>`;
  },

  /**
   * Scrub the hero from the sticky section's own geometry.
   * Read-only on scroll — nothing here changes scroll behaviour.
   */
  bindHeroScrub() {
    const section = document.getElementById("stHero");
    const figure = document.getElementById("stHeroFigure");
    if (!section || !figure) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(max-width: 900px)").matches) return;

    let frame = null;
    const update = () => {
      frame = null;
      const rect = section.getBoundingClientRect();
      const travel = section.offsetHeight - window.innerHeight;
      if (travel <= 0) return;
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      figure.style.setProperty("--hero-scale", (1.06 - progress * 0.14).toFixed(4));
      figure.style.setProperty("--hero-y", `${(-progress * 60).toFixed(1)}px`);
    };

    addEventListener(
      "scroll",
      () => {
        if (!frame) frame = requestAnimationFrame(update);
      },
      { passive: true }
    );
    addEventListener("resize", update, { passive: true });
    update();
  },

  /* -------------------------------------------------------------- ticker --- */

  renderTicker() {
    const track = document.getElementById("stTicker");
    if (!track) return;
    const words = this.products.map(p => p.color || p.name);
    // Duplicated once so the -50% marquee loop is seamless.
    const run = [...words, "made to measure", ...words, "made to measure"];
    track.innerHTML = run.map(w => `<span>${this.esc(w)}<i> — </i></span>`).join("");
  },

  /* ---------------------------------------------------------------- rail --- */

  renderRail() {
    const rail = document.getElementById("stRail");
    if (!rail) return;

    rail.innerHTML = this.products
      .map((p, i) => {
        const shot = Media.gallery(p)[0];
        return `
        <a class="st-card" href="product.html?id=${encodeURIComponent(p.id)}">
          <div class="st-card-media">
            <img src="${this.esc(shot.src)}" alt="${this.esc(shot.alt || p.name)}"
                 loading="${i < 2 ? "eager" : "lazy"}" decoding="async">
            <span class="st-card-index">${String(i + 1).padStart(2, "0")}</span>
            <button class="st-card-add" data-add="${this.esc(p.id)}"
                    aria-label="Add ${this.esc(p.name)} to bag">+</button>
          </div>
          <div class="st-card-foot">
            <span class="st-card-name">${this.esc(p.name)}</span>
            <span class="st-card-price">${AppState.formatPrice(p.price)}</span>
          </div>
          <div class="st-card-meta">${this.esc(p.subCategory || "Churidar set")}</div>
        </a>`;
      })
      .join("");

    // Add-to-bag lives inside the card link, so stop it navigating.
    rail.addEventListener("click", e => {
      const btn = e.target.closest("[data-add]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      AppState.addToCart(btn.dataset.add, "M");
      this.syncBag();
    });

    this.bindRailNav(rail);
  },

  bindRailNav(rail) {
    const prev = document.getElementById("stRailPrev");
    const next = document.getElementById("stRailNext");
    if (!prev || !next) return;

    const step = () => rail.querySelector(".st-card")?.getBoundingClientRect().width + 16 || 320;
    prev.addEventListener("click", () => rail.scrollBy({ left: -step(), behavior: "smooth" }));
    next.addEventListener("click", () => rail.scrollBy({ left: step(), behavior: "smooth" }));

    const sync = () => {
      const max = rail.scrollWidth - rail.clientWidth - 2;
      prev.disabled = rail.scrollLeft <= 2;
      next.disabled = rail.scrollLeft >= max;
    };
    rail.addEventListener("scroll", sync, { passive: true });
    addEventListener("resize", sync, { passive: true });
    sync();
  },

  /* ---------------------------------------------------------------- made --- */

  renderMade() {
    const mount = document.getElementById("stMadeFigure");
    const p = this.products[2] || this.products[1] || this.products[0];
    if (!mount || !p) return;
    const shot = Media.gallery(p)[0];
    mount.outerHTML = `<img src="${this.esc(shot.zoomSrc || shot.src)}"
                            alt="${this.esc(shot.alt || p.name)}" loading="lazy" decoding="async">`;
  },

  /* ----------------------------------------------------------------- ui --- */

  bindNav() {
    const nav = document.getElementById("stNav");
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("is-stuck", window.scrollY > 40);
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  },

  syncBag() {
    const el = document.getElementById("stBagCount");
    if (el) el.textContent = AppState.cart.reduce((s, i) => s + i.quantity, 0);
  },

  bindCursor() {
    const cursor = document.querySelector(".st-cursor");
    const dot = document.querySelector(".st-cursor-dot");
    const ring = document.querySelector(".st-cursor-ring");
    if (!cursor || !dot || !ring) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let mx = innerWidth / 2;
    let my = innerHeight / 2;
    let rx = mx;
    let ry = my;

    addEventListener(
      "pointermove",
      e => {
        mx = e.clientX;
        my = e.clientY;
        dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      },
      { passive: true }
    );

    // The ring lags the dot — the delay is what makes it read as a cursor
    // rather than a decal stuck to the pointer.
    const loop = () => {
      rx += (mx - rx) * 0.14;
      ry += (my - ry) * 0.14;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(loop);
    };
    loop();

    const hot = "a, button, input, select, textarea, [role='button']";
    document.addEventListener("pointerover", e => {
      if (e.target.closest(hot)) cursor.classList.add("is-hot");
    });
    document.addEventListener("pointerout", e => {
      if (e.target.closest(hot)) cursor.classList.remove("is-hot");
    });
  },

  bindReveals() {
    const nodes = document.querySelectorAll(
      ".st-section-head, .st-rail, .st-made-media, .st-made-copy, .st-steps li, .st-foot-row"
    );
    if (!nodes.length) return;

    const show = n => n.classList.add("is-in");

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      nodes.forEach(n => show(n));
      return;
    }

    nodes.forEach(n => n.classList.add("st-reveal"));
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry, i) => {
          if (!entry.isIntersecting) return;
          entry.target.style.transitionDelay = `${Math.min(i, 4) * 70}ms`;
          show(entry.target);
          obs.unobserve(entry.target);
        });
      },
      // threshold 0: a full-height section can never satisfy a fractional one
      // on a short viewport, and content hidden behind it would never appear.
      { threshold: 0, rootMargin: "0px 0px -6% 0px" }
    );
    nodes.forEach(n => io.observe(n));

    // Fail visible, whatever happens above.
    setTimeout(() => nodes.forEach(n => show(n)), 3000);
  }
};

window.Studio = Studio;
document.addEventListener("DOMContentLoaded", () => Studio.init());
