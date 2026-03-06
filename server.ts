import express from "express";
import { Client } from "basic-ftp";
import * as XLSX from "xlsx";
import { Writable } from "stream";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

// In-memory stats and cache
let searchCount = 0;
let cachedTransportData: any = null;
let lastCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const app = express();
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const accessWithRetry = async (client: Client, config: any, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      await client.access(config);
      return;
    } catch (err) {
      if (i === retries) throw err;
      console.log(`FTP access failed, retrying (${i + 1}/${retries})...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

// API endpoint to check FTP connection status
app.get("/api/status", async (req, res) => {
  const client = new Client();
  client.ftp.verbose = true;
  client.ftp.timeout = 15000;
  try {
    const host = process.env.FTP_HOST;
    const user = process.env.FTP_USER;
    const password = process.env.FTP_PASSWORD;
    const port = parseInt(process.env.FTP_PORT || "21");
    let secure: boolean | "implicit" = false;
    if (process.env.FTP_SECURE === "true") secure = true;
    if (process.env.FTP_SECURE === "implicit") secure = "implicit";

    if (!host || !user || !password) {
      return res.json({ success: false, message: "FTP inloggegevens ontbreken in Vercel Environment Variables", isMock: true });
    }

    await accessWithRetry(client, {
      host,
      user,
      password,
      port,
      secure: secure as any
    });

    res.json({ success: true, message: "Succesvol verbonden met De Lijn" });
  } catch (err: any) {
    console.error("Status Check Error:", err);
    res.json({ success: false, message: `FTP Verbindingsfout: ${err.message}. Controleer of de server Vercel IP's toestaat.` });
  } finally {
    client.close();
  }
});

// API endpoint to fetch Excel data from FTP
app.get("/api/data", async (req, res) => {
  // Check cache first
  const now = Date.now();
  if (cachedTransportData && (now - lastCacheTime < CACHE_DURATION)) {
    console.log("Serving transport data from cache");
    return res.json({ ...cachedTransportData, fromCache: true });
  }

  const client = new Client();
  client.ftp.verbose = true;
  client.ftp.timeout = 15000; // 15 seconds timeout for faster failure on serverless

  const requestedColumns = [
    "personeelsnummer", "naam", "Loop", "Lijn", "Uur", 
    "voertuig", "wissel", "Dienstadres", "Plaats", "richting"
  ];

  try {
    const host = process.env.FTP_HOST;
    const user = process.env.FTP_USER;
    const password = process.env.FTP_PASSWORD;
    const port = parseInt(process.env.FTP_PORT || "21");
    let secure: boolean | "implicit" = false;
    if (process.env.FTP_SECURE === "true") secure = true;
    if (process.env.FTP_SECURE === "implicit") secure = "implicit";
    const ftpDir = process.env.FTP_DIR || "/steekkaart";

    if (!host || !user || !password) {
      // Mock data logic remains same for local dev
      const mockRow = {
        "personeelnummer": "12345",
        "naam": "Jan Janssens",
        "Loop": "101",
        "Lijn": "1",
        "Uur": "08:00",
        "voertuig": "T01",
        "wissel": "Nee",
        "DIENSTADRES": "20240301_RITBLAD_A",
        "Plaats": "Korenmarkt",
        "richting": "Zwijnaarde"
      };
      const mockResult = {
        success: true,
        isMock: true,
        data1: [mockRow, { ...mockRow, Uur: "08:15", Lijn: "2", personeelnummer: "67890" }],
        data2: [mockRow, { ...mockRow, Uur: "09:00", Lijn: "4", personeelnummer: "11223" }],
        fileNames: [
          { name: "20240301_dienst.xlsx", modifiedAt: new Date().toISOString() }, 
          { name: "20240229_dienst.xlsx", modifiedAt: new Date().toISOString() }
        ]
      };
      return res.json(mockResult);
    }

    await accessWithRetry(client, {
      host,
      user,
      password,
      port,
      secure: secure as any
    });

    // Get today's date in YYYYMMDD format
    const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');

    // List files and find the 2 most recent ones starting with yyyymmdd
    const list = await client.list(ftpDir);
    const xlsxFiles = list
      .filter(f => {
        const name = f.name.toLowerCase();
        const dateMatch = f.name.match(/^(\d{8})/);
        const isExcel = name.endsWith(".xlsx");
        return dateMatch && isExcel;
      })
      .sort((a, b) => b.name.localeCompare(a.name)) // Sort descending by name (yyyymmdd)
      .slice(0, 2);

    if (xlsxFiles.length === 0) {
      const allFiles = list.map(f => f.name).join(", ");
      throw new Error(`Geen .xlsx bestanden gevonden die beginnen met 8 cijfers in map: ${ftpDir}. Gevonden bestanden: ${allFiles || "geen"}`);
    }

    const fetchData = async (fileName: string) => {
      console.log(`Fetching file: ${fileName}`);
      const filePath = ftpDir.endsWith("/") ? `${ftpDir}${fileName}` : `${ftpDir}/${fileName}`;
      const chunks: Buffer[] = [];
      const writable = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        }
      });

      await client.downloadTo(writable, filePath);
      const buffer = Buffer.concat(chunks);
      console.log(`File ${fileName} downloaded, size: ${buffer.length} bytes`);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      const sheetName = workbook.SheetNames.find(n => n.toLowerCase() === "dienstlijst") || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (rawData.length === 0) return [];

      const formatExcelTime = (val: any) => {
        if (typeof val !== 'number') return val || "";
        const totalMinutes = Math.round(val * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      };

      return rawData.map(row => {
        const filteredRow: any = {};
        requestedColumns.forEach(col => {
          const targetKey = col === "personeelsnummer" ? "personeelnummer" : col;
          const normalize = (s: string) => s.toLowerCase().replace(/[\s\-_.]/g, '');
          const normalizedCol = normalize(col);
          let key = Object.keys(row).find(k => normalize(k) === normalizedCol);
          if (!key && col === "personeelsnummer") {
            const variations = ["personeelnummer", "persnr", "pnummer", "stamnummer", "personeelsnr"];
            key = Object.keys(row).find(k => variations.includes(normalize(k)));
          }
          let value = key ? row[key] : "";
          if (col === "Uur") {
            filteredRow[targetKey] = formatExcelTime(value);
          } else {
            filteredRow[targetKey] = value;
          }
        });
        return filteredRow;
      });
    };

    // Parallel fetching to save time
    const fetchPromises: Promise<any>[] = [];
    const fileNames: any[] = [];
    
    const todayIndex = xlsxFiles.findIndex(f => f.name.startsWith(todayStr));
    
    if (todayIndex !== -1) {
      fetchPromises.push(fetchData(xlsxFiles[todayIndex].name));
      fileNames[0] = { name: xlsxFiles[todayIndex].name, modifiedAt: xlsxFiles[todayIndex].modifiedAt };
      
      if (xlsxFiles[todayIndex + 1]) {
        fetchPromises.push(fetchData(xlsxFiles[todayIndex + 1].name));
        fileNames[1] = { name: xlsxFiles[todayIndex + 1].name, modifiedAt: xlsxFiles[todayIndex + 1].modifiedAt };
      }
    } else {
      if (xlsxFiles[0]) {
        fetchPromises.push(fetchData(xlsxFiles[0].name));
        fileNames[0] = { name: xlsxFiles[0].name, modifiedAt: xlsxFiles[0].modifiedAt };
      }
      if (xlsxFiles[1]) {
        fetchPromises.push(fetchData(xlsxFiles[1].name));
        fileNames[1] = { name: xlsxFiles[1].name, modifiedAt: xlsxFiles[1].modifiedAt };
      }
    }

    const results = await Promise.all(fetchPromises);
    
    const responseData = {
      success: true,
      data1: results[0] || [],
      data2: results[1] || [],
      fileNames
    };

    // Update cache
    cachedTransportData = responseData;
    lastCacheTime = Date.now();

    res.json(responseData);
  } catch (err: any) {
    console.error("FTP Error:", err);
    res.status(500).json({ success: false, error: `FTP Fout: ${err.message}` });
  } finally {
    client.close();
  }
});

app.get("/api/pdf/Ritblad/:filename", async (req, res) => {
  if (!process.env.FTP_HOST) {
    return res.status(404).send("FTP not configured");
  }

  const client = new Client();
  client.ftp.timeout = 15000; // 15 seconds timeout
  try {
    let secure: boolean | "implicit" = false;
    if (process.env.FTP_SECURE === "true") secure = true;
    if (process.env.FTP_SECURE === "implicit") secure = "implicit";

    await accessWithRetry(client, {
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      port: parseInt(process.env.FTP_PORT || "21"),
      secure: secure as any,
    });

    // Bepaal de map op basis van de dag van de week
    const day = new Date().getDay(); // 0=Zondag, 1=Maandag, ..., 5=Vrijdag, 6=Zaterdag
    let folder = "/Ritblad"; // Standaard voor Ma-Do
    
    if (day === 5) folder = "/Ritbladvrijdag";
    else if (day === 6) folder = "/Ritbladzaterdag";
    else if (day === 0) folder = "/Ritbladzondag";

    const prefix = req.params.filename.substring(0, 8);
    const list = await client.list(folder);
    const matchingFile = list.find(f => f.name.startsWith(prefix) && f.name.toLowerCase().endsWith(".pdf"));

    if (!matchingFile) {
      return res.status(404).send(`File not found in ${folder} starting with prefix: ${prefix}`);
    }

    const remotePath = `${folder}/${matchingFile.name}`;
    
    // Set headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${matchingFile.name}"`);

    await client.downloadTo(res, remotePath);
  } catch (err: any) {
    console.error("FTP PDF Error:", err);
    res.status(404).send("File not found");
  } finally {
    client.close();
  }
});

// API endpoint to get search count
app.get("/api/search-count", (req, res) => {
  res.json({ count: searchCount });
});

// API endpoint to increment search count
app.post("/api/increment-search", (req, res) => {
  searchCount++;
  res.json({ success: true, count: searchCount });
});

// Vite middleware for development
async function setupVite() {
  console.log("Setting up Vite middleware...");
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware attached.");
  } else {
    app.use(express.static("dist"));
    console.log("Serving static files from dist.");
  }
}

// Start server
async function startServer() {
  try {
    await setupVite();
    
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

startServer();

export default app;
