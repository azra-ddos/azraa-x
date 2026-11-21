// azr-promt frontend — © azrDev
(() => {
  const $ = id => document.getElementById(id);
  const S = { frames: [], thumb: '', local: null, data: null, tab: 'prompt_utama_en', isVideo: false };

  // ---------- util ----------
  const status = (msg, err) => { const s = $('status'); s.hidden = !msg; s.textContent = msg || ''; s.className = 'status' + (err ? ' err' : ''); };
  const store = { get: k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const toHex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

  // ---------- settings ----------
  $('btnSettings').onclick = async () => {
    $('keyClaude').value = store.get('azr_k_claude'); $('keyGemini').value = store.get('azr_k_gemini');
    try { const h = await (await fetch('/api/health')).json(); $('health').textContent = `Server OK · env Claude: ${h.claude ? 'ada' : 'kosong'} · env Gemini: ${h.gemini ? 'ada' : 'kosong'}`; } catch { $('health').textContent = 'Server tidak terjangkau'; }
    $('dlg').showModal();
  };
  $('saveKeys').onclick = () => { store.set('azr_k_claude', $('keyClaude').value.trim()); store.set('azr_k_gemini', $('keyGemini').value.trim()); };

  // ---------- file handling ----------
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', ev => { if (ev.dataTransfer.files[0]) load(ev.dataTransfer.files[0]); });
  $('file').onchange = e => e.target.files[0] && load(e.target.files[0]);
  $('frameCount').onchange = () => S.isVideo && load.last && load(load.last);

  function fitCanvas(src, w, h, max = 1280) {
    const k = Math.min(1, max / Math.max(w, h)); const cw = Math.round(w * k), ch = Math.round(h * k);
    const c = $('cv'); c.width = cw; c.height = ch; const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(src, 0, 0, cw, ch); return { c, x, cw, ch };
  }
  const grab = (q = 0.85) => $('cv').toDataURL('image/jpeg', q).split(',')[1];

  async function load(file) {
    load.last = file; status('Memproses file…'); $('go').disabled = true;
    $('result').hidden = true; $('local').hidden = true;
    const url = URL.createObjectURL(file); S.frames = []; S.local = null;
    S.isVideo = file.type.startsWith('video/');
    $('framesBox').hidden = !S.isVideo;
    $('prevImg').hidden = S.isVideo; $('prevVid').hidden = !S.isVideo; $('dropText').hidden = true;
    try {
      if (S.isVideo) {
        const v = $('prevVid'); v.src = url; v.muted = true;
        await new Promise((ok, no) => { v.onloadedmetadata = ok; v.onerror = () => no(new Error('Video tidak bisa dibaca')); });
        const n = +$('frameCount').value, dur = v.duration || 1; const stats = [];
        for (let i = 0; i < n; i++) {
          const t = Math.min(dur - 0.05, dur * (i + 0.5) / n);
          await new Promise(ok => { v.onseeked = ok; v.currentTime = t; });
          const { cw, ch } = fitCanvas(v, v.videoWidth, v.videoHeight, 960);
          S.frames.push({ mime: 'image/jpeg', data: grab(0.8), t: +t.toFixed(2) });
          stats.push(analyze($('cv').getContext('2d'), cw, ch));
          if (i === 0) S.thumb = $('cv').toDataURL('image/jpeg', 0.4);
        }
        S.local = mergeLocal(stats, v.videoWidth, v.videoHeight, dur);
      } else {
        const img = $('prevImg'); img.src = url;
        await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error('Gambar tidak bisa dibaca')); });
        const { x, cw, ch } = fitCanvas(img, img.naturalWidth, img.naturalHeight);
        S.frames.push({ mime: 'image/jpeg', data: grab(0.88) });
        S.local = analyze(x, cw, ch); S.local.resolusi = `${img.naturalWidth}x${img.naturalHeight}`;
        fitCanvas(img, img.naturalWidth, img.naturalHeight, 96); S.thumb = $('cv').toDataURL('image/jpeg', 0.5);
      }
      showLocal(); status(''); $('go').disabled = false;
    } catch (e) { status(e.message, true); }
  }

  // ---------- local pixel analysis ----------
  function ratioName(w, h) {
    const r = w / h, c = [['1:1', 1], ['4:3', 4 / 3], ['3:2', 1.5], ['16:9', 16 / 9], ['21:9', 21 / 9], ['3:4', .75], ['2:3', 2 / 3], ['9:16', 9 / 16], ['4:5', .8]];
    return c.reduce((a, b) => Math.abs(b[1] - r) < Math.abs(a[1] - r) ? b : a)[0];
  }
  function colorName(r, g, b) {
    const [h, s, l] = rgb2hsl(r, g, b);
    if (l < .12) return 'hitam'; if (l > .92) return 'putih'; if (s < .12) return l < .4 ? 'abu gelap' : l < .7 ? 'abu' : 'abu terang';
    const n = h < 15 || h >= 345 ? 'merah' : h < 40 ? 'oranye' : h < 65 ? 'kuning' : h < 160 ? 'hijau' : h < 200 ? 'cyan' : h < 255 ? 'biru' : h < 290 ? 'ungu' : 'magenta/pink';
    return (l < .3 ? 'gelap ' : l > .7 ? 'terang ' : '') + n;
  }
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return [h, s, l];
  }
  function analyze(ctx, w, h) {
    const d = ctx.getImageData(0, 0, w, h).data, bins = new Map(); let lum = 0, sat = 0, n = 0, lmin = 255, lmax = 0, tl = 0, tr = 0, cnt = 0;
    const step = Math.max(1, Math.floor(Math.sqrt(w * h / 40000)));
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3]; if (a < 20) continue;
      const L = .2126 * r + .7152 * g + .0722 * b; lum += L; n++; lmin = Math.min(lmin, L); lmax = Math.max(lmax, L);
      sat += rgb2hsl(r, g, b)[1]; if (x < w / 2) tl += L; else tr += L; cnt++;
      const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4); const o = bins.get(k) || { c: 0, r: 0, g: 0, b: 0 }; o.c++; o.r += r; o.g += g; o.b += b; bins.set(k, o);
    }
    const arr = [...bins.values()].sort((a, b) => b.c - a.c), pal = [];
    for (const o of arr) {
      const r = Math.round(o.r / o.c), g = Math.round(o.g / o.c), b = Math.round(o.b / o.c);
      if (pal.every(p => Math.hypot(p.r - r, p.g - g, p.b - b) > 48)) pal.push({ r, g, b, pct: +(o.c / n * 100).toFixed(1) });
      if (pal.length >= 6) break;
    }
    const avg = lum / n;
    return {
      resolusi: `${w}x${h}`, rasio: ratioName(w, h), kecerahan: Math.round(avg), kontras: Math.round(lmax - lmin), saturasi: +(sat / n).toFixed(2),
      pencahayaan: avg < 70 ? 'gelap / low-key' : avg > 170 ? 'terang / high-key' : 'sedang',
      arah_cahaya: Math.abs(tl - tr) / cnt < 6 ? 'merata' : tl > tr ? 'dari kiri' : 'dari kanan',
      palet: pal.map(p => ({ hex: toHex(p.r, p.g, p.b), nama: colorName(p.r, p.g, p.b), persen: p.pct }))
    };
  }
  function mergeLocal(list, w, h, dur) {
    const f = list[0]; const avg = k => Math.round(list.reduce((a, b) => a + b[k], 0) / list.length);
    const lum = list.map(l => l.kecerahan);
    return { ...f, resolusi: `${w}x${h}`, rasio: ratioName(w, h), durasi_detik: +dur.toFixed(1), kecerahan: avg('kecerahan'), kontras: avg('kontras'),
      perubahan_cahaya: Math.max(...lum) - Math.min(...lum) > 40 ? 'berubah signifikan antar frame' : 'relatif stabil' };
  }
  function showLocal() {
    const L = S.local; if (!L) return;
    $('swatches').innerHTML = L.palet.map(p => `<div class="sw"><i style="background:${p.hex}"></i>${p.hex}<br>${p.persen}%</div>`).join('');
    const chips = [`Resolusi ${L.resolusi}`, `Rasio ${L.rasio}`, `Cahaya ${L.pencahayaan}`, `Arah ${L.arah_cahaya}`, `Kontras ${L.kontras}/255`, `Saturasi ${L.saturasi}`];
    if (L.durasi_detik) chips.push(`Durasi ${L.durasi_detik}s`, `Cahaya: ${L.perubahan_cahaya}`);
    $('localInfo').innerHTML = chips.map(c => `<span class="chip">${c}</span>`).join(''); $('local').hidden = false;
  }

  // ---------- generate ----------
  $('go').onclick = async () => {
    if (!S.frames.length) return;
    const provider = $('provider').value;
    $('go').disabled = true; $('result').hidden = true;
    try {
      if (provider === 'local') { S.data = localOnly(); }
      else {
        status(`Menganalisis dengan ${provider === 'gemini' ? 'Gemini' : 'Claude'}… (bisa 10–40 detik)`);
        const r = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
          provider, apiKey: store.get(provider === 'gemini' ? 'azr_k_gemini' : 'azr_k_claude'), frames: S.frames.map(f => ({ mime: f.mime, data: f.data })),
          mode: $('mode').value, target: $('target').value, extra: $('extra').value.trim(), local: S.local }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Gagal');
        S.data = parseJSON(j.text);
      }
      render(); save(); status('');
    } catch (e) { status(e.message, true); }
    $('go').disabled = false;
  };

  function parseJSON(t) {
    t = (t || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try { return JSON.parse(t); } catch {}
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
    return { ringkasan: 'Respons bukan JSON valid, ditampilkan apa adanya.', prompt_utama_en: t };
  }

  function localOnly() {
    const L = S.local, pal = L.palet.map(p => `${p.nama} (${p.hex})`).join(', ');
    const vid = S.isVideo;
    const en = `${vid ? 'Cinematic video scene' : 'High-detail image'}, ${L.pencahayaan} lighting with light coming ${L.arah_cahaya}, dominant color palette of ${pal}, ${L.kontras > 180 ? 'strong contrast' : 'soft contrast'}, ${L.saturasi > .45 ? 'vivid saturated colors' : 'muted natural colors'}, aspect ratio ${L.rasio}, sharp focus, rich textures, professional composition, 8k, highly detailed. (Mode lokal hanya membaca piksel: subjek tidak dikenali. Tambahkan deskripsi subjek sendiri di bagian depan prompt.)`;
    return { ringkasan: 'Analisis lokal berdasarkan warna, cahaya, dan rasio. Untuk deskripsi subjek lengkap, pakai mesin Claude/Gemini.', tipe: vid ? 'video' : 'lainnya',
      palet_warna: L.palet.map(p => `${p.hex} ${p.nama}`), rasio_aspek: L.rasio, pencahayaan: `${L.pencahayaan}, ${L.arah_cahaya}`,
      prompt_utama_en: en, prompt_midjourney: `${en.split('. (')[0]} --ar ${L.rasio} --v 7 --style raw --s 250`,
      prompt_stable_diffusion: `(masterpiece:1.2), (best quality:1.2), ${L.pencahayaan} lighting, ${pal}, (highly detailed:1.1), ${L.rasio}`,
      negative_prompt: 'blurry, low quality, watermark, text artifacts, deformed, oversaturated',
      parameter_saran: { ratio: L.rasio, steps: '30', cfg: '7', sampler: 'DPM++ 2M Karras', seed_note: 'Simpan seed bila hasil bagus.' } };
  }

  // ---------- render ----------
  const LABEL = { prompt_utama_en: 'Prompt EN', prompt_utama_id: 'Prompt ID', prompt_midjourney: 'Midjourney', prompt_stable_diffusion: 'Stable Diffusion', prompt_dalle_flux: 'DALL·E / Flux', prompt_video: 'Video', negative_prompt: 'Negative', parameter_saran: 'Parameter', tag_kata_kunci: 'Tag' };
  const FIELDS = { subjek: 'Subjek', latar: 'Latar', gaya: 'Gaya', komposisi: 'Komposisi', kamera: 'Kamera', pencahayaan: 'Pencahayaan', palet_warna: 'Palet', mood: 'Mood', detail_penting: 'Detail penting', teks_terlihat: 'Teks terlihat', tipografi: 'Tipografi', brand_logo: 'Brand / logo', gerakan_video: 'Gerakan video', rasio_aspek: 'Rasio' };
  const val = v => Array.isArray(v) ? v.join(', ') : (v && typeof v === 'object') ? Object.entries(v).map(([k, x]) => `${k}: ${x}`).join('\n') : (v || '');
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function render() {
    const D = S.data; $('summary').textContent = D.ringkasan || '';
    const keys = Object.keys(LABEL).filter(k => val(D[k]));
    if (!keys.includes(S.tab)) S.tab = keys[0];
    $('tabs').innerHTML = keys.map(k => `<button class="tab ghost${k === S.tab ? ' on' : ''}" data-k="${k}">${LABEL[k]}</button>`).join('');
    $('tabs').querySelectorAll('.tab').forEach(b => b.onclick = () => { S.tab = b.dataset.k; render(); });
    $('out').textContent = val(D[S.tab]);
    $('detail').innerHTML = '<dl>' + Object.keys(FIELDS).filter(k => val(D[k])).map(k => `<dt>${FIELDS[k]}</dt><dd>${esc(val(D[k]))}</dd>`).join('') + '</dl>';
    $('result').hidden = false; $('result').scrollIntoView({ behavior: 'smooth' });
  }

  $('copy').onclick = async () => {
    const t = $('out').textContent;
    try { await navigator.clipboard.writeText(t); } catch { const r = document.createRange(); r.selectNodeContents($('out')); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand('copy'); }
    $('copy').textContent = 'Tersalin ✓'; setTimeout(() => $('copy').textContent = 'Salin', 1400);
  };
  const dlFile = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); };
  $('dl').onclick = () => dlFile('azr-promt.txt', Object.keys(LABEL).filter(k => val(S.data[k])).map(k => `## ${LABEL[k]}\n${val(S.data[k])}`).join('\n\n') + '\n\n© azrDev', 'text/plain');
  $('dlJson').onclick = () => dlFile('azr-promt.json', JSON.stringify(S.data, null, 2), 'application/json');

  // ---------- history ----------
  const getHist = () => { try { return JSON.parse(store.get('azr_hist') || '[]'); } catch { return []; } };
  function save() {
    const h = getHist(); h.unshift({ t: Date.now(), thumb: S.thumb, data: S.data }); store.set('azr_hist', JSON.stringify(h.slice(0, 15))); drawHist();
  }
  function drawHist() {
    const h = getHist(); $('histBox').hidden = !h.length;
    $('hist').innerHTML = h.map((x, i) => `<div class="hist-i" data-i="${i}"><img src="${x.thumb || ''}" alt=""><div>${esc((x.data.ringkasan || 'Hasil').slice(0, 90))}<br><small>${new Date(x.t).toLocaleString('id-ID')}</small></div></div>`).join('');
    $('hist').querySelectorAll('.hist-i').forEach(el => el.onclick = () => { S.data = h[+el.dataset.i].data; render(); });
  }
  $('clearHist').onclick = () => { store.set('azr_hist', '[]'); drawHist(); };
  drawHist();
})();
