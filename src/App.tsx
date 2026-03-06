import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bus, Train, AlertCircle, RefreshCw, ExternalLink, Wifi, WifiOff, CheckCircle2, XCircle, Search, Calendar, Clock, Moon, Sun, Cloud, CloudRain, CloudSun, CloudLightning, Snowflake, Droplets, Users } from 'lucide-react';

interface TransportData {
  [key: string]: any;
}

export default function App() {
  const [data, setData] = useState<TransportData[]>([]);
  const [fileName, setFileName] = useState<{ name: string; modifiedAt?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);
  
  const [statusLoading, setStatusLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('lastSearch') || '');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<{ temp: number; condition: string; code: number } | null>(null);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  const filterData = (data: TransportData[]) => {
    const s = searchTerm.toLowerCase();
    return data.filter(row => 
      String(row.personeelnummer || '').toLowerCase().includes(s)
    );
  };

  const filteredData = filterData(data);

  const fetchWeather = async (lat: number, lon: number) => {
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
      const data = await response.json();
      const current = data.current_weather;
      
      const getCondition = (code: number) => {
        if (code === 0) return 'Onbewolkt';
        if (code <= 3) return 'Licht bewolkt';
        if (code <= 48) return 'Mistig';
        if (code <= 55) return 'Motregen';
        if (code <= 65) return 'Regen';
        if (code <= 77) return 'Sneeuw';
        if (code <= 82) return 'Regenbuien';
        if (code <= 86) return 'Sneeuwbuien';
        if (code <= 99) return 'Onweer';
        return 'Onbekend';
      };

      setWeather({
        temp: Math.round(current.temperature),
        condition: getCondition(current.weathercode),
        code: current.weathercode
      });
    } catch (err) {
      console.error('Weather fetch error:', err);
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(51.0543, 3.7174) // Fallback to Ghent
      );
    } else {
      fetchWeather(51.0543, 3.7174);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('lastSearch', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem('darkMode', String(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

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
        setData(result.data || []);
        setFileName(result.fileName);
        setIsMock(!!result.isMock);
        if (result.message && result.data.length === 0) {
          setError(result.message);
        }
      } else {
        setError(result.error || 'Fout bij het ophalen van gegevens');
      }
    } catch (err) {
      setError('Kon geen verbinding maken met de server');
    } finally {
      setLoading(false);
    }
  };

  const fetchVisitorCount = async () => {
    try {
      const response = await fetch(`/api/visitor-count?t=${Date.now()}`);
      const result = await response.json();
      console.log('Visitor count result:', result);
      setVisitorCount(result.count);
    } catch (err) {
      console.error('Visitor count error:', err);
    }
  };

  useEffect(() => {
    fetchData();
    checkStatus();
    fetchVisitorCount();
  }, []);

  const DeLijnYellow = "#FFD200";

  const formatFileDate = (fileName: string) => {
    if (!fileName) return '';
    const match = fileName.match(/^(\d{4})(\d{2})(\d{2})/);
    if (match) {
      const [_, yyyy, mm, dd] = match;
      return `${dd}/${mm}/${yyyy}`;
    }
    return fileName;
  };

  const formatModifiedTime = (modifiedAt?: string) => {
    if (!modifiedAt) return '';
    const date = new Date(modifiedAt);
    return `Laatst aangepast: ${date.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getWeatherIcon = (code: number) => {
    if (code === 0) return <Sun className="w-4 h-4 text-yellow-500" />;
    if (code <= 3) return <CloudSun className="w-4 h-4 text-gray-400" />;
    if (code <= 48) return <Cloud className="w-4 h-4 text-gray-400" />;
    if (code <= 65) return <CloudRain className="w-4 h-4 text-blue-400" />;
    if (code <= 77) return <Snowflake className="w-4 h-4 text-blue-200" />;
    if (code <= 82) return <Droplets className="w-4 h-4 text-blue-500" />;
    if (code <= 99) return <CloudLightning className="w-4 h-4 text-purple-500" />;
    return <Cloud className="w-4 h-4 text-gray-400" />;
  };

  const getActiveTripIndex = (data: TransportData[]) => {
    if (!data || data.length === 0) return -1;
    
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    
    let activeIndex = -1;
    let lastPassedMinutes = -1;

    data.forEach((row, index) => {
      const timeStr = row.Uur;
      if (timeStr && timeStr.includes(':')) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const tripMinutes = hours * 60 + minutes;
        
        // Find the latest trip that has already started, but only if it started less than 6 hours ago
        if (tripMinutes <= nowMinutes && (nowMinutes - tripMinutes) < 360 && tripMinutes > lastPassedMinutes) {
          lastPassedMinutes = tripMinutes;
          activeIndex = index;
        }
      }
    });

    return activeIndex;
  };

  const getNextTrip = (data: TransportData[]) => {
    if (!data || data.length === 0) return null;
    
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    
    let nextTrip = null;
    let minDiff = Infinity;

    data.forEach((row) => {
      const timeStr = row.Uur;
      if (timeStr && timeStr.includes(':')) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const tripMinutes = hours * 60 + minutes;
        const diff = tripMinutes - nowMinutes;
        
        if (diff > 0 && diff < minDiff) {
          minDiff = diff;
          nextTrip = { ...row, diff };
        }
      }
    });

    return nextTrip;
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-[#121212] text-gray-100' : 'bg-[#F8F9FA] text-gray-900'} font-sans pb-12`}>
      {/* Offline Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.2em] py-2 text-center sticky top-0 z-[60] shadow-lg"
          >
            <div className="flex items-center justify-center gap-2">
              <WifiOff className="w-3 h-3" />
              Je bent offline - Gegevens zijn mogelijk verouderd
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className={`${isDarkMode ? 'bg-[#1E1E1E] border-white/5' : 'bg-[#FFD200] border-black/5'} shadow-lg border-b sticky top-0 z-50 safe-top transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <p className={`text-xs sm:text-sm font-black opacity-70 uppercase tracking-widest ${isDarkMode ? 'text-[#FFD200]' : 'text-black'}`}>Selfservice heeft steeds voorrang</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {weather && (
              <div className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full border transition-all shadow-sm ${
                isDarkMode 
                  ? 'bg-white/10 border-white/10' 
                  : 'bg-white border-black/5'
              }`}>
                {getWeatherIcon(weather.code)}
                <div className="flex flex-col leading-none">
                  <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-black'}`}>{weather.temp}°C</span>
                  <span className={`text-[7px] sm:text-[8px] font-bold opacity-60 hidden xs:inline ${isDarkMode ? 'text-gray-400' : 'text-black'}`}>{weather.condition}</span>
                </div>
              </div>
            )}

            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2.5 rounded-full transition-all active:scale-95 shadow-sm border ${
                isDarkMode 
                  ? 'bg-white/10 text-[#FFD200] border-white/10 hover:bg-white/20' 
                  : 'bg-white/80 text-black border-black/5 hover:bg-white'
              }`}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all shadow-sm ${
              isDarkMode 
                ? 'bg-white/5 border-white/10' 
                : 'bg-white/60 border-black/5'
            } ${connectionStatus?.success ? 'bg-green-500/10 border-green-500/20' : ''}`}>
              <div className={`w-2 h-2 rounded-full ${connectionStatus?.success ? 'bg-green-500 animate-pulse' : connectionStatus ? 'bg-red-500' : 'bg-gray-400'}`} />
              <span className={`text-[10px] font-black uppercase tracking-wider hidden xs:inline ${isDarkMode ? 'text-gray-400' : 'text-black'}`}>
                {connectionStatus ? (connectionStatus.success ? 'Online' : 'Fout') : 'Status'}
              </span>
            </div>
            
            <button 
              onClick={checkStatus}
              disabled={statusLoading}
              className={`p-2.5 rounded-full transition-all active:scale-95 disabled:opacity-50 shadow-sm border ${
                isDarkMode 
                  ? 'bg-white/10 text-gray-400 border-white/10 hover:text-white' 
                  : 'bg-white/80 text-black border-black/5 hover:bg-white'
              }`}
            >
              <Wifi className={`w-5 h-5 ${statusLoading ? 'animate-pulse' : ''}`} />
            </button>

            <button 
              onClick={fetchData}
              disabled={loading}
              className={`flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-full font-bold active:scale-95 transition-all disabled:opacity-50 shadow-md ${isDarkMode ? 'bg-[#FFD200] text-black hover:bg-[#FFE04D]' : 'bg-black text-white hover:bg-gray-800'}`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{loading ? 'Laden...' : 'Vernieuwen'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 shadow-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-sm">Er is een fout opgetreden</p>
                <p className="text-xs opacity-80 whitespace-pre-wrap">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-lg transition-colors">
                <XCircle className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

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
              <Search className={`h-5 w-5 transition-colors ${isDarkMode ? 'text-gray-500 group-focus-within:text-[#FFD200]' : 'text-gray-400 group-focus-within:text-[#FFD200]'}`} />
            </div>
            <input
              type="text"
              placeholder="Zoek op personeelnummer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`block w-full pl-11 pr-4 py-3.5 border rounded-2xl shadow-sm focus:ring-2 focus:ring-[#FFD200] focus:border-transparent outline-none font-bold text-sm transition-all placeholder:font-medium ${
                isDarkMode 
                  ? 'bg-[#1E1E1E] border-white/10 text-white placeholder:text-gray-600' 
                  : 'bg-white border-black/5 text-gray-900 placeholder:text-gray-400'
              }`}
            />
          </div>
        </div>

        <div className="space-y-8 sm:space-y-12">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="w-10 h-10 text-[#FFD200] animate-spin mb-4" />
              <p className={`text-sm font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Gegevens ophalen van De Lijn...</p>
            </div>          ) : searchTerm.length < 4 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
                <Search className={`w-10 h-10 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
              </div>
              <h2 className={`text-xl font-black uppercase tracking-tight mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                {searchTerm.length > 0 ? 'Typ nog even verder...' : 'Start met zoeken'}
              </h2>
              <p className={`text-sm font-bold max-w-xs leading-relaxed ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                {searchTerm.length > 0 
                  ? `Voer minimaal 4 tekens in om te zoeken. Je hebt er nu ${searchTerm.length}.`
                  : 'Vul een personeelnummer in om de dienstlijst te bekijken.'}
              </p>
            </div>
          ) : data.length > 0 ? (
              <>
                {/* Next Service Banner */}
                {(() => {
                  const nextTrip = getNextTrip(filteredData);
                  if (!nextTrip || !searchTerm) return null;

                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 sm:p-6 rounded-3xl border shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 transition-all mb-8 ${
                        isDarkMode 
                          ? 'bg-[#FFD200]/10 border-[#FFD200]/20' 
                          : 'bg-[#FFD200] border-black/5'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
                          isDarkMode ? 'bg-[#FFD200]/20' : 'bg-white/40'
                        }`}>
                          <Clock className={`w-6 h-6 ${isDarkMode ? 'text-[#FFD200]' : 'text-black'}`} />
                        </div>
                        <div className="text-center sm:text-left">
                          <h3 className={`text-[10px] font-black uppercase tracking-widest opacity-60 ${isDarkMode ? 'text-[#FFD200]' : 'text-black'}`}>
                            Volgende dienst
                          </h3>
                          <p className={`text-lg sm:text-xl font-black tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-black'}`}>
                            Lijn {nextTrip.Lijn} • {nextTrip.Plaats}
                          </p>
                          <p className={`text-xs font-bold mt-1 opacity-70 ${isDarkMode ? 'text-gray-400' : 'text-black'}`}>
                            Vertrek om {nextTrip.Uur} • Richting {nextTrip.richting}
                          </p>
                        </div>
                      </div>
                      <div className={`px-6 py-3 rounded-2xl flex flex-col items-center justify-center min-w-[120px] shadow-sm ${
                        isDarkMode ? 'bg-white/5' : 'bg-black text-white'
                      }`}>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Over</span>
                        <span className="text-2xl font-black tracking-tighter leading-none">
                          {nextTrip.diff} <span className="text-xs uppercase ml-0.5">min</span>
                        </span>
                      </div>
                    </motion.div>
                  );
                })()}


                {/* Section - Data */}
                <section>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 px-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#FFD200] rounded-xl sm:rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                        <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base sm:text-xl font-black uppercase tracking-tight truncate">
                          Dienstlijst Vandaag voor "{searchTerm}"
                        </h2>
                        <div className="flex flex-col">
                          <p className="text-[10px] sm:text-sm font-bold text-gray-500 truncate">
                            {fileName ? formatFileDate(fileName.name) : 'Geen bestand gevonden'}
                          </p>
                          {fileName && (
                            <p className="text-[8px] sm:text-[10px] font-mono text-gray-400 truncate opacity-70">
                              Bestand: {fileName.name}
                            </p>
                          )}
                          {fileName?.modifiedAt && (
                            <p className="text-[8px] sm:text-xs font-medium text-gray-400">
                              Laatst bijgewerkt: {formatModifiedTime(fileName.modifiedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`${isDarkMode ? 'bg-[#1E1E1E] border-white/5' : 'bg-white border-black/5'} rounded-2xl sm:rounded-3xl shadow-xl border overflow-hidden`}>
                    <div className="overflow-x-auto scrollbar-hide">
                      <table className="w-full text-left border-collapse min-w-[800px] sm:min-w-full">
                        <thead>
                          <tr className={`${isDarkMode ? 'bg-white/5' : 'bg-gray-50/50'} border-b ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
                            {data.length > 0 && Object.keys(data[0]).map((key) => (
                              <th key={key} className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-400">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-black/5'}`}>
                          {(() => {
                            const activeIndex = getActiveTripIndex(filteredData);
                            
                            return filteredData.map((row, i) => {
                              const isActive = i === activeIndex;
                              return (
                                <motion.tr 
                                  initial={{ opacity: 0, x: -5 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.02 }}
                                  key={i} 
                                  className={`transition-all group relative ${
                                    isActive 
                                      ? (isDarkMode ? 'bg-[#FFD200]/10 ring-1 ring-[#FFD200]/30' : 'bg-[#FFD200]/15 ring-1 ring-[#FFD200]/50') 
                                      : (isDarkMode ? 'hover:bg-white/5' : 'hover:bg-[#FFD200]/5 active:bg-[#FFD200]/10')
                                  }`}
                                >
                                  {Object.entries(row).map(([key, val], j) => (
                                    <td key={j} className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors relative ${
                                      isActive 
                                        ? (isDarkMode ? 'text-[#FFD200]' : 'text-black') 
                                        : (isDarkMode ? 'text-gray-300 group-hover:text-white' : 'text-gray-700 group-hover:text-black')
                                    } ${key === 'wissel' && String(val).toLowerCase() === 'ja' ? (isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-700') : ''}`}>
                                      {isActive && j === 0 && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FFD200] shadow-[4px_0_15px_rgba(255,210,0,0.4)] z-10" />
                                      )}
                                      <div className="flex items-center gap-2">
                                        {isActive && key === 'Uur' && (
                                          <span className="flex h-2 w-2 rounded-full bg-[#FFD200] animate-ping" />
                                        )}
                                        {key === 'Lijn' && (
                                          <Bus className="w-3 h-3 opacity-50" />
                                        )}
                                        {key === 'voertuig' && (
                                          <Train className="w-3 h-3 opacity-50" />
                                        )}
                                        {key === 'Plaats' ? (
                                          <a 
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(val + ' De Lijn')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 hover:underline decoration-[#FFD200] decoration-2 underline-offset-4"
                                          >
                                            {val}
                                            <ExternalLink className="w-3 h-3 opacity-50" />
                                          </a>
                                        ) : val}
                                        {isActive && key === 'Uur' && (
                                          <span className="ml-2 text-[8px] font-black bg-[#FFD200] text-black px-1.5 py-0.5 rounded uppercase tracking-tighter">Live</span>
                                        )}
                                      </div>
                                    </td>
                                  ))}
                                </motion.tr>
                              );
                            });
                          })()}
                          {filteredData.length === 0 && !loading && (
                            <tr>
                              <td colSpan={10} className="px-6 py-16 text-center text-gray-400 italic text-sm">
                                Geen gegevens gevonden voor "{searchTerm}" in het bestand van vandaag.
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

            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
                <AlertCircle className={`w-10 h-10 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
              </div>
              <h2 className={`text-xl font-black uppercase tracking-tight mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Geen data beschikbaar
              </h2>
              <p className={`text-sm font-bold max-w-xs leading-relaxed ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                Er konden geen gegevens worden opgehaald van de server. Controleer de verbinding.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer / Visitor Counter */}
      <footer className={`mt-auto py-8 border-t ${isDarkMode ? 'bg-[#1E1E1E] border-white/5' : 'bg-white border-black/5'}`}>
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-4">
          {visitorCount !== null && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm ${
              isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-gray-50 border-black/5 text-gray-500'
            }`}>
              <Users className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-widest">
                Totaal aantal bezoekers: <span className={isDarkMode ? 'text-[#FFD200]' : 'text-black'}>{visitorCount.toLocaleString('nl-BE')}</span>
              </span>
            </div>
          )}
          <p className={`text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 ${isDarkMode ? 'text-white' : 'text-black'}`}>
            © {new Date().getFullYear()} De Lijn - Personeelsportaal
          </p>
        </div>
      </footer>
    </div>
  );
}
