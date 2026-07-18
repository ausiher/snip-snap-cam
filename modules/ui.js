/**
 * SNIP SNAP! User Interface (UI) & DOM Interaction Module
 */
import { state } from './state.js';
import { playTickSound, playConfirmBeep } from './audio.js';
import { THEME_CONFIGS, renderCollage } from './collage.js';

export const elements = {
  onboarding: document.getElementById('onboarding'),
  webcam: document.getElementById('webcam'),
  canvas: document.getElementById('viewfinder-canvas'),
  hudOverlay: document.querySelector('.hud-overlay'),
  shutterFlash: document.getElementById('shutter-flash'),
  filmStrip: document.getElementById('film-strip'),
  filmPlaceholder: document.getElementById('film-placeholder'),
  photoCount: document.getElementById('photo-count'),
  btnClearFilm: document.getElementById('btn-clear-film'),
  btnToggleHud: document.getElementById('btn-toggle-hud'),
  btnToggleLandmarks: document.getElementById('btn-toggle-landmarks'),
  btnToggleMirror: document.getElementById('btn-toggle-mirror'),
  polaroidModal: document.getElementById('polaroid-modal'),
  polaroidCard: document.getElementById('polaroid-card'),
  polaroidImg: document.getElementById('polaroid-img'),
  polaroidCaption: document.getElementById('polaroid-caption'),
  polaroidDate: document.getElementById('polaroid-date'),
  polaroidTime: document.getElementById('polaroid-time'),
  btnPolaroidShare: document.getElementById('btn-polaroid-share'),
  polaroidShareMenu: document.getElementById('polaroid-share-menu'),
  btnPolaroidClose: document.getElementById('btn-polaroid-close'),
  gestureGuideText: document.getElementById('gesture-guide-text'),
  
  // Collage controls
  btnCollage: document.getElementById('btn-collage'),
  collageModal: document.getElementById('collage-modal'),
  collageCanvas: document.getElementById('collage-preview-canvas'),
  btnCollageShare: document.getElementById('btn-collage-share'),
  collageShareMenu: document.getElementById('collage-share-menu'),
  btnCollageClose: document.getElementById('btn-collage-close'),
  collageTitleInput: document.getElementById('collage-title-input'),

  // 4-snapshot popup elements
  popup: document.getElementById('snapshot-popup'),
  popupGrid: document.getElementById('popup-grid'),
  btnPopupClose: document.getElementById('btn-popup-close')
};

let viewingPhoto = null;



// --- Active Theme ---
export function setActiveTheme(theme) {
  state.activeTheme = theme;
  document.body.classList.remove('theme-classic', 'theme-neon', 'theme-sage');
  document.body.classList.add(`theme-${theme}`);
  
  const themeBtns = document.querySelectorAll('.theme-btn');
  themeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
  });
}

// --- Polaroid Modal ---
export function openPolaroid(photo) {
  viewingPhoto = photo;
  elements.polaroidImg.src = photo.dataUrl;
  elements.polaroidCaption.value = photo.caption;
  elements.polaroidDate.textContent = photo.date;
  elements.polaroidTime.textContent = photo.time;
  elements.polaroidCard.className = `polaroid-card theme-${state.activeTheme}`;
  
  elements.polaroidModal.classList.remove('polaroid-modal-hidden');
  setTimeout(() => { elements.polaroidCard.style.transform = 'rotateX(0) rotateY(0) scale(1)'; }, 50);
}

export function closePolaroid() {
  if (viewingPhoto) viewingPhoto.caption = elements.polaroidCaption.value;
  elements.polaroidCard.style.transform = 'rotateX(10deg) rotateY(-5deg) scale(0.9)';
  setTimeout(() => { elements.polaroidModal.classList.add('polaroid-modal-hidden'); viewingPhoto = null; }, 250);
}

// --- 4-Snapshot Popup ---
export function showSnapshotPopup() {
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
  
  // Reset visual guide
  const icon = popup.querySelector('.thumb-icon');
  if (icon) {
    icon.classList.remove('active-gesture');
    icon.style.color = '';
  }
  
  popup.classList.remove('popup-hidden');
  state.popupOpen = true;
  state.popupClosing = false;
}

export function closeSnapshotPopup() {
  const popup = elements.popup;
  if (!popup) return;
  popup.classList.add('popup-hidden');
  state.popupOpen = false;
  state.popupClosing = false;
}

// --- Film strip ribbon update ---
export function appendToFilm(photo) {
  if (elements.filmPlaceholder) elements.filmPlaceholder.style.display = 'none';
  const num = String(photo.frameNum).padStart(2, '0');
  elements.photoCount.textContent = `${String(state.photos.length).padStart(2, '0')}/${state.maxPhotos}`;

  const el = document.createElement('div');
  el.className = 'film-frame';
  el.id = photo.id;
  el.style.setProperty('--frame-number-str', `"${num}"`);
  el.style.setProperty('--rotation', `${(Math.random() * 8 - 4).toFixed(1)}deg`);
  el.innerHTML = `
    <div class="film-frame-actions">
      <button class="frame-action-btn save-btn" title="Download Image"><i data-lucide="download"></i></button>
      <button class="frame-action-btn delete-btn" title="Delete Image"><i data-lucide="trash-2"></i></button>
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
  
  // Actions
  el.querySelector('.save-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.download = `snipsnap_${photo.id}.jpg`;
    a.href = photo.dataUrl;
    a.click();
  });

  el.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`Discard negative frame #${num}?`)) {
      removePhoto(photo.id);
    }
  });

  el.addEventListener('click', () => openPolaroid(photo));
  elements.filmStrip.prepend(el);
  elements.filmStrip.scrollTo({ top: 0, behavior: 'smooth' });
  
  lucide.createIcons();
}

export function removePhoto(id) {
  state.photos = state.photos.filter(p => p.id !== id);
  const el = document.getElementById(id);
  if (el) el.remove();

  elements.photoCount.textContent = `${String(state.photos.length).padStart(2, '0')}/${state.maxPhotos}`;

  if (state.photos.length === 0) {
    if (elements.filmPlaceholder) elements.filmPlaceholder.style.display = 'flex';
    elements.btnClearFilm.setAttribute('disabled', 'true');
    elements.btnCollage.setAttribute('disabled', 'true');
  }
}

// --- Polaroid Share canvas creator ---
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
      // Draw image contain
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
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    alert('Copied image to clipboard! You can paste it directly.');
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    alert('Could not copy to clipboard in this browser. Try Downloading instead.');
  }
}

// --- Initialize Share & Menu UI handlers ---
export function initUI() {
  // Start System & Settings
  const themeBtns = document.querySelectorAll('.theme-btn');
  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveTheme(btn.getAttribute('data-theme'));
    });
  });

  // Footer UI toggles
  elements.btnToggleHud.addEventListener('click', () => {
    state.isHudActive = !state.isHudActive;
    elements.hudOverlay.classList.toggle('hud-hidden', !state.isHudActive);
    elements.btnToggleHud.classList.toggle('active', state.isHudActive);
  });

  elements.btnToggleLandmarks.addEventListener('click', () => {
    state.isTrackingActive = !state.isTrackingActive;
    elements.btnToggleLandmarks.classList.toggle('active', state.isTrackingActive);
  });

  elements.btnToggleMirror.addEventListener('click', () => {
    state.isMirrorActive = !state.isMirrorActive;
    elements.btnToggleMirror.classList.toggle('active', state.isMirrorActive);
  });

  // Clear negatives
  elements.btnClearFilm.addEventListener('click', () => {
    if (!state.photos.length) return;
    if (!confirm('Discard all film roll negatives?')) return;
    state.photos = [];
    state.frameCounter = 1;
    elements.filmStrip.querySelectorAll('.film-frame').forEach(f => f.remove());
    elements.filmPlaceholder.style.display = 'flex';
    elements.photoCount.textContent = `00/${state.maxPhotos}`;
    elements.btnClearFilm.setAttribute('disabled', 'true');
    elements.btnCollage.setAttribute('disabled', 'true');
  });

  // Collage actions
  elements.btnCollage.addEventListener('click', () => {
    if (state.photos.length === 0) return;
    elements.collageModal.classList.remove('collage-modal-hidden');
    renderCollagePreview();
  });

  elements.btnCollageClose.addEventListener('click', () => {
    elements.collageModal.classList.add('collage-modal-hidden');
  });

  elements.collageModal.querySelector('.collage-backdrop').addEventListener('click', () => {
    elements.collageModal.classList.add('collage-modal-hidden');
  });

  const layoutBtns = document.querySelectorAll('.layout-btn');
  layoutBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      layoutBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.collageLayout = btn.getAttribute('data-layout');
      renderCollagePreview();
    });
  });

  elements.collageTitleInput.addEventListener('input', renderCollagePreview);

  function renderCollagePreview() {
    renderCollage(
      elements.collageCanvas,
      state.photos,
      elements.collageTitleInput.value,
      state.activeTheme,
      state.collageLayout
    );
  }

  // Polaroid Modal bindings
  elements.btnPolaroidClose.addEventListener('click', closePolaroid);
  elements.polaroidModal.querySelector('.polaroid-backdrop').addEventListener('click', closePolaroid);

  // 4-Snapshot Popup bindings
  if (elements.btnPopupClose) {
    elements.btnPopupClose.addEventListener('click', closeSnapshotPopup);
  }
  if (elements.popup) {
    elements.popup.querySelector('.popup-backdrop').addEventListener('click', closeSnapshotPopup);
  }

  // Share menu triggers
  if (elements.btnPolaroidShare && elements.polaroidShareMenu) {
    elements.btnPolaroidShare.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.polaroidShareMenu.classList.toggle('hidden');
    });

    elements.polaroidShareMenu.querySelectorAll('.share-opt').forEach(btn => {
      btn.addEventListener('click', async (e) => {
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
      });
    });
  }

  if (elements.btnCollageShare && elements.collageShareMenu) {
    elements.btnCollageShare.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.collageShareMenu.classList.toggle('hidden');
    });

    elements.collageShareMenu.querySelectorAll('.share-opt').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        elements.collageShareMenu.classList.add('hidden');
        const action = btn.getAttribute('data-action');
        const canvas = elements.collageCanvas;
        if (action === 'download') {
          downloadCanvas(canvas, `snipsnap_collage_${Date.now()}.jpg`);
        } else if (action === 'copy') {
          await copyCanvasToClipboard(canvas);
        }
      });
    });
  }

  document.addEventListener('click', () => {
    if (elements.polaroidShareMenu) elements.polaroidShareMenu.classList.add('hidden');
    if (elements.collageShareMenu) elements.collageShareMenu.classList.add('hidden');
  });

  elements.btnToggleLandmarks.classList.toggle('active', state.isTrackingActive);
  elements.btnToggleMirror.classList.toggle('active', state.isMirrorActive);
  elements.btnToggleHud.classList.toggle('active', state.isHudActive);
  setActiveTheme('classic');
}
