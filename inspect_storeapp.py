with open('./client/src/store/StoreApp.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'product-card' in line or 'ProductCard' in line or 'p.price' in line or 'p.sellingPrice' in line or 'image' in line.lower() and 'p.' in line:
        print(f"Line {i+1}: {line.strip()}")
