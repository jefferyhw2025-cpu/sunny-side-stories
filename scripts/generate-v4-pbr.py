#!/usr/bin/env python3
"""Build compact PBR companion maps for the hand-painted V4 material set."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
TEXTURE_DIR = ROOT / "public" / "textures"
MATERIALS = {
    "grass": {"normal": 2.4, "roughness": 0.78, "detail": 0.28},
    "wood": {"normal": 3.2, "roughness": 0.66, "detail": 0.34},
    "roof": {"normal": 4.2, "roughness": 0.73, "detail": 0.38},
    "stucco": {"normal": 1.9, "roughness": 0.86, "detail": 0.22},
    "stone": {"normal": 4.0, "roughness": 0.81, "detail": 0.36},
    "water": {"normal": 5.4, "roughness": 0.24, "detail": 0.18},
}


def save_gray(values: np.ndarray, path: Path) -> None:
    pixels = np.clip(values * 255.0, 0, 255).astype(np.uint8)
    Image.fromarray(pixels, mode="L").save(path, optimize=True)


def build_maps(name: str, normal_strength: float, roughness_base: float, detail: float) -> None:
    source_path = TEXTURE_DIR / f"v2-{name}.png"
    source = Image.open(source_path).convert("RGB")
    rgb = np.asarray(source, dtype=np.float32) / 255.0
    height = rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722

    blurred_height_image = Image.fromarray(np.uint8(np.clip(height * 255.0, 0, 255)), mode="L").filter(
        ImageFilter.GaussianBlur(radius=1.05)
    )
    blurred_height = np.asarray(blurred_height_image, dtype=np.float32) / 255.0
    gradient_y, gradient_x = np.gradient(blurred_height)
    normal_x = -gradient_x * normal_strength
    normal_y = gradient_y * normal_strength
    normal_z = np.ones_like(normal_x)
    magnitude = np.sqrt(normal_x * normal_x + normal_y * normal_y + normal_z * normal_z)
    normal = np.stack(
        (
            normal_x / magnitude * 0.5 + 0.5,
            normal_y / magnitude * 0.5 + 0.5,
            normal_z / magnitude * 0.5 + 0.5,
        ),
        axis=-1,
    )
    Image.fromarray(np.uint8(np.clip(normal * 255.0, 0, 255)), mode="RGB").save(
        TEXTURE_DIR / f"v4-{name}-normal.png", optimize=True
    )

    broad = np.asarray(
        blurred_height_image.filter(ImageFilter.GaussianBlur(radius=7.0)), dtype=np.float32
    ) / 255.0
    micro_detail = np.abs(height - broad)
    roughness = roughness_base + micro_detail * detail - (height - 0.5) * 0.05
    save_gray(np.clip(roughness, 0.08, 0.98), TEXTURE_DIR / f"v4-{name}-roughness.png")

    cavity = np.maximum(broad - height, 0.0)
    local_variation = np.abs(height - broad)
    ao = 1.0 - cavity * 1.9 - local_variation * 0.22
    save_gray(np.clip(ao, 0.48, 1.0), TEXTURE_DIR / f"v4-{name}-ao.png")


def main() -> None:
    for material, config in MATERIALS.items():
        build_maps(material, config["normal"], config["roughness"], config["detail"])
        print(f"generated V4 PBR maps for {material}")

    poster = Image.open(ROOT / "public" / "og.png").convert("RGB")
    poster.thumbnail((960, 540), Image.Resampling.LANCZOS)
    poster.save(ROOT / "public" / "v4-loading.webp", format="WEBP", quality=84, method=6)
    print("generated compact V4 loading poster")


if __name__ == "__main__":
    main()
