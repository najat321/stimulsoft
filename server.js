require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const path = require('node:path');

const fs = require('node:fs');

const app = express();

// Middleware to parse JSON and URL-encoded bodies
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 3000;
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function startServer() {
    try {
        const pool = await sql.connect(dbConfig);
        console.log("[INFO] Connected to MSSQL Database");

        const reportsDir = path.join(__dirname, 'public', 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        // report saving
        app.post('/api/save-report', async (req, res) => {
            const { fileName, reportContent } = req.body;

            if (!fileName || !reportContent) {
                return res.status(400).send("Missing fileName or reportContent");
            }

            try {
                const safeFileName = fileName.endsWith('.mrt') ? fileName : `${fileName}.mrt`;
                const safeFilePath = path.join(reportsDir, safeFileName);

                fs.writeFileSync(safeFilePath, reportContent, 'utf8');
                console.log(`[INFO] Report saved: ${safeFileName}`);
                res.status(200).send({ message: "Report saved successfully" });
            } catch (err) {
                console.error("[ERROR] Failed to save report:", err);
                res.status(500).send("Failed to save report");
            }
        });

        app.get('/api/reports', (req, res) => {
            try {
                if (!fs.existsSync(reportsDir)) {
                    return res.json([]);
                }
                const files = fs.readdirSync(reportsDir)
                    .filter(file => file.endsWith('.mrt'));
                res.json(files);
            } catch (err) {
                console.error("[ERROR] Failed to list reports:", err);
                res.status(500).send("Failed to list reports");
            }
        });

        app.get('/api/license', (req, res) => {
            const key = process.env.STIMULSOFT_LICENSE_KEY;
            res.json({ key: key || "" });
        });

        /*// Helper to flatten nested objects (1:1 relationships)
        function flattenData(data) {
            if (Array.isArray(data)) {
                return data.map(item => flattenObject(item));
            }
            return flattenObject(data);
        }

        function flattenObject(obj, prefix = '', res = {}) {
            for (const key in obj) {
                if (!obj.hasOwnProperty(key)) continue;
                const value = obj[key];
                const newKey = prefix ? `${prefix}_${key}` : key;

                // If value is an object (and not null/array/date), recurse
                if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
                    flattenObject(value, newKey, res);
                } else {
                    res[newKey] = value;
                }
            }
            return res;
        } */

        // SQL Data fetching
        app.get('/api/data', async (req, res) => {
            try {
                // 1. Fetch individual tables
                const cems = await pool.request().query("SELECT * FROM CEMS");
                const clinicalWaste = await pool.request().query("SELECT * FROM clinical_waste_track");
                const drivers = await pool.request().query("SELECT * FROM drivers_compliance");
                const idleDowntime = await pool.request().query("SELECT * FROM Idle_Downtime");
                const paramLimits = await pool.request().query("SELECT * FROM parameter_limits");
                const statutory = await pool.request().query("SELECT * FROM statutory_compliance");
                const testingKIP = await pool.request().query("SELECT * FROM Testing_KIP");
                const transport = await pool.request().query("SELECT * FROM transport_compliance");
                const users = await pool.request().query("SELECT * FROM users");
                const wasteTreated = await pool.request().query("SELECT * FROM Waste_Treated");

                // 2. Create the Unified Compliances Table
                // use UNION ALL to stack them
                const allCompliances = await pool.request().query(`
                    SELECT 
                        'Driver' AS Category, 
                        driverName AS ItemName, 
                        licenseType AS LicenseDetail, 
                        expiryDate, 
                        remarks 
                    FROM drivers_compliance
                    
                    UNION ALL
                    
                    SELECT 
                        'Statutory' AS Category, 
                        equipment AS ItemName, 
                        licenseNo AS LicenseDetail, 
                        expiryDate, 
                        remarks 
                    FROM statutory_compliance
                    
                    UNION ALL
                    
                    SELECT 
                        'Transport' AS Category, 
                        vehicleNo AS ItemName, 
                        licenseType AS LicenseDetail, 
                        expiryDate, 
                        remarks 
                    FROM transport_compliance
                `);

                // 3. Return them in the JSON
                res.json({
                    // This new table "Compliances" will appear in Designer
                    Compliances: allCompliances.recordset,
                    
                    // The original tables
                    CEMS: cems.recordset,
                    ClinicalWaste: clinicalWaste.recordset,
                    DriversCompliance: drivers.recordset,
                    IdleDowntime: idleDowntime.recordset,
                    ParameterLimits: paramLimits.recordset,
                    StatutoryCompliance: statutory.recordset,
                    TestingKIP: testingKIP.recordset,
                    TransportCompliance: transport.recordset,
                    Users: users.recordset,
                    WasteTreated: wasteTreated.recordset
                });
            } catch (e) {
                console.error("[ERROR] SQL Query Failed:", e.message);
                res.status(500).send("Internal Server Error");
            }
        });

        app.use('/stimulsoft', express.static(path.join(__dirname, 'node_modules/stimulsoft-reports-js')));
        app.use(express.static('public'));
        app.get('/designer', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'designer.html'));
        });

        app.get('/viewer', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'viewer.html'));
        });

        app.listen(PORT, () => {
            console.log(`[INFO] Server running at http://localhost:${PORT}/designer`);
        });

    } catch (err) {
        console.error("[ERROR] Failed to start application:", err);
    }
}

startServer();