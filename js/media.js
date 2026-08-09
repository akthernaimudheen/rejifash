/**
 * Reji Fashions - Product media presentation.
 *
 * One rule, enforced in one place: every product image on the site is shown
 * inside an identical 3:4 studio frame with a fixed backdrop, and is fitted
 * with `contain` rather than cropped. That is what stops a mixed bag of phone
 * photos, studio shots and generated artwork from looking like a jumble sale.
 *
 * If a product has no photograph yet, the frame falls back to the generated
 * SVG artwork, so the grid never has holes in it.
 */

const Media = (() => {
  "use strict";

  /** All usable images for a product, primary first. */
  function gallery(product) {
    const media = (product?.media || []).filter(m => m && m.src);
    if (!media.length) return [];
    const sorted = [...media].sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0));
    return sorted.map((m, index) => ({
      src: m.src,
      zoomSrc: m.zoomSrc || m.src,
      alt: m.alt || `${product.name} — image ${index + 1}`,
      caption: m.caption || "",
      detail: m.detail || "",
      shot: m.shot || (index === 0 ? "front" : "detail"),
      kind: "photo"
    }));
  }

  function hasPhotos(product) {
    return gallery(product).length > 0;
  }

  function primary(product) {
    const shots = gallery(product);
    if (shots.length) return shots[0];
    return { kind: "art", src: null, alt: product?.name || "Garment", caption: "", detail: "" };
  }

  function escapeHtml(text) {
    return String(text ?? "").replace(/[&<>"']/g, ch =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])
    );
  }

  /**
   * A single framed image. `variant` only changes the loading strategy and the
   * frame class — the geometry is deliberately identical everywhere.
   */
  function frame(product, options = {}) {
    const { variant = "card", index = 0, eager = false, showCaption = false } = options;
    const shots = gallery(product);
    const shot = shots[index] || shots[0];

    if (!shot) {
      // No photograph: fall back to the generated illustration.
      const art = typeof VisualEngine !== "undefined" ? VisualEngine.renderProductVisual(product, "front") : "";
      return `<figure class="rf-media rf-media--${variant} rf-media--art">${art}</figure>`;
    }

    const caption =
      showCaption && (shot.caption || shot.detail)
        ? `<figcaption class="rf-media-caption">${escapeHtml(shot.caption || shot.detail)}</figcaption>`
        : "";

    return `
      <figure class="rf-media rf-media--${variant} rf-media--photo">
        <img src="${escapeHtml(shot.src)}"
             alt="${escapeHtml(shot.alt)}"
             loading="${eager ? "eager" : "lazy"}"
             decoding="async">
        ${caption}
      </figure>`;
  }

  /** Small square thumb for cart rows, search results and admin tables. */
  function thumb(product) {
    const shot = primary(product);
    if (shot.kind === "art") {
      const art = typeof VisualEngine !== "undefined" ? VisualEngine.renderProductVisual(product, "front") : "";
      return `<div class="rf-media-thumb rf-media-thumb--art">${art}</div>`;
    }
    return `<div class="rf-media-thumb"><img src="${escapeHtml(shot.src)}" alt="${escapeHtml(
      shot.alt
    )}" loading="lazy" decoding="async"></div>`;
  }

  return { gallery, hasPhotos, primary, frame, thumb, escapeHtml };
})();

if (typeof window !== "undefined") window.Media = Media;
