import argparse
import os
import random
from pathlib import Path

from PIL import Image
from torchvision import transforms


IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def build_aug(img_size: int):
    return transforms.Compose(
        [
            transforms.RandomResizedCrop(img_size, scale=(0.5, 1.0), ratio=(0.75, 1.33)),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomApply([transforms.ColorJitter(0.35, 0.35, 0.35, 0.15)], p=0.9),
            transforms.RandomGrayscale(p=0.08),
            transforms.RandomApply([transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 2.0))], p=0.25),
            transforms.RandomRotation(degrees=15),
        ]
    )


def iter_images(root: Path):
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in IMG_EXTS:
            yield p


def count_images(root: Path):
    return sum(1 for _ in iter_images(root))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_dir", default="dataset")
    ap.add_argument("--out", dest="out_dir", default=None)
    ap.add_argument("--copies", type=int, default=10)
    ap.add_argument("--target-per-class", type=int, default=None)
    ap.add_argument("--inplace", action="store_true")
    ap.add_argument("--subdir", default="augmented")
    ap.add_argument("--img-size", type=int, default=224)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    random.seed(args.seed)
    in_dir = Path(args.in_dir)
    out_dir = Path(args.out_dir) if args.out_dir else None

    aug = build_aug(args.img_size)

    class_dirs = [p for p in in_dir.iterdir() if p.is_dir()]
    for class_dir in class_dirs:
        class_name = class_dir.name
        if args.inplace:
            target_dir = class_dir / args.subdir
        else:
            if out_dir is None:
                raise RuntimeError("--out is required unless --inplace is used")
            target_dir = out_dir / class_name
        target_dir.mkdir(parents=True, exist_ok=True)

        originals = [p for p in iter_images(class_dir) if args.subdir not in p.parts]
        if not originals:
            continue

        desired_new = args.copies * len(originals)
        if args.target_per_class is not None:
            existing_total = count_images(class_dir)
            desired_total = int(args.target_per_class)
            needed = max(0, desired_total - existing_total)
            desired_new = min(desired_new, needed) if args.copies is not None else needed

        if desired_new <= 0:
            continue

        remaining = desired_new
        while remaining > 0:
            p = random.choice(originals)
            img = Image.open(p).convert("RGB")
            stem = p.stem.replace(" ", "_")
            ext = ".jpg"
            out_img = aug(img)
            out_path = target_dir / f"{stem}_aug_{random.randint(0, 10_000_000)}{ext}"
            out_img.save(out_path, quality=92)
            remaining -= 1

    if args.inplace:
        print(f"Saved augmented images inside: {in_dir.resolve()}")
    else:
        print(f"Saved augmented dataset to: {out_dir.resolve()}")


if __name__ == "__main__":
    main()
