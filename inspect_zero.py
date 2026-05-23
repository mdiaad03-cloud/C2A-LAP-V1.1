import json
import os

db_path = './server/src/data/db.json'
output_path = './inspect_zero_report.txt'

try:
    with open(db_path, 'r', encoding='utf-8') as f:
        db = json.load(f)
    
    products = db.get('products', [])
    sales = db.get('sales', [])
    orders = db.get('onlineOrders', [])
    
    zero_products = [p for p in products if not p.get('price') or p.get('price') == 0 or not p.get('sellingPrice') or p.get('sellingPrice') == 0]
    
    report = []
    report.append(f"Total products: {len(products)}")
    report.append(f"Zero-priced products: {len(zero_products)}")
    report.append('\n--- Products Details & Matches ---')
    
    for prod in zero_products:
        p_id = prod.get('id')
        sku = prod.get('sku')
        name = prod.get('laptopName', '')
        ram = prod.get('ram', '')
        storage = prod.get('storage', '')
        
        # Try to match in sales
        matches = []
        for s in sales:
            s_name = str(s.get('laptopName', '')).lower()
            p_name = name.lower()
            if s_name in p_name or p_name in s_name:
                matches.append(s)
                
        # Try to match in online orders
        order_matches = []
        for o in orders:
            for item in o.get('items', []):
                i_name = str(item.get('laptopName', item.get('name', ''))).lower()
                p_name = name.lower()
                if i_name in p_name or p_name in i_name:
                    order_matches.append((o, item))
                    
        report.append(f"Product ID: {p_id}")
        report.append(f"SKU: {sku}")
        report.append(f"Name: {name}")
        report.append(f"Specs: RAM {ram}, Storage {storage}")
        
        if matches:
            report.append("  Matched Sales:")
            for m in matches:
                report.append(f"    - Sale ID: {m.get('id')}, Date: {m.get('purchaseDate')}, PurchasePrice: {m.get('purchasePrice')}, SellingPrice: {m.get('sellingPrice')}")
        else:
            report.append("  No matched sales found.")
            
        if order_matches:
            report.append("  Matched Online Orders:")
            for o, item in order_matches:
                price = item.get('price') or item.get('sellingPrice')
                report.append(f"    - Order #: {o.get('orderNumber')}, Status: {o.get('status')}, Price in Order: {price}")
        else:
            report.append("  No matched online orders found.")
        report.append('----------------------------------\n')
        
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(report))
        
    print("Success: inspect_zero.py completed")
    
except Exception as e:
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(f"Error: {str(e)}")
    print(f"Error: {e}")
