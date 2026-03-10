from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
import uvicorn
import random
from PIL import Image
import io
import numpy as np
from transformers import pipeline

app = FastAPI()

from transformers import CLIPProcessor, CLIPModel
import os

# Configuration
MODEL_PATH = "fine_tuned_clip_model" if os.path.exists("fine_tuned_clip_model") else "openai/clip-vit-base-patch32"

print(f"Loading Vision AI Model from: {MODEL_PATH}")
model = CLIPModel.from_pretrained(MODEL_PATH)
processor = CLIPProcessor.from_pretrained(MODEL_PATH)

@app.post("/analyze/upload")
async def analyze_image(
    file: UploadFile = File(...),
    model_type: str = Form("general") 
):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    
    # Define candidate labels
    labels = [
        "a photo of a person climbing a transformer", 
        "a photo of an open transformer door",
        "a normal transformer",
        "a person standing near a transformer"
    ]
    
    inputs = processor(
        text=labels, images=image, return_tensors="pt", padding=True
    )
    
    outputs = model(**inputs)
    logits_per_image = outputs.logits_per_image # this is the image-text similarity score
    probs = logits_per_image.softmax(dim=1) # we can take the softmax to get the label probabilities
    
    # Get top prediction
    top_prob, top_idx = probs.topk(1)
    detected_label = labels[top_idx.item()]
    confidence = top_prob.item()
    
    # Map to Alert Logic
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
    # Mock bounding box if critical (CLIP doesn't give boxes, only classification)
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
