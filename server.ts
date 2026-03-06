import express from "express";
import { Client } from "basic-ftp";
import * as XLSX from "xlsx";
import { Writable } from "stream";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import path from "path";

dotenv.config();

// Initialize SQLite database
const db = new Database("search_stats.db");
db.exec("CREATE TABLE IF NOT EXISTS stats (id TEXT PRIMARY KEY, count INTEGER)");
const initRow = db.prepare("SELECT count FROM stats WHERE id = ?").get("total_searches") as { count: number } | undefined;
if (!initRow) {
  db.prepare("INSERT INTO stats (id, count) VALUES (?, ?)").run("total_searches", 0);
}

const app = express();
app.use(express.json());

// API endpoint to check FTP connection status
app.get("/api/status", async (req, res) => {
  const client = new Client();
  client.ftp.verbose = true;
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

    await client.access({
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
  const client = new Client();
  client.ftp.verbose = true;

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
      // Mock data logic...
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
      return res.json({
        success: true,
        isMock: true,
        data1: [mockRow, { ...mockRow, Uur: "08:15", Lijn: "2", personeelnummer: "67890" }],
        data2: [mockRow, { ...mockRow, Uur: "09:00", Lijn: "4", personeelnummer: "11223" }],
        data3: [mockRow, { ...mockRow, Uur: "10:00", Lijn: "5", personeelnummer: "44556" }],
        fileNames: [
          { name: "20240301_dienst.xlsx", modifiedAt: new Date().toISOString() }, 
          { name: "20240229_dienst.xlsx", modifiedAt: new Date().toISOString() },
          { name: "20240302_dienst.xlsx", modifiedAt: new Date().toISOString() }
        ]
      });
    }

    await client.access({
      host,
      user,
      password,
      port,
      secure: secure as any
    });

    // Get today's date in YYYYMMDD format
    const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');

    // List files and find the 3 most recent ones starting with yyyymmdd
    const list = await client.list(ftpDir);
    const xlsxFiles = list
      .filter(f => {
        const name = f.name.toLowerCase();
        const dateMatch = f.name.match(/^(\d{8})/);
        const isExcel = name.endsWith(".xlsx");
        return dateMatch && isExcel;
      })
      .sort((a, b) => b.name.localeCompare(a.name)) // Sort descending by name (yyyymmdd)
      .slice(0, 3);

    if (xlsxFiles.length === 0) {
      const allFiles = list.map(f => f.name).join(", ");
      throw new Error(`Geen .xlsx bestanden gevonden die beginnen met 8 cijfers in map: ${ftpDir}. Gevonden bestanden: ${allFiles || "geen"}`);
    }

    const fetchData = async (fileName: string) => {
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
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      // Look for "Dienstlijst" sheet
      const sheetName = workbook.SheetNames.find(n => n.toLowerCase() === "dienstlijst") || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (rawData.length > 0) {
        console.log(`Excel ${fileName} geladen. Kolommen:`, Object.keys(rawData[0]));
      }

      // Helper to format Excel time (decimal) to HH:mm
      const formatExcelTime = (val: any) => {
        if (typeof val !== 'number') return val || "";
        const totalMinutes = Math.round(val * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      };

      // Filter columns and handle renaming/formatting
      return rawData.map(row => {
        const filteredRow: any = {};
        
        // Find keys in row case-insensitively
        const findValue = (targetKeys: string[]) => {
          const key = Object.keys(row).find(k => {
            const normalized = k.toLowerCase().trim();
            return targetKeys.some(tk => normalized === tk.toLowerCase().trim());
          });
          return key ? row[key] : undefined;
        };

        requestedColumns.forEach(col => {
          const targetKey = col === "personeelsnummer" ? "personeelnummer" : col;
          
          let aliases = [col];
          if (col === "personeelsnummer") {
            aliases = ["personeelsnummer", "personeelnummer", "stamnummer", "pers. nr.", "pers.nr.", "personeelsnr", "personeelsnr.", "p.nr", "pnr"];
          } else if (col === "naam") {
            aliases = ["naam", "name", "bestuurder", "chauffeur", "personeelsnaam"];
          } else if (col === "Loop") {
            aliases = ["Loop", "Dienst", "Rit", "Omlopen"];
          } else if (col === "Lijn") {
            aliases = ["Lijn", "Line", "Lijnnummer"];
          }

          let value = findValue(aliases);
          
          if (col === "Uur") {
            filteredRow[targetKey] = formatExcelTime(value);
          } else {
            filteredRow[targetKey] = (value !== undefined && value !== null) ? value : "";
          }
        });
        return filteredRow;
      });
    };

    // Map results to data1 (today/latest), data2 (yesterday/previous), data3 (tomorrow/future)
    // Actually we sort by date descending, so:
    // xlsxFiles[0] is the latest (could be tomorrow if exists)
    // xlsxFiles[1] is today
    // xlsxFiles[2] is yesterday
    
    // Let's find today's file index
    const todayIndex = xlsxFiles.findIndex(f => f.name.startsWith(todayStr));
    
    let data1: any[] = []; // Today
    let data2: any[] = []; // Yesterday
    let data3: any[] = []; // Tomorrow
    let fileNames: any[] = [];

    if (todayIndex !== -1) {
      // Today exists
      data1 = await fetchData(xlsxFiles[todayIndex].name);
      fileNames[0] = { name: xlsxFiles[todayIndex].name, modifiedAt: xlsxFiles[todayIndex].modifiedAt };
      
      // Yesterday is likely todayIndex + 1
      if (xlsxFiles[todayIndex + 1]) {
        data2 = await fetchData(xlsxFiles[todayIndex + 1].name);
        fileNames[1] = { name: xlsxFiles[todayIndex + 1].name, modifiedAt: xlsxFiles[todayIndex + 1].modifiedAt };
      }
      
      // Tomorrow is likely todayIndex - 1
      if (todayIndex > 0 && xlsxFiles[todayIndex - 1]) {
        data3 = await fetchData(xlsxFiles[todayIndex - 1].name);
        fileNames[2] = { name: xlsxFiles[todayIndex - 1].name, modifiedAt: xlsxFiles[todayIndex - 1].modifiedAt };
      }
    } else {
      // If today doesn't exist, just take the top 3 as they are
      if (xlsxFiles[0]) {
        data1 = await fetchData(xlsxFiles[0].name);
        fileNames[0] = { name: xlsxFiles[0].name, modifiedAt: xlsxFiles[0].modifiedAt };
      }
      if (xlsxFiles[1]) {
        data2 = await fetchData(xlsxFiles[1].name);
        fileNames[1] = { name: xlsxFiles[1].name, modifiedAt: xlsxFiles[1].modifiedAt };
      }
      if (xlsxFiles[2]) {
        data3 = await fetchData(xlsxFiles[2].name);
        fileNames[2] = { name: xlsxFiles[2].name, modifiedAt: xlsxFiles[2].modifiedAt };
      }
    }

    res.json({
      success: true,
      data1,
      data2,
      data3,
      fileNames
    });
  } catch (err: any) {
    console.error("FTP Error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.close();
  }
});

app.get("/api/pdf/Ritblad/:filename", async (req, res) => {
  if (!process.env.FTP_HOST) {
    return res.status(404).send("FTP not configured");
  }

  const client = new Client();
  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      port: parseInt(process.env.FTP_PORT || "21"),
      secure: process.env.FTP_SECURE === "true",
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
  const row = db.prepare("SELECT count FROM stats WHERE id = ?").get("total_searches") as { count: number };
  res.json({ count: row.count });
});

// API endpoint to increment search count
app.post("/api/increment-search", (req, res) => {
  db.prepare("UPDATE stats SET count = count + 1 WHERE id = ?").run("total_searches");
  const row = db.prepare("SELECT count FROM stats WHERE id = ?").get("total_searches") as { count: number };
  res.json({ success: true, count: row.count });
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }
}

setupVite();

// Start server if not running on Vercel
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
