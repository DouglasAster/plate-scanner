"""Generates the app icon images in assets/: a white license plate inside scanner
corner brackets, with a red scan line across it, on the app's red background.

Usage: python3 scripts/make-icons.py   (needs Pillow: pip install pillow)

Writes:
  icon.png                      1024x1024, iOS and general app icon (no transparency)
  android-icon-background.png   512x512, adaptive icon background
  android-icon-foreground.png   512x512, adaptive icon foreground (transparent)
  android-icon-monochrome.png   432x432, Android 13+ themed icon (white silhouette)
"""
from pathlib import Path

from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parent.parent / 'assets'
SS = 4  # supersampling factor for smooth edges

RED_TOP = (200, 18, 18)
RED_BOTTOM = (122, 0, 0)
WHITE = (255, 255, 255, 255)
INK = (24, 24, 24, 255)
SCAN = (255, 42, 42, 255)
CLEAR = (0, 0, 0, 0)


def gradient(size):
    img = Image.new('RGBA', (size, size))
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        c = tuple(round(a + (b - a) * t) for a, b in zip(RED_TOP, RED_BOTTOM)) + (255,)
        for x in range(size):
            px[x, y] = c
    return img


def draw_mark(size, scale=1.0, mono=False):
    """The plate and brackets on a transparent square of `size` pixels. `scale` shrinks
    the artwork about the center (adaptive icons must fit a smaller safe zone).
    `mono` draws a single-color silhouette with the plate's markings cut out."""
    big = size * SS
    img = Image.new('RGBA', (big, big), CLEAR)
    d = ImageDraw.Draw(img)
    u = big / 1024 * scale  # artwork is designed on a 1024 grid
    cx = cy = big / 2

    def box(x0, y0, x1, y1):  # 1024-grid coordinates relative to center -> pixels
        return [cx + x0 * u, cy + y0 * u, cx + x1 * u, cy + y1 * u]

    # Scanner corner brackets around the plate.
    w, h, arm, t = 370, 225, 150, 46
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * w, sy * h
            d.rounded_rectangle(box(min(x, x - sx * arm), y - t / 2, max(x, x - sx * arm), y + t / 2), radius=t / 2 * u, fill=WHITE)
            d.rounded_rectangle(box(x - t / 2, min(y, y - sy * arm), x + t / 2, max(y, y - sy * arm)), radius=t / 2 * u, fill=WHITE)

    # The plate (2:1, like a US plate).
    d.rounded_rectangle(box(-290, -145, 290, 145), radius=38 * u, fill=WHITE)
    cut = CLEAR if mono else INK
    # Mounting holes.
    for x in (-200, 200):
        d.ellipse(box(x - 14, -118, x + 14, -90), fill=cut)
    # Plate characters, drawn as blocks so the icon reads at any size.
    cw, gap, n = 62, 22, 6
    x0 = -(n * cw + (n - 1) * gap) / 2
    for i in range(n):
        x = x0 + i * (cw + gap)
        d.rounded_rectangle(box(x, -62, x + cw, 78), radius=12 * u, fill=cut)
    # Scan line across the plate and between the brackets.
    if not mono:
        d.rounded_rectangle(box(-345, -9, 345, 9), radius=9 * u, fill=SCAN)

    return img.resize((size, size), Image.LANCZOS)


def main():
    icon = gradient(1024)
    icon.alpha_composite(draw_mark(1024, scale=0.92))
    icon.convert('RGB').save(ASSETS / 'icon.png')

    # Android adaptive icons: the launcher masks a 108dp layer to a shape and only the
    # center 66% is guaranteed visible, so the artwork is shrunk to fit that zone.
    gradient(512).save(ASSETS / 'android-icon-background.png')
    draw_mark(512, scale=0.64).save(ASSETS / 'android-icon-foreground.png')
    draw_mark(432, scale=0.64, mono=True).save(ASSETS / 'android-icon-monochrome.png')

    print('wrote icons to', ASSETS)


if __name__ == '__main__':
    main()
