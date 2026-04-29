# Excel Upload Columns

Use one sheet with any of these common headers:

- `SKU` or `Code`
- `LaptopName` or `Model` or `Name`
- `Brand` or `Company`
- `RAM` or `Memory`
- `Storage` or `Disk`
- `PurchasePrice` or `BuyPrice` or `Cost`
- `SellingPrice` or `SalePrice` or `Price`
- `Stock` or `Qty` or `Quantity`
- `WarrantyMonths` or `Warranty`

Example row:

`LT-001,ThinkPad X1,Lenovo,16GB,512GB SSD,900,1200,8,12`

Notes:
- Prices can be numeric like `1200`, `1,200`, `1200.50`, or `1,200.50`.
- Numeric RAM like `16384` is auto-converted to `16GB`.
- Numeric Storage like `512` is auto-converted to `512GB`.
- To remove imported products from UI: `Products -> Clear Catalog`.
