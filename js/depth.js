/**
 * Reji Fashions - Depth effects.
 *
 * Cursor-tracked 3D tilt, pointer parallax and scroll reveals. Written natively
 * rather than pulling Vanilla-Tilt from a CDN, because the rest of this site
 * works with no network and no dependencies and that is worth keeping.
 *
 * Restraint is the point. The usual demo settings for this effect — 25° of
 * tilt, heavy glare, a 1.1 scale pop — look like a gaming site. Against silk
 * they look cheap. Everything here is tuned to the same Premium motion the
 * hero carousel uses: small angles, one easing curve, no overshoot.
 *
 * Never runs when: the pointer is coarse (no hover to track), the viewport is
 * small, or the visitor has asked for reduced motion.
 */

const Depth = (() => {
  "use strict";

  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const enabled = () => canHover() && !reduceMotion();

  /* ---------------------------------------------------------------- tilt --- */

  const TILT_DEFAULTS = {
    max: 7, // degrees. 25 is the library default and far too much for apparel.
    scale: 1.015,
    perspective: 900,
    glare: true,
    maxGlare: 0.16,
    lift: 10 // px of translateZ on the image, for a little separation
  };

  /**
   * @param {string} selector
   * @param {object} [options]
   */
  function tilt(selector, options = {}) {
    if (!enabled()) return;
    const opts = { ...TILT_DEFAULTS, ...options };

    document.querySelectorAll(selector).forEach(el => {
      if (el.dataset.depthTilt === "on") return; // already bound
      el.dataset.depthTilt = "on";

      let frame = null;
      let glareEl = null;

      if (opts.glare) {
        glareEl = document.createElement("span");
        glareEl.className = "rf-depth-glare";
        glareEl.setAttribute("aria-hidden", "true");
        el.appendChild(glareEl);
      }

      el.style.setProperty("--depth-perspective", `${opts.perspective}px`);

      const apply = (clientX, clientY) => {
        const rect = el.getBoundingClientRect();
        // -0.5 .. 0.5 from the centre of the card
        const px = (clientX - rect.left) / rect.width - 0.5;
        const py = (clientY - rect.top) / rect.height - 0.5;

        // Y rotation follows horizontal travel, X inverted so the card leans
        // toward the cursor rather than away from it.
        el.style.setProperty("--depth-ry", `${px * opts.max * 2}deg`);
        el.style.setProperty("--depth-rx", `${-py * opts.max * 2}deg`);
        el.style.setProperty("--depth-scale", opts.scale);
        el.style.setProperty("--depth-lift", `${opts.lift}px`);

        if (glareEl) {
          // Light source sits opposite the cursor, as it would in life.
          el.style.setProperty("--depth-glare-x", `${(0.5 - px) * 100}%`);
          el.style.setProperty("--depth-glare-y", `${(0.5 - py) * 100}%`);
          el.style.setProperty(
            "--depth-glare-opacity",
            String(Math.min(opts.maxGlare, (Math.abs(px) + Math.abs(py)) * opts.maxGlare * 1.6))
          );
        }
      };

      const onMove = e => {
        if (frame) return; // one update per frame, no more
        frame = requestAnimationFrame(() => {
          frame = null;
          apply(e.clientX, e.clientY);
        });
      };

      el.addEventListener("pointerenter", e => {
        // Promote to its own layer only while in use. Leaving will-change on
        // sixteen cards permanently costs memory for no benefit.
        el.style.willChange = "transform";
        el.classList.add("rf-depth-active");
        apply(e.clientX, e.clientY);
      });

      el.addEventListener("pointermove", onMove);

      el.addEventListener("pointerleave", () => {
        if (frame) {
          cancelAnimationFrame(frame);
          frame = null;
        }
        el.classList.remove("rf-depth-active");
        el.style.removeProperty("--depth-rx");
        el.style.removeProperty("--depth-ry");
        el.style.removeProperty("--depth-scale");
        el.style.removeProperty("--depth-lift");
        el.style.setProperty("--depth-glare-opacity", "0");
        // Let the settle transition finish before dropping the layer hint.
        setTimeout(() => (el.style.willChange = ""), 400);
      });
    });
  }

  /* ------------------------------------------------------------ parallax --- */

  /**
   * Shift an element a few pixels against the pointer. Composed through custom
   * properties so it can coexist with a transform the stylesheet already owns
   * — writing to style.transform here would fight the carousel's scale.
   */
  function parallax(selector, depthPx = 12) {
    if (!enabled()) return;
    const el = document.querySelector(selector);
    if (!el || el.dataset.depthParallax === "on") return;
    el.dataset.depthParallax = "on";

    let frame = null;
    const onMove = e => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        el.style.setProperty("--depth-px", `${-px * depthPx}px`);
        el.style.setProperty("--depth-py", `${-py * depthPx}px`);
      });
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--depth-px", "0px");
      el.style.setProperty("--depth-py", "0px");
    });
  }

  /* -------------------------------------------------------------- reveal --- */

  /**
   * Rise-and-fade as elements enter the viewport, staggered within each batch.
   *
   * Unlike tilt this stays on for touch devices — it is the effect that gives
   * the page its sense of depth on a phone. It still respects reduced motion.
   */
  function reveal(selector, { stagger = 60, max = 4 } = {}) {
    const nodes = [...document.querySelectorAll(selector)].filter(n => !n.dataset.depthReveal);
    if (!nodes.length) return;

    if (reduceMotion() || !("IntersectionObserver" in window)) {
      nodes.forEach(n => n.classList.add("rf-depth-shown"));
      return;
    }

    nodes.forEach(n => {
      n.dataset.depthReveal = "pending";
      n.classList.add("rf-depth-reveal");
    });

    const show = el => {
      el.classList.add("rf-depth-shown");
      el.dataset.depthReveal = "done";
    };

    const observer = new IntersectionObserver(
      (entries, obs) => {
        // Stagger only within what arrived together, capped so a long grid
        // never leaves the last card waiting half a second.
        let i = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.style.transitionDelay = `${Math.min(i, max) * stagger}ms`;
          show(entry.target);
          obs.unobserve(entry.target);
          i++;
        }
      },
      // threshold 0, not a fraction: a product card can be taller than a short
      // viewport, and a fractional threshold it can never satisfy would leave
      // the card invisible forever. Any intersection at all is enough.
      { rootMargin: "0px 0px -6% 0px", threshold: 0 }
    );

    nodes.forEach(n => observer.observe(n));

    // Fail open. Hiding content behind an animation means any edge case in the
    // observer — a display quirk, a detached container, a browser bug — shows
    // the customer an empty shop. After three seconds, anything still waiting
    // is simply shown.
    setTimeout(() => {
      nodes.forEach(n => {
        if (n.dataset.depthReveal === "pending") {
          observer.unobserve(n);
          n.style.transitionDelay = "0ms";
          show(n);
        }
      });
    }, 3000);
  }

  /** Re-apply after a re-render. Everything here is idempotent. */
  function refresh() {
    tilt(".rf-product-card");
    reveal(".rf-product-card");
    reveal(".rf-review-card, .rf-how-step, .rf-val-card, .rf-lookbook-card");
    parallax(".rf-hero-carousel", 14);
  }

  return { tilt, parallax, reveal, refresh, enabled };
})();

if (typeof window !== "undefined") window.Depth = Depth;
