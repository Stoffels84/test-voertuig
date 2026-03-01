import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bus, Train, AlertCircle, RefreshCw, FileSpreadsheet, ExternalLink, Wifi, WifiOff, CheckCircle2, XCircle } from 'lucide-react';

interface TransportData {
  [key: string]: any;
}

export default function App() {
  const [data1, setData1] = useState<TransportData[]>([]);
  const [data2, setData2] = useState<TransportData[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);
  
  const [statusLoading, setStatusLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);

  const checkStatus = async () => {
    setStatusLoading(true);
    try {
      const response = await fetch('/api/status');
      const result = await response.json();
      setConnectionStatus(result);
    } catch (err) {
      setConnectionStatus({ success: false, message: 'Kon status niet ophalen' });
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/data');
      const result = await response.json();
      if (result.success) {
        setData1(result.data1);
        setData2(result.data2);
        setFileNames(result.fileNames || []);
        setIsMock(!!result.isMock);
      } else {
        setError(result.error || 'Fout bij het ophalen van gegevens');
      }
    } catch (err) {
      setError('Kon geen verbinding maken met de server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const DeLijnYellow = "#FFD200";

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-[#FFD200] shadow-md border-b border-black/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white p-2 rounded-lg shadow-sm">
              <Bus className="w-8 h-8 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase">De Lijn</h1>
              <p className="text-xs font-bold opacity-70 uppercase tracking-widest text-black">Dienstlijst Monitor</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-full border border-black/5">
              <div className={`w-2 h-2 rounded-full ${connectionStatus?.success ? 'bg-green-500' : connectionStatus ? 'bg-red-500' : 'bg-gray-300'}`} />
              <span className="text-[10px] font-black uppercase tracking-wider">
                {connectionStatus ? (connectionStatus.success ? 'FTP OK' : 'FTP FOUT') : 'FTP STATUS'}
              </span>
            </div>
            
            <button 
              onClick={checkStatus}
              disabled={statusLoading}
              title="Check FTP Verbinding"
              className="p-2 rounded-full hover:bg-white/50 transition-colors text-black/60 hover:text-black disabled:opacity-50"
            >
              <Wifi className={`w-5 h-5 ${statusLoading ? 'animate-pulse' : ''}`} />
            </button>

            <button 
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 shadow-lg"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{loading ? 'Laden...' : 'Vernieuwen'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Connection Status Message */}
        <AnimatePresence>
          {connectionStatus && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-6 p-4 rounded-2xl flex items-center justify-between shadow-sm border ${
                connectionStatus.success 
                  ? 'bg-green-50 border-green-200 text-green-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-3">
                {connectionStatus.success ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                <span className="font-bold text-sm">{connectionStatus.message}</span>
              </div>
              <button 
                onClick={() => setConnectionStatus(null)}
                className="text-xs font-black uppercase tracking-widest opacity-50 hover:opacity-100"
              >
                Sluiten
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Banner */}
        <AnimatePresence>
          {isMock && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mb-8 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl flex items-start gap-3 shadow-sm"
            >
              <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h3 className="font-bold text-blue-800">Demo Modus</h3>
                <p className="text-sm text-blue-700">
                  Er zijn geen FTP-gegevens geconfigureerd. Je ziet nu voorbeelddata van de twee meest recente (fictieve) bestanden.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mb-8 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800">Fout bij ophalen FTP data</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-12">
          {/* Section 1 */}
          <section>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#FFD200] rounded-2xl flex items-center justify-center shadow-sm">
                  <FileSpreadsheet className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Recentste Bestand</h2>
                  <p className="text-sm font-bold text-gray-500">{fileNames[0] || 'Geen bestand gevonden'}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-3xl shadow-xl border border-black/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-black/5">
                      {data1.length > 0 && Object.keys(data1[0]).map((key) => (
                        <th key={key} className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {data1.map((row, i) => (
                      <motion.tr 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        key={i} 
                        className="hover:bg-[#FFD200]/10 transition-colors group"
                      >
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-6 py-4 text-sm font-semibold text-gray-700 group-hover:text-black">
                            {val}
                          </td>
                        ))}
                      </motion.tr>
                    ))}
                    {data1.length === 0 && !loading && (
                      <tr>
                        <td colSpan={10} className="px-6 py-20 text-center text-gray-400 italic">
                          Geen gegevens gevonden in het meest recente bestand.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-2xl flex items-center justify-center shadow-sm">
                  <FileSpreadsheet className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-gray-600">Vorige Bestand</h2>
                  <p className="text-sm font-bold text-gray-400">{fileNames[1] || 'Geen tweede bestand gevonden'}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-3xl shadow-xl border border-black/5 overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-black/5">
                      {data2.length > 0 && Object.keys(data2[0]).map((key) => (
                        <th key={key} className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {data2.map((row, i) => (
                      <motion.tr 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        key={i} 
                        className="hover:bg-gray-50 transition-colors"
                      >
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-6 py-4 text-sm font-semibold text-gray-500">
                            {val}
                          </td>
                        ))}
                      </motion.tr>
                    ))}
                    {data2.length === 0 && !loading && (
                      <tr>
                        <td colSpan={10} className="px-6 py-20 text-center text-gray-400 italic">
                          Geen gegevens gevonden in het tweede bestand.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-black/5 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#FFD200] rounded flex items-center justify-center">
              <Bus className="w-4 h-4 text-black" />
            </div>
            <span className="font-black uppercase text-sm">De Lijn Viewer</span>
          </div>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
            © {new Date().getFullYear()} De Lijn - Alle rechten voorbehouden
          </p>
          <div className="flex gap-4">
            <a href="https://www.delijn.be" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-black transition-colors">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
