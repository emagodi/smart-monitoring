import requests
import time
import os

BASE_URL = os.environ.get("GATEWAY_URL", "http://localhost:8080")
AUTH_URL = f"{BASE_URL}/api/v1/auth"
REGION_URL = f"{BASE_URL}/api/v1/regions"
DISTRICT_URL = f"{BASE_URL}/api/v1/districts"
DEPOT_URL = f"{BASE_URL}/api/v1/depots"
TRANSFORMER_URL = f"{BASE_URL}/api/v1/transformers"
CAMERA_URL = f"{BASE_URL}/api/v1/cameras"
SENSOR_URL = f"{BASE_URL}/api/v1/sensors"
READING_URL = f"{BASE_URL}/api/v1/sensor-readings"

EMAIL = "emagodi1@powertel.co.zw"
PASSWORD = "Password@123"

def login():
    print(f"Logging in as {EMAIL}...", flush=True)
    try:
        response = requests.post(f"{AUTH_URL}/authenticate", json={"email": EMAIL, "password": PASSWORD})
        response.raise_for_status()
        token = response.json().get("access_token")
        print("Login successful.", flush=True)
        return token
    except Exception as e:
        print(f"Login failed: {e}", flush=True)
        if 'response' in locals() and response:
            print(f"Response: {response.text}", flush=True)
        return None

def get_or_create(url, name, payload, token, id_field="id"):
    headers = {"Authorization": f"Bearer {token}"}
    try:
        # Check if exists
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            items = data.get("content", data) if isinstance(data, dict) else data
            
            # Debug
            # print(f"DEBUG: items type={type(items)} content={items}", flush=True)
            for item in items:
                if isinstance(item, str):
                    print(f"WARNING: item is string: {item}", flush=True)
                    continue
                if item.get("name") == name:
                    print(f"Found existing {name} (ID: {item.get(id_field)})")
                    return item.get(id_field)
        
        # Create
        print(f"Creating {name}...")
        response = requests.post(f"{url}/create", json=payload, headers=headers)
        if response.status_code == 201 or response.status_code == 200:
            item = response.json()
            print(f"Created {name} (ID: {item.get(id_field)})")
            return item.get(id_field)
        else:
            print(f"Failed to create {name}: {response.status_code} {response.text}")
            return None
    except Exception as e:
        print(f"Error processing {name}: {e}")
        return None

def register_camera(token, transformer_id):
    headers = {"Authorization": f"Bearer {token}"}
    camera_name = "Camera 1"
    camera_topic = "cam-01"
    
    # Check if exists
    try:
        response = requests.get(CAMERA_URL, headers=headers)
        if response.status_code == 200:
            cameras = response.json()
            for cam in cameras:
                if cam.get("topic") == camera_topic:
                    print(f"Camera {camera_topic} already registered (ID: {cam.get('id')})")
                    return cam.get("id")
    except Exception as e:
        print(f"Error checking cameras: {e}")

    # Register
    payload = {
        "name": camera_name,
        "topic": camera_topic,
        "transformerId": transformer_id
    }
    print(f"Registering camera {camera_topic} to transformer {transformer_id}...")
    try:
        response = requests.post(f"{CAMERA_URL}/register", json=payload, headers=headers)
        if response.status_code == 201 or response.status_code == 200:
            print(f"Camera registered successfully.")
            return response.json().get("id")
        else:
            print(f"Failed to register camera: {response.status_code} {response.text}")
    except Exception as e:
        print(f"Error registering camera: {e}")

def main():
    # Wait for services to be ready
    print("Waiting for services...", flush=True)
    time.sleep(2) 

    token = login()
    if not token:
        print("No token received. Exiting.", flush=True)
        return

    # 1. Region
    region_id = get_or_create(REGION_URL, "Harare Region", {"name": "Harare Region"}, token)
    if not region_id: return

    # 2. District
    district_id = get_or_create(DISTRICT_URL, "Harare Central", {"name": "Harare Central", "regionId": region_id}, token)
    if not district_id: return

    # 3. Depot
    depot_id = get_or_create(DEPOT_URL, "Central Depot", {"name": "Central Depot", "districtId": district_id}, token)
    if not depot_id: return

    # 4. Transformer
    transformer_payload = {
        "name": "Transformer A",
        "capacity": 500,
        "isActive": True,
        "depotId": depot_id,
        "lat": -17.8252,
        "lng": 31.0335
    }
    transformer_id = get_or_create(TRANSFORMER_URL, "Transformer A", transformer_payload, token)
    if not transformer_id: return

    # 5. Sensor
    sensor_payload = {
        "name": "Door Sensor",
        "type": "contact",
        "deviceId": "door-001",
        "devEui": "ABC123456789",
        "transformerId": transformer_id
    }
    sensor_id = get_or_create(SENSOR_URL, "Door Sensor", sensor_payload, token)

    # 6. Sensor Reading (Simulate OPEN contact)
    if sensor_id:
        reading_payload = {
            "sensorId": sensor_id,
            "rawPayload": "01",
            "decoded": '{"contact": "open"}'
        }
        print("Creating sensor reading (OPEN)...")
        try:
            response = requests.post(f"{READING_URL}/create", json=reading_payload, headers={"Authorization": f"Bearer {token}"})
            if response.status_code == 201:
                print("Sensor reading created.")
            else:
                print(f"Failed to create sensor reading: {response.status_code} {response.text}")
        except Exception as e:
            print(f"Error creating reading: {e}")

    # 7. Camera
    register_camera(token, transformer_id)

if __name__ == "__main__":
    main()
