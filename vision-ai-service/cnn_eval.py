import argparse
import json
from pathlib import Path

import torch
from PIL import Image
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import StratifiedShuffleSplit, train_test_split
from torch.utils.data import DataLoader, Dataset
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
        _, val_group_idx = next(splitter.split(groups, group_labels))
    except Exception:
        return None

    val_indices = []
    for gi in val_group_idx:
        val_indices.extend(group_to_indices[groups[int(gi)]])

    train_set = set(range(len(items))) - set(val_indices)
    return sorted(train_set), sorted(val_indices)


def build_val_transform(img_size: int):
    mean = (0.485, 0.456, 0.406)
    std = (0.229, 0.224, 0.225)
    return transforms.Compose(
        [
            transforms.Resize(int(img_size * 1.15)),
            transforms.CenterCrop(img_size),
            transforms.ToTensor(),
            transforms.Normalize(mean=mean, std=std),
        ]
    )


def load_model(model_path: Path, class_names):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    bundle = torch.load(model_path, map_location=device)
    if bundle.get("class_names"):
        class_names = bundle["class_names"]
    img_size = int(bundle.get("img_size") or 224)
    model = models.resnet18(weights=None)
    in_features = model.fc.in_features
    model.fc = torch.nn.Linear(in_features, len(class_names))
    model.load_state_dict(bundle["state_dict"])
    model.eval()
    model.to(device)
    return model, device, class_names, img_size


@torch.no_grad()
def predict(model, loader, device):
    ys = []
    ps = []
    for xb, yb in loader:
        xb = xb.to(device)
        logits = model(xb)
        pred = logits.argmax(dim=1).cpu().tolist()
        ps.extend(pred)
        ys.extend(yb.tolist())
    return ys, ps


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="dataset")
    ap.add_argument("--model", default="cnn_security_model/model.pt")
    ap.add_argument("--out", default=None)
    ap.add_argument("--split-file", default=None)
    ap.add_argument("--val-size", type=float, default=0.2)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--no-group-split", action="store_true")
    args = ap.parse_args()

    dataset_dir = Path(args.dataset)
    model_path = Path(args.model)

    items, class_names = discover_items(dataset_dir)
    class_to_idx = {c: i for i, c in enumerate(class_names)}

    if args.split_file:
        split = json.loads(Path(args.split_file).read_text())
        val_groups = set(split.get("val_groups") or [])
        if val_groups:
            val_items = [it for it in items if group_key(it[0], it[1]) in val_groups]
        else:
            val_items = []
    else:
        val_items = None

    split = None
    if val_items is None and not args.no_group_split:
        split = split_by_groups(items, class_to_idx, val_size=args.val_size, seed=args.seed)

    if val_items is None and split is None:
        y = [class_to_idx[c] for _, c in items]
        _, val_idx = train_test_split(
            list(range(len(items))), test_size=args.val_size, random_state=args.seed, stratify=y
        )
        val_items = [items[i] for i in val_idx]
    elif val_items is None:
        _, val_idx = split
        val_items = [items[i] for i in val_idx]

    model, device, class_names, img_size = load_model(model_path, class_names)
    tf = build_val_transform(img_size)
    val_ds = FolderDataset(val_items, {c: i for i, c in enumerate(class_names)}, tf)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, num_workers=0)

    ys, ps = predict(model, val_loader, device)
    report = classification_report(ys, ps, target_names=class_names, output_dict=True, zero_division=0)
    cm = confusion_matrix(ys, ps).tolist()

    payload = {"classes": class_names, "confusion_matrix": cm, "report": report}
    if args.out:
        Path(args.out).write_text(json.dumps(payload, indent=2))
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
