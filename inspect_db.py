import json
import os

db_path = './server/src/data/db.json'
output_path = './output.txt'

try:
    with open(db_path, 'r', encoding='utf-8') as f:
        db = json.load(f)
    
    products = db.get('products', [])
    log_content = f"Total products: {len(products)}\n"
    for i, p in enumerate(products[:10]):
        log_content += f"Product {i}:\n"
        log_content += f"  ID: {p.get('id')}\n"
        log_content += f"  Brand: {p.get('brand')}\n"
        log_content += f"  Model: {p.get('model')}\n"
        log_content += f"  Price: {p.get('sellingPrice')}\n"
        log_content += f"  Images: {p.get('images')}\n"
        log_content += f"  ImageUrls: {p.get('imageUrls')}\n"
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(log_content)
    print("Success python inspect")
except Exception as e:
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(f"Error: {str(e)}")
    print(f"Error: {e}")
