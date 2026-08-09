/**
 * Reji Fashions - QR Code encoder (ISO/IEC 18004).
 *
 * A real, standards-compliant encoder — the codes it produces scan in Google
 * Pay, PhonePe, Paytm, BHIM and any camera app. Byte mode only, which is all a
 * UPI intent string needs, across versions 1–40 and all four EC levels.
 *
 * No dependencies and no network: the site keeps working offline.
 *
 *   const qr = QRCode.encode("upi://pay?pa=...", "M");
 *   qr.size          // module count per side
 *   qr.isDark(x, y)  // module state
 *   QRCode.toSvg(qr, { scale: 8, quietZone: 4 })
 */

const QRCode = (() => {
  "use strict";

  const EC_LEVELS = { L: 0, M: 1, Q: 2, H: 3 };
  // Format-info bit patterns are ordered differently to the EC level index.
  const EC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  // Error-correction codewords per block, indexed [ecLevel][version].
  const ECC_CODEWORDS_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  ];

  // Number of error-correction blocks, indexed [ecLevel][version].
  const NUM_EC_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  ];

  const PENALTY_N1 = 3;
  const PENALTY_N2 = 3;
  const PENALTY_N3 = 40;
  const PENALTY_N4 = 10;

  /* --------------------------------------------------------- GF(256) --- */

  function gfMultiply(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xff;
  }

  function rsDivisor(degree) {
    const result = new Uint8Array(degree);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < degree; j++) {
        result[j] = gfMultiply(result[j], root);
        if (j + 1 < degree) result[j] ^= result[j + 1];
      }
      root = gfMultiply(root, 0x02);
    }
    return result;
  }

  function rsRemainder(data, divisor) {
    const result = new Uint8Array(divisor.length);
    for (const b of data) {
      const factor = b ^ result[0];
      result.copyWithin(0, 1);
      result[result.length - 1] = 0;
      for (let i = 0; i < result.length; i++) result[i] ^= gfMultiply(divisor[i], factor);
    }
    return result;
  }

  /* ------------------------------------------------------- capacities --- */

  function numRawDataModules(version) {
    let result = (16 * version + 128) * version + 64;
    if (version >= 2) {
      const numAlign = Math.floor(version / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (version >= 7) result -= 36;
    }
    return result;
  }

  function numDataCodewords(version, ecLevel) {
    const ec = EC_LEVELS[ecLevel];
    return (
      Math.floor(numRawDataModules(version) / 8) -
      ECC_CODEWORDS_PER_BLOCK[ec][version] * NUM_EC_BLOCKS[ec][version]
    );
  }

  function alignmentPatternPositions(version, size) {
    if (version === 1) return [];
    const numAlign = Math.floor(version / 7) + 2;
    const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
    const result = [6];
    for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  /* --------------------------------------------------------- bit work --- */

  function toUtf8Bytes(text) {
    if (typeof TextEncoder !== "undefined") return Array.from(new TextEncoder().encode(text));
    return Array.from(unescape(encodeURIComponent(text)), ch => ch.charCodeAt(0));
  }

  function getBit(value, index) {
    return ((value >>> index) & 1) !== 0;
  }

  /* ------------------------------------------------------------ QrCode --- */

  class QrCode {
    constructor(version, ecLevel, dataCodewords) {
      this.version = version;
      this.ecLevel = ecLevel;
      this.size = version * 4 + 17;
      this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
      this.isFunction = Array.from({ length: this.size }, () => new Array(this.size).fill(false));

      this.drawFunctionPatterns();
      const allCodewords = this.addEccAndInterleave(dataCodewords);
      this.drawCodewords(allCodewords);

      // Pick the mask with the lowest penalty, as the spec requires.
      let bestMask = 0;
      let minPenalty = Infinity;
      for (let mask = 0; mask < 8; mask++) {
        this.applyMask(mask);
        this.drawFormatBits(mask);
        const penalty = this.penaltyScore();
        if (penalty < minPenalty) {
          minPenalty = penalty;
          bestMask = mask;
        }
        this.applyMask(mask); // XOR is its own inverse
      }
      this.mask = bestMask;
      this.applyMask(bestMask);
      this.drawFormatBits(bestMask);
    }

    isDark(x, y) {
      return this.modules[y][x];
    }

    setFunctionModule(x, y, isDark) {
      this.modules[y][x] = isDark;
      this.isFunction[y][x] = true;
    }

    /* -- function patterns -- */

    drawFunctionPatterns() {
      const size = this.size;

      for (let i = 0; i < size; i++) {
        this.setFunctionModule(6, i, i % 2 === 0);
        this.setFunctionModule(i, 6, i % 2 === 0);
      }

      this.drawFinderPattern(3, 3);
      this.drawFinderPattern(size - 4, 3);
      this.drawFinderPattern(3, size - 4);

      const positions = alignmentPatternPositions(this.version, size);
      const n = positions.length;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          // Skip the three corners already taken by finder patterns.
          if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
          this.drawAlignmentPattern(positions[i], positions[j]);
        }
      }

      this.drawFormatBits(0); // placeholder, rewritten once the mask is chosen
      this.drawVersion();
    }

    drawFinderPattern(cx, cy) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
            this.setFunctionModule(x, y, dist !== 2 && dist !== 4);
          }
        }
      }
    }

    drawAlignmentPattern(cx, cy) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          this.setFunctionModule(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }

    drawFormatBits(mask) {
      const data = (EC_FORMAT_BITS[this.ecLevel] << 3) | mask;
      let rem = data;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bits = ((data << 10) | rem) ^ 0x5412;

      for (let i = 0; i <= 5; i++) this.setFunctionModule(8, i, getBit(bits, i));
      this.setFunctionModule(8, 7, getBit(bits, 6));
      this.setFunctionModule(8, 8, getBit(bits, 7));
      this.setFunctionModule(7, 8, getBit(bits, 8));
      for (let i = 9; i < 15; i++) this.setFunctionModule(14 - i, 8, getBit(bits, i));

      for (let i = 0; i < 8; i++) this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
      for (let i = 8; i < 15; i++) this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
      this.setFunctionModule(8, this.size - 8, true); // always-dark module
    }

    drawVersion() {
      if (this.version < 7) return;
      let rem = this.version;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const bits = (this.version << 12) | rem;

      for (let i = 0; i < 18; i++) {
        const dark = getBit(bits, i);
        const a = this.size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        this.setFunctionModule(a, b, dark);
        this.setFunctionModule(b, a, dark);
      }
    }

    /* -- data -- */

    addEccAndInterleave(data) {
      const ec = EC_LEVELS[this.ecLevel];
      const numBlocks = NUM_EC_BLOCKS[ec][this.version];
      const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ec][this.version];
      const rawCodewords = Math.floor(numRawDataModules(this.version) / 8);
      const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
      const shortBlockLen = Math.floor(rawCodewords / numBlocks);

      const blocks = [];
      const divisor = rsDivisor(blockEccLen);
      for (let i = 0, k = 0; i < numBlocks; i++) {
        const len = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
        const dat = data.slice(k, k + len);
        k += len;
        const ecc = rsRemainder(dat, divisor);
        if (i < numShortBlocks) dat.push(0); // pad short blocks so columns line up
        blocks.push(dat.concat(Array.from(ecc)));
      }

      const result = [];
      for (let i = 0; i < blocks[0].length; i++) {
        blocks.forEach((block, j) => {
          // The padding byte added to short blocks is not transmitted.
          if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
        });
      }
      return result;
    }

    drawCodewords(data) {
      let i = 0;
      for (let right = this.size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5; // skip the vertical timing column
        for (let vert = 0; vert < this.size; vert++) {
          for (let j = 0; j < 2; j++) {
            const x = right - j;
            const upward = ((right + 1) & 2) === 0;
            const y = upward ? this.size - 1 - vert : vert;
            if (!this.isFunction[y][x] && i < data.length * 8) {
              this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
              i++;
            }
          }
        }
      }
    }

    applyMask(mask) {
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          if (this.isFunction[y][x]) continue;
          let invert;
          switch (mask) {
            case 0: invert = (x + y) % 2 === 0; break;
            case 1: invert = y % 2 === 0; break;
            case 2: invert = x % 3 === 0; break;
            case 3: invert = (x + y) % 3 === 0; break;
            case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
            case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
            case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
            case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
            default: invert = false;
          }
          if (invert) this.modules[y][x] = !this.modules[y][x];
        }
      }
    }

    /* -- mask scoring -- */

    penaltyScore() {
      let result = 0;
      const size = this.size;

      // Rule 1 + rule 3, horizontally.
      for (let y = 0; y < size; y++) {
        let runColor = false;
        let runLength = 0;
        const history = [0, 0, 0, 0, 0, 0, 0];
        for (let x = 0; x < size; x++) {
          if (this.modules[y][x] === runColor) {
            runLength++;
            if (runLength === 5) result += PENALTY_N1;
            else if (runLength > 5) result++;
          } else {
            this.finderPenaltyAddHistory(runLength, history);
            if (!runColor) result += this.finderPenaltyCountPatterns(history) * PENALTY_N3;
            runColor = this.modules[y][x];
            runLength = 1;
          }
        }
        result += this.finderPenaltyTerminateAndCount(runColor, runLength, history) * PENALTY_N3;
      }

      // Rule 1 + rule 3, vertically.
      for (let x = 0; x < size; x++) {
        let runColor = false;
        let runLength = 0;
        const history = [0, 0, 0, 0, 0, 0, 0];
        for (let y = 0; y < size; y++) {
          if (this.modules[y][x] === runColor) {
            runLength++;
            if (runLength === 5) result += PENALTY_N1;
            else if (runLength > 5) result++;
          } else {
            this.finderPenaltyAddHistory(runLength, history);
            if (!runColor) result += this.finderPenaltyCountPatterns(history) * PENALTY_N3;
            runColor = this.modules[y][x];
            runLength = 1;
          }
        }
        result += this.finderPenaltyTerminateAndCount(runColor, runLength, history) * PENALTY_N3;
      }

      // Rule 2: solid 2x2 blocks.
      for (let y = 0; y < size - 1; y++) {
        for (let x = 0; x < size - 1; x++) {
          const c = this.modules[y][x];
          if (c === this.modules[y][x + 1] && c === this.modules[y + 1][x] && c === this.modules[y + 1][x + 1]) {
            result += PENALTY_N2;
          }
        }
      }

      // Rule 4: dark/light balance.
      let dark = 0;
      for (const row of this.modules) for (const cell of row) if (cell) dark++;
      const total = size * size;
      const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
      return result + k * PENALTY_N4;
    }

    finderPenaltyCountPatterns(history) {
      const n = history[1];
      const core = n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
      return (
        (core && history[0] >= n * 4 && history[6] >= n ? 1 : 0) +
        (core && history[6] >= n * 4 && history[0] >= n ? 1 : 0)
      );
    }

    finderPenaltyTerminateAndCount(runColor, runLength, history) {
      let length = runLength;
      if (runColor) {
        this.finderPenaltyAddHistory(length, history);
        length = 0;
      }
      length += this.size;
      this.finderPenaltyAddHistory(length, history);
      return this.finderPenaltyCountPatterns(history);
    }

    finderPenaltyAddHistory(runLength, history) {
      let length = runLength;
      if (history[0] === 0) length += this.size; // count the quiet zone as light
      history.pop();
      history.unshift(length);
    }
  }

  /* ---------------------------------------------------------- encoding --- */

  /**
   * Encode `text` in byte mode.
   * @param {string} text
   * @param {"L"|"M"|"Q"|"H"} ecLevel  M is the sweet spot for payment QRs.
   */
  function encode(text, ecLevel = "M") {
    if (!(ecLevel in EC_LEVELS)) throw new Error(`Unknown EC level: ${ecLevel}`);
    const bytes = toUtf8Bytes(String(text));

    let version = 0;
    for (let v = 1; v <= 40; v++) {
      const capacityBits = numDataCodewords(v, ecLevel) * 8;
      const countBits = v <= 9 ? 8 : 16;
      if (4 + countBits + bytes.length * 8 <= capacityBits) {
        version = v;
        break;
      }
    }
    if (!version) throw new Error("Data is too long for a single QR code");

    const bits = [];
    const push = (value, length) => {
      for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    };

    push(0x4, 4); // byte mode
    push(bytes.length, version <= 9 ? 8 : 16);
    for (const b of bytes) push(b, 8);

    const capacityBits = numDataCodewords(version, ecLevel) * 8;
    push(0, Math.min(4, capacityBits - bits.length)); // terminator
    push(0, (8 - (bits.length % 8)) % 8); // pad to a byte boundary

    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      codewords.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
    }
    // Alternating pad bytes defined by the spec.
    for (let pad = 0xec; codewords.length < capacityBits / 8; pad ^= 0xec ^ 0x11) codewords.push(pad);

    return new QrCode(version, ecLevel, codewords);
  }

  /**
   * Render to an SVG string. One `<path>` for every dark module keeps the
   * markup small enough to inline and sharp at any size.
   */
  function toSvg(qr, options = {}) {
    const {
      scale = 8,
      quietZone = 4,
      dark = "#0C2E28",
      light = "#FFFFFF",
      className = "rf-qr",
      title = "UPI payment QR code"
    } = options;

    const dimension = (qr.size + quietZone * 2) * scale;
    let path = "";
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.isDark(x, y)) {
          path += `M${(x + quietZone) * scale} ${(y + quietZone) * scale}h${scale}v${scale}h-${scale}z`;
        }
      }
    }

    return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" width="100%" height="100%" role="img" aria-label="${title}" shape-rendering="crispEdges"><rect width="${dimension}" height="${dimension}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
  }

  /** Convenience: text straight to SVG. */
  function svg(text, options = {}) {
    return toSvg(encode(text, options.ecLevel || "M"), options);
  }

  return { encode, toSvg, svg, QrCode };
})();

if (typeof window !== "undefined") window.QRCode = QRCode;
if (typeof module !== "undefined" && module.exports) module.exports = QRCode;
