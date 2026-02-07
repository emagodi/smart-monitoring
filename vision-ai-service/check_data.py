
import torch
from torchvision import datasets, transforms
from torch.utils.data import DataLoader
import os
import sys

def check_images():
    print("Starting check...")
    try:
        data_transforms = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
        ])
        
        dataset = datasets.ImageFolder("training_data", transform=data_transforms)
        loader = DataLoader(dataset, batch_size=1, shuffle=False, num_workers=0)
        
        print(f"Checking {len(dataset)} images...")
        
        for i, (inputs, labels) in enumerate(loader):
            if i % 100 == 0:
                print(f"Checked {i} images...")
                
        print("All images checked successfully.")
    except Exception as e:
        print(f"ERROR CAUGHT: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_images()
