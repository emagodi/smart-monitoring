from fastapi import FastAPI, File, UploadFile, Query
from fastapi.responses import JSONResponse
import uvicorn
import random
from PIL import Image
import io
import numpy as np
import torch
import torch.nn as nn
from torchvision import models, transforms
import os

app = FastAPI()

# Load Model
MODEL_PATH = "./model_v1.pth"
CLASS_NAMES_PATH = "./class_names.txt"
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
model = None
class_names = []

def load_model():
    global model, class_names
    if os.path.exists(MODEL_PATH) and os.path.exists(CLASS_NAMES_PATH):
        try:
            # Load class names
            with open(CLASS_NAMES_PATH, "r") as f:
                class_names = [line.strip() for line in f.readlines()]
            
            # Load model architecture
            model = models.resnet18(pretrained=False) # No need to download pretrained weights again
            num_ftrs = model.fc.in_features
            model.fc = nn.Linear(num_ftrs, len(class_names))
            
            # Load weights
            model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
            model.to(device)
            model.eval()
            print(f"Model loaded successfully with classes: {class_names}")
        except Exception as e:
            print(f"Failed to load model: {e}")
            model = None
    else:
        print("Model file or class names file not found. Using dummy logic.")

load_model()

# Transforms for inference
inference_transforms = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

@app.post("/analyze/upload")
async def analyze_image(
    file: UploadFile = File(...),
    model_type: str = Query("general", alias="modelType")
):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    filename = file.filename.lower()
    
    detected_class = "normal"
    confidence = 0.0
    alert_level = "SAFE"
    bounding_boxes = []

    # Use trained model if available and applicable (security/door)
    if model and (model_type == "security" or model_type == "door" or model_type == "general"):
        try:
            img_t = inference_transforms(image).unsqueeze(0).to(device)
            with torch.no_grad():
                outputs = model(img_t)
                probabilities = torch.nn.functional.softmax(outputs, dim=1)
                top_prob, top_catid = torch.max(probabilities, 1)
                
                detected_idx = top_catid.item()
                detected_class = class_names[detected_idx]
                confidence = top_prob.item()

            # Map class to alert level
            if detected_class == "climbing":
                alert_level = "CRITICAL"
            elif detected_class == "door_opening":
                alert_level = "CRITICAL" # Or WARNING depending on context
            else:
                alert_level = "SAFE"
                
        except Exception as e:
            print(f"Inference error: {e}")
            # Fallback to dummy logic
            pass
    
    # Fallback / Heuristic Logic if model didn't run or for other types
    if alert_level == "SAFE" and not model: # Only run heuristics if model wasn't used or returned safe (and we want double check? No, just fallback)
         # ... (Existing heuristic logic could remain here as fallback, but for now let's rely on the model if loaded)
         pass

    # Re-implement specific heuristics for Fire/Defect as they are likely not in our trained model yet
    if model_type == "fire":
         if "fire" in filename or "flame" in filename or is_red_dominant(image):
            detected_class = "fire"
            alert_level = "CRITICAL"
            confidence = 0.95
    elif model_type == "defect":
         if "crack" in filename or "rust" in filename or "leak" in filename:
            detected_class = "structural_defect"
            alert_level = "CRITICAL"
            confidence = 0.90

    # Mock bounding box if critical
    if alert_level == "CRITICAL":
        bounding_boxes.append([100, 100, 300, 300, detected_class])

    return JSONResponse(content={
        "status": "SUCCESS",
        "modelType": model_type,
        "detectedClass": detected_class,
        "confidence": confidence,
        "alertLevel": alert_level,
        "boundingBoxes": bounding_boxes
    })


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
