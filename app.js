/* azr-promt — © azrDev
 * Semua logika sisi klien. Fungsi analisis & penyusun prompt bersifat murni
 * (tidak menyentuh DOM) agar mudah diuji di Node.
 */
(function (root) {
  'use strict';

  /* ==================================================================
   *  1. UTIL WARNA & ANALISIS PIKSEL (murni)
   * ================================================================== */

  const hex2 = (n) => n.toString(16).padStart(2, '0');
  const toHex = (r, g, b) => '#' + hex2(r) + hex2(g) + hex2(b);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    let h = 0, s = 0;
    const d = mx - mn;
    if (d > 0) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (mx === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
    }
    return { h, s, l };
  }

  const HUES = [
    [15, 'red'], [40, 'orange'], [65, 'yellow'], [90, 'lime'], [150, 'green'],
    [185, 'teal'], [205, 'cyan'], [225, 'sky blue'], [255, 'blue'], [275, 'indigo'],
    [300, 'purple'], [330, 'magenta'], [345, 'pink'], [361, 'red'],
  ];

  function nameColor(r, g, b) {
    const { h, s, l } = rgb2hsl(r, g, b);
    if (l < 0.09) return 'black';
    if (l > 0.94 && s < 0.35) return 'white';
    if (s < 0.1) return l < 0.3 ? 'charcoal gray' : l < 0.65 ? 'gray' : 'light gray';
    let base = 'red';
    for (const [lim, name] of HUES) { if (h < lim) { base = name; break; } }
    if ((base === 'orange' || base === 'yellow') && l < 0.38) base = 'brown';
    if (base === 'red' && l > 0.72) base = 'light pink';
    let mod = '';
    if (l < 0.25) mod = 'very dark ';
    else if (l < 0.38) mod = 'dark ';
    else if (l > 0.82) mod = 'pale ';
    else if (l > 0.68) mod = 'light ';
    else if (s > 0.8) mod = 'vivid ';
    else if (s < 0.35) mod = 'muted ';
    return (mod + base).trim();
  }

  function nearestAspect(w, h) {
    const cands = [[1, 1], [5, 4], [4, 3], [3, 2], [16, 9], [2, 1], [21, 9], [3, 1], [4, 1]];
    const all = [];
    cands.forEach(([a, b]) => { all.push([a, b]); if (a !== b) all.push([b, a]); });
    const r = w / h;
    let best = all[0], bd = Infinity;
    for (const c of all) {
      const d = Math.abs(Math.log(r / (c[0] / c[1])));
      if (d < bd) { bd = d; best = c; }
    }
    return { label: best[0] + ':' + best[1], approx: bd > 0.06, ratio: r };
  }

  /**
   * Analisis piksel. `img` = { data:Uint8ClampedArray RGBA, width, height }.
   * Mengembalikan statistik visual dasar (bukan pengenalan objek).
   */
  function analyzePixels(img) {
    const { data, width: w, height: h } = img;
    const N = w * h;
    const L = new Float32Array(N);
    const bins = new Map();
    let sumL = 0, sumL2 = 0, sumS = 0, sumR = 0, sumB = 0, counted = 0, transp = 0;

    for (let i = 0, p = 0; i < N; i++, p += 4) {
      const a = data[p + 3];
      const r = data[p], g = data[p + 1], b = data[p + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      L[i] = lum;
      if (a < 40) { transp++; continue; }
      counted++;
      sumL += lum; sumL2 += lum * lum; sumR += r; sumB += b;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      sumS += mx === 0 ? 0 : (mx - mn) / mx;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      let e = bins.get(key);
      if (!e) { e = { n: 0, r: 0, g: 0, b: 0 }; bins.set(key, e); }
      e.n++; e.r += r; e.g += g; e.b += b;
    }
    const cn = Math.max(counted, 1);
    const meanL = sumL / cn;
    const stdL = Math.sqrt(Math.max(sumL2 / cn - meanL * meanL, 0));
    const meanS = sumS / cn;
    const warm = (sumR - sumB) / cn;

    // --- palet: pilih pusat warna berjauhan, lalu kelompokkan semua bin ---
    const list = [...bins.values()]
      .map((e) => ({ n: e.n, r: e.r / e.n, g: e.g / e.n, b: e.b / e.n }))
      .sort((x, y) => y.n - x.n);
    const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
    const centers = [];
    for (const c of list) {
      if (centers.length >= 8) break;
      if (centers.every((k) => dist(k, c) > 58)) centers.push({ r: c.r, g: c.g, b: c.b, n: 0, sr: 0, sg: 0, sb: 0 });
    }
    for (const c of list) {
      let bk = centers[0], bd = Infinity;
      for (const k of centers) { const d = dist(k, c); if (d < bd) { bd = d; bk = k; } }
      if (bk) { bk.n += c.n; bk.sr += c.r * c.n; bk.sg += c.g * c.n; bk.sb += c.b * c.n; }
    }
    const palette = centers
      .filter((k) => k.n > 0)
      .map((k) => {
        const r = Math.round(k.sr / k.n), g = Math.round(k.sg / k.n), b = Math.round(k.sb / k.n);
        return { hex: toHex(r, g, b), name: nameColor(r, g, b), pct: (k.n / cn) * 100, r, g, b };
      })
      .sort((a, b) => b.pct - a.pct);

    // --- tepi, pusat bobot visual, simetri, wilayah cahaya ---
    let edges = 0, wx = 0, wy = 0, wsum = 0;
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        const i = y * w + x;
        const d = Math.abs(L[i] - L[i + 1]) + Math.abs(L[i] - L[i + w]);
        if (d > 40) edges++;
        wx += x * d; wy += y * d; wsum += d;
      }
    }
    const edgeDensity = edges / Math.max((w - 1) * (h - 1), 1);
    const cx = wsum > 0 ? wx / wsum / w : 0.5;
    const cy = wsum > 0 ? wy / wsum / h : 0.5;

    let lL = 0, lR = 0, lT = 0, lB = 0, nL = 0, nR = 0, nT = 0, nB = 0;
    let cL = 0, cN = 0, eL = 0, eN = 0, symD = 0, symN = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = L[y * w + x];
        if (x < w / 2) { lL += v; nL++; } else { lR += v; nR++; }
        if (y < h / 2) { lT += v; nT++; } else { lB += v; nB++; }
        const inC = x > w / 3 && x < (2 * w) / 3 && y > h / 3 && y < (2 * h) / 3;
        if (inC) { cL += v; cN++; } else { eL += v; eN++; }
        if (x < w / 2) { symD += Math.abs(v - L[y * w + (w - 1 - x)]); symN++; }
      }
    }
    const mL = lL / nL, mR = lR / nR, mT = lT / nT, mB = lB / nB;
    const mC = cL / Math.max(cN, 1), mE = eL / Math.max(eN, 1);
    const symScore = 1 - symD / Math.max(symN, 1) / 255;

    // --- latar (cincin tepi) ---
    const ring = Math.max(2, Math.round(Math.min(w, h) * 0.04));
    let br = 0, bg = 0, bb = 0, bn = 0, br2 = 0, bg2 = 0, bb2 = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x >= ring && x < w - ring && y >= ring && y < h - ring) continue;
        const p = (y * w + x) * 4;
        if (data[p + 3] < 40) continue;
        br += data[p]; bg += data[p + 1]; bb += data[p + 2];
        br2 += data[p] ** 2; bg2 += data[p + 1] ** 2; bb2 += data[p + 2] ** 2; bn++;
      }
    }
    let bgInfo = { uniform: false, hex: null, name: null };
    if (bn > 0) {
      const mr = br / bn, mg = bg / bn, mb = bb / bn;
      const sd = Math.max(
        Math.sqrt(Math.max(br2 / bn - mr * mr, 0)),
        Math.sqrt(Math.max(bg2 / bn - mg * mg, 0)),
        Math.sqrt(Math.max(bb2 / bn - mb * mb, 0))
      );
      const R = Math.round(mr), G = Math.round(mg), B = Math.round(mb);
      bgInfo = { uniform: sd < 16, hex: toHex(R, G, B), name: nameColor(R, G, B) };
    }

    // --- harmoni warna dari rona palet berbobot ---
    const chroma = palette.filter((c) => rgb2hsl(c.r, c.g, c.b).s > 0.22 && c.pct > 2);
    let harmony = 'neutral / achromatic';
    if (chroma.length === 1) harmony = 'monochromatic';
    else if (chroma.length > 1) {
      const hs = chroma.map((c) => rgb2hsl(c.r, c.g, c.b).h);
      let maxGap = 0;
      for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
        const d = Math.abs(hs[i] - hs[j]); maxGap = Math.max(maxGap, Math.min(d, 360 - d));
      }
      harmony = maxGap < 45 ? 'analogous' : maxGap > 150 ? 'complementary' : maxGap > 100 ? 'triadic / split-complementary' : 'varied';
    }

    // --- label ---
    const brightnessLabel = meanL < 70 ? 'low-key' : meanL > 175 ? 'high-key' : 'balanced';
    const contrastLabel = stdL < 38 ? 'soft' : stdL > 72 ? 'high' : 'medium';
    const satLabel = meanS < 0.18 ? 'desaturated' : meanS > 0.55 ? 'saturated' : 'natural';
    const temperature = warm > 18 ? 'warm' : warm < -18 ? 'cool' : 'neutral';
    const complexityLabel = edgeDensity < 0.05 ? 'minimal' : edgeDensity < 0.16 ? 'moderate' : 'dense';
    const transparent = transp / N > 0.02;

    const lightBits = [];
    if (Math.abs(mL - mR) > 22) lightBits.push(mL > mR ? 'left' : 'right');
    if (Math.abs(mT - mB) > 22) lightBits.push(mT > mB ? 'top' : 'bottom');
    const lightDir = lightBits.length ? 'from the ' + lightBits.join('-') : 'even / frontal';
    const vignette = mE < mC - 25;
    const symmetry = symScore > 0.93 ? 'near-symmetrical' : symScore > 0.85 ? 'loosely balanced' : 'asymmetrical';

    let weight = 'centered';
    const dx = cx - 0.5, dy = cy - 0.5;
    const hw = Math.abs(dx) > 0.07 ? (dx < 0 ? 'left' : 'right') : '';
    const vw = Math.abs(dy) > 0.07 ? (dy < 0 ? 'top' : 'bottom') : '';
    if (hw || vw) weight = [vw, hw].filter(Boolean).join('-') + '-weighted';

    // --- tebakan jenis ---
    const ar = w / h;
    const sigColors = palette.filter((c) => c.pct > 3).length;
    let typeGuess = 'photo';
    if (ar >= 2.4 || ar <= 0.42) typeGuess = 'banner';
    else if ((transparent || bgInfo.uniform) && sigColors <= 5 && edgeDensity < 0.14) typeGuess = 'logo';
    else if (satLabel === 'saturated' && edgeDensity < 0.12 && palette.slice(0, 4).reduce((s, c) => s + c.pct, 0) > 88) typeGuess = 'illustration'; // area warna datar

    return {
      width: w, height: h, aspect: nearestAspect(w, h),
      orientation: ar > 1.08 ? 'landscape' : ar < 0.92 ? 'portrait' : 'square',
      palette, bg: bgInfo, transparent,
      meanLuma: meanL, contrast: stdL, saturation: meanS,
      brightnessLabel, contrastLabel, satLabel, temperature,
      edgeDensity, complexityLabel, lightDir, vignette, symmetry,
      weight, harmony, typeGuess,
    };
  }

  /** Metrik gerak antar-frame (array Float32Array luma ukuran sama). */
  function motionMetrics(lumaFrames) {
    const diffs = [];
    for (let i = 1; i < lumaFrames.length; i++) {
      const a = lumaFrames[i - 1], b = lumaFrames[i];
      let s = 0;
      for (let k = 0; k < a.length; k++) s += Math.abs(a[k] - b[k]);
      diffs.push(s / a.length);
    }
    const avg = diffs.length ? diffs.reduce((x, y) => x + y, 0) / diffs.length : 0;
    const cuts = diffs.filter((d) => d > 55).length;
    return {
      diffs, avg, cuts,
      label: avg < 6 ? 'static / very slow' : avg < 16 ? 'gentle motion' : avg < 34 ? 'dynamic' : 'very fast / many cuts',
    };
  }

  /* ==================================================================
   *  2. KAMUS FRASA (EN / ID) & PENYUSUN PROMPT LOKAL (murni)
   * ================================================================== */

  const LBL = {
    en: {
      subjectPh: '[main subject — describe what is in the image]',
      lowkey: 'low-key, moody lighting with deep shadows', highkey: 'high-key, bright and airy lighting', balancedL: 'balanced exposure',
      contrast: { soft: 'soft, gentle contrast', medium: 'medium contrast', high: 'strong, punchy contrast' },
      sat: { desaturated: 'desaturated, subdued colors', natural: 'natural color saturation', saturated: 'rich, vivid, saturated colors' },
      temp: { warm: 'warm color temperature', cool: 'cool color temperature', neutral: 'neutral color temperature' },
      cx: { minimal: 'minimalist and uncluttered', moderate: 'moderately detailed', dense: 'highly detailed and intricate' },
      light: (d) => (d.startsWith('from') ? `key light coming ${d}, with soft falloff` : 'even, frontal lighting with minimal shadows'),
      vignette: 'subtle vignette drawing the eye to the center',
      sym: { 'near-symmetrical': 'near-symmetrical composition', 'loosely balanced': 'loosely balanced composition', asymmetrical: 'asymmetrical, dynamic composition' },
      weight: (w) => (w === 'centered' ? 'subject centered in frame' : `visual weight ${w.replace('-weighted', '')} of frame`),
      harmony: (h) => `${h} color harmony`,
      orient: { landscape: 'horizontal landscape framing', portrait: 'vertical portrait framing', square: 'square framing' },
      H: { SUBJECT: 'SUBJECT', STYLE: 'STYLE', COMP: 'COMPOSITION', LIGHT: 'LIGHTING', COLOR: 'COLOR PALETTE', CAM: 'CAMERA / RENDER', BG: 'BACKGROUND', MOOD: 'MOOD', QUAL: 'QUALITY', EXTRA: 'NOTES', LAYERS: 'DEPTH LAYERS', GRADE: 'COLOR GRADING', CONSTR: 'CONSTRAINTS', TEXT: 'TYPOGRAPHY', FORMAT: 'FORMAT' },
    },
    id: {
      subjectPh: '[subjek utama — deskripsikan isi gambar]',
      lowkey: 'pencahayaan low-key yang dramatis dengan bayangan pekat', highkey: 'pencahayaan high-key yang terang dan lega', balancedL: 'eksposur seimbang',
      contrast: { soft: 'kontras lembut', medium: 'kontras sedang', high: 'kontras kuat dan tegas' },
      sat: { desaturated: 'warna pudar dan kalem', natural: 'saturasi warna natural', saturated: 'warna kaya, hidup, dan jenuh' },
      temp: { warm: 'suhu warna hangat', cool: 'suhu warna dingin', neutral: 'suhu warna netral' },
      cx: { minimal: 'minimalis dan lapang', moderate: 'detail sedang', dense: 'sangat detail dan rumit' },
      light: (d) => (d.startsWith('from') ? `cahaya utama datang ${d.replace('from the', 'dari').replace('left', 'kiri').replace('right', 'kanan').replace('top', 'atas').replace('bottom', 'bawah')}, dengan peluruhan lembut` : 'pencahayaan merata dari depan dengan bayangan minim'),
      vignette: 'vignette halus yang mengarahkan mata ke tengah',
      sym: { 'near-symmetrical': 'komposisi hampir simetris', 'loosely balanced': 'komposisi cukup seimbang', asymmetrical: 'komposisi asimetris yang dinamis' },
      weight: (w) => (w === 'centered' ? 'subjek di tengah bingkai' : `bobot visual condong ke ${w.replace('-weighted', '').replace('top', 'atas').replace('bottom', 'bawah').replace('left', 'kiri').replace('right', 'kanan')}`),
      harmony: (h) => `harmoni warna ${h}`,
      orient: { landscape: 'bingkai horizontal (landscape)', portrait: 'bingkai vertikal (portrait)', square: 'bingkai persegi' },
      H: { SUBJECT: 'SUBJEK', STYLE: 'GAYA', COMP: 'KOMPOSISI', LIGHT: 'PENCAHAYAAN', COLOR: 'PALET WARNA', CAM: 'KAMERA / RENDER', BG: 'LATAR', MOOD: 'SUASANA', QUAL: 'KUALITAS', EXTRA: 'CATATAN', LAYERS: 'LAPISAN KEDALAMAN', GRADE: 'COLOR GRADING', CONSTR: 'BATASAN', TEXT: 'TIPOGRAFI', FORMAT: 'FORMAT' },
    },
  };

  const NEGATIVE_BASE = [
    'blurry', 'low resolution', 'jpeg artifacts', 'pixelated', 'watermark', 'signature', 'text errors', 'misspelled text',
    'distorted proportions', 'extra fingers', 'deformed hands', 'duplicated elements', 'cropped subject', 'oversaturated', 'muddy colors', 'noise',
  ];
  const NEGATIVE_BY_TYPE = {
    logo: ['photo background', 'realistic shadows', '3d render', 'gradient clutter', 'busy background', 'thin unreadable lines', 'mockup scene'],
    banner: ['cluttered layout', 'text overlapping subject', 'unreadable headline', 'random lorem ipsum', 'stretched image', 'low contrast text'],
    photo: ['cartoon', 'illustration look', 'plastic skin', 'uncanny face', 'over-sharpened', 'fake bokeh'],
    illustration: ['photorealistic', 'muddy lineart', 'inconsistent style', 'flat lighting errors'],
    ui: ['skewed layout', 'misaligned elements', 'unreadable small text', 'inconsistent spacing'],
    video: ['flicker', 'jitter', 'morphing faces', 'warped geometry', 'temporal inconsistency', 'sudden unmotivated cuts'],
  };

  const pct = (n) => (n >= 10 ? Math.round(n) : n.toFixed(1)) + '%';

  function typeClauses(type, A, L, detail) {
    const c = { style: [], camera: [], extra: [], bg: [] };
    const hiDetail = detail !== 'standard';
    if (type === 'logo') {
      c.style.push('professional vector logo design', 'flat graphic style', 'clean geometric shapes', 'balanced negative space', 'scalable and legible at small sizes');
      c.camera.push('flat 2D vector rendering', 'crisp edges', 'no perspective');
      if (hiDetail) c.extra.push('precise symmetrical alignment', 'consistent stroke weight', 'limited color palette', 'works on light and dark backgrounds');
      c.bg.push(A.transparent ? 'isolated on transparent background' : A.bg.uniform ? `isolated on a solid ${A.bg.name} (${A.bg.hex}) background` : 'isolated on a clean background');
    } else if (type === 'banner') {
      c.style.push('professional promotional banner design', 'clear visual hierarchy', 'modern graphic layout');
      c.camera.push('flat graphic composition', 'sharp vector-quality edges');
      if (hiDetail) c.extra.push('reserved safe margins for headline text', 'clear call-to-action zone', 'balanced grid alignment', 'focal point separated from text area');
      c.bg.push(A.bg.uniform ? `${A.bg.name} (${A.bg.hex}) base background` : 'designed gradient / layered background');
    } else if (type === 'illustration') {
      c.style.push('digital illustration', 'stylized artwork', 'cohesive art direction');
      c.camera.push('clean rendering', 'smooth shading');
      if (hiDetail) c.extra.push('confident linework', 'consistent shading logic', 'intentional shape language');
      c.bg.push(A.bg.uniform ? `${A.bg.name} background` : 'richly designed background');
    } else if (type === 'ui') {
      c.style.push('modern user interface design', 'clean component layout', 'consistent design system');
      c.camera.push('flat screen capture look', 'pixel-perfect alignment');
      if (hiDetail) c.extra.push('clear typographic hierarchy', 'generous spacing', 'rounded components', 'accessible contrast');
      c.bg.push(A.bg.uniform ? `${A.bg.name} app background` : 'layered app background');
    } else {
      c.style.push('photorealistic photograph', 'natural textures', 'authentic detail');
      if (A.complexityLabel === 'minimal') c.camera.push('shot on 85mm lens', 'f/1.8', 'shallow depth of field', 'creamy bokeh');
      else if (A.complexityLabel === 'dense') c.camera.push('shot on 35mm lens', 'f/8', 'deep focus', 'sharp across the frame');
      else c.camera.push('shot on 50mm lens', 'f/2.8', 'moderate depth of field');
      if (hiDetail) c.extra.push('fine surface texture', 'realistic materials', 'natural skin and fabric detail where present');
      c.bg.push(A.bg.uniform ? `${A.bg.name} backdrop` : 'contextual environment with natural depth');
    }
    return c;
  }

  function extrasClauses(extras, type) {
    const o = [];
    if (extras.includes('exact')) o.push('replicate the composition, proportions, and layout as faithfully as possible');
    if (extras.includes('text')) o.push('any text must be rendered exactly, with matching font style, weight, and alignment');
    if (extras.includes('cine')) o.push('cinematic color grading', 'anamorphic feel', 'film grain', 'dramatic framing');
    if (extras.includes('minimal')) o.push('minimalist treatment', 'generous whitespace', 'restrained detail');
    if (extras.includes('print')) o.push('print-ready, high resolution, CMYK-safe colors, 300 DPI quality');
    if (extras.includes('social')) o.push('optimized for social media feeds', 'high thumbnail legibility', 'bold focal point');
    return o;
  }

  function guessMood(A) {
    if (A.brightnessLabel === 'low-key') return A.temperature === 'warm' ? 'intimate, dramatic, cozy' : 'mysterious, moody, cinematic';
    if (A.brightnessLabel === 'high-key') return A.temperature === 'cool' ? 'clean, fresh, serene' : 'cheerful, optimistic, welcoming';
    return A.temperature === 'warm' ? 'warm, inviting, nostalgic' : A.temperature === 'cool' ? 'calm, composed, modern' : 'balanced, neutral, professional';
  }

  function paletteText(A, detail) {
    const n = detail === 'standard' ? 3 : detail === 'super' ? 5 : 8;
    const pal = A.palette.slice(0, n);
    if (detail === 'standard') return pal.map((c) => c.name).join(', ');
    return pal.map((c) => `${c.name} ${c.hex} (~${pct(c.pct)})`).join(', ');
  }

  /**
   * Susun prompt lokal.
   * opts: { type, target, detail, lang, subject, notes, extras[], video?:{duration,frames:[{t,A}],motion} }
   */
  function composeLocal(A, opts) {
    const lang = opts.lang === 'id' ? 'id' : 'en';
    const L = LBL[lang];
    const detail = opts.detail || 'super';
    const type = opts.type === 'auto' ? A.typeGuess : opts.type;
    const target = opts.target || 'universal';
    const subject = (opts.subject || '').trim() || L.subjectPh;
    const ar = A.aspect.label;
    const tc = typeClauses(type === 'video' ? 'photo' : type, A, L, detail);
    const ex = extrasClauses(opts.extras || [], type);
    const mood = guessMood(A);
    const lightL = A.brightnessLabel === 'low-key' ? L.lowkey : A.brightnessLabel === 'high-key' ? L.highkey : L.balancedL;

    const parts = {
      subject: [subject],
      style: tc.style.concat([L.cx[A.complexityLabel]]),
      comp: [L.orient[A.orientation], L.weight(A.weight), L.sym[A.symmetry], `aspect ratio ${ar}`],
      light: [lightL, L.light(A.lightDir), L.contrast[A.contrastLabel]],
      color: [paletteText(A, detail), L.harmony(A.harmony), L.temp[A.temperature], L.sat[A.satLabel]],
      camera: tc.camera,
      bg: tc.bg,
      mood: [mood],
      qual: ['ultra high quality', 'sharp focus', 'highly detailed', 'professional finish'],
      extra: tc.extra.concat(ex),
    };
    if (A.vignette && type !== 'logo' && type !== 'banner') parts.light.push(L.vignette);
    if (detail === 'standard') { parts.camera = parts.camera.slice(0, 2); parts.extra = ex; parts.qual = ['high quality', 'detailed']; }

    // lapisan kedalaman & color grading (ultra)
    const ultra = {};
    if (detail === 'ultra') {
      ultra.layers = [
        `foreground: ${subject === L.subjectPh ? 'primary focal element with crisp detail' : 'the main subject rendered with the crispest detail'}`,
        `midground: supporting elements arranged to lead the eye ${A.weight === 'centered' ? 'toward the center' : 'across the frame'}`,
        `background: ${tc.bg[0]}, ${A.complexityLabel === 'dense' ? 'rich in secondary detail' : 'kept calm so the subject reads clearly'}`,
      ];
      const top = A.palette.slice(0, 3);
      ultra.grade = `${A.brightnessLabel} tonality, ${A.contrastLabel} contrast, ${A.satLabel} saturation; shadows lean ${A.temperature === 'warm' ? 'warm' : A.temperature === 'cool' ? 'cool' : 'neutral'}; dominant tones ${top.map((c) => c.hex).join(' / ')}`;
      ultra.constraints = [
        'keep the same overall composition and color relationships',
        'no additional logos, watermarks or unrelated text',
        'maintain consistent perspective and scale',
        A.transparent ? 'preserve transparency / clean alpha edges' : 'edge-to-edge full-frame result',
      ];
      parts.extra = parts.extra.concat(['post-processing: subtle sharpening, tonal curve, controlled highlights']);
    }

    const negParts = NEGATIVE_BASE.concat(NEGATIVE_BY_TYPE[type] || NEGATIVE_BY_TYPE.photo);
    const negative = (detail === 'standard' ? negParts.slice(0, 8) : negParts).join(', ');

    const structured = {
      media_type: type, detected_by: 'local pixel analysis (no object recognition)',
      subject: subject, style: parts.style, composition: parts.comp, lighting: parts.light,
      color_palette: A.palette.slice(0, detail === 'standard' ? 3 : 8).map((c) => ({ hex: c.hex, name: c.name, share_percent: +c.pct.toFixed(1) })),
      background: A.bg, camera_render: parts.camera, mood, quality: parts.qual, extras: parts.extra,
      aspect_ratio: ar, pixel_size: `${A.width}x${A.height}`, transparent_background: A.transparent,
    };
    if (detail === 'ultra') structured.depth_layers = ultra.layers, structured.color_grading = ultra.grade, structured.constraints = ultra.constraints;

    let main = '', params = '';
    const J = (a) => a.filter(Boolean).join(', ');
    const sections = [
      [L.H.SUBJECT, J(parts.subject)], [L.H.STYLE, J(parts.style)], [L.H.COMP, J(parts.comp)],
      [L.H.LIGHT, J(parts.light)], [L.H.COLOR, J(parts.color)], [L.H.CAM, J(parts.camera)],
      [L.H.BG, J(parts.bg)], [L.H.MOOD, J(parts.mood)],
    ];
    if (detail === 'ultra') {
      sections.push([L.H.LAYERS, ultra.layers.join('; ')], [L.H.GRADE, ultra.grade]);
    }
    if (parts.extra.length) sections.push([L.H.EXTRA, J(parts.extra)]);
    sections.push([L.H.QUAL, J(parts.qual)]);
    if (detail === 'ultra') sections.push([L.H.CONSTR, ultra.constraints.join('; ')]);

    const flat = J([].concat(parts.subject, parts.style, parts.comp, parts.light, parts.color, parts.camera, parts.bg, parts.mood, parts.extra, parts.qual));

    if (type === 'video' || target === 'video') {
      main = composeVideoLocal(A, opts, L, parts, detail);
      params = `aspect ratio ${ar}` + (opts.video ? ` · ~${Math.round(opts.video.duration)}s source` : '');
    } else if (target === 'midjourney') {
      main = (flat + ` --ar ${ar} --style raw --stylize ${detail === 'ultra' ? 350 : 200}`).replace(/aspect ratio [\d:]+, /, '');
      params = `--ar ${ar} --style raw --stylize ${detail === 'ultra' ? 350 : 200} · tambahkan --v sesuai versi Midjourney yang kamu pakai`;
    } else if (target === 'sd') {
      const w = (s) => s;
      main = `masterpiece, best quality, (${w(subject)}:1.25), ${flat.replace(subject + ', ', '')}`;
      params = `Steps 30 · CFG 6.5 · Sampler DPM++ 2M Karras · Ukuran ${Math.round(A.width / 64) * 64 || 1024}×${Math.round(A.height / 64) * 64 || 1024} (kelipatan 64)`;
    } else if (target === 'flux') {
      main = flat;
      params = 'Flux: guidance ≈ 3.5 · steps 28 · tanpa negative prompt (gunakan deskripsi positif)';
    } else if (target === 'dalle') {
      const sent = [
        `Create ${/^[aeiou]/i.test(type) ? 'an' : 'a'} ${type} image of ${subject}.`,
        `Style: ${J(parts.style)}.`,
        `Composition: ${J(parts.comp)}.`,
        `Lighting: ${J(parts.light)}.`,
        `Colors: ${J(parts.color)}.`,
        `Background: ${J(parts.bg)}. Mood: ${parts.mood[0]}.`,
      ];
      if (parts.extra.length) sent.push(`Details: ${J(parts.extra)}.`);
      if (detail === 'ultra') sent.push(`Color grading: ${ultra.grade}. Constraints: ${ultra.constraints.join('; ')}.`);
      main = sent.join('\n');
      params = `Rasio ${ar} · minta ukuran ${A.orientation === 'landscape' ? '1536×1024' : A.orientation === 'portrait' ? '1024×1536' : '1024×1024'} bila tersedia`;
    } else {
      main = sections.filter((s) => s[1]).map(([k, v]) => `${k}: ${v}`).join('\n');
      params = `${L.H.FORMAT}: ${ar} · ${A.width}×${A.height}px`;
    }

    const showNeg = target !== 'flux';
    const variations = [
      { label: lang === 'id' ? 'Lebih sinematik' : 'More cinematic', prompt: main + (lang === 'id' ? '\n+ color grading sinematik, rasio anamorfik, grain film halus, framing dramatis' : '\n+ cinematic color grading, anamorphic look, subtle film grain, dramatic framing') },
      { label: lang === 'id' ? 'Minimalis & bersih' : 'Minimal & clean', prompt: main + (lang === 'id' ? '\n+ pendekatan minimalis, ruang kosong lapang, detail dikurangi, palet dibatasi 3 warna' : '\n+ minimalist approach, generous whitespace, reduced detail, palette limited to 3 colors') },
      { label: lang === 'id' ? 'Warna dibalik (komplementer)' : 'Complementary color flip', prompt: main + (lang === 'id' ? '\n+ ganti palet dominan ke warna komplementernya, pertahankan komposisi' : '\n+ swap the dominant palette for its complementary hues while keeping the composition') },
    ];

    return {
      mode: 'local', mediaType: type, summary: lang === 'id'
        ? 'Analisis lokal hanya membaca sifat visual (warna, cahaya, komposisi, rasio). Isi/subjek gambar tidak dikenali — isi kolom subjek atau gunakan mode AI Vision.'
        : 'Local analysis reads visual properties only (color, light, composition, ratio). It cannot recognize what is in the image — fill in the subject field or use AI Vision mode.',
      main, negative: showNeg ? negative : '', params, structured, variations,
    };
  }

  function composeVideoLocal(A, opts, L, parts, detail) {
    const v = opts.video;
    const lines = [];
    const dur = v ? Math.round(v.duration) : null;
    const m = v && v.motion;
    lines.push(`${L.H.SUBJECT}: ${parts.subject[0]}`);
    lines.push(`${L.H.FORMAT}: ${A.aspect.label}, ${A.width}×${A.height}${dur ? `, ~${dur}s` : ''}`);
    lines.push(`${L.H.STYLE}: ${parts.style.concat(parts.camera).join(', ')}`);
    if (m) {
      const camera = m.label.startsWith('static') ? 'locked-off tripod shot or very slow push-in'
        : m.label.startsWith('gentle') ? 'smooth slow dolly / gentle handheld drift'
          : m.label.startsWith('dynamic') ? 'tracking shot with purposeful camera movement and energetic pacing'
            : 'fast whip pans, rapid cuts, high-energy editing';
      lines.push(`CAMERA MOVEMENT: ${camera} (measured motion: ${m.label}; ~${m.cuts} hard cut${m.cuts === 1 ? '' : 's'} detected between sampled frames)`);
    }
    lines.push(`${L.H.LIGHT}: ${parts.light.join(', ')}`);
    lines.push(`${L.H.COLOR}: ${parts.color.join(', ')}`);
    if (v && v.frames && v.frames.length) {
      lines.push('TIMELINE (from sampled frames — describe the action yourself or use AI Vision):');
      v.frames.forEach((f, i) => {
        const top = f.A.palette.slice(0, 3).map((c) => c.name).join(' / ');
        lines.push(`  ${f.t.toFixed(1)}s — shot ${i + 1}: ${f.A.brightnessLabel} exposure, ${f.A.temperature} tone, dominant ${top}, ${f.A.weight} framing; [action/subject at this moment]`);
      });
    }
    lines.push(`${L.H.MOOD}: ${parts.mood[0]}`);
    if (detail !== 'standard') lines.push('MOTION QUALITY: consistent subject identity, stable geometry, natural physics, no flicker, smooth temporal coherence');
    if (detail === 'ultra') lines.push('AUDIO (suggested): ambient sound design matching the mood, subtle score, synchronized hits on cuts');
    lines.push(`${L.H.QUAL}: ${parts.qual.join(', ')}`);
    return lines.join('\n');
  }

  /* ==================================================================
   *  3. PROMPT UNTUK AI VISION (murni)
   * ================================================================== */

  const DETAIL_SPEC = {
    standard: 'about 90–140 words in the main prompt',
    super: 'about 280–420 words in the main prompt, covering every section below with concrete, specific wording',
    ultra: 'about 600–900 words in the main prompt: multi-layered, with separate foreground/midground/background descriptions, exact hex colors with approximate percentage of area, precise light direction and shadow behavior, material and texture inventory, lens/camera or render specs, edge/linework details, and explicit reproduction constraints',
  };
  const TARGET_SPEC = {
    universal: 'a universal, section-labeled prompt (SUBJECT, STYLE, COMPOSITION, LIGHTING, COLOR PALETTE, CAMERA/RENDER, BACKGROUND, MOOD, DETAILS, QUALITY) that any image model or LLM can follow',
    midjourney: 'a Midjourney prompt: one dense comma-separated descriptive line (no section labels), ending with parameters like --ar <ratio> --style raw --stylize <n>; do not guess a --v version unless told',
    sd: 'a Stable Diffusion/SDXL prompt: comma-separated tags with emphasis weights like (term:1.2) on the key elements, starting with quality tags; provide a rich separate negative_prompt; suggest steps, CFG, sampler, and a size in multiples of 64 inside "parameters"',
    flux: 'a Flux prompt: fluent, descriptive natural-language prose in flowing sentences, front-loading the subject; no negative prompt needed (leave negative_prompt as an empty string); suggest guidance/steps in "parameters"',
    dalle: 'a prompt for ChatGPT image / DALL·E / Gemini image: clear natural-language paragraphs, explicit about exact on-image text, layout, and style; put text to render in quotes',
    video: 'a video-generation prompt (Veo / Sora / Runway / Kling): shot-by-shot timeline with timestamps, camera movement and lens, subject action, lighting, color grade, pacing, transitions, and suggested audio; keep subject identity and physics consistent',
  };
  const TYPE_SPEC = {
    auto: 'Decide the media type yourself (photo, logo, banner/poster, illustration, UI screenshot, or video) and set media_type accordingly.',
    photo: 'This is a photograph: describe subject, pose/action, wardrobe, setting, lens, aperture, depth of field, lighting setup, time of day, textures, and post-processing.',
    logo: 'This is a logo: describe the mark/symbol geometry, shape language, negative space, stroke weights, typography (typeface style, weight, spacing, case), exact transcription of any text, color values, and background; specify vector/flat constraints and layout lockup.',
    banner: 'This is a banner/poster: describe layout grid, visual hierarchy, headline/subhead/CTA text transcribed exactly with font style and placement, focal imagery, color blocking, margins, and decorative elements.',
    illustration: 'This is an illustration: describe art style, linework, shading technique, shape language, character/object design, color script, and background.',
    ui: 'This is a UI/app screenshot: describe layout, components, spacing system, typography, colors, icons, states, and transcribe visible text.',
    video: 'This is a video (given as sequential frames with timestamps): reconstruct the timeline, camera movement, subject actions, transitions, pacing, lighting, color grade, and suggested audio.',
  };
  const EXTRA_SPEC = {
    exact: 'Prioritize faithful reproduction: preserve composition, proportions, and layout as exactly as possible.',
    text: 'Transcribe all visible text exactly, with font style, weight, size hierarchy, and placement.',
    cine: 'Lean cinematic: add film-style color grading, lens character, and dramatic framing.',
    minimal: 'Lean minimalist: restrained detail, generous whitespace.',
    print: 'Make it print-ready: high resolution, CMYK-safe colors, bleed/safe margins where relevant.',
    social: 'Optimize for social feeds: strong thumbnail legibility and a bold focal point.',
  };

  function buildAISystem(opts) {
    return [
      'You are a world-class reverse-prompt engineer for AI image and video generators.',
      'You look at the provided image(s) and write prompts that would let a generative model recreate the work as faithfully as possible — or reinterpret it, if the user asks.',
      '',
      'RULES',
      '- Describe only what is actually visible. Never invent brands, names, or text that is not there. If something is unreadable, say so briefly.',
      '- Do not identify real people by name. Describe them by visible traits (age range, build, hair, clothing, expression, pose).',
      '- Be concrete and specific: prefer exact materials, colors (with hex values), shapes, positions, and quantities over vague adjectives.',
      '- Use the LOCAL MEASUREMENTS in the user message as ground truth for palette hex values, aspect ratio, and lighting direction when they agree with what you see.',
      '- Write the prompts in the requested output language, but keep standard technical tokens (e.g. --ar, f/1.8, hex codes) as-is.',
      '- Length target: ' + DETAIL_SPEC[opts.detail || 'super'] + '.',
      '- Target format: ' + TARGET_SPEC[opts.target || 'universal'] + '.',
      '',
      'OUTPUT FORMAT',
      'Reply with ONE valid JSON object and nothing else (no markdown fences, no commentary). Schema:',
      '{',
      '  "media_type": "photo|logo|banner|illustration|ui|video",',
      '  "summary": "1–2 sentence plain description of what the media shows",',
      '  "main_prompt": "the full, ready-to-paste prompt in the target format",',
      '  "negative_prompt": "what to avoid (empty string if the target does not use one)",',
      '  "parameters": "recommended generator settings / aspect ratio, short",',
      '  "structured": { "subject": "...", "style": "...", "composition": "...", "lighting": "...", "color_palette": [{"hex":"#rrggbb","name":"...","share_percent":0}], "camera_or_render": "...", "background": "...", "mood": "...", "text_in_image": ["exact text transcriptions or empty"], "materials_textures": "...", "notable_details": ["..."] },',
      '  "variations": [ {"label":"short name","prompt":"alternate full prompt"}, {"label":"...","prompt":"..."}, {"label":"...","prompt":"..."} ]',
      '}',
      'Variations must meaningfully differ (e.g. different style, mood, or medium) while keeping the core subject. All strings must be valid JSON (escape quotes and newlines).',
    ].join('\n');
  }

  function buildAIUser(A, opts) {
    const lines = [];
    lines.push(`Media type requested: ${opts.type === 'auto' ? 'auto-detect' : opts.type}.`);
    lines.push(TYPE_SPEC[opts.type] || TYPE_SPEC.auto);
    lines.push(`Target generator: ${opts.target}. Detail level: ${opts.detail}. Output language: ${opts.lang === 'id' ? 'Bahasa Indonesia' : 'English'}.`);
    (opts.extras || []).forEach((e) => EXTRA_SPEC[e] && lines.push(EXTRA_SPEC[e]));
    if (opts.subject) lines.push(`User-provided subject hint: ${opts.subject}`);
    if (opts.notes) lines.push(`User notes / requested changes: ${opts.notes}`);
    lines.push('');
    lines.push('LOCAL MEASUREMENTS (computed from pixels in the browser):');
    lines.push(`- Size: ${A.width}×${A.height}px, aspect ≈ ${A.aspect.label}, ${A.orientation}`);
    lines.push('- Palette: ' + A.palette.slice(0, 8).map((c) => `${c.hex} ${c.name} ${pct(c.pct)}`).join('; '));
    lines.push(`- Background: ${A.bg.uniform ? 'uniform ' + A.bg.name + ' ' + A.bg.hex : 'non-uniform'}${A.transparent ? '; has transparency' : ''}`);
    lines.push(`- Tonality: ${A.brightnessLabel}, contrast ${A.contrastLabel}, saturation ${A.satLabel}, ${A.temperature} temperature, color harmony ${A.harmony}`);
    lines.push(`- Light direction: ${A.lightDir}; composition weight: ${A.weight}; symmetry: ${A.symmetry}; detail density: ${A.complexityLabel}`);
    if (opts.video) {
      const v = opts.video;
      lines.push('');
      lines.push(`VIDEO: duration ≈ ${v.duration.toFixed(1)}s, ${v.frames.length} frames sampled evenly at timestamps: ${v.frames.map((f) => f.t.toFixed(1) + 's').join(', ')}.`);
      lines.push(`Measured motion between frames: ${v.motion.label} (avg luma change ${v.motion.avg.toFixed(1)}), ~${v.motion.cuts} hard cuts.`);
      lines.push('Images are in chronological order.');
    }
    lines.push('');
    lines.push('Now produce the JSON object.');
    return lines.join('\n');
  }

  function parseAIJson(text) {
    let t = String(text || '').trim();
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a !== -1 && b > a) {
      try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* jatuh ke fallback */ }
    }
    return null;
  }

  function normalizeAIResult(text, A) {
    const j = parseAIJson(text);
    if (!j || typeof j !== 'object' || !j.main_prompt) {
      return { mode: 'ai', mediaType: 'auto', summary: '', main: String(text || '').trim(), negative: '', params: '', structured: { raw_response: String(text || '') }, variations: [], parsed: false };
    }
    const str = (v) => (typeof v === 'string' ? v : v == null ? '' : typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v));
    return {
      mode: 'ai', mediaType: str(j.media_type) || 'auto', summary: str(j.summary),
      main: str(j.main_prompt).trim(), negative: str(j.negative_prompt).trim(), params: str(j.parameters).trim(),
      structured: j.structured && typeof j.structured === 'object' ? j.structured : {},
      variations: Array.isArray(j.variations) ? j.variations.filter((v) => v && v.prompt).slice(0, 5).map((v) => ({ label: str(v.label) || 'Variasi', prompt: str(v.prompt) })) : [],
      parsed: true,
    };
  }

  const AZR = { analyzePixels, motionMetrics, composeLocal, buildAISystem, buildAIUser, parseAIJson, normalizeAIResult, nameColor, nearestAspect };
  if (typeof module !== 'undefined' && module.exports) module.exports = AZR;
  root.AZR = AZR;

  /* ==================================================================
   *  4. ANTARMUKA (hanya di browser)
   * ================================================================== */
  if (typeof document === 'undefined') return;

  const $ = (id) => document.getElementById(id);
  const S = {
    file: null, kind: null, objectUrl: null, img: null, video: null,
    analysis: null, frames: [], videoInfo: null, result: null, detail: 'super', busy: false, tab: 'main',
  };

  const DEFAULT_MODELS = { anthropic: 'claude-sonnet-5-5', gemini: 'gemini-2.5-flash', openai: 'gpt-4o-mini' };
  const MODEL_HINTS = {
    anthropic: 'Contoh: claude-sonnet-5-5, claude-opus-5-5',
    gemini: 'Contoh: gemini-2.5-flash (ganti jika sudah ada versi lebih baru)',
    openai: 'Contoh: gpt-4o-mini (atau model vision lain yang kompatibel)',
  };
  const DETAIL_HINT = {
    standard: 'Ringkas: ± 100 kata. Cepat untuk eksperimen.',
    super: 'Lengkap: ± 300–400 kata dengan semua aspek visual.',
    ultra: 'Kompleks: ± 600–900 kata, berlapis, hex warna, batasan reproduksi.',
  };

  let settings = loadSettings();

  function loadSettings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem('azr.settings') || '{}'); } catch (e) { s = {}; }
    const out = {
      provider: s.provider || 'anthropic',
      models: Object.assign({}, DEFAULT_MODELS, s.models || {}),
      keys: s.remember ? s.keys || {} : {},
      baseUrl: s.baseUrl || '',
      remember: !!s.remember,
    };
    if (!out.remember) {
      try { out.keys = JSON.parse(sessionStorage.getItem('azr.keys') || '{}'); } catch (e) { out.keys = {}; }
    }
    return out;
  }
  function saveSettings() {
    try {
      const base = { provider: settings.provider, models: settings.models, baseUrl: settings.baseUrl, remember: settings.remember };
      if (settings.remember) base.keys = settings.keys;
      localStorage.setItem('azr.settings', JSON.stringify(base));
      if (settings.remember) sessionStorage.removeItem('azr.keys');
      else sessionStorage.setItem('azr.keys', JSON.stringify(settings.keys));
    } catch (e) { /* penyimpanan mungkin diblokir */ }
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function setStatus(msg, cls, spin) {
    const s = $('status');
    s.className = 'status' + (cls ? ' ' + cls : '');
    s.textContent = '';
    if (spin) { const i = document.createElement('span'); i.className = 'spin'; s.appendChild(i); }
    s.appendChild(document.createTextNode(msg || ''));
  }
  function el(tag, props, children) {
    const n = document.createElement(tag);
    if (props) Object.keys(props).forEach((k) => { if (k === 'class') n.className = props[k]; else if (k === 'text') n.textContent = props[k]; else n.setAttribute(k, props[k]); });
    (children || []).forEach((c) => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return n;
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = el('textarea', { style: 'position:fixed;opacity:0' }); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e2) { /* abaikan */ }
      ta.remove();
    }
    toast('Disalin ✓');
  }
  function download(name, text, mime) {
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: mime })), download: name });
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- pemuatan media ---------- */

  const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB');
  const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function resetMedia() {
    if (S.objectUrl) URL.revokeObjectURL(S.objectUrl);
    Object.assign(S, { file: null, kind: null, objectUrl: null, img: null, video: null, analysis: null, frames: [], videoInfo: null });
    $('preview').hidden = true; $('preview').textContent = '';
    $('dropInner').hidden = false; $('filmstrip').hidden = true; $('filmstrip').textContent = '';
    $('fileMeta').hidden = true; $('fileMeta').textContent = '';
  }

  async function handleFile(file) {
    if (!file) return;
    const isImg = file.type.startsWith('image/');
    const isVid = file.type.startsWith('video/');
    if (!isImg && !isVid) { setStatus('Format tidak didukung. Pilih gambar atau video.', 'err'); return; }
    if (file.size > 600 * 1024 * 1024) { setStatus('File terlalu besar (maks 600 MB).', 'err'); return; }
    resetMedia(); setStatus('Membaca media…', '', true);
    S.file = file; S.kind = isVid ? 'video' : 'image'; S.objectUrl = URL.createObjectURL(file);
    $('btnGo').disabled = true;
    try {
      if (isImg) await loadImage(); else await loadVideo();
      $('framesField').hidden = S.kind !== 'video';
      if (S.kind === 'video') { $('mediaType').value = 'video'; $('target').value = 'video'; }
      else {
        if ($('mediaType').value === 'video') $('mediaType').value = 'auto';
        if ($('target').value === 'video') $('target').value = 'universal';
      }
      $('btnGo').disabled = false;
      setStatus('Media siap. Atur opsi lalu tekan “Buat prompt”.', 'ok');
    } catch (e) {
      resetMedia(); setStatus('Gagal membaca media: ' + (e && e.message ? e.message : e), 'err');
    }
  }

  function loadImage() {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        S.img = img;
        $('dropInner').hidden = true;
        const pv = $('preview'); pv.hidden = false; pv.textContent = ''; pv.appendChild(img);
        S.analysis = analyzeSource(img, img.naturalWidth, img.naturalHeight);
        showMeta([
          S.file.name.length > 28 ? S.file.name.slice(0, 25) + '…' : S.file.name,
          `${img.naturalWidth}×${img.naturalHeight}`, S.analysis.aspect.label, fmtSize(S.file.size),
          'terdeteksi: ' + S.analysis.typeGuess,
        ]);
        resolve();
      };
      img.onerror = () => reject(new Error('gambar rusak atau format tidak bisa dibuka browser'));
      img.src = S.objectUrl;
    });
  }

  function waitEvent(target, ok, bad, ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { cleanup(); reject(new Error('waktu habis memuat video')); }, ms);
      const on = () => { cleanup(); resolve(); };
      const off = () => { cleanup(); reject(new Error('video tidak bisa dibuka (codec tidak didukung browser?)')); };
      function cleanup() { clearTimeout(t); target.removeEventListener(ok, on); if (bad) target.removeEventListener(bad, off); }
      target.addEventListener(ok, on, { once: true });
      if (bad) target.addEventListener(bad, off, { once: true });
    });
  }

  async function loadVideo() {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.controls = true; v.src = S.objectUrl;
    await waitEvent(v, 'loadedmetadata', 'error', 15000);
    if (!isFinite(v.duration) || v.duration <= 0) throw new Error('durasi video tidak terbaca');
    S.video = v;
    $('dropInner').hidden = true;
    const pv = $('preview'); pv.hidden = false; pv.textContent = ''; pv.appendChild(v);
    S.videoInfo = { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
    showMeta([
      S.file.name.length > 28 ? S.file.name.slice(0, 25) + '…' : S.file.name,
      `${v.videoWidth}×${v.videoHeight}`, fmtDur(v.duration), fmtSize(S.file.size),
    ]);
  }

  function showMeta(items) {
    const m = $('fileMeta'); m.hidden = false; m.textContent = '';
    items.forEach((t) => m.appendChild(el('span', { text: t })));
  }

  /* ---------- canvas helpers ---------- */

  function drawScaled(source, sw, sh, maxSide, bg) {
    const sc = Math.min(1, maxSide / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * sc)), h = Math.max(1, Math.round(sh * sc));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(source, 0, 0, w, h);
    return c;
  }
  function analyzeSource(source, sw, sh) {
    const c = drawScaled(source, sw, sh, 240);
    const id = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
    const A = analyzePixels(id);
    A.width = sw; A.height = sh; A.aspect = nearestAspect(sw, sh);
    A.orientation = sw / sh > 1.08 ? 'landscape' : sw / sh < 0.92 ? 'portrait' : 'square';
    return A;
  }
  function lumaOf(source, sw, sh) {
    const c = drawScaled(source, sw, sh, 48);
    const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
    const out = new Float32Array(c.width * c.height);
    for (let i = 0, p = 0; i < out.length; i++, p += 4) out[i] = 0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2];
    return out;
  }
  function toBase64(canvas, png) {
    const url = canvas.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86);
    return { mime: png ? 'image/png' : 'image/jpeg', data: url.slice(url.indexOf(',') + 1) };
  }

  async function seek(v, t) {
    const p = waitEvent(v, 'seeked', 'error', 10000);
    v.currentTime = Math.min(Math.max(t, 0), Math.max(v.duration - 0.05, 0));
    await p;
    await new Promise((r) => requestAnimationFrame(() => r()));
  }

  async function extractFrames(n, forAI) {
    const v = S.video, d = v.duration, out = [], lumas = [];
    v.pause();
    for (let i = 0; i < n; i++) {
      const t = (d * (i + 0.5)) / n;
      setStatus(`Mengambil frame ${i + 1}/${n}…`, '', true);
      await seek(v, t);
      const A = analyzeSource(v, v.videoWidth, v.videoHeight);
      lumas.push(lumaOf(v, v.videoWidth, v.videoHeight));
      const thumb = drawScaled(v, v.videoWidth, v.videoHeight, 140);
      const f = { t, A, thumb: thumb.toDataURL('image/jpeg', 0.7) };
      if (forAI) f.img = toBase64(drawScaled(v, v.videoWidth, v.videoHeight, 1280, '#000'), false);
      out.push(f);
    }
    await seek(v, 0);
    return { frames: out, motion: motionMetrics(lumas) };
  }

  function renderFilmstrip(frames) {
    const fs = $('filmstrip'); fs.textContent = ''; fs.hidden = false;
    frames.forEach((f) => {
      const fig = el('figure');
      fig.appendChild(el('img', { src: f.thumb, alt: 'frame ' + f.t.toFixed(1) + ' detik' }));
      fig.appendChild(el('figcaption', { text: f.t.toFixed(1) + 's' }));
      fs.appendChild(fig);
    });
  }

  /* ---------- proses utama ---------- */

  function currentOpts() {
    return {
      type: $('mediaType').value, target: $('target').value, detail: S.detail, lang: $('lang').value,
      subject: $('subject').value.trim(), notes: $('notes').value.trim(),
      extras: [...document.querySelectorAll('#extras input:checked')].map((i) => i.value),
    };
  }

  async function generate() {
    if (S.busy || !S.file) return;
    S.busy = true; $('btnGo').disabled = true;
    const opts = currentOpts();
    const mode = $('mode').value;
    try {
      let A = S.analysis, aiImages = [];
      if (S.kind === 'video') {
        const n = parseInt($('frames').value, 10) || 6;
        const r = await extractFrames(n, mode === 'ai');
        S.frames = r.frames;
        renderFilmstrip(r.frames);
        A = r.frames[Math.floor(r.frames.length / 2)].A;
        A = Object.assign({}, A, { width: S.videoInfo.width, height: S.videoInfo.height, aspect: nearestAspect(S.videoInfo.width, S.videoInfo.height) });
        opts.video = { duration: S.videoInfo.duration, frames: r.frames.map((f) => ({ t: f.t, A: f.A })), motion: r.motion };
        if (opts.type === 'auto') opts.type = 'video';
        aiImages = r.frames.map((f) => f.img).filter(Boolean);
        S.analysis = A;
      } else if (mode === 'ai') {
        const png = A.transparent;
        aiImages = [toBase64(drawScaled(S.img, S.img.naturalWidth, S.img.naturalHeight, png ? 1280 : 1568, png ? null : '#ffffff'), png)];
      }

      let result;
      if (mode === 'local') {
        setStatus('Menyusun prompt dari analisis lokal…', '', true);
        result = composeLocal(A, opts);
      } else {
        const prov = settings.provider;
        setStatus(`Mengirim ${aiImages.length} gambar ke ${prov} — menunggu jawaban AI…`, '', true);
        const body = {
          provider: prov, model: settings.models[prov], apiKey: settings.keys[prov] || '',
          baseUrl: prov === 'openai' ? settings.baseUrl : undefined,
          system: buildAISystem(opts), userText: buildAIUser(A, opts),
          images: aiImages, maxTokens: opts.detail === 'ultra' ? 8000 : opts.detail === 'super' ? 5000 : 3000,
        };
        const res = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({ error: 'Respons server tidak valid.' }));
        if (!res.ok) throw new Error(data.error || 'Permintaan gagal (' + res.status + ')');
        result = normalizeAIResult(data.text, A);
        if (!result.parsed) toast('Jawaban AI bukan JSON — ditampilkan apa adanya.');
      }
      result.opts = opts; result.analysis = A;
      S.result = result;
      renderResult(result);
      pushHistory(result);
      setStatus(mode === 'ai' ? 'Selesai — dibuat oleh AI Vision.' : 'Selesai — dibuat dari analisis lokal.', 'ok');
    } catch (e) {
      setStatus(e && e.message ? e.message : String(e), 'err');
    } finally {
      S.busy = false; $('btnGo').disabled = !S.file;
    }
  }

  /* ---------- tampilan hasil ---------- */

  function renderResult(r) {
    $('empty').hidden = true; $('panes').hidden = false;
    ['btnCopy', 'btnTxt', 'btnJson'].forEach((id) => { $(id).disabled = false; });

    const pills = $('pillMain'); pills.textContent = '';
    pills.appendChild(el('span', { class: 'pill hl', text: r.mode === 'ai' ? 'AI Vision' : 'Analisis lokal' }));
    pills.appendChild(el('span', { class: 'pill', text: r.mediaType || 'auto' }));
    pills.appendChild(el('span', { class: 'pill mg', text: r.opts.target }));
    pills.appendChild(el('span', { class: 'pill', text: r.opts.detail }));
    pills.appendChild(el('span', { class: 'pill', text: `${r.main.split(/\s+/).filter(Boolean).length} kata` }));

    $('outMain').textContent = r.main;
    const pb = $('paramsBox');
    if (r.params) { pb.hidden = false; pb.textContent = '⚙ ' + r.params; } else pb.hidden = true;
    $('outNeg').textContent = r.negative || '(Target ini tidak memakai negative prompt — gunakan deskripsi positif.)';
    $('outStruct').textContent = JSON.stringify(r.structured, null, 2);
    renderAnalysis(r);
    renderVariations(r);
    switchTab('main');
  }

  function stat(k, v) { return el('div', { class: 'stat' }, [el('b', { text: k }), el('span', { text: v })]); }

  function renderAnalysis(r) {
    const A = r.analysis, box = $('outAnalysis'); box.textContent = '';
    if (r.summary) box.appendChild(el('p', { class: 'note', text: r.summary }));
    const st = el('div', { class: 'stats' });
    [
      ['Ukuran', `${A.width}×${A.height}px`], ['Rasio', A.aspect.label + (A.aspect.approx ? ' (≈)' : '')], ['Orientasi', A.orientation],
      ['Tonalitas', A.brightnessLabel], ['Kontras', A.contrastLabel], ['Saturasi', A.satLabel], ['Suhu warna', A.temperature],
      ['Harmoni', A.harmony], ['Arah cahaya', A.lightDir], ['Komposisi', A.weight], ['Simetri', A.symmetry], ['Kepadatan detail', A.complexityLabel],
      ['Latar', A.bg.uniform ? `${A.bg.name} ${A.bg.hex}` : 'tidak seragam'], ['Transparansi', A.transparent ? 'ya' : 'tidak'],
    ].forEach(([k, v]) => st.appendChild(stat(k, v)));
    box.appendChild(st);

    box.appendChild(el('div', { class: 'sub', text: 'Palet warna terukur' }));
    const sw = el('div', { class: 'swatches' });
    A.palette.slice(0, 8).forEach((c) => {
      const chip = el('i'); chip.style.background = c.hex;
      sw.appendChild(el('div', { class: 'sw' }, [chip, el('div', null, [el('b', { text: c.hex }), el('small', { text: `${c.name} · ${pct(c.pct)}` })])]));
    });
    box.appendChild(sw);

    if (S.frames.length && r.opts.video) {
      box.appendChild(el('div', { class: 'sub', text: 'Video' }));
      const m = r.opts.video.motion;
      const vs = el('div', { class: 'stats' });
      vs.appendChild(stat('Durasi', fmtDur(r.opts.video.duration)));
      vs.appendChild(stat('Frame dianalisis', String(S.frames.length)));
      vs.appendChild(stat('Gerak', m.label));
      vs.appendChild(stat('Potongan keras', String(m.cuts)));
      box.appendChild(vs);
    }
  }

  function renderVariations(r) {
    const box = $('outVars'); box.textContent = '';
    if (!r.variations.length) { box.appendChild(el('p', { class: 'muted', text: 'Tidak ada variasi.' })); return; }
    r.variations.forEach((v) => {
      const b = el('button', { class: 'btn small', type: 'button', text: 'Salin' });
      b.addEventListener('click', () => copyText(v.prompt));
      box.appendChild(el('div', { class: 'var' }, [el('header', null, [el('h4', { text: v.label }), b]), el('p', { text: v.prompt })]));
    });
  }

  function switchTab(name) {
    S.tab = name;
    document.querySelectorAll('#tabs button').forEach((b) => { const on = b.dataset.tab === name; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    document.querySelectorAll('.pane').forEach((p) => { p.hidden = p.dataset.pane !== name; });
  }

  function currentText() {
    if (!S.result) return '';
    const r = S.result;
    if (S.tab === 'neg') return r.negative;
    if (S.tab === 'struct') return JSON.stringify(r.structured, null, 2);
    if (S.tab === 'vars') return r.variations.map((v) => `# ${v.label}\n${v.prompt}`).join('\n\n');
    return r.main + (r.params ? '\n\n' + r.params : '');
  }

  /* ---------- riwayat ---------- */

  function loadHistory() { try { return JSON.parse(localStorage.getItem('azr.history') || '[]'); } catch (e) { return []; } }
  function pushHistory(r) {
    const h = loadHistory();
    h.unshift({ t: Date.now(), name: S.file ? S.file.name : '', mode: r.mode, target: r.opts.target, detail: r.opts.detail, main: r.main, negative: r.negative, params: r.params });
    try { localStorage.setItem('azr.history', JSON.stringify(h.slice(0, 15))); } catch (e) { /* kuota penuh */ }
  }
  function renderHistory() {
    const list = $('historyList'); list.textContent = '';
    const h = loadHistory();
    if (!h.length) { list.appendChild(el('p', { class: 'muted', text: 'Belum ada riwayat.' })); return; }
    h.forEach((it) => {
      const b = el('button', { type: 'button' }, [
        el('b', { text: `${new Date(it.t).toLocaleString('id-ID')} · ${it.mode === 'ai' ? 'AI' : 'Lokal'} · ${it.target}` }),
        el('span', { text: it.name ? `${it.name} — ${it.main}` : it.main }),
      ]);
      b.addEventListener('click', () => {
        S.result = { mode: it.mode, mediaType: '', summary: '', main: it.main, negative: it.negative || '', params: it.params || '', structured: {}, variations: [], opts: { target: it.target, detail: it.detail }, analysis: S.analysis || analysisStub() };
        renderResult(S.result); $('dlgHistory').close();
      });
      list.appendChild(b);
    });
  }
  function analysisStub() {
    return { width: 0, height: 0, aspect: { label: '-' }, orientation: '-', palette: [], bg: { uniform: false }, transparent: false, brightnessLabel: '-', contrastLabel: '-', satLabel: '-', temperature: '-', harmony: '-', lightDir: '-', weight: '-', symmetry: '-', complexityLabel: '-' };
  }

  /* ---------- pengaturan ---------- */

  function fillSettingsDialog() {
    const p = settings.provider;
    $('provider').value = p; $('model').value = settings.models[p] || '';
    $('modelHint').textContent = MODEL_HINTS[p]; $('apiKey').value = settings.keys[p] || '';
    $('baseUrlField').hidden = p !== 'openai'; $('baseUrl').value = settings.baseUrl || '';
    $('remember').checked = settings.remember;
  }

  /* ---------- inisialisasi ---------- */

  function init() {
    $('year').textContent = new Date().getFullYear();

    // status server
    fetch('/api/health').then((r) => r.json()).then((d) => {
      const b = $('serverBadge'); b.textContent = 'server: online'; b.classList.add('ok');
      const keys = Object.entries(d.serverKeys || {}).filter(([, v]) => v).map(([k]) => k);
      b.title = keys.length ? 'API key di server: ' + keys.join(', ') : 'Belum ada API key di server (isi di Pengaturan AI)';
    }).catch(() => { const b = $('serverBadge'); b.textContent = 'server: offline'; b.classList.add('err'); });

    // unggah
    const drop = $('drop'), input = $('file');
    input.addEventListener('change', () => { handleFile(input.files[0]); input.value = ''; });
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    // klik pada pratinjau video agar kontrol video tetap bisa dipakai
    $('preview').addEventListener('click', (e) => { if (e.target.tagName === 'VIDEO') e.preventDefault(); });
    document.addEventListener('paste', (e) => {
      const f = [...(e.clipboardData ? e.clipboardData.files : [])].find((x) => x.type.startsWith('image/'));
      if (f) handleFile(f);
    });

    // tingkat detail
    document.querySelectorAll('#detailSeg button').forEach((b) => b.addEventListener('click', () => {
      S.detail = b.dataset.v;
      document.querySelectorAll('#detailSeg button').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
      $('detailHint').textContent = DETAIL_HINT[S.detail];
    }));
    $('detailHint').textContent = DETAIL_HINT[S.detail];

    $('btnGo').addEventListener('click', generate);

    // tab & aksi hasil
    document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    $('btnCopy').addEventListener('click', () => copyText(currentText()));
    $('btnTxt').addEventListener('click', () => {
      const r = S.result; if (!r) return;
      const txt = `azr-promt — © azrDev\n\n[PROMPT]\n${r.main}\n\n[PARAMETER]\n${r.params || '-'}\n\n[NEGATIVE]\n${r.negative || '-'}\n`;
      download('azr-promt.txt', txt, 'text/plain;charset=utf-8');
    });
    $('btnJson').addEventListener('click', () => {
      const r = S.result; if (!r) return;
      const o = { generator: 'azr-promt © azrDev', mode: r.mode, media_type: r.mediaType, target: r.opts.target, detail: r.opts.detail, summary: r.summary, main_prompt: r.main, negative_prompt: r.negative, parameters: r.params, structured: r.structured, variations: r.variations };
      download('azr-promt.json', JSON.stringify(o, null, 2), 'application/json');
    });

    // pengaturan
    $('btnSettings').addEventListener('click', () => { fillSettingsDialog(); $('dlgSettings').showModal(); });
    $('provider').addEventListener('change', () => {
      const p = $('provider').value;
      $('model').value = settings.models[p] || DEFAULT_MODELS[p]; $('modelHint').textContent = MODEL_HINTS[p];
      $('apiKey').value = settings.keys[p] || ''; $('baseUrlField').hidden = p !== 'openai';
    });
    $('btnSaveSettings').addEventListener('click', () => {
      const p = $('provider').value;
      settings.provider = p; settings.models[p] = $('model').value.trim() || DEFAULT_MODELS[p];
      settings.keys[p] = $('apiKey').value.trim(); settings.baseUrl = $('baseUrl').value.trim(); settings.remember = $('remember').checked;
      saveSettings(); toast('Pengaturan tersimpan ✓');
    });

    // riwayat
    $('btnHistory').addEventListener('click', () => { renderHistory(); $('dlgHistory').showModal(); });
    $('btnClearHistory').addEventListener('click', () => { localStorage.removeItem('azr.history'); renderHistory(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
