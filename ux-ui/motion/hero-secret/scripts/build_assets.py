#!/usr/bin/env python3
"""Cut the hero images into the layers the hero loop animates.

    python3 scripts/build_assets.py <dir with the 01-hero jpegs> [--web <path to apps/web>]

Always writes the film's layers (dark, desktop): assets/ and the shard markup between the
`shard:start` / `shard:end` markers of compositions/hero.html. With --web it also writes what
the landing page uses, for both themes and both screen shapes:
public/images/hero-secret/{dark,light}/ and src/components/marketing/hero-secret.generated.css.
Needs numpy, scipy and Pillow.
"""
import math
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

DISP = 0.60  # canvas px per px of secret-shard.jpeg
STORE = 0.75  # sprites are stored at this fraction of the source and shown at DISP / STORE
OVER_BG, OVER_FG = 1.08, 1.2  # the plates are larger than the canvas, so drifting never shows an edge
T_FRAG = 0.08  # how much brighter than the glow a pixel is before it counts as a floating piece
MERGE = 2  # px: pieces closer than twice this travel as one clump
MIN_AREA = 14  # px: smaller specks melt into the glow
GATE = 0.03  # alpha below this is jpeg noise, not glass
R_CAP = 500  # canvas px: no orbit is wider than this, however far above the ring a piece sits
OFF_RING = 330  # canvas px above or below the centre: past it is the light image's floor shadow
CORE = {False: 0.43, True: 0.2}  # the crystal against its ground; the light one has pale faces
FG_NEAR, FG_MID = 4, 4  # the largest N flakes are the near layer, the next M the middle one
WEB_PIECES = 90  # the page animates only the largest pieces (hero-secret.tsx: HERO_PIECES)
LOOP = 16  # s: one turn of the ring (hero-secret.css: --loop; hero.html: the film's length)
DEPTH = 0.2  # a piece is this much larger on the near side of its orbit (hero.html: --depth)
LIFT = 60  # px toward the camera on the near side: it only sorts the pieces around the crystal
SHAPES = {"desktop": (1920, 1080), "mobile": (1080, 1920)}
LIME = (0.64, 0.90, 0.21)  # #A3E635
ROOT = Path(__file__).resolve().parent.parent
SCENE = ROOT / "compositions" / "hero.html"


def load(path, size=None, light=False):
    """An image as floats. A light-theme image comes back inverted, so that in both themes
    the subject is what is brighter than its ground; `save` turns the colours back."""
    im = Image.open(path).convert("RGB")
    if size:
        w, h = im.size
        cw = min(w, round(h * size[0] / size[1]))
        ch = min(h, round(cw * size[1] / size[0]))
        x0, y0 = (w - cw) // 2, (h - ch) // 2
        im = im.crop((x0, y0, x0 + cw, y0 + ch)).resize(size, Image.LANCZOS)
    img = np.asarray(im).astype(np.float32) / 255
    return 1 - img if light else img


def blur(x, s):
    return ndi.gaussian_filter(x, (s, s, 0) if x.ndim == 3 else s)


def resize(x, size, how):
    return np.asarray(Image.fromarray(np.ascontiguousarray(x, np.float32)).resize(size, how))


def fill(img, known):
    """Replace the unknown pixels with a soft blur of the known ones (worked out at quarter size)."""
    h, w = known.shape
    q = (w // 4, h // 4)
    k = resize(known, q, Image.BOX)
    src = np.dstack([resize(img[..., c] * known, q, Image.BOX) for c in range(3)])
    out = np.zeros_like(src)
    done = np.zeros_like(k)
    for s in (1.5, 4, 11, 30):  # the nearest scale that reaches a hole wins
        den = blur(k, s)
        est = blur(src, s) / np.maximum(den, 1e-4)[..., None]
        wgt = np.clip(den * 4, 0, 1) * (1 - done)
        out += est * wgt[..., None]
        done += wgt
    out += est * (1 - done)[..., None]
    out = np.dstack([resize(out[..., c], (w, h), Image.BICUBIC) for c in range(3)])
    return np.where(known[..., None], img, out)


def matte(img, under, solid=None, gate=0.0):
    """RGBA that gives `img` back when laid over `under`, with the least alpha that can."""
    a = np.clip(((img - under) / np.maximum(1 - under, 1e-3)).max(2), 0, 1)
    a = np.clip((a - gate) / (1 - gate), 0, 1)
    if solid is not None:
        a = np.maximum(a, solid)
    rgb = (img - (1 - a[..., None]) * under) / np.maximum(a[..., None], 1e-3)
    return np.dstack([np.clip(rgb, 0, 1), a])


def scaled(rgba, scale):
    """Resize premultiplied, so a soft edge never picks up the colour hidden under zero alpha."""
    size = (max(1, round(rgba.shape[1] * scale)), max(1, round(rgba.shape[0] * scale)))
    pm = np.dstack([rgba[..., :3] * rgba[..., 3:], rgba[..., 3:]])
    pm = np.dstack([resize(pm[..., c], size, Image.LANCZOS) for c in range(4)])
    a = np.clip(pm[..., 3:], 0, 1)
    return np.dstack([np.clip(pm[..., :3] / np.maximum(a, 1e-3), 0, 1), a])


def save(arr, path, quality=88, light=False):
    arr = np.clip(arr, 0, 1)
    if light:
        arr = np.dstack([1 - arr[..., :3], arr[..., 3:]])
    mode = "RGBA" if arr.shape[2] == 4 else "RGB"
    Image.fromarray((arr * 255 + 0.5).astype(np.uint8), mode).save(path, quality=quality, method=6)
    print(f"  {path.parent.name}/{path.name} {arr.shape[1]}x{arr.shape[0]} {path.stat().st_size // 1024} KB")


def cut_plate(path, out, size, quality, light=False):
    """The background. The light one is divided by its paper colour, so it meets a white page."""
    img = load(path, size)
    if light:
        img = img / np.median(img.reshape(-1, 3), 0)
    save(img, out, quality)


def cut_particles(path, out, tag, size, scale=1.0, light=False):
    """The out-of-focus flakes, split by size into three depths (alpha from their own light)."""
    img = load(path, size, light)
    lum = img.max(2)
    # The haze that joins the flakes into one blob: an opening wider than any of them (quarter size).
    haze = ndi.grey_opening(resize(lum, (size[0] // 4, size[1] // 4), Image.BOX), size=110)
    haze = resize(blur(haze, 8), size, Image.BICUBIC)
    img = img * np.clip(1 - haze / np.maximum(lum, 1e-3), 0, 1)[..., None]
    lab, n = ndi.label(blur(img.max(2), 2) > 0.08)
    area = ndi.sum(lab > 0, lab, range(1, n + 1))
    order = [i + 1 for i in np.argsort(area)[::-1] if area[i] > 500]
    for name, ids in (("near", order[:FG_NEAR]), ("mid", order[FG_NEAR : FG_NEAR + FG_MID]), ("far", order[FG_NEAR + FG_MID :])):
        mask = np.clip(blur(ndi.binary_dilation(np.isin(lab, ids), iterations=14).astype(np.float32), 8), 0, 1)
        layer = img * mask[..., None]
        a = layer.max(2)
        save(scaled(np.dstack([layer / np.maximum(a, 1e-3)[..., None], a]), scale), out / f"fg-{name}{tag}.webp", 84, light)


def read_shard(path, light):
    """The crystal, the crystal with its tight bloom, and what floats around it."""
    img = load(path, light=light)
    lum = img.max(2)
    lab, n = ndi.label(lum > CORE[light])
    core = ndi.binary_fill_holes(lab == 1 + np.argmax(ndi.sum(lum > 0, lab, range(1, n + 1))))
    near = ndi.binary_dilation(core, iterations=24)
    # What floats: brighter than a rough glow (an opening wider than any piece), away from the crystal.
    lit = (lum - blur(ndi.grey_opening(lum, size=61), 8) > T_FRAG) & ~near
    return img, core, near, lit


def cut_shard(skins, limit=None):
    """The crystal, its glow, the lime seam and the floating pieces, each with the orbit that
    passes through where it sits. `skins` is [(image, output folder, light?)], the dark one
    first: the two images share a pose, so the layout is read from the dark one, where the
    pieces glow against black, and every skin is cut along the same lines. Returns that
    layout, in canvas px from the shard's centre."""
    geo = None
    for path, out, light in skins:
        img, core, near, lit = read_shard(path, light)
        floating = ndi.binary_dilation(lit, iterations=MERGE)
        if geo is None:
            lab, n = ndi.label(floating)
            keep = 1 + np.flatnonzero(ndi.sum(lit, lab, range(1, n + 1)) >= MIN_AREA)
            cy0, cx0 = ndi.center_of_mass(core)
            ys, xs = np.where(near)
            y0, y1, x0, x1 = ys.min() - 4, ys.max() + 5, xs.min() - 4, xs.max() + 5  # the crystal's box
            hole = near | np.isin(lab, keep)

        # The glow alone: the crystal and the pieces filled in from around them, grain blurred away.
        glow = blur(fill(img, ~(hole | near | floating)), 5)
        floor = np.median(img[:80, :80].reshape(-1, 3), 0)  # the flat ground the image was rendered on
        half = 800
        gy, gx = round(cy0) - half, round(cx0) - half
        g = np.clip((glow[gy : gy + 2 * half, gx : gx + 2 * half] - floor) / (1 - floor), 0, 1)
        yy, xx = np.mgrid[-half:half, -half:half]
        fade = np.clip((half - np.hypot(xx, yy)) / 150, 0, 1)  # zero before the crop's edge
        save(scaled(np.dstack([g / np.maximum(g.max(2), 1e-3)[..., None], g.max(2) * fade]), 0.375), out / "shard-glow.webp", light=light)

        # The crystal: solid inside, and around it the alpha that puts its bloom back over the glow.
        solid = np.clip(blur(ndi.binary_erosion(core, iterations=3).astype(np.float32), 1.5) * 1.2, 0, 1)
        rgba = matte(img, glow, solid)
        rgba[..., 3] *= blur(ndi.binary_erosion(near, iterations=4).astype(np.float32), 2)
        save(scaled(rgba[y0:y1, x0:x1], STORE), out / "shard-core.webp", 92, light)

        # The seam: the lime inside the crystal, as a bloom the loop fades in on each beat.
        true = 1 - img if light else img
        green = np.clip((true[..., 1] - np.maximum(true[..., 0], true[..., 2])) / 0.25, 0, 1) * core
        r = 200
        if geo is None:
            sy0, sx0 = (round(c) - r for c in ndi.center_of_mass(green))
        crop = green[sy0 : sy0 + 2 * r, sx0 : sx0 + 2 * r]
        wide = blur(crop, 26)
        bloom = np.clip(0.9 * blur(crop, 4) + 0.5 * wide / wide.max(), 0, 1)
        save(scaled(np.dstack([np.broadcast_to(np.float32(LIME), (*crop.shape, 3)), bloom]), STORE), out / "shard-seam.webp")

        rgba = matte(img, glow, gate=GATE)
        if geo is None:
            geo, plan = lay_out(rgba, lab, keep, cx0, cy0, limit)
            geo["glow"] = (-half * DISP, -half * DISP, 2 * half * DISP, 2 * half * DISP)
            geo["crystal"] = ((x0 - cx0) * DISP, (y0 - cy0) * DISP, (x1 - x0) * DISP, (y1 - y0) * DISP)
            geo["origin"] = ((cx0 - x0) * DISP, (cy0 - y0) * DISP)
            geo["seam"] = ((sx0 - x0) * DISP, (sy0 - y0) * DISP, 2 * r * DISP, 2 * r * DISP)  # inside the crystal's box

        # The pieces: one sprite each, all on one sheet.
        sheet = np.zeros((round(geo["sheet"][1] * STORE / DISP), round(geo["sheet"][0] * STORE / DISP), 4), np.float32)
        for label, sl, (x, y) in plan:
            cut = rgba[sl].copy()
            cut[..., 3] *= lab[sl] == label
            cut = scaled(cut, STORE)
            sheet[y : y + cut.shape[0], x : x + cut.shape[1]] = cut
        save(sheet, out / "shard-pieces.webp", 92, light)
    return geo


def lay_out(rgba, lab, keep, cx0, cy0, limit):
    """Where each piece sits, the ring they lie on, their place on the sprite sheet and the
    orbit each one gets. Returns the layout and, for cutting, [(label, slice, sheet x y)]."""
    boxes = ndi.find_objects(lab)
    cuts = []
    for label in keep:
        sl = tuple(slice(max(s.start - 2, 0), s.stop + 2) for s in boxes[label - 1])
        mass = float((rgba[sl][..., 3] * (lab[sl] == label)).sum())
        dx = ((sl[1].start + sl[1].stop) / 2 - cx0) * DISP
        dy = ((sl[0].start + sl[0].stop) / 2 - cy0) * DISP
        if mass < 4 or abs(dy) > OFF_RING:
            continue
        size = tuple(max(1, round((s.stop - s.start) * STORE)) for s in sl)  # as `scaled` rounds it
        cuts.append({"label": label, "sl": sl, "h": size[0], "w": size[1], "dx": dx, "dy": dy, "mass": mass})
    cuts.sort(key=lambda c: -c["mass"])

    # The ring: its long axis on screen and how flat it looks from the camera.
    d = np.array([[c["dx"], c["dy"]] for c in cuts])
    lam, vec = np.linalg.eigh(np.cov(d.T, aweights=np.sqrt([c["mass"] for c in cuts])))
    tilt = (math.atan2(vec[1, 1], vec[0, 1]) + math.pi / 2) % math.pi - math.pi / 2
    squash = float(np.clip(math.sqrt(lam[0] / lam[1]), 0.28, 0.5))
    ca, sa = math.cos(tilt), math.sin(tilt)
    cuts = cuts[:limit]

    # One sheet for all of them, tallest first.
    sheet_w, x, y, row = 1024, 0, 0, 0
    for c in sorted(cuts, key=lambda c: -c["h"]):
        if x + c["w"] > sheet_w:
            x, y, row = 0, y + row + 2, 0
        c["at"] = (x, y)
        x, row = x + c["w"] + 2, max(row, c["h"])
    k = DISP / STORE
    geo = {"ring": (ca, sa), "sheet": (sheet_w * k, (y + row) * k), "pieces": []}

    rng = np.random.default_rng(7)
    for c in cuts:
        u, v = c["dx"] * ca + c["dy"] * sa, -c["dx"] * sa + c["dy"] * ca  # along and across the ring
        q = max(squash, abs(v) / R_CAP)
        wobble = (14, 40) if c["mass"] < 400 else (4, 10)  # small pieces tumble more
        geo["pieces"].append({
            "w": c["w"] * k, "h": c["h"] * k, "x": c["at"][0] * k, "y": c["at"][1] * k,
            "r": math.hypot(u, v / q), "th": math.atan2(v / q, u), "q": q,
            "bob": rng.uniform(3, 9), "ph": rng.uniform(0, 1), "rot": rng.choice([-1, 1]) * rng.uniform(*wobble),
        })  # fmt: skip
    radii = [p["r"] for p in geo["pieces"]]
    print(f"  {len(cuts)} pieces, ring tilt {math.degrees(tilt):.1f} deg, squash {squash:.2f}, radius p10/p50/p90 {np.percentile(radii, [10, 50, 90]).round().tolist()}")
    return geo, [(c["label"], c["sl"], c["at"]) for c in cuts]


def piece_vars(p):
    return f"--r:{p['r']:.1f};--th:{p['th']:.3f};--q:{p['q']:.3f};--bob:{p['bob']:.1f};--ph:{p['ph']:.3f};--rot:{p['rot']:.1f}"


def scene_markup(geo):
    """The shard as hero.html wants it: boxes in px, one inline-styled <i> per piece."""

    def box(left, top, w, h):
        return f"left:{left:.1f}px;top:{top:.1f}px;width:{w:.1f}px;height:{h:.1f}px"

    ox, oy = geo["origin"]
    ca, sa = geo["ring"]
    html = [
        f'<img id="hero-glow" src="assets/shard-glow.webp" alt="" style="{box(*geo["glow"])}" />',
        f'<div id="hero-crystal" style="{box(*geo["crystal"])};transform-origin:{ox:.1f}px {oy:.1f}px">',
        '  <img id="hero-core" src="assets/shard-core.webp" alt="" />',
        f'  <img id="hero-seam" src="assets/shard-seam.webp" alt="" style="{box(*geo["seam"])}" />',
        "</div>",
        f'<div id="hero-ring" style="--ca:{ca:.4f};--sa:{sa:.4f};--sheet:{geo["sheet"][0]:.1f}px {geo["sheet"][1]:.1f}px">',
    ]
    for p in geo["pieces"]:
        style = (
            f"width:{p['w']:.1f}px;height:{p['h']:.1f}px;margin:{-p['h'] / 2:.1f}px 0 0 {-p['w'] / 2:.1f}px;"
            f"background-position:{-p['x']:.1f}px {-p['y']:.1f}px;{piece_vars(p)}"
        )
        html.append(f'  <i class="hero-frag" style="{style}"></i>')
    return html + ["</div>"]


def num(v, digits=0):
    """A number as CSS writes it shortest: no trailing zeros, no leading zero, no minus zero."""
    text = f"{v:.{digits}f}".rstrip("0").rstrip(".") if digits else f"{v:.0f}"
    return re.sub(r"^(-?)0\.", r"\1.", "0" if text in ("-0", "") else text)


def px(v, digits=0):
    return "0" if num(v, digits) == "0" else num(v, digits) + "px"


def web_css(geo):
    """The shard for the page, with every number written out: a `var()` inside a keyframe makes
    the browser resolve it again for each piece on each frame. hero-secret.css gives the pieces
    their duration and ease; the two waves and their delays are worked out here."""

    def box(left, top, w, h):
        return f"left:{px(left, 1)};top:{px(top, 1)};width:{px(w, 1)};height:{px(h, 1)}"

    ox, oy = geo["origin"]
    ca, sa = geo["ring"]
    css = [
        f".hero-glow{{{box(*geo['glow'])}}}",
        f".hero-crystal{{{box(*geo['crystal'])};transform-origin:{px(ox, 1)} {px(oy, 1)}}}",
        f".hero-seam{{{box(*geo['seam'])}}}",
        f".hero-shard-origin i{{background-size:{px(geo['sheet'][0], 1)} {px(geo['sheet'][1], 1)}}}",
    ]
    for n, p in enumerate(geo["pieces"], 1):
        c, s = math.cos(p["th"]), math.sin(p["th"])
        ax, ay = p["r"] * ca, p["r"] * sa  # half the swing along the ring
        bx, by = -p["q"] * p["r"] * sa, p["q"] * p["r"] * ca  # and across it, toward the camera
        s0 = 1 / (1 + DEPTH * s)  # so the piece is its own size where it sits in the source
        turn = p["th"] / math.tau
        # A wave that starts at its low end reads -cos; these delays make it cos(th - t) along
        # the ring and sin(th - t) across it.
        delays = f"{num(-LOOP * ((0.5 - turn) % 1), 1)}s,{num(-LOOP * ((0.75 - turn) % 1), 1)}s"
        far = f"translate3d({px(-bx)},{px(-by)},{-LIFT}px) rotate({num(-p['rot'])}deg) scale({num((1 - DEPTH) * s0, 2)})"
        near = f"translate3d({px(bx)},{px(by)},{LIFT}px) rotate({num(p['rot'])}deg) scale({num((1 + DEPTH) * s0, 2)})"
        rest = f"translate3d({px(s * bx)},{px(s * by)},{px(s * LIFT)}) rotate({num(s * p['rot'])}deg)"
        css += [
            f"@keyframes hero-a{n}{{from{{translate:{px(-ax)} {px(-ay)}}}to{{translate:{px(ax)} {px(ay)}}}}}",
            f"@keyframes hero-c{n}{{from{{transform:{far};opacity:.56}}to{{transform:{near};opacity:1}}}}",
            f".hero-shard-origin i:nth-of-type({n}){{width:{px(p['w'], 1)};height:{px(p['h'], 1)};margin:{px(-p['h'] / 2, 1)} 0 0 {px(-p['w'] / 2, 1)};"
            f"background-position:{px(-p['x'], 1)} {px(-p['y'], 1)};translate:{px(c * ax)} {px(c * ay)};transform:{rest};"
            f"opacity:{num(0.78 + 0.22 * s, 2)};animation-name:hero-a{n},hero-c{n};animation-delay:{delays}}}",
        ]
    return css


def build_film(src):
    assets = ROOT / "assets"
    assets.mkdir(exist_ok=True)
    w, h = SHAPES["desktop"]
    cut_plate(src / "background-desktop.jpeg", assets / "plate.webp", (round(w * OVER_BG), round(h * OVER_BG)), 97)
    cut_particles(src / "particles-desktop.jpeg", assets, "", (round(w * OVER_FG), round(h * OVER_FG)))
    geo = cut_shard([(src / "secret-shard.jpeg", assets, False)])
    block = "\n".join("          " + line for line in scene_markup(geo))
    scene, hits = re.subn(r"(<!-- shard:start -->\n).*?( *<!-- shard:end -->)", lambda m: m[1] + block + "\n" + m[2], SCENE.read_text(), flags=re.S)
    assert hits == 1, "hero.html lost its shard:start / shard:end markers"
    SCENE.write_text(scene)


def build_web(src, web):
    css = ["/* Generated by ux-ui/motion/hero-secret/scripts/build_assets.py --web. Do not edit. */"]
    skins = []
    for theme, sfx in (("light", "-white"), ("dark", "")):  # light first: .dark overrides it
        light = theme == "light"
        out = web / "public" / "images" / "hero-secret" / theme
        out.mkdir(parents=True, exist_ok=True)
        at = "" if light else ".dark "
        for shape, (w, h) in SHAPES.items():
            cut_plate(src / f"background-{shape}{sfx}.jpeg", out / f"plate-{shape}.webp", (w, h), 88, light)
            # Out of focus already, so half the pixels are enough.
            cut_particles(src / f"particles-{shape}{sfx}.jpeg", out, f"-{shape}", (round(w * OVER_FG), round(h * OVER_FG)), 0.5, light)
            urls = ";".join(f"--{n}:url(/images/hero-secret/{theme}/{f}-{shape}.webp)" for n, f in (("plate", "plate"), ("near", "fg-near"), ("mid", "fg-mid"), ("far", "fg-far")))
            rule = f"{at}.hero-backdrop{{{urls}}}"
            css.append(rule if shape == "desktop" else f"@media (max-width:767px){{{rule}}}")
        urls = ";".join(f"--{n}:url(/images/hero-secret/{theme}/shard-{n}.webp)" for n in ("glow", "core", "seam", "pieces"))
        css.append(f"{at}.hero-shard-origin{{{urls}}}")
        skins.insert(0, (src / f"secret-shard{sfx}.jpeg", out, light))  # dark ends up first: it sets the layout
    css += web_css(cut_shard(skins, WEB_PIECES))
    (web / "src" / "components" / "marketing" / "hero-secret.generated.css").write_text("\n".join(css) + "\n")


def main():
    args = sys.argv[1:]
    web = None
    if "--web" in args:
        i = args.index("--web")
        web = Path(args[i + 1])
        del args[i : i + 2]
    src = Path(args[0])
    build_film(src)
    if web:
        build_web(src, web)


if __name__ == "__main__":
    main()
