"""Render the GitHub App logo (matches assets/icon.svg) as a PNG."""
import sys
from PIL import Image, ImageDraw

out = sys.argv[1]
FINAL = 512
S = 4 * FINAL  # supersample for smooth edges
u = S / 96     # icon.svg uses a 96-unit grid

BG = (31, 35, 40)        # #1f2328
GREEN = (0, 196, 154)    # #00C49A
WHITE = (255, 255, 255)

img = Image.new("RGB", (S, S), BG)
d = ImageDraw.Draw(img)

# Shrink the art toward the centre so it survives GitHub's circular crops.
scale, off = 0.78, 96 * (1 - 0.78) / 2
DY = -6  # lift the art so brackets + accent are vertically centred
P = lambda x, y: ((off + x * scale) * u, (off + (y + DY) * scale) * u)
W = 9 * u * scale  # stroke width


def stroke(points, color):
    pts = [P(*p) for p in points]
    d.line(pts, fill=color, width=round(W), joint="curve")
    r = W / 2
    for x, y in pts:  # round caps and joins
        d.ellipse((x - r, y - r, x + r, y + r), fill=color)


stroke([(30, 32), (14, 48), (30, 64)], GREEN)   # <
stroke([(66, 32), (82, 48), (66, 64)], GREEN)   # >
stroke([(42, 68), (54, 28)], WHITE)             # /

# Small commit-graph accent under the slash: dot - line - dot.
y = 80
cx0, cy0 = P(32, y); cx1, _ = P(64, y)
d.line((cx0, cy0, cx1, cy0), fill=GREEN, width=round(3 * u * scale))
for x in (32, 48, 64):
    cx, cy = P(x, y)
    r = 5 * u * scale
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=BG, outline=GREEN, width=round(3 * u * scale))

img.resize((FINAL, FINAL), Image.LANCZOS).save(out, optimize=True)
print(out, Image.open(out).size)
