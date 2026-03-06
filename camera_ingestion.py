import paho.mqtt.client as mqtt
import os
import datetime
import time
import json
import base64
import re
import requests

# Configuration
MQTT_BROKER = os.environ.get("MQTT_BROKER", "broker.hivemq.com")
MQTT_PORT = int(os.environ.get("MQTT_PORT", 1883))
MQTT_TOPIC = os.environ.get("MQTT_TOPIC", "NE101SensingCam/Snapshot")
# Use a local directory to avoid permission issues
SAVE_DIR = os.environ.get("SAVE_DIR", os.path.join(os.getcwd(), "uploads"))

# Vision AI Service Configuration
VISION_AI_URL = os.environ.get("VISION_AI_URL", "http://localhost:8000/analyze/upload")
TRANSFORMER_SERVICE_URL = os.environ.get("TRANSFORMER_SERVICE_URL", "http://localhost:8080/api/v1/cameras/event")
ENABLE_AI_PROCESSING = True

# Cooldown Configuration
last_processed_time = 0
COOLDOWN_SECONDS = 5

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"Connected to MQTT Broker at {MQTT_BROKER}:{MQTT_PORT}")
        client.subscribe(MQTT_TOPIC)
        print(f"Subscribed to topic: {MQTT_TOPIC}")
        print(f"Images will be saved to: {SAVE_DIR}")
        print(f"Events will be sent to: {TRANSFORMER_SERVICE_URL}")
    else:
        print(f"Failed to connect, return code {rc}")

def on_disconnect(client, userdata, rc):
    if rc != 0:
        print(f"Unexpected disconnection: {rc}")
    else:
        print("Disconnected cleanly.")

def send_event_to_backend(topic, prediction, image_path):
    try:
        payload = {
            "topic": topic,
            "aiClass": prediction.get("class", "unknown"),
            "confidence": prediction.get("confidence", 0.0),
            "timestamp": datetime.datetime.now().isoformat(),
            "imagePath": os.path.basename(image_path)
        }
        print(f"Sending event to backend: {payload}")
        response = requests.post(TRANSFORMER_SERVICE_URL, json=payload)
        if response.status_code in [200, 201]:
            print("Event sent successfully.")
        else:
            print(f"Backend Error ({response.status_code}): {response.text}")
    except Exception as e:
        print(f"Failed to send event to backend: {e}")

def send_to_vision_ai(filepath, topic):
    if not ENABLE_AI_PROCESSING:
        return

    try:
        print(f"Sending {filepath} to Vision AI...")
        with open(filepath, 'rb') as f:
            files = {'file': (os.path.basename(filepath), f, 'image/jpeg')}
            headers = {'Bypass-Tunnel-Reminder': 'true'}
            response = requests.post(VISION_AI_URL, files=files, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            print(f"Vision AI Result: {result}")
            
            # Handle new response format
            prediction = {}
            if "detectedClass" in result:
                prediction = {
                    "class": result.get("detectedClass"),
                    "confidence": result.get("confidence", 0.0),
                    "alertLevel": result.get("alertLevel", "SAFE")
                }
            elif "prediction" in result:
                prediction = result["prediction"]
                
            if prediction:
                send_event_to_backend(topic, prediction, filepath)
        else:
            print(f"Vision AI Error ({response.status_code}): {response.text}")
            
    except Exception as e:
        print(f"Failed to send to Vision AI: {e}")
        print("Ensure Vision AI service is running on port 8000")

def on_message(client, userdata, msg):
    global last_processed_time
    current_time = time.time()
    
    # Simple cooldown to prevent burst captures
    if current_time - last_processed_time < COOLDOWN_SECONDS:
        print(f"Ignored burst message (Cooldown: {COOLDOWN_SECONDS}s)")
        return

    print(f"Received message on topic: {msg.topic}")
    try:
        # Parse the JSON payload
        payload_str = msg.payload.decode('utf-8')
        data = json.loads(payload_str)
        
        # Extract the Base64 image string
        # The structure seems to be: {"values": {"image": "data:image/jpeg;base64,..."}}
        if "values" in data and "image" in data["values"]:
            last_processed_time = current_time  # Update cooldown timestamp
            base64_img = data["values"]["image"]
            
            # Remove the data URL prefix if present
            if base64_img.startswith("data:image"):
                base64_img = base64_img.split(",")[1]
                
            # Decode Base64 to binary
            img_data = base64.b64decode(base64_img)
            
            # Create directory if it doesn't exist
            if not os.path.exists(SAVE_DIR):
                os.makedirs(SAVE_DIR)
                
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            filename = f"cam_{timestamp}.jpg"
            filepath = os.path.join(SAVE_DIR, filename)
            
            # Write binary image data to file
            with open(filepath, "wb") as f:
                f.write(img_data)
            
            print(f"[{timestamp}] Image decoded and saved: {filename} ({len(img_data)} bytes)")
            
            # Forward to Vision AI
            send_to_vision_ai(filepath, msg.topic)
        else:
            print("Warning: JSON payload does not contain 'values.image' field.")
            print(f"Payload keys: {data.keys()}")

    except json.JSONDecodeError:
        print("Error: Message is not valid JSON. Treating as raw binary (fallback)...")
        # Fallback for raw binary (if camera mode changes)
        try:
            if not os.path.exists(SAVE_DIR):
                os.makedirs(SAVE_DIR)
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            filename = f"cam_{timestamp}_raw.jpg"
            filepath = os.path.join(SAVE_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(msg.payload)
            print(f"[{timestamp}] Raw image saved: {filename}")
            last_processed_time = current_time # Update timestamp for raw saves too
        except Exception as e:
            print(f"Error saving raw fallback: {e}")

    except Exception as e:
        print(f"Error processing message: {e}")

def main():
    # Ensure save directory exists
    if not os.path.exists(SAVE_DIR):
        try:
            os.makedirs(SAVE_DIR)
            print(f"Created directory: {SAVE_DIR}")
        except OSError as e:
            print(f"Error creating directory {SAVE_DIR}: {e}")
            return

    client = mqtt.Client(client_id="NE101_Image_Receiver", clean_session=True)
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message

    print("Starting Camera Image Receiver & AI Bridge...")
    print(f"Target Directory: {SAVE_DIR}")
    print(f"MQTT Broker (Public): {MQTT_BROKER}:{MQTT_PORT}")
    print("---------------------------------------------------------")
    print(f"IMPORTANT: Configure your Camera's MQTT Server/Broker to:")
    print(f"           Host/IP:    {MQTT_BROKER}")
    print(f"           Port:       {MQTT_PORT}")
    print(f"           Topic:      {MQTT_TOPIC}")
    print(f"           Client ID:  NE101_Camera (or any unique name)")
    print("---------------------------------------------------------")
    print(f"Vision AI URL: {VISION_AI_URL}")
    print("Press Ctrl+C to stop.")

    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_forever()
        print("loop_forever returned")
    except KeyboardInterrupt:
        print("\nStopping...")
        client.disconnect()
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        print("Please ensure Mosquitto MQTT broker is running.")

if __name__ == "__main__":
    main()
