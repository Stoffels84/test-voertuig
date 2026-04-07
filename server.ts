import express from "express";
import { Client } from "basic-ftp";
import * as XLSX from "xlsx";
import { Writable } from "stream";
import dotenv from "dotenv";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json());

const getFtpSecure = () => {
  const val = process.env.FTP_SECURE;
  if (val === "true") return true;
  if (val === "implicit") return "implicit";
  return false;
};

// API endpoint to check FTP connection status
app.get("/api/status", async (req, res) => {
  const client = new Client();
  client.ftp.verbose = true;
  try {
    const host = process.env.FTP_HOST;
    const user = process.env.FTP_USER;
    const password = process.env.FTP_PASSWORD;
    const port = parseInt(process.env.FTP_PORT || "21");
    const secure = getFtpSecure();

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
    "personeelnummer", "naam", "Loop", "Lijn", "Uur", 
    "voertuig", "wissel", "Plaats", "richting"
  ];

  try {
    const host = process.env.FTP_HOST;
    const user = process.env.FTP_USER;
    const password = process.env.FTP_PASSWORD;
    const port = parseInt(process.env.FTP_PORT || "21");
    const secure = getFtpSecure();
    const ftpDir = process.env.FTP_DIR || "/steekkaart";

    // Get today's date in YYYYMMDD format (Belgium timezone)
    const now = new Date();
    const belgiumTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Brussels" }));
    const todayStr = belgiumTime.getFullYear().toString() + 
                     (belgiumTime.getMonth() + 1).toString().padStart(2, '0') + 
                     belgiumTime.getDate().toString().padStart(2, '0');

    if (!host || !user || !password) {
      console.log("FTP credentials missing, returning mock data");
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
        data: [mockRow, { ...mockRow, Uur: "08:15", Lijn: "2", personeelnummer: "67890", naam: "Piet Pieters" }],
        fileName: { name: `${todayStr}_dienst.xlsx`, modifiedAt: new Date().toISOString() }
      });
    }

    await client.access({
      host,
      user,
      password,
      port,
      secure: secure as any
    });

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
      
      const sheetName = workbook.SheetNames.find(n => n.toLowerCase() === "dienstlijst") || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

      const formatExcelTime = (val: any) => {
        if (typeof val !== 'number') return val || "";
        const totalMinutes = Math.round(val * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      };

      return rawData.map(row => {
        const filteredRow: any = {};
        const findValue = (targetKey: string) => {
          const key = Object.keys(row).find(k => k.toLowerCase().trim() === targetKey.toLowerCase().trim());
          return key ? row[key] : undefined;
        };

        requestedColumns.forEach(col => {
          let value = findValue(col);
          if (value === undefined && col === "personeelnummer") {
            value = findValue("personeelsnummer");
          }
          if (col === "Uur") {
            filteredRow[col] = formatExcelTime(value);
          } else {
            filteredRow[col] = value || "";
          }
        });
        return filteredRow;
      });
    };

    // List files and find ONLY the one starting with today's date
    const list = await client.list(ftpDir);
    const todayFile = list.find(f => f.name.startsWith(todayStr) && f.name.toLowerCase().endsWith(".xlsx"));

    if (!todayFile) {
      return res.json({
        success: true,
        data: [],
        fileName: null,
        message: `Geen bestand gevonden voor vandaag (${todayStr})`
      });
    }

    const data = await fetchData(todayFile.name);

    res.json({
      success: true,
      data,
      fileName: { name: todayFile.name, modifiedAt: todayFile.modifiedAt }
    });
  } catch (err: any) {
    console.error("FTP Error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.close();
  }
});

// Simple in-memory cache for weather data
const weatherCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// API endpoint to proxy weather requests to avoid CORS/blocking issues
app.get("/api/weather", async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: "Latitude and longitude are required" });
  }

  // Round coordinates to 1 decimal place to group nearby requests and increase cache hits
  const roundedLat = Math.round(Number(lat) * 10) / 10;
  const roundedLon = Math.round(Number(lon) * 10) / 10;
  const cacheKey = `${roundedLat},${roundedLon}`;

  const now = Date.now();
  if (weatherCache[cacheKey] && (now - weatherCache[cacheKey].timestamp < CACHE_DURATION)) {
    console.log(`[Weather] Serving from cache for ${cacheKey}`);
    return res.json(weatherCache[cacheKey].data);
  }

  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    const response = await fetch(weatherUrl);
    
    if (response.status === 429) {
      console.warn("[Weather] Rate limit hit (429). Attempting to serve stale cache if available.");
      if (weatherCache[cacheKey]) {
        return res.json(weatherCache[cacheKey].data);
      }
      return res.status(429).json({ error: "Te veel aanvragen bij weerdienst. Probeer het later opnieuw." });
    }

    if (!response.ok) {
      throw new Error(`Weather API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Update cache
    weatherCache[cacheKey] = {
      data,
      timestamp: now
    };

    res.json(data);
  } catch (err: any) {
    console.error("Weather proxy error:", err);
    // If we have any cached data for this location, serve it as fallback
    if (weatherCache[cacheKey]) {
      return res.json(weatherCache[cacheKey].data);
    }
    res.status(500).json({ error: "Kon weergegevens niet ophalen", details: err.message });
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[Vite] Middleware attached");
  } else {
    app.use(express.static("dist"));
    console.log("[Server] Serving static files from dist");
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

export default app;
