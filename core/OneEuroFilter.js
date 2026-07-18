/**
 * Low-pass filter helper
 */
class LowPassFilter {
  constructor(alpha = 1.0, initVal = 0.0) {
    this.alpha = alpha;
    this.hatx = initVal;
    this.hatxPrev = initVal;
    this.initialized = false;
  }

  setAlpha(alpha) {
    this.alpha = alpha;
  }

  filter(value) {
    let result;
    if (!this.initialized) {
      this.initialized = true;
      result = value;
    } else {
      result = this.alpha * value + (1.0 - this.alpha) * this.hatxPrev;
    }
    this.hatxPrev = result;
    this.hatx = result;
    return result;
  }
}

/**
 * OneEuroFilter
 * A low-latency filter for noisy signals. Highly recommended for facial landmark coordinates.
 */
export class OneEuroFilter {
  constructor(minCutoff = 1.0, beta = 0.0, dcutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dcutoff = dcutoff;
    
    this.xFilter = new LowPassFilter();
    this.dxFilter = new LowPassFilter();
    
    this.xPrev = 0;
    this.initialized = false;
  }

  filter(value, dt) {
    if (dt <= 0) return value;
    
    const rate = 1000 / dt; // dt is in ms, rate in Hz

    // Calculate current derivative
    let dx = 0;
    if (!this.initialized) {
      this.initialized = true;
      dx = 0;
    } else {
      dx = (value - this.xPrev) * rate;
    }
    this.xPrev = value;

    // Filter derivative
    const alphaD = this.calculateAlpha(this.dcutoff, rate);
    this.dxFilter.setAlpha(alphaD);
    const edx = this.dxFilter.filter(dx);

    // Filter value using adaptive cutoff frequency
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const alpha = this.calculateAlpha(cutoff, rate);
    this.xFilter.setAlpha(alpha);
    
    return this.xFilter.filter(value);
  }

  calculateAlpha(cutoff, rate) {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }
}
