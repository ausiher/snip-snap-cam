with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Locate function getLCorner closing brace
marker = "return { x: (p2.x + p5.x) * 0.5, y: (p2.y + p5.y) * 0.5 };\n}"
idx = content.find(marker)
if idx == -1:
    print("Error finding getLCorner end")
    exit(1)

insert_pos = idx + len(marker)

new_calc_rect = """

function calcRect(cw, ch, hands) {
  const activeHands = hands.filter(h => h.isL || h.isFolded);
  if (activeHands.length !== 2) return null;

  const A = getLCorner(activeHands[0].landmarks, cw, ch);
  const B = getLCorner(activeHands[1].landmarks, cw, ch);
  if (!A || !B) return null;

  const lm0 = activeHands[0].landmarks;
  const lm1 = activeHands[1].landmarks;

  // Horizontal axis: vector pointing from corner A to corner B (the top edge)
  let hzX = B.x - A.x;
  let hzY = B.y - A.y;
  const W = Math.sqrt(hzX * hzX + hzY * hzY);
  if (W < 5) return null;

  // Normalize horizontal axis
  hzX /= W;
  hzY /= W;

  // Vertical axis: perpendicular pointing downwards on the screen (positive Y)
  // since the index fingers form the top horizontal edge and the viewfinder
  // extends down toward the wrists.
  const upX = -hzY;
  const upY = hzX;

  // Height: average wrist-to-index finger length to define vertical span
  const i0x = lm0[8].x * cw - lm0[0].x * cw;
  const i0y = lm0[8].y * ch - lm0[0].y * ch;
  const i1x = lm1[8].x * cw - lm1[0].x * cw;
  const i1y = lm1[8].y * ch - lm1[0].y * ch;
  const H = (Math.sqrt(i0x*i0x + i0y*i0y) + Math.sqrt(i1x*i1x + i1y*i1y)) * 0.5;

  // Center: midpoint of the top edge (A to B) shifted down by half the height
  const Cx = (A.x + B.x) * 0.5 + upX * (H * 0.5);
  const Cy = (A.y + B.y) * 0.5 + upY * (H * 0.5);

  const theta = Math.atan2(hzY, hzX);
  const hw = W * 0.5;
  const hh = H * 0.5;

  return {
    center: { x: Cx, y: Cy },
    width: W,
    height: H,
    theta,
    h1: A,
    h3: B,
    c1: { x: Cx - hw * hzX - hh * upX, y: Cy - hw * hzY - hh * upY }, // top-left (A)
    c2: { x: Cx + hw * hzX - hh * upX, y: Cy + hw * hzY - hh * upY }, // top-right (B)
    c3: { x: Cx + hw * hzX + hh * upX, y: Cy + hw * hzY + hh * upY }, // bottom-right
    c4: { x: Cx - hw * hzX + hh * upX, y: Cy - hw * hzY + hh * upY }  // bottom-left
  };
}"""

# Find and replace the placeholder calcRect in app.js
# First let's remove the old function calcRect entirely.
# We will construct new contents.
# Locate the old calcRect in the original file.
original_calc_start = content.find("function calcRect(cw, ch, hands) {")
if original_calc_start == -1:
    print("Error finding old calcRect")
    exit(1)

# Find closing brace of old calcRect
depth = 0
i = original_calc_start
while i < len(content):
    if content[i] == '{':
        depth += 1
    elif content[i] == '}':
        depth -= 1
        if depth == 0:
            original_calc_end = i + 1
            break
    i += 1

updated_content = content[:original_calc_start] + new_calc_rect.strip() + content[original_calc_end:]

with open('app.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write(updated_content)

print("SUCCESS")
