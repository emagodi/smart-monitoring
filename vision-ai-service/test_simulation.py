import requests
import time
import json

# Configuration
VISION_URL = "http://localhost:8000"
TRANSFORMER_URL = "http://localhost:8083/api/v1/sensor-readings/create"

def print_result(test_name, result):
    print(f"\n--- {test_name} ---")
    print(json.dumps(result, indent=2))

def test_vision_logic():
    print("\n=== TESTING VISION AI LOGIC (Directly) ===")
    
    # 1. Test Door Open (No Person)
    # Expected: WARNING
    payload_door = {
        "sensor_id": 1,
        "sensor_type": "Door Contact",
        "value": "OPEN",
        "maintenance_mode": False
    }
    try:
        res = requests.post(f"{VISION_URL}/analyze/sensor", json=payload_door)
        print_result("Test 1: Door Open (No Person) -> Expect WARNING", res.json())
    except Exception as e:
        print(f"Test 1 Failed: {e}")

    # 2. Simulate Camera Event (Person Detected)
    event_payload = {
        "camera_id": "cam_01",
        "event_type": "detection",
        "detections": [{"class": "person", "confidence": 0.95}]
    }
    try:
        res = requests.post(f"{VISION_URL}/event/edge-ai", json=event_payload)
        print_result("Simulating Camera Event (Person Detected)", res.json())
    except Exception as e:
        print(f"Camera Event Failed: {e}")

    # 3. Test Door Open (With Person)
    # Expected: CRITICAL (because we just sent the camera event)
    try:
        res = requests.post(f"{VISION_URL}/analyze/sensor", json=payload_door)
        print_result("Test 2: Door Open (Person Recently Seen) -> Expect CRITICAL", res.json())
    except Exception as e:
        print(f"Test 2 Failed: {e}")

    # 4. Test Temperature (Context Aware)
    # Note: Results depend on whether it is currently Day or Night at the server
    payload_temp = {
        "sensor_id": 2,
        "sensor_type": "Temperature",
        "value": 75.0, # High temp
        "maintenance_mode": False
    }
    try:
        res = requests.post(f"{VISION_URL}/analyze/sensor", json=payload_temp)
        print_result("Test 3: Temperature 75.0C -> Check Day/Night Logic in 'details'", res.json())
    except Exception as e:
        print(f"Test 3 Failed: {e}")

    # 5. Simulate Fire Event
    fire_event_payload = {
        "camera_id": "cam_01",
        "event_type": "detection",
        "detections": [{"class": "fire", "confidence": 0.99}]
    }
    try:
        res = requests.post(f"{VISION_URL}/event/edge-ai", json=fire_event_payload)
        print_result("Simulating Camera Event (Fire Detected)", res.json())
    except Exception as e:
        print(f"Fire Event Failed: {e}")

    # 6. Test Temperature with Fire
    # Even a warning temp should become CRITICAL with Fire
    payload_temp_warn = {
        "sensor_id": 2,
        "sensor_type": "Temperature",
        "value": 75.0, # Warning level (Day)
        "maintenance_mode": False
    }
    try:
        res = requests.post(f"{VISION_URL}/analyze/sensor", json=payload_temp_warn)
        print_result("Test 4: Temp 75.0C (Warning) + Fire -> Expect CRITICAL + Fire Msg", res.json())
    except Exception as e:
        print(f"Test 4 Failed: {e}")

if __name__ == "__main__":
    test_vision_logic()
    
    print("\n\n=== NOTE ON FULL END-TO-END TESTING ===")
    print("To test the full SMS/Email flow, you need to POST to the Transformer Service.")
    print("This requires a valid JWT Token from the Auth Service.")
    print(f"POST {TRANSFORMER_URL}")
    print("Headers: {'Authorization': 'Bearer <YOUR_TOKEN>'}")
