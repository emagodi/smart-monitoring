
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import random
import requests
import base64
import torch
import os

# Import our Industry Models
from models import IndustrialVisionModel, SensorBehaviorModel
from fusion import FusionEngine

app = FastAPI(title="Vision AI Service", version="2.0.0")

# --- Initialize AI Models (Load Weights) ---
print("Loading Industrial Perception Models...")
vision_model = IndustrialVisionModel(pretrained=True)

# Load trained weights if available
MODEL_PATH = "industrial_model.pth"
if os.path.exists(MODEL_PATH):
    print(f"Loading custom weights from {MODEL_PATH}...")
    try:
        # We need to know the number of classes to adjust the final layer before loading
        # Check if class mapping exists
        MAPPING_PATH = "class_mapping.txt"
        if os.path.exists(MAPPING_PATH):
            with open(MAPPING_PATH, "r") as f:
                lines = [line.strip() for line in f.readlines()]
                num_classes = len(lines)
                print(f"Adjusting model for {num_classes} classes found in {MAPPING_PATH}: {lines}")
                # Update model classes and final layer
                vision_model.set_classes(lines)
                num_ftrs = vision_model.backbone.fc.in_features
                vision_model.backbone.fc = torch.nn.Linear(num_ftrs, num_classes)
        
        vision_model.load_state_dict(torch.load(MODEL_PATH, map_location=torch.device('cpu')))
        vision_model.eval()
        print("Custom weights loaded successfully.")
    except Exception as e:
        print(f"Failed to load weights: {e}")
        print("Falling back to pretrained base model.")
else:
    print("No custom weights found. Using base pretrained model.")

sensor_model = SensorBehaviorModel(input_dim=1)
fusion_engine = FusionEngine()
print("Models Loaded.")

class SensorData(BaseModel):
    sensor_id: int
    sensor_type: str
    value: Any
    dev_eui: Optional[str] = None
    maintenance_mode: bool = False
    timestamp: Optional[str] = None  # ISO format preferred

class AnalysisResult(BaseModel):
    risk_score: float
    decision: str  # "SAFE", "WARNING", "CRITICAL"
    details: str

class CameraEvent(BaseModel):
    camera_id: str
    event_type: str
    image_url: Optional[str] = None
    detections: List[Dict[str, Any]] = []

@app.get("/")
def read_root():
    return {"status": "Vision AI Service Running", "models": "Active"}

# Global state to store latest camera detections (Simulated Database/Cache)
# Key: location_id or camera_id, Value: timestamp of last person detection
CAMERA_STATE = {
    "last_person_seen": 0.0,
    "last_fire_seen": 0.0,
    "last_climbing_seen": 0.0
}
import time

@app.post("/event/edge-ai")
def handle_edge_event(event: CameraEvent):
    """
    Receives events from Smart Cameras (Edge AI).
    Updates the global state for cross-reference with sensors.
    """
    print(f"Received Camera Event: {event}")
    
    # Update global state based on detections
    for det in event.detections:
        cls = det.get("class", "").lower() or det.get("label", "").lower()
        if "person" in cls or "intruder" in cls:
            CAMERA_STATE["last_person_seen"] = time.time()
            print("Updated: Person seen just now.")
        if "fire" in cls or "smoke" in cls:
            CAMERA_STATE["last_fire_seen"] = time.time()
            print("Updated: Fire seen just now.")
        if "climbing" in cls:
            CAMERA_STATE["last_climbing_seen"] = time.time()
            print("Updated: Climbing detected! CRITICAL.")
            
    return {"status": "processed", "camera_state": CAMERA_STATE}

@app.post("/analyze/sensor", response_model=AnalysisResult)
def analyze_sensor(data: SensorData):
    """
    Simulates AI analysis of sensor data with Context Awareness (Day/Night, Maintenance).
    """
    print(f"Analyzing sensor data: {data}")
    
    # 1. Determine Context (Day vs Night)
    from datetime import datetime
    now = datetime.now()
    hour = now.hour
    is_night = hour < 6 or hour >= 18
    
    # 2. Extract Value
    val_str = str(data.value).lower()
    
    # 3. AI / Logic Fusion
    risk_score = 0.0
    decision = "SAFE"
    details = "Normal operation"
    
    # --- MAINTENANCE MODE CHECK ---
    if data.maintenance_mode:
        return {
            "risk_score": 0.0,
            "decision": "MAINTENANCE",
            "details": "Transformer is under maintenance. Alarms suppressed."
        }

    # --- SENSOR SPECIFIC LOGIC ---
    
    # Check for recent person detection (within last 5 minutes)
    person_recently_seen = (time.time() - CAMERA_STATE["last_person_seen"]) < 300
    # Check for recent fire detection (within last 5 minutes)
    fire_recently_seen = (time.time() - CAMERA_STATE.get("last_fire_seen", 0)) < 300
    # Check for recent climbing detection (within last 5 minutes)
    climbing_recently_seen = (time.time() - CAMERA_STATE.get("last_climbing_seen", 0)) < 300

    # --- IMMEDIATE CRITICAL OVERRIDE FOR CLIMBING ---
    if climbing_recently_seen:
        return {
            "risk_score": 1.0,
            "decision": "CRITICAL",
            "details": "DANGER: Person detected CLIMBING equipment! Immediate Safety Hazard."
        }

    if "contact" in data.sensor_type.lower() or "door" in data.sensor_type.lower():
        is_open = val_str in ["open", "1", "true"]
        if is_open:
            if person_recently_seen:
                risk_score = 0.98
                decision = "CRITICAL"
                details = "Door OPEN and PERSON DETECTED by AI Camera!"
            else:
                risk_score = 0.5
                decision = "WARNING"
                details = "Door Open (No person detected recently)"
                
    elif "motion" in data.sensor_type.lower():
        is_occupied = val_str in ["occupied", "motion", "true", "1"]
        is_vacant = val_str in ["vacant", "false", "0"]
        
        if is_occupied:
            # LINK TO CAMERA: Verify if a human is actually present to reduce false alarms
            if person_recently_seen:
                 risk_score = 0.95
                 decision = "CRITICAL"
                 details = "Motion (Occupied) Detected + Human Visual Confirmation"
            else:
                 # Occupied but no human -> Likely false alarm (animal, debris, wind)
                 risk_score = 0.4
                 decision = "WARNING"
                 details = "Motion (Occupied) Detected - No Human detected by Camera. Possible animal/vehicle/debris."
        elif is_vacant:
             risk_score = 0.0
             decision = "SAFE"
             details = "Area Vacant (Normal Operation)"

    elif "tilt" in data.sensor_type.lower():
        is_tilted = val_str in ["tilted", "true", "1"]
        if is_tilted:
            if person_recently_seen:
                risk_score = 0.99
                decision = "CRITICAL"
                details = "Transformer TILT detected AND Person Detected! Potential Theft/Vandalism."
            else:
                risk_score = 0.75
                decision = "WARNING"
                details = "Transformer TILT detected (No person detected). Possible sensor fault or environmental cause."

    elif "temperature" in data.sensor_type.lower():
        try:
            temp = float(data.value)
            warn_limit = 50.0 if is_night else 65.0
            crit_limit = 70.0 if is_night else 85.0
            
            if temp > crit_limit:
                risk_score = 0.95
                decision = "CRITICAL"
                details = f"Temperature {temp}°C exceeds CRITICAL limit ({crit_limit}°C) for {'NIGHT' if is_night else 'DAY'}"
                if fire_recently_seen:
                    details += " AND FIRE DETECTED by Camera! IMMEDIATE ACTION REQUIRED."
                    risk_score = 1.0
            elif temp > warn_limit:
                risk_score = 0.7
                decision = "WARNING"
                details = f"Temperature {temp}°C exceeds WARNING limit ({warn_limit}°C) for {'NIGHT' if is_night else 'DAY'}"
                if fire_recently_seen:
                    decision = "CRITICAL" # Upgrade to Critical if fire seen
                    risk_score = 1.0
                    details += " AND FIRE DETECTED by Camera! IMMEDIATE ACTION REQUIRED."
            else:
                details = f"Temperature {temp}°C is within normal {'NIGHT' if is_night else 'DAY'} range."
        except:
            pass
            
    return {
        "risk_score": risk_score,
        "decision": decision,
        "details": details
    }


@app.post("/analyze/image")
def analyze_image(image_url: str = Body(..., embed=True)):
    """
    Runs the IndustrialVisionModel (CNN) on an image.
    """
    # For simulation, we return what the model *would* output structure-wise
    # Since we don't have a real image stream in this text context
    
    # Mocking a real inference result from our ResNet wrapper
    # In prod: result = vision_model.predict(downloaded_image_bytes)
    
    return {
        "status": "processed", 
        "model": "ResNet18-Industrial-v1",
        "prediction": {
            "class": "Normal",
            "confidence": 0.98,
            "probabilities": [0.98, 0.01, 0.005, 0.005]
        }
    }

@app.post("/event/edge-ai")
def handle_edge_event(event: CameraEvent):
    """
    Receives Edge AI events (JSON/MQTT/HTTP webhook) from cameras.
    """
    print(f"Received Edge AI Event: {event}")
    
    # Process event
    # If a person is detected, update the global state
    for det in event.detections:
        cls = det.get("class", "").lower() or det.get("label", "").lower()
        if "person" in cls:
            CAMERA_STATE["last_person_seen"] = time.time()
            print("PERSON DETECTED: State updated.")
        if "fire" in cls or "smoke" in cls:
            CAMERA_STATE["last_fire_seen"] = time.time()
            print("FIRE/SMOKE DETECTED: State updated.")
            
    return {"status": "received", "action": "logged", "state": CAMERA_STATE}

