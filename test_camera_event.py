import requests
import json

URL = "http://gateway:8080/api/v1/cameras/event"

# Payload from the failed log
payload = {
    "topic": "NE101SensingCam/Snapshot",
    "aiClass": "normal",
    "confidence": 0.96,
    "timestamp": "2026-03-07T00:36:37.977061",
    "imagePath": "cam_20260307_003637_957242.jpg"
}

print(f"Sending event to {URL}...")
try:
    response = requests.post(URL, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
