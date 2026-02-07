import os
import argparse
from pathlib import Path
import zipfile

# Note: For Kaggle downloads to work, ensure you have a kaggle.json file in:
# Windows: C:\Users\<Username>\.kaggle\kaggle.json
# Linux/Mac: ~/.kaggle/kaggle.json
# You can generate this token from your Kaggle account settings -> API -> Create New Token

def download_fire_dataset(target_dir):
    """
    Downloads a Fire Detection Dataset from Kaggle.
    Dataset: 'phylake1337/fire-dataset' (Common starter dataset)
    """
    print("\n--- Downloading Fire Detection Dataset ---")
    try:
        import kaggle
        dataset_name = "phylake1337/fire-dataset"
        print(f"Authenticating with Kaggle and downloading {dataset_name}...")
        
        # Download
        kaggle.api.dataset_download_files(dataset_name, path=target_dir, unzip=True)
        print(f"Success! Fire dataset downloaded to {target_dir}")
        
    except OSError as e:
        print("Error: Could not find kaggle.json configuration.")
        print("Please ensure you have placed your API token at ~/.kaggle/kaggle.json")
        print("Instructions: https://www.kaggle.com/docs/api")
    except Exception as e:
        print(f"Failed to download Fire dataset: {e}")

def scrape_industrial_images(target_dir, max_num=1000):
    """
    Uses icrawler to scrape Google/Bing for industrial images.
    Target: 1000+ images per category using multiple search terms.
    """
    print(f"\n--- Scraping Industrial Images (Target: ~{max_num} per class) ---")
    from icrawler.builtin import BingImageCrawler

    # Multiple search terms per class to increase variety and count
    classes_terms = {
        "normal": [
            "electrical substation equipment", 
            "power transformer industrial", 
            "electrical switchyard", 
            "substation yard cctv",
            "high voltage transformer",
            "electrical grid infrastructure"
        ],
        "intruder": [
            "person in warehouse cctv", 
            "security camera intruder", 
            "thief in industrial area", 
            "construction worker on site cctv", 
            "unauthorized person in restricted area",
            "burglar caught on cctv"
        ],
        "fire": [
            "fire in warehouse", 
            "industrial fire smoke", 
            "electrical fire substation", 
            "transformer fire", 
            "smoke billowing from factory",
            "building fire cctv"
        ],
        "defect": [
            "rusted metal industrial equipment", 
            "corroded pipes industrial", 
            "oil leak transformer", 
            "broken machinery part", 
            "cracked concrete industrial wall",
            "damaged electrical insulator"
        ],
        "climbing": [
            "person climbing electric tower", 
            "person climbing fence cctv", 
            "worker climbing transmission tower", 
            "person scaling gate security camera", 
            "climbing pylon danger",
            "person climbing wall cctv"
        ]
    }

    # Split max_num among search terms (approx)
    # If max_num is 1000 and we have 5 terms, we do 200 per term.
    
    for class_name, search_terms in classes_terms.items():
        save_path = os.path.join(target_dir, class_name)
        os.makedirs(save_path, exist_ok=True)
        
        num_terms = len(search_terms)
        per_term_limit = int(max_num / num_terms) + 50 # Add buffer
        
        print(f"\n--- Processing Class: {class_name} (Terms: {num_terms}, ~{per_term_limit} imgs/term) ---")
        
        for term in search_terms:
            print(f"  > Scraping term: '{term}'...")
            try:
                # Use a subdirectory per term temporarily to avoid name collisions if crawler doesn't handle unique well
                # Actually icrawler handles naming (000001.jpg), but if we restart it might overwrite.
                # BingImageCrawler usually skips or overwrites. 
                # To be safe, let's just dump them all in the class folder, icrawler auto-increments if we configure it right?
                # Default behavior: 000001.jpg. If we run multiple times, it might overwrite.
                # Let's use a unique prefix or just let it run. 
                # icrawler doesn't support prefix easily in standard API. 
                # Workaround: Use different folders then merge, OR trust it checks existing.
                # We will trust it for now but note that 'file_idx_offset' can be used if needed.
                # Actually, let's use 'offset' logic manually or just separate folders and let organize_data.py handle it.
                
                term_safe = term.replace(" ", "_")
                term_dir = os.path.join(save_path, term_safe)
                
                crawler = BingImageCrawler(storage={'root_dir': term_dir})
                crawler.crawl(keyword=term, max_num=per_term_limit)
            except Exception as e:
                print(f"    ! Error scraping '{term}': {e}")


def download_coco_subset(target_dir):
    """
    Instructional helper for COCO (Person detection).
    Downloading full COCO is huge (20GB+), so we advise on 'Person' subset.
    """
    print("\n--- Person Detection Data (COCO) ---")
    print("Downloading the full COCO dataset is very large (>20GB).")
    print("For 'Person' detection, it is recommended to use a pre-trained Yolo/ResNet model first.")
    print("However, we have scraped 'intruder' images above for your custom model training.")

def main():
    parser = argparse.ArgumentParser(description="Download/Scrape Training Data for Vision AI")
    parser.add_argument("--output", type=str, default="training_data", help="Output directory")
    parser.add_argument("--scrape-only", action="store_true", help="Only scrape images, skip Kaggle download")
    parser.add_argument("--kaggle-only", action="store_true", help="Only download Kaggle datasets")
    
    args = parser.parse_args()
    
    base_dir = Path(args.output)
    base_dir.mkdir(exist_ok=True)
    
    if not args.scrape_only:
        download_fire_dataset(base_dir / "fire_dataset")
        
    if not args.kaggle_only:
        scrape_industrial_images(base_dir / "scraped_data")
        
    download_coco_subset(base_dir)
    
    print("\n\n=== Data Download Complete ===")
    print(f"Data is located in: {base_dir.absolute()}")
    print("Review the images and clean up any irrelevant scraped data before training.")

if __name__ == "__main__":
    main()
