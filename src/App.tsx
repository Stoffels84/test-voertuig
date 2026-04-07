import { useEffect, useMemo, useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bus,
  Train,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  Search,
  Calendar,
  Clock,
  Moon,
  Sun,
  Database,
  User,
  Hash,
  LayoutGrid,
  Table as TableIcon,
  MapPin,
  Eye,
  MessageSquare,
  Send,
  CalendarPlus,
  Timer,
  Share2,
  Check,
  Bell,
  BellOff,
} from 'lucide-react';
import { db } from './firebase';
import { 
  doc, 
  onSnapshot, 
  runTransaction, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

interface TransportData {
  [key: string]: any;
}

interface FileInfo {
  name: string;
  modifiedAt?: string;
}

interface Message {
  id: string;
  text: string;
  author: string;
  timestamp: any;
}

interface ConnectionStatus {
  success: boolean;
  message: string;
}

export default function App() {
  const [data, setData] = useState<TransportData[]>([]);
  const [fileName, setFileName] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);

  const [statusLoading, setStatusLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [isOnline, setIsOnline] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [showMessageBoard, setShowMessageBoard] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifiedTrips, setNotifiedTrips] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem('notificationsEnabled');
    if (saved === 'true' && 'Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setNotificationsEnabled(true);
          localStorage.setItem('notificationsEnabled', 'true');
          try {
            new Notification('Meldingen ingeschakeld', {
              body: 'Je ontvangt nu meldingen 5 en 10 minuten voor vertrek.',
              icon: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png'
            });
          } catch (e) {
            console.error('Notification error:', e);
          }
        } else {
          alert('Meldingen zijn geweigerd door de browser. Schakel ze handmatig in bij de site-instellingen.');
        }
      } else {
        alert('Deze browser ondersteunt geen meldingen.');
      }
    } else {
      setNotificationsEnabled(false);
      localStorage.setItem('notificationsEnabled', 'false');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      console.log('beforeinstallprompt fired');
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    setDeferredPrompt(null);
    setShowInstallButton(false);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      setSearchTerm(localStorage.getItem('lastSearch') || '');
      
      const savedDarkMode = localStorage.getItem('darkMode');
      if (savedDarkMode !== null) {
        setIsDarkMode(savedDarkMode === 'true');
      } else {
        // Auto dark mode: 18:00 to 07:00
        const hour = new Date().getHours();
        if (hour >= 18 || hour < 7) {
          setIsDarkMode(true);
        }
      }

      const savedViewMode = localStorage.getItem('viewMode');
      setViewMode(savedViewMode === 'table' ? 'table' : 'cards');

      setIsOnline(navigator.onLine);
    } catch (err) {
      console.error('Fout bij lezen van localStorage:', err);
    }
  }, []);

  const filteredData = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    return data.filter((row) =>
      String(row?.personeelnummer || '')
        .toLowerCase()
        .includes(s)
    );
  }, [data, searchTerm]);

  useEffect(() => {
    if (!notificationsEnabled || filteredData.length === 0 || !('Notification' in window) || Notification.permission !== 'granted') return;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    filteredData.forEach(row => {
      const timeStr = row?.Uur;
      if (typeof timeStr === 'string' && timeStr.includes(':')) {
        const [h, m] = timeStr.split(':').map(Number);
        const tripMinutes = h * 60 + m;
        const diff = tripMinutes - nowMinutes;

        if (diff === 10 || diff === 5) {
          const tripId = `${row.personeelnummer}_${timeStr}_${diff}`;
          if (!notifiedTrips.has(tripId)) {
            try {
              new Notification(`Vertrek over ${diff} minuten!`, {
                body: `Lijn ${row.Lijn} naar ${row.Plaats} vertrekt om ${timeStr}.`,
                icon: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png'
              });
              setNotifiedTrips(prev => {
                const next = new Set(prev);
                next.add(tripId);
                return next;
              });
            } catch (e) {
              console.error('Notification trigger error:', e);
            }
          }
        }
      }
    });
  }, [currentTime, notificationsEnabled, filteredData, notifiedTrips]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('lastSearch', searchTerm);
    } catch (err) {
      console.error('Kon lastSearch niet opslaan:', err);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('darkMode', String(isDarkMode));
    } catch (err) {
      console.error('Kon darkMode niet opslaan:', err);
    }

    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('viewMode', viewMode);
    } catch (err) {
      console.error('Kon viewMode niet opslaan:', err);
    }
  }, [viewMode]);

  const checkStatus = async () => {
    setStatusLoading(true);
    try {
      const response = await fetch('/api/status');
      const result = await response.json();
      setConnectionStatus(result);
    } catch (err) {
      console.error('Status error:', err);
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

      if (result?.success) {
        setData(Array.isArray(result.data) ? result.data : []);
        setFileName(result.fileName ?? null);
        setIsMock(!!result.isMock);

        if (result.message && (!result.data || result.data.length === 0)) {
          setError(result.message);
        }
      } else {
        setError(result?.error || 'Fout bij het ophalen van gegevens');
      }
    } catch (err) {
      console.error('Fetch data error:', err);
      setError('Kon geen verbinding maken met de server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    checkStatus();

    // Visitor Counter Logic
    const visitorDocRef = doc(db, 'stats', 'visitors');

    const incrementCounter = async () => {
      // Use sessionStorage to prevent multiple increments in the same session
      const hasVisited = sessionStorage.getItem('hasVisited');
      if (hasVisited) return;

      try {
        await runTransaction(db, async (transaction) => {
          const visitorDoc = await transaction.get(visitorDocRef);
          if (!visitorDoc.exists()) {
            transaction.set(visitorDocRef, { count: 1 });
          } else {
            const newCount = (visitorDoc.data().count || 0) + 1;
            transaction.update(visitorDocRef, { count: newCount });
          }
        });
        sessionStorage.setItem('hasVisited', 'true');
      } catch (err) {
        console.error('Error incrementing visitor counter:', err);
      }
    };

    incrementCounter();

    // Listen for real-time updates
    const unsubscribe = onSnapshot(visitorDocRef, (doc) => {
      if (doc.exists()) {
        setVisitorCount(doc.data().count);
      }
    });

    // Message Board Logic
    const messagesQuery = query(
      collection(db, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgs);
    });

    return () => {
      unsubscribe();
      unsubscribeMessages();
    };
  }, []);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !authorName.trim() || isSendingMessage) return;

    setIsSendingMessage(true);
    try {
      await addDoc(collection(db, 'messages'), {
        text: newMessage.trim(),
        author: authorName.trim(),
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
      localStorage.setItem('authorName', authorName);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Kon bericht niet verzenden');
    } finally {
      setIsSendingMessage(false);
    }
  };

  useEffect(() => {
    setAuthorName(localStorage.getItem('authorName') || '');
  }, []);

  const addToCalendar = (trip: TransportData) => {
    const now = new Date();
    const [hours, minutes] = trip.Uur.split(':').map(Number);
    
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
    const endDate = new Date(startDate.getTime() + 30 * 60000); // Assume 30 min duration

    const formatTime = (date: Date) => date.toISOString().replace(/-|:|\.\d+/g, '');
    
    const title = `Rit Lijn ${trip.Lijn} - ${trip.richting}`;
    const details = `Voertuig: ${trip.voertuig}\nLoop: ${trip.Loop}\nPlaats: ${trip.Plaats}\nNaam: ${trip.naam}`;
    const location = trip.Plaats;

    const googleUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatTime(startDate)}/${formatTime(endDate)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
    
    window.open(googleUrl, '_blank');
  };

  const copyShiftToClipboard = () => {
    if (filteredData.length === 0) return;

    const dateStr = fileName ? formatFileDate(fileName.name) : new Date().toLocaleDateString('nl-BE');
    let text = `📋 *Dienstlijst van ${dateStr}*\n`;
    text += `👤 Personeelsnummer: ${searchTerm}\n\n`;

    filteredData.forEach((row) => {
      text += `🕒 ${row.Uur} | Lijn ${row.Lijn} (${row.richting || ''})\n`;
      text += `📍 ${row.Plaats || ''}\n`;
      text += `🚌 Voertuig: ${row.voertuig || ''} | Loop: ${row.Loop || ''}\n`;
      if (row.wissel?.toLowerCase() === 'ja') text += `⚠️ WISSEL\n`;
      text += `-------------------\n`;
    });

    text += `\n_Verzonden via Opzoeken Voertuig App_`;

    if (navigator.share) {
      navigator.share({
        title: `Dienstlijst ${searchTerm}`,
        text: text,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setIsCopying(true);
        setTimeout(() => setIsCopying(false), 2000);
      });
    }
  };

  const formatFileDate = (name: string) => {
    if (!name) return '';
    const match = name.match(/^(\d{4})(\d{2})(\d{2})/);

    if (match) {
      const [, yyyy, mm, dd] = match;
      return `${dd}/${mm}/${yyyy}`;
    }

    return name;
  };

  const getActiveTripIndex = (rows: TransportData[]) => {
    if (!rows || rows.length === 0) return -1;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    let activeIndex = -1;
    let lastPassedMinutes = -1;

    rows.forEach((row, index) => {
      const timeStr = row?.Uur;

      if (typeof timeStr === 'string' && timeStr.includes(':')) {
        const [hours, minutes] = timeStr.split(':').map(Number);

        if (Number.isNaN(hours) || Number.isNaN(minutes)) return;

        const tripMinutes = hours * 60 + minutes;

        if (tripMinutes <= nowMinutes && nowMinutes - tripMinutes < 360 && tripMinutes > lastPassedMinutes) {
          lastPassedMinutes = tripMinutes;
          activeIndex = index;
        }
      }
    });

    return activeIndex;
  };

  const getNextTrip = (rows: TransportData[]) => {
    if (!rows || rows.length === 0) return null;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    let nextTrip: (TransportData & { diff: number }) | null = null;
    let minDiff = Infinity;

    rows.forEach((row) => {
      const timeStr = row?.Uur;

      if (typeof timeStr === 'string' && timeStr.includes(':')) {
        const [hours, minutes] = timeStr.split(':').map(Number);

        if (Number.isNaN(hours) || Number.isNaN(minutes)) return;

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
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDarkMode ? 'bg-[#121212] text-gray-100' : 'bg-[#F8F9FA] text-gray-900'
      } font-sans pb-12`}
    >
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

      <header
        className={`${
          isDarkMode ? 'bg-[#1E1E1E] border-white/5' : 'bg-[#FFD200] border-black/5'
        } shadow-lg border-b sticky top-0 z-50 safe-top transition-colors duration-300`}
      >
        <div className="max-w-7xl mx-auto px-4 h-20 sm:h-28 flex items-center justify-between">
          <div className="flex items-center gap-3 max-w-[70%] sm:max-w-none">
            <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-md'}`}>
              <AlertCircle className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 ${isDarkMode ? 'text-[#FFD200]' : 'text-black'}`} />
              <p className={`text-[14px] sm:text-[18px] font-bold leading-tight ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                <span className={`font-black uppercase ${isDarkMode ? 'text-[#FFD200]' : 'text-black'}`}>Selfservice</span> krijgt steeds voorrang op de diensten die hier zichtbaar zijn.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={toggleNotifications}
              className={`p-2.5 rounded-full transition-all active:scale-95 shadow-sm border ${
                isDarkMode
                  ? `bg-white/10 ${notificationsEnabled ? 'text-[#FFD200]' : 'text-gray-400'} border-white/10 hover:bg-white/20`
                  : `bg-white/80 ${notificationsEnabled ? 'text-blue-600' : 'text-black'} border-black/5 hover:bg-white`
              }`}
              title={notificationsEnabled ? "Meldingen uitschakelen" : "Meldingen inschakelen (5 & 10 min voor vertrek)"}
            >
              {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </button>

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

            <button
              onClick={() => setShowMessageBoard(!showMessageBoard)}
              className={`p-2.5 rounded-full transition-all active:scale-95 shadow-sm border relative ${
                isDarkMode
                  ? 'bg-white/10 text-white border-white/10 hover:bg-white/20'
                  : 'bg-white/80 text-black border-black/5 hover:bg-white'
              }`}
              title="Berichtenbord"
            >
              <MessageSquare className="w-5 h-5" />
              {messages.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
                  {messages.length}
                </span>
              )}
            </button>

            {visitorCount !== null && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all shadow-sm ${
                  isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-white/60 border-black/5 text-gray-600'
                }`}
                title="Totaal aantal bezoekers"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="text-[11px] font-black tracking-tight">{visitorCount}</span>
              </div>
            )}

            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all shadow-sm ${
                isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/60 border-black/5'
              } ${connectionStatus?.success ? 'bg-green-500/10 border-green-500/20' : ''}`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  connectionStatus?.success
                    ? 'bg-green-500 animate-pulse'
                    : connectionStatus
                    ? 'bg-red-500'
                    : 'bg-gray-400'
                }`}
              />
              <span
                className={`text-[10px] font-black uppercase tracking-wider hidden xs:inline ${
                  isDarkMode ? 'text-gray-400' : 'text-black'
                }`}
              >
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
              className={`flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-full font-bold active:scale-95 transition-all disabled:opacity-50 shadow-md ${
                isDarkMode ? 'bg-[#FFD200] text-black hover:bg-[#FFE04D]' : 'bg-black text-white hover:bg-gray-800'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{loading ? 'Laden...' : 'Vernieuwen'}</span>
            </button>

            {showInstallButton && !isInstalled && (
              <button
                onClick={handleInstallClick}
                className={`flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-full font-bold active:scale-95 transition-all shadow-md ${
                  isDarkMode ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                title="Installeer als App"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">Installeer App</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <AnimatePresence>
          {showMessageBoard && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`mb-6 overflow-hidden rounded-3xl border shadow-lg ${
                isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-black/5'
              }`}
            >
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-50'}`}>
                      <MessageSquare className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <h2 className={`text-lg font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Berichtenbord
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowMessageBoard(false)}
                    className={`p-2 rounded-full hover:bg-black/5 transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSendMessage} className="mb-6 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Jouw naam..."
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      className={`px-4 py-2.5 rounded-xl border outline-none transition-all text-sm ${
                        isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-blue-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'
                      }`}
                      required
                    />
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Deel een update of waarschuwing..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className={`w-full pl-4 pr-12 py-2.5 rounded-xl border outline-none transition-all text-sm ${
                          isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-blue-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'
                        }`}
                        required
                        maxLength={200}
                      />
                      <button
                        type="submit"
                        disabled={isSendingMessage}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </form>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {messages.length === 0 ? (
                    <div className="text-center py-8 opacity-50 italic text-sm">Nog geen berichten...</div>
                  ) : (
                    messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`p-3 rounded-2xl border ${
                          isDarkMode ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-xs font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                            {msg.author}
                          </span>
                          <span className="text-[10px] opacity-50">
                            {msg.timestamp instanceof Timestamp 
                              ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Zojuist'}
                          </span>
                        </div>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{msg.text}</p>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                  {connectionStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                </div>
                <span className="font-bold text-xs sm:text-sm">{connectionStatus.message}</span>
              </div>
              <button onClick={() => setConnectionStatus(null)} className="p-2 text-gray-400 hover:text-gray-600">
                <XCircle className="w-4 h-4 opacity-50" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!isInstalled && !showInstallButton && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className={`mb-6 p-4 rounded-2xl border flex items-start gap-3 shadow-sm ${
                isDarkMode ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              <ExternalLink className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-sm">Installeer als App (Edge/Chrome)</p>
                <p className="text-xs opacity-80">
                  Om rechtstreeks naar deze pagina te gaan, ga naar <a href="https://opzoeken-voertuig.vercel.app" target="_blank" rel="noopener noreferrer" className="underline font-bold">https://opzoeken-voertuig.vercel.app</a>
                  <br />
                  Klik op de <strong>drie puntjes (...)</strong> rechtsboven in je browser, ga naar <strong>Apps</strong> en kies <strong>"Deze site installeren als een app"</strong>.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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

        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative group flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search
                className={`h-5 w-5 transition-colors ${
                  isDarkMode ? 'text-gray-500 group-focus-within:text-[#FFD200]' : 'text-gray-400 group-focus-within:text-[#FFD200]'
                }`}
              />
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

          <div className={`flex p-1 rounded-2xl border ${isDarkMode ? 'bg-[#1E1E1E] border-white/10' : 'bg-white border-black/5'} shadow-sm`}>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                viewMode === 'table'
                  ? isDarkMode
                    ? 'bg-[#FFD200] text-black'
                    : 'bg-black text-white'
                  : isDarkMode
                  ? 'text-gray-500 hover:text-gray-300'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              Tabel
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                viewMode === 'cards'
                  ? isDarkMode
                    ? 'bg-[#FFD200] text-black'
                    : 'bg-black text-white'
                  : isDarkMode
                  ? 'text-gray-500 hover:text-gray-300'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Fiche
            </button>
          </div>
        </div>

        <div className="space-y-8 sm:space-y-12">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="w-10 h-10 text-[#FFD200] animate-spin mb-4" />
              <p className={`text-sm font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Gegevens ophalen van De Lijn...
              </p>
            </div>
          ) : searchTerm.length < 4 ? (
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
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 px-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#FFD200] rounded-xl sm:rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                      <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
                    </div>
                    <div className="min-w-0">
                      <h2 className={`text-base sm:text-xl font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Dienstlijst voor "{searchTerm}"
                      </h2>
                      {fileName && (
                        <p className="text-[8px] sm:text-[10px] font-bold text-gray-500 truncate">
                          {formatFileDate(fileName.name)}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={copyShiftToClipboard}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-sm border ${
                      isDarkMode
                        ? 'bg-white/10 text-white border-white/10 hover:bg-white/20'
                        : 'bg-white text-black border-black/5 hover:bg-gray-50'
                    }`}
                  >
                    {isCopying ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
                    {isCopying ? 'Gekopieerd!' : 'Dienst Delen'}
                  </button>
                </div>

                {viewMode === 'table' ? (
                  <>
                    <div className={`${isDarkMode ? 'bg-[#1E1E1E] border-white/5' : 'bg-white border-black/5'} rounded-2xl sm:rounded-3xl shadow-xl border overflow-hidden`}>
                      <div className="overflow-x-auto scrollbar-hide">
                        <table className="w-full text-left border-collapse min-w-[800px] sm:min-w-full">
                          <thead>
                            <tr className={`${isDarkMode ? 'bg-white/5' : 'bg-gray-50/50'} border-b ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
                              {data.length > 0 &&
                                Object.keys(data[0]).map((key) => (
                                  <th key={key} className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-400">
                                    {key.toLowerCase() === 'wissel' ? 'VOERTUIGWISSEL' : key}
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
                                        ? isDarkMode
                                          ? 'bg-[#FFD200]/10 ring-1 ring-[#FFD200]/30'
                                          : 'bg-[#FFD200]/15 ring-1 ring-[#FFD200]/50'
                                        : isDarkMode
                                        ? 'hover:bg-white/5'
                                        : 'hover:bg-[#FFD200]/5 active:bg-[#FFD200]/10'
                                    }`}
                                  >
                                    {Object.entries(row).map(([key, val], j) => (
                                      <td
                                        key={j}
                                        className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors relative ${
                                          isActive
                                            ? isDarkMode
                                              ? 'text-[#FFD200]'
                                              : 'text-black'
                                            : isDarkMode
                                            ? 'text-gray-300 group-hover:text-white'
                                            : 'text-gray-700 group-hover:text-black'
                                        } ${
                                          key === 'wissel' && String(val).toLowerCase() === 'ja'
                                            ? isDarkMode
                                              ? 'bg-blue-500/20 text-blue-400'
                                              : 'bg-blue-50 text-blue-700'
                                            : ''
                                        }`}
                                      >
                                        {isActive && j === 0 && (
                                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FFD200] shadow-[4px_0_15px_rgba(255,210,0,0.4)] z-10" />
                                        )}

                                        <div className="flex items-center gap-2">
                                          {isActive && key === 'Uur' && <span className="flex h-2 w-2 rounded-full bg-[#FFD200] animate-ping" />}
                                          {key === 'Lijn' && <Bus className="w-3 h-3 opacity-50" />}
                                          {key === 'voertuig' && <Train className="w-3 h-3 opacity-50" />}

                                          {key === 'voertuig' ? (
                                            <a
                                              href={`https://vehicletracking.delijn.be/`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-1 hover:underline decoration-[#FFD200] decoration-2 underline-offset-4"
                                              title="Bekijk live locatie"
                                            >
                                              {String(val)}
                                              <MapPin className="w-3 h-3 opacity-50" />
                                            </a>
                                          ) : key === 'Plaats' ? (
                                            <a
                                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(val) + ' De Lijn')}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-1 hover:underline decoration-[#FFD200] decoration-2 underline-offset-4"
                                            >
                                              {String(val)}
                                              <ExternalLink className="w-3 h-3 opacity-50" />
                                            </a>
                                          ) : (
                                            String(val)
                                          )}

                                          {key === 'Uur' && (() => {
                                            const [h, m] = String(val).split(':').map(Number);
                                            const now = new Date();
                                            const tripTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
                                            const diff = Math.floor((tripTime.getTime() - now.getTime()) / 60000);
                                            
                                            if (diff > 0 && diff < 60) {
                                              return (
                                                <span className={`ml-2 text-sm font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter animate-pulse ${
                                                  isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'
                                                }`}>
                                                  {diff}m
                                                </span>
                                              );
                                            }
                                            return null;
                                          })()}

                                          {key === 'Uur' && (
                                            <button
                                              onClick={() => addToCalendar(row)}
                                              className="ml-auto p-1 hover:bg-black/5 rounded transition-colors"
                                              title="Toevoegen aan agenda"
                                            >
                                              <CalendarPlus className="w-3 h-3 opacity-50 hover:opacity-100" />
                                            </button>
                                          )}

                                          {isActive && key === 'Uur' && (
                                            <span className="ml-2 text-[8px] font-black bg-[#FFD200] text-black px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                              Live
                                            </span>
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

                      <div className="sm:hidden px-4 py-2 bg-gray-50 border-t border-black/5 flex items-center justify-center gap-2">
                        <div className="w-4 h-1 bg-gray-300 rounded-full" />
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Swipe voor meer</span>
                        <div className="w-4 h-1 bg-gray-300 rounded-full" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-6">
                    {(() => {
                      const activeIndex = getActiveTripIndex(filteredData);

                      return filteredData.map((row, i) => {
                        const isActive = i === activeIndex;

                        return (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            key={i}
                            className="overflow-hidden shadow-xl"
                          >
                            <div
                              className={`bg-[#FFD200] rounded-t-2xl p-4 flex items-center justify-between shadow-sm border-b border-black/10 ${
                                isActive ? 'ring-2 ring-inset ring-black/20' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3 text-black">
                                <Database className="w-5 h-5" />
                                <h2 className="text-sm sm:text-base font-black uppercase tracking-tight">
                                  Personeelsgegevens: {row.personeelnummer || searchTerm} {row.naam ? `- ${row.naam}` : ''}
                                </h2>
                              </div>
                              <div className="flex items-center gap-2">
                                {isActive && (
                                  <span className="bg-black text-[#FFD200] text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest animate-pulse">
                                    Actieve Dienst
                                  </span>
                                )}
                              </div>
                            </div>

                            <div
                              className={`${isDarkMode ? 'bg-[#1E1E1E] border-white/5' : 'bg-white border-black/5'} rounded-b-2xl p-6 border border-t-0 ${
                                isActive ? 'ring-2 ring-[#FFD200]' : ''
                              }`}
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                  { label: 'UUR', value: row.Uur, icon: Clock },
                                  { label: 'PLAATS', value: row.Plaats, icon: MapPin },
                                  { label: 'LIJN', value: row.Lijn, icon: Bus },
                                  { label: 'LOOP', value: row.Loop, icon: LayoutGrid },
                                  { label: 'VOERTUIG', value: row.voertuig, icon: Train },
                                  { label: 'VOERTUIGWISSEL', value: row.wissel, icon: RefreshCw },
                                  { label: 'NAAM', value: row.naam, icon: User },
                                ].map((field, idx) => (
                                  <div
                                    key={idx}
                                    className={`${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-black/5'} p-4 rounded-2xl shadow-sm border flex flex-col gap-1 transition-all hover:scale-[1.02] relative group`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                                        <field.icon className="w-3 h-3 opacity-50" />
                                        {field.label}
                                      </span>
                                      {field.label === 'UUR' && (
                                        <button
                                          onClick={() => addToCalendar(row)}
                                          className={`p-1.5 rounded-lg transition-all active:scale-90 opacity-0 group-hover:opacity-100 ${
                                            isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'
                                          }`}
                                          title="Toevoegen aan agenda"
                                        >
                                          <CalendarPlus className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <span className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-black'}`}>
                                        {field.label === 'PLAATS' ? (
                                          <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(field.value || '') + ' De Lijn')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:underline decoration-[#FFD200] decoration-2 underline-offset-4 flex items-center gap-1"
                                          >
                                            {field.value || '-'}
                                            <ExternalLink className="w-3 h-3 opacity-50" />
                                          </a>
                                        ) : field.label === 'VOERTUIG' ? (
                                          <a
                                            href={`https://vehicletracking.delijn.be/`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:underline decoration-[#FFD200] decoration-2 underline-offset-4 flex items-center gap-1"
                                            title="Bekijk live locatie"
                                          >
                                            {field.value || '-'}
                                            <MapPin className="w-3 h-3 opacity-50" />
                                          </a>
                                        ) : (
                                          field.value || '-'
                                        )}
                                      </span>
                                      {field.label === 'UUR' && (() => {
                                        const [h, m] = String(field.value).split(':').map(Number);
                                        const now = new Date();
                                        const tripTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
                                        const diff = Math.floor((tripTime.getTime() - now.getTime()) / 60000);
                                        
                                        if (diff > 0 && diff < 60) {
                                          return (
                                            <span className={`text-sm font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter animate-pulse ${
                                              isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'
                                            }`}>
                                              {diff}m
                                            </span>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        );
                      });
                    })()}

                    {filteredData.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
                          <AlertCircle className={`w-10 h-10 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                        </div>
                        <h2 className={`text-xl font-black uppercase tracking-tight mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          Geen data beschikbaar
                        </h2>
                      </div>
                    )}
                  </div>
                )}
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

      <footer className={`mt-auto py-8 border-t ${isDarkMode ? 'bg-[#1E1E1E] border-white/5' : 'bg-white border-black/5'}`}>
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-4">
        </div>
      </footer>
    </div>
  );
}