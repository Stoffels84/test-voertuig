import express from "express";
import { createServer as createViteServer } from "vite";
import { Client } from "basic-ftp";
import * as XLSX from "xlsx";
import { Writable } from "stream";
import dotenv from "dotenv";

dotenv.config();

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

    res.json({ success: true, message: `Succesvol verbonden met ${host}` });
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
    "Dienstadres", "Uur", "Plaats", "richting", "Loop", 
    "Lijn", "personeelsnummer", "naam", "voertuig", "wissel"
  ];

  try {
    const host = process.env.FTP_HOST;
    const user = process.env.FTP_USER;
    const password = process.env.FTP_PASSWORD;
    const port = parseInt(process.env.FTP_PORT || "21");
    let secure: boolean | "implicit" = false;
    if (process.env.FTP_SECURE === "true") secure = true;
    if (process.env.FTP_SECURE === "implicit") secure = "implicit";
    const ftpDir = process.env.FTP_DIR || "/";

    if (!host || !user || !password) {
      // Mock data logic...
      const mockRow = {
        "Dienstadres": "Gent",
        "Uur": "08:00",
        "Plaats": "Korenmarkt",
        "richting": "Zwijnaarde",
        "Loop": "101",
        "Lijn": "1",
        "personeelsnummer": "12345",
        "naam": "Jan Janssens",
        "voertuig": "T01",
        "wissel": "Nee"
      };
      return res.json({
        success: true,
        isMock: true,
        data1: [mockRow, { ...mockRow, Uur: "08:15", Lijn: "2" }],
        data2: [mockRow, { ...mockRow, Uur: "09:00", Lijn: "4" }],
        fileNames: ["20240301_dienst.xlsx", "20240229_dienst.xlsx"]
      });
    }

    await client.access({
      host,
      user,
      password,
      port,
      secure: secure as any
    });

    // List files and find the 2 most recent ones starting with yyyymmdd
    const list = await client.list(ftpDir);
    const xlsxFiles = list
      .filter(f => f.isFile && f.name.endsWith(".xlsx") && /^\d{8}/.test(f.name))
      .sort((a, b) => b.name.localeCompare(a.name)) // Sort descending by name (yyyymmdd)
      .slice(0, 2);

    const fetchData = async (fileName: string) => {
      const filePath = ftpDir.endsWith("/") ? `${ftpDir}${fileName}` : `${ftpDir}/${fileName}`;
      const chunks: Buffer[] = [];
      const writable = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        }
      });

      await (client as any).downloadToStream(writable, filePath);
      const buffer = Buffer.concat(chunks);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      // Look for "Dienstlijst" sheet
      const sheetName = workbook.SheetNames.find(n => n.toLowerCase() === "dienstlijst") || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

      // Filter columns
      return rawData.map(row => {
        const filteredRow: any = {};
        requestedColumns.forEach(col => {
          filteredRow[col] = row[col] || "";
        });
        return filteredRow;
      });
    };

    const data1 = xlsxFiles[0] ? await fetchData(xlsxFiles[0].name) : [];
    const data2 = xlsxFiles[1] ? await fetchData(xlsxFiles[1].name) : [];

    res.json({ 
      success: true, 
      data1, 
      data2, 
      fileNames: xlsxFiles.map(f => f.name) 
    });
  } catch (err: any) {
    console.error("FTP Error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.close();
  }
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
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
