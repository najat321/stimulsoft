# Reporting System Guide

This guide explains how to manage reports, add data sources, and integrate them into the Stimulsoft reporting environment.

## 1. Adding New Data Sources (APIs)

To make new data available to the Report Designer, you need to expose it via an API endpoint in `server.js` and then register it in the frontend.

### Step 1: Create the API Endpoint
In `server.js`, add a new route that functions as your data provider.

**Example: Fetching a new table "Orders"**
```javascript
app.get('/api/orders', async (req, res) => {
    try {
        // Fetch from SQL
        let result = await pool.request().query("SELECT * FROM Orders");
        res.json(result.recordset);
    } catch (e) {
        res.status(500).send("Error fetching orders");
    }
});
```

### Step 2: Register in Designer
In `public/designer.html`, inside the `loadSelectedReport` function (or the initial load block), fetch this new data and register it.

```javascript
/* ... inside the async loading function ... */

// 1. Fetch data
const res = await fetch('/api/orders');
const ordersData = await res.json();

// 2. Create DataSet
var ordersDataSet = new Stimulsoft.System.Data.DataSet("OrdersDS");
ordersDataSet.readJson({ Orders: ordersData });

// 3. Register Data
report.regData("OrdersDS", "OrdersDS", ordersDataSet);

// 4. Sync Dictionary
report.dictionary.synchronize();
```
*Note: Ensure you declare `ordersDataSet` globally if you want it to persist across report loads.*

---

## 2. Adding New Report Templates

Report templates are stored as `.mrt` files.

1.  **Location**: Place your `.mrt` files in the `public/reports/` directory.
2.  **Auto-Discovery**: The application is configured to automatically list all `.mrt` files found in this directory in the Designer's dropdown menu.
3.  **Loading**: Select the report from the dropdown in the web designer and click "Load Report".

---

## 3. Workflow for Clients (Designing Reports)

Clients or designers can use the web interface to create and modify reports.

### Variable Data vs. Static Data
- **Static Data**: Data that is hardcoded or fixed.
- **Dynamic Data**: Data fetched from your database (like `Customers`, `Materials`). This appears in the **Dictionary** tab on the right side of the Designer.

### Steps to Design a Report
1.  **Open the Designer**: Navigate to `http://localhost:3000/designer`.
2.  **Load Data**: The system automatically attempts to load connected data sources (e.g., SQL Data, ManWinWin Data). Check the **Dictionary** panel.
    - If you don't see your data, ensure the API is working and the page loaded correctly.
3.  **Drag and Drop**: Drag fields from the Dictionary onto the report page.
4.  **Data Bands**: To list multiple items (like a list of customers), you must use a **Data Band**.
    - Go to `Insert` -> `Band` -> `Data Band`.
    - Select your data source (e.g., `Customers`).
    - Place text boxes inside this band.
5.  **Pagination**:
    - To ensure data flows to the next page, select your Data Band.
    - Set the property **Can Break** to `True`.
6.  **Save**: Click the "Save" button (disk icon). This saves the `.mrt` file back to the server in `public/reports/`.

---

## 4. Integration

The reporting tool is integrated via two main HTML files in the `public` folder:

-   `designer.html`: The editor interface.
-   `viewer.html`: The read-only viewer interface.

To integrate this into another part of your application (e.g., an iframe or a link), simply point to:
`http://your-server:3000/designer` or `http://your-server:3000/viewer`.
