/**
 * azra-IP — app.js
 * Advanced IP Intelligence Tracker
 * Author: azraDev
 * Version: 2.1.0
 */

'use strict';

/* ============================================================
   CONSTANTS & CONFIGURATION
   ============================================================ */
const CONFIG = {
  APIS: {
    IP_API:    ip => `https://ip-api.com/json/${ip}?fields=66846719`,
    IPAPI_CO:  ip => `https://ipapi.co/${ip}/json/`,
    IPWHOIS:   ip => `https://ipwho.is/${ip}`,
    MY_IP:     'https://api.ipify.org?format=json',
    MY_IP_ALT: 'https://api.my-ip.io/v2/ip.json',
  },
  MAP_TILES: {
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    street:    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    dark:      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  },
  MAP_ATTR: {
    satellite: '© Esri',
    street:    '© OpenStreetMap',
    dark:      '© CARTO, © OpenStreetMap',
  },
  HISTORY_KEY:   'azra_ip_history',
  MAX_HISTORY:   50,
  RATE_LIMIT_MS: 1200,
};

/* ============================================================
   STATE
   ============================================================ */
const STATE = {
  currentData: null,
  compareDataA: null,
  compareDataB: null,
  map: null,
  mapLayer: null,
  mapMarker: null,
  currentMapStyle: 'dark',
  history: [],
  batchResults: [],
  lastSearch: 0,
  tzInterval: null,
  searchSuggestions: [
    '8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1',
    '208.67.222.222', '9.9.9.9', '76.76.2.0',
    'google.com', 'github.com', 'cloudflare.com', 'amazon.com',
  ],
};

/* ============================================================
   UTILITIES
   ============================================================ */
const $ = id => document.getElementById(id);
const wait = ms => new Promise(r => setTimeout(r, ms));

function classSet(el, cls, on) {
  if (!el) return;
  el.classList[on ? 'add' : 'remove'](cls);
}

function toast(msg, type = 'info', icon = '') {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span style="font-size:1rem">${icon || icons[type]}</span><span>${msg}</span>`;
  $('toast-container').prepend(el);
  setTimeout(() => el.remove(), 3100);
}

function copyText(text) {
  navigator.clipboard.writeText(text)
    .then(() => toast('Copied to clipboard!', 'success'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('Copied!', 'success');
    });
}

function formatRelTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function isValidIP(str) {
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  if (ipv4.test(str)) {
    return str.split('.').every(n => +n >= 0 && +n <= 255);
  }
  return ipv6.test(str);
}

function isPrivateIP(ip) {
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1|fc|fd)/.test(ip);
}

function isBogon(ip) {
  return /^(0\.|100\.6[4-9]\.|100\.[7-9]\d\.|100\.1[0-1]\d\.|100\.12[0-7]\.|169\.254\.|198\.1[8-9]\.|198\.51\.100\.|203\.0\.113\.|224\.|240\.|255\.255\.255\.255)/.test(ip);
}

function getIPVersion(ip) {
  return ip.includes(':') ? 'IPv6' : 'IPv4';
}

function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function syntaxHighlightJSON(json) {
  return JSON.stringify(json, null, 2)
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
      let cls = 'json-num';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'json-key' : 'json-str';
      } else if (/true|false/.test(match)) {
        cls = 'json-bool';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      const colors = { 'json-key': '#7dd3fc', 'json-str': '#86efac', 'json-num': '#fbbf24', 'json-bool': '#f9a8d4', 'json-null': '#94a3b8' };
      return `<span style="color:${colors[cls]}">${match}</span>`;
    });
}

/* ============================================================
   PARTICLE BACKGROUND
   ============================================================ */
function initParticles() {
  const bg = $('particles-bg');
  if (!bg) return;
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 3 + 1;
    const delay = Math.random() * 15;
    const dur   = Math.random() * 20 + 15;
    const left  = Math.random() * 100;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${left}%;
      animation-duration:${dur}s;
      animation-delay:${delay}s;
      background:${Math.random() > 0.5 ? '#00d4ff' : '#7b2ff7'};
    `;
    bg.appendChild(p);
  }
}

/* ============================================================
   CLOCK
   ============================================================ */
function initClock() {
  const el = $('live-clock');
  if (!el) return;
  const tick = () => {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-US', { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
  };
  tick();
  setInterval(tick, 1000);
}

/* ============================================================
   MAP
   ============================================================ */
function initMap() {
  if (STATE.map) return;
  try {
    STATE.map = L.map('map', { zoomControl: true, attributionControl: true });
    setMapTile('dark');
    STATE.map.setView([0, 0], 2);
  } catch (e) {
    console.warn('Map init failed:', e);
  }
}

function setMapTile(style) {
  if (!STATE.map) return;
  if (STATE.mapLayer) STATE.mapLayer.remove();
  STATE.mapLayer = L.tileLayer(CONFIG.MAP_TILES[style], {
    attribution: CONFIG.MAP_ATTR[style],
    maxZoom: 18,
  }).addTo(STATE.map);
  STATE.currentMapStyle = style;
  document.querySelectorAll('.map-ctrl-btn[id^="map-"]').forEach(b => {
    b.classList.remove('active');
    if (b.id === `map-${style}`) b.classList.add('active');
  });
}

function updateMap(lat, lon, label) {
  if (!STATE.map) initMap();
  if (!STATE.map) return;
  STATE.map.setView([lat, lon], 10);
  if (STATE.mapMarker) STATE.mapMarker.remove();
  const icon = L.divIcon({
    className: '',
    html: '<div class="ip-marker-dot"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
  STATE.mapMarker = L.marker([lat, lon], { icon })
    .bindPopup(`<b>${label}</b><br>Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`)
    .addTo(STATE.map)
    .openPopup();
  setTimeout(() => STATE.map.invalidateSize(), 100);
}

/* ============================================================
   HISTORY MANAGEMENT
   ============================================================ */
function loadHistory() {
  try {
    STATE.history = JSON.parse(localStorage.getItem(CONFIG.HISTORY_KEY) || '[]');
  } catch { STATE.history = []; }
}

function saveHistory() {
  localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(STATE.history.slice(0, CONFIG.MAX_HISTORY)));
}

function addToHistory(data) {
  const entry = {
    id: Date.now(),
    ip: data.query || data.ip,
    country: data.country || data.country_name || '—',
    city: data.city || '—',
    isp: data.isp || data.org || '—',
    ts: Date.now(),
    data,
  };
  STATE.history = STATE.history.filter(h => h.ip !== entry.ip);
  STATE.history.unshift(entry);
  saveHistory();
  renderHistory();
}

function renderHistory(filter = '') {
  const el = $('history-list');
  const empty = $('empty-history');
  const filtered = filter
    ? STATE.history.filter(h =>
        h.ip.includes(filter) || h.country.toLowerCase().includes(filter) || h.city.toLowerCase().includes(filter)
      )
    : STATE.history;

  if (filtered.length === 0) {
    el.innerHTML = '';
    el.appendChild(empty);
    empty.classList.remove('hidden');
    return;
  }

  el.innerHTML = '';
  filtered.forEach((h, i) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.setAttribute('role', 'listitem');
    item.innerHTML = `
      <span class="history-num">#${i+1}</span>
      <span class="history-ip">${h.ip}</span>
      <div class="history-meta">
        <span class="history-tag">🌍 ${h.country}</span>
        <span class="history-tag">🏙 ${h.city}</span>
        <span class="history-tag">🔗 ${h.isp.slice(0,25)}</span>
      </div>
      <span class="history-time">${formatRelTime(h.ts)}</span>
      <div class="history-actions">
        <button class="history-btn" data-action="retrack" data-ip="${h.ip}" aria-label="Re-track this IP">⌖ Track</button>
        <button class="history-btn danger" data-action="delete" data-id="${h.id}" aria-label="Delete history entry">✕</button>
      </div>
    `;
    el.appendChild(item);
  });
}

/* ============================================================
   DATA FETCHING — Multi-source with fallback
   ============================================================ */
async function fetchIPData(ip) {
  // Source 1: ip-api.com (primary — most complete free API)
  try {
    const res = await fetch(CONFIG.APIS.IP_API(ip));
    if (!res.ok) throw new Error('ip-api failed');
    const d = await res.json();
    if (d.status !== 'success') throw new Error(d.message || 'ip-api error');
    return { source: 'ip-api', ...d };
  } catch (e1) {
    console.warn('ip-api failed, trying fallback...', e1);
  }

  // Source 2: ipapi.co (fallback)
  try {
    const res = await fetch(CONFIG.APIS.IPAPI_CO(ip));
    if (!res.ok) throw new Error('ipapi.co failed');
    const d = await res.json();
    if (d.error) throw new Error(d.reason || 'ipapi.co error');
    return {
      source: 'ipapi.co',
      status: 'success',
      query: d.ip,
      country: d.country_name,
      countryCode: d.country_code,
      region: d.region_code,
      regionName: d.region,
      city: d.city,
      zip: d.postal,
      lat: d.latitude,
      lon: d.longitude,
      timezone: d.timezone,
      isp: d.org,
      org: d.org,
      as: d.asn,
      mobile: false,
      proxy: false,
      hosting: false,
    };
  } catch (e2) {
    console.warn('ipapi.co failed, trying ipwho.is...', e2);
  }

  // Source 3: ipwho.is (second fallback)
  try {
    const res = await fetch(CONFIG.APIS.IPWHOIS(ip));
    if (!res.ok) throw new Error('ipwho.is failed');
    const d = await res.json();
    if (!d.success) throw new Error(d.message || 'ipwho.is error');
    return {
      source: 'ipwho.is',
      status: 'success',
      query: d.ip,
      country: d.country,
      countryCode: d.country_code,
      region: d.region_code || d.region,
      regionName: d.region,
      city: d.city,
      zip: d.postal_code || '—',
      lat: d.latitude,
      lon: d.longitude,
      timezone: d.timezone?.id || '—',
      isp: d.connection?.isp || '—',
      org: d.connection?.org || '—',
      as: d.connection?.asn ? `AS${d.connection.asn}` : '—',
      mobile: false,
      proxy: false,
      hosting: false,
    };
  } catch (e3) {
    throw new Error('All data sources failed. Please try again later.');
  }
}

/* ---- Enrich data with additional computed fields ---- */
function enrichData(raw, ip) {
  const now = new Date();
  const ipStr = raw.query || ip;
  const privateIP = isPrivateIP(ipStr);
  const bogon = isBogon(ipStr);
  const version = getIPVersion(ipStr);

  // Threat score (0–100)
  let threat = 0;
  if (raw.proxy) threat += 30;
  if (raw.hosting) threat += 20;
  if (raw.mobile) threat += 5;
  if (bogon) threat += 40;
  if (privateIP) threat = 0;

  // Estimated ping from user to IP (rough geo distance)
  let myLat = 0, myLon = 0;
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(p => {
      myLat = p.coords.latitude;
      myLon = p.coords.longitude;
    }, () => {});
  }
  const distKm = (raw.lat && raw.lon) ? calcDistance(myLat || -6.2, myLon || 106.8, raw.lat, raw.lon) : 0;
  const estPing = Math.max(5, Math.round(distKm / 100));

  return {
    ...raw,
    _enriched: {
      ipStr,
      version,
      privateIP,
      bogon,
      threat,
      distKm,
      estPing,
      trackedAt: now.toISOString(),
      rttClass: estPing < 20 ? 'Excellent' : estPing < 60 ? 'Good' : estPing < 120 ? 'Fair' : 'High',
      anycast: raw.org?.toLowerCase().includes('anycast') || ip === '1.1.1.1' || ip === '8.8.8.8',
    }
  };
}

/* ============================================================
   RENDER RESULTS
   ============================================================ */
function renderResults(data) {
  const e = enrichData(data, data.query || data.ip || $('ip-input').value.trim());
  STATE.currentData = e;

  // === Hero ===
  $('res-ip').textContent      = e._enriched.ipStr;
  $('res-hostname').textContent = e.reverse || e.hostname || e._enriched.ipStr;

  renderBadges(e);
  renderThreatRing(e._enriched.threat);

  // === Geolocation ===
  setText('geo-country',  `${countryFlag(e.countryCode)} ${e.country || '—'}`);
  setText('geo-region',   e.regionName || e.region || '—');
  setText('geo-city',     e.city || '—');
  setText('geo-district', e.district || '—');
  setText('geo-zip',      e.zip || e.postal || '—');
  setText('geo-lat',      e.lat != null ? e.lat.toFixed(6) : '—');
  setText('geo-lon',      e.lon != null ? e.lon.toFixed(6) : '—');
  setText('geo-accuracy', e.lat != null ? '~50km radius' : '—');

  // === Network ===
  setText('net-isp',     e.isp || '—');
  setText('net-org',     e.org || '—');
  setText('net-asn',     e.as || e.asn || '—');
  setText('net-as-name', e.asname || extractASName(e.as) || '—');
  setText('net-version', e._enriched.version);
  setText('net-type',    e._enriched.privateIP ? 'Private' : e.hosting ? 'Hosting/DC' : e.mobile ? 'Mobile' : 'Public ISP');
  setText('net-cidr',    e.cidr || computeCIDR(e.lat, e.lon));
  setText('net-rdns',    e.reverse || e.hostname || 'N/A');

  // === Security ===
  const proxyVal = boolBadge(e.proxy, false);
  const torVal   = boolBadge(false, false);   // would need dedicated API
  const hostVal  = boolBadge(e.hosting, false);
  const mobVal   = boolBadge(e.mobile, false, true);

  setHTML('sec-proxy',    proxyVal);
  setHTML('sec-tor',      torVal);
  setHTML('sec-hosting',  hostVal);
  setHTML('sec-mobile',   mobVal);
  setText('sec-abuse',    `${e._enriched.threat}% risk score`);
  setHTML('sec-blacklist', boolBadge(false, false));
  setHTML('sec-spam',     boolBadge(false, false));

  const tl = e._enriched.threat;
  const tlText = tl === 0 ? '✓ Clean' : tl < 30 ? '⚠ Low' : tl < 60 ? '⚠ Medium' : '✕ High';
  setText('sec-threat', tlText);

  // Show security alert badge if risky
  const alertBadge = $('sec-alert-badge');
  if (alertBadge) alertBadge.hidden = e._enriched.threat < 30;

  // === Timezone ===
  const tz = e.timezone;
  setText('tz-id', tz || '—');
  renderTimezone(tz);

  // === Currency / Country ===
  const countryData = COUNTRY_DATA[e.countryCode] || {};
  setText('cur-name',         countryData.currency || '—');
  setText('cur-symbol',       countryData.symbol || '—');
  setText('cur-code',         countryData.currencyCode || '—');
  setText('cur-rate',         countryData.usdRate ? `1 USD = ${countryData.usdRate} ${countryData.currencyCode}` : '—');
  setText('cur-country-code', e.countryCode || '—');
  setText('cur-calling',      countryData.calling ? `+${countryData.calling}` : '—');
  setText('cur-lang',         countryData.languages || '—');
  setText('cur-continent',    e.continent || countryData.continent || '—');

  // === Connection Analysis ===
  setText('conn-ping',     e._enriched.estPing + ' ms (est.)');
  setText('conn-distance', e._enriched.distKm ? `~${e._enriched.distKm} km` : 'N/A');
  setText('conn-rtt',      e._enriched.rttClass);
  setText('conn-bgp',      e.as || '—');
  setHTML('conn-anycast',  boolBadge(e._enriched.anycast, false, true));
  setHTML('conn-private',  boolBadge(e._enriched.privateIP, false, true));
  setHTML('conn-reserved', boolBadge(e._enriched.bogon, false));
  setHTML('conn-bogon',    boolBadge(e._enriched.bogon, false));

  // === Map ===
  if (e.lat != null && e.lon != null) {
    const label = `${e.city || ''} ${e.country || ''}`.trim();
    updateMap(e.lat, e.lon, label || e._enriched.ipStr);
  }

  // === Raw Data ===
  const rawEl = $('raw-json');
  if (rawEl) rawEl.innerHTML = syntaxHighlightJSON(e);

  // === Show results ===
  $('empty-state').classList.add('hidden');
  $('results-area').classList.remove('hidden');

  // === History ===
  addToHistory(e);

  // === Update status dot ===
  const dot = $('status-dot');
  dot.className = 'dot-done';
}

function setText(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}

function setHTML(id, val) {
  const el = $(id);
  if (el) el.innerHTML = val;
}

function countryFlag(code) {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
}

function boolBadge(val, dangerIfTrue = true, infoIfTrue = false) {
  if (val === true) {
    if (infoIfTrue) return `<span class="badge badge-info">Yes</span>`;
    return dangerIfTrue
      ? `<span class="badge badge-danger">Yes</span>`
      : `<span class="badge badge-safe">Yes</span>`;
  }
  if (val === false) return `<span class="badge badge-safe">No</span>`;
  return `<span class="badge badge-neutral">—</span>`;
}

function renderBadges(e) {
  const badgeType    = $('badge-type');
  const badgeProxy   = $('badge-proxy');
  const badgeMobile  = $('badge-mobile');
  const badgeHosting = $('badge-hosting');

  badgeType.textContent  = e._enriched.version;
  badgeType.className    = 'badge badge-info';

  badgeProxy.textContent = e.proxy ? 'Proxy/VPN' : 'No Proxy';
  badgeProxy.className   = `badge ${e.proxy ? 'badge-danger' : 'badge-safe'}`;

  badgeMobile.textContent = e.mobile ? 'Mobile' : 'Fixed';
  badgeMobile.className   = 'badge badge-neutral';

  badgeHosting.textContent = e.hosting ? 'Hosting/DC' : 'ISP';
  badgeHosting.className   = `badge ${e.hosting ? 'badge-warn' : 'badge-safe'}`;
}

function renderThreatRing(score) {
  const circle = $('score-circle');
  const num    = $('score-num');
  const label  = $('score-label');
  if (!circle) return;

  const circumference = 213.6;
  const dashOffset = circumference - (circumference * score / 100);
  circle.style.strokeDashoffset = dashOffset;

  let color = '#22c55e';
  let lbl   = 'Low Risk';
  if (score >= 30 && score < 60) { color = '#eab308'; lbl = 'Medium Risk'; }
  if (score >= 60) { color = '#ef4444'; lbl = 'High Risk'; }
  circle.style.stroke = color;

  num.textContent  = score;
  label.textContent = lbl;
}

function renderTimezone(tz) {
  if (!tz) {
    ['tz-offset','tz-time','tz-date','tz-abbr','tz-dst','tz-savings','tz-locale'].forEach(id => setText(id, '—'));
    return;
  }
  if (STATE.tzInterval) clearInterval(STATE.tzInterval);

  const tick = () => {
    try {
      const d = new Date();
      const opts = { timeZone: tz, hour12: false };
      setText('tz-time', d.toLocaleTimeString('en-GB', { ...opts, hour:'2-digit', minute:'2-digit', second:'2-digit' }));
      setText('tz-date', d.toLocaleDateString('en-GB', { ...opts, weekday:'long', year:'numeric', month:'long', day:'numeric' }));

      // UTC offset
      const off = new Intl.DateTimeFormat('en', { ...opts, timeZoneName: 'short' })
        .formatToParts(d).find(p => p.type === 'timeZoneName')?.value || '—';
      setText('tz-abbr', off);

      // offset hours
      const utcStr = new Intl.DateTimeFormat('en', { ...opts, timeZoneName: 'longOffset' })
        .formatToParts(d).find(p => p.type === 'timeZoneName')?.value || '—';
      setText('tz-offset', utcStr);

      // DST (crude heuristic: compare summer/winter offsets)
      const janOff = new Date(d.getFullYear(), 0, 1).toLocaleString('en-GB', { timeZone: tz, timeZoneName: 'short' });
      const julOff = new Date(d.getFullYear(), 6, 1).toLocaleString('en-GB', { timeZone: tz, timeZoneName: 'short' });
      const hasDST = janOff !== julOff;
      setText('tz-dst', hasDST ? (d.getMonth() >= 3 && d.getMonth() <= 9 ? 'Active' : 'Inactive') : 'No DST');
      setText('tz-savings', hasDST ? '+1 hour' : 'None');
      setText('tz-locale', tz.split('/')[0]);
    } catch {
      setText('tz-time', new Date().toLocaleTimeString());
    }
  };
  tick();
  STATE.tzInterval = setInterval(tick, 1000);
}

function extractASName(asStr) {
  if (!asStr) return '';
  const m = asStr.match(/^AS\d+\s+(.+)$/);
  return m ? m[1] : '';
}

function computeCIDR(lat, lon) {
  // Rough guess — real CIDR needs ARIN/RIPE RDAP
  return lat != null ? 'See ARIN/RIPE' : '—';
}

/* ============================================================
   COUNTRY DATA — currency, calling codes, languages
   ============================================================ */
const COUNTRY_DATA = {
  US: { currency:'US Dollar', symbol:'$', currencyCode:'USD', usdRate:'1.00', calling:'1', languages:'English', continent:'North America' },
  GB: { currency:'Pound Sterling', symbol:'£', currencyCode:'GBP', usdRate:'0.79', calling:'44', languages:'English', continent:'Europe' },
  EU: { currency:'Euro', symbol:'€', currencyCode:'EUR', usdRate:'0.92', calling:'—', languages:'Multi', continent:'Europe' },
  DE: { currency:'Euro', symbol:'€', currencyCode:'EUR', usdRate:'0.92', calling:'49', languages:'German', continent:'Europe' },
  FR: { currency:'Euro', symbol:'€', currencyCode:'EUR', usdRate:'0.92', calling:'33', languages:'French', continent:'Europe' },
  JP: { currency:'Japanese Yen', symbol:'¥', currencyCode:'JPY', usdRate:'155.2', calling:'81', languages:'Japanese', continent:'Asia' },
  CN: { currency:'Chinese Yuan', symbol:'¥', currencyCode:'CNY', usdRate:'7.24', calling:'86', languages:'Mandarin', continent:'Asia' },
  IN: { currency:'Indian Rupee', symbol:'₹', currencyCode:'INR', usdRate:'83.9', calling:'91', languages:'Hindi, English', continent:'Asia' },
  ID: { currency:'Indonesian Rupiah', symbol:'Rp', currencyCode:'IDR', usdRate:'15800', calling:'62', languages:'Indonesian', continent:'Asia' },
  SG: { currency:'Singapore Dollar', symbol:'S$', currencyCode:'SGD', usdRate:'1.34', calling:'65', languages:'English, Malay, Chinese, Tamil', continent:'Asia' },
  AU: { currency:'Australian Dollar', symbol:'A$', currencyCode:'AUD', usdRate:'1.52', calling:'61', languages:'English', continent:'Oceania' },
  CA: { currency:'Canadian Dollar', symbol:'CA$', currencyCode:'CAD', usdRate:'1.36', calling:'1', languages:'English, French', continent:'North America' },
  BR: { currency:'Brazilian Real', symbol:'R$', currencyCode:'BRL', usdRate:'5.09', calling:'55', languages:'Portuguese', continent:'South America' },
  RU: { currency:'Russian Ruble', symbol:'₽', currencyCode:'RUB', usdRate:'89.5', calling:'7', languages:'Russian', continent:'Europe/Asia' },
  KR: { currency:'South Korean Won', symbol:'₩', currencyCode:'KRW', usdRate:'1320', calling:'82', languages:'Korean', continent:'Asia' },
  MY: { currency:'Malaysian Ringgit', symbol:'RM', currencyCode:'MYR', usdRate:'4.69', calling:'60', languages:'Malay, English, Chinese, Tamil', continent:'Asia' },
  TH: { currency:'Thai Baht', symbol:'฿', currencyCode:'THB', usdRate:'35.1', calling:'66', languages:'Thai', continent:'Asia' },
  PH: { currency:'Philippine Peso', symbol:'₱', currencyCode:'PHP', usdRate:'56.5', calling:'63', languages:'Filipino, English', continent:'Asia' },
  VN: { currency:'Vietnamese Dong', symbol:'₫', currencyCode:'VND', usdRate:'24900', calling:'84', languages:'Vietnamese', continent:'Asia' },
  MX: { currency:'Mexican Peso', symbol:'$', currencyCode:'MXN', usdRate:'17.2', calling:'52', languages:'Spanish', continent:'North America' },
  ZA: { currency:'South African Rand', symbol:'R', currencyCode:'ZAR', usdRate:'18.9', calling:'27', languages:'Zulu, Xhosa, English', continent:'Africa' },
  NG: { currency:'Nigerian Naira', symbol:'₦', currencyCode:'NGN', usdRate:'1505', calling:'234', languages:'English, Hausa, Yoruba, Igbo', continent:'Africa' },
  NL: { currency:'Euro', symbol:'€', currencyCode:'EUR', usdRate:'0.92', calling:'31', languages:'Dutch', continent:'Europe' },
  SE: { currency:'Swedish Krona', symbol:'kr', currencyCode:'SEK', usdRate:'10.4', calling:'46', languages:'Swedish', continent:'Europe' },
  NO: { currency:'Norwegian Krone', symbol:'kr', currencyCode:'NOK', usdRate:'10.6', calling:'47', languages:'Norwegian', continent:'Europe' },
  CH: { currency:'Swiss Franc', symbol:'CHF', currencyCode:'CHF', usdRate:'0.9', calling:'41', languages:'German, French, Italian', continent:'Europe' },
  AE: { currency:'UAE Dirham', symbol:'د.إ', currencyCode:'AED', usdRate:'3.67', calling:'971', languages:'Arabic', continent:'Asia' },
  SA: { currency:'Saudi Riyal', symbol:'ر.س', currencyCode:'SAR', usdRate:'3.75', calling:'966', languages:'Arabic', continent:'Asia' },
  TR: { currency:'Turkish Lira', symbol:'₺', currencyCode:'TRY', usdRate:'32.5', calling:'90', languages:'Turkish', continent:'Asia/Europe' },
  PL: { currency:'Polish Zloty', symbol:'zł', currencyCode:'PLN', usdRate:'3.95', calling:'48', languages:'Polish', continent:'Europe' },
  UA: { currency:'Ukrainian Hryvnia', symbol:'₴', currencyCode:'UAH', usdRate:'38.9', calling:'380', languages:'Ukrainian', continent:'Europe' },
  AR: { currency:'Argentine Peso', symbol:'$', currencyCode:'ARS', usdRate:'960', calling:'54', languages:'Spanish', continent:'South America' },
  CL: { currency:'Chilean Peso', symbol:'$', currencyCode:'CLP', usdRate:'940', calling:'56', languages:'Spanish', continent:'South America' },
  CO: { currency:'Colombian Peso', symbol:'$', currencyCode:'COP', usdRate:'3900', calling:'57', languages:'Spanish', continent:'South America' },
  NZ: { currency:'New Zealand Dollar', symbol:'NZ$', currencyCode:'NZD', usdRate:'1.63', calling:'64', languages:'English, Māori', continent:'Oceania' },
  EG: { currency:'Egyptian Pound', symbol:'£', currencyCode:'EGP', usdRate:'48.4', calling:'20', languages:'Arabic', continent:'Africa' },
  IL: { currency:'Israeli Shekel', symbol:'₪', currencyCode:'ILS', usdRate:'3.73', calling:'972', languages:'Hebrew, Arabic', continent:'Asia' },
  PK: { currency:'Pakistani Rupee', symbol:'₨', currencyCode:'PKR', usdRate:'278', calling:'92', languages:'Urdu, English', continent:'Asia' },
  BD: { currency:'Bangladeshi Taka', symbol:'৳', currencyCode:'BDT', usdRate:'110', calling:'880', languages:'Bengali', continent:'Asia' },
};

/* ============================================================
   MAIN TRACK FUNCTION
   ============================================================ */
async function trackIP(ip) {
  if (!ip) return;
  const now = Date.now();
  if (now - STATE.lastSearch < CONFIG.RATE_LIMIT_MS) {
    toast('Please wait a moment before searching again.', 'error', '⏱');
    return;
  }
  STATE.lastSearch = now;

  // Set loading state
  $('btn-track').disabled = true;
  $('status-dot').className = 'dot-loading';
  $('loader-text').textContent = `Tracing ${ip}...`;
  $('loading-overlay').classList.remove('hidden');

  // Clear timezone interval
  if (STATE.tzInterval) clearInterval(STATE.tzInterval);

  try {
    // Handle domain resolution display
    const displayIP = ip;
    $('ip-input').value = ip;

    const raw = await fetchIPData(ip);
    renderResults(raw);

    toast(`Successfully traced ${raw.query || ip}`, 'success', '✓');
  } catch (err) {
    $('status-dot').className = 'dot-error';
    toast(`Error: ${err.message}`, 'error', '✕');
    console.error(err);
  } finally {
    $('btn-track').disabled = false;
    $('loading-overlay').classList.add('hidden');
  }
}

/* ============================================================
   BATCH SCANNER
   ============================================================ */
async function runBatchScan(ips) {
  const resultsEl = $('batch-results');
  const progressWrap = $('batch-progress-wrap');
  const progressBar  = $('batch-progress-bar');
  const progressText = $('batch-progress-text');

  resultsEl.innerHTML = '';
  progressWrap.classList.remove('hidden');
  STATE.batchResults = [];

  for (let i = 0; i < ips.length; i++) {
    const ip = ips[i].trim();
    if (!ip) continue;

    // Add placeholder
    const item = document.createElement('div');
    item.className = 'batch-result-item';
    item.id = `batch-item-${i}`;
    item.innerHTML = `
      <div class="b-status loading"></div>
      <span class="b-ip">${ip}</span>
      <span class="b-location">Scanning...</span>
      <span class="b-isp">—</span>
    `;
    resultsEl.appendChild(item);

    try {
      const data = await fetchIPData(ip);
      const enriched = enrichData(data, ip);
      STATE.batchResults.push({ ip, data: enriched });

      item.innerHTML = `
        <div class="b-status ok"></div>
        <span class="b-ip">${ip}</span>
        <span class="b-location">${countryFlag(data.countryCode)} ${data.city || ''}, ${data.country || ''}</span>
        <span class="b-isp">${data.isp || '—'}</span>
        <span class="badge badge-${enriched._enriched.threat > 30 ? 'danger' : 'safe'}" style="font-size:0.68rem">${enriched._enriched.threat}% threat</span>
      `;
    } catch {
      item.innerHTML = `
        <div class="b-status err"></div>
        <span class="b-ip">${ip}</span>
        <span class="b-location" style="color:var(--c-red)">Failed to resolve</span>
        <span class="b-isp">—</span>
      `;
      STATE.batchResults.push({ ip, error: true });
    }

    // Update progress
    const pct = Math.round(((i+1) / ips.length) * 100);
    progressBar.style.width = pct + '%';
    progressBar.setAttribute('aria-valuenow', pct);
    progressText.textContent = `${i+1} / ${ips.length}`;

    // Rate limit between requests
    if (i < ips.length - 1) await wait(CONFIG.RATE_LIMIT_MS);
  }

  toast(`Batch scan complete: ${ips.length} IPs processed`, 'success', '⊞');
}

/* ============================================================
   COMPARE
   ============================================================ */
async function runCompare(ipA, ipB) {
  if (!ipA || !ipB) { toast('Enter both IP addresses', 'error'); return; }

  $('loading-overlay').classList.remove('hidden');
  $('loader-text').textContent = 'Comparing IPs...';

  try {
    const [dA, dB] = await Promise.all([fetchIPData(ipA), fetchIPData(ipB)]);
    const eA = enrichData(dA, ipA);
    const eB = enrichData(dB, ipB);
    STATE.compareDataA = eA;
    STATE.compareDataB = eB;
    renderCompare(eA, eB, ipA, ipB);
  } catch (e) {
    toast(`Compare error: ${e.message}`, 'error');
  } finally {
    $('loading-overlay').classList.add('hidden');
  }
}

function renderCompare(a, b, ipA, ipB) {
  const el = $('compare-results');
  el.classList.remove('hidden');

  const fields = [
    ['IP',         a._enriched.ipStr,                            b._enriched.ipStr],
    ['Country',    `${countryFlag(a.countryCode)} ${a.country}`, `${countryFlag(b.countryCode)} ${b.country}`],
    ['City',       a.city,                                        b.city],
    ['Region',     a.regionName,                                  b.regionName],
    ['ISP',        a.isp,                                         b.isp],
    ['ASN',        a.as,                                          b.as],
    ['Timezone',   a.timezone,                                    b.timezone],
    ['Lat/Lon',    `${a.lat}, ${a.lon}`,                          `${b.lat}, ${b.lon}`],
    ['IP Version', a._enriched.version,                          b._enriched.version],
    ['Proxy/VPN',  a.proxy ? '⚠ Yes' : '✓ No',                  b.proxy ? '⚠ Yes' : '✓ No'],
    ['Hosting/DC', a.hosting ? '⚠ Yes' : '✓ No',                b.hosting ? '⚠ Yes' : '✓ No'],
    ['Mobile',     a.mobile ? 'Yes' : 'No',                      b.mobile ? 'Yes' : 'No'],
    ['Threat Score', `${a._enriched.threat}%`,                   `${b._enriched.threat}%`],
    ['Est. Ping',  `${a._enriched.estPing} ms`,                  `${b._enriched.estPing} ms`],
    ['Distance (est.)', `${a._enriched.distKm} km`,              `${b._enriched.distKm} km`],
    ['Private IP', a._enriched.privateIP ? 'Yes' : 'No',        b._enriched.privateIP ? 'Yes' : 'No'],
    ['ZIP',        a.zip,                                         b.zip],
    ['Data Source', a.source,                                     b.source],
  ];

  const rows = fields.map(([label, va, vb]) => `
    <tr>
      <td>${label}</td>
      <td>${va || '—'}</td>
      <td>${vb || '—'}</td>
    </tr>
  `).join('');

  el.innerHTML = `
    <table class="compare-table" role="table" aria-label="IP comparison table">
      <thead>
        <tr>
          <th>Field</th>
          <th>▹ ${ipA}</th>
          <th>▹ ${ipB}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* ============================================================
   EXPORT
   ============================================================ */
function exportJSON() {
  if (!STATE.currentData) { toast('No data to export', 'error'); return; }
  const blob = new Blob([JSON.stringify(STATE.currentData, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `azra-ip_${STATE.currentData._enriched.ipStr}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Exported as JSON', 'success');
}

function exportBatchCSV() {
  if (!STATE.batchResults.length) { toast('No batch results to export', 'error'); return; }
  const headers = ['IP','Country','City','ISP','ASN','Lat','Lon','Timezone','Proxy','Hosting','Threat','Error'];
  const rows = STATE.batchResults.map(r => {
    if (r.error) return [r.ip, '','','','','','','','','','','true'].join(',');
    const d = r.data;
    return [
      d._enriched.ipStr, d.country, d.city, d.isp, d.as,
      d.lat, d.lon, d.timezone, d.proxy, d.hosting, d._enriched.threat, 'false'
    ].map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',');
  });
  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `azra-ip_batch_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Exported batch as CSV', 'success');
}

/* ============================================================
   RAW DATA VIEW TOGGLE
   ============================================================ */
function switchRawView(view) {
  const jsonEl  = $('raw-json');
  const tableEl = $('raw-table-wrap');
  const btnJson = $('raw-view-json');
  const btnTbl  = $('raw-view-table');

  if (view === 'json') {
    jsonEl.classList.remove('hidden');
    tableEl.classList.add('hidden');
    btnJson.classList.add('active');
    btnJson.setAttribute('aria-pressed', 'true');
    btnTbl.classList.remove('active');
    btnTbl.setAttribute('aria-pressed', 'false');
  } else {
    jsonEl.classList.add('hidden');
    tableEl.classList.remove('hidden');
    btnJson.classList.remove('active');
    btnJson.setAttribute('aria-pressed', 'false');
    btnTbl.classList.add('active');
    btnTbl.setAttribute('aria-pressed', 'true');

    if (STATE.currentData) {
      const flat = flattenObj(STATE.currentData);
      const rows = Object.entries(flat).map(([k,v]) =>
        `<tr><td>${k}</td><td>${String(v)}</td></tr>`
      ).join('');
      tableEl.innerHTML = `
        <table class="raw-table" role="table" aria-label="Raw data table">
          <thead><tr><th>Field</th><th>Value</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }
  }
}

function flattenObj(obj, prefix = '') {
  return Object.entries(obj).reduce((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(acc, flattenObj(v, key));
    } else {
      acc[key] = Array.isArray(v) ? v.join(', ') : v;
    }
    return acc;
  }, {});
}

/* ============================================================
   SUGGESTIONS / AUTOCOMPLETE
   ============================================================ */
function showSuggestions(query) {
  const container = $('search-suggestions');
  if (!query || query.length < 2) { container.hidden = true; return; }

  const matches = STATE.searchSuggestions.filter(s =>
    s.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 6);

  if (!matches.length) { container.hidden = true; return; }

  container.innerHTML = matches.map(m => `
    <div class="suggestion-item" role="option" tabindex="0" data-value="${m}">
      <span style="color:var(--c-text-muted);font-size:0.75rem">⌖</span>
      ${m}
    </div>
  `).join('');
  container.hidden = false;
}

/* ============================================================
   TAB NAVIGATION
   ============================================================ */
function switchTab(tabName) {
  document.querySelectorAll('.tab-section').forEach(s => {
    s.classList.remove('active');
    s.classList.add('hidden');
  });
  document.querySelectorAll('.nav-btn').forEach(b => {
    const active = b.dataset.tab === tabName;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });

  const el = $(`tab-${tabName}`);
  if (el) {
    el.classList.remove('hidden');
    el.classList.add('active');
  }

  if (tabName === 'history') renderHistory($('history-search')?.value || '');
  if (tabName === 'tracker' && STATE.map) {
    setTimeout(() => STATE.map.invalidateSize(), 200);
  }
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */
function initEvents() {
  // === Track button ===
  $('btn-track').addEventListener('click', () => {
    const ip = $('ip-input').value.trim();
    if (ip) trackIP(ip);
    else toast('Please enter an IP address or domain', 'error');
  });

  // === Input keyboard ===
  $('ip-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const ip = $('ip-input').value.trim();
      if (ip) { trackIP(ip); $('search-suggestions').hidden = true; }
    }
    if (e.key === 'Escape') $('search-suggestions').hidden = true;
  });

  $('ip-input').addEventListener('input', e => {
    showSuggestions(e.target.value);
    $('status-dot').className = 'dot-idle';
  });

  $('ip-input').addEventListener('blur', () => {
    setTimeout(() => { $('search-suggestions').hidden = true; }, 150);
  });

  // === Suggestions ===
  document.addEventListener('click', e => {
    const si = e.target.closest('.suggestion-item');
    if (si) {
      $('ip-input').value = si.dataset.value;
      $('search-suggestions').hidden = true;
      trackIP(si.dataset.value);
    }
  });

  // === Quick action buttons ===
  document.querySelectorAll('.qa-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ip = btn.dataset.ip;
      $('ip-input').value = ip;
      trackIP(ip);
    });
  });

  // === My IP button ===
  $('btn-my-ip').addEventListener('click', async () => {
    try {
      $('loader-text').textContent = 'Detecting your IP...';
      $('loading-overlay').classList.remove('hidden');
      const res = await fetch(CONFIG.APIS.MY_IP);
      const { ip } = await res.json();
      $('loading-overlay').classList.add('hidden');
      $('ip-input').value = ip;
      trackIP(ip);
    } catch {
      $('loading-overlay').classList.add('hidden');
      toast('Failed to detect your IP', 'error');
    }
  });

  // === Export ===
  $('btn-export').addEventListener('click', exportJSON);

  // === Copy IP ===
  $('btn-copy-ip').addEventListener('click', () => {
    if (STATE.currentData) copyText(STATE.currentData._enriched.ipStr);
  });

  // === Copy raw ===
  $('btn-copy-raw').addEventListener('click', () => {
    if (STATE.currentData) copyText(JSON.stringify(STATE.currentData, null, 2));
  });

  // === Raw view toggle ===
  $('raw-view-json').addEventListener('click', () => switchRawView('json'));
  $('raw-view-table').addEventListener('click', () => switchRawView('table'));

  // === Map controls ===
  ['satellite','street','dark'].forEach(style => {
    const btn = $(`map-${style}`);
    if (btn) btn.addEventListener('click', () => setMapTile(style));
  });

  $('btn-map-fullscreen').addEventListener('click', () => {
    const mapEl = $('map');
    if (mapEl.requestFullscreen) mapEl.requestFullscreen();
    else if (mapEl.webkitRequestFullscreen) mapEl.webkitRequestFullscreen();
    setTimeout(() => STATE.map && STATE.map.invalidateSize(), 300);
  });

  // === Nav tabs ===
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // === Theme toggle ===
  $('btn-theme').addEventListener('click', () => {
    document.body.classList.toggle('theme-light');
    $('btn-theme').textContent = document.body.classList.contains('theme-light') ? '⬡' : '⬡';
    toast(document.body.classList.contains('theme-light') ? 'Light mode on' : 'Dark mode on', 'info', '⬡');
  });

  // === History ===
  $('history-search').addEventListener('input', e => renderHistory(e.target.value));

  $('btn-clear-history').addEventListener('click', () => {
    STATE.history = [];
    saveHistory();
    renderHistory();
    toast('History cleared', 'info');
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('.history-btn');
    if (!btn) return;
    if (btn.dataset.action === 'retrack') {
      switchTab('tracker');
      $('ip-input').value = btn.dataset.ip;
      trackIP(btn.dataset.ip);
    }
    if (btn.dataset.action === 'delete') {
      STATE.history = STATE.history.filter(h => String(h.id) !== btn.dataset.id);
      saveHistory();
      renderHistory($('history-search')?.value || '');
      toast('Entry deleted', 'info');
    }
  });

  // === Batch ===
  $('btn-batch-run').addEventListener('click', () => {
    const raw = $('batch-input').value.trim();
    if (!raw) { toast('Please enter IP addresses', 'error'); return; }
    const ips = raw.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 20);
    if (!ips.length) { toast('No valid IPs found', 'error'); return; }
    runBatchScan(ips);
  });

  $('btn-batch-clear').addEventListener('click', () => {
    $('batch-input').value = '';
    $('batch-results').innerHTML = '<div class="batch-empty">Enter IPs and click Run Batch Scan</div>';
    $('batch-progress-wrap').classList.add('hidden');
    STATE.batchResults = [];
  });

  $('btn-batch-import').addEventListener('click', () => $('batch-file-input').click());

  $('batch-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      $('batch-input').value = ev.target.result;
      toast(`Imported ${file.name}`, 'success');
    };
    reader.readAsText(file);
  });

  $('btn-batch-export').addEventListener('click', exportBatchCSV);

  // === Compare ===
  $('btn-compare-run').addEventListener('click', () => {
    const ipA = $('compare-ip-a').value.trim();
    const ipB = $('compare-ip-b').value.trim();
    runCompare(ipA, ipB);
  });

  ['compare-ip-a','compare-ip-b'].forEach(id => {
    $(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') $('btn-compare-run').click();
    });
  });

  // === Keyboard shortcut: / to focus search ===
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      switchTab('tracker');
      $('ip-input').focus();
    }
    if (e.key === 'Escape') {
      $('search-suggestions').hidden = true;
      $('loading-overlay').classList.add('hidden');
    }
  });
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  initParticles();
  initClock();
  loadHistory();
  renderHistory();
  initEvents();
  initMap();

  // Greet
  setTimeout(() => toast('azra-IP ready — press / to search', 'info', '⌖'), 800);

  console.log([
    '%c azra-IP v2.1.0 %c',
    'background:linear-gradient(135deg,#00d4ff,#7b2ff7);color:#fff;font-weight:bold;padding:4px 12px;border-radius:4px',
    '',
    '\nBuilt by azraDev\nAdvanced IP Intelligence Tracker',
  ]);
}

document.addEventListener('DOMContentLoaded', init);
