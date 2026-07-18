/**
 * SNIP SNAP! // Gesture Retro Film Camera
 * Unified Single File Coordinator (No imports/exports)
 */

// ─── 1. State System ────────────────────────────────────────────────
const state = {
  systemInitialized: false,
  isMirrorActive: true,
  isHudActive: true,
  isTrackingActive: true,
  isFraming: false,
  wasFraming: false,
  photos: [],
  maxPhotos: 36,
  frameCounter: 1,
  hands: [],
  foldedTriggered: { left: false, right: false },
  audioCtx: null,
  activeTheme: 'classic',
  lastSnapTime: 0,
  smoothedRect: null,
  focusProgress: 0.0,
  collageLayout: 'grid',
  popupOpen: false,
  popupClosing: false,
  rollOpen: false,
  loopStarted: false,
  framingStartTime: 0,
  framingStableDuration: 0
};

// ─── 2. DOM Elements (Lazy Getters) ──────────────────────────────────
const elements = {
  get webcam() { return document.getElementById('webcam'); },
  get canvas() { return document.getElementById('viewfinder-canvas'); },
  get hudOverlay() { return document.querySelector('.hud-overlay'); },
  get shutterFlash() { return document.getElementById('shutter-flash'); },
  get filmStrip() { return document.getElementById('film-strip'); },
  get filmPlaceholder() { return document.getElementById('film-placeholder'); },
  get photoCount() { return document.getElementById('photo-count'); },
  get btnClearFilm() { return document.getElementById('btn-clear-film'); },
  get btnToggleHud() { return document.getElementById('btn-toggle-hud'); },
  get btnToggleLandmarks() { return document.getElementById('btn-toggle-landmarks'); },
  get btnToggleMirror() { return document.getElementById('btn-toggle-mirror'); },
  get polaroidModal() { return document.getElementById('polaroid-modal'); },
  get polaroidCard() { return document.getElementById('polaroid-card'); },
  get polaroidImg() { return document.getElementById('polaroid-img'); },
  get polaroidCaption() { return document.getElementById('polaroid-caption'); },
  get polaroidDate() { return document.getElementById('polaroid-date'); },
  get polaroidTime() { return document.getElementById('polaroid-time'); },
  get btnPolaroidShare() { return document.getElementById('btn-polaroid-share'); },
  get polaroidShareMenu() { return document.getElementById('polaroid-share-menu'); },
  get btnPolaroidClose() { return document.getElementById('btn-polaroid-close'); },
  get btnToggleRoll() { return document.getElementById('btn-toggle-roll'); },
  get btnRollBadge() { return document.getElementById('btn-roll-badge'); },
  get floatingRollTray() { return document.getElementById('floating-roll-tray'); },
  get btnCameraToggle() { return document.getElementById('btn-camera-toggle'); },
  get btnToggleInfo() { return document.getElementById('btn-toggle-info'); },
  get infoTooltip() { return document.getElementById('info-tooltip'); },
  get btnCollage() { return document.getElementById('btn-collage'); },
  get collageModal() { return document.getElementById('collage-modal'); },
  get collageCanvas() { return document.getElementById('collage-preview-canvas'); },
  get btnCollageShare() { return document.getElementById('btn-collage-share'); },
  get collageShareMenu() { return document.getElementById('collage-share-menu'); },
  get btnCollageClose() { return document.getElementById('btn-collage-close'); },
  get collageTitleInput() { return document.getElementById('collage-title-input'); },
  get popup() { return document.getElementById('snapshot-popup'); },
  get popupGrid() { return document.getElementById('popup-grid'); },
  get btnPopupDownload() { return document.getElementById('btn-popup-download'); },
  get btnPopupClose() { return document.getElementById('btn-popup-close'); }
};

let ctx = null;
function getCtx() {
  if (!ctx && elements.canvas) {
    ctx = elements.canvas.getContext('2d');
  }
  return ctx;
}

// ─── 3. Audio Synthesizer ───────────────────────────────────────────
function initAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playFocusBeep() {
  if (!state.audioCtx) return;
  const now = state.audioCtx.currentTime;
  for (let i = 0; i < 2; i++) {
    const osc = state.audioCtx.createOscillator();
    const g = state.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 2000;
    g.gain.setValueAtTime(0.08, now + i * 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.06);
    osc.connect(g).connect(state.audioCtx.destination);
    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.08);
  }
}

function playShutterSound() {
  if (!state.audioCtx) return;
  const now = state.audioCtx.currentTime;
  
  const osc = state.audioCtx.createOscillator();
  const og = state.audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(100, now);
  osc.frequency.exponentialRampToValueAtTime(20, now + 0.08);
  og.gain.setValueAtTime(0.4, now);
  og.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
  osc.connect(og).connect(state.audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.08);
  
  const buf = state.audioCtx.createBuffer(1, (state.audioCtx.sampleRate * 0.12) | 0, state.audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = state.audioCtx.createBufferSource();
  src.buffer = buf;
  const filt = state.audioCtx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 1200;
  filt.Q.value = 3;
  const ng = state.audioCtx.createGain();
  ng.gain.setValueAtTime(0.6, now);
  ng.gain.exponentialRampToValueAtTime(0.005, now + 0.12);
  src.connect(filt).connect(ng).connect(state.audioCtx.destination);
  src.start(now);
  src.stop(now + 0.12);
}

function playTickSound() {
  if (!state.audioCtx) return;
  const now = state.audioCtx.currentTime;
  const osc = state.audioCtx.createOscillator();
  const g = state.audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 1000;
  g.gain.setValueAtTime(0.015, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
  osc.connect(g).connect(state.audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.02);
}

function playConfirmBeep() {
  if (!state.audioCtx) return;
  const now = state.audioCtx.currentTime;
  const freqs = [1500, 2200];
  for (let i = 0; i < 2; i++) {
    const osc = state.audioCtx.createOscillator();
    const g = state.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freqs[i];
    g.gain.setValueAtTime(0.08, now + i * 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.06);
    osc.connect(g).connect(state.audioCtx.destination);
    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.08);
  }
}

// ─── 4. Mathematics & Geometry ─────────────────────────────────────
function dist2dSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * t;
}

function lineIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1x = bx - ax, d1y = by - ay;
  const d2x = dx - cx, d2y = dy - cy;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-8) return null;
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / denom;
  return { x: ax + t * d1x, y: ay + t * d1y };
}

function detectLGesture(lm) {
  const palmSq = dist2dSq(lm[0], lm[9]);
  if (palmSq < 0.0001) return false;
  const wrist = lm[0];
  const isIndexExt  = dist2dSq(lm[8], wrist) > dist2dSq(lm[6], wrist);
  const isThumbExt  = dist2dSq(lm[4], wrist) > dist2dSq(lm[3], wrist);
  const isMiddleCurled = dist2dSq(lm[12], wrist) < dist2dSq(lm[10], wrist);
  const isRingCurled   = dist2dSq(lm[16], wrist) < dist2dSq(lm[14], wrist);
  const isPinkyCurled  = dist2dSq(lm[20], wrist) < dist2dSq(lm[18], wrist);
  return isIndexExt && isThumbExt && isMiddleCurled && isRingCurled && isPinkyCurled;
}

function detectIndexFold(lm) {
  const palmSq = dist2dSq(lm[0], lm[9]);
  if (palmSq < 0.0001) return false;
  const wrist = lm[0];
  const isIndexFolded = dist2dSq(lm[8], lm[5]) < palmSq * 0.45;
  const isThumbExt  = dist2dSq(lm[4], wrist) > dist2dSq(lm[3], wrist);
  const isMiddleCurled = dist2dSq(lm[12], wrist) < dist2dSq(lm[10], wrist);
  const isRingCurled   = dist2dSq(lm[16], wrist) < dist2dSq(lm[14], wrist);
  const isPinkyCurled  = dist2dSq(lm[20], wrist) < dist2dSq(lm[18], wrist);
  return isIndexFolded && isThumbExt && isMiddleCurled && isRingCurled && isPinkyCurled;
}

function detectThumbsUp(lm) {
  const wrist = lm[0];
  const palmSq = dist2dSq(lm[0], lm[9]);
  if (palmSq < 0.0001) return false;
  const isIndexCurled  = dist2dSq(lm[8], lm[5]) < palmSq * 0.65;
  const isMiddleCurled = dist2dSq(lm[12], lm[9]) < palmSq * 0.65;
  const isRingCurled   = dist2dSq(lm[16], lm[13]) < palmSq * 0.65;
  const isPinkyCurled  = dist2dSq(lm[20], lm[17]) < palmSq * 0.65;
  const isThumbExt = dist2dSq(lm[4], wrist) > dist2dSq(lm[2], wrist) * 1.35;
  const isThumbPointingUp = lm[4].y < lm[3].y && lm[3].y < lm[2].y;
  const isHigherThanKnuckles = lm[4].y < lm[5].y && lm[4].y < lm[9].y && lm[4].y < lm[13].y;
  return isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled && isThumbExt && isThumbPointingUp && isHigherThanKnuckles;
}

function getLCorner(lm, cw, ch) {
  const p2 = { x: lm[2].x * cw, y: lm[2].y * ch };
  const p4 = { x: lm[4].x * cw, y: lm[4].y * ch };
  const p5 = { x: lm[5].x * cw, y: lm[5].y * ch };
  const p8 = { x: lm[8].x * cw, y: lm[8].y * ch };
  const pt = lineIntersect(p2.x, p2.y, p4.x, p4.y, p5.x, p5.y, p8.x, p8.y);
  const p0 = { x: lm[0].x * cw, y: lm[0].y * ch };
  const p9 = { x: lm[9].x * cw, y: lm[9].y * ch };
  const palmDist = Math.sqrt(dist2dSq(p0, p9));
  if (pt) {
    const distSq = dist2dSq(pt, p5);
    if (distSq < (palmDist * 2.5) * (palmDist * 2.5)) return pt;
  }
  return { x: (p2.x + p5.x) * 0.5, y: (p2.y + p5.y) * 0.5 };
}

// ─── Frame Estimation ────────────────────────────────────────────────
// Constants for smoothing and outlier rejection
const FRAME_SMOOTH = {
  center: 0.10,  // position EMA weight
  size:   0.07,  // width/height EMA weight
  angle:  0.05   // rotation EMA weight (most aggressive)
};
const FRAME_MAX_DELTA = {
  centerPx:  150,   // max pixel jump per frame before rejection
  sizeRatio: 0.35,  // max fractional size change per frame
  angleRad:  0.40   // max rotation jump per frame (~23°)
};

/**
 * Step 2-5: Estimate raw frame parameters from two detected L-hands.
 * Returns { cx, cy, width, height, theta } or null if estimation fails.
 * Does NOT build the rectangle — that is done in buildRect().
 */
function estimateFrameParams(cw, ch, hands) {
  const active = hands.filter(h => h.isL || h.isFolded);
  if (active.length < 2) return null;

  const lm0 = active[0].landmarks;
  const lm1 = active[1].landmarks;

  // ── Step 2: Frame Center ─────────────────────────────────────────
  // Average all key landmarks from both hands for a stable centroid
  const KEY = [0, 4, 5, 8]; // wrist, thumb-tip, index-MCP, index-tip
  let cx = 0, cy = 0;
  for (const lm of [lm0, lm1]) {
    for (const i of KEY) { cx += lm[i].x * cw; cy += lm[i].y * ch; }
  }
  cx /= KEY.length * 2;
  cy /= KEY.length * 2;

  // ── Step 3: Frame Rotation ───────────────────────────────────────
  // Use wrist→index-MCP direction (proximal knuckle, more stable than tip)
  const d0x = lm0[5].x * cw - lm0[0].x * cw;
  const d0y = lm0[5].y * ch - lm0[0].y * ch;
  const d1x = lm1[5].x * cw - lm1[0].x * cw;
  const d1y = lm1[5].y * ch - lm1[0].y * ch;
  const len0 = Math.sqrt(d0x*d0x + d0y*d0y);
  const len1 = Math.sqrt(d1x*d1x + d1y*d1y);
  if (len0 < 5 || len1 < 5) return null;

  let n0x = d0x / len0, n0y = d0y / len0;
  let n1x = d1x / len1, n1y = d1y / len1;
  // Align n1 to n0 direction (prevent cancellation when hands face opposite)
  if (n0x*n1x + n0y*n1y < 0) { n1x = -n1x; n1y = -n1y; }

  // Average "up" direction of the frame
  let upX = n0x + n1x, upY = n0y + n1y;
  const upLen = Math.sqrt(upX*upX + upY*upY);
  if (upLen < 0.01) return null;
  upX /= upLen; upY /= upLen;
  // Ensure upward on screen (negative Y)
  if (upY > 0) { upX = -upX; upY = -upY; }

  // Horizontal axis = perpendicular, oriented from hand-0 toward hand-1
  let hzX = -upY, hzY = upX;
  const h0cx = (lm0[0].x + lm0[5].x) * 0.5 * cw;
  const h0cy = (lm0[0].y + lm0[5].y) * 0.5 * ch;
  const h1cx = (lm1[0].x + lm1[5].x) * 0.5 * cw;
  const h1cy = (lm1[0].y + lm1[5].y) * 0.5 * ch;
  if (hzX * (h1cx - h0cx) + hzY * (h1cy - h0cy) < 0) { hzX = -hzX; hzY = -hzY; }

  // Single rotation angle for the entire frame
  const theta = Math.atan2(hzY, hzX);

  // ── Step 4: Width ────────────────────────────────────────────────
  // Distance between hand centroids projected onto horizontal axis
  const p0_wrist = { x: lm0[0].x * cw, y: lm0[0].y * ch };
  const p0_m9    = { x: lm0[9].x * cw, y: lm0[9].y * ch };
  const palmSize = Math.sqrt(dist2dSq(p0_wrist, p0_m9));

  const hvX = h1cx - h0cx, hvY = h1cy - h0cy;
  const rawW = Math.abs(hvX * hzX + hvY * hzY);
  const width = Math.max(40, rawW - palmSize * 0.3);

  // ── Step 5: Height ───────────────────────────────────────────────
  // Average wrist→index-tip span for each hand
  const h0H = Math.sqrt(
    (lm0[8].x * cw - lm0[0].x * cw)**2 + (lm0[8].y * ch - lm0[0].y * ch)**2
  );
  const h1H = Math.sqrt(
    (lm1[8].x * cw - lm1[0].x * cw)**2 + (lm1[8].y * ch - lm1[0].y * ch)**2
  );
  const height = Math.max(40, (h0H + h1H) * 0.5 - palmSize * 0.15);

  // Landmark anchors for debug rendering
  const h1pt = { x: h0cx, y: h0cy };
  const h3pt = { x: h1cx, y: h1cy };

  return { cx, cy, width, height, theta, h1: h1pt, h3: h3pt };
}

/**
 * Step 6: Build a perfect rectangle from scalar frame parameters.
 * Corners are computed algebraically — never inferred from landmarks.
 */
function buildRect(p) {
  const { cx, cy, width, height, theta } = p;
  const cosT = Math.cos(theta), sinT = Math.sin(theta);
  const hw = width  * 0.5;
  const hh = height * 0.5;
  // Rotate local corner then translate
  const rt = (lx, ly) => ({
    x: cx + lx * cosT - ly * sinT,
    y: cy + lx * sinT + ly * cosT
  });
  return {
    center: { x: cx, y: cy },
    width, height, theta,
    h1: p.h1 || null,
    h3: p.h3 || null,
    c1: rt(-hw, -hh),
    c2: rt(+hw, -hh),
    c3: rt(+hw, +hh),
    c4: rt(-hw, +hh)
  };
}

// ─── 5. Collage Maker configurations ────────────────────────────────
const THEME_CONFIGS = {
  classic: {
    bracketColor: 'rgba(255, 255, 255, 0.5)',
    downloadBg: '#f7f6f0',
    downloadInk: '#1a1a1a',
    downloadMetaInk: '#555555'
  },
  neon: {
    bracketColor: '#00f2fe',
    downloadBg: '#0e0d16',
    downloadInk: '#00f2fe',
    downloadMetaInk: '#9d4edd'
  },
  sage: {
    bracketColor: 'rgba(142, 168, 157, 0.6)',
    downloadBg: '#e5ece9',
    downloadInk: '#2e3b35',
    downloadMetaInk: '#556b60'
  }
};

function drawImageContain(c2d, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const targetRatio = w / h;
  let drawW = w;
  let drawH = h;
  let drawX = x;
  let drawY = y;
  if (imgRatio > targetRatio) {
    drawH = w / imgRatio;
    drawY = y + (h - drawH) / 2;
  } else {
    drawW = h * imgRatio;
    drawX = x + (w - drawW) / 2;
  }
  c2d.drawImage(img, drawX, drawY, drawW, drawH);
}

function renderCollage(canvas, photos, title, activeTheme, collageLayout) {
  return new Promise((resolve) => {
    const dc = canvas.getContext('2d');
    const layout = collageLayout;
    const cfg = THEME_CONFIGS[activeTheme] || THEME_CONFIGS.classic;
    const selectedPhotos = photos.slice(0, 12);
    if (selectedPhotos.length === 0) {
      dc.clearRect(0, 0, canvas.width, canvas.height);
      resolve();
      return;
    }
    const targetCount = layout === 'contact' ? Math.min(selectedPhotos.length, 12) : Math.min(selectedPhotos.length, 4);
    let loadedCount = 0;
    const checkResolve = () => {
      loadedCount++;
      if (loadedCount === targetCount) {
        resolve();
      }
    };

    if (layout === 'grid') {
      canvas.width = 1000;
      canvas.height = 1000;
      dc.fillStyle = cfg.downloadBg;
      dc.fillRect(0, 0, canvas.width, canvas.height);
      dc.font = 'bold 32px Courier New, monospace';
      dc.fillStyle = cfg.downloadInk;
      dc.textAlign = 'center';
      dc.fillText(title.toUpperCase(), 500, 70);
      dc.font = '16px Courier New, monospace';
      dc.fillStyle = cfg.downloadMetaInk;
      dc.fillText(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase(), 500, 105);
      const cells = [
        { x: 80, y: 150, w: 380, h: 360 },
        { x: 540, y: 150, w: 380, h: 360 },
        { x: 80, y: 550, w: 380, h: 360 },
        { x: 540, y: 550, w: 380, h: 360 }
      ];
      const drawGridCell = (photo, cell) => {
        dc.fillStyle = '#ffffff';
        dc.fillRect(cell.x, cell.y, cell.w, cell.h);
        dc.strokeStyle = '#e2e2d9';
        dc.lineWidth = 1;
        dc.strokeRect(cell.x, cell.y, cell.w, cell.h);
        const img = new Image();
        img.onload = () => {
          const pad = 12;
          const photoH = cell.h - 60;
          drawImageContain(dc, img, cell.x + pad, cell.y + pad, cell.w - pad * 2, photoH);
          dc.font = 'bold 13px Courier New, monospace';
          dc.fillStyle = '#222';
          dc.textAlign = 'left';
          dc.fillText(photo.caption || `SNAP #${String(photo.frameNum).padStart(2, '0')}`, cell.x + pad + 2, cell.y + cell.h - 36);
          dc.font = '10px Courier New, monospace';
          dc.fillStyle = '#666';
          dc.fillText(`${photo.date}  ${photo.time}`, cell.x + pad + 2, cell.y + cell.h - 18);
          checkResolve();
        };
        img.src = photo.dataUrl;
      };
      for (let i = 0; i < Math.min(selectedPhotos.length, 4); i++) {
        drawGridCell(selectedPhotos[i], cells[i]);
      }
    } else if (layout === 'strip') {
      canvas.width = 460;
      canvas.height = 1380;
      dc.fillStyle = '#0a0a0d';
      dc.fillRect(0, 0, canvas.width, canvas.height);
      const drawSprockets = (x) => {
        dc.fillStyle = '#17161b';
        dc.fillRect(x, 0, 32, canvas.height);
        dc.fillStyle = '#000000';
        for (let y = 15; y < canvas.height; y += 40) {
          dc.fillRect(x + 8, y, 16, 20);
        }
      };
      drawSprockets(10);
      drawSprockets(canvas.width - 42);
      const imgH = 240;
      const gap = 55;
      const startY = 70;
      const drawStripCell = (photo, i) => {
        const y = startY + i * (imgH + gap);
        const x = 60;
        const w = 340;
        dc.strokeStyle = 'rgba(255,176,0,0.15)';
        dc.lineWidth = 1;
        dc.strokeRect(x - 1, y - 1, w + 2, imgH + 2);
        const img = new Image();
        img.onload = () => {
          drawImageContain(dc, img, x, y, w, imgH);
          dc.font = 'bold 11px Courier New, monospace';
          dc.fillStyle = '#d97e2b';
          dc.textAlign = 'left';
          dc.fillText('SNIP SNAP! SAFETY FILM', x, y - 8);
          dc.textAlign = 'right';
          dc.fillText(String(photo.frameNum).padStart(2, '0'), x + w, y - 8);
          dc.textAlign = 'left';
          dc.fillText(`SNP35-${photo.time}`, x, y + imgH + 14);
          checkResolve();
        };
        img.src = photo.dataUrl;
      };
      for (let i = 0; i < Math.min(selectedPhotos.length, 4); i++) {
        drawStripCell(selectedPhotos[i], i);
      }
    } else if (layout === 'contact') {
      canvas.width = 960;
      canvas.height = 1250;
      dc.fillStyle = '#111111';
      dc.fillRect(0, 0, canvas.width, canvas.height);
      dc.font = 'bold 22px Courier New, monospace';
      dc.fillStyle = '#7c7c7c';
      dc.textAlign = 'left';
      dc.fillText(title.toUpperCase(), 50, 55);
      dc.textAlign = 'right';
      dc.fillText(new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }), 910, 55);
      dc.strokeStyle = '#222';
      dc.lineWidth = 1.5;
      dc.beginPath();
      dc.moveTo(50, 75);
      dc.lineTo(910, 75);
      dc.stroke();
      const cellW = 250;
      const cellH = 220;
      const startX = 65;
      const startY = 110;
      const gapX = 40;
      const gapY = 50;
      const drawThumb = (photo, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = startX + col * (cellW + gapX);
        const y = startY + row * (cellH + gapY);
        dc.strokeStyle = '#1d1d1d';
        dc.lineWidth = 2;
        dc.strokeRect(x, y, cellW, cellH);
        const img = new Image();
        img.onload = () => {
          drawImageContain(dc, img, x, y, cellW, cellH);
          dc.font = 'italic bold 13px Comic Sans MS, Courier New, monospace';
          dc.fillStyle = '#eb4c56';
          dc.textAlign = 'left';
          dc.fillText(`#${String(photo.frameNum).padStart(2, '0')}`, x + 6, y + cellH - 10);
          if (photo.frameNum % 3 === 0) {
            dc.strokeStyle = 'rgba(235, 76, 86, 0.4)';
            dc.lineWidth = 2;
            dc.beginPath();
            dc.moveTo(x + cellW - 20, y + 10);
            dc.lineTo(x + cellW - 8, y + 22);
            dc.moveTo(x + cellW - 8, y + 10);
            dc.lineTo(x + cellW - 20, y + 22);
            dc.stroke();
          }
          checkResolve();
        };
        img.src = photo.dataUrl;
      };
      for (let i = 0; i < Math.min(selectedPhotos.length, 12); i++) {
        drawThumb(selectedPhotos[i], i);
      }
    }
  });
}

// ─── 6. User Interface & DOM Actions ──────────────────────────────
let viewingPhoto = null;

function setActiveTheme(theme) {
  state.activeTheme = theme;
  document.body.classList.remove('theme-classic', 'theme-neon', 'theme-sage');
  document.body.classList.add(`theme-${theme}`);
  const themeBtns = document.querySelectorAll('.theme-btn');
  themeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
  });
}

function openPolaroid(photo) {
  viewingPhoto = photo;
  elements.polaroidImg.src = photo.dataUrl;
  elements.polaroidCaption.value = photo.caption;
  elements.polaroidDate.textContent = photo.date;
  elements.polaroidTime.textContent = photo.time;
  elements.polaroidCard.className = `polaroid-card theme-${state.activeTheme}`;
  elements.polaroidModal.classList.remove('polaroid-modal-hidden');
  setTimeout(() => { elements.polaroidCard.style.transform = 'rotateX(0) rotateY(0) scale(1)'; }, 50);
}

function closePolaroid() {
  if (viewingPhoto) viewingPhoto.caption = elements.polaroidCaption.value;
  elements.polaroidCard.style.transform = 'rotateX(10deg) rotateY(-5deg) scale(0.9)';
  setTimeout(() => { elements.polaroidModal.classList.add('polaroid-modal-hidden'); viewingPhoto = null; }, 250);
}

function showSnapshotPopup() {
  const popup = elements.popup;
  const grid = elements.popupGrid;
  if (!popup || !grid) return;
  grid.innerHTML = '';
  const latest = state.photos.slice(-4);
  latest.forEach(photo => {
    const num = String(photo.frameNum).padStart(2, '0');
    const el = document.createElement('div');
    el.className = 'popup-frame';
    el.innerHTML = `
      <div class="popup-img-container">
        <img src="${photo.dataUrl}" alt="Negative #${num}">
        <div class="polaroid-overlay-gloss"></div>
      </div>
      <div class="popup-frame-meta">
        <span class="brand-code">SNP35</span>
        <span class="time">${photo.time}</span>
      </div>
    `;
    grid.appendChild(el);
  });
  const icon = popup.querySelector('.thumb-icon');
  if (icon) {
    icon.classList.remove('active-gesture');
    icon.style.color = '';
  }
  popup.classList.remove('popup-hidden');
  state.popupOpen = true;
  state.popupClosing = false;
}

function closeSnapshotPopup() {
  const popup = elements.popup;
  if (!popup) return;
  popup.classList.add('popup-hidden');
  state.popupOpen = false;
  state.popupClosing = false;
}

function appendToFilm(photo) {
  if (elements.filmPlaceholder) elements.filmPlaceholder.style.display = 'none';
  const num = String(photo.frameNum).padStart(2, '0');
  elements.photoCount.textContent = `${String(state.photos.length).padStart(2, '0')}/${state.maxPhotos}`;
  if (elements.btnRollBadge) elements.btnRollBadge.textContent = state.photos.length;
  const el = document.createElement('div');
  el.className = 'film-frame';
  el.id = photo.id;
  el.style.setProperty('--frame-number-str', `"${num}"`);
  el.style.setProperty('--rotation', `${(Math.random() * 8 - 4).toFixed(1)}deg`);
  el.innerHTML = `
    <div class="film-frame-actions">
      <button class="frame-action-btn save-btn" title="Download Image"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
      <button class="frame-action-btn delete-btn" title="Delete Image"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
    </div>
    <div class="film-img-container">
      <img src="${photo.dataUrl}" alt="Negative #${num}">
      <div class="polaroid-overlay-gloss"></div>
    </div>
    <div class="film-frame-meta">
      <span class="brand-code">SNP35</span>
      <span class="time">${photo.time}</span>
    </div>
  `;
  el.querySelector('.save-btn').onclick = (e) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.download = `snipsnap_${photo.id}.jpg`;
    a.href = photo.dataUrl;
    a.click();
  };
  el.querySelector('.delete-btn').onclick = (e) => {
    e.stopPropagation();
    if (confirm(`Discard negative frame #${num}?`)) {
      removePhoto(photo.id);
    }
  };
  el.onclick = () => openPolaroid(photo);
  elements.filmStrip.prepend(el);
  elements.filmStrip.scrollTo({ top: 0, behavior: 'smooth' });
}

function removePhoto(id) {
  state.photos = state.photos.filter(p => p.id !== id);
  const el = document.getElementById(id);
  if (el) el.remove();
  elements.photoCount.textContent = `${String(state.photos.length).padStart(2, '0')}/${state.maxPhotos}`;
  if (elements.btnRollBadge) elements.btnRollBadge.textContent = state.photos.length;
  if (state.photos.length === 0) {
    if (elements.filmPlaceholder) elements.filmPlaceholder.style.display = 'flex';
    elements.btnClearFilm.setAttribute('disabled', 'true');
    elements.btnCollage.setAttribute('disabled', 'true');
  }
}

function renderPolaroidCanvas(photo) {
  return new Promise((resolve) => {
    const c = document.createElement('canvas');
    const dc = c.getContext('2d');
    const iw = 800, ih = 600, pad = 40, bp = 150;
    c.width = iw + pad * 2;
    c.height = ih + pad + bp;
    const cfg = THEME_CONFIGS[state.activeTheme];
    dc.fillStyle = cfg.downloadBg;
    dc.fillRect(0, 0, c.width, c.height);
    dc.strokeStyle = state.activeTheme === 'neon' ? 'rgba(0,242,254,0.1)' : '#d0cfc4';
    dc.lineWidth = 1;
    dc.strokeRect(1, 1, c.width - 2, c.height - 2);
    const img = new Image();
    img.onload = () => {
      const imgRatio = img.width / img.height;
      const targetRatio = iw / ih;
      let drawW = iw, drawH = ih, drawX = pad, drawY = pad;
      if (imgRatio > targetRatio) {
        drawH = iw / imgRatio;
        drawY = pad + (ih - drawH) / 2;
      } else {
        drawW = ih * imgRatio;
        drawX = pad + (iw - drawW) / 2;
      }
      dc.drawImage(img, drawX, drawY, drawW, drawH);
      dc.font = 'bold 28px Courier New, monospace';
      dc.fillStyle = cfg.downloadInk;
      dc.fillText(elements.polaroidCaption.value || 'SNIP SNAP! Snapshot', pad + 10, ih + pad + 60);
      dc.font = '18px Courier New, monospace';
      dc.fillStyle = cfg.downloadMetaInk;
      dc.fillText(`${photo.date}   ${photo.time}`, pad + 10, ih + pad + 110);
      resolve(c);
    };
    img.src = photo.dataUrl;
  });
}

function downloadCanvas(canvas, filename) {
  const a = document.createElement('a');
  a.download = filename;
  a.href = canvas.toDataURL('image/jpeg', 0.95);
  a.click();
}

async function copyCanvasToClipboard(canvas) {
  try {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      alert('Copied image to clipboard! You can paste it directly.');
    } else {
      throw new Error('ClipboardItem not supported');
    }
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    alert('Could not copy to clipboard in this browser. Try Downloading instead.');
  }
}

function initUI() {
  if (elements.btnToggleRoll && elements.floatingRollTray) {
    elements.btnToggleRoll.onclick = () => {
      state.rollOpen = !state.rollOpen;
      elements.floatingRollTray.classList.toggle('tray-active', state.rollOpen);
      elements.btnToggleRoll.classList.toggle('active', state.rollOpen);
      playTickSound();
    };
  }

  if (elements.btnToggleHud && elements.hudOverlay) {
    elements.btnToggleHud.onclick = () => {
      state.isHudActive = !state.isHudActive;
      elements.hudOverlay.classList.toggle('hud-hidden', !state.isHudActive);
      elements.btnToggleHud.classList.toggle('active', state.isHudActive);
    };
  }

  if (elements.btnToggleLandmarks) {
    elements.btnToggleLandmarks.onclick = () => {
      state.isTrackingActive = !state.isTrackingActive;
      elements.btnToggleLandmarks.classList.toggle('active', state.isTrackingActive);
    };
  }

  if (elements.btnToggleMirror) {
    elements.btnToggleMirror.onclick = () => {
      state.isMirrorActive = !state.isMirrorActive;
      elements.btnToggleMirror.classList.toggle('active', state.isMirrorActive);
    };
  }

  if (elements.btnClearFilm) {
    elements.btnClearFilm.onclick = () => {
      if (!state.photos.length) return;
      if (!confirm('Discard all film roll negatives?')) return;
      state.photos = [];
      state.frameCounter = 1;
      if (elements.filmStrip) elements.filmStrip.querySelectorAll('.film-frame').forEach(f => f.remove());
      if (elements.filmPlaceholder) elements.filmPlaceholder.style.display = 'flex';
      if (elements.photoCount) elements.photoCount.textContent = `00/${state.maxPhotos}`;
      if (elements.btnRollBadge) elements.btnRollBadge.textContent = '0';
      elements.btnClearFilm.setAttribute('disabled', 'true');
      if (elements.btnCollage) elements.btnCollage.setAttribute('disabled', 'true');
    };
  }

  if (elements.btnCollage) {
    elements.btnCollage.onclick = () => {
      if (state.photos.length === 0) return;
      if (elements.collageModal) elements.collageModal.classList.remove('collage-modal-hidden');
      renderCollagePreview();
    };
  }

  if (elements.btnCollageClose && elements.collageModal) {
    elements.btnCollageClose.onclick = () => {
      elements.collageModal.classList.add('collage-modal-hidden');
    };
  }

  if (elements.collageModal) {
    const backdrop = elements.collageModal.querySelector('.collage-backdrop');
    if (backdrop) {
      backdrop.onclick = () => elements.collageModal.classList.add('collage-modal-hidden');
    }
  }

  const layoutBtns = document.querySelectorAll('.layout-btn');
  layoutBtns.forEach(btn => {
    btn.onclick = () => {
      layoutBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.collageLayout = btn.getAttribute('data-layout');
      renderCollagePreview();
    };
  });

  if (elements.collageTitleInput) {
    elements.collageTitleInput.oninput = renderCollagePreview;
  }

  function renderCollagePreview() {
    if (elements.collageCanvas && elements.collageTitleInput) {
      renderCollage(
        elements.collageCanvas,
        state.photos,
        elements.collageTitleInput.value,
        state.activeTheme,
        state.collageLayout
      );
    }
  }

  if (elements.btnPolaroidClose) {
    elements.btnPolaroidClose.onclick = closePolaroid;
  }
  if (elements.polaroidModal) {
    const backdrop = elements.polaroidModal.querySelector('.polaroid-backdrop');
    if (backdrop) backdrop.onclick = closePolaroid;
  }

  if (elements.btnPopupClose) {
    elements.btnPopupClose.onclick = closeSnapshotPopup;
  }
  if (elements.popup) {
    const backdrop = elements.popup.querySelector('.popup-backdrop');
    if (backdrop) backdrop.onclick = closeSnapshotPopup;
  }
  if (elements.btnPopupDownload) {
    elements.btnPopupDownload.onclick = async () => {
      const latestPhotos = state.photos.slice(-4);
      if (latestPhotos.length === 0) return;
      const tempCanvas = document.createElement('canvas');
      await renderCollage(tempCanvas, latestPhotos, 'SNIP SNAP! BATCH', state.activeTheme, 'grid');
      downloadCanvas(tempCanvas, `snipsnap_batch_${Date.now()}.jpg`);
    };
  }

  const btnInfo = document.getElementById('btn-toggle-info');
  const infoTooltip = document.getElementById('info-tooltip');
  if (btnInfo && infoTooltip) {
    btnInfo.onclick = (e) => {
      e.stopPropagation();
      infoTooltip.classList.toggle('hidden');
      btnInfo.classList.toggle('active');
    };

    document.addEventListener('click', (e) => {
      if (!infoTooltip.classList.contains('hidden')) {
        if (!infoTooltip.contains(e.target) && !btnInfo.contains(e.target)) {
          infoTooltip.classList.add('hidden');
          btnInfo.classList.remove('active');
        }
      }
    });
  }

  if (elements.btnPolaroidShare && elements.polaroidShareMenu) {
    elements.btnPolaroidShare.onclick = (e) => {
      e.stopPropagation();
      elements.polaroidShareMenu.classList.toggle('hidden');
    };

    elements.polaroidShareMenu.querySelectorAll('.share-opt').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        elements.polaroidShareMenu.classList.add('hidden');
        if (!viewingPhoto) return;
        const action = btn.getAttribute('data-action');
        const c = await renderPolaroidCanvas(viewingPhoto);
        if (action === 'download') {
          downloadCanvas(c, `snipsnap_${viewingPhoto.id}.jpg`);
        } else if (action === 'copy') {
          await copyCanvasToClipboard(c);
        }
      };
    });
  }

  if (elements.btnCollageShare && elements.collageShareMenu) {
    elements.btnCollageShare.onclick = (e) => {
      e.stopPropagation();
      elements.collageShareMenu.classList.toggle('hidden');
    };

    elements.collageShareMenu.querySelectorAll('.share-opt').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        elements.collageShareMenu.classList.add('hidden');
        const action = btn.getAttribute('data-action');
        const canvas = elements.collageCanvas;
        if (action === 'download') {
          downloadCanvas(canvas, `snipsnap_collage_${Date.now()}.jpg`);
        } else if (action === 'copy') {
          await copyCanvasToClipboard(canvas);
        }
      };
    });
  }

  document.addEventListener('click', () => {
    if (elements.polaroidShareMenu) elements.polaroidShareMenu.classList.add('hidden');
    if (elements.collageShareMenu) elements.collageShareMenu.classList.add('hidden');
  });

  if (elements.btnToggleLandmarks) elements.btnToggleLandmarks.classList.toggle('active', state.isTrackingActive);
  if (elements.btnToggleMirror) elements.btnToggleMirror.classList.toggle('active', state.isMirrorActive);
  if (elements.btnToggleHud) elements.btnToggleHud.classList.toggle('active', state.isHudActive);
  setActiveTheme('classic');
}

// ─── 7. Main Coordinator ───────────────────────────────────────────
function getThemeInsideFilter(progress) {
  switch (state.activeTheme) {
    case 'neon':  return `saturate(${1.0 + 0.45 * progress}) contrast(${1.0 + 0.1 * progress}) hue-rotate(${-8 * progress}deg)`;
    case 'sage':  return `saturate(${1.0 - 0.2 * progress}) contrast(${1.0 - 0.05 * progress}) sepia(${0.12 * progress}) hue-rotate(${5 * progress}deg)`;
    default:      return `contrast(${1.0 + 0.12 * progress}) saturate(${1.0 + 0.1 * progress}) sepia(${0.06 * progress})`;
  }
}

function getThemeOutsideFilter(progress) {
  switch (state.activeTheme) {
    case 'neon':  return `grayscale(${progress * 100}%) brightness(${1.0 - 0.45 * progress}) sepia(${0.12 * progress}) hue-rotate(${240 * progress}deg)`;
    case 'sage':  return `grayscale(${progress * 100}%) brightness(${1.0 - 0.3 * progress}) sepia(${0.1 * progress}) hue-rotate(${60 * progress}deg)`;
    default:      return `grayscale(${progress * 100}%) brightness(${1.0 - 0.25 * progress})`;
  }
}

function getThemeOuterOverlay(progress) {
  switch (state.activeTheme) {
    case 'neon':  return `rgba(6, 3, 14, ${0.95 * progress})`;
    case 'sage':  return `rgba(16, 18, 14, ${0.93 * progress})`;
    default:      return `rgba(0, 0, 0, ${0.92 * progress})`;
  }
}

let currentStream = null;

function updateCameraToggleUI(active) {
  const btn = elements.btnCameraToggle || document.getElementById('btn-camera-toggle');
  if (!btn) return;
  if (active === 'loading') {
    btn.className = "btn-control-floating camera-btn-off";
    btn.title = "Camera Starting...";
  } else if (active) {
    btn.className = "btn-control-floating camera-btn-on";
    btn.title = "Camera Active — Click to Disable";
  } else {
    btn.className = "btn-control-floating camera-btn-off";
    btn.title = "Camera Disabled — Click to Enable";
  }
}

function stopSystem() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  elements.webcam.srcObject = null;
  state.systemInitialized = false;

  const loadCtx = getCtx();
  if (loadCtx) {
    elements.canvas.width = window.innerWidth;
    elements.canvas.height = window.innerHeight;
    loadCtx.fillStyle = '#000';
    loadCtx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
    loadCtx.fillStyle = 'rgba(255, 68, 68, 0.8)';
    loadCtx.font = '14px "Space Grotesk", sans-serif';
    loadCtx.textAlign = 'center';
    loadCtx.fillText('Camera Disabled', elements.canvas.width / 2, elements.canvas.height / 2);
  }
  updateCameraToggleUI(false);
}

async function startSystem() {
  if (state.systemInitialized && currentStream) return;

  try {
    updateCameraToggleUI('loading');

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });

    currentStream = stream;
    elements.webcam.srcObject = stream;
    elements.webcam.setAttribute('playsinline', '');
    elements.webcam.setAttribute('muted', '');
    elements.webcam.muted = true;

    await elements.webcam.play();

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    if (!handsDetector) {
      initMediaPipe();
    }

    state.systemInitialized = true;
    updateCameraToggleUI(true);

    if (!state.loopStarted) {
      state.loopStarted = true;
      requestAnimationFrame(mainLoop);
    }
  } catch (err) {
    console.error('Camera startup error:', err);
    updateCameraToggleUI(false);
  }
}

function resizeCanvas() {
  if (elements.webcam) {
    const vw = elements.webcam.videoWidth || 1280;
    const vh = elements.webcam.videoHeight || 720;
    elements.canvas.width = vw;
    elements.canvas.height = vh;
  }
}

let handsDetector = null;
let mpBusy = false;

function initMediaPipe() {
  handsDetector = new Hands({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
  });
  handsDetector.setOptions({
    maxNumHands: 2,
    modelComplexity: 0,
    minDetectionConfidence: 0.55,
    minTrackingConfidence: 0.5
  });
  handsDetector.onResults(onHandResults);
}

let frameCount = 0;
const DETECT_EVERY = 3;

function mainLoop() {
  if (state.systemInitialized) {
    frameCount++;

    if (frameCount % DETECT_EVERY === 0 && !mpBusy && elements.webcam && elements.webcam.videoWidth > 0) {
      mpBusy = true;
      if (handsDetector) {
        handsDetector.send({ image: elements.webcam }).then(() => {
          mpBusy = false;
        }).catch((err) => {
          console.error("Tracking error:", err);
          mpBusy = false;
        });
      } else {
        mpBusy = false;
      }
    }

    if (state.isFraming) {
      state.focusProgress = Math.min(1.0, state.focusProgress + 0.045);
    } else {
      state.focusProgress = Math.max(0.0, state.focusProgress - 0.08);
    }

    updateSmoothedRect();
    drawFrame();
  }
  requestAnimationFrame(mainLoop);
}

function onHandResults(results) {
  state.hands = [];
  if (results.multiHandLandmarks) {
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const lm = results.multiHandLandmarks[i];
      const isL = detectLGesture(lm);
      const isFolded = detectIndexFold(lm);
      state.hands.push({ landmarks: lm, isL, isFolded });
    }
  }

  if (state.popupOpen) {
    if (state.popupClosing) return;
    const hasThumbsUp = state.hands.some(h => detectThumbsUp(h.landmarks));
    if (hasThumbsUp) {
      state.popupClosing = true;
      const icon = elements.popup.querySelector('.thumb-icon');
      if (icon) {
        icon.classList.add('active-gesture');
        icon.style.color = '#00ffd2';
      }
      playConfirmBeep();
      setTimeout(() => {
        closeSnapshotPopup();
      }, 500);
    }
    return;
  }

  const lHands = state.hands.filter(h => h.isL);
  const foldedHands = state.hands.filter(h => h.isFolded);
  const wasFraming = state.isFraming;

  const hasTwoL = (lHands.length === 2);
  const hasOneLOneFolded = (lHands.length === 1 && foldedHands.length === 1);

  if (hasTwoL) {
    state.isFraming = true;
    if (!wasFraming) {
      state.framingStartTime = Date.now();
      playFocusBeep();
    }
    state.framingStableDuration = Date.now() - state.framingStartTime;
  } else if (state.isFraming && hasOneLOneFolded) {
    state.isFraming = true;
  } else {
    state.isFraming = false;
    state.framingStartTime = 0;
    state.framingStableDuration = 0;
  }

  state.wasFraming = state.isFraming;

  // Require BOTH hands clearly detected before allowing shutter
  const bothHandsVisible = state.hands.length >= 2;
  if (state.isFraming && bothHandsVisible && foldedHands.length > 0 && state.framingStableDuration >= 500) {
    const now = Date.now();
    if (now - state.lastSnapTime > 1500) {
      state.lastSnapTime = now;
      state.framingStableDuration = 0;
      state.framingStartTime = Date.now();
      captureSnapshot();
    }
  }
}

/**
 * Step 7+8: Smooth the 5 scalar frame parameters independently and apply
 * outlier rejection. The smoothed rect is always a perfect rectangle.
 */
function updateSmoothedRect() {
  if (!state.isFraming) {
    state.smoothedRect = null;
    return;
  }

  const cw = elements.canvas.width, ch = elements.canvas.height;
  const raw = estimateFrameParams(cw, ch, state.hands);

  // Step 8: If estimation fails, hold last valid frame — don't null it out
  if (!raw) return;

  // ── Initialize on first valid frame ─────────────────────────────
  if (!state.smoothedRect || !state.smoothedRect._p) {
    const rect = buildRect(raw);
    rect._p = { cx: raw.cx, cy: raw.cy, width: raw.width, height: raw.height, theta: raw.theta };
    state.smoothedRect = rect;
    return;
  }

  const prev = state.smoothedRect._p;

  // ── Outlier rejection ─────────────────────────────────────────────
  // Compute raw delta for each scalar
  const dcx = Math.abs(raw.cx    - prev.cx);
  const dcy = Math.abs(raw.cy    - prev.cy);
  const dw  = Math.abs(raw.width - prev.width)  / Math.max(prev.width,  1);
  const dh  = Math.abs(raw.height- prev.height) / Math.max(prev.height, 1);
  // Shortest angular distance
  let da = raw.theta - prev.theta;
  while (da >  Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  // Handle ambiguity: rotation + π is the same rectangle
  if (Math.abs(da) > Math.PI / 2) da = da > 0 ? da - Math.PI : da + Math.PI;
  da = Math.abs(da);

  if (
    dcx > FRAME_MAX_DELTA.centerPx  ||
    dcy > FRAME_MAX_DELTA.centerPx  ||
    dw  > FRAME_MAX_DELTA.sizeRatio ||
    dh  > FRAME_MAX_DELTA.sizeRatio ||
    da  > FRAME_MAX_DELTA.angleRad
  ) {
    // Outlier — continue rendering previous valid frame unchanged
    return;
  }

  // ── Step 7: Smooth each scalar independently ──────────────────────
  const sc = FRAME_SMOOTH.center;
  const ss = FRAME_SMOOTH.size;
  const sa = FRAME_SMOOTH.angle;

  const sCx = lerp(prev.cx,     raw.cx,     sc);
  const sCy = lerp(prev.cy,     raw.cy,     sc);
  const sW  = lerp(prev.width,  raw.width,  ss);
  const sH  = lerp(prev.height, raw.height, ss);

  // Angle: shortest-path lerp, collapse ambiguity (rect at theta == rect at theta+π)
  let thetaDiff = raw.theta - prev.theta;
  while (thetaDiff >  Math.PI) thetaDiff -= Math.PI * 2;
  while (thetaDiff < -Math.PI) thetaDiff += Math.PI * 2;
  if (Math.abs(thetaDiff) > Math.PI / 2) {
    thetaDiff = thetaDiff > 0 ? thetaDiff - Math.PI : thetaDiff + Math.PI;
  }
  const sTheta = prev.theta + thetaDiff * sa;

  const smoothed = { cx: sCx, cy: sCy, width: sW, height: sH, theta: sTheta,
                     h1: raw.h1, h3: raw.h3 };

  // ── Step 6: Build perfect rectangle from smoothed scalars ─────────
  const rect = buildRect(smoothed);
  rect._p = { cx: sCx, cy: sCy, width: sW, height: sH, theta: sTheta };
  state.smoothedRect = rect;
}

function drawFrame() {
  const ctx2d = getCtx();
  if (!ctx2d || !elements.canvas) return;
  const w = elements.canvas.width;
  const h = elements.canvas.height;
  const cfg = THEME_CONFIGS[state.activeTheme] || THEME_CONFIGS.classic;

  ctx2d.clearRect(0, 0, w, h);

  ctx2d.save();

  if (state.focusProgress > 0.005 && state.smoothedRect) {
    const rect = state.smoothedRect;
    ctx2d.save();
    ctx2d.filter = getThemeOutsideFilter(state.focusProgress);
    ctx2d.drawImage(elements.webcam, 0, 0, w, h);
    ctx2d.restore();

    ctx2d.save();
    ctx2d.beginPath();
    ctx2d.rect(0, 0, w, h);
    ctx2d.moveTo(rect.c1.x, rect.c1.y);
    ctx2d.lineTo(rect.c4.x, rect.c4.y);
    ctx2d.lineTo(rect.c3.x, rect.c3.y);
    ctx2d.lineTo(rect.c2.x, rect.c2.y);
    ctx2d.closePath();
    ctx2d.fillStyle = getThemeOuterOverlay(state.focusProgress);
    ctx2d.fill('evenodd');
    ctx2d.restore();

    ctx2d.save();
    ctx2d.beginPath();
    ctx2d.moveTo(rect.c1.x, rect.c1.y);
    ctx2d.lineTo(rect.c2.x, rect.c2.y);
    ctx2d.lineTo(rect.c3.x, rect.c3.y);
    ctx2d.lineTo(rect.c4.x, rect.c4.y);
    ctx2d.closePath();
    ctx2d.clip();
    ctx2d.filter = getThemeInsideFilter(state.focusProgress);
    ctx2d.drawImage(elements.webcam, 0, 0, w, h);
    ctx2d.restore();

    drawBorder(rect, cfg);
  }

  if (state.isTrackingActive && state.hands.length > 0) {
    drawLandmarks(w, h);
  }
  ctx2d.restore();
}

function drawBorder(rect, cfg) {
  const ctx2d = getCtx();
  if (!ctx2d) return;
  ctx2d.beginPath();
  ctx2d.moveTo(rect.c1.x, rect.c1.y);
  ctx2d.lineTo(rect.c2.x, rect.c2.y);
  ctx2d.lineTo(rect.c3.x, rect.c3.y);
  ctx2d.lineTo(rect.c4.x, rect.c4.y);
  ctx2d.closePath();
  ctx2d.lineWidth = 1.5;
  ctx2d.strokeStyle = cfg.bracketColor;
  if (state.activeTheme === 'sage') {
    ctx2d.setLineDash([]);
  } else {
    ctx2d.setLineDash([4, 4]);
  }
  ctx2d.stroke();
  ctx2d.setLineDash([]);

  ctx2d.lineWidth = 3;
  ctx2d.strokeStyle = '#ffffff';
  ctx2d.lineCap = 'round';

  if (rect.h1) {
    ctx2d.save();
    ctx2d.translate(rect.h1.x, rect.h1.y);
    ctx2d.rotate(rect.theta);
    ctx2d.beginPath();
    ctx2d.moveTo(16, 0);
    ctx2d.lineTo(0, 0);
    ctx2d.lineTo(0, 16);
    ctx2d.stroke();
    ctx2d.restore();
  }
  if (rect.h3) {
    ctx2d.save();
    ctx2d.translate(rect.h3.x, rect.h3.y);
    ctx2d.rotate(rect.theta + Math.PI);
    ctx2d.beginPath();
    ctx2d.moveTo(16, 0);
    ctx2d.lineTo(0, 0);
    ctx2d.lineTo(0, 16);
    ctx2d.stroke();
    ctx2d.restore();
  }
}

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17]
];

function drawLandmarks(w, h) {
  const ctx2d = getCtx();
  if (!ctx2d) return;
  for (let hi = 0; hi < state.hands.length; hi++) {
    const hand = state.hands[hi];
    const lm = hand.landmarks;
    const color = (hand.isL || hand.isFolded) ? '#00ffd2' : '#ffb000';
    const lineColor = (hand.isL || hand.isFolded) ? 'rgba(0,255,210,0.3)' : 'rgba(255,176,0,0.25)';

    ctx2d.strokeStyle = lineColor;
    ctx2d.lineWidth = 1.5;
    ctx2d.beginPath();
    for (let ci = 0; ci < HAND_CONNECTIONS.length; ci++) {
      const s = HAND_CONNECTIONS[ci][0];
      const e = HAND_CONNECTIONS[ci][1];
      ctx2d.moveTo(lm[s].x * w, lm[s].y * h);
      ctx2d.lineTo(lm[e].x * w, lm[e].y * h);
    }
    ctx2d.stroke();

    ctx2d.fillStyle = color;
    for (let ji = 0; ji < 21; ji++) {
      const x = lm[ji].x * w;
      const y = lm[ji].y * h;
      ctx2d.beginPath();
      ctx2d.arc(x, y, 3, 0, 6.2832);
      ctx2d.fill();
    }
  }
}

function captureSnapshot() {
  if (state.photos.length >= state.maxPhotos) return;
  const w = elements.canvas.width, h = elements.canvas.height;
  if (w === 0 || h === 0) return;

  const temp = document.createElement('canvas');
  temp.width = w;
  temp.height = h;
  const tc = temp.getContext('2d');
  
  tc.save();

  if (state.smoothedRect) {
    const rect = state.smoothedRect;
    const xs = [rect.c1.x, rect.c2.x, rect.c3.x, rect.c4.x];
    const ys = [rect.c1.y, rect.c2.y, rect.c3.y, rect.c4.y];
    const minX = Math.max(0, Math.min(...xs));
    const maxX = Math.min(w, Math.max(...xs));
    const minY = Math.max(0, Math.min(...ys));
    const maxY = Math.min(h, Math.max(...ys));

    const cropW = maxX - minX;
    const cropH = maxY - minY;

    if (cropW > 10 && cropH > 10) {
      // Preserve aspect ratio: scale to fill canvas without stretching (cover)
      const scaleX = w / cropW;
      const scaleY = h / cropH;
      const scale = Math.max(scaleX, scaleY);
      const destW = cropW * scale;
      const destH = cropH * scale;
      const destX = (w - destW) / 2;
      const destY = (h - destH) / 2;

      tc.filter = getThemeInsideFilter(1.0);
      tc.drawImage(elements.webcam, minX, minY, cropW, cropH, destX, destY, destW, destH);
    } else {
      tc.drawImage(elements.webcam, 0, 0, w, h);
    }
  } else {
    tc.drawImage(elements.webcam, 0, 0, w, h);
  }
  tc.restore();

  const dataUrl = temp.toDataURL('image/jpeg', 0.9);
  playShutterSound();

  if (elements.shutterFlash) {
    elements.shutterFlash.style.opacity = '1';
    setTimeout(() => { elements.shutterFlash.style.opacity = '0'; }, 150);
  }

  const now = new Date();
  const photo = {
    id: 'snap_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    frameNum: state.frameCounter++,
    dataUrl,
    caption: '',
    date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
    time: now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
  };

  state.photos.push(photo);
  appendToFilm(photo);

  if (elements.btnClearFilm) elements.btnClearFilm.removeAttribute('disabled');
  if (elements.btnCollage) elements.btnCollage.removeAttribute('disabled');

  if (state.photos.length % 4 === 0) {
    setTimeout(() => {
      showSnapshotPopup();
    }, 700);
  }
}

function boot() {
  initUI();
  initAudio();

  const startInteraction = () => {
    document.removeEventListener('click', startInteraction);
    document.removeEventListener('keydown', startInteraction);
    initAudio();
  };
  document.addEventListener('click', startInteraction);
  document.addEventListener('keydown', startInteraction);

  // Setup theme selectors
  const themeBtns = document.querySelectorAll('.theme-btn');
  themeBtns.forEach(btn => {
    btn.onclick = () => {
      setActiveTheme(btn.getAttribute('data-theme'));
      playTickSound();
    };
  });

  const btnCamToggle = elements.btnCameraToggle || document.getElementById('btn-camera-toggle');
  if (btnCamToggle) {
    btnCamToggle.onclick = () => {
      if (state.systemInitialized && currentStream) {
        stopSystem();
      } else {
        startSystem();
      }
    };
  }

  startSystem();
}

window.addEventListener('DOMContentLoaded', boot);
