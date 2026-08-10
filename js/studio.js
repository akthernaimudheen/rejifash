/**
 * Reji Fashions — Studio storefront.
 *
 * A different skin, not a different shop. The catalog grid, category tabs,
 * fabric/occasion/price filters, sort, search, wishlist, currency, quick view,
 * size selection, lookbooks and reviews are all the same code that runs
 * index.html — AppState.init() drives them here exactly as it does there.
 *
 * An earlier version of this page hand-rolled a six-item rail and quietly
 * dropped every one of those. Restyle the storefront; never rebuild it with
 * less.
 *
 * What lives here is only what is unique to this surface: the scrubbed hero,
 * the marquee, the cursor and the section reveals.
 */

const Studio = {
  async init() {
    await RejiAPI.init();
    SiteChrome.mount();

    // The whole storefront, wired identically to the classic page.
    await AppState.init();

    this.renderHeroFigure();
    this.renderTicker();
    this.renderMadeFigure();

    this.bindCursor();
    this.bindHeroScrub();
    this.bindReveals();

    requestAnimationFrame(() => document.body.classList.add("is-ready"));
  },

  esc(t) {
    return Media.escapeHtml(t);
  },

  photographed() {
    return AppState.products.filter(p => Media.hasPhotos(p));
  },

  /* ---------------------------------------------------------------- hero --- */

  renderHeroFigure() {
    const figure = document.getElementById("stHeroFigure");
    const p = this.photographed()[0];
    if (!figure || !p) return;
    const shot = Media.gallery(p)[0];

    figure.innerHTML = `
      <a href="product.html?id=${encodeURIComponent(p.id)}" aria-label="${this.esc(p.name)}">
        <img src="${this.esc(shot.zoomSrc || shot.src)}" alt="${this.esc(shot.alt || p.name)}"
             fetchpriority="high" decoding="async">
        <figcaption>
          <b>${this.esc(p.name)}</b>
          <span>${AppState.formatPrice(p.price)}</span>
        </figcaption>
      </a>`;
  },

  /**
   * Scrub the hero from the sticky section's own geometry. Read-only, on a
   * passive listener — native scrolling is never intercepted.
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

    addEventListener("scroll", () => {
      if (!frame) frame = requestAnimationFrame(update);
    }, { passive: true });
    addEventListener("resize", update, { passive: true });
    update();
  },

  /* -------------------------------------------------------------- ticker --- */

  renderTicker() {
    const track = document.getElementById("stTicker");
    if (!track) return;
    const words = this.photographed().map(p => p.color || p.name);
    if (!words.length) return;
    const run = [...words, "made to measure", ...words, "made to measure"];
    track.innerHTML = run.map(w => `<span>${this.esc(w)}<i> — </i></span>`).join("");
  },

  renderMadeFigure() {
    const mount = document.getElementById("stMadeFigure");
    const list = this.photographed();
    const p = list[2] || list[1] || list[0];
    if (!mount || !p) return;
    const shot = Media.gallery(p)[0];
    mount.outerHTML = `<img src="${this.esc(shot.zoomSrc || shot.src)}"
                            alt="${this.esc(shot.alt || p.name)}" loading="lazy" decoding="async">`;
  },

  /* ------------------------------------------------------------- cursor --- */

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

    addEventListener("pointermove", e => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
    }, { passive: true });

    // The ring lags the dot; the delay is what makes it read as a cursor
    // rather than a decal stuck to the pointer.
    const loop = () => {
      rx += (mx - rx) * 0.14;
      ry += (my - ry) * 0.14;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(loop);
    };
    loop();

    const hot = "a, button, input, select, textarea, [role='button'], .rf-product-card";
    document.addEventListener("pointerover", e => {
      if (e.target.closest(hot)) cursor.classList.add("is-hot");
    });
    document.addEventListener("pointerout", e => {
      if (e.target.closest(hot)) cursor.classList.remove("is-hot");
    });
  },

  /* ------------------------------------------------------------ reveals --- */

  bindReveals() {
    const nodes = document.querySelectorAll(
      ".st-section-head, .st-made-media, .st-made-copy, .st-steps li, .rf-val-card"
    );
    if (!nodes.length) return;

    const show = n => n.classList.add("is-in");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      nodes.forEach(show);
      return;
    }

    nodes.forEach(n => n.classList.add("st-reveal"));
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry, i) => {
        if (!entry.isIntersecting) return;
        entry.target.style.transitionDelay = `${Math.min(i, 4) * 70}ms`;
        show(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: "0px 0px -6% 0px" });

    nodes.forEach(n => io.observe(n));

    // Fail visible: content hidden behind an animation that never fires is a
    // blank page. This has bitten this project once already.
    setTimeout(() => nodes.forEach(show), 3000);
  }
};

window.Studio = Studio;
document.addEventListener("DOMContentLoaded", () => Studio.init());
