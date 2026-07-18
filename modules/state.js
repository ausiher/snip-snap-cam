/**
 * Smile!! Camera State Module
 */
export const state = {
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
  
  // Smoothed focus crop and cinematic fade variables
  smoothedRect: null,
  focusProgress: 0.0,
  collageLayout: 'grid',

  // New state variables for 4-shot review popup
  popupOpen: false,
  popupClosing: false,
  rollOpen: false
};
