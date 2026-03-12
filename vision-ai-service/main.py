from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
import uvicorn
from PIL import Image
import io
import numpy as np

app = FastAPI()

import torch
from torchvision import models, transforms
from transformers import CLIPProcessor, CLIPModel
import os
import json

# Configuration
MODEL_PATH = "fine_tuned_clip_model" if os.path.exists("fine_tuned_clip_model") else "openai/clip-vit-base-patch32"
CNN_DIR = os.environ.get("CNN_MODEL_DIR", "cnn_security_model")
CNN_MODEL_PATH = os.path.join(CNN_DIR, "model.pt")

_clip_model = None
_clip_processor = None
_cnn_bundle = None


def _load_clip():
    global _clip_model, _clip_processor
    if _clip_model is None or _clip_processor is None:
        print(f"Loading Vision AI Model from: {MODEL_PATH}")
        _clip_model = CLIPModel.from_pretrained(MODEL_PATH)
        _clip_processor = CLIPProcessor.from_pretrained(MODEL_PATH)
    return _clip_model, _clip_processor


def _build_cnn_transform(img_size: int):
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


def _load_cnn():
    global _cnn_bundle
    if _cnn_bundle is not None:
        return _cnn_bundle
    if not os.path.exists(CNN_MODEL_PATH):
        _cnn_bundle = None
        return None
    device = "cuda" if torch.cuda.is_available() else "cpu"
    bundle = torch.load(CNN_MODEL_PATH, map_location=device)
    class_names = bundle.get("class_names") or []
    img_size = int(bundle.get("img_size") or 224)
    model = models.resnet18(weights=None)
    in_features = model.fc.in_features
    model.fc = torch.nn.Linear(in_features, len(class_names))
    model.load_state_dict(bundle["state_dict"])
    model.eval()
    model.to(device)
    _cnn_bundle = {
        "model": model,
        "class_names": class_names,
        "img_size": img_size,
        "device": device,
        "transform": _build_cnn_transform(img_size),
    }
    print(f"Loaded CNN model from: {CNN_MODEL_PATH}")
    return _cnn_bundle


def _map_class_to_backend(label: str):
    key = (label or "").strip().lower()
    if key in {"climbing", "person_climbing", "person climbing"}:
        return {"detectedClass": "person climbing", "alertLevel": "CRITICAL"}
    if key in {"door_open", "door_opening", "open_door", "open transformer door"}:
        return {"detectedClass": "door_open", "alertLevel": "CRITICAL"}
    if key in {"intruder", "person_near", "person near", "standing"}:
        return {"detectedClass": "intruder", "alertLevel": "CRITICAL"}
    if key in {"normal", "safe", "none"}:
        return {"detectedClass": "normal", "alertLevel": "SAFE"}
    return {"detectedClass": label or "normal", "alertLevel": "SAFE"}

@app.post("/analyze/upload")
async def analyze_image(
    file: UploadFile = File(...),
    model_type: str = Form("general"),
    modelType: str = Form(None),
):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")

    effective_model_type = modelType or model_type or "general"
    mode = effective_model_type.strip().lower()
    use_cnn = mode in {"cnn", "cnn-security", "security-cnn", "security"} and os.path.exists(CNN_MODEL_PATH)

    if use_cnn:
        cnn = _load_cnn()
        if cnn is None:
            use_cnn = False

    if use_cnn:
        x = cnn["transform"](image).unsqueeze(0).to(cnn["device"])
        with torch.no_grad():
            logits = cnn["model"](x)
            probs = torch.softmax(logits, dim=1).squeeze(0)
        top_prob, top_idx = torch.max(probs, dim=0)
        label = cnn["class_names"][int(top_idx.item())] if cnn["class_names"] else "normal"
        confidence = float(top_prob.item())
        min_conf = float(os.environ.get("CNN_MIN_CONF", "0.6"))
        if confidence < min_conf and label != "normal":
            label = "normal"
        mapped = _map_class_to_backend(label)
        return JSONResponse(
            content={
                "status": "SUCCESS",
                "modelType": effective_model_type,
                "detectedClass": mapped["detectedClass"],
                "confidence": confidence,
                "alertLevel": mapped["alertLevel"],
                "boundingBoxes": [],
            }
        )

    clip_model, clip_processor = _load_clip()
    labels = [
        "a photo of a person climbing a transformer",
        "a photo of an open transformer door",
        "a normal transformer",
        "a person standing near a transformer",
    ]
    inputs = clip_processor(text=labels, images=image, return_tensors="pt", padding=True)
    outputs = clip_model(**inputs)
    logits_per_image = outputs.logits_per_image
    probs = logits_per_image.softmax(dim=1)
    top_prob, top_idx = probs.topk(1)
    detected_label = labels[top_idx.item()]
    confidence = top_prob.item()

    alert_level = "SAFE"
    detected_class = "normal"

    if "climbing" in detected_label:
        detected_class = "person climbing"
        alert_level = "CRITICAL"
    elif "open" in detected_label:
        detected_class = "door_open"
        alert_level = "CRITICAL"
    elif "standing" in detected_label:
        detected_class = "intruder"
        alert_level = "CRITICAL"
    else:
        detected_class = "normal"
        alert_level = "SAFE"

    bounding_boxes = []
    if alert_level == "CRITICAL":
        bounding_boxes.append([100, 100, 300, 300, detected_class])

    return JSONResponse(
        content={
            "status": "SUCCESS",
            "modelType": effective_model_type,
            "detectedClass": detected_class,
            "confidence": confidence,
            "alertLevel": alert_level,
            "boundingBoxes": bounding_boxes,
        }
    )

def is_red_dominant(image):

    # Simple heuristic for fire detection (lots of red/orange)
    try:
        img_array = np.array(image.convert('RGB'))
        r = img_array[:, :, 0]
        g = img_array[:, :, 1]
        b = img_array[:, :, 2]
        # Red > Green + Blue (very rough)
        red_pixels = np.sum((r > 150) & (r > g + b))
        total_pixels = r.size
        return (red_pixels / total_pixels) > 0.1 # >10% red
    except:
        return False

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
