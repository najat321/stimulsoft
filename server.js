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

        // Helper to flatten nested objects (1:1 relationships)
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
        }
        /*// ManWinWin API
        app.get('/api/mww/items', async (req, res) => {
            try {
                const apiBase = process.env.MW_API_URL;
                const tokenResponse = await fetch(`${apiBase}/MwwAPI/api/Token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        'grant_type': 'password',
                        'username': process.env.MW_USERNAME,
                        'password': process.env.MW_PASSWORD
                    })
                });

                if (!tokenResponse.ok) {
                    const errorText = await tokenResponse.text();
                    console.error("[ERROR] ManWinWin Auth Failed:", tokenResponse.status, errorText);
                    return res.status(tokenResponse.status).send("Authentication Failed");
                }

                const tokenData = await tokenResponse.json();
                const accessToken = tokenData.access_token;
                const dataResponse = await fetch(`${apiBase}/MwwAPI/api/Items?Limit=5`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                if (!dataResponse.ok) {
                    const errorText = await dataResponse.text();
                    console.error("[ERROR] ManWinWin Data Fetch Failed:", dataResponse.status, errorText);
                    return res.status(dataResponse.status).send("Data Fetch Failed");
                }

                const rawData = await dataResponse.json();
                // Apply flattening
                const flatData = flattenData(rawData);
                res.json(flatData);

            } catch (err) {
                console.error("[ERROR] ManWinWin Proxy Error:", err);
                res.status(500).send("Proxy Error");
            }
        }); */

        // Random Data Generator
        function generateRandomData() {
            const count = Math.floor(Math.random() * 20) + 5; // 5 to 25 items
            const data = [];
            for (let i = 1; i <= count; i++) {
                data.push({
                    Id: i,
                    Name: `Item ${i}`,
                    Value: Math.floor(Math.random() * 1000),
                    Category: Math.random() > 0.5 ? 'A' : 'B',
                    Date: new Date().toISOString()
                });
            }
            return data;
        }

        app.get('/api/random-data', (req, res) => {
            const data = generateRandomData();
            res.json(data);
        });

        // SQL Data fetching
        app.get('/api/data', async (req, res) => {
            try {
                // 1. Fetch data from your specific tables
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

                // 2. Return them as a JSON object
                // The keys (left side) are the names you will see in the Designer
                res.json({
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