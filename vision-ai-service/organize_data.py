import shutil
import os
from pathlib import Path

def organize():
    base = Path("training_data")
    scraped = base / "scraped_data"
    
    if not scraped.exists():
        print("No scraped_data folder found. Already organized?")
        return

    # Iterate through folders inside scraped_data (e.g., climbing, defect, fire)
    for category in scraped.iterdir():
        if category.is_dir():
            target = base / category.name
            target.mkdir(exist_ok=True)
            print(f"Processing category: {category.name} -> {target}")
            
            # Iterate through files and subdirectories in the category folder
            for item in category.rglob("*"):
                if item.is_file():
                    dest = target / item.name
                    # Avoid overwriting with same name, rename if needed
                    counter = 1
                    while dest.exists():
                        stem = item.stem
                        suffix = item.suffix
                        dest = target / f"{stem}_{counter}{suffix}"
                        counter += 1
                    
                    shutil.move(str(item), str(dest))
            
            # Remove the empty category folder and subfolders inside scraped_data
            try:
                shutil.rmtree(category)
            except OSError:
                print(f"Could not remove {category}, it might not be empty.")

    # Try to remove the main scraped_data folder
    try:
        scraped.rmdir()
        print("Cleaned up scraped_data directory.")
    except OSError:
        print("scraped_data directory not empty, could not remove.")

    print("Organization complete.")

if __name__ == "__main__":
    organize()