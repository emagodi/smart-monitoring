import argparse
import json
import os
import random
from dataclasses import dataclass
from pathlib import Path

import torch
from PIL import Image
from sklearn.model_selection import StratifiedShuffleSplit, train_test_split
from torch import nn
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
from torchvision import models, transforms


IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


class FolderDataset(Dataset):
    def __init__(self, items, class_to_idx, transform):
        self.items = items
        self.class_to_idx = class_to_idx
        self.transform = transform

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx):
        path, class_name = self.items[idx]
        image = Image.open(path).convert("RGB")
        x = self.transform(image)
        y = self.class_to_idx[class_name]
        return x, y


@dataclass
class TrainConfig:
    dataset_dir: Path
    out_dir: Path
    img_size: int = 224
    batch_size: int = 16
    epochs: int = 15
    lr: float = 3e-4
    weight_decay: float = 1e-4
    seed: int = 42
    val_size: float = 0.2
    pretrained: bool = True
    group_split: bool = True
    device: str = "cuda" if torch.cuda.is_available() else "cpu"


def set_seed(seed: int):
    random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def discover_items(dataset_dir: Path):
    class_dirs = [p for p in dataset_dir.iterdir() if p.is_dir()]
    class_names = sorted([p.name for p in class_dirs])
    items = []
    for class_name in class_names:
        for p in (dataset_dir / class_name).rglob("*"):
            if p.is_file() and p.suffix.lower() in IMG_EXTS:
                items.append((str(p), class_name))
    return items, class_names


def group_key(path: str, class_name: str):
    p = Path(path)
    stem = p.stem
    if "_aug_" in stem:
        base = stem.split("_aug_")[0]
    else:
        base = stem.replace(" ", "_")
    return f"{class_name}/{base}"


def split_by_groups(items, class_to_idx, val_size: float, seed: int):
    groups = []
    group_labels = []
    group_to_indices = {}
    for i, (path, class_name) in enumerate(items):
        g = group_key(path, class_name)
        if g not in group_to_indices:
            groups.append(g)
            group_labels.append(class_to_idx[class_name])
            group_to_indices[g] = []
        group_to_indices[g].append(i)

    splitter = StratifiedShuffleSplit(n_splits=1, test_size=val_size, random_state=seed)
    try:
        train_group_idx, val_group_idx = next(splitter.split(groups, group_labels))
    except Exception:
        return None

    train_indices = []
    for gi in train_group_idx:
        train_indices.extend(group_to_indices[groups[int(gi)]])

    val_indices = []
    for gi in val_group_idx:
        val_indices.extend(group_to_indices[groups[int(gi)]])

    train_groups = [groups[int(gi)] for gi in train_group_idx]
    val_groups = [groups[int(gi)] for gi in val_group_idx]
    return {
        "train_indices": sorted(train_indices),
        "val_indices": sorted(val_indices),
        "train_groups": train_groups,
        "val_groups": val_groups,
    }


def build_transforms(img_size: int):
    mean = (0.485, 0.456, 0.406)
    std = (0.229, 0.224, 0.225)
    train_tf = transforms.Compose(
        [
            transforms.RandomResizedCrop(img_size, scale=(0.6, 1.0), ratio=(0.75, 1.33)),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomApply([transforms.ColorJitter(0.25, 0.25, 0.25, 0.1)], p=0.8),
            transforms.RandomGrayscale(p=0.05),
            transforms.RandomApply([transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 2.0))], p=0.2),
            transforms.RandomRotation(degrees=10),
            transforms.ToTensor(),
            transforms.Normalize(mean=mean, std=std),
            transforms.RandomErasing(p=0.15, scale=(0.02, 0.2), ratio=(0.3, 3.3), value="random"),
        ]
    )
    val_tf = transforms.Compose(
        [
            transforms.Resize(int(img_size * 1.15)),
            transforms.CenterCrop(img_size),
            transforms.ToTensor(),
            transforms.Normalize(mean=mean, std=std),
        ]
    )
    return train_tf, val_tf


def build_model(num_classes: int, pretrained: bool):
    weights = None
    if pretrained:
        try:
            weights = models.ResNet18_Weights.DEFAULT
        except Exception:
            weights = None
    model = models.resnet18(weights=weights)
    in_features = model.fc.in_features
    model.fc = nn.Linear(in_features, num_classes)
    return model


@torch.no_grad()
def evaluate(model: nn.Module, loader: DataLoader, device: str):
    model.eval()
    total = 0
    correct = 0
    loss_sum = 0.0
    loss_fn = nn.CrossEntropyLoss()
    for xb, yb in loader:
        xb = xb.to(device)
        yb = yb.to(device)
        logits = model(xb)
        loss = loss_fn(logits, yb)
        loss_sum += float(loss.item()) * xb.size(0)
        pred = logits.argmax(dim=1)
        total += xb.size(0)
        correct += int((pred == yb).sum().item())
    acc = correct / max(1, total)
    avg_loss = loss_sum / max(1, total)
    return {"acc": acc, "loss": avg_loss}


def train(cfg: TrainConfig):
    set_seed(cfg.seed)
    cfg.out_dir.mkdir(parents=True, exist_ok=True)

    items, class_names = discover_items(cfg.dataset_dir)
    if len(items) < 4:
        raise RuntimeError(f"Not enough images found in {cfg.dataset_dir}")
    if len(class_names) < 2:
        raise RuntimeError("Need at least 2 class folders under dataset/")

    class_to_idx = {c: i for i, c in enumerate(class_names)}
    X = [p for p, _ in items]
    y = [class_to_idx[c] for _, c in items]

    split = split_by_groups(items, class_to_idx, val_size=cfg.val_size, seed=cfg.seed) if cfg.group_split else None
    if split is None:
        train_idx, val_idx = train_test_split(
            list(range(len(items))), test_size=cfg.val_size, random_state=cfg.seed, stratify=y
        )
    else:
        train_idx, val_idx = split["train_indices"], split["val_indices"]
        (cfg.out_dir / "split.json").write_text(
            json.dumps(
                {
                    "seed": cfg.seed,
                    "val_size": cfg.val_size,
                    "class_names": class_names,
                    "group_split": True,
                    "train_groups": split["train_groups"],
                    "val_groups": split["val_groups"],
                    "train_count": len(train_idx),
                    "val_count": len(val_idx),
                },
                indent=2,
            )
        )
    train_items = [items[i] for i in train_idx]
    val_items = [items[i] for i in val_idx]

    train_tf, val_tf = build_transforms(cfg.img_size)
    train_ds = FolderDataset(train_items, class_to_idx, train_tf)
    val_ds = FolderDataset(val_items, class_to_idx, val_tf)

    train_labels = [class_to_idx[c] for _, c in train_items]
    counts = torch.bincount(torch.tensor(train_labels), minlength=len(class_names)).float()
    safe_counts = torch.where(counts > 0, counts, torch.ones_like(counts))
    class_weights = (counts.sum() / safe_counts)
    class_weights = torch.where(counts > 0, class_weights, torch.zeros_like(class_weights))

    sample_weights = [float(1.0 / safe_counts[label].item()) for label in train_labels]
    sampler = WeightedRandomSampler(sample_weights, num_samples=len(sample_weights), replacement=True)

    train_loader = DataLoader(train_ds, batch_size=cfg.batch_size, sampler=sampler, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=cfg.batch_size, shuffle=False, num_workers=0)

    model = build_model(num_classes=len(class_names), pretrained=cfg.pretrained).to(cfg.device)
    opt = torch.optim.AdamW(model.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay)
    loss_fn = nn.CrossEntropyLoss(weight=class_weights.to(cfg.device))
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, cfg.epochs))

    best = {"acc": -1.0, "epoch": -1}
    for epoch in range(cfg.epochs):
        model.train()
        total = 0
        correct = 0
        loss_sum = 0.0
        for xb, yb in train_loader:
            xb = xb.to(cfg.device)
            yb = yb.to(cfg.device)
            opt.zero_grad(set_to_none=True)
            logits = model(xb)
            loss = loss_fn(logits, yb)
            loss.backward()
            opt.step()
            loss_sum += float(loss.item()) * xb.size(0)
            pred = logits.argmax(dim=1)
            total += xb.size(0)
            correct += int((pred == yb).sum().item())
        scheduler.step()

        train_acc = correct / max(1, total)
        train_loss = loss_sum / max(1, total)
        val_metrics = evaluate(model, val_loader, cfg.device)

        if val_metrics["acc"] > best["acc"]:
            best = {"acc": float(val_metrics["acc"]), "epoch": int(epoch)}
            torch.save(
                {
                    "arch": "resnet18",
                    "state_dict": model.state_dict(),
                    "class_names": class_names,
                    "img_size": cfg.img_size,
                },
                cfg.out_dir / "model.pt",
            )
            (cfg.out_dir / "labels.json").write_text(
                json.dumps(
                    {
                        "model": "resnet18",
                        "class_names": class_names,
                        "img_size": cfg.img_size,
                        "best_val_acc": best["acc"],
                        "best_epoch": best["epoch"] + 1,
                    },
                    indent=2,
                )
            )

        print(
            json.dumps(
                {
                    "epoch": epoch + 1,
                    "train": {"acc": round(train_acc, 4), "loss": round(train_loss, 4)},
                    "val": {"acc": round(float(val_metrics["acc"]), 4), "loss": round(float(val_metrics["loss"]), 4)},
                    "best": best,
                }
            )
        )

    meta = {
        "model": "resnet18",
        "class_names": class_names,
        "img_size": cfg.img_size,
        "best_val_acc": best["acc"],
        "best_epoch": best["epoch"] + 1,
    }
    (cfg.out_dir / "labels.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps({"saved": str(cfg.out_dir), "meta": meta}))


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--dataset", default="dataset")
    p.add_argument("--out", default="cnn_security_model")
    p.add_argument("--img-size", type=int, default=224)
    p.add_argument("--batch-size", type=int, default=16)
    p.add_argument("--epochs", type=int, default=15)
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--weight-decay", type=float, default=1e-4)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--val-size", type=float, default=0.2)
    p.add_argument("--no-pretrained", action="store_true")
    p.add_argument("--no-group-split", action="store_true")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    cfg = TrainConfig(
        dataset_dir=Path(args.dataset),
        out_dir=Path(args.out),
        img_size=args.img_size,
        batch_size=args.batch_size,
        epochs=args.epochs,
        lr=args.lr,
        weight_decay=args.weight_decay,
        seed=args.seed,
        val_size=args.val_size,
        pretrained=not args.no_pretrained,
        group_split=not args.no_group_split,
    )
    train(cfg)
