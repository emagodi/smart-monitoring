
import os
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, models, transforms
from torch.utils.data import DataLoader, random_split
from PIL import Image

# Configuration
DATA_DIR = "./dataset"
MODEL_SAVE_PATH = "./model_v1.pth"
BATCH_SIZE = 4
NUM_EPOCHS = 10
LEARNING_RATE = 0.001
IMG_SIZE = 224

def train_model():
    print("Preparing data...")
    
    # Define transforms
    data_transforms = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.RandomHorizontalFlip(),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    # Load dataset
    # We expect dataset/climbing and dataset/door_opening
    # We also need a 'safe' or 'normal' class. 
    # Since we only have 'climbing' and 'door_opening', we will treat this as a multi-label or multi-class problem.
    # However, for a robust system, we usually need a 'negative' class (e.g., normal transformer).
    # For this quick prototype, we'll assume:
    # 0: climbing
    # 1: door_opening
    # (If you had a 'normal' folder, it would be 2)
    
    full_dataset = datasets.ImageFolder(DATA_DIR, transform=data_transforms)
    class_names = full_dataset.classes
    print(f"Classes found: {class_names}")

    # Split dataset
    train_size = int(0.8 * len(full_dataset))
    val_size = len(full_dataset) - train_size
    train_dataset, val_dataset = random_split(full_dataset, [train_size, val_size])

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)

    print(f"Training on {train_size} images, validating on {val_size} images")

    # Load pre-trained ResNet18
    print("Loading ResNet18 model...")
    model = models.resnet18(pretrained=True)
    num_ftrs = model.fc.in_features
    model.fc = nn.Linear(num_ftrs, len(class_names)) # Output layer for our classes

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    model = model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.SGD(model.parameters(), lr=LEARNING_RATE, momentum=0.9)

    # Training loop
    print("Starting training...")
    for epoch in range(NUM_EPOCHS):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0

        for inputs, labels in train_loader:
            inputs = inputs.to(device)
            labels = labels.to(device)

            optimizer.zero_grad()

            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * inputs.size(0)
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()

        epoch_loss = running_loss / train_size
        epoch_acc = correct / total

        print(f"Epoch {epoch+1}/{NUM_EPOCHS} - Loss: {epoch_loss:.4f} - Acc: {epoch_acc:.4f}")

    print("Training complete.")
    
    # Save model
    torch.save(model.state_dict(), MODEL_SAVE_PATH)
    print(f"Model saved to {MODEL_SAVE_PATH}")

    # Save class names
    with open("class_names.txt", "w") as f:
        for class_name in class_names:
            f.write(f"{class_name}\n")
    print("Class names saved to class_names.txt")
    
    # Save class names for inference
    with open("class_names.txt", "w") as f:
        for c in class_names:
            f.write(c + "\n")

if __name__ == "__main__":
    # Check if data dirs exist
    if not os.path.exists(os.path.join(DATA_DIR, "climbing")) or not os.path.exists(os.path.join(DATA_DIR, "door_opening")):
        print("Error: Dataset directories not found. Please ensure 'dataset/climbing' and 'dataset/door_opening' exist.")
    else:
        train_model()
