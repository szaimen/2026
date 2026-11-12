(() => {
  'use strict';

  const YEAR = 2026;
  const TOTAL = 24;
  const DOOR_ASPECT = 3 / 4; // door photos are portrait

  const doorSrc = (n) => `images/doors/door-${n}.jpg`;
  const heartSrc = (n) => `images/hearts/heart-${n}.jpg`;

  const calendar = document.getElementById('calendar');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const toast = document.getElementById('toast');

  // ---------- plant garland frames ----------
  // Every .gframe gets one continuous branch drawn around it as an SVG,
  // with rounded corners. An optional .gf-title child sits in a gap at the top.
  // The garland is redrawn whenever the frame changes size.

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const LEAF_COLORS = ['#1f6b34', '#2e8b45', '#3fa45a', '#6cbf4f', '#1a5a2c'];
  const BERRIES = [['#f7d44c', '#f7d44c'], ['#3d7bd9', '#5b9cff']];

  // Small deterministic random so leaves don't change on every redraw.
  const rand = (i) => {
    const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

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
    stem.setAttribute('stroke-width', (g * 0.035).toFixed(2));
    svg.appendChild(stem);

    const total = stem.getTotalLength();
    const step = g * 0.2;
    const count = Math.max(1, Math.round(total / step));
    const gap = total / count;
    let leaves = '';
    let berries = '';

    for (let i = 0; i < count; i++) {
      const at = (i + 0.5) * gap;
      const p = stem.getPointAtLength(at);
      const p1 = stem.getPointAtLength(Math.max(0, at - 1));
      const p2 = stem.getPointAtLength(Math.min(total, at + 1));
      const tangent = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
      const side = i % 2 ? 1 : -1;
      const angle = tangent + side * (45 + rand(i) * 20);
      const len = g * (0.34 + rand(i + 100) * 0.14);
      const color = LEAF_COLORS[Math.floor(rand(i + 200) * LEAF_COLORS.length)];
      const t = `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle.toFixed(0)})`;
      leaves +=
        `<path transform="${t}" d="M0 0 Q${len * .45} ${-len * .32} ${len} 0 Q${len * .45} ${len * .32} 0 0Z" fill="${color}"/>` +
        `<path transform="${t}" d="M1 0 L${len * .85} 0" class="vein"/>`;

      // A pair of berries every few leaves, alternating yellow and blue
      if (i % 7 === 3) {
        const [c1, c2] = BERRIES[Math.floor(i / 7) % 2];
        const br = g * 0.055;
        const n = (tangent + 90) * Math.PI / 180;
        const off = g * 0.1 * (rand(i + 300) > 0.5 ? 1 : -1);
        [[c1, -br * 1.1], [c2, br * 1.1]].forEach(([c, shift]) => {
          const tx = Math.cos(tangent * Math.PI / 180) * shift;
          const ty = Math.sin(tangent * Math.PI / 180) * shift;
          const x = p.x + Math.cos(n) * off + tx;
          const y = p.y + Math.sin(n) * off + ty;
          berries +=
            `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${br.toFixed(1)}" fill="${c}"/>` +
            `<circle cx="${(x - br * .3).toFixed(1)}" cy="${(y - br * .33).toFixed(1)}" r="${(br * .3).toFixed(1)}" fill="rgba(255,255,255,.7)"/>`;
        });
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
    if (n === goldDay) new Image().src = heartSrc(n);

    btn.addEventListener('click', () => onDoorClick(btn, n));
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
  let lightboxRequest = 0;
  function openLightbox(n) {
    const request = ++lightboxRequest;
    const src = heartSrc(n);
    const preload = new Image();
    preload.src = src;
    const ready = preload.decode ? preload.decode() : new Promise((res) => { preload.onload = res; });

    ready.catch(() => {}).then(() => {
      if (request !== lightboxRequest) return; // another door was clicked meanwhile
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
    if (typeof lightbox.close === 'function') lightbox.close();
    else lightbox.removeAttribute('open');
  }

  lightbox.addEventListener('click', closeLightbox);
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
