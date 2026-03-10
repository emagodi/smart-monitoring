import os
import torch
from torch.utils.data import Dataset, DataLoader
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
from sklearn.model_selection import train_test_split
from tqdm import tqdm

# Configuration
DATASET_PATH = "dataset"
MODEL_NAME = "openai/clip-vit-base-patch32"
BATCH_SIZE = 4
EPOCHS = 5
LEARNING_RATE = 5e-6
SAVE_PATH = "fine_tuned_clip_model"

# Custom Dataset
class TransformerSecurityDataset(Dataset):
    def __init__(self, image_paths, labels, processor):
        self.image_paths = image_paths
        self.labels = labels
        self.processor = processor
        # Define labels map
        self.label_map = {
            "climbing": "a photo of a person climbing a transformer",
            "door_opening": "a photo of an open transformer door"
        }

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        image = Image.open(self.image_paths[idx]).convert("RGB")
        label_text = self.label_map[self.labels[idx]]
        
        # Prepare inputs for CLIP
        # Important: padding="max_length" ensures all tensors are same size for batching
        inputs = self.processor(
            text=[label_text],
            images=image,
            return_tensors="pt",
            padding="max_length",
            truncation=True,
            max_length=77
        )
        
        return {
            "pixel_values": inputs.pixel_values.squeeze(),
            "input_ids": inputs.input_ids.squeeze(),
            "attention_mask": inputs.attention_mask.squeeze()
        }

def train():
    print("Preparing dataset...")
    image_paths = []
    labels = []
    
    # Load dataset
    for class_name in ["climbing", "door_opening"]:
        class_dir = os.path.join(DATASET_PATH, class_name)
        if os.path.exists(class_dir):
            for img_name in os.listdir(class_dir):
                if img_name.lower().endswith(('.png', '.jpg', '.jpeg')):
                    image_paths.append(os.path.join(class_dir, img_name))
                    labels.append(class_name)
    
    if not image_paths:
        print("No images found! Please ensure 'dataset/climbing' and 'dataset/door_opening' exist.")
        return

    print(f"Found {len(image_paths)} images.")

    # Initialize Model & Processor
    processor = CLIPProcessor.from_pretrained(MODEL_NAME)
    model = CLIPModel.from_pretrained(MODEL_NAME)
    
    # Dataset & Dataloader
    dataset = TransformerSecurityDataset(image_paths, labels, processor)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)
    
    # Optimizer
    optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE)
    
    # Training Loop
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    model.train()
    
    print(f"Starting training on {device}...")
    
    for epoch in range(EPOCHS):
        total_loss = 0
        progress_bar = tqdm(dataloader, desc=f"Epoch {epoch+1}/{EPOCHS}")
        
        for batch in progress_bar:
            pixel_values = batch["pixel_values"].to(device)
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            
            outputs = model(
                input_ids=input_ids, 
                pixel_values=pixel_values, 
                attention_mask=attention_mask,
                return_loss=True
            )
            
            loss = outputs.loss
            total_loss += loss.item()
            
            loss.backward()
            optimizer.step()
            optimizer.zero_grad()
            
            progress_bar.set_postfix({"loss": loss.item()})
            
        print(f"Epoch {epoch+1} Loss: {total_loss / len(dataloader)}")

    # Save Model
    print("Saving fine-tuned model...")
    model.save_pretrained(SAVE_PATH)
    processor.save_pretrained(SAVE_PATH)
    print(f"Model saved to {SAVE_PATH}")

if __name__ == "__main__":
    train()
