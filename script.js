(() => {
  'use strict';

  const YEAR = 2026;
  const TOTAL = 24;
  const DOOR_ASPECT = 3 / 4; // door photos are portrait

  const doorSrc = (n) => `images/doors/door-${n}.jpg`;
  const heartSrc = (n) => `images/hearts/heart-${n}.jpg`;

  // ?reset clears everything this site stored in the browser (opened doors,
  // intro seen) and then removes the parameter from the URL again.
  const params = new URLSearchParams(location.search);
  if (params.has('reset')) {
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith(`advent-${YEAR}-`))
        .forEach((key) => localStorage.removeItem(key));
    } catch { /* storage unavailable */ }
    params.delete('reset');
    const query = params.toString();
    history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash);
  }

  const calendar = document.getElementById('calendar');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const toast = document.getElementById('toast');
  const spinner = document.getElementById('spinner');

  // ---------- holly garland frames ----------
  // Every .gframe gets one continuous holly branch drawn around it as an SVG,
  // with rounded corners. An optional .gf-title child sits in a gap at the top.
  // The garland is redrawn whenever the frame changes size.

  // ---------- visible viewport height ----------
  // Mobile browsers count the area behind their address/tool bars in 100vh.
  // Measure what is really visible so the page and modals fit and center.
  const setAppHeight = () => {
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-h', `${Math.round(h)}px`);
  };
  setAppHeight();
  (window.visualViewport || window).addEventListener('resize', setAppHeight);
  window.addEventListener('orientationchange', setAppHeight);

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Small deterministic random so leaves don't change on every redraw.
  const rand = (i) => {
    const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  // Shared gradients (glossy holly leaves, shiny red berries), defined once.
  document.body.insertAdjacentHTML('afterbegin', `
    <svg width="0" height="0" style="position:absolute" aria-hidden="true">
      <defs>
        <linearGradient id="holly-1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3f8f4a"/><stop offset=".5" stop-color="#1f6a32"/><stop offset="1" stop-color="#0c3d1d"/>
        </linearGradient>
        <linearGradient id="holly-2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#4f9c55"/><stop offset=".5" stop-color="#2a7a3b"/><stop offset="1" stop-color="#124a24"/>
        </linearGradient>
        <linearGradient id="holly-3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2f7a40"/><stop offset=".5" stop-color="#175a2a"/><stop offset="1" stop-color="#083016"/>
        </linearGradient>
        <radialGradient id="holly-berry" cx="35%" cy="32%" r="70%">
          <stop offset="0" stop-color="#ff7a6e"/><stop offset=".3" stop-color="#e01b24"/><stop offset=".8" stop-color="#9c0a14"/><stop offset="1" stop-color="#5e0309"/>
        </radialGradient>
      </defs>
    </svg>`);

  // Holly leaf outline in unit size (base at 0,0, tip at 1,0): spiky,
  // scalloped edges. Scaled per leaf.
  const HOLLY_LEAF = (() => {
    const h = (x) => 0.27 * Math.pow(Math.sin(Math.PI * x), 0.75);
    const f = (n) => n.toFixed(3);
    const side = (spikes, sign) => {
      let d = '';
      let prev = 0;
      spikes.forEach((x, i) => {
        const mid = (prev + x) / 2;
        const cy = i === 0 ? sign * 0.1 : sign * h(mid) * 0.5;   // concave scallop
        d += ` Q${f(mid)} ${f(cy)} ${f(x + 0.03)} ${f(sign * h(x) * 1.12)}`; // spike point
        prev = x;
      });
      d += ` Q${f(0.92)} ${f(sign * h(0.9) * 0.45)} 1 0`;                 // to the tip
      return d;
    };
    const upper = side([0.17, 0.39, 0.61, 0.81], -1);
    // lower side: same idea, drawn from the tip back to the base
    const lowerSpikes = [0.79, 0.58, 0.37, 0.16];
    let lower = '';
    let prev = 1;
    lowerSpikes.forEach((x, i) => {
      const mid = (prev + x) / 2;
      const cy = i === 0 ? h(0.9) * 0.45 : h(mid) * 0.5;
      lower += ` Q${f(mid)} ${f(cy)} ${f(x - 0.02)} ${f(h(x) * 1.12)}`;
      prev = x;
    });
    lower += ` Q${f(0.05)} 0.1 0 0`;
    return `M0 0${upper}${lower}Z`;
  })();

  function drawGarland(frame, svg) {
    const W = frame.clientWidth;
    const H = frame.clientHeight;
    if (!W || !H) return;
    // --g may be a clamp(); the first grid column has its resolved pixel size
    const g = parseFloat(getComputedStyle(frame).gridTemplateColumns) || 60;

    const s = g * 0.42;            // stem distance from the outer edge
    const r = g * 0.7;             // corner radius
    const L = s, T = s, R = W - s, B = H - s;

    // Gap for the title in the top edge
    const title = frame.querySelector(':scope > .gf-title');
    let d;
    if (title && title.offsetWidth) {
      const pad = g * 0.2;
      const gapL = Math.max(L + r, title.offsetLeft - pad);
      const gapR = Math.min(R - r, title.offsetLeft + title.offsetWidth + pad);
      d = `M${gapR} ${T} H${R - r} A${r} ${r} 0 0 1 ${R} ${T + r} V${B - r} A${r} ${r} 0 0 1 ${R - r} ${B} ` +
          `H${L + r} A${r} ${r} 0 0 1 ${L} ${B - r} V${T + r} A${r} ${r} 0 0 1 ${L + r} ${T} H${gapL}`;
    } else {
      d = `M${L + r} ${T} H${R - r} A${r} ${r} 0 0 1 ${R} ${T + r} V${B - r} A${r} ${r} 0 0 1 ${R - r} ${B} ` +
          `H${L + r} A${r} ${r} 0 0 1 ${L} ${B - r} V${T + r} A${r} ${r} 0 0 1 ${L + r} ${T} Z`;
    }

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';
    const stem = document.createElementNS(SVG_NS, 'path');
    stem.setAttribute('d', d);
    stem.setAttribute('class', 'stem');
    stem.setAttribute('stroke-width', (g * 0.04).toFixed(2));
    svg.appendChild(stem);

    const total = stem.getTotalLength();
    const step = g * 0.24;
    const count = Math.max(1, Math.round(total / step));
    const gap = total / count;
    let leaves = '';
    let berries = '';

    for (let i = 0; i < count; i++) {
      const at = (i + 0.5) * gap;
      const p = stem.getPointAtLength(at);
      const p1 = stem.getPointAtLength(Math.max(0, at - 1));
      const p2 = stem.getPointAtLength(Math.min(total, at + 1));
      const tangent = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const deg = tangent * 180 / Math.PI;
      const side = i % 2 ? 1 : -1;
      const angle = deg + side * (42 + rand(i) * 24);
      const len = g * (0.42 + rand(i + 100) * 0.14);
      const fill = `url(#holly-${1 + Math.floor(rand(i + 200) * 3)})`;
      const t = `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle.toFixed(0)}) scale(${len.toFixed(1)})`;
      leaves +=
        `<path transform="${t}" d="${HOLLY_LEAF}" fill="${fill}" class="leaf"/>` +
        `<path transform="${t}" d="M0.04 0 Q0.5 -0.02 0.94 0" class="rib"/>`;

      // A cluster of red berries every few leaves
      if (i % 6 === 2) {
        const br = g * 0.072;
        const n = 3 + Math.floor(rand(i + 300) * 3);           // 3–5 berries
        const nx = -Math.sin(tangent), ny = Math.cos(tangent);  // normal to the stem
        const off = g * 0.05 * (rand(i + 400) > 0.5 ? 1 : -1);
        const cx = p.x + nx * off, cy = p.y + ny * off;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + rand(i + k) * 0.6;
          const dist = n === 3 ? br * 0.95 : br * 1.15;
          const x = cx + Math.cos(a) * dist;
          const y = cy + Math.sin(a) * dist;
          berries +=
            `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${br.toFixed(1)}" fill="url(#holly-berry)"/>` +
            `<ellipse cx="${(x - br * .35).toFixed(1)}" cy="${(y - br * .38).toFixed(1)}" rx="${(br * .28).toFixed(1)}" ry="${(br * .18).toFixed(1)}" fill="rgba(255,255,255,.65)"/>` +
            `<circle cx="${(x + br * .2).toFixed(1)}" cy="${(y + br * .25).toFixed(1)}" r="${(br * .12).toFixed(1)}" fill="#3b1a10"/>`;
        }
      }
    }
    svg.insertAdjacentHTML('beforeend', leaves + berries);
  }

  document.querySelectorAll('.gframe').forEach((frame) => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'garland');
    svg.setAttribute('aria-hidden', 'true');
    frame.prepend(svg);

    // Drawing only touches the absolutely positioned SVG, so it can't
    // change the frame's size and re-trigger the observer.
    const redraw = () => drawGarland(frame, svg);
    redraw();
    // Images inside the frame (e.g. the heart photo) change its size once loaded
    frame.querySelectorAll('img').forEach((img) => img.addEventListener('load', redraw));
    if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(frame);
    else window.addEventListener('resize', redraw);
    if (document.fonts) document.fonts.ready.then(redraw); // title width changes once the font loads
  });

  // ---------- date logic ----------
  // Testing: append ?day=5 to the URL to simulate December 5th.

  function getToday() {
    const params = new URLSearchParams(location.search);
    const day = parseInt(params.get('day'), 10);
    if (day >= 1 && day <= 31) return new Date(YEAR, 11, day);
    return new Date();
  }

  const today = getToday();
  const inDecember = today.getFullYear() === YEAR && today.getMonth() === 11;

  // Number of doors that may be opened.
  let unlocked;
  if (today.getFullYear() > YEAR) unlocked = TOTAL;
  else if (inDecember) unlocked = Math.min(today.getDate(), TOTAL);
  else unlocked = 0;

  // The door that glows gold (only on Dec 1–24).
  const goldDay = inDecember && today.getDate() <= TOTAL ? today.getDate() : null;

  // ---------- random order (new on every page load) ----------

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------- layout: choose columns × rows that best fit the viewport ----------

  function layout() {
    const w = calendar.clientWidth;
    const h = calendar.clientHeight;
    let best = { cols: 6, rows: 4, score: Infinity };
    for (let cols = 1; cols <= TOTAL; cols++) {
      if (TOTAL % cols) continue; // only layouts without empty cells
      const rows = TOTAL / cols;
      const cellAspect = (w / cols) / (h / rows);
      const score = Math.abs(Math.log(cellAspect / DOOR_ASPECT));
      if (score < best.score) best = { cols, rows, score };
    }
    calendar.style.setProperty('--cols', best.cols);
    calendar.style.setProperty('--rows', best.rows);
  }

  // ---------- revealed doors (remembered per visitor) ----------

  const STORAGE_OPENED = `advent-${YEAR}-opened`;
  let opened;
  try { opened = new Set(JSON.parse(localStorage.getItem(STORAGE_OPENED)) || []); }
  catch { opened = new Set(); }

  // ---------- build ----------

  function createDoor(n) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'door';
    btn.dataset.day = n;

    const isUnlocked = n <= unlocked;
    if (!isUnlocked) btn.classList.add('locked');
    else btn.classList.add('available');
    if (n === goldDay) btn.classList.add('today');

    btn.setAttribute('aria-label', `Door ${n}${isUnlocked ? '' : ' (locked)'}`);

    const revealed = isUnlocked && opened.has(n);
    btn.innerHTML = `<img src="${revealed ? heartSrc(n) : doorSrc(n)}" alt="" decoding="async">`;
    if (revealed) btn.classList.add('open');

    // Preload today's heart so it pops up instantly.
    if (n === goldDay) preloadHeart(n);

    btn.addEventListener('click', () => onDoorClick(btn, n));
    // Start loading the heart as soon as the pointer is on an unlocked door
    if (isUnlocked) btn.addEventListener('pointerenter', () => preloadHeart(n), { once: true });
    return btn;
  }

  function onDoorClick(btn, n) {
    if (n > unlocked) {
      btn.classList.remove('nope');
      void btn.offsetWidth; // restart animation
      btn.classList.add('nope');
      showToast(lockedMessage(n));
      return;
    }

    // Reveal the heart in place of the door and remember it.
    if (!btn.classList.contains('open')) {
      btn.classList.add('open');
      btn.querySelector('img').src = heartSrc(n);
      opened.add(n);
      try { localStorage.setItem(STORAGE_OPENED, JSON.stringify([...opened])); } catch { /* ignore */ }
    }

    openLightbox(n);
  }

  function lockedMessage(n) {
    if (today.getFullYear() < YEAR || (today.getFullYear() === YEAR && today.getMonth() < 11)) {
      return `Patience! Door ${n} opens on December ${n}.`;
    }
    const days = n - unlocked;
    return `Door ${n} opens in ${days} day${days === 1 ? '' : 's'}.`;
  }

  // ---------- lightbox ----------

  // Load the new heart first, then swap it in and open the modal, so the
  // previously shown heart never flashes up.
  const heartCache = new Map();
  function preloadHeart(n) {
    if (!heartCache.has(n)) {
      const img = new Image();
      img.src = heartSrc(n);
      const ready = img.decode ? img.decode() : new Promise((res) => { img.onload = res; img.onerror = res; });
      heartCache.set(n, ready.catch(() => {}));
    }
    return heartCache.get(n);
  }

  let lightboxRequest = 0;
  let spinnerTimer;
  const hideSpinner = () => { clearTimeout(spinnerTimer); spinner.classList.remove('show'); };

  function openLightbox(n) {
    const request = ++lightboxRequest;
    const src = heartSrc(n);

    // Only show the spinner if loading takes noticeably long
    clearTimeout(spinnerTimer);
    spinnerTimer = setTimeout(() => spinner.classList.add('show'), 150);

    preloadHeart(n).then(() => {
      if (request !== lightboxRequest) return; // another door was clicked meanwhile
      hideSpinner();
      lightboxImg.src = src;
      lightboxImg.alt = `Heart behind door ${n}`;
      lightboxCaption.textContent = `December ${n}`;
      if (lightbox.hasAttribute('open')) return;
      if (typeof lightbox.showModal === 'function') lightbox.showModal();
      else lightbox.setAttribute('open', '');
    });
  }

  function closeLightbox() {
    lightboxRequest++; // cancel a heart that is still loading
    hideSpinner();
    if (typeof lightbox.close === 'function') lightbox.close();
    else lightbox.removeAttribute('open');
  }

  lightbox.addEventListener('click', closeLightbox);
  spinner.addEventListener('click', closeLightbox); // tap to cancel loading
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.hasAttribute('open')) closeLightbox();
  });

  // ---------- toast ----------

  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  // ---------- intro (first visit only) ----------

  const STORAGE_INTRO = `advent-${YEAR}-intro-seen`;
  const intro = document.getElementById('intro');
  let introSeen = false;
  try { introSeen = localStorage.getItem(STORAGE_INTRO) === '1'; } catch { /* ignore */ }
  // ?intro in the URL always shows the intro (handy for testing).
  if (new URLSearchParams(location.search).has('intro')) introSeen = false;
  if (!introSeen && typeof intro.showModal === 'function') {
    const snow = intro.querySelector('.snow');
    for (let i = 0; i < 45; i++) {
      const f = document.createElement('span');
      f.className = 'flake';
      f.textContent = Math.random() < 0.3 ? '❄' : '•';
      f.style.left = `${Math.random() * 100}%`;
      f.style.setProperty('--s', `${6 + Math.random() * 14}px`);
      f.style.setProperty('--o', (0.4 + Math.random() * 0.6).toFixed(2));
      f.style.setProperty('--d', `${8 + Math.random() * 10}s`);
      f.style.setProperty('--delay', `${-Math.random() * 18}s`);
      f.style.setProperty('--drift', `${-30 + Math.random() * 60}px`);
      snow.appendChild(f);
    }
    intro.addEventListener('close', () => {
      try { localStorage.setItem(STORAGE_INTRO, '1'); } catch { /* ignore */ }
    });
    intro.showModal();
  }

  // ---------- init ----------

  const fragment = document.createDocumentFragment();
  shuffle(Array.from({ length: TOTAL }, (_, i) => i + 1)).forEach((n) => fragment.appendChild(createDoor(n)));
  calendar.appendChild(fragment);

  layout();
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(calendar);
  else window.addEventListener('resize', layout);

  // Reload at midnight so the next door starts glowing without a manual refresh.
  const midnight = new Date();
  midnight.setHours(24, 0, 5, 0);
  if (!new URLSearchParams(location.search).has('day')) {
    setTimeout(() => location.reload(), midnight - new Date());
  }
})();
