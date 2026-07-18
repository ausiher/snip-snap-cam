/**
 * Smile!! Web Audio Synthesizer Module
 */
import { state } from './state.js';

export function initAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

export function playFocusBeep() {
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

export function playShutterSound() {
  if (!state.audioCtx) return;
  const now = state.audioCtx.currentTime;
  
  // Mirror slap thud
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
  
  // Shutter leaf snap
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

export function playTickSound() {
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

// Confirmation beep for thumbs-up popup closing
export function playConfirmBeep() {
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
