
import torch
import torch.nn as nn
import torchvision.models as models
from torchvision import transforms
import numpy as np
from PIL import Image
import io

# --- Perception: CNN for Visual Inspection ---
class IndustrialVisionModel(nn.Module):
    def __init__(self, pretrained=True):
        super(IndustrialVisionModel, self).__init__()
        # Use ResNet50 for higher accuracy (Deeper architecture)
        # Weights parameter is preferred in newer torchvision versions
        try:
            self.backbone = models.resnet50(weights=models.ResNet50_Weights.DEFAULT if pretrained else None)
        except:
            # Fallback for older torchvision versions
            self.backbone = models.resnet50(pretrained=pretrained)
        
        # Replace the final layer for our specific industrial classes
        # Default Classes (will be overridden if weights are loaded): 
        # 0: Normal, 1: Defect/Corrosion, 2: Oil Leak, 3: Intruder/Person
        num_ftrs = self.backbone.fc.in_features
        self.num_classes = 4
        self.classes = ["Normal", "Defect/Corrosion", "Oil Leak", "Intruder"]
        self.backbone.fc = nn.Linear(num_ftrs, self.num_classes)
        
        self.transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

    def set_classes(self, class_list):
        self.classes = class_list
        self.num_classes = len(class_list)
        # Note: The caller must update self.backbone.fc separately if changing dimensions

    def forward(self, x):
        return self.backbone(x)
    
    def predict(self, image_bytes):
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        tensor = self.transform(image).unsqueeze(0)
        
        self.eval()
        with torch.no_grad():
            outputs = self(tensor)
            probs = torch.nn.functional.softmax(outputs, dim=1)
            confidence, predicted = torch.max(probs, 1)
            
        predicted_idx = predicted.item()
        if 0 <= predicted_idx < len(self.classes):
            class_name = self.classes[predicted_idx]
        else:
            class_name = f"Unknown (Index {predicted_idx})"

        return {
            "class": class_name,
            "confidence": float(confidence.item()),
            "probabilities": probs.tolist()[0]
        }

# --- Behavior Modeling: Autoencoder for Sensor Anomaly Detection ---
class SensorBehaviorModel(nn.Module):
    def __init__(self, input_dim=1):
        super(SensorBehaviorModel, self).__init__()
        # Encoder
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 8),
            nn.ReLU(),
            nn.Linear(8, 4),
            nn.ReLU(),
            nn.Linear(4, 2)  # Latent space
        )
        # Decoder
        self.decoder = nn.Sequential(
            nn.Linear(2, 4),
            nn.ReLU(),
            nn.Linear(4, 8),
            nn.ReLU(),
            nn.Linear(8, input_dim)
        )
    
    def forward(self, x):
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded

    def detect_anomaly(self, value, threshold=0.1):
        # Normalize/Preprocess input (simplified for single value)
        # In production, this would use a sliding window of historical data
        tensor_val = torch.tensor([[float(value)]], dtype=torch.float32)
        
        self.eval()
        with torch.no_grad():
            reconstructed = self(tensor_val)
            loss = torch.mean((tensor_val - reconstructed) ** 2)
            
        is_anomaly = loss.item() > threshold
        return {
            "is_anomaly": is_anomaly,
            "reconstruction_error": float(loss.item()),
            "threshold": threshold
        }

