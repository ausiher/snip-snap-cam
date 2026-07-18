/**
 * Smile!! Mathematics & Geometry Module
 */

export function dist2dSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Correctly wraps angle differences around [-PI, PI] to prevent spins
export function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * t;
}

export function lineIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1x = bx - ax, d1y = by - ay;
  const d2x = dx - cx, d2y = dy - cy;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-8) return null;
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / denom;
  return { x: ax + t * d1x, y: ay + t * d1y };
}

export function detectLGesture(lm) {
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

// Shutter-trigger: Index tip folded, other fingers (including thumb) extended/curled as in L shape
export function detectIndexFold(lm) {
  const palmSq = dist2dSq(lm[0], lm[9]);
  if (palmSq < 0.0001) return false;

  const wrist = lm[0];
  // Index Tip (8) close to Index MCP (5)
  const isIndexFolded = dist2dSq(lm[8], lm[5]) < palmSq * 0.45;
  const isThumbExt  = dist2dSq(lm[4], wrist) > dist2dSq(lm[3], wrist);
  const isMiddleCurled = dist2dSq(lm[12], wrist) < dist2dSq(lm[10], wrist);
  const isRingCurled   = dist2dSq(lm[16], wrist) < dist2dSq(lm[14], wrist);
  const isPinkyCurled  = dist2dSq(lm[20], wrist) < dist2dSq(lm[18], wrist);

  return isIndexFolded && isThumbExt && isMiddleCurled && isRingCurled && isPinkyCurled;
}

// Thumbs-up gesture detection: thumb pointing up, other 4 fingers curled
export function detectThumbsUp(lm) {
  const wrist = lm[0];
  const palmSq = dist2dSq(lm[0], lm[9]);
  if (palmSq < 0.0001) return false;

  // Other four fingers must be curled (tip close to base knuckle)
  const isIndexCurled  = dist2dSq(lm[8], lm[5]) < palmSq * 0.65;
  const isMiddleCurled = dist2dSq(lm[12], lm[9]) < palmSq * 0.65;
  const isRingCurled   = dist2dSq(lm[16], lm[13]) < palmSq * 0.65;
  const isPinkyCurled  = dist2dSq(lm[20], lm[17]) < palmSq * 0.65;

  // Thumb must be extended relative to wrist
  const isThumbExt = dist2dSq(lm[4], wrist) > dist2dSq(lm[2], wrist) * 1.35;

  // Thumb tip is above the thumb MCP/knuckle joints (y decreases going up)
  const isThumbPointingUp = lm[4].y < lm[3].y && lm[3].y < lm[2].y;

  // Thumb tip is higher than other knuckles
  const isHigherThanKnuckles = lm[4].y < lm[5].y && lm[4].y < lm[9].y && lm[4].y < lm[13].y;

  return isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled && isThumbExt && isThumbPointingUp && isHigherThanKnuckles;
}

export function getLCorner(lm, cw, ch) {
  const p2 = { x: lm[2].x * cw, y: lm[2].y * ch };
  const p4 = { x: lm[4].x * cw, y: lm[4].y * ch };
  const p5 = { x: lm[5].x * cw, y: lm[5].y * ch };
  const p8 = { x: lm[8].x * cw, y: lm[8].y * ch };

  const pt = lineIntersect(p2.x, p2.y, p4.x, p4.y, p5.x, p5.y, p8.x, p8.y);

  // Compute palm size to check if intersection is sane
  const p0 = { x: lm[0].x * cw, y: lm[0].y * ch };
  const p9 = { x: lm[9].x * cw, y: lm[9].y * ch };
  const palmDist = Math.sqrt(dist2dSq(p0, p9));

  if (pt) {
    const distSq = dist2dSq(pt, p5);
    if (distSq < (palmDist * 2.5) * (palmDist * 2.5)) {
      return pt;
    }
  }

  return { x: (p2.x + p5.x) * 0.5, y: (p2.y + p5.y) * 0.5 };
}

export function calcRect(cw, ch, hands) {
  const activeHands = hands.filter(h => h.isL || h.isFolded);
  if (activeHands.length !== 2) return null;

  const A = getLCorner(activeHands[0].landmarks, cw, ch);
  const B = getLCorner(activeHands[1].landmarks, cw, ch);
  if (!A || !B) return null;

  const lm0 = activeHands[0].landmarks;

  // Establish local Y-axis (v) along Hand 0's index finger (MCP 5 -> Tip 8)
  const idxDx = lm0[8].x * cw - A.x;
  const idxDy = lm0[8].y * ch - A.y;
  const idxLen = Math.sqrt(idxDx * idxDx + idxDy * idxDy);
  if (idxLen < 1) return null;
  const vx = idxDx / idxLen, vy = idxDy / idxLen;

  // Establish local X-axis (u) perpendicular to v, pointing in the thumb's direction
  const thbDx = lm0[4].x * cw - A.x;
  const thbDy = lm0[4].y * ch - A.y;
  let ux = -vy, uy = vx;
  if (ux * thbDx + uy * thbDy < 0) {
    ux = vy;
    uy = -vx;
  }

  // Get palm size of Hand 0 to scale the inset margin
  const p0 = { x: lm0[0].x * cw, y: lm0[0].y * ch };
  const p9 = { x: lm0[9].x * cw, y: lm0[9].y * ch };
  const palmSize = Math.sqrt(dist2dSq(p0, p9));
  const margin = palmSize * 0.42;

  // Project diagonal vector D = B - A onto the local axes
  const Dx = B.x - A.x, Dy = B.y - A.y;
  const d_u = Dx * ux + Dy * uy;
  const d_v = Dx * vx + Dy * vy;

  // Subtract margin to pull the boundaries inside (away from fingers)
  const W = Math.max(40, Math.abs(d_u) - margin * 2);
  const H = Math.max(40, Math.abs(d_v) - margin * 2);

  const Cx = (A.x + B.x) * 0.5;
  const Cy = (A.y + B.y) * 0.5;
  
  let theta = Math.atan2(uy, ux);
  while (theta < -Math.PI / 2) theta += Math.PI;
  while (theta > Math.PI / 2) theta -= Math.PI;

  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const u_norm_x = cosT, u_norm_y = sinT;
  const v_norm_x = -sinT, v_norm_y = cosT;

  const hw = W * 0.5;
  const hh = H * 0.5;

  return {
    center: { x: Cx, y: Cy },
    width: W,
    height: H,
    theta,
    h1: A,
    h3: B,
    c1: { x: Cx - hw * u_norm_x - hh * v_norm_x, y: Cy - hw * u_norm_y - hh * v_norm_y },
    c2: { x: Cx + hw * u_norm_x - hh * v_norm_x, y: Cy + hw * u_norm_y - hh * v_norm_y },
    c3: { x: Cx + hw * u_norm_x + hh * v_norm_x, y: Cy + hw * u_norm_y + hh * v_norm_y },
    c4: { x: Cx - hw * u_norm_x + hh * v_norm_x, y: Cy - hw * u_norm_y + hh * v_norm_y }
  };
}


