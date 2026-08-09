/**
 * Reji Fashions - Image Studio.
 *
 * Turns a raw phone photo of a garment into catalog imagery that matches the
 * rest of the site. This is the single biggest lever on "does the shop look
 * professional", and it is exactly what the big marketplaces standardise:
 * one aspect ratio, one background, one exposure, one crop discipline.
 *
 * The pipeline, in order:
 *
 *   1. Load with EXIF orientation applied (phone photos are usually rotated).
 *   2. Estimate the backdrop colour from the frame border.
 *   3. Find the garment's bounding box, crop to it with breathing room, then
 *      extend to the catalog aspect ratio (3:4).
 *   4. Neutralise the white balance using the backdrop as the grey reference.
 *   5. Auto-level using histogram percentiles, then a gentle contrast curve
 *      and saturation lift.
 *   6. Fade the backdrop out to a clean studio white, feathered so edges and
 *      loose fabric/dupatta fringes don't get chewed up.
 *   7. Composite onto an ivory studio gradient with a contact shadow.
 *   8. Export the four sizes the site uses, plus a colour reading that
 *      pre-fills the product's swatch fields.
 *
 * Everything runs in the browser on canvas — no upload, no service, no key.
 */

const ImageStudio = (() => {
  "use strict";

  // 3:4 portrait, the standard for apparel catalog imagery.
  const ASPECT = 3 / 4;

  const OUTPUT_SIZES = {
    zoom: { width: 1200, label: "Zoom" },
    main: { width: 800, label: "Gallery" },
    card: { width: 500, label: "Card" },
    thumb: { width: 160, label: "Thumbnail" }
  };

  const DEFAULTS = {
    // How different from the backdrop a pixel must be to count as garment.
    subjectThreshold: 34,
    // Fraction of the crop kept as margin around the garment.
    padding: 0.08,
    cleanBackground: true,
    // Softness of the backdrop fade, in threshold units.
    feather: 26,
    autoLevels: true,
    whiteBalance: true,
    saturation: 1.06,
    contrast: 1.08,
    brightness: 1.0,
    shadow: true,
    backdrop: "ivory", // "ivory" | "white" | "blush" | "sage"
    format: "image/webp",
    quality: 0.9
  };

  const BACKDROPS = {
    ivory: { top: "#FFFFFF", bottom: "#F4EFE6", label: "Studio Ivory" },
    white: { top: "#FFFFFF", bottom: "#FAFAFA", label: "Pure White" },
    blush: { top: "#FFFFFF", bottom: "#F7EBEA", label: "Blush" },
    sage: { top: "#FFFFFF", bottom: "#EDF2ED", label: "Sage" }
  };

  /** Suggested captions by shot type — these become the on-image detail text. */
  const SHOT_TYPES = [
    { key: "front", label: "Front", caption: "Front view — full silhouette and drape" },
    { key: "back", label: "Back", caption: "Back view — closure and yoke finish" },
    { key: "fabric", label: "Fabric close-up", caption: "Fabric close-up — weave, sheen and texture" },
    { key: "detail", label: "Embroidery detail", caption: "Embroidery detail — handwork and zari" },
    { key: "worn", label: "On model", caption: "Styled on model — true fall and length" },
    { key: "set", label: "Full set", caption: "Complete set — kurti, bottom and dupatta laid flat" }
  ];

  /* ---------------------------------------------------------- loading --- */

  function makeCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  }

  /**
   * Decode a File/Blob into an image with EXIF rotation already applied, so a
   * portrait photo doesn't arrive on its side.
   */
  async function loadImage(file) {
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch {
        /* Safari < 16 and friends — fall through */
      }
    }
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("That file could not be read as an image"));
        img.src = url;
      });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  /** Scale into a working buffer so analysis stays fast on 12 MP photos. */
  function toWorkingCanvas(source, maxEdge = 1600) {
    const w = source.width;
    const h = source.height;
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    const canvas = makeCanvas(w * scale, h * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  /* --------------------------------------------------------- analysis --- */

  /**
   * Read the backdrop colour from a band around the frame edge, using the
   * median so a stray hand or hanger in the corner doesn't skew it.
   */
  function estimateBackdrop(data, width, height) {
    const band = Math.max(2, Math.round(Math.min(width, height) * 0.04));
    const rs = [];
    const gs = [];
    const bs = [];

    const sample = (x, y) => {
      const i = (y * width + x) * 4;
      rs.push(data[i]);
      gs.push(data[i + 1]);
      bs.push(data[i + 2]);
    };

    const step = Math.max(1, Math.round(Math.min(width, height) / 220));
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < band; x += step) sample(x, y);
      for (let x = width - band; x < width; x += step) sample(x, y);
    }
    for (let x = 0; x < width; x += step) {
      for (let y = 0; y < band; y += step) sample(x, y);
      for (let y = height - band; y < height; y += step) sample(x, y);
    }

    // Median over a *copy* — sorting in place would break the per-pixel
    // correspondence between the three channel arrays, which the spread
    // calculation below depends on.
    const median = arr => {
      const sorted = [...arr].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)] || 255;
    };

    const backdrop = { r: median(rs), g: median(gs), b: median(bs) };

    // How much the border varies from its own median. A plain wall scores in
    // the single digits; a patterned curtain, a wicker chair or a cluttered
    // room scores far higher, and no colour-distance key will separate that.
    let deviation = 0;
    for (let i = 0; i < rs.length; i++) {
      deviation += colourDistance(rs[i], gs[i], bs[i], backdrop);
    }
    backdrop.spread = rs.length ? deviation / rs.length : 0;

    return backdrop;
  }

  function colourDistance(r, g, b, ref) {
    // Weighted to match how the eye reads difference; cheap but effective.
    const dr = r - ref.r;
    const dg = g - ref.g;
    const db = b - ref.b;
    return Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db);
  }

  /**
   * Bounding box of everything that isn't backdrop. Rows/columns are scored in
   * aggregate rather than per-pixel so sensor noise and dust don't blow the box
   * out to the full frame.
   */
  function findSubjectBounds(data, width, height, backdrop, threshold) {
    const rowHits = new Uint32Array(height);
    const colHits = new Uint32Array(width);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (colourDistance(data[i], data[i + 1], data[i + 2], backdrop) > threshold) {
          rowHits[y]++;
          colHits[x]++;
        }
      }
    }

    // A row counts as "subject" once ~1.5% of it differs from the backdrop.
    const rowFloor = Math.max(3, Math.round(width * 0.015));
    const colFloor = Math.max(3, Math.round(height * 0.015));

    let top = 0;
    let bottom = height - 1;
    let left = 0;
    let right = width - 1;
    while (top < bottom && rowHits[top] < rowFloor) top++;
    while (bottom > top && rowHits[bottom] < rowFloor) bottom--;
    while (left < right && colHits[left] < colFloor) left++;
    while (right > left && colHits[right] < colFloor) right--;

    // Nothing found (e.g. a busy background) — keep the whole frame.
    if (right - left < width * 0.1 || bottom - top < height * 0.1) {
      return { left: 0, top: 0, right: width - 1, bottom: height - 1, found: false };
    }
    return { left, top, right, bottom, found: true };
  }

  /** Grow a box to the catalog aspect ratio, keeping it inside the frame. */
  function fitToAspect(box, width, height, padding) {
    const boxW = box.right - box.left + 1;
    const boxH = box.bottom - box.top + 1;
    const padX = boxW * padding;
    const padY = boxH * padding;

    let x = box.left - padX;
    let y = box.top - padY;
    let w = boxW + padX * 2;
    let h = boxH + padY * 2;

    if (w / h > ASPECT) h = w / ASPECT;
    else w = h * ASPECT;

    // Recentre on the subject, then clamp inside the source.
    const cx = box.left + boxW / 2;
    const cy = box.top + boxH / 2;
    x = cx - w / 2;
    y = cy - h / 2;

    if (w > width) {
      w = width;
      h = w / ASPECT;
    }
    if (h > height) {
      h = height;
      w = h * ASPECT;
    }
    x = Math.max(0, Math.min(width - w, x));
    y = Math.max(0, Math.min(height - h, y));

    return { x, y, width: w, height: h };
  }

  /* ------------------------------------------------------- correction --- */

  /** Scale channels so the backdrop reads neutral — removes yellow room light. */
  function applyWhiteBalance(data, backdrop) {
    const target = (backdrop.r + backdrop.g + backdrop.b) / 3;
    if (target < 40) return; // very dark backdrop: not a usable reference
    const gain = {
      r: clamp(target / Math.max(1, backdrop.r), 0.75, 1.35),
      g: clamp(target / Math.max(1, backdrop.g), 0.75, 1.35),
      b: clamp(target / Math.max(1, backdrop.b), 0.75, 1.35)
    };
    for (let i = 0; i < data.length; i += 4) {
      data[i] = clamp(data[i] * gain.r, 0, 255);
      data[i + 1] = clamp(data[i + 1] * gain.g, 0, 255);
      data[i + 2] = clamp(data[i + 2] * gain.b, 0, 255);
    }
  }

  /**
   * Lift the backdrop to white without crushing the garment.
   *
   * A plain percentile stretch goes badly wrong here: a product photo's
   * histogram is bimodal — a large backdrop peak up near white and a much
   * smaller garment peak down in the shadows. The low percentile then lands
   * *inside* the garment's own distribution and clips a deep maroon to near
   * black. So the black point is capped: we brighten the backdrop, and leave
   * dark fabric where it is.
   */
  function applyAutoLevels(data) {
    const histogram = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      histogram[Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])]++;
    }
    const total = data.length / 4;

    let low = 0;
    let acc = 0;
    while (low < 255 && (acc += histogram[low]) < total * 0.001) low++;
    low = Math.min(low, 16); // never lift blacks more than a touch

    let high = 255;
    acc = 0;
    while (high > 0 && (acc += histogram[high]) < total * 0.005) high--;

    if (high - low < 40) return; // already flat or very low contrast; leave it
    const scale = 255 / (high - low);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = clamp((data[i] - low) * scale, 0, 255);
      data[i + 1] = clamp((data[i + 1] - low) * scale, 0, 255);
      data[i + 2] = clamp((data[i + 2] - low) * scale, 0, 255);
    }
  }

  /**
   * Gentle S-curve contrast plus a saturation lift.
   *
   * The curve is endpoint-preserving — f(0)=0, f(0.5)=0.5, f(1)=1 — rather
   * than the usual `(v-128)*k+128`, which drags every dark pixel toward black
   * and turns deep silks into mud.
   */
  function contrastCurve(value, amount) {
    const x = value / 255;
    const shaped = x + amount * (x - 0.5) * (1 - Math.abs(2 * x - 1));
    return shaped * 255;
  }

  function applyToneAndColour(data, { contrast, saturation, brightness }) {
    const amount = (contrast - 1) * 2;

    for (let i = 0; i < data.length; i += 4) {
      let r = clamp(data[i] * brightness, 0, 255);
      let g = clamp(data[i + 1] * brightness, 0, 255);
      let b = clamp(data[i + 2] * brightness, 0, 255);

      if (amount !== 0) {
        r = contrastCurve(r, amount);
        g = contrastCurve(g, amount);
        b = contrastCurve(b, amount);
      }

      // Saturation around luminance — keeps silks rich without going neon.
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = lum + (r - lum) * saturation;
      g = lum + (g - lum) * saturation;
      b = lum + (b - lum) * saturation;

      data[i] = clamp(r, 0, 255);
      data[i + 1] = clamp(g, 0, 255);
      data[i + 2] = clamp(b, 0, 255);
    }
  }

  /**
   * Fade the backdrop out so the studio gradient shows through.
   *
   * This is a flood fill seeded from the frame edge, not a global colour match,
   * and the difference matters on real garments. A global match removes *any*
   * pixel near the backdrop colour wherever it appears — which on white
   * chikankari embroidery against a white wall means punching holes straight
   * through the embroidery. Only pixels actually connected to the border are
   * background, so only those are removed.
   *
   * Alpha still ramps across `feather` rather than switching hard, which keeps
   * sheer dupattas and loose threads from being sliced off at the edge.
   *
   * @returns {number} fraction of the frame removed, 0..1
   */
  function cleanBackdrop(data, width, height, backdrop, threshold, feather) {
    const total = width * height;
    const isBackground = new Uint8Array(total);
    // Queued-or-done, marked at push time. Marking on pop instead would let a
    // pixel be queued once per neighbour and overflow a stack sized `total`.
    const seen = new Uint8Array(total);
    const stack = new Int32Array(total);
    let top = 0;

    const push = idx => {
      if (!seen[idx]) {
        seen[idx] = 1;
        stack[top++] = idx;
      }
    };

    const nearBackdrop = idx => {
      const i = idx * 4;
      return colourDistance(data[i], data[i + 1], data[i + 2], backdrop) < threshold + feather;
    };

    // Seed every border pixel.
    for (let x = 0; x < width; x++) {
      push(x);
      push((height - 1) * width + x);
    }
    for (let y = 0; y < height; y++) {
      push(y * width);
      push(y * width + width - 1);
    }

    while (top > 0) {
      const idx = stack[--top];
      if (!nearBackdrop(idx)) continue;
      isBackground[idx] = 1;

      const x = idx % width;
      const y = (idx / width) | 0;
      if (x > 0) push(idx - 1);
      if (x < width - 1) push(idx + 1);
      if (y > 0) push(idx - width);
      if (y < height - 1) push(idx + width);
    }

    let removed = 0;
    for (let idx = 0; idx < total; idx++) {
      if (!isBackground[idx]) continue;
      removed++;
      const i = idx * 4;
      const distance = colourDistance(data[i], data[i + 1], data[i + 2], backdrop);
      if (distance <= threshold - feather) {
        data[i + 3] = 0;
        continue;
      }
      const t = (distance - (threshold - feather)) / (feather * 2);
      data[i + 3] = Math.round(data[i + 3] * clamp(t, 0, 1));
    }

    return removed / total;
  }

  /**
   * Read the garment's swatch colours.
   *
   * Averaging the saturated pixels is tempting but wrong: on ethnic wear it
   * blends the body colour with the zari and returns a muddy in-between that
   * matches neither. So instead we bucket garment pixels into a coarse colour
   * histogram and pick whole clusters:
   *
   *   dominant = the biggest cluster        (the fabric body)
   *   accent   = the brightest other cluster (the zari / embroidery)
   */
  function readGarmentColours(data, backdrop, threshold) {
    // 5 bits per channel — fine enough to separate maroon from gold, coarse
    // enough that shading variation stays inside one bucket.
    const buckets = new Map();

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (colourDistance(r, g, b, backdrop) <= threshold) continue;

      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { count: 0, r: 0, g: 0, b: 0 };
        buckets.set(key, bucket);
      }
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    }

    if (!buckets.size) return { dominant: "#5A1322", accent: "#D4AF37" };

    const clusters = [...buckets.values()]
      .map(b => {
        const r = b.r / b.count;
        const g = b.g / b.count;
        const bl = b.b / b.count;
        return {
          count: b.count,
          r,
          g,
          b: bl,
          lum: 0.299 * r + 0.587 * g + 0.114 * bl,
          sat: Math.max(r, g, bl) - Math.min(r, g, bl)
        };
      })
      .sort((a, b) => b.count - a.count);

    const dominant = clusters[0];

    // The accent is the brightest cluster that is meaningfully different from
    // the body colour and still covers a visible amount of the garment.
    const minShare = dominant.count * 0.02;
    const accent =
      clusters
        .filter(c => c.count >= minShare && colourDistance(c.r, c.g, c.b, dominant) > 60)
        .sort((a, b) => b.lum + b.sat - (a.lum + a.sat))[0] || dominant;

    return {
      dominant: rgbToHex(dominant.r, dominant.g, dominant.b),
      accent: rgbToHex(accent.r, accent.g, accent.b)
    };
  }

  /* --------------------------------------------------------- helpers --- */

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  function rgbToHex(r, g, b) {
    return `#${[r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  }

  function drawBackdrop(ctx, width, height, backdropKey) {
    const preset = BACKDROPS[backdropKey] || BACKDROPS.ivory;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, preset.top);
    gradient.addColorStop(1, preset.bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Barely-there vignette; stops large flat areas looking like dead space.
    const radial = ctx.createRadialGradient(
      width / 2,
      height * 0.42,
      Math.min(width, height) * 0.2,
      width / 2,
      height * 0.5,
      Math.max(width, height) * 0.75
    );
    radial.addColorStop(0, "rgba(0,0,0,0)");
    radial.addColorStop(1, "rgba(28,20,10,0.06)");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);
  }

  function drawContactShadow(ctx, width, height) {
    ctx.save();
    const gradient = ctx.createRadialGradient(
      width / 2,
      height * 0.93,
      1,
      width / 2,
      height * 0.93,
      width * 0.36
    );
    gradient.addColorStop(0, "rgba(40,28,16,0.22)");
    gradient.addColorStop(0.6, "rgba(40,28,16,0.08)");
    gradient.addColorStop(1, "rgba(40,28,16,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(width / 2, height * 0.93, width * 0.34, height * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---------------------------------------------------------- process --- */

  /**
   * Run a raw photo through the full pipeline.
   *
   * @param {File|Blob} file
   * @param {object} [options] overrides for DEFAULTS
   * @returns {Promise<{outputs, colours, meta}>}
   */
  async function process(file, options = {}) {
    const opts = { ...DEFAULTS, ...options };
    const bitmap = await loadImage(file);
    const work = toWorkingCanvas(bitmap, 1600);
    const workCtx = work.getContext("2d", { willReadFrequently: true });

    // --- analyse the full frame -------------------------------------------
    const full = workCtx.getImageData(0, 0, work.width, work.height);
    const backdrop = estimateBackdrop(full.data, work.width, work.height);
    const bounds = findSubjectBounds(full.data, work.width, work.height, backdrop, opts.subjectThreshold);
    const crop = fitToAspect(bounds, work.width, work.height, opts.padding);

    // --- crop at the highest resolution we have ---------------------------
    const sourceScale = bitmap.width / work.width;
    const cropW = Math.round(crop.width * sourceScale);
    const cropH = Math.round(crop.height * sourceScale);
    const master = makeCanvas(
      Math.min(OUTPUT_SIZES.zoom.width, cropW),
      Math.min(OUTPUT_SIZES.zoom.width, cropW) / ASPECT
    );
    const masterCtx = master.getContext("2d", { willReadFrequently: true });
    masterCtx.imageSmoothingQuality = "high";
    masterCtx.drawImage(
      bitmap,
      Math.round(crop.x * sourceScale),
      Math.round(crop.y * sourceScale),
      cropW,
      cropH,
      0,
      0,
      master.width,
      master.height
    );

    // --- pixel work --------------------------------------------------------
    const pixels = masterCtx.getImageData(0, 0, master.width, master.height);
    if (opts.whiteBalance) applyWhiteBalance(pixels.data, backdrop);
    if (opts.autoLevels) applyAutoLevels(pixels.data);

    // Sample the swatch after exposure correction but before the stylistic
    // contrast/saturation pass, so the recorded colour is the fabric's real
    // colour rather than the graded look.
    const levelledBackdrop = estimateBackdrop(pixels.data, master.width, master.height);
    const colours = readGarmentColours(pixels.data, levelledBackdrop, opts.subjectThreshold);

    applyToneAndColour(pixels.data, opts);

    // Re-read the backdrop after grading so the key matches what we see now.
    const correctedBackdrop = estimateBackdrop(pixels.data, master.width, master.height);
    let backdropRemoved = 0;
    if (opts.cleanBackground) {
      backdropRemoved = cleanBackdrop(
        pixels.data,
        master.width,
        master.height,
        correctedBackdrop,
        opts.subjectThreshold,
        opts.feather
      );
    }

    const garment = makeCanvas(master.width, master.height);
    garment.getContext("2d").putImageData(pixels, 0, 0);

    // --- composite ---------------------------------------------------------
    const composed = makeCanvas(master.width, master.height);
    const composedCtx = composed.getContext("2d");
    drawBackdrop(composedCtx, composed.width, composed.height, opts.backdrop);
    if (opts.shadow && opts.cleanBackground) drawContactShadow(composedCtx, composed.width, composed.height);
    composedCtx.drawImage(garment, 0, 0);

    // --- export ------------------------------------------------------------
    const outputs = {};
    for (const [key, spec] of Object.entries(OUTPUT_SIZES)) {
      const width = Math.min(spec.width, composed.width);
      const canvas = makeCanvas(width, width / ASPECT);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(composed, 0, 0, canvas.width, canvas.height);
      outputs[key] = {
        label: spec.label,
        width: canvas.width,
        height: canvas.height,
        dataUrl: canvas.toDataURL(opts.format, opts.quality)
      };
    }

    return {
      outputs,
      colours,
      meta: {
        sourceWidth: bitmap.width,
        sourceHeight: bitmap.height,
        subjectFound: bounds.found,
        backdrop: rgbToHex(backdrop.r, backdrop.g, backdrop.b),
        // How varied the original border was. Above ~28 means a patterned or
        // cluttered background that no colour key can cleanly separate.
        backdropSpread: Math.round(backdrop.spread),
        backdropBusy: backdrop.spread > 28,
        // Fraction of the frame actually replaced. A clean shot lands around
        // 0.3–0.6; near zero means the removal silently achieved nothing.
        backdropRemoved: Number(backdropRemoved.toFixed(3)),
        backdropRemovalWorked: !opts.cleanBackground || backdropRemoved > 0.12,
        aspect: "3:4",
        options: opts
      }
    };
  }

  /** Preview a single settings change without re-exporting every size. */
  async function preview(file, options = {}) {
    const result = await process(file, { ...options, quality: 0.82 });
    return result.outputs.main.dataUrl;
  }

  /**
   * Build the caption/alt text that sits with each gallery image. This is the
   * "what am I looking at" line the marketplaces put under their photos.
   */
  function describeShot(shotKey, product = {}) {
    const shot = SHOT_TYPES.find(s => s.key === shotKey) || SHOT_TYPES[0];
    const bits = [];
    if (shotKey === "fabric" && product.fabric) bits.push(`${product.fabric} weave in ${product.color || "colour"}`);
    else if (shotKey === "detail" && product.details) {
      bits.push(product.details.Neckline || product.details["Kurta Fabric"] || shot.caption);
    } else bits.push(shot.caption);

    return {
      shot: shot.key,
      caption: shot.caption,
      detail: bits.join(" · "),
      alt: `${product.name || "Garment"} — ${shot.label.toLowerCase()}`
    };
  }

  return {
    ASPECT,
    DEFAULTS,
    BACKDROPS,
    OUTPUT_SIZES,
    SHOT_TYPES,
    process,
    preview,
    describeShot,
    loadImage,
    rgbToHex
  };
})();

if (typeof window !== "undefined") window.ImageStudio = ImageStudio;
