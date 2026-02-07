import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms
from torch.utils.data import DataLoader
import os
from pathlib import Path
from models import IndustrialVisionModel

import warnings
warnings.filterwarnings("ignore")

def train_model():
    DATA_DIR = "training_data"
    MODEL_SAVE_PATH = "industrial_model.pth"
    MAPPING_SAVE_PATH = "class_mapping.txt"
    BATCH_SIZE = 4   # Reduced batch size for ResNet50 on CPU
    EPOCHS = 30      # Increased for better convergence with ResNet50
    LEARNING_RATE = 0.005 # Adjusted for SGD

    # Define transforms (Data Augmentation)
    data_transforms = {
        'train': transforms.Compose([
            transforms.RandomResizedCrop(224, scale=(0.8, 1.0)), # Robustness to scale/cropping
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(15),
            transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2, hue=0.1),
            transforms.RandomGrayscale(p=0.1),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ]),
        'val': transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ]),
    }

    print("--- Preparing Data ---")
    full_dataset = datasets.ImageFolder(DATA_DIR, data_transforms['train']) # Use train transforms for now
    
    # Split into Train (80%) and Validation (20%)
    train_size = int(0.8 * len(full_dataset))
    val_size = len(full_dataset) - train_size
    train_dataset, val_dataset = torch.utils.data.random_split(full_dataset, [train_size, val_size])
    
    # Apply 'val' transform logic implies needing separate datasets, but for simplicity/speed
    # in this script we'll just use the augmented ones or split manually. 
    # For a robust script, we'd wrap subsets. Here we proceed with standard loaders.
    
    dataloaders = {
        'train': DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0),
        'val': DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
    }
    dataset_sizes = {'train': train_size, 'val': val_size}
    class_names = full_dataset.classes
    
    print(f"Classes found: {class_names}")
    print(f"Training on {train_size} images, Validating on {val_size} images")
    
    # Save Class Mapping
    with open(MAPPING_SAVE_PATH, "w") as f:
        for cls in class_names:
            f.write(f"{cls}\n")
    print(f"Saved class mapping to {MAPPING_SAVE_PATH}")

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    print(f"Training on: {device}")

    # Load Model
    model = IndustrialVisionModel(pretrained=True)
    num_ftrs = model.backbone.fc.in_features
    model.backbone.fc = nn.Linear(num_ftrs, len(class_names))
    model = model.to(device)

    criterion = nn.CrossEntropyLoss()
    # Use SGD with Momentum and Weight Decay for better generalization on ResNet50
    optimizer = optim.SGD(model.parameters(), lr=LEARNING_RATE, momentum=0.9, weight_decay=1e-4)
    
    # Cosine Annealing Scheduler (Smooth decay to fine-tune)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

    best_acc = 0.0

    print("\n--- Starting Training ---")
    for epoch in range(EPOCHS):
        print(f'Epoch {epoch+1}/{EPOCHS}')
        print('-' * 10)

        for phase in ['train', 'val']:
            if phase == 'train':
                model.train()
            else:
                model.eval()

            running_loss = 0.0
            running_corrects = 0

            for i, (inputs, labels) in enumerate(dataloaders[phase]):
                inputs = inputs.to(device)
                labels = labels.to(device)

                optimizer.zero_grad()

                with torch.set_grad_enabled(phase == 'train'):
                    outputs = model(inputs)
                    _, preds = torch.max(outputs, 1)
                    loss = criterion(outputs, labels)

                    if phase == 'train':
                        loss.backward()
                        optimizer.step()

                running_loss += loss.item() * inputs.size(0)
                running_corrects += torch.sum(preds == labels.data)
                
                if phase == 'train' and i % 10 == 0:
                    print(f"\rBatch {i}/{len(dataloaders[phase])} Loss: {loss.item():.4f}", end="")
            
            print() # Newline after phase

            
            if phase == 'train':
                scheduler.step()

            epoch_loss = running_loss / dataset_sizes[phase]
            epoch_acc = running_corrects.double() / dataset_sizes[phase]

            print(f'{phase} Loss: {epoch_loss:.4f} Acc: {epoch_acc:.4f}')
            
            if phase == 'val' and epoch_acc > best_acc:
                best_acc = epoch_acc
                torch.save(model.state_dict(), MODEL_SAVE_PATH)
                print("-> Model Saved (New Best Accuracy)")

    print(f'\nBest Val Acc: {best_acc:.4f}')
    print("Training Complete.")

if __name__ == "__main__":
    train_model()
