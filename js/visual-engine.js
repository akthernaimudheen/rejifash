/**
 * Reji Fashions - Visual Generation & Textile Artwork Engine
 * Generates high-fidelity, crisp fashion visuals with embroidery, zari borders,
 * fabric drape, potli buttons, mirror motifs, and festive color gradients.
 */

const VisualEngine = {
  // Generate product visual SVG string or Data URI
  renderProductVisual(product, angle = "front") {
    const p = product;
    const baseColor = p.colorHex || "#5A1322";
    const accentColor = p.accentHex || "#D4AF37";
    const type = p.visualType || "chanderi_maroon";

    let garmentSvg = "";

    switch(type) {
      case "chanderi_maroon":
      default:
        garmentSvg = this._renderChanderiMaroon(baseColor, accentColor, angle);
        break;
      case "mulmul_pink":
        garmentSvg = this._renderMulmulPink(baseColor, accentColor, angle);
        break;
      case "emerald_embroidered":
        garmentSvg = this._renderEmeraldEmbroidered(baseColor, accentColor, angle);
        break;
      case "chikankari_blue":
        garmentSvg = this._renderChikankariBlue(baseColor, accentColor, angle);
        break;
      case "mustard_mirror":
        garmentSvg = this._renderMustardMirror(baseColor, accentColor, angle);
        break;
      case "banarasi_anarkali":
        garmentSvg = this._renderBanarasiAnarkali(baseColor, accentColor, angle);
        break;
      case "velvet_churidar":
        garmentSvg = this._renderVelvetChuridar(baseColor, accentColor, angle);
        break;
      case "teal_brocade_churidar":
        garmentSvg = this._renderTealBrocade(baseColor, accentColor, angle);
        break;
      case "sage_organza_churidar":
        garmentSvg = this._renderSageOrganza(baseColor, accentColor, angle);
        break;
      case "ivory_chanderi_churidar":
        garmentSvg = this._renderIvoryChanderi(baseColor, accentColor, angle);
        break;
      case "crimson_angrakha_churidar":
        garmentSvg = this._renderCrimsonAngrakha(baseColor, accentColor, angle);
        break;
      case "indigo_cotton_churidar":
        garmentSvg = this._renderIndigoCotton(baseColor, accentColor, angle);
        break;
      case "navy_cape_dhoti":
        garmentSvg = this._renderNavyCapeDhoti(baseColor, accentColor, angle);
        break;
      case "saffron_sharara_set":
        garmentSvg = this._renderSaffronSharara(baseColor, accentColor, angle);
        break;
      case "peach_peplum_palazzo":
        garmentSvg = this._renderPeachPeplum(baseColor, accentColor, angle);
        break;
      case "rust_linen_tunic":
        garmentSvg = this._renderRustLinen(baseColor, accentColor, angle);
        break;
    }

    return garmentSvg;
  },

  _renderChanderiMaroon(base, accent, angle) {
    const isZoom = angle === "detail";
    return `
      <svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" class="rf-garment-svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="maroonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#781D2E"/>
            <stop offset="40%" stop-color="#54121E"/>
            <stop offset="100%" stop-color="#380913"/>
          </linearGradient>
          <linearGradient id="goldLuster" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#C59B27"/>
            <stop offset="50%" stop-color="#FCEBA7"/>
            <stop offset="100%" stop-color="#B8860B"/>
          </linearGradient>
          <radialGradient id="bgLuxe" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#FBF8F5"/>
            <stop offset="70%" stop-color="#EDE6DE"/>
            <stop offset="100%" stop-color="#DFD5C8"/>
          </radialGradient>
          <pattern id="chanderiZari" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M12 2 L14 8 L20 10 L14 12 L12 18 L10 12 L4 10 L10 8 Z" fill="none" stroke="${accent}" stroke-width="0.8" opacity="0.65"/>
            <circle cx="12" cy="10" r="1.5" fill="${accent}" opacity="0.8"/>
          </pattern>
        </defs>
        <rect width="400" height="520" fill="url(#bgLuxe)"/>
        
        <!-- Mannequin / Silhouette Torso Shadow -->
        <ellipse cx="200" cy="500" rx="90" ry="12" fill="#000000" opacity="0.08" filter="blur(6px)"/>
        
        <!-- Mannequin Neck & Head hint -->
        <path d="M185 45 C185 25 215 25 215 45 L218 80 L182 80 Z" fill="#E8D5C4"/>
        <path d="M170 80 Q200 90 230 80 L238 95 Q200 102 162 95 Z" fill="#D4AF37" opacity="0.85"/>

        <!-- Sleeves 3/4 -->
        <path d="M148 95 L95 240 Q105 245 125 242 L162 135 Z" fill="url(#maroonGrad)"/>
        <path d="M252 95 L305 240 Q295 245 275 242 L238 135 Z" fill="url(#maroonGrad)"/>
        <!-- Sleeve Gota Border -->
        <rect x="94" y="232" width="32" height="8" transform="rotate(-6 110 236)" fill="url(#goldLuster)"/>
        <rect x="274" y="232" width="32" height="8" transform="rotate(6 290 236)" fill="url(#goldLuster)"/>

        <!-- Kurti Body -->
        <path d="M162 92 Q200 100 238 92 L258 220 L275 440 Q200 448 125 440 L142 220 Z" fill="url(#maroonGrad)"/>
        <!-- Zari Butis overlay -->
        <path d="M162 92 Q200 100 238 92 L258 220 L275 440 Q200 448 125 440 L142 220 Z" fill="url(#chanderiZari)" opacity="0.7"/>

        <!-- Antique Gold Embroidered Yoke -->
        <path d="M178 95 Q200 102 222 95 L228 190 Q200 215 172 190 Z" fill="url(#goldLuster)"/>
        <!-- Yoke Intricate Inset -->
        <path d="M182 98 Q200 104 218 98 L222 185 Q200 205 178 185 Z" fill="#6B1826"/>
        <!-- Gold Thread & Potli Buttons -->
        <circle cx="200" cy="115" r="3" fill="url(#goldLuster)"/>
        <circle cx="200" cy="132" r="3" fill="url(#goldLuster)"/>
        <circle cx="200" cy="149" r="3" fill="url(#goldLuster)"/>
        <circle cx="200" cy="166" r="3" fill="url(#goldLuster)"/>
        <circle cx="200" cy="183" r="3" fill="url(#goldLuster)"/>

        <!-- Side Slits & Hem Gold Foil -->
        <path d="M142 240 L125 440 L136 442 L150 240 Z" fill="#420B15"/>
        <path d="M258 240 L275 440 L264 442 L250 240 Z" fill="#420B15"/>
        <!-- Heavy Hem Gold Border -->
        <path d="M125 430 Q200 438 275 430 L275 440 Q200 448 125 440 Z" fill="url(#goldLuster)"/>
        <path d="M127 424 Q200 432 273 424 L273 427 Q200 435 127 427 Z" fill="url(#goldLuster)" opacity="0.6"/>

        <!-- Subtle Fabric Fold Highlights -->
        <path d="M190 200 Q192 320 185 435" stroke="#FFFFFF" stroke-width="1.2" opacity="0.15" fill="none"/>
        <path d="M210 200 Q208 320 215 435" stroke="#FFFFFF" stroke-width="1.2" opacity="0.15" fill="none"/>

        <!-- Luxury Tag Watermark -->
        <text x="360" y="495" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#8C7355" opacity="0.7" letter-spacing="1">REJI HANDLOOM SILK</text>
      </svg>
    `;
  },

  _renderMulmulPink(base, accent, angle) {
    return `
      <svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" class="rf-garment-svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="pinkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#E88A98"/>
            <stop offset="50%" stop-color="#D96F80"/>
            <stop offset="100%" stop-color="#B84D60"/>
          </linearGradient>
          <radialGradient id="bgPastel" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#FFF8F8"/>
            <stop offset="80%" stop-color="#F7E6E8"/>
            <stop offset="100%" stop-color="#EED5D9"/>
          </radialGradient>
          <pattern id="jaipurBlock" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="14" cy="14" r="5" fill="#FFFFFF" opacity="0.75"/>
            <circle cx="14" cy="14" r="2" fill="#B84D60" opacity="0.8"/>
            <path d="M14 6 C12 10 12 10 14 14 C16 10 16 10 14 6 Z" fill="#4A1521" opacity="0.5"/>
            <path d="M14 22 C12 18 12 18 14 14 C16 18 16 18 14 22 Z" fill="#4A1521" opacity="0.5"/>
            <path d="M6 14 C10 12 10 12 14 14 C10 16 10 16 6 14 Z" fill="#4A1521" opacity="0.5"/>
            <path d="M22 14 C18 12 18 12 14 14 C18 16 18 16 22 14 Z" fill="#4A1521" opacity="0.5"/>
          </pattern>
        </defs>
        <rect width="400" height="520" fill="url(#bgPastel)"/>
        
        <ellipse cx="200" cy="500" rx="90" ry="12" fill="#000000" opacity="0.06" filter="blur(6px)"/>
        <path d="M185 45 C185 25 215 25 215 45 L218 80 L182 80 Z" fill="#E8D5C4"/>

        <!-- Sleeves -->
        <path d="M146 95 L98 225 Q112 230 128 226 L160 130 Z" fill="url(#pinkGrad)"/>
        <path d="M254 95 L302 225 Q288 230 272 226 L240 130 Z" fill="url(#pinkGrad)"/>
        <!-- Sleeve Cuff with Shell Button -->
        <rect x="97" y="218" width="31" height="8" fill="#FFFFFF" opacity="0.9"/>
        <rect x="272" y="218" width="31" height="8" fill="#FFFFFF" opacity="0.9"/>
        <circle cx="112" cy="222" r="2.5" fill="#E5E7EB" stroke="#9CA3AF" stroke-width="0.5"/>
        <circle cx="287" cy="222" r="2.5" fill="#E5E7EB" stroke="#9CA3AF" stroke-width="0.5"/>

        <!-- A-Line Flared Kurti -->
        <path d="M160 92 Q200 98 240 92 L268 220 L295 440 Q200 452 105 440 L132 220 Z" fill="url(#pinkGrad)"/>
        <path d="M160 92 Q200 98 240 92 L268 220 L295 440 Q200 452 105 440 L132 220 Z" fill="url(#jaipurBlock)"/>

        <!-- Sweetheart Placket with Pearl Buttons -->
        <path d="M182 94 Q200 115 218 94 L212 210 L188 210 Z" fill="#FFFFFF" opacity="0.95"/>
        <circle cx="200" cy="120" r="3" fill="#FFFBEB" stroke="#D1D5DB" stroke-width="0.8"/>
        <circle cx="200" cy="140" r="3" fill="#FFFBEB" stroke="#D1D5DB" stroke-width="0.8"/>
        <circle cx="200" cy="160" r="3" fill="#FFFBEB" stroke="#D1D5DB" stroke-width="0.8"/>
        <circle cx="200" cy="180" r="3" fill="#FFFBEB" stroke="#D1D5DB" stroke-width="0.8"/>
        <circle cx="200" cy="200" r="3" fill="#FFFBEB" stroke="#D1D5DB" stroke-width="0.8"/>

        <!-- Hem Lace -->
        <path d="M105 432 Q200 444 295 432 L295 440 Q200 452 105 440 Z" fill="#FFFFFF" opacity="0.95"/>
        <text x="360" y="495" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#9F5864" opacity="0.7" letter-spacing="1">100% JAIPUR MULMUL</text>
      </svg>
    `;
  },

  _renderEmeraldEmbroidered(base, accent, angle) {
    return `
      <svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" class="rf-garment-svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#145A4E"/>
            <stop offset="50%" stop-color="#0D3F36"/>
            <stop offset="100%" stop-color="#06241E"/>
          </linearGradient>
          <linearGradient id="goldZariGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#D4AF37"/>
            <stop offset="50%" stop-color="#FFF2A3"/>
            <stop offset="100%" stop-color="#996515"/>
          </linearGradient>
          <radialGradient id="bgEmerald" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#FAFDFB"/>
            <stop offset="70%" stop-color="#E2EEEB"/>
            <stop offset="100%" stop-color="#C7DDD8"/>
          </radialGradient>
        </defs>
        <rect width="400" height="520" fill="url(#bgEmerald)"/>
        
        <ellipse cx="200" cy="500" rx="90" ry="12" fill="#000000" opacity="0.09" filter="blur(6px)"/>
        <path d="M185 45 C185 25 215 25 215 45 L218 80 L182 80 Z" fill="#E8D5C4"/>

        <!-- Full Sleeves -->
        <path d="M148 95 L88 320 Q100 324 114 321 L162 135 Z" fill="url(#emeraldGrad)"/>
        <path d="M252 95 L312 320 Q300 324 286 321 L238 135 Z" fill="url(#emeraldGrad)"/>
        <!-- Sleeve Resham Embroidered Cuffs -->
        <rect x="88" y="308" width="26" height="12" transform="rotate(-6 100 314)" fill="url(#goldZariGrad)"/>
        <rect x="286" y="308" width="26" height="12" transform="rotate(6 300 314)" fill="url(#goldZariGrad)"/>

        <!-- Straight Kurti -->
        <path d="M162 92 Q200 100 238 92 L254 220 L266 445 Q200 452 134 445 L146 220 Z" fill="url(#emeraldGrad)"/>

        <!-- Resham Floral Embroidery Panel -->
        <path d="M180 95 Q200 105 220 95 L224 270 Q200 285 176 270 Z" fill="#09312A" stroke="url(#goldZariGrad)" stroke-width="1.5"/>
        <!-- Intricate Floral Resham Motifs -->
        <g stroke="url(#goldZariGrad)" fill="none" stroke-width="1.2">
          <path d="M200 110 Q190 125 200 140 Q210 155 200 170 Q190 185 200 200 Q210 215 200 230 Q190 245 200 260"/>
          <circle cx="200" cy="125" r="4" fill="url(#goldZariGrad)"/>
          <circle cx="200" cy="155" r="4" fill="url(#goldZariGrad)"/>
          <circle cx="200" cy="185" r="4" fill="url(#goldZariGrad)"/>
          <circle cx="200" cy="215" r="4" fill="url(#goldZariGrad)"/>
          <circle cx="200" cy="245" r="4" fill="url(#goldZariGrad)"/>
          <!-- Leaflets -->
          <path d="M196 125 Q184 120 188 112" stroke-width="1.5"/>
          <path d="M204 125 Q216 120 212 112" stroke-width="1.5"/>
          <path d="M196 155 Q184 150 188 142" stroke-width="1.5"/>
          <path d="M204 155 Q216 150 212 142" stroke-width="1.5"/>
          <path d="M196 185 Q184 180 188 172" stroke-width="1.5"/>
          <path d="M204 185 Q216 180 212 172" stroke-width="1.5"/>
        </g>

        <!-- Gold Piping on Slits & Hem -->
        <path d="M134 435 Q200 442 266 435 L266 445 Q200 452 134 445 Z" fill="url(#goldZariGrad)"/>
        <text x="360" y="495" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#145A4E" opacity="0.8" letter-spacing="1">RESHAM EMBROIDERY</text>
      </svg>
    `;
  },

  _renderChikankariBlue(base, accent, angle) {
    return `
      <svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" class="rf-garment-svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="skyBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#93B8D4"/>
            <stop offset="60%" stop-color="#7298B6"/>
            <stop offset="100%" stop-color="#557B99"/>
          </linearGradient>
          <pattern id="chikankariJaal" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="11" cy="11" r="2" fill="#FFFFFF" opacity="0.9"/>
            <path d="M11 4 Q13 7 11 11 Q9 7 11 4 Z" fill="#FFFFFF" opacity="0.85"/>
            <path d="M11 18 Q13 15 11 11 Q9 15 11 18 Z" fill="#FFFFFF" opacity="0.85"/>
            <path d="M4 11 Q7 13 11 11 Q7 9 4 11 Z" fill="#FFFFFF" opacity="0.85"/>
            <path d="M18 11 Q15 13 11 11 Q15 9 18 11 Z" fill="#FFFFFF" opacity="0.85"/>
            <!-- Mukaish Silver Dot -->
            <circle cx="4" cy="4" r="1" fill="#E2E8F0" opacity="0.95"/>
            <circle cx="18" cy="18" r="1" fill="#E2E8F0" opacity="0.95"/>
          </pattern>
        </defs>
        <rect width="400" height="520" fill="#F4F8FA"/>
        
        <ellipse cx="200" cy="500" rx="90" ry="12" fill="#000000" opacity="0.06" filter="blur(6px)"/>
        <path d="M185 45 C185 25 215 25 215 45 L218 80 L182 80 Z" fill="#E8D5C4"/>

        <!-- Sleeves -->
        <path d="M148 95 L95 240 Q105 245 125 242 L162 135 Z" fill="url(#skyBlue)"/>
        <path d="M148 95 L95 240 Q105 245 125 242 L162 135 Z" fill="url(#chikankariJaal)"/>
        <path d="M252 95 L305 240 Q295 245 275 242 L238 135 Z" fill="url(#skyBlue)"/>
        <path d="M252 95 L305 240 Q295 245 275 242 L238 135 Z" fill="url(#chikankariJaal)"/>

        <!-- Kurti Body -->
        <path d="M162 92 Q200 100 238 92 L256 220 L270 440 Q200 448 130 440 L144 220 Z" fill="url(#skyBlue)"/>
        <path d="M162 92 Q200 100 238 92 L256 220 L270 440 Q200 448 130 440 L144 220 Z" fill="url(#chikankariJaal)"/>

        <!-- Heavy Lucknowi Yoke -->
        <path d="M175 95 Q200 104 225 95 L228 195 Q200 220 172 195 Z" fill="#FFFFFF" opacity="0.95"/>
        <path d="M180 98 Q200 106 220 98 L223 190 Q200 210 177 190 Z" fill="url(#skyBlue)"/>
        <path d="M180 98 Q200 106 220 98 L223 190 Q200 210 177 190 Z" fill="url(#chikankariJaal)"/>

        <!-- Silver Mukaish Shimmer -->
        <circle cx="200" cy="115" r="2" fill="#FFFFFF"/>
        <circle cx="200" cy="135" r="2" fill="#FFFFFF"/>
        <circle cx="200" cy="155" r="2" fill="#FFFFFF"/>
        <circle cx="200" cy="175" r="2" fill="#FFFFFF"/>

        <text x="360" y="495" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#4B6E8A" opacity="0.8" letter-spacing="1">LUCKNOWI CHIKANKARI</text>
      </svg>
    `;
  },

  _renderMustardMirror(base, accent, angle) {
    return `
      <svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" class="rf-garment-svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="mustardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#F59E0B"/>
            <stop offset="50%" stop-color="#D97706"/>
            <stop offset="100%" stop-color="#B45309"/>
          </linearGradient>
          <radialGradient id="mirrorGlass" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#FFFFFF"/>
            <stop offset="50%" stop-color="#E2E8F0"/>
            <stop offset="100%" stop-color="#94A3B8"/>
          </radialGradient>
        </defs>
        <rect width="400" height="520" fill="#FFFDF5"/>
        
        <ellipse cx="200" cy="500" rx="90" ry="12" fill="#000000" opacity="0.07" filter="blur(6px)"/>
        <path d="M185 45 C185 25 215 25 215 45 L218 80 L182 80 Z" fill="#E8D5C4"/>

        <!-- Sleeves -->
        <path d="M148 95 L108 200 Q120 205 134 202 L160 125 Z" fill="url(#mustardGrad)"/>
        <path d="M252 95 L292 200 Q280 205 266 202 L240 125 Z" fill="url(#mustardGrad)"/>

        <!-- Peplum Short Kurti Silhouette -->
        <path d="M162 92 Q200 98 238 92 L246 195 Q200 200 154 195 Z" fill="url(#mustardGrad)"/>
        <!-- Peplum Flare -->
        <path d="M154 195 Q200 200 246 195 L275 340 Q200 355 125 340 Z" fill="url(#mustardGrad)"/>

        <!-- Real Mirrors on Placket -->
        <g>
          <!-- Center Mirror Row -->
          <circle cx="200" cy="115" r="7" fill="url(#mirrorGlass)" stroke="#8B0000" stroke-width="2"/>
          <circle cx="200" cy="140" r="7" fill="url(#mirrorGlass)" stroke="#8B0000" stroke-width="2"/>
          <circle cx="200" cy="165" r="7" fill="url(#mirrorGlass)" stroke="#8B0000" stroke-width="2"/>
          <circle cx="200" cy="190" r="7" fill="url(#mirrorGlass)" stroke="#8B0000" stroke-width="2"/>

          <circle cx="175" cy="140" r="5.5" fill="url(#mirrorGlass)" stroke="#8B0000" stroke-width="1.8"/>
          <circle cx="225" cy="140" r="5.5" fill="url(#mirrorGlass)" stroke="#8B0000" stroke-width="1.8"/>
          <circle cx="175" cy="165" r="5.5" fill="url(#mirrorGlass)" stroke="#8B0000" stroke-width="1.8"/>
          <circle cx="225" cy="165" r="5.5" fill="url(#mirrorGlass)" stroke="#8B0000" stroke-width="1.8"/>
        </g>

        <!-- Peplum Border Mirror Row -->
        <path d="M125 328 Q200 343 275 328 L275 340 Q200 355 125 340 Z" fill="#8B0000"/>
        <!-- Mirror accents on border -->
        <circle cx="150" cy="334" r="3.5" fill="url(#mirrorGlass)"/>
        <circle cx="175" cy="337" r="3.5" fill="url(#mirrorGlass)"/>
        <circle cx="200" cy="339" r="3.5" fill="url(#mirrorGlass)"/>
        <circle cx="225" cy="337" r="3.5" fill="url(#mirrorGlass)"/>
        <circle cx="250" cy="334" r="3.5" fill="url(#mirrorGlass)"/>

        <!-- Artisan Tassels -->
        <path d="M154 195 Q145 235 142 260" stroke="#8B0000" stroke-width="1.5" fill="none"/>
        <circle cx="142" cy="263" r="4" fill="#D97706"/>
        <path d="M246 195 Q255 235 258 260" stroke="#8B0000" stroke-width="1.5" fill="none"/>
        <circle cx="258" cy="263" r="4" fill="#D97706"/>

        <text x="360" y="495" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#B45309" opacity="0.8" letter-spacing="1">AUTHENTIC MIRROR WORK</text>
      </svg>
    `;
  },

  _renderBanarasiAnarkali(base, accent, angle) {
    return `
      <svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" class="rf-garment-svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="wineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#5B1123"/>
            <stop offset="50%" stop-color="#3B0714"/>
            <stop offset="100%" stop-color="#24030B"/>
          </linearGradient>
          <linearGradient id="brocadeGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#F3E5AB"/>
            <stop offset="40%" stop-color="#D4AF37"/>
            <stop offset="100%" stop-color="#AA7A1E"/>
          </linearGradient>
          <pattern id="banarasiBrocade" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M15 2 L28 15 L15 28 L2 15 Z" fill="none" stroke="url(#brocadeGold)" stroke-width="1"/>
            <circle cx="15" cy="15" r="3" fill="url(#brocadeGold)"/>
            <path d="M15 8 L17 13 L22 15 L17 17 L15 22 L13 17 L8 15 L13 13 Z" fill="url(#brocadeGold)" opacity="0.7"/>
          </pattern>
        </defs>
        <rect width="400" height="520" fill="#FBF8F4"/>
        
        <ellipse cx="200" cy="505" rx="120" ry="14" fill="#000000" opacity="0.1" filter="blur(7px)"/>
        <path d="M185 45 C185 25 215 25 215 45 L218 80 L182 80 Z" fill="#E8D5C4"/>

        <!-- Sleeves -->
        <path d="M148 95 L90 280 Q102 284 116 281 L162 135 Z" fill="url(#wineGrad)"/>
        <path d="M148 95 L90 280 Q102 284 116 281 L162 135 Z" fill="url(#banarasiBrocade)"/>
        <path d="M252 95 L310 280 Q298 284 284 281 L238 135 Z" fill="url(#wineGrad)"/>
        <path d="M252 95 L310 280 Q298 284 284 281 L238 135 Z" fill="url(#banarasiBrocade)"/>

        <!-- Anarkali Kalis & Sweeping Ghera -->
        <path d="M162 92 Q200 100 238 92 L248 180 L340 470 Q200 495 60 470 L152 180 Z" fill="url(#wineGrad)"/>
        <path d="M162 92 Q200 100 238 92 L248 180 L340 470 Q200 495 60 470 L152 180 Z" fill="url(#banarasiBrocade)"/>

        <!-- Kali Seam Lines -->
        <g stroke="url(#brocadeGold)" stroke-width="0.8" opacity="0.6">
          <path d="M170 180 L90 470"/>
          <path d="M185 180 L135 478"/>
          <path d="M200 180 L200 482"/>
          <path d="M215 180 L265 478"/>
          <path d="M230 180 L310 470"/>
        </g>

        <!-- Sweetheart Bodice -->
        <path d="M172 95 Q186 115 200 108 Q214 115 228 95 L234 180 Q200 190 166 180 Z" fill="#4A0B1B" stroke="url(#brocadeGold)" stroke-width="1.8"/>
        
        <!-- Heavy Banarasi Gold Zari Border at Hem -->
        <path d="M60 450 Q200 475 340 450 L340 470 Q200 495 60 470 Z" fill="url(#brocadeGold)"/>
        <path d="M68 440 Q200 465 332 440 L332 446 Q200 471 68 446 Z" fill="url(#brocadeGold)" opacity="0.6"/>

        <text x="360" y="495" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#5B1123" opacity="0.8" letter-spacing="1">24-KALI BANARASI WEAVE</text>
      </svg>
    `;
  },

  _renderVelvetChuridar(base, accent, angle) {
    return `
      <svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" class="rf-garment-svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="velvetWine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4C0C1B"/>
            <stop offset="40%" stop-color="#340611"/>
            <stop offset="100%" stop-color="#1B0207"/>
          </linearGradient>
          <linearGradient id="pureZardozi" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FCEBA7"/>
            <stop offset="50%" stop-color="#D4AF37"/>
            <stop offset="100%" stop-color="#996515"/>
          </linearGradient>
          <linearGradient id="organzaDupatta" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FCEBA7" stop-opacity="0.75"/>
            <stop offset="100%" stop-color="#D4AF37" stop-opacity="0.35"/>
          </linearGradient>
        </defs>
        <rect width="400" height="520" fill="#F8F4EE"/>
        
        <ellipse cx="200" cy="505" rx="80" ry="12" fill="#000000" opacity="0.12" filter="blur(6px)"/>
        
        <!-- Churidar Legs with Churi Gathers -->
        <g fill="#24030B">
          <!-- Left Leg -->
          <path d="M175 380 L170 495 Q176 498 184 495 L190 380 Z"/>
          <!-- Right Leg -->
          <path d="M210 380 L216 495 Q224 498 230 495 L225 380 Z"/>
          <!-- Churi Gathers (Pleats) -->
          <path d="M168 450 Q177 453 186 450 M168 460 Q177 463 186 460 M169 470 Q177 473 185 470 M170 480 Q177 483 184 480" stroke="url(#pureZardozi)" stroke-width="0.8" fill="none"/>
          <path d="M214 450 Q223 453 232 450 M214 460 Q223 463 232 460 M215 470 Q223 473 231 470 M216 480 Q223 483 230 480" stroke="url(#pureZardozi)" stroke-width="0.8" fill="none"/>
        </g>

        <!-- Mannequin Neck -->
        <path d="M185 45 C185 25 215 25 215 45 L218 80 L182 80 Z" fill="#E8D5C4"/>

        <!-- Velvet Sleeves -->
        <path d="M148 95 L95 240 Q105 245 125 242 L162 135 Z" fill="url(#velvetWine)"/>
        <path d="M252 95 L305 240 Q295 245 275 242 L238 135 Z" fill="url(#velvetWine)"/>
        <rect x="94" y="232" width="32" height="10" transform="rotate(-6 110 236)" fill="url(#pureZardozi)"/>
        <rect x="274" y="232" width="32" height="10" transform="rotate(6 290 236)" fill="url(#pureZardozi)"/>

        <!-- Velvet Kurta Body -->
        <path d="M162 92 Q200 100 238 92 L256 220 L270 400 Q200 408 130 400 L144 220 Z" fill="url(#velvetWine)"/>
        <!-- Luxurious Velvet Sheen Layer -->
        <path d="M180 100 Q190 250 170 395" stroke="#FFFFFF" stroke-width="3" opacity="0.08" fill="none" filter="blur(2px)"/>
        <path d="M220 100 Q210 250 230 395" stroke="#FFFFFF" stroke-width="3" opacity="0.08" fill="none" filter="blur(2px)"/>

        <!-- Heavy Zardozi Mughal Yoke -->
        <path d="M172 95 Q200 112 228 95 L232 195 Q200 225 168 195 Z" fill="url(#pureZardozi)"/>
        <path d="M176 98 Q200 114 224 98 L227 190 Q200 216 173 190 Z" fill="#2E040E"/>
        <!-- Dabka Work Floral Tree of Life -->
        <g stroke="url(#pureZardozi)" stroke-width="1.2" fill="none">
          <circle cx="200" cy="130" r="5" fill="url(#pureZardozi)"/>
          <circle cx="200" cy="160" r="5" fill="url(#pureZardozi)"/>
          <circle cx="200" cy="190" r="5" fill="url(#pureZardozi)"/>
          <path d="M200 120 L200 205"/>
          <path d="M190 140 Q175 145 182 160 Q195 155 200 160"/>
          <path d="M210 140 Q225 145 218 160 Q205 155 200 160"/>
        </g>

        <!-- Draped Scalloped Organza Dupatta Across Shoulder -->
        <path d="M130 85 Q90 200 70 380 Q95 385 110 375 Q125 210 160 92 Z" fill="url(#organzaDupatta)" stroke="url(#pureZardozi)" stroke-width="1.5"/>
        
        <!-- Hem Zardozi Border -->
        <path d="M130 390 Q200 398 270 390 L270 400 Q200 408 130 400 Z" fill="url(#pureZardozi)"/>

        <text x="360" y="495" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#4C0C1B" opacity="0.85" letter-spacing="1">3-PIECE BRIDAL VELVET</text>
      </svg>
    `;
  },

  _renderTealBrocade(base, accent, angle) {
    return `
      <svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" class="rf-garment-svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="tealSilk" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#11554E"/>
            <stop offset="50%" stop-color="#0B3C37"/>
            <stop offset="100%" stop-color="#04201D"/>
          </linearGradient>
          <linearGradient id="goldTissue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFF5B8" stop-opacity="0.85"/>
            <stop offset="100%" stop-color="#D4AF37" stop-opacity="0.65"/>
          </linearGradient>
          <pattern id="brocadeFloral" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M13 3 Q20 13 13 23 Q6 13 13 3 Z" fill="none" stroke="#D4AF37" stroke-width="0.9"/>
            <circle cx="13" cy="13" r="2.5" fill="#D4AF37"/>
          </pattern>
        </defs>
        <rect width="400" height="520" fill="#FAF9F4"/>
        
        <ellipse cx="200" cy="505" rx="80" ry="12" fill="#000000" opacity="0.1" filter="blur(6px)"/>
        
        <!-- Raw Silk Churidar Legs -->
        <g fill="#072A26">
          <path d="M175 380 L170 495 Q176 498 184 495 L190 380 Z"/>
          <path d="M210 380 L216 495 Q224 498 230 495 L225 380 Z"/>
          <!-- Churi folds -->
          <path d="M168 455 Q177 458 186 455 M169 468 Q177 471 185 468 M170 480 Q177 483 184 480" stroke="#D4AF37" stroke-width="0.8" fill="none"/>
          <path d="M214 455 Q223 458 232 455 M215 468 Q223 471 231 468 M216 480 Q223 483 230 480" stroke="#D4AF37" stroke-width="0.8" fill="none"/>
        </g>

        <!-- Mannequin Neck -->
        <path d="M185 45 C185 25 215 25 215 45 L218 80 L182 80 Z" fill="#E8D5C4"/>

        <!-- Sleeves -->
        <path d="M148 95 L95 240 Q105 245 125 242 L162 135 Z" fill="url(#tealSilk)"/>
        <path d="M148 95 L95 240 Q105 245 125 242 L162 135 Z" fill="url(#brocadeFloral)"/>
        <path d="M252 95 L305 240 Q295 245 275 242 L238 135 Z" fill="url(#tealSilk)"/>
        <path d="M252 95 L305 240 Q295 245 275 242 L238 135 Z" fill="url(#brocadeFloral)"/>

        <!-- Kurti Body -->
        <path d="M162 92 Q200 100 238 92 L256 220 L270 400 Q200 408 130 400 L144 220 Z" fill="url(#tealSilk)"/>
        <path d="M162 92 Q200 100 238 92 L256 220 L270 400 Q200 408 130 400 L144 220 Z" fill="url(#brocadeFloral)"/>

        <!-- Placket Gold Motif -->
        <path d="M180 95 Q200 105 220 95 L224 220 Q200 235 176 220 Z" fill="#0B3C37" stroke="#D4AF37" stroke-width="1.5"/>
        <circle cx="200" cy="120" r="3" fill="#D4AF37"/>
        <circle cx="200" cy="145" r="3" fill="#D4AF37"/>
        <circle cx="200" cy="170" r="3" fill="#D4AF37"/>
        <circle cx="200" cy="195" r="3" fill="#D4AF37"/>

        <!-- Gold Tissue Dupatta Swirl -->
        <path d="M245 92 Q290 180 320 370 Q295 380 270 365 Q260 210 235 92 Z" fill="url(#goldTissue)" stroke="#D4AF37" stroke-width="1.2"/>

        <path d="M130 390 Q200 398 270 390 L270 400 Q200 408 130 400 Z" fill="#D4AF37"/>

        <text x="360" y="495" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#0B3C37" opacity="0.8" letter-spacing="1">BANARASI BROCADE SUIT</text>
      </svg>
    `;
  },

  _renderSageOrganza(base, accent, angle) {
    return `
      <svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" class="rf-garment-svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#8FA89B"/>
            <stop offset="60%" stop-color="#6F8F7E"/>
            <stop offset="100%" stop-color="#557564"/>
          </linearGradient>
          <pattern id="paintedFlora" width="34" height="34" patternUnits="userSpaceOnUse">
            <circle cx="17" cy="17" r="7" fill="#F8E5E5" opacity="0.8"/>
            <circle cx="17" cy="17" r="3" fill="#DF9999" opacity="0.9"/>
            <path d="M17 6 Q20 12 17 17 Q14 12 17 6 Z" fill="#A7C2B2" opacity="0.75"/>
          </pattern>
        </defs>
        <rect width="400" height="520" fill="#FBFDFC"/>
        
        <ellipse cx="200" cy="505" rx="80" ry="12" fill="#000000" opacity="0.06" filter="blur(6px)"/>
        
        <!-- Soft Modal Churidar Legs -->
        <g fill="#557564">
          <path d="M175 380 L170 495 Q176 498 184 495 L190 380 Z"/>
          <path d="M210 380 L216 495 Q224 498 230 495 L225 380 Z"/>
        </g>

        <!-- Mannequin Neck -->
        <path d="M185 45 C185 25 215 25 215 45 L218 80 L182 80 Z" fill="#E8D5C4"/>

        <!-- Sheer Sleeves -->
        <path d="M148 95 L95 240 Q105 245 125 242 L162 135 Z" fill="url(#sageGrad)" opacity="0.85"/>
        <path d="M252 95 L305 240 Q295 245 275 242 L238 135 Z" fill="url(#sageGrad)" opacity="0.85"/>

        <!-- Kurti Body -->
        <path d="M162 92 Q200 100 238 92 L256 220 L270 400 Q200 408 130 400 L144 220 Z" fill="url(#sageGrad)"/>
        <path d="M162 92 Q200 100 238 92 L256 220 L270 400 Q200 408 130 400 L144 220 Z" fill="url(#paintedFlora)"/>

        <!-- Scalloped Hem with Pearl Trim -->
        <path d="M130 395 Q145 405 160 395 Q175 405 190 395 Q205 405 220 395 Q235 405 250 395 Q265 405 270 395" stroke="#FFFFFF" stroke-width="2.5" fill="none"/>
        <circle cx="160" cy="402" r="2.5" fill="#FFFFFF"/>
        <circle cx="190" cy="402" r="2.5" fill="#FFFFFF"/>
        <circle cx="220" cy="402" r="2.5" fill="#FFFFFF"/>
        <circle cx="250" cy="402" r="2.5" fill="#FFFFFF"/>

        <text x="360" y="495" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#557564" opacity="0.8" letter-spacing="1">HAND-PAINTED ORGANZA</text>
      </svg>
    `;
  },

  _renderIvoryChanderi(base, accent, angle) {
    return `
      <svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" class="rf-garment-svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="ivorySilk" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFFFFF"/>
            <stop offset="60%" stop-color="#F7F3E9"/>
            <stop offset="100%" stop-color="#ECE5D4"/>
          </linearGradient>
          <linearGradient id="roseGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#F2D1C9"/>
            <stop offset="50%" stop-color="#C58C85"/>
            <stop offset="100%" stop-color="#9C5E57"/>
          </linearGradient>
        </defs>
        <rect width="400" height="520" fill="#F8F6F0"/>
        
        <ellipse cx="200" cy="505" rx="80" ry="12" fill="#000000" opacity="0.08" filter="blur(6px)"/>
        
        <!-- Churidar Legs -->
        <g fill="#ECE5D4">
          <path d="M175 380 L170 495 Q176 498 184 495 L190 380 Z"/>
          <path d="M210 380 L216 495 Q224 498 230 495 L225 380 Z"/>
          <path d="M168 455 Q177 458 186 455 M169 468 Q177 471 185 468" stroke="url(#roseGold)" stroke-width="0.8" fill="none"/>
          <path d="M214 455 Q223 458 232 455 M215 468 Q223 471 231 468" stroke="url(#roseGold)" stroke-width="0.8" fill="none"/>
        </g>

        <!-- Mannequin Neck -->
        <path d="M185 45 C185 25 215 25 215 45 L218 80 L182 80 Z" fill="#E8D5C4"/>

        <!-- Sleeves -->
        <path d="M148 95 L95 240 Q105 245 125 242 L162 135 Z" fill="url(#ivorySilk)"/>
        <path d="M252 95 L305 240 Q295 245 275 242 L238 135 Z" fill="url(#ivorySilk)"/>

        <!-- Kurti Body -->
        <path d="M162 92 Q200 100 238 92 L256 220 L270 400 Q200 408 130 400 L144 220 Z" fill="url(#ivorySilk)"/>

        <!-- Rose Gold Angrakha Placket & Cutwork -->
        <path d="M175 92 L225 180 L195 260 L144 220 Z" fill="none" stroke="url(#roseGold)" stroke-width="2"/>
        <circle cx="215" cy="165" r="4" fill="url(#roseGold)"/>
        <circle cx="205" cy="205" r="4" fill="url(#roseGold)"/>

        <!-- Rose Gold Cutwork Hem -->
        <path d="M130 388 Q200 396 270 388 L270 400 Q200 408 130 400 Z" fill="url(#roseGold)"/>

        <text x="360" y="495" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#9C5E57" opacity="0.8" letter-spacing="1">IVORY & ROSE GOLD CHANDERI</text>
      </svg>
    `;
  },

  _renderCrimsonAngrakha(base, accent, angle) {
    return `
      <svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" class="rf-garment-svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="crimsonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#C52222"/>
            <stop offset="50%" stop-color="#991B1B"/>
            <stop offset="100%" stop-color="#660E0E"/>
          </linearGradient>
          <linearGradient id="gotaGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFF0A0"/>
            <stop offset="100%" stop-color="#D97706"/>
          </linearGradient>
        </defs>
        <rect width="400" height="520" fill="#FFF9F5"/>
        
        <ellipse cx="200" cy="505" rx="80" ry="12" fill="#000000" opacity="0.09" filter="blur(6px)"/>
        
        <!-- Churidar Legs -->
        <g fill="#7F1D1D">
          <path d="M175 380 L170 495 Q176 498 184 495 L190 380 Z"/>
          <path d="M210 380 L216 495 Q224 498 230 495 L225 380 Z"/>
          <path d="M168 455 Q177 458 186 455 M169 468 Q177 471 185 468" stroke="url(#gotaGold)" stroke-width="0.8" fill="none"/>
          <path d="M214 455 Q223 458 232 455 M215 468 Q223 471 231 468" stroke="url(#gotaGold)" stroke-width="0.8" fill="none"/>
        </g>

        <!-- Mannequin Neck -->
        <path d="M185 45 C185 25 215 25 215 45 L218 80 L182 80 Z" fill="#E8D5C4"/>

        <!-- Sleeves -->
        <path d="M148 95 L95 240 Q105 245 125 242 L162 135 Z" fill="url(#crimsonGrad)"/>
        <path d="M252 95 L305 240 Q295 245 275 242 L238 135 Z" fill="url(#crimsonGrad)"/>

        <!-- Angrakha Overlap Flared Body -->
        <path d="M162 92 Q200 100 238 92 L256 220 L275 400 Q200 410 125 400 L144 220 Z" fill="url(#crimsonGrad)"/>
        
        <!-- Angrakha Diagonal Gota Flap -->
        <path d="M162 92 L245 190 L145 320" stroke="url(#gotaGold)" stroke-width="3" fill="none"/>
        
        <!-- Hanging Latkan / Artisan Tassels -->
        <path d="M245 190 Q250 240 248 270" stroke="url(#gotaGold)" stroke-width="1.5" fill="none"/>
        <circle cx="248" cy="274" r="5" fill="url(#gotaGold)"/>
        <circle cx="248" cy="285" r="4" fill="#991B1B"/>

        <!-- Gota Patti Floral Clusters -->
        <circle cx="180" cy="230" r="5" fill="url(#gotaGold)"/>
        <circle cx="210" cy="280" r="5" fill="url(#gotaGold)"/>
        <circle cx="160" cy="330" r="5" fill="url(#gotaGold)"/>

        <!-- Broad Gota Patti Hem -->
        <path d="M125 390 Q200 400 275 390 L275 400 Q200 410 125 400 Z" fill="url(#gotaGold)"/>

        <text x="360" y="495" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#991B1B" opacity="0.8" letter-spacing="1">RAJASTHANI GOTA PATTI</text>
      </svg>
    `;
  },

  _renderIndigoCotton(base, accent, angle) {
    return `
      <svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" class="rf-garment-svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="indigoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#25479E"/>
            <stop offset="50%" stop-color="#1E3A8A"/>
            <stop offset="100%" stop-color="#142661"/>
          </linearGradient>
          <pattern id="dabuPrint" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="3" fill="#FFFFFF" opacity="0.9"/>
            <path d="M10 2 L10 18 M2 10 L18 10" stroke="#FFFFFF" stroke-width="0.8" opacity="0.75"/>
          </pattern>
        </defs>
        <rect width="400" height="520" fill="#F6F9FD"/>
        
        <ellipse cx="200" cy="505" rx="80" ry="12" fill="#000000" opacity="0.06" filter="blur(6px)"/>
        
        <!-- White Pure Cotton Churidar Legs -->
        <g fill="#FFFFFF" stroke="#E2E8F0">
          <path d="M175 380 L170 495 Q176 498 184 495 L190 380 Z"/>
          <path d="M210 380 L216 495 Q224 498 230 495 L225 380 Z"/>
          <path d="M168 455 Q177 458 186 455 M169 468 Q177 471 185 468" stroke="#CBD5E1" stroke-width="0.8" fill="none"/>
          <path d="M214 455 Q223 458 232 455 M215 468 Q223 471 231 468" stroke="#CBD5E1" stroke-width="0.8" fill="none"/>
        </g>

        <!-- Mannequin Neck -->
        <path d="M185 45 C185 25 215 25 215 45 L218 80 L182 80 Z" fill="#E8D5C4"/>

        <!-- Sleeves -->
        <path d="M148 95 L95 240 Q105 245 125 242 L162 135 Z" fill="url(#indigoGrad)"/>
        <path d="M148 95 L95 240 Q105 245 125 242 L162 135 Z" fill="url(#dabuPrint)"/>
        <path d="M252 95 L305 240 Q295 245 275 242 L238 135 Z" fill="url(#indigoGrad)"/>
        <path d="M252 95 L305 240 Q295 245 275 242 L238 135 Z" fill="url(#dabuPrint)"/>

        <!-- Kurti Body -->
        <path d="M162 92 Q200 100 238 92 L256 220 L270 400 Q200 408 130 400 L144 220 Z" fill="url(#indigoGrad)"/>
        <path d="M162 92 Q200 100 238 92 L256 220 L270 400 Q200 408 130 400 L144 220 Z" fill="url(#dabuPrint)"/>

        <!-- Boat Neck & Placket -->
        <path d="M175 92 Q200 104 225 92 L220 180 L180 180 Z" fill="#FFFFFF" opacity="0.95"/>
        <circle cx="200" cy="120" r="3" fill="#1E3A8A"/>
        <circle cx="200" cy="145" r="3" fill="#1E3A8A"/>
        <circle cx="200" cy="170" r="3" fill="#1E3A8A"/>

        <text x="360" y="495" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#1E3A8A" opacity="0.8" letter-spacing="1">DABU INDIGO BLOCK PRINT</text>
      </svg>
    `;
  },

  _renderNavyCapeDhoti(base, accent, angle) {
    return `
      <svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" class="rf-garment-svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="navyMidnight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1E293B"/>
            <stop offset="60%" stop-color="#0F172A"/>
            <stop offset="100%" stop-color="#020617"/>
          </linearGradient>
          <linearGradient id="copperZari" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FBBF24"/>
            <stop offset="50%" stop-color="#D97706"/>
            <stop offset="100%" stop-color="#92400E"/>
          </linearGradient>
        </defs>
        <rect width="400" height="520" fill="#F8FAFC"/>
        
        <ellipse cx="200" cy="505" rx="85" ry="12" fill="#000000" opacity="0.1" filter="blur(6px)"/>

        <!-- Cowled Dhoti Pants with Dramatic Pleats -->
        <g fill="#0F172A">
          <path d="M155 220 Q120 340 165 480 Q178 485 186 480 Q170 360 196 240 Z"/>
          <path d="M245 220 Q280 340 235 480 Q222 485 214 480 Q230 360 204 240 Z"/>
          <!-- Dhoti Cowl Drape Lines -->
          <path d="M140 280 Q160 340 180 320" stroke="url(#copperZari)" stroke-width="1" fill="none" opacity="0.7"/>
          <path d="M148 330 Q165 390 182 370" stroke="url(#copperZari)" stroke-width="1" fill="none" opacity="0.7"/>
          <path d="M260 280 Q240 340 220 320" stroke="url(#copperZari)" stroke-width="1" fill="none" opacity="0.7"/>
          <path d="M252 330 Q235 390 218 370" stroke="url(#copperZari)" stroke-width="1" fill="none" opacity="0.7"/>
        </g>

        <!-- Mannequin Neck -->
        <path d="M185 45 C185 25 215 25 215 45 L218 80 L182 80 Z" fill="#E8D5C4"/>

        <!-- Floor Sweeping Sheer Cape -->
        <path d="M150 92 Q80 260 70 470 Q110 475 140 450 Q120 280 160 110 Z" fill="#0F172A" opacity="0.45" stroke="url(#copperZari)" stroke-width="1"/>
        <path d="M250 92 Q320 260 330 470 Q290 475 260 450 Q280 280 240 110 Z" fill="#0F172A" opacity="0.45" stroke="url(#copperZari)" stroke-width="1"/>

        <!-- Crop Kurti Top with Geometric Copper Embroidery -->
        <path d="M162 92 Q200 100 238 92 L245 220 Q200 225 155 220 Z" fill="url(#navyMidnight)"/>
        
        <!-- Geometric Copper Neckline -->
        <polygon points="200,105 215,125 200,145 185,125" fill="none" stroke="url(#copperZari)" stroke-width="1.8"/>
        <polygon points="200,145 215,165 200,185 185,165" fill="none" stroke="url(#copperZari)" stroke-width="1.8"/>
        <polygon points="200,185 215,205 200,225 185,205" fill="none" stroke="url(#copperZari)" stroke-width="1.8"/>

        <text x="360" y="495" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#0F172A" opacity="0.8" letter-spacing="1">INDO-WESTERN CAPE & DHOTI</text>
      </svg>
    `;
  },

  _renderSaffronSharara(base, accent, angle) {
    return `
      <svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" class="rf-garment-svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="saffronGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FB923C"/>
            <stop offset="50%" stop-color="#EA580C"/>
            <stop offset="100%" stop-color="#9A3412"/>
          </linearGradient>
          <linearGradient id="brightGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FEF08A"/>
            <stop offset="100%" stop-color="#CA8A04"/>
          </linearGradient>
        </defs>
        <rect width="400" height="520" fill="#FFFBF5"/>
        
        <ellipse cx="200" cy="505" rx="110" ry="14" fill="#000000" opacity="0.08" filter="blur(6px)"/>

        <!-- Multi-tiered Voluminous Sharara Pants -->
        <!-- Tier 1 -->
        <path d="M165 240 L140 330 Q175 338 195 330 L195 240 Z" fill="url(#saffronGrad)"/>
        <path d="M235 240 L260 330 Q225 338 205 330 L205 240 Z" fill="url(#saffronGrad)"/>
        <!-- Tier 2 & 3 (Wide Flare with Gota Rings) -->
        <path d="M140 330 L95 480 Q150 495 195 480 L195 330 Z" fill="url(#saffronGrad)"/>
        <path d="M260 330 L305 480 Q250 495 205 480 L205 330 Z" fill="url(#saffronGrad)"/>

        <!-- Gota Rings along Sharara Tiers -->
        <path d="M140 330 Q168 338 195 330" stroke="url(#brightGold)" stroke-width="2.5" fill="none"/>
        <path d="M260 330 Q232 338 205 330" stroke="url(#brightGold)" stroke-width="2.5" fill="none"/>
        <path d="M120 405 Q158 415 195 405" stroke="url(#brightGold)" stroke-width="2" fill="none"/>
        <path d="M280 405 Q242 415 205 405" stroke="url(#brightGold)" stroke-width="2" fill="none"/>
        <path d="M95 470 Q145 485 195 470 L195 480 Q150 495 95 480 Z" fill="url(#brightGold)"/>
        <path d="M305 470 Q255 485 205 470 L205 480 Q250 495 305 480 Z" fill="url(#brightGold)"/>

        <!-- Mannequin Neck -->
        <path d="M185 45 C185 25 215 25 215 45 L218 80 L182 80 Z" fill="#E8D5C4"/>

        <!-- Sleeves -->
        <path d="M148 95 L115 190 Q125 195 138 192 L160 125 Z" fill="url(#saffronGrad)"/>
        <path d="M252 95 L285 190 Q275 195 262 192 L240 125 Z" fill="url(#saffronGrad)"/>

        <!-- Short Kurti with Mirror Yoke -->
        <path d="M162 92 Q200 98 238 92 L248 245 Q200 255 152 245 Z" fill="url(#saffronGrad)"/>
        <path d="M175 95 Q200 108 225 95 L228 180 Q200 195 172 180 Z" fill="#9A3412" stroke="url(#brightGold)" stroke-width="1.5"/>
        <circle cx="200" cy="120" r="4" fill="#FFFFFF"/>
        <circle cx="200" cy="140" r="4" fill="#FFFFFF"/>
        <circle cx="200" cy="160" r="4" fill="#FFFFFF"/>

        <text x="360" y="495" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#EA580C" opacity="0.8" letter-spacing="1">HALDI SHARARA ENSEMBLE</text>
      </svg>
    `;
  },

  _renderPeachPeplum(base, accent, angle) {
    return `
      <svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" class="rf-garment-svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="peachGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#F2ADA4"/>
            <stop offset="50%" stop-color="#E0938A"/>
            <stop offset="100%" stop-color="#B86C63"/>
          </linearGradient>
        </defs>
        <rect width="400" height="520" fill="#FFF9F8"/>
        
        <ellipse cx="200" cy="505" rx="80" ry="12" fill="#000000" opacity="0.06" filter="blur(6px)"/>

        <!-- Wide Leg Palazzo Pants -->
        <g fill="url(#peachGrad)">
          <path d="M165 240 L130 480 Q160 485 195 480 L195 240 Z"/>
          <path d="M235 240 L270 480 Q240 485 205 480 L205 240 Z"/>
          <!-- Palazzo Hem Thread Embroidery -->
          <rect x="130" y="468" width="65" height="8" fill="#FFFFFF" opacity="0.8"/>
          <rect x="205" y="468" width="65" height="8" fill="#FFFFFF" opacity="0.8"/>
        </g>

        <!-- Mannequin Neck -->
        <path d="M185 45 C185 25 215 25 215 45 L218 80 L182 80 Z" fill="#E8D5C4"/>

        <!-- Sleeves -->
        <path d="M148 95 L115 190 Q125 195 138 192 L160 125 Z" fill="url(#peachGrad)"/>
        <path d="M252 95 L285 190 Q275 195 262 192 L240 125 Z" fill="url(#peachGrad)"/>

        <!-- Peplum Top -->
        <path d="M162 92 Q200 98 238 92 L244 185 Q200 190 156 185 Z" fill="url(#peachGrad)"/>
        <path d="M156 185 Q200 190 244 185 L260 270 Q200 280 140 270 Z" fill="url(#peachGrad)"/>
        
        <text x="360" y="495" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#B86C63" opacity="0.8" letter-spacing="1">MODAL SILK CO-ORD</text>
      </svg>
    `;
  },

  _renderRustLinen(base, accent, angle) {
    return `
      <svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" class="rf-garment-svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="rustGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#C2410C"/>
            <stop offset="50%" stop-color="#9A3412"/>
            <stop offset="100%" stop-color="#6B2106"/>
          </linearGradient>
        </defs>
        <rect width="400" height="520" fill="#FAF7F2"/>
        
        <ellipse cx="200" cy="505" rx="75" ry="12" fill="#000000" opacity="0.06" filter="blur(6px)"/>

        <!-- Cigarette Pants -->
        <g fill="#431407">
          <path d="M175 320 L168 480 Q176 484 184 480 L192 320 Z"/>
          <path d="M208 320 L216 480 Q224 484 232 480 L225 320 Z"/>
        </g>

        <!-- Mannequin Neck -->
        <path d="M185 45 C185 25 215 25 215 45 L218 80 L182 80 Z" fill="#E8D5C4"/>

        <!-- Sleeves -->
        <path d="M148 95 L108 200 Q120 205 134 202 L160 125 Z" fill="url(#rustGrad)"/>
        <path d="M252 95 L292 200 Q280 205 266 202 L240 125 Z" fill="url(#rustGrad)"/>

        <!-- High-Low Asymmetrical Tunic -->
        <path d="M162 92 Q200 98 238 92 L254 220 L275 330 Q200 365 130 300 L146 220 Z" fill="url(#rustGrad)"/>
        
        <!-- Wooden Buttons -->
        <circle cx="200" cy="115" r="3" fill="#D97706"/>
        <circle cx="200" cy="140" r="3" fill="#D97706"/>
        <circle cx="200" cy="165" r="3" fill="#D97706"/>

        <text x="360" y="495" text-anchor="end" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#9A3412" opacity="0.8" letter-spacing="1">HANDLOOM LINEN SILK</text>
      </svg>
    `;
  }
};
