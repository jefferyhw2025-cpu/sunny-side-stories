"""Reproducible, hand-composed social card for Sunny Side Stories.

This intentionally uses only drawing primitives, typography, and a restrained
paper texture. No generative image model or stock artwork is involved.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random

W, H = 1200, 630
S = 2
img = Image.new("RGB", (W*S, H*S), "#EEE9DF")
d = ImageDraw.Draw(img)

def box(xy, fill, radius=0, outline=None, width=1):
    xy = tuple(v*S for v in xy)
    if radius:
        d.rounded_rectangle(xy, radius*S, fill=fill, outline=outline, width=width*S)
    else:
        d.rectangle(xy, fill=fill, outline=outline, width=width*S)

def line(xy, fill, width=1): d.line(tuple(v*S for v in xy), fill=fill, width=width*S, joint="curve")
def ell(xy, fill, outline=None, width=1): d.ellipse(tuple(v*S for v in xy), fill=fill, outline=outline, width=width*S)
def poly(points, fill): d.polygon([(x*S,y*S) for x,y in points], fill=fill)

font_path = "/System/Library/Fonts/Hiragino Sans GB.ttc"
f_title = ImageFont.truetype(font_path, 86*S, index=0)
f_sub = ImageFont.truetype(font_path, 28*S, index=0)
f_tag = ImageFont.truetype(font_path, 18*S, index=0)
f_small = ImageFont.truetype(font_path, 15*S, index=0)

# Quiet editorial background and abstract sun.
box((0,0,W,H), "#F2EEE5")
ell((850,-210,1310,250), "#E5B94E")
poly([(0,450),(420,335),(720,390),(1200,265),(1200,630),(0,630)], "#B8C8B1")
poly([(0,500),(330,410),(710,470),(1200,350),(1200,630),(0,630)], "#718A78")

# Apartment block: simple architectural illustration, no miniature-toy gloss.
box((730,94,1082,466), "#D9CCB9", 5)
box((758,122,1054,438), "#EEE7DA", 3)
for yy in (150, 264):
    for xx in (785, 900):
        box((xx,yy,874 if xx==785 else 1027,yy+76), "#607E87", 2)
        line((xx+44,yy,xx+44,yy+76), "#EEE7DA", 3)
box((847,357,961,438), "#405A61", 2)
line((730,243,1082,243), "#887668", 7)
line((748,460,1100,460), "#384E4C", 8)

# Cafe awning and street details.
box((1015,286,1200,490), "#C7B59E", 3)
for i,c in enumerate(("#A94839","#EFE2CF","#A94839","#EFE2CF")):
    poly([(1015+i*50,286),(1065+i*50,286),(1055+i*50,345),(1005+i*50,345)], c)
box((1072,371,1160,490), "#3F5E62", 2)
ell((1120,465,1165,510), "#566D58")
line((1142,480,1142,535), "#3E5141", 5)

# Typography block with understated rule and label.
box((72,72,250,110), "#24383D", 19)
d.text((92*S,80*S), "原创生活模拟游戏", font=f_tag, fill="#F4EFE5")
d.text((66*S,132*S), "晴天生活", font=f_title, fill="#263A3F", stroke_width=1*S, stroke_fill="#263A3F")
line((70,242,500,242), "#B65345", 6)
d.text((70*S,270*S), "每一天，都是新故事。", font=f_sub, fill="#4C5B5A")
d.text((72*S,320*S), "认识邻居  ·  经营关系  ·  发现平凡日常里的意外", font=f_small, fill="#6A736F")

# Hand-drawn residents: more natural proportions, varied silhouettes.
def person(cx, ground, skin, hair, shirt, trousers, pose=0):
    # legs and shoes
    line((cx-12,ground-70,cx-16,ground-14), trousers, 18)
    line((cx+13,ground-70,cx+20,ground-14), trousers, 18)
    line((cx-27,ground-8,cx-7,ground-8), "#26383B", 10)
    line((cx+10,ground-8,cx+31,ground-8), "#26383B", 10)
    # torso and arms
    box((cx-42,ground-190,cx+43,ground-73), shirt, 22)
    if pose == 0:
        line((cx-34,ground-170,cx-65,ground-105), skin, 17)
        line((cx+34,ground-170,cx+72,ground-202), skin, 17)
    else:
        line((cx-34,ground-170,cx-69,ground-198), skin, 17)
        line((cx+34,ground-170,cx+63,ground-114), skin, 17)
    # neck and head
    box((cx-12,ground-221,cx+14,ground-183), skin, 8)
    ell((cx-49,ground-302,cx+50,ground-207), skin)
    # ears
    ell((cx-56,ground-267,cx-39,ground-238), skin)
    ell((cx+40,ground-267,cx+57,ground-238), skin)
    # hair as irregular silhouette
    ell((cx-52,ground-313,cx+49,ground-241), hair)
    poly([(cx-45,ground-274),(cx-29,ground-227),(cx-12,ground-268),(cx+7,ground-229),(cx+26,ground-269),(cx+46,ground-239),(cx+48,ground-290),(cx-45,ground-290)], hair)
    # restrained face
    ell((cx-24,ground-262,cx-18,ground-255), "#263238")
    ell((cx+20,ground-262,cx+26,ground-255), "#263238")
    line((cx-7,ground-237,cx+10,ground-237), "#8C493F", 3)

person(610,590,"#A96746","#252422","#D3A746","#354E55",0)
person(790,590,"#E1A77E","#70422D","#B85B48","#3E5962",1)
person(965,590,"#C88462","#2F2925","#57796D","#313C48",0)

# A few graphic-life motifs, kept sparse and intentional.
ell((535,378,565,408), "#F2EEE5", "#263A3F", 3)
line((548,386,548,399), "#B65345", 3)
line((548,386,558,383), "#B65345", 3)
ell((542,397,549,404), "#B65345")
box((1080,70,1138,128), "#F2EEE5", 29)
ell((1097,87,1121,111), "#C4912F")
for x1,y1,x2,y2 in ((1109,80,1109,85),(1109,113,1109,119),(1090,99,1095,99),(1123,99,1129,99),(1095,85,1099,89),(1119,109,1123,113),(1119,89,1123,85),(1095,113,1099,109)):
    line((x1,y1,x2,y2), "#C4912F", 2)
d.text((990*S,572*S), "SUNNY SIDE STORIES", font=ImageFont.truetype(font_path, 12*S, index=0), fill="#EAE4D9")

# Fine paper grain: subtle, deterministic, and distinctly non-rendered.
random.seed(18)
grain = Image.new("RGBA", img.size, (0,0,0,0))
gd = ImageDraw.Draw(grain)
for _ in range(15000):
    x, y = random.randrange(W*S), random.randrange(H*S)
    tone = random.choice(((55,48,42,12),(255,255,255,15)))
    gd.point((x,y), fill=tone)
grain = grain.filter(ImageFilter.GaussianBlur(.35*S))
img = Image.alpha_composite(img.convert("RGBA"), grain).convert("RGB")
img.resize((W,H), Image.Resampling.LANCZOS).save("public/og.png", quality=95)
print("public/og.png")
