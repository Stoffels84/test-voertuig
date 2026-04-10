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
  TrendingUp,
  Coffee,
  PartyPopper,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
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
  const [weather, setWeather] = useState<{ condition: string; temp: string } | null>(null);
  const [weatherImage, setWeatherImage] = useState<string>('');

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Gebruik de interne API om CORS-problemen te voorkomen
        const response = await fetch(`/api/weather?t=${Date.now()}`);
        if (!response.ok) throw new Error('Weather API error');
        const data = await response.json();
        const condition = data.current_condition[0].weatherDesc[0].value;
        const temp = data.current_condition[0].temp_C;
        setWeather({ condition, temp });
        
        const cond = condition.toLowerCase();
        const hour = new Date().getHours();
        const isNight = hour < 6 || hour > 21;
        
        let keyword = 'sunny';
        if (isNight) {
          keyword = 'night';
        } else if (cond.includes('thunder') || cond.includes('storm')) {
          keyword = 'storm';
        } else if (cond.includes('snow') || cond.includes('ice') || cond.includes('sleet')) {
          keyword = 'snowy';
        } else if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('shower')) {
          keyword = 'rainy';
        } else if (cond.includes('fog') || cond.includes('mist') || cond.includes('haze')) {
          keyword = 'foggy';
        } else if (cond.includes('cloud') || cond.includes('overcast')) {
          keyword = 'cloudy';
        } else if (cond.includes('clear') || cond.includes('sun')) {
          keyword = 'sunny';
        }

        // Curated high-quality weather images from Unsplash
        const images: Record<string, string> = {
          sunny: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1920&q=80',
          night: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1920&q=80',
          cloudy: 'https://images.unsplash.com/photo-1483977399921-6cf349674824?auto=format&fit=crop&w=1920&q=80',
          rainy: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1920&q=80',
          snowy: 'https://images.unsplash.com/photo-1491002052546-bf38f186af56?auto=format&fit=crop&w=1920&q=80',
          foggy: 'https://images.unsplash.com/photo-1487621167305-5d248087c724?auto=format&fit=crop&w=1920&q=80',
          storm: 'https://images.unsplash.com/photo-1605727281914-509999176656?auto=format&fit=crop&w=1920&q=80',
        };

        setWeatherImage(images[keyword] || images.sunny);
      } catch (err) {
        console.error('Weather fetch failed:', err);
        const hour = new Date().getHours();
        const isNight = hour < 6 || hour > 21;
        setWeatherImage(isNight 
          ? 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1920&q=80'
          : 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1920&q=80'
        );
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 600000); // Elke 10 minuten checken
    return () => clearInterval(interval);
  }, []);
  const [hasCelebrated, setHasCelebrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('notificationsEnabled');
    if (saved === 'true' && 'Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      if ('Notification' in window) {
        try {
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
            const isIframe = window.self !== window.top;
            if (isIframe) {
              alert('Meldingen worden vaak geblokkeerd binnen een iframe. Klik op het icoontje rechtsboven om de app in een nieuw tabblad te openen en probeer het daar opnieuw.');
            } else {
              alert('Meldingen zijn geweigerd door de browser. Schakel ze handmatig in bij de site-instellingen.');
            }
          }
        } catch (err) {
          console.error('Notification permission error:', err);
          alert('Er is een fout opgetreden bij het aanvragen van meldingen. Probeer de app te openen in een nieuw tabblad.');
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

  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const tripTimes = filteredData.map(row => {
      const [h, m] = String(row.Uur).split(':').map(Number);
      return h * 60 + m;
    }).sort((a, b) => a - b);

    const completed = filteredData.filter(row => {
      const [h, m] = String(row.Uur).split(':').map(Number);
      return (h * 60 + m) < nowMinutes;
    }).length;

    const lastTripMinutes = tripTimes[tripTimes.length - 1];
    const isLastTripStarted = nowMinutes >= lastTripMinutes;
    const isFinished = nowMinutes >= lastTripMinutes + 240;

    const rawRemaining = filteredData.length - completed;
    const remaining = isFinished ? rawRemaining : Math.max(1, rawRemaining);
    const progress = isFinished ? (completed / filteredData.length) * 100 : Math.min(99, (completed / filteredData.length) * 100);

    return {
      total: filteredData.length,
      completed,
      remaining,
      isFinished,
      isLastTripStarted,
      first: filteredData.find(row => {
        const [h, m] = String(row.Uur).split(':').map(Number);
        return (h * 60 + m) === tripTimes[0];
      })?.Uur,
      last: filteredData.find(row => {
        const [h, m] = String(row.Uur).split(':').map(Number);
        return (h * 60 + m) === tripTimes[tripTimes.length - 1];
      })?.Uur,
      progress
    };
  }, [filteredData, currentTime]);

  useEffect(() => {
    if (stats && stats.total > 0 && stats.remaining === 0 && !hasCelebrated) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD200', '#000000', '#3B82F6']
      });
      setHasCelebrated(true);
    }
    if (stats && stats.remaining > 0) {
      setHasCelebrated(false);
    }
  }, [stats?.remaining, hasCelebrated]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    let prefix = 'Goedenavond';
    if (hour < 6) prefix = 'Goedenacht';
    else if (hour < 12) prefix = 'Goedemorgen';
    else if (hour < 18) prefix = 'Goedemiddag';
    
    const name = filteredData[0]?.naam || filteredData[0]?.Naam || filteredData[0]?.NAAM || searchTerm || 'Chauffeur';
    return `${prefix}, ${name}`;
  }, [currentTime, filteredData, searchTerm]);

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

  const copyShiftToClipboard = async () => {
    if (filteredData.length === 0) return;

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

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
      try {
        await navigator.share({
          title: `Dienstlijst ${searchTerm}`,
          text: text,
        });
      } catch (err) {
        console.error('Share error:', err);
        // Fallback to clipboard if share fails or is cancelled
        copyToClipboardOnly(text);
      }
    } else {
      copyToClipboardOnly(text);
    }
  };

  const copyToClipboardOnly = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopying(true);
      setTimeout(() => setIsCopying(false), 2000);
    } catch (err) {
      console.error('Clipboard error:', err);
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
        isDarkMode ? 'bg-[#0A0A0B] text-gray-100' : 'bg-[#F4F6F8] text-gray-900'
      } font-sans pb-12 relative overflow-hidden`}
    >
      {/* Weather Background Layer */}
      {weatherImage && (
        <div 
          className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000"
          style={{ opacity: isDarkMode ? 0.6 : 0.5 }}
        >
          <img 
            src={weatherImage} 
            alt="Weather Background" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className={`absolute inset-0 ${isDarkMode ? 'bg-black/40' : 'bg-white/20'}`} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />
        </div>
      )}

      <div className="relative z-10">
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
          isDarkMode ? 'bg-[#111113] border-white/5' : 'bg-[#FFD200] border-black/5'
        } shadow-xl border-b sticky top-0 z-50 safe-top transition-colors duration-300`}
      >
        <div className="max-w-7xl mx-auto px-2 sm:px-4 h-16 sm:h-20 flex items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <div className={`flex items-center gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl border transition-all skew-x-[-2deg] ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-md'}`}>
              <AlertCircle className={`w-3.5 h-3.5 sm:w-5 sm:h-5 shrink-0 ${isDarkMode ? 'text-[#FFD200]' : 'text-black'}`} />
              <p className={`text-[10px] sm:text-[15px] font-bold leading-tight skew-x-[2deg] ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                <span className={`font-black uppercase ${isDarkMode ? 'text-[#FFD200]' : 'text-black'}`}>Selfservice</span> <span className="hidden xs:inline">krijgt voorrang.</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 overflow-x-auto no-scrollbar py-2">
            <button
              onClick={toggleNotifications}
              className={`p-2 rounded-full transition-all active:scale-95 shadow-sm border shrink-0 ${
                isDarkMode
                  ? `bg-white/10 ${notificationsEnabled ? 'text-[#FFD200]' : 'text-gray-400'} border-white/10 hover:bg-white/20`
                  : `bg-white/80 ${notificationsEnabled ? 'text-blue-600' : 'text-black'} border-black/5 hover:bg-white`
              }`}
              title={notificationsEnabled ? "Meldingen uitschakelen" : "Meldingen inschakelen (5 & 10 min voor vertrek)"}
            >
              {notificationsEnabled ? <Bell className="w-4 h-4 sm:w-5 sm:h-5" /> : <BellOff className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-full transition-all active:scale-95 shadow-sm border shrink-0 ${
                isDarkMode
                  ? 'bg-white/10 text-[#FFD200] border-white/10 hover:bg-white/20'
                  : 'bg-white/80 text-black border-black/5 hover:bg-white'
              }`}
            >
              {isDarkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            <button
              onClick={() => setShowMessageBoard(!showMessageBoard)}
              className={`p-2 rounded-full transition-all active:scale-95 shadow-sm border relative shrink-0 ${
                isDarkMode
                  ? 'bg-white/10 text-white border-white/10 hover:bg-white/20'
                  : 'bg-white/80 text-black border-black/5 hover:bg-white'
              }`}
              title="Berichtenbord"
            >
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
              {messages.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] sm:text-[10px] font-bold px-1 py-0.5 rounded-full border-2 border-white">
                  {messages.length}
                </span>
              )}
            </button>

            {visitorCount !== null && (
              <div
                className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all shadow-sm shrink-0 ${
                  isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-white/60 border-black/5 text-gray-600'
                }`}
                title="Totaal aantal bezoekers"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="text-[11px] font-black tracking-tight">{visitorCount}</span>
              </div>
            )}

            {weather && (
              <div
                className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all shadow-sm shrink-0 ${
                  isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-white/60 border-black/5 text-gray-600'
                }`}
                title={`Weer in Gent: ${weather.condition}`}
              >
                <span className="text-[11px] font-black tracking-tight">{weather.temp}°C</span>
                <span className="text-[9px] font-bold uppercase opacity-60">{weather.condition}</span>
              </div>
            )}

            <div
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-full border transition-all shadow-sm shrink-0 ${
                isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/60 border-black/5'
              } ${connectionStatus?.success ? 'bg-green-500/10 border-green-500/20' : ''}`}
            >
              <div
                className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                  connectionStatus?.success
                    ? 'bg-green-500 animate-pulse'
                    : connectionStatus
                    ? 'bg-red-500'
                    : 'bg-gray-400'
                }`}
              />
              <span
                className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider hidden lg:inline ${
                  isDarkMode ? 'text-gray-400' : 'text-black'
                }`}
              >
                {connectionStatus ? (connectionStatus.success ? 'Online' : 'Fout') : 'Status'}
              </span>
            </div>

            <button
              onClick={checkStatus}
              disabled={statusLoading}
              className={`p-2 rounded-full transition-all active:scale-95 disabled:opacity-50 shadow-sm border shrink-0 ${
                isDarkMode
                  ? 'bg-white/10 text-gray-400 border-white/10 hover:text-white'
                  : 'bg-white/80 text-black border-black/5 hover:bg-white'
              }`}
            >
              <Wifi className={`w-4 h-4 sm:w-5 sm:h-5 ${statusLoading ? 'animate-pulse' : ''}`} />
            </button>

            <a
              href="https://launchpad.delijn.be/flp?sap-client=100#MaintenanceNotification-zcreate"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-full font-bold active:scale-95 transition-all shadow-md shrink-0 ${
                isDarkMode 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30' 
                  : 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'
              }`}
              title="Defect Melden"
            >
              <AlertCircle className="w-4 h-4" />
              <span className="hidden lg:inline">Defect Melden</span>
            </a>

            <button
              onClick={fetchData}
              disabled={loading}
              className={`flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-full font-bold active:scale-95 transition-all disabled:opacity-50 shadow-md shrink-0 ${
                isDarkMode ? 'bg-[#FFD200] text-black hover:bg-[#FFE04D]' : 'bg-black text-white hover:bg-gray-800'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline ml-2">Vernieuwen</span>
            </button>

            {showInstallButton && !isInstalled && (
              <button
                onClick={handleInstallClick}
                className={`flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-full font-bold active:scale-95 transition-all shadow-md shrink-0 ${
                  isDarkMode ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                title="Installeer als App"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden lg:inline">Installeer App</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-6 sm:space-y-8">
        {/* Dynamic Greeting & Stats Section */}
        {filteredData.length > 0 && stats && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
          >
            {/* Greeting Card */}
            <div className={`md:col-span-2 p-6 rounded-2xl border flex flex-col justify-between relative overflow-hidden skew-x-[-1deg] ${
              isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-sm'
            }`}>
              <div className="relative z-10 skew-x-[1deg]">
                <h2 className={`text-2xl sm:text-4xl font-black tracking-tighter italic mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {greeting}! 👋
                </h2>
                <p className={`text-sm sm:text-lg font-medium opacity-80 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {stats.isFinished 
                    ? "Alle missies voltooid. Goed gewerkt! 🏁" 
                    : stats.isLastTripStarted
                      ? "Laatste missie is gestart. Bijna aan de finish! ⚡"
                      : `Nog ${stats.remaining} stukken op de teller. Gas erop! ⚡`}
                </p>
              </div>
              
              <div className="mt-8 space-y-3 skew-x-[1deg]">
                <div className="flex justify-between text-[11px] font-black uppercase tracking-[0.2em] text-blue-500">
                  <span>Performance</span>
                  <span className="font-mono">{Math.round(stats.progress)}%</span>
                </div>
                <div className={`h-4 rounded-sm overflow-hidden p-0.5 ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.progress}%` }}
                    className="h-full bg-gradient-to-r from-blue-600 via-blue-400 to-cyan-400 rounded-sm shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                  />
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-6 flex flex-wrap gap-2 skew-x-[1deg]">
                <a
                  href="https://launchpad.delijn.be/flp?sap-client=100#MaintenanceNotification-zcreate"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border ${
                    isDarkMode 
                      ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' 
                      : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Defect Melden
                </a>
              </div>

              {/* Decorative background element */}
              <Zap className={`absolute -right-8 -bottom-8 w-48 h-48 opacity-[0.05] rotate-12 ${isDarkMode ? 'text-blue-500' : 'text-blue-200'}`} />
            </div>

            {/* Quick Stats Card */}
            <div className={`p-6 rounded-2xl border grid grid-cols-2 gap-6 skew-x-[-1deg] ${
              isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-sm'
            }`}>
              <div className="space-y-1 skew-x-[1deg]">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Totaal
                </span>
                <p className={`text-3xl font-black font-mono ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.total}</p>
              </div>
              <div className="space-y-1 skew-x-[1deg]">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-green-500" /> Klaar
                </span>
                <p className={`text-3xl font-black font-mono text-blue-500`}>{stats.completed}</p>
              </div>
              <div className="space-y-1 skew-x-[1deg]">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-yellow-500" /> Start
                </span>
                <p className={`text-2xl font-black font-mono ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.first}</p>
              </div>
              <div className="space-y-1 skew-x-[1deg]">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5 text-purple-500" /> Einde
                </span>
                <p className={`text-2xl font-black font-mono ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.last}</p>
              </div>
            </div>
          </motion.div>
        )}

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
          {connectionStatus && !connectionStatus.success && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-4 p-3 sm:p-4 rounded-2xl flex items-center justify-between shadow-sm border bg-white border-red-500/30 text-red-800"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-100">
                  <XCircle className="w-4 h-4 text-red-600" />
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
          <div className="relative group flex-1 skew-x-[-1deg]">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none skew-x-[1deg]">
              <Search
                className={`h-5 w-5 transition-colors ${
                  isDarkMode ? 'text-[#FFD200] group-focus-within:text-[#FFD200]' : 'text-gray-400 group-focus-within:text-[#FFD200]'
                }`}
              />
            </div>
            <input
              type="text"
              placeholder="Zoek op personeelnummer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`block w-full pl-11 pr-4 py-3.5 border-2 rounded-lg shadow-xl focus:ring-4 focus:ring-[#FFD200]/20 focus:border-[#FFD200] outline-none font-black text-sm transition-all placeholder:font-medium skew-x-[1deg] ${
                isDarkMode
                  ? 'bg-[#111113] border-white/10 text-white placeholder:text-gray-600'
                  : 'bg-white border-black/10 text-gray-900 placeholder:text-gray-400'
              }`}
            />
          </div>

          <div className={`flex p-1 rounded-lg border skew-x-[-1deg] ${isDarkMode ? 'bg-[#111113] border-white/10' : 'bg-white border-black/5'} shadow-xl`}>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-black uppercase tracking-[0.15em] transition-all skew-x-[1deg] ${
                viewMode === 'table'
                  ? isDarkMode
                    ? 'bg-[#FFD200] text-black shadow-[0_0_15px_rgba(255,210,0,0.3)]'
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
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-black uppercase tracking-[0.15em] transition-all skew-x-[1deg] ${
                viewMode === 'cards'
                  ? isDarkMode
                    ? 'bg-[#FFD200] text-black shadow-[0_0_15px_rgba(255,210,0,0.3)]'
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
                    <div className={`${isDarkMode ? 'bg-[#111113] border-white/5' : 'bg-white border-black/5'} rounded-lg shadow-2xl border overflow-hidden skew-x-[-0.5deg]`}>
                      <div className="overflow-x-auto scrollbar-hide skew-x-[0.5deg]">
                        <table className="w-full text-left border-collapse min-w-[800px] sm:min-w-full">
                          <thead>
                            <tr className={`${isDarkMode ? 'bg-white/5' : 'bg-gray-50/50'} border-b ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
                              {data.length > 0 &&
                                Object.keys(data[0]).map((key) => (
                                  <th key={key} className="px-4 sm:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                                    {key.toLowerCase() === 'wissel' ? 'WISSEL' : key}
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
                                          ? 'bg-[#FFD200] text-black ring-2 ring-[#FFD200] shadow-[0_0_30px_rgba(255,210,0,0.2)] z-10'
                                          : 'bg-[#FFD200] text-black ring-2 ring-[#FFD200] shadow-[0_0_30px_rgba(255,210,0,0.3)] z-10'
                                        : isDarkMode
                                        ? 'hover:bg-white/5'
                                        : 'hover:bg-[#FFD200]/5 active:bg-[#FFD200]/10'
                                    }`}
                                  >
                                    {Object.entries(row).map(([key, val], j) => (
                                      <td
                                        key={j}
                                        className={`px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-bold whitespace-nowrap transition-colors relative ${
                                          isActive
                                            ? 'text-black'
                                            : isDarkMode
                                            ? 'text-gray-300 group-hover:text-white'
                                            : 'text-gray-700 group-hover:text-black'
                                        } ${
                                          key === 'Uur' ? 'font-mono' : ''
                                        } ${
                                          key === 'wissel' && String(val).toLowerCase() === 'ja'
                                            ? isActive
                                              ? 'bg-blue-600/20'
                                              : isDarkMode
                                              ? 'bg-blue-500/20 text-blue-400'
                                              : 'bg-blue-50 text-blue-700'
                                            : ''
                                        }`}
                                      >
                                        {isActive && j === 0 && (
                                          <>
                                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FFD200] shadow-[4px_0_15px_rgba(255,210,0,0.4)] z-10" />
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                              <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                                              <div className="w-2 h-2 rounded-full bg-red-500 absolute" />
                                            </div>
                                          </>
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
                            className="overflow-hidden shadow-2xl skew-x-[-0.5deg]"
                          >
                            <div
                              className={`bg-[#FFD200] rounded-t-lg p-4 flex items-center justify-between shadow-sm border-b border-black/10 skew-x-[0.5deg] ${
                                isActive ? 'ring-2 ring-inset ring-black/20' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3 text-black">
                                <Database className="w-5 h-5" />
                                <h2 className="text-sm sm:text-base font-black uppercase tracking-tight">
                                  Dienst: {row.personeelnummer || searchTerm} {row.naam ? `- ${row.naam}` : ''}
                                </h2>
                              </div>
                              <div className="flex items-center gap-2">
                                {isActive && (
                                  <span className="bg-black text-[#FFD200] text-[8px] font-black px-2 py-1 rounded-sm uppercase tracking-widest animate-pulse">
                                    Live Performance
                                  </span>
                                )}
                              </div>
                            </div>

                            <div
                              className={`${isDarkMode ? 'bg-[#111113] border-white/5' : 'bg-white border-black/5'} rounded-b-lg p-6 border border-t-0 skew-x-[0.5deg] ${
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
                                  { label: 'WISSEL', value: row.wissel, icon: RefreshCw },
                                  { label: 'NAAM', value: row.naam, icon: User },
                                ].map((field, idx) => (
                                  <div
                                    key={idx}
                                    className={`${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-black/5'} p-4 rounded-lg shadow-sm border flex flex-col gap-1 transition-all hover:scale-[1.02] relative group`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-500 flex items-center gap-1.5">
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
                                      <span className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-black'} ${field.label === 'UUR' ? 'font-mono' : ''}`}>
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
                                            <span className={`text-sm font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-tighter animate-pulse font-mono ${
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
    </div>
  );
}