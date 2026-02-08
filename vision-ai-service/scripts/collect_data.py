import os
import shutil
from icrawler.builtin import BingImageCrawler, GoogleImageCrawler

def create_dirs(base_dir, classes):
    if not os.path.exists(base_dir):
        os.makedirs(base_dir)
    for cls in classes:
        cls_dir = os.path.join(base_dir, cls)
        if not os.path.exists(cls_dir):
            os.makedirs(cls_dir)

def crawl_images(base_dir, classes, max_num=1000):
    for cls in classes:
        print(f"Starting download for class: {cls}")
        save_dir = os.path.join(base_dir, cls)
        
        # Define search keywords for each class to improve quality
        keywords = {
            "normal": ["electric transformer", "substation equipment", "power pole transformer"],
            "intruder": ["person climbing fence", "thief in substation", "intruder cctv", "burglar night"],
            "fire": ["electrical fire", "transformer explosion fire", "substation smoke", "fire flame"],
            "defect": ["rusted transformer", "broken electrical insulator", "leaking oil transformer", "damaged power equipment"],
            "climbing": ["person climbing pole", "climbing electrical tower", "worker climbing transformer", "man climbing fence"]
        }
        
        search_terms = keywords.get(cls, [cls])
        
        # Distribute max_num among search terms
        num_per_term = max_num // len(search_terms)
        
        for term in search_terms:
            print(f"  Searching for: {term}")
            try:
                crawler = BingImageCrawler(storage={'root_dir': save_dir})
                crawler.crawl(keyword=term, max_num=num_per_term, file_idx_offset='auto')
            except Exception as e:
                print(f"  Error searching for {term}: {e}")

if __name__ == "__main__":
    CLASSES = ['normal', 'intruder', 'fire', 'defect', 'climbing']
    BASE_DIR = "../datasets/raw"
    
    create_dirs(BASE_DIR, CLASSES)
    crawl_images(BASE_DIR, CLASSES, max_num=1000) # Full scale download
