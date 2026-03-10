import requests
import json
import time

# URLs
REGISTER_URL = "http://auth-service:8082/api/v1/auth/register"
READING_URL = "http://gateway:8080/api/v1/controllers/37/readings"

# User Data
user_data = {
    "firstname": "Test",
    "lastname": "Admin",
    "email": "testadmin5@test.com",
    "role": "ADMIN",
    "phone": "+263770000000"
}

try:
    # Register
    print(f"Registering user {user_data['email']}...")
    reg_response = requests.post(REGISTER_URL, json=user_data)
    
    token = None
    if reg_response.status_code in [200, 201]:
        print("Registration successful.")
        resp_json = reg_response.json()
        print(f"Response JSON: {resp_json}")
        token = resp_json.get("accessToken") or resp_json.get("access_token") or resp_json.get("token")
        
        if token:
            print(f"Token: {token[:20]}...")
        else:
            print("Token not found in response.")
            
    elif "Email already taken" in reg_response.text:
        print("User already exists. Cannot proceed without password (it was random).")
    else:
        print(f"Registration failed ({reg_response.status_code}): {reg_response.text}")

    if token:
        # Post Reading
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Trigger logic: di1=false, di2=true (Should trigger alert with new logic)
        reading_payload = {
            "di1": False,
            "di2": True,
            "battery": 100,
            "rssi": -50,
            "snr": 10,
            "rawPayload": "test_trigger_payload"
        }
        
        print(f"Posting reading to {READING_URL} with payload: {reading_payload}")
        reading_response = requests.post(READING_URL, json=reading_payload, headers=headers)
        
        if reading_response.status_code in [200, 201]:
            print("Reading posted successfully.")
            print(f"Response: {reading_response.text}")
        else:
            print(f"Failed to post reading ({reading_response.status_code}): {reading_response.text}")
            
except Exception as e:
    print(f"Error: {e}")
