import os
import hashlib
from PIL import Image
from pathlib import Path

def calculate_md5(file_path):
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def clean_dataset(root_dir):
    print(f"Scanning {root_dir} for issues...")
    root = Path(root_dir)
    
    hashes = {}
    duplicates = 0
    corrupt = 0
    tiny = 0
    total = 0
    
    for file_path in root.rglob("*"):
        if file_path.is_file():
            total += 1
            # 1. Check for Valid Image
            try:
                with Image.open(file_path) as img:
                    img.verify() # Verify it's an image
                    
                # Re-open to check size (verify closes the file)
                with Image.open(file_path) as img:
                    width, height = img.size
                    if width < 50 or height < 50:
                        print(f"Removing tiny image: {file_path} ({width}x{height})")
                        file_path.unlink()
                        tiny += 1
                        continue
                        
            except (IOError, SyntaxError) as e:
                print(f"Removing corrupt file: {file_path}")
                try:
                    file_path.unlink()
                except:
                    pass
                corrupt += 1
                continue
                
            # 2. Check for Duplicates
            file_hash = calculate_md5(file_path)
            if file_hash in hashes:
                print(f"Removing duplicate: {file_path} (Duplicate of {hashes[file_hash]})")
                try:
                    file_path.unlink()
                except:
                    pass
                duplicates += 1
            else:
                hashes[file_hash] = file_path

    print("\n--- Cleaning Summary ---")
    print(f"Total files scanned: {total}")
    print(f"Corrupt files removed: {corrupt}")
    print(f"Tiny images (<50px) removed: {tiny}")
    print(f"Duplicates removed: {duplicates}")
    print(f"Remaining valid images: {len(hashes)}")

if __name__ == "__main__":
    clean_dataset("training_data")
