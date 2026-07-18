/**
 * SNIP SNAP! // Gesture Retro Film Camera — Main Coordinator Entry
 * Orchestrates camera stream, canvas main loop, MediaPipe processing,
 * and handles gesture-based snaps and popup reviews.
 */

import { state } from './modules/state.js';
import { elements, initUI, appendToFilm, showSnapshotPopup, closeSnapshotPopup } from './modules/ui.js';
import { initAudio, playFocusBeep, playShutterSound, playConfirmBeep } from './modules/audio.js';
import { 
  dist2dSq, lerp, lerpAngle, detectLGesture, detectIndexFold, detectThumbsUp, calcRect 
} from './modules/math.js';
import { THEME_CONFIGS } from './modules/collage.js';

const ctx = elements.canvas.getContext('2d');

// ─── Custom Themed Filter Helpers (Smoothly blended via progress) ───
function getThemeInsideFilter(progress) {
  switch (state.activeTheme) {
    case 'neon':
      return `saturate(${1.0 + 0.45 * progress}) contrast(${1.0 + 0.1 * progress}) hue-rotate(${-8 * progress}deg)`;
    case 'sage':
      return `saturate(${1.0 - 0.2 * progress}) contrast(${1.0 - 0.05 * progress}) sepia(${0.12 * progress}) hue-rotate(${5 * progress}deg)`;
    default: // classic
      return `contrast(${1.0 + 0.12 * progress}) saturate(${1.0 + 0.1 * progress}) sepia(${0.06 * progress})`;
  }
}

function getThemeOutsideFilter(progress) {
  switch (state.activeTheme) {
    case 'neon':
      return `grayscale(${progress * 100}%) brightness(${1.0 - 0.45 * progress}) sepia(${0.12 * progress}) hue-rotate(${240 * progress}deg)`;
    case 'sage':
      return `grayscale(${progress * 100}%) brightness(${1.0 - 0.3 * progress}) sepia(${0.1} * progress) hue-rotate(${60 * progress}deg)`;
    default: // classic
      return `grayscale(${progress * 100}%) brightness(${1.0 - 0.25 * progress})`;
  }
}

function getThemeOuterOverlay(progress) {
  switch (state.activeTheme) {
    case 'neon':  return `rgba(6, 3, 14, ${0.95 * progress})`;
    case 'sage':  return `rgba(16, 18, 14, ${0.93 * progress})`;
    default:      return `rgba(0, 0, 0, ${0.92 * progress})`;
  }
}

// ─── Startup & Camera Permission Handling ────────────────────────────
async function startSystem() {
  const permOverlay = document.getElementById('camera-permission-overlay');
  const statusMsg = document.getElementById('camera-status-msg');

  // Check for insecure context (e.g. file:// protocol without http/https server)
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (permOverlay) permOverlay.classList.remove('hidden');
    if (statusMsg) {
      statusMsg.style.color = '#ff4444';
      statusMsg.innerHTML = '⚠️ <strong>Local file:// context detected!</strong><br>Browsers block camera access on <code>file://</code>.<br>Run via local server (e.g. <code>http://localhost:8080</code>) or Cloudflare Pages.';
    }
    return;
  }

  // Draw loading state on canvas
  const loadCtx = elements.canvas.getContext('2d');
  elements.canvas.width = window.innerWidth;
  elements.canvas.height = window.innerHeight;
  loadCtx.fillStyle = '#000';
  loadCtx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
  loadCtx.fillStyle = 'rgba(255,255,255,0.7)';
  loadCtx.font = '14px "Space Grotesk", sans-serif';
  loadCtx.textAlign = 'center';
  loadCtx.fillText('Starting camera…', elements.canvas.width / 2, elements.canvas.height / 2);

  // Camera constraint sets to try in order
  const constraintsList = [
    { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false },
    { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }, audio: false },
    { video: true, audio: false }
  ];

  let stream = null;
  for (const constraints of constraintsList) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      break;
    } catch (e) {
      console.warn('Camera attempt failed:', constraints, e);
    }
  }

  if (!stream) {
    // Show camera permission overlay so user can click to trigger permission prompt
    if (permOverlay) permOverlay.classList.remove('hidden');
    if (statusMsg) {
      statusMsg.style.color = '#ffb000';
      statusMsg.textContent = 'Camera permission required. Click "ENABLE CAMERA" above to allow access.';
    }
    return;
  }

  // Success — hide permission request overlay
  if (permOverlay) permOverlay.classList.add('hidden');

  elements.webcam.srcObject = stream;
  elements.webcam.setAttribute('playsinline', '');
  elements.webcam.setAttribute('muted', '');
  elements.webcam.muted = true;

  await new Promise((resolve) => {
    const onReady = () => {
      elements.webcam.removeEventListener('loadedmetadata', onReady);
      resolve();
    };
    elements.webcam.addEventListener('loadedmetadata', onReady);
    setTimeout(resolve, 5000);
  });

  try { await elements.webcam.play(); } catch (_) {}

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  initMediaPipe();
  state.systemInitialized = true;
  requestAnimationFrame(mainLoop);
}

function resizeCanvas() {
  const vw = elements.webcam.videoWidth || 1280;
  const vh = elements.webcam.videoHeight || 720;
  elements.canvas.width = vw;
  elements.canvas.height = vh;
}

// ─── MediaPipe Initialization ────────────────────────────────────────
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

// ─── Main Rendering Loop ─────────────────────────────────────────────
let frameCount = 0;
const DETECT_EVERY = 3;

function mainLoop() {
  if (state.systemInitialized) {
    frameCount++;

    if (frameCount % DETECT_EVERY === 0 && !mpBusy && elements.webcam.videoWidth > 0 && elements.webcam.readyState >= 3) {
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

    // A. Focus Progress Animation (Smooth background desaturation/darkening)
    if (state.isFraming) {
      state.focusProgress = Math.min(1.0, state.focusProgress + 0.045); // ~350ms fade-in
    } else {
      state.focusProgress = Math.max(0.0, state.focusProgress - 0.08); // faster fade-out
    }

    // B. Smooth Viewfinder Rectangle calculations (Lerp)
    updateSmoothedRect();

    // C. Draw viewfinder frame
    drawFrame();
  }
  requestAnimationFrame(mainLoop);
}

// ─── MediaPipe Hand Callbacks ────────────────────────────────────────
function onHandResults(results) {
  state.hands = [];
  if (results.multiHandLandmarks) {
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const lm = results.multiHandLandmarks[i];
      state.hands.push({
        landmarks: lm,
        isL: detectLGesture(lm),
        isFolded: detectIndexFold(lm),
        label: results.multiHandedness[i].label
      });
    }
  }

  // --- Thumbs Up Popup Close Handling ---
  if (state.popupOpen) {
    if (state.popupClosing) return;
    
    const hasThumbsUp = state.hands.some(h => detectThumbsUp(h.landmarks));
    if (hasThumbsUp) {
      state.popupClosing = true;
      
      const icon = elements.popup.querySelector('.thumb-icon');
      if (icon) {
        icon.classList.add('active-gesture');
        icon.style.color = '#00ffd2'; // Glowing feedback
      }
      
      playConfirmBeep();
      
      setTimeout(() => {
        closeSnapshotPopup();
      }, 500);
    }
    return; // Don't do framing math when popup is up
  }

  const lHands = state.hands.filter(h => h.isL);
  const foldedHands = state.hands.filter(h => h.isFolded);

  // Framing active if both hands are L, or one is L and one is folded (during shutter pull)
  const wasFraming = state.isFraming;
  state.isFraming = (lHands.length === 2) || (lHands.length === 1 && foldedHands.length === 1);

  // Focus double beep audio trigger
  if (state.isFraming && !wasFraming) {
    playFocusBeep();
    const el = elements.gestureGuideText;
    el.classList.add('active-focus');
    el.querySelector('.guide-msg').textContent = 'FRAME LOCKED // Fold index to snap';
  } else if (!state.isFraming && wasFraming) {
    const el = elements.gestureGuideText;
    el.classList.remove('active-focus');
    el.querySelector('.guide-msg').textContent = 'Raise two hands in L-shapes to frame';
  }
  state.wasFraming = state.isFraming;

  // Snapshot triggers on index folded edge
  if (state.isFraming && foldedHands.length > 0) {
    const now = Date.now();
    if (now - state.lastSnapTime > 1200) {
      state.lastSnapTime = now;
      captureSnapshot();
    }
  }
}



// ─── Smooth positioning interpolation (lerp) ─────────────────────────
function updateSmoothedRect() {
  if (!state.isFraming) {
    state.smoothedRect = null;
    return;
  }

  const target = calcRect(elements.canvas.width, elements.canvas.height, state.hands);
  if (!target) {
    state.smoothedRect = null;
    return;
  }

  if (!state.smoothedRect) {
    state.smoothedRect = { ...target };
    return;
  }

  const alpha = 0.16;
  const cur = state.smoothedRect;

  cur.center.x = lerp(cur.center.x, target.center.x, alpha);
  cur.center.y = lerp(cur.center.y, target.center.y, alpha);
  cur.width = lerp(cur.width, target.width, alpha);
  cur.height = lerp(cur.height, target.height, alpha);
  cur.theta = lerpAngle(cur.theta, target.theta, alpha);

  // Rebuild corner coordinates
  const cosT = Math.cos(cur.theta), sinT = Math.sin(cur.theta);
  const ux = cosT, uy = sinT;
  const vx = -sinT, vy = cosT;
  const hw = cur.width * 0.5;
  const hh = cur.height * 0.5;

  cur.c1 = { x: cur.center.x - hw * ux - hh * vx, y: cur.center.y - hw * uy - hh * vy };
  cur.c2 = { x: cur.center.x + hw * ux - hh * vx, y: cur.center.y + hw * uy - hh * vy };
  cur.c3 = { x: cur.center.x + hw * ux + hh * vx, y: cur.center.y + hw * uy + hh * vy };
  cur.c4 = { x: cur.center.x - hw * ux + hh * vx, y: cur.center.y - hw * uy + hh * vy };
  
  cur.h1 = target.h1;
  cur.h3 = target.h3;
}

// ─── Viewfinder Frame Drawing ───
function drawFrame() {
  const w = elements.canvas.width;
  const h = elements.canvas.height;
  const cfg = THEME_CONFIGS[state.activeTheme] || THEME_CONFIGS.classic;

  ctx.save();
  if (state.isMirrorActive) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }

  if (state.focusProgress > 0.005 && state.smoothedRect) {
    const rect = state.smoothedRect;

    // 1. Outside desaturated/darkened layer
    ctx.save();
    ctx.filter = getThemeOutsideFilter(state.focusProgress);
    ctx.drawImage(elements.webcam, 0, 0, w, h);
    ctx.restore();

    // 2. Dark overlay mask
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.moveTo(rect.c1.x, rect.c1.y);
    ctx.lineTo(rect.c4.x, rect.c4.y);
    ctx.lineTo(rect.c3.x, rect.c3.y);
    ctx.lineTo(rect.c2.x, rect.c2.y);
    ctx.closePath();
    ctx.fillStyle = getThemeOuterOverlay(state.focusProgress);
    ctx.fill('evenodd');
    ctx.restore();

    // 3. Inside crop focused layer
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(rect.c1.x, rect.c1.y);
    ctx.lineTo(rect.c2.x, rect.c2.y);
    ctx.lineTo(rect.c3.x, rect.c3.y);
    ctx.lineTo(rect.c4.x, rect.c4.y);
    ctx.closePath();
    ctx.clip();
    ctx.filter = getThemeInsideFilter(state.focusProgress);
    ctx.drawImage(elements.webcam, 0, 0, w, h);
    ctx.restore();

    // 4. Viewfinder boundaries
    drawBorder(rect, cfg);
  } else {
    ctx.drawImage(elements.webcam, 0, 0, w, h);
  }



  // Draw tracking wireframes
  if (state.isTrackingActive && state.hands.length > 0) {
    drawLandmarks(w, h);
  }

  ctx.restore();
}

function drawBorder(rect, cfg) {
  ctx.beginPath();
  ctx.moveTo(rect.c1.x, rect.c1.y);
  ctx.lineTo(rect.c2.x, rect.c2.y);
  ctx.lineTo(rect.c3.x, rect.c3.y);
  ctx.lineTo(rect.c4.x, rect.c4.y);
  ctx.closePath();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = cfg.bracketColor;
  
  if (state.activeTheme === 'sage') {
    ctx.setLineDash([]);
  } else {
    ctx.setLineDash([4, 4]);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Knuckle brackets
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';

  if (rect.h1) {
    ctx.save();
    ctx.translate(rect.h1.x, rect.h1.y);
    ctx.rotate(rect.theta);
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(0, 0);
    ctx.lineTo(0, 16);
    ctx.stroke();
    ctx.restore();
  }

  if (rect.h3) {
    ctx.save();
    ctx.translate(rect.h3.x, rect.h3.y);
    ctx.rotate(rect.theta + Math.PI);
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(0, 0);
    ctx.lineTo(0, 16);
    ctx.stroke();
    ctx.restore();
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
  for (let hi = 0; hi < state.hands.length; hi++) {
    const hand = state.hands[hi];
    const lm = hand.landmarks;
    const color = (hand.isL || hand.isFolded) ? '#00ffd2' : '#ffb000';
    const lineColor = (hand.isL || hand.isFolded) ? 'rgba(0,255,210,0.3)' : 'rgba(255,176,0,0.25)';

    // Bones
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let ci = 0; ci < HAND_CONNECTIONS.length; ci++) {
      const s = HAND_CONNECTIONS[ci][0];
      const e = HAND_CONNECTIONS[ci][1];
      ctx.moveTo(lm[s].x * w, lm[s].y * h);
      ctx.lineTo(lm[e].x * w, lm[e].y * h);
    }
    ctx.stroke();

    // Joints
    ctx.fillStyle = color;
    for (let ji = 0; ji < 21; ji++) {
      const x = lm[ji].x * w;
      const y = lm[ji].y * h;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 6.2832);
      ctx.fill();
    }
  }
}

// ─── Capture & Crop Snapshot ─────────────────────────────────────────
function captureSnapshot() {
  if (state.photos.length >= state.maxPhotos) return;

  const w = elements.canvas.width, h = elements.canvas.height;
  const rect = state.smoothedRect;
  if (!rect) return;

  // Sound Play: Play crisp camera shutter thud/click
  playShutterSound();
  
  elements.shutterFlash.classList.add('flash-active');
  setTimeout(() => elements.shutterFlash.classList.remove('flash-active'), 100);

  const vw = elements.webcam.videoWidth, vh = elements.webcam.videoHeight;
  const sx = vw / w, sy = vh / h;
  
  const cropW = Math.round(rect.width * sx);
  const cropH = Math.round(rect.height * sy);

  const crop = document.createElement('canvas');
  crop.width = cropW;
  crop.height = cropH;
  const cc = crop.getContext('2d');

  cc.translate(cropW * 0.5, cropH * 0.5);
  
  if (state.isMirrorActive) {
    cc.scale(-1, 1);
  }
  
  cc.rotate(-rect.theta);
  cc.filter = getThemeInsideFilter(1.0);
  cc.drawImage(elements.webcam, 0, 0, vw, vh, -rect.center.x * sx, -rect.center.y * sy, vw, vh);



  const dataUrl = crop.toDataURL('image/jpeg', 0.88);
  const now = new Date();
  const photo = {
    id: `photo-${Date.now()}`,
    dataUrl,
    date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
    time: now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    caption: '',
    frameNum: state.frameCounter++
  };
  
  state.photos.push(photo);
  appendToFilm(photo);
  
  elements.btnClearFilm.removeAttribute('disabled');
  elements.btnCollage.removeAttribute('disabled');

  // Trigger batch popup every 4 completed snapshots
  if (state.photos.length > 0 && state.photos.length % 4 === 0) {
    showSnapshotPopup();
  }
}

// ─── Initialization Bootstrap ────────────────────────────────────────
const onInteract = () => { 
  initAudio(); 
  document.removeEventListener('click', onInteract); 
  document.removeEventListener('touchstart', onInteract); 
};
document.addEventListener('click', onInteract);
document.addEventListener('touchstart', onInteract);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

function boot() {
  initUI();
  
  const btnEnableCam = document.getElementById('btn-enable-camera');
  if (btnEnableCam) {
    btnEnableCam.addEventListener('click', () => {
      startSystem();
    });
  }

  startSystem();
}
