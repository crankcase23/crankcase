#!/usr/bin/env python3
"""Reconstructs a US-market BMW door-jamb certification label (the customer's real photo is not in the repo) and writes
variants: clean, rotated, cropped, low-contrast, glare. Deterministic (no randomness). Usage: make-label-fixtures.py OUTDIR"""
import sys, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
out = sys.argv[1]
VIN = "WBAPH7C58AA175760"
F = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FM = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
W, H = 1600, 1000
img = Image.new("RGB", (W, H), (214, 214, 208))
d = ImageDraw.Draw(img)
d.rectangle((60, 60, W - 60, H - 60), fill=(238, 238, 234), outline=(40, 40, 40), width=4)
t = lambda xy, s, size, font=F, fill=(25, 25, 25): d.text(xy, s, font=ImageFont.truetype(font, size), fill=fill)
t((100, 90), "MFD. BY BMW AG", 44, FB)
t((900, 90), "DATE: 03/10", 44, FB)
t((100, 160), "GVWR: 4276 LBS (1940 KG)    GAWR FRT: 2183 LBS (990 KG)    GAWR RR: 2183 LBS (990 KG)", 30)
t((100, 205), "THIS VEHICLE CONFORMS TO ALL APPLICABLE U.S. FEDERAL MOTOR VEHICLE SAFETY,", 30)
t((100, 245), "BUMPER AND THEFT PREVENTION STANDARDS IN EFFECT ON THE DATE OF MANUFACTURE", 30)
t((100, 285), "SHOWN ABOVE.   THIS VEHICLE CONFORMS TO ALL APPLICABLE CANADIAN MOTOR VEHICLE", 30)
t((100, 325), "SAFETY STANDARDS IN EFFECT ON THE DATE OF MANUFACTURE.", 30)
t((100, 420), "VIN:", 52, FB)
t((260, 410), VIN, 78, FM)
t((100, 560), "TYPE: PASSENGER CAR     TIRE SIZE FRONT 225/50R17 94V   REAR 245/45R17 95V", 30)
t((100, 610), "COLD TIRE PRESSURE FRONT 32 PSI (220 KPA)   REAR 36 PSI (250 KPA)", 30)
img.save(f"{out}/bmw-label-clean.png")
def rot(im, deg):
    big = im.rotate(deg, resample=Image.BICUBIC, expand=True, fillcolor=(120, 120, 118))
    return big
rot(img, 7).save(f"{out}/bmw-label-rotated-7.png")
rot(img, -12).save(f"{out}/bmw-label-rotated-minus12.png")
img.crop((70, 130, 1500, 700)).save(f"{out}/bmw-label-cropped.png")
img.crop((80, 380, 1300, 520)).save(f"{out}/bmw-label-vin-strip.png")
low = ImageEnhance.Contrast(img).enhance(0.22)
low = ImageEnhance.Brightness(low).enhance(0.9)
low.save(f"{out}/bmw-label-lowcontrast.png")
g = img.copy(); gd = ImageDraw.Draw(g, "RGBA")
for r, a in ((380, 120), (260, 90), (150, 90)): gd.ellipse((1180 - r, 260 - r, 1180 + r, 260 + r), fill=(255, 255, 255, a))
g.filter(ImageFilter.GaussianBlur(1.2)).save(f"{out}/bmw-label-glare.png")
print("ok")
