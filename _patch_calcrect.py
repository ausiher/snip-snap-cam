with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

START = 'function calcRect(cw, ch, hands) {\n  const activeHands = hands.filter(h => h.isL || h.isFolded);\n  if (activeHands.length !== 2) return null;\n  const A = getLCorner(activeHands[0].landmarks, cw, ch);\n  const B = getLCorner(activeHands[1].landmarks, cw, ch);\n  if (!A || !B) return null;'

# Find the function start
start_idx = content.find(START)
if start_idx == -1:
    print('ERROR: could not find function start')
    exit(1)

# Find the closing brace of the function
# Walk from start_idx counting braces
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

old_func = content[start_idx:end_idx]
print(f'Found function, length={len(old_func)} chars')

new_func = r"""function calcRect(cw, ch, hands) {
  const activeHands = hands.filter(h => h.isL || h.isFolded);
  if (activeHands.length !== 2) return null;

  const lm0 = activeHands[0].landmarks;
  const lm1 = activeHands[1].landmarks;

  // Key points per hand
  const tip0   = { x: lm0[8].x * cw, y: lm0[8].y * ch }; // index fingertip
  const tip1   = { x: lm1[8].x * cw, y: lm1[8].y * ch };
  const wrist0 = { x: lm0[0].x * cw, y: lm0[0].y * ch }; // wrist base
  const wrist1 = { x: lm1[0].x * cw, y: lm1[0].y * ch };

  // "Up" axis = average wrist->tip direction across both hands.
  // In the viewfinder L-gesture the index fingers point HORIZONTALLY
  // toward each other. The wrist->tip vector always points along the
  // length of the finger, i.e. "up" relative to the frame (from the
  // hand base toward the top edge of the viewfinder).
  let u0x = tip0.x - wrist0.x, u0y = tip0.y - wrist0.y;
  let u1x = tip1.x - wrist1.x, u1y = tip1.y - wrist1.y;
  // Align both vectors so they don't cancel when hands face opposite ways
  if (u0x * u1x + u0y * u1y < 0) { u1x = -u1x; u1y = -u1y; }
  let upX = u0x + u1x, upY = u0y + u1y;
  const upLen = Math.sqrt(upX * upX + upY * upY);
  if (upLen < 5) return null;
  upX /= upLen; upY /= upLen;
  // Force screen-up (negative Y in canvas space)
  if (upY > 0) { upX = -upX; upY = -upY; }

  // Horizontal axis = perpendicular to "up"
  let hzX = -upY, hzY = upX;
  // Orient hz consistently from hand-0 toward hand-1
  const h01x = (wrist1.x + tip1.x) - (wrist0.x + tip0.x);
  const h01y = (wrist1.y + tip1.y) - (wrist0.y + tip0.y);
  if (hzX * h01x + hzY * h01y < 0) { hzX = -hzX; hzY = -hzY; }

  // Width = tip-to-tip projected onto hz (top edge of the viewfinder)
  const tipVecX = tip1.x - tip0.x, tipVecY = tip1.y - tip0.y;
  const W = Math.max(40, Math.abs(tipVecX * hzX + tipVecY * hzY));

  // Height = average wrist-to-tip span (side of the viewfinder)
  const h0 = Math.sqrt((tip0.x - wrist0.x) ** 2 + (tip0.y - wrist0.y) ** 2);
  const h1 = Math.sqrt((tip1.x - wrist1.x) ** 2 + (tip1.y - wrist1.y) ** 2);
  const H = Math.max(40, (h0 + h1) * 0.5);

  // Center = midpoint of the four natural corners
  const Cx = (tip0.x + tip1.x + wrist0.x + wrist1.x) / 4;
  const Cy = (tip0.y + tip1.y + wrist0.y + wrist1.y) / 4;

  const theta = Math.atan2(hzY, hzX);
  const hw = W * 0.5, hh = H * 0.5;

  // L-corner anchors for the bracket corner indicator in drawFrame
  const A = getLCorner(activeHands[0].landmarks, cw, ch) || tip0;
  const B = getLCorner(activeHands[1].landmarks, cw, ch) || tip1;

  return {
    center: { x: Cx, y: Cy },
    width: W, height: H, theta,
    h1: A, h3: B,
    c1: { x: Cx - hw * hzX - hh * upX, y: Cy - hw * hzY - hh * upY },
    c2: { x: Cx + hw * hzX - hh * upX, y: Cy + hw * hzY - hh * upY },
    c3: { x: Cx + hw * hzX + hh * upX, y: Cy + hw * hzY + hh * upY },
    c4: { x: Cx - hw * hzX + hh * upX, y: Cy - hw * hzY + hh * upY },
  };
}"""

result = content[:start_idx] + new_func + content[end_idx:]

with open('app.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write(result)

print('DONE')
