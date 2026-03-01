import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bus, Train, AlertCircle, RefreshCw, FileSpreadsheet, ExternalLink, Wifi, WifiOff, CheckCircle2, XCircle, Search, Calendar, Clock } from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');

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
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-gray-900 pb-12">
      {/* Header */}
      <header className="bg-[#FFD200] shadow-lg border-b border-black/5 sticky top-0 z-50 safe-top">
        <div className="max-w-7xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1.5 sm:p-2 rounded-xl shadow-sm">
              <Bus className="w-6 h-6 sm:w-8 sm:h-8 text-black" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-black tracking-tighter uppercase leading-none">De Lijn</h1>
              <p className="text-[10px] sm:text-xs font-bold opacity-70 uppercase tracking-widest text-black mt-0.5 sm:mt-1">Opzoeken voertuig</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <div className={`flex items-center gap-1.5 bg-black/5 px-2 py-1 rounded-full border border-black/5 transition-all ${connectionStatus?.success ? 'bg-green-500/10 border-green-500/20' : ''}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus?.success ? 'bg-green-500 animate-pulse' : connectionStatus ? 'bg-red-500' : 'bg-gray-400'}`} />
              <span className="text-[9px] font-black uppercase tracking-wider hidden xs:inline">
                {connectionStatus ? (connectionStatus.success ? 'Online' : 'Fout') : 'Status'}
              </span>
            </div>
            
            <button 
              onClick={checkStatus}
              disabled={statusLoading}
              className="p-2 rounded-full hover:bg-white/50 active:scale-95 transition-all text-black/60 hover:text-black disabled:opacity-50"
            >
              <Wifi className={`w-5 h-5 ${statusLoading ? 'animate-pulse' : ''}`} />
            </button>

            <button 
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 bg-black text-white p-2 sm:px-4 sm:py-2 rounded-full font-bold hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50 shadow-md"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{loading ? 'Laden...' : 'Vernieuwen'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Connection Status Message */}
        <AnimatePresence>
          {connectionStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`mb-4 p-3 sm:p-4 rounded-2xl flex items-center justify-between shadow-sm border ${
                connectionStatus.success 
                  ? 'bg-white border-green-500/30 text-green-800' 
                  : 'bg-white border-red-500/30 text-red-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${connectionStatus.success ? 'bg-green-100' : 'bg-red-100'}`}>
                  {connectionStatus.success ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                </div>
                <span className="font-bold text-xs sm:text-sm">{connectionStatus.message}</span>
              </div>
              <button 
                onClick={() => setConnectionStatus(null)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-4 h-4 opacity-50" />
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
              className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-3 sm:p-4 rounded-r-2xl flex items-start gap-3 shadow-sm"
            >
              <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-bold text-blue-800 text-sm">Demo Modus</h3>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Er zijn geen FTP-gegevens geconfigureerd. Je ziet nu voorbeelddata.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 group-focus-within:text-[#FFD200] transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Zoek op personeelnummer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-11 pr-4 py-3.5 bg-white border border-black/5 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#FFD200] focus:border-transparent outline-none font-bold text-sm transition-all placeholder:text-gray-400 placeholder:font-medium"
            />
          </div>
        </div>

        <div className="space-y-8 sm:space-y-12">
          {searchTerm ? (
            <>
              {/* Section 1 */}
              <section>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 px-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#FFD200] rounded-xl sm:rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                      <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-xl font-black uppercase tracking-tight truncate">Vandaag</h2>
                      <p className="text-[10px] sm:text-sm font-bold text-gray-500 truncate">{fileNames[0] || 'Geen bestand gevonden'}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-black/5 overflow-hidden">
                  <div className="overflow-x-auto scrollbar-hide">
                    <table className="w-full text-left border-collapse min-w-[800px] sm:min-w-full">
                      <thead>
                        <tr className="bg-gray-50/50 border-b border-black/5">
                          {data1.length > 0 && Object.keys(data1[0]).map((key) => (
                            <th key={key} className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-400">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {data1
                          .filter(row => String(row.personeelnummer).toLowerCase().includes(searchTerm.toLowerCase()))
                          .map((row, i) => (
                          <motion.tr 
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.02 }}
                            key={i} 
                            className="hover:bg-[#FFD200]/5 active:bg-[#FFD200]/10 transition-colors group"
                          >
                            {Object.values(row).map((val, j) => (
                              <td key={j} className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 group-hover:text-black whitespace-nowrap">
                                {val}
                              </td>
                            ))}
                          </motion.tr>
                        ))}
                        {data1.filter(row => String(row.personeelnummer).toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && !loading && (
                          <tr>
                            <td colSpan={10} className="px-6 py-16 text-center text-gray-400 italic text-sm">
                              Geen gegevens gevonden voor "{searchTerm}".
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile Hint */}
                  <div className="sm:hidden px-4 py-2 bg-gray-50 border-t border-black/5 flex items-center justify-center gap-2">
                    <div className="w-4 h-1 bg-gray-300 rounded-full" />
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Swipe voor meer</span>
                    <div className="w-4 h-1 bg-gray-300 rounded-full" />
                  </div>
                </div>
              </section>

              {/* Section 2 */}
              <section>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 px-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                      <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-xl font-black uppercase tracking-tight text-gray-600 truncate">Gisteren</h2>
                      <p className="text-[10px] sm:text-sm font-bold text-gray-400 truncate">{fileNames[1] || 'Geen tweede bestand gevonden'}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-black/5 overflow-hidden opacity-90">
                  <div className="overflow-x-auto scrollbar-hide">
                    <table className="w-full text-left border-collapse min-w-[800px] sm:min-w-full">
                      <thead>
                        <tr className="bg-gray-50/50 border-b border-black/5">
                          {data2.length > 0 && Object.keys(data2[0]).map((key) => (
                            <th key={key} className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-400">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {data2
                          .filter(row => String(row.personeelnummer).toLowerCase().includes(searchTerm.toLowerCase()))
                          .map((row, i) => (
                          <motion.tr 
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.02 }}
                            key={i} 
                            className="hover:bg-gray-50 transition-colors"
                          >
                            {Object.values(row).map((val, j) => (
                              <td key={j} className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-500 whitespace-nowrap">
                                {val}
                              </td>
                            ))}
                          </motion.tr>
                        ))}
                        {data2.filter(row => String(row.personeelnummer).toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && !loading && (
                          <tr>
                            <td colSpan={10} className="px-6 py-16 text-center text-gray-400 italic text-sm">
                              Geen gegevens gevonden voor "{searchTerm}".
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <Search className="w-10 h-10 text-gray-300" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight text-gray-400 mb-2">Start met zoeken</h2>
              <p className="text-sm font-bold text-gray-400 max-w-xs leading-relaxed">
                Vul een personeelnummer in om de dienstlijst van vandaag en gisteren te bekijken.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
