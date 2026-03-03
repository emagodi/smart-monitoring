from fastapi import FastAPI, File, UploadFile, Query
from fastapi.responses import JSONResponse
import uvicorn
import random
from PIL import Image
import io
import numpy as np

app = FastAPI()

@app.post("/analyze/upload")
async def analyze_image(
    file: UploadFile = File(...),
    model_type: str = Query("general", alias="modelType") # Support both modelType and model_type
):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    filename = file.filename.lower()
    
    # Default result
    detected_class = "normal"
    confidence = 0.85 + (random.random() * 0.14)
    alert_level = "SAFE"
    bounding_boxes = []

    # Logic based on model type
    if model_type == "fire":
        # Heuristic: Check for red/orange dominance or filename
        if "fire" in filename or "flame" in filename:
            detected_class = "fire"
            alert_level = "CRITICAL"
        elif is_red_dominant(image):
            detected_class = "fire"
            alert_level = "CRITICAL"
            
    elif model_type == "defect":
        if "crack" in filename or "rust" in filename:
            detected_class = "structural_defect"
            alert_level = "CRITICAL"
        elif "leak" in filename:
            detected_class = "oil_leak"
            alert_level = "CRITICAL"
            
    elif model_type == "security":
        if "intruder" in filename or "person" in filename:
            detected_class = "intruder"
            alert_level = "CRITICAL"
        elif "vehicle" in filename:
            detected_class = "unauthorized_vehicle"
            alert_level = "WARNING"
            
    elif model_type == "door":
        if "open" in filename:
            detected_class = "door_open"
            alert_level = "CRITICAL"
        elif "closed" in filename:
            detected_class = "door_closed"
            alert_level = "SAFE"
        else:
            # Default to closed if unclear, or random for demo
            if random.random() > 0.7:
                detected_class = "door_open"
                alert_level = "CRITICAL"
            else:
                detected_class = "door_closed"
                alert_level = "SAFE"

    else: # General model
        if "fire" in filename:
            detected_class = "fire"
            alert_level = "CRITICAL"
        elif "intruder" in filename:
            detected_class = "intruder"
            alert_level = "CRITICAL"

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
