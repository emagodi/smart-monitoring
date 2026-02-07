
class FusionEngine:
    """
    Intelligent Fusion Engine
    Combines Perceptual Data (Vision), Behavioral Data (Sensor Models), and Domain Knowledge (Rules)
    to calculate a unified Risk Score and Decision.
    """
    
    def __init__(self):
        # Weights for different factors
        self.w_visual = 0.4
        self.w_sensor = 0.4
        self.w_history = 0.2
        
    def fuse(self, sensor_anomaly_result, visual_result=None, sensor_type=None):
        """
        Fusion Logic:
        Risk Score = (w_v * visual_risk) + (w_s * sensor_risk) + context_modifiers
        """
        
        # 1. Calculate Sensor Risk
        sensor_risk = 0.0
        if sensor_anomaly_result["is_anomaly"]:
            # Sigmoid-like scaling of error
            error = sensor_anomaly_result["reconstruction_error"]
            threshold = sensor_anomaly_result["threshold"]
            # The more the error exceeds threshold, the higher the risk
            ratio = error / (threshold + 1e-6)
            sensor_risk = min(1.0, 0.5 + (ratio * 0.1)) # Base 0.5 for any anomaly
        
        # 2. Calculate Visual Risk (if camera correlation exists)
        visual_risk = 0.0
        visual_details = "No visual data"
        if visual_result:
            cls = visual_result.get("class")
            conf = visual_result.get("confidence", 0.0)
            
            if cls in ["Defect/Corrosion", "Oil Leak"]:
                visual_risk = 0.8 * conf
            elif cls == "Intruder":
                visual_risk = 0.9 * conf
            visual_details = f"Detected {cls} ({conf:.2f})"
        
        # 3. Fusion
        # If visual data is missing, re-weight sensor data
        if not visual_result:
            final_risk = sensor_risk  # Purely sensor driven if no eyes
        else:
            final_risk = (self.w_sensor * sensor_risk) + (self.w_visual * visual_risk)
            # Boost if both agree (Fusion Amplification)
            if sensor_risk > 0.5 and visual_risk > 0.5:
                final_risk = min(1.0, final_risk * 1.2)

        # 4. Decision Support
        decision = "SAFE"
        if final_risk > 0.8:
            decision = "CRITICAL"
        elif final_risk > 0.4:
            decision = "WARNING"
            
        return {
            "risk_score": float(final_risk),
            "decision": decision,
            "details": f"Fusion Result: Sensor Risk={sensor_risk:.2f}, Visual={visual_details}",
            "components": {
                "sensor_risk": sensor_risk,
                "visual_risk": visual_risk
            }
        }
