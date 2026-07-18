with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# ─── Locate old calcRect ───
calc_start_marker = "function calcRect(cw, ch, hands) {"
start_idx = content.find(calc_start_marker)
if start_idx == -1:
    print("Error finding calcRect in app.js")
    exit(1)

# Find closing brace of old calcRect
depth = 0
i = start_idx
while i < len(content):
    if content[i] == '{':
        depth += 1
    elif content[i] == '}':
        depth -= 1
        if depth == 0:
            end_idx = i + 1
            break
    i += 1

old_calc = content[start_idx:end_idx]
print(f"Found calcRect, len={len(old_calc)}")

new_calc = """function calcRect(cw, ch, hands) {
  const activeHands = hands.filter(h => h.isL || h.isFolded);
  if (activeHands.length !== 2) return null;

  const lm0 = activeHands[0].landmarks;
  const lm1 = activeHands[1].landmarks;

  // 1. Same-hand double detection prevention:
  // Calculate wrist-to-wrist distance in pixels and reject if too close.
  const wristDist = Math.sqrt((lm0[0].x - lm1[0].x) ** 2 + (lm0[0].y - lm1[0].y) ** 2) * Math.max(cw, ch);
  const p0_0 = { x: lm0[0].x * cw, y: lm0[0].y * ch };
  const p9_0 = { x: lm0[9].x * cw, y: lm0[9].y * ch };
  const palmDist = Math.sqrt(dist2dSq(p0_0, p9_0));
  if (wristDist < palmDist * 2.5) {
    return null;
  }

  // Get physical L-corner intersection points for both hands
  const pt0 = getLCorner(lm0, cw, ch);
  const pt1 = getLCorner(lm1, cw, ch);
  if (!pt0 || !pt1) return null;

  // Ensure A is the left-most corner (smaller X) and B is the right-most corner (larger X)
  const A = pt0.x < pt1.x ? pt0 : pt1;
  const B = pt0.x < pt1.x ? pt1 : pt0;

  // Identify which landmark set belongs to A (left) and B (right)
  const lmA = pt0.x < pt1.x ? lm0 : lm1;
  const lmB = pt0.x < pt1.x ? lm1 : lm0;

  // Determine vertical direction from finger/wrist vectors:
  // - Left hand (A): index fingertip points UP (tip8 - wrist0)
  const tipA = { x: lmA[8].x * cw, y: lmA[8].y * ch };
  const wristA = { x: lmA[0].x * cw, y: lmA[0].y * ch };
  let vAx = tipA.x - wristA.x;
  let vAy = tipA.y - wristA.y;
  const lenVA = Math.sqrt(vAx*vAx + vAy*vAy);
  if (lenVA > 0.001) { vAx /= lenVA; vAy /= lenVA; }

  // - Right hand (B): index fingertip or thumb determines vertical axis
  const tipB = { x: lmB[8].x * cw, y: lmB[8].y * ch };
  const wristB = { x: lmB[0].x * cw, y: lmB[0].y * ch };
  let vBx = tipB.x - wristB.x;
  let vBy = tipB.y - wristB.y;
  const lenVB = Math.sqrt(vBx*vBx + vBy*vBy);
  if (lenVB > 0.001) { vBx /= lenVB; vBy /= lenVB; }

  // Average vertical direction pointing screen-up (negative Y)
  // Align vectors to point upwards (negative Y)
  if (vAy > 0) { vAx = -vAx; vAy = -vAy; }
  if (vBy > 0) { vBx = -vBx; vBy = -vBy; }
  let upX = vAx + vBx;
  let upY = vAy + vBy;
  const lenUp = Math.sqrt(upX*upX + upY*upY);
  if (lenUp > 0.001) {
    upX /= lenUp;
    upY /= lenUp;
  } else {
    upX = 0;
    upY = -1;
  }

  // Horizontal axis perpendicular to UP, pointing to the right
  const hzX = -upY;
  const hzY = upX;

  const dx = B.x - A.x;
  const dy = B.y - A.y;

  let center, W, H, theta, c1, c2, c3, c4, h3Bracket;

  // Check if hands are at the same level (horizontal/bottom gesture)
  if (Math.abs(dy) < Math.abs(dx) * 0.4) {
    // Both hands are at the bottom of the viewfinder.
    // Bottom-left corner = A, Bottom-right corner = B
    W = Math.max(40, Math.sqrt(dx*dx + dy*dy));
    // Average index-to-wrist span as the height
    H = Math.max(40, (lenVA + lenVB) * 0.5);
    theta = Math.atan2(B.y - A.y, B.x - A.x);

    // Center shifted UP by half height from midpoint of A and B
    center = {
      x: (A.x + B.x) * 0.5 + upX * (H * 0.5),
      y: (A.y + B.y) * 0.5 + upY * (H * 0.5)
    };

    c4 = A; // bottom-left
    c3 = B; // bottom-right
    c1 = { x: A.x + H * upX, y: A.y + H * upY }; // top-left
    c2 = { x: B.x + H * upX, y: B.y + H * upY }; // top-right
    h3Bracket = 'bottom-right';
  } else {
    // Diagonal gesture. A is bottom-left (larger Y), B is top-right (smaller Y).
    const V = { x: B.x - A.x, y: B.y - A.y };
    W = Math.max(40, Math.abs(V.x * hzX + V.y * hzY));
    H = Math.max(40, Math.abs(V.x * upX + V.y * upY));
    theta = Math.atan2(hzY, hzX);
    center = { x: (A.x + B.x) * 0.5, y: (A.y + B.y) * 0.5 };

    if (A.y > B.y) {
      // A is bottom-left, B is top-right
      c4 = A; // bottom-left
      c2 = B; // top-right
      c1 = { x: A.x + H * upX, y: A.y + H * upY }; // top-left
      c3 = { x: A.x + W * hzX, y: A.y + W * hzY }; // bottom-right
    } else {
      // A is top-left, B is bottom-right
      c1 = A; // top-left
      c3 = B; // bottom-right
      c4 = { x: A.x - H * upX, y: A.y - H * upY }; // bottom-left
      c2 = { x: A.x + W * hzX, y: A.y + W * hzY }; // top-right
    }
    h3Bracket = 'top-right';
  }

  return {
    center,
    width: W,
    height: H,
    theta,
    h1: A,
    h3: B,
    c1,
    c2,
    c3,
    c4,
    h3Bracket
  };
}"""

content = content[:start_idx] + new_calc + content[end_idx:]

# ─── Locate drawBorder ───
border_start_marker = "function drawBorder(rect, cfg) {"
b_start_idx = content.find(border_start_marker)
if b_start_idx == -1:
    print("Error finding drawBorder in app.js")
    exit(1)

b_depth = 0
j = b_start_idx
while j < len(content):
    if content[j] == '{':
        b_depth += 1
    elif content[j] == '}':
        b_depth -= 1
        if b_depth == 0:
            b_end_idx = j + 1
            break
    j += 1

old_border = content[b_start_idx:b_end_idx]
print(f"Found drawBorder, len={len(old_border)}")

new_border = """function drawBorder(rect, cfg) {
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
    ctx2d.moveTo(16, 0);   // Horizontal (pointing right)
    ctx2d.lineTo(0, 0);
    ctx2d.lineTo(0, -16);  // Vertical (pointing up)
    ctx2d.stroke();
    ctx2d.restore();
  }
  if (rect.h3) {
    ctx2d.save();
    ctx2d.translate(rect.h3.x, rect.h3.y);
    ctx2d.rotate(rect.theta);
    ctx2d.beginPath();
    if (rect.h3Bracket === 'bottom-right') {
      ctx2d.moveTo(-16, 0);  // Horizontal (pointing left)
      ctx2d.lineTo(0, 0);
      ctx2d.lineTo(0, -16);  // Vertical (pointing up)
    } else {
      ctx2d.moveTo(-16, 0);  // Horizontal (pointing left)
      ctx2d.lineTo(0, 0);
      ctx2d.lineTo(0, 16);   // Vertical (pointing down)
    }
    ctx2d.stroke();
    ctx2d.restore();
  }
}"""

content = content[:b_start_idx] + new_border + content[b_end_idx:]

with open('app.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("SUCCESS")
