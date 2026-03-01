/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ChangeEvent } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Film as FilmIcon, 
  Activity, 
  Settings,
  ChevronRight,
  Search,
  Clock,
  CheckCircle2,
  FileSearch,
  Edit3,
  UploadCloud,
  TrendingUp,
  AlertCircle,
  Database,
  Server,
  ShieldCheck,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
  Save,
  Trash2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { database, ref, onValue, push, set, update, remove } from './services/firebase';
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Section = 'Dashboard' | 'Add New Film' | 'All Films' | 'Production Status' | 'Settings';

type Status = 'researching' | 'editing' | 'uploaded' | 'done';

type DbStatus = 'connected' | 'disconnected' | 'error';

interface DbConfig {
  host: string;
  dbName: string;
  user: string;
  pass: string;
}

interface Film {
  id: string;
  chineseTitle: string;
  vietnameseTitle: string;
  potentialScore: number;
  status: Status;
  lastUpdated: string;
  summary?: string;
  description?: string;
  posterUrl?: string;
  youtubeThumbnailUrl?: string;
  seoKeywords?: string[];
  seoDescription?: string;
  analysisReasoning?: string;
  targetAudience?: string;
}

const MOCK_FILMS: Film[] = [
  { id: '1', chineseTitle: '庆余年 第二季', vietnameseTitle: 'Khánh Dư Niên 2', potentialScore: 9.5, status: 'done', lastUpdated: '2024-03-01 10:00' },
  { id: '2', chineseTitle: '狐妖小红娘·月红篇', vietnameseTitle: 'Hồ Yêu Tiểu Hồng Nương', potentialScore: 8.8, status: 'uploaded', lastUpdated: '2024-03-01 09:30' },
  { id: '3', chineseTitle: '墨雨云间', vietnameseTitle: 'Mặc Vũ Vân Gian', potentialScore: 9.2, status: 'editing', lastUpdated: '2024-03-01 08:15' },
  { id: '4', chineseTitle: '颜心记', vietnameseTitle: 'Nhan Tâm Ký', potentialScore: 7.5, status: 'researching', lastUpdated: '2024-02-29 22:00' },
  { id: '5', chineseTitle: '长相思 第二季', vietnameseTitle: 'Trường Tương Tư 2', potentialScore: 9.8, status: 'researching', lastUpdated: '2024-02-29 20:00' },
];

const STATUS_CONFIG = {
  researching: { label: 'Researching', color: 'text-blue-400', bg: 'bg-blue-400/10', icon: FileSearch },
  editing: { label: 'Editing', color: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: Edit3 },
  uploaded: { label: 'Uploaded', color: 'text-purple-400', bg: 'bg-purple-400/10', icon: UploadCloud },
  done: { label: 'Done', color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: CheckCircle2 },
};

const FilmThumbnail = ({ url, title, className = "" }: { url?: string; title: string; className?: string }) => {
  const [hasError, setHasError] = useState(false);

  if (!url || hasError) {
    return (
      <div className={`flex items-center justify-center text-zinc-800 bg-zinc-950 ${className}`}>
        <FilmIcon className="w-1/2 h-1/2 opacity-20" />
      </div>
    );
  }

  return (
    <img 
      src={url} 
      alt={title} 
      className={`object-contain ${className}`}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
};

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>('Dashboard');
  const [films, setFilms] = useState<Film[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Deletion State
  const [isDeleting, setIsDeleting] = useState(false);
  const [filmToDelete, setFilmToDelete] = useState<string | null>(null);

  // Edit State
  const [filmToEdit, setFilmToEdit] = useState<Film | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Database State
  const [dbStatus, setDbStatus] = useState<DbStatus>('disconnected');
  const [isTesting, setIsTesting] = useState(false);
  const [dbConfig, setDbConfig] = useState<DbConfig>({
    host: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
    dbName: 'Realtime Database',
    user: 'Firebase Auth',
    pass: '••••••••'
  });
  const [dbError, setDbError] = useState<string | null>(null);

  // Add New Film State
  const [newFilm, setNewFilm] = useState({
    chineseTitle: '',
    description: '',
    thumbnail: null as File | null,
    thumbnailPreview: '',
    youtubeThumbnailUrl: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const [lastSync, setLastSync] = useState<string | null>(null);

  // Real-time listener for films
  useEffect(() => {
    const filmsRef = ref(database, 'films');
    const unsubscribe = onValue(filmsRef, (snapshot) => {
      const data = snapshot.val();
      setLastSync(new Date().toLocaleTimeString());
      if (data) {
        const filmList = Object.entries(data).map(([id, value]: [string, any]) => ({
          id,
          ...value
        }));
        setFilms(filmList.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()));
        setDbStatus('connected');
      } else {
        setFilms([]);
        setDbStatus('connected');
      }
      setIsLoading(false);
      setConnectionError(null);
    }, (error) => {
      console.error("Firebase connection error:", error);
      setConnectionError("Failed to connect to Firebase. Please check your configuration.");
      setDbStatus('error');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewFilm({
          ...newFilm,
          thumbnail: file,
          thumbnailPreview: reader.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const isFormValid = newFilm.chineseTitle.trim() !== '' || 
                     newFilm.description.trim() !== '' || 
                     newFilm.thumbnail !== null ||
                     newFilm.youtubeThumbnailUrl.trim() !== '';

  const handleAddFilm = async () => {
    if (!isFormValid) return;

    setIsSaving(true);
    try {
      const filmsRef = ref(database, 'films');
      const newFilmRef = push(filmsRef);
      
      await set(newFilmRef, {
        chineseTitle: newFilm.chineseTitle,
        description: newFilm.description,
        posterUrl: newFilm.thumbnailPreview || '',
        youtubeThumbnailUrl: newFilm.youtubeThumbnailUrl || '',
        status: 'researching',
        lastUpdated: new Date().toISOString(),
        vietnameseTitle: newFilm.chineseTitle || 'Untitled Film',
        potentialScore: 0
      });
      
      setNewFilm({ chineseTitle: '', description: '', thumbnail: null, thumbnailPreview: '', youtubeThumbnailUrl: '' });
      alert('Film added successfully!');
      setActiveSection('Dashboard');
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save film to database.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: Status) => {
    try {
      const filmRef = ref(database, `films/${id}`);
      await update(filmRef, {
        status: newStatus,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Update error:", error);
    }
  };

  const handleDeleteFilm = (id: string) => {
    setFilmToDelete(id);
  };

  const confirmDelete = async () => {
    if (!filmToDelete) return;
    setIsDeleting(true);
    try {
      const filmRef = ref(database, `films/${filmToDelete}`);
      await remove(filmRef);
      setFilmToDelete(null);
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete film. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const renderDeleteModal = () => {
    if (!filmToDelete) return null;

    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 rounded-xl bg-red-500/10 text-red-500">
                  <Trash2 className="w-6 h-6" />
                </div>
                <button 
                  onClick={() => setFilmToDelete(null)}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500"
                  disabled={isDeleting}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <h3 className="text-xl font-bold text-zinc-100 mb-2">Delete Film?</h3>
              <p className="text-zinc-400 text-sm mb-8">
                Are you sure you want to delete this film? This action cannot be undone and all associated data will be permanently removed.
              </p>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setFilmToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-xl transition-all border border-zinc-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/20 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Confirm Delete'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  };

  const handleEditFilm = (film: Film) => {
    setFilmToEdit(film);
  };

  const handleUpdateFilm = async () => {
    if (!filmToEdit) return;
    setIsUpdating(true);
    try {
      const filmRef = ref(database, `films/${filmToEdit.id}`);
      const updates = {
        ...filmToEdit,
        lastUpdated: new Date().toISOString().replace('T', ' ').split('.')[0]
      };
      await update(filmRef, updates);
      setFilmToEdit(null);
    } catch (error) {
      console.error("Update error:", error);
      alert("Failed to update film. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const renderEditModal = () => {
    if (!filmToEdit) return null;

    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">Edit Film Details</h3>
                  <p className="text-xs text-zinc-500">Update information for {filmToEdit.chineseTitle || 'Untitled'}</p>
                </div>
              </div>
              <button 
                onClick={() => setFilmToEdit(null)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500"
                disabled={isUpdating}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-6">
              {/* Chinese Title */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Chinese Title</label>
                <input 
                  type="text"
                  placeholder="Enter the original Chinese title..."
                  value={filmToEdit.chineseTitle}
                  onChange={(e) => setFilmToEdit({...filmToEdit, chineseTitle: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Vietnamese Title */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Vietnamese Title</label>
                <input 
                  type="text"
                  placeholder="Enter the Vietnamese title..."
                  value={filmToEdit.vietnameseTitle}
                  onChange={(e) => setFilmToEdit({...filmToEdit, vietnameseTitle: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Status Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Production Status</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(['researching', 'editing', 'uploaded', 'done'] as Status[]).map((status) => {
                    const config = STATUS_CONFIG[status];
                    const isActive = filmToEdit.status === status;
                    return (
                      <button
                        key={status}
                        onClick={() => setFilmToEdit({...filmToEdit, status})}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                          isActive 
                            ? `${config.bg} ${config.color} border-current shadow-lg shadow-current/5` 
                            : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                        }`}
                      >
                        <config.icon className="w-3.5 h-3.5" />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Poster URL (Direct Edit) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Original Poster URL</label>
                  <div className="flex gap-4">
                    <div className="w-16 aspect-[2/3] rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0">
                      <FilmThumbnail url={filmToEdit.posterUrl} title={filmToEdit.chineseTitle} className="w-full h-full" />
                    </div>
                    <textarea 
                      rows={2}
                      placeholder="Paste image URL or Base64 data..."
                      value={filmToEdit.posterUrl}
                      onChange={(e) => setFilmToEdit({...filmToEdit, posterUrl: e.target.value})}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-[10px] font-mono focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">YouTube Thumbnail URL</label>
                  <div className="flex gap-4">
                    <div className="w-16 aspect-[2/3] rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0">
                      <FilmThumbnail url={filmToEdit.youtubeThumbnailUrl} title={filmToEdit.chineseTitle} className="w-full h-full" />
                    </div>
                    <textarea 
                      rows={2}
                      placeholder="Paste YouTube thumbnail URL..."
                      value={filmToEdit.youtubeThumbnailUrl}
                      onChange={(e) => setFilmToEdit({...filmToEdit, youtubeThumbnailUrl: e.target.value})}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-[10px] font-mono focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Description / Summary</label>
                <textarea 
                  rows={4}
                  placeholder="Enter film description..."
                  value={filmToEdit.description || filmToEdit.summary || ''}
                  onChange={(e) => setFilmToEdit({...filmToEdit, description: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>
            </div>

            <div className="p-6 bg-zinc-900/50 border-t border-zinc-800 flex items-center gap-3">
              <button 
                onClick={() => setFilmToEdit(null)}
                disabled={isUpdating}
                className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-xl transition-all border border-zinc-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateFilm}
                disabled={isUpdating}
                className="flex-[2] px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 disabled:opacity-50"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Updating Film...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setDbError(null);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (dbConfig.host.includes('error')) {
      setDbStatus('error');
      setDbError('Server Unreachable: Ensure the host address is correct and your network allows the connection.');
    } else {
      setDbStatus('connected');
    }
    setIsTesting(false);
  };

  const handleSaveConfig = () => {
    if (dbStatus === 'connected') {
      // In a real app, this would save to local storage or a backend
      alert('Configuration saved and connection established globally.');
    } else {
      setDbError('Please test the connection successfully before saving.');
    }
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Add New Film', icon: PlusCircle },
    { name: 'All Films', icon: FilmIcon },
    { name: 'Production Status', icon: Activity },
    { name: 'Settings', icon: Settings },
  ] as const;

  const stats = {
    total: films.length,
    researching: films.filter(f => f.status === 'researching').length,
    editing: films.filter(f => f.status === 'editing').length,
    uploaded: films.filter(f => f.status === 'uploaded').length,
    done: films.filter(f => f.status === 'done').length,
  };

  const renderAllFilms = () => {
    const filteredFilms = films.filter(film => 
      film.chineseTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      film.vietnameseTitle?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (films.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-16rem)] text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mb-6 border border-zinc-800">
            <FilmIcon className="w-10 h-10 text-zinc-700" />
          </div>
          <h3 className="text-2xl font-semibold mb-2 text-zinc-200">No films added yet</h3>
          <p className="text-zinc-500 max-w-sm mb-8">Start by adding your first film to manage your production workflow.</p>
          <button 
            onClick={() => setActiveSection('Add New Film')}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/20"
          >
            <PlusCircle className="w-5 h-5" />
            Add Film
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-8 animate-in fade-in duration-500 min-w-fit">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              placeholder="Search films by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <button 
            onClick={() => setActiveSection('Add New Film')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Add Film
          </button>
        </div>

        {filteredFilms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-4 border border-zinc-800">
              <Search className="w-6 h-6 text-zinc-700" />
            </div>
            <p className="text-zinc-500">No films found matching "{searchTerm}"</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                  <tr className="bg-zinc-950/50 border-b border-zinc-800">
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Thumbnail</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Title & Description</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Source</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Created Date</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filteredFilms.map((film) => {
                    // Derive status
                    let displayStatus = { label: 'Draft', bg: 'bg-zinc-500/10', text: 'text-zinc-400' };
                    const hasTitle = film.chineseTitle && film.chineseTitle.trim() !== '';
                    const hasDesc = (film.description || film.summary) && (film.description || film.summary)?.trim() !== '';
                    const hasPoster = film.posterUrl && film.posterUrl.trim() !== '';
                    const hasYoutube = film.youtubeThumbnailUrl && film.youtubeThumbnailUrl.trim() !== '';
                    
                    if (film.potentialScore > 0) {
                      displayStatus = { label: 'Analyzed', bg: 'bg-emerald-500/10', text: 'text-emerald-400' };
                    } else if (hasTitle && hasDesc && (hasPoster || hasYoutube)) {
                      displayStatus = { label: 'Ready', bg: 'bg-blue-500/10', text: 'text-blue-400' };
                    } else if (hasTitle || hasDesc || hasPoster || hasYoutube) {
                      displayStatus = { label: 'AI Pending', bg: 'bg-yellow-500/10', text: 'text-yellow-400' };
                    }

                    const activeThumbnail = hasYoutube ? film.youtubeThumbnailUrl : film.posterUrl;

                    return (
                      <tr key={film.id} className="group hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="relative group/thumb">
                            <div className="w-12 aspect-[2/3] bg-zinc-950 rounded border border-zinc-800 overflow-hidden flex items-center justify-center">
                              <FilmThumbnail 
                                url={activeThumbnail} 
                                title={film.chineseTitle} 
                                className="w-full h-full"
                              />
                            </div>
                            
                            {/* Hover Preview Popup */}
                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 z-50 opacity-0 group-hover/thumb:opacity-100 pointer-events-none transition-all duration-200 scale-95 group-hover/thumb:scale-100 origin-left">
                              <div className="w-48 aspect-[2/3] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden p-1">
                                <FilmThumbnail 
                                  url={activeThumbnail} 
                                  title={film.chineseTitle} 
                                  className="w-full h-full rounded-lg"
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="max-w-xs">
                            <h4 className="font-bold text-zinc-100 text-sm truncate">
                              {film.chineseTitle || 'Untitled'}
                            </h4>
                            <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                              {film.description || film.summary || 'No description provided.'}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-white/5 ${displayStatus.bg} ${displayStatus.text}`}>
                            {displayStatus.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {hasYoutube && (
                              <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[9px] font-medium border border-red-500/10">YouTube</span>
                            )}
                            {hasPoster && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[9px] font-medium border border-blue-500/10">Original</span>
                            )}
                            {!hasYoutube && !hasPoster && (
                              <span className="text-[9px] text-zinc-600 italic">None</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                            <Clock className="w-3 h-3 opacity-50" />
                            {new Date(film.lastUpdated).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditFilm(film);
                              }}
                              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-all"
                              title="Edit Film"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFilm(film.id);
                              }}
                              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-all"
                              title="Delete Film"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        )}
      </div>
    );
  };

  const renderDashboard = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-16rem)] text-center">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
          <p className="text-zinc-500">Connecting to database...</p>
        </div>
      );
    }

    if (connectionError) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-16rem)] text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-2xl font-semibold mb-2 text-zinc-200">Database Error</h3>
          <p className="text-zinc-500 max-w-sm mb-8">{connectionError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-xl transition-all flex items-center gap-2 border border-zinc-700"
          >
            <RefreshCw className="w-5 h-5" />
            Retry Connection
          </button>
        </div>
      );
    }

    if (dbStatus !== 'connected') {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-16rem)] text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mb-6 border border-zinc-800">
            <Database className="w-10 h-10 text-zinc-700" />
          </div>
          <h3 className="text-2xl font-semibold mb-2 text-zinc-200">Database Connection Required</h3>
          <p className="text-zinc-500 max-w-sm mb-8">
            Connect your database in Settings to view your production pipeline and start analyzing films.
          </p>
          <button 
            onClick={() => setActiveSection('Settings')}
            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-xl transition-all flex items-center gap-2 border border-zinc-700"
          >
            <Settings className="w-5 h-5" />
            Go to Settings
          </button>
        </div>
      );
    }

    if (films.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-16rem)] text-center">
          <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
            <FilmIcon className="w-10 h-10 text-zinc-700" />
          </div>
          <h3 className="text-2xl font-semibold mb-2 text-zinc-200">No films analyzed yet</h3>
          <p className="text-zinc-500 max-w-sm mb-8">
            Start by adding your first Chinese film to analyze its potential for the Vietnamese market.
          </p>
          <button 
            onClick={() => setActiveSection('Add New Film')}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/20"
          >
            <PlusCircle className="w-5 h-5" />
            Analyze First Film
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-8 animate-in fade-in duration-500 min-w-fit">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Films', value: stats.total, icon: FilmIcon, color: 'text-zinc-100', bg: 'bg-zinc-800' },
            { label: 'Researching', value: stats.researching, icon: FileSearch, color: 'text-blue-400', bg: 'bg-blue-400/10' },
            { label: 'Editing', value: stats.editing, icon: Edit3, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
            { label: 'Uploaded', value: stats.uploaded, icon: UploadCloud, color: 'text-purple-400', bg: 'bg-purple-400/10' },
            { label: 'Done', value: stats.done, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          ].map((stat, i) => (
            <div key={i} className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between group hover:border-zinc-700 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <TrendingUp className="w-4 h-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <p className="text-sm text-zinc-500 font-medium mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-zinc-100">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Films */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-500" />
                Recent Analysis
              </h3>
              <button 
                onClick={() => setActiveSection('All Films')}
                className="text-sm text-emerald-500 hover:text-emerald-400 font-medium transition-colors"
              >
                View All
              </button>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/50">
                      <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Film Title</th>
                      <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">Score</th>
                      <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {films.slice(0, 5).map((film) => {
                      const status = STATUS_CONFIG[film.status];
                      return (
                        <tr key={film.id} className="group hover:bg-zinc-800/50 transition-colors cursor-pointer">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors">{film.vietnameseTitle}</span>
                              <span className="text-xs text-zinc-500 italic">{film.chineseTitle}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`text-sm font-bold ${film.potentialScore >= 9 ? 'text-emerald-400' : film.potentialScore >= 8 ? 'text-yellow-400' : 'text-zinc-400'}`}>
                              {film.potentialScore}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                              <status.icon className="w-3 h-3" />
                              {status.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-zinc-500">
                            {film.lastUpdated.split(' ')[0]}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          {/* Workflow Overview */}
          <div className="space-y-4">
            <div className="px-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500" />
                Workflow Health
              </h3>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
              {[
                { key: 'researching', label: 'Researching', count: stats.researching, total: stats.total },
                { key: 'editing', label: 'Editing', count: stats.editing, total: stats.total },
                { key: 'uploaded', label: 'Uploaded', count: stats.uploaded, total: stats.total },
                { key: 'done', label: 'Done', count: stats.done, total: stats.total },
              ].map((item) => {
                const config = STATUS_CONFIG[item.key as keyof typeof STATUS_CONFIG];
                const percentage = item.total > 0 ? (item.count / item.total) * 100 : 0;
                return (
                  <div key={item.key} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400 font-medium">{item.label}</span>
                      <span className="text-zinc-100 font-bold">{item.count}</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${config.bg.replace('/10', '')}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="pt-4 border-t border-zinc-800 mt-6">
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                  <span>3 projects in Editing for more than 48h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    return (
      <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Database Infrastructure Panel */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">Database Infrastructure</h3>
                <p className="text-xs text-zinc-500">Real-time system health and connectivity</p>
              </div>
            </div>
            
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${
              dbStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              dbStatus === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
              'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}>
              {dbStatus === 'connected' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              {dbStatus === 'connected' ? 'System Online' : dbStatus === 'error' ? 'Connection Error' : 'Connecting...'}
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Firebase Project ID</p>
                <p className="text-sm font-mono text-zinc-300 bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800/50">
                  {import.meta.env.VITE_FIREBASE_PROJECT_ID || 'Not Configured'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Database URL</p>
                <p className="text-sm font-mono text-zinc-300 bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800/50 truncate">
                  {import.meta.env.VITE_FIREBASE_DATABASE_URL || 'Not Configured'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Region</p>
                <p className="text-sm font-mono text-zinc-300 bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800/50">
                  {import.meta.env.VITE_FIREBASE_DATABASE_URL?.includes('asia') ? 'asia-east1' : 'us-central1'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Last Successful Sync</p>
                <p className="text-sm font-mono text-zinc-300 bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800/50">
                  {films.length > 0 ? lastSync : 'No data available yet'}
                </p>
              </div>
            </div>

            {dbStatus === 'error' && (
              <div className="mt-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-400">Connection Failed</p>
                  <p className="text-xs text-red-400/80 mt-1 leading-relaxed">
                    The system encountered an error while connecting to the data source. Please check your environment variables or contact your administrator.
                  </p>
                </div>
              </div>
            )}

            {dbStatus === 'connected' && (
              <div className="mt-8 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 animate-in slide-in-from-top-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <p className="text-sm font-medium text-emerald-400">
                  All systems operational. Data is being synchronized in real-time.
                </p>
              </div>
            )}
          </div>

          <div className="p-6 bg-zinc-900/50 border-t border-zinc-800 flex items-center justify-between">
            <p className="text-xs text-zinc-500 italic">
              Configuration is managed via environment variables and cannot be modified from the UI.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh Connection
            </button>
          </div>
        </div>

        {/* Other Settings Placeholder */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-50">
          <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <h4 className="font-semibold mb-2">AI Model Preferences</h4>
            <p className="text-sm text-zinc-500">Configure default models and token limits.</p>
          </div>
          <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <h4 className="font-semibold mb-2">Notification Settings</h4>
            <p className="text-sm text-zinc-500">Manage production alerts and updates.</p>
          </div>
        </div>
      </div>
    );
  };

  const renderAddNewFilm = () => {
    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-8 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <PlusCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-100">Add New Film</h3>
              <p className="text-sm text-zinc-500">Provide at least one field to start your analysis</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Chinese Title */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Chinese Title</label>
              <input 
                type="text"
                placeholder="Enter the original Chinese title..."
                value={newFilm.chineseTitle}
                onChange={(e) => setNewFilm({...newFilm, chineseTitle: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* YouTube Thumbnail URL */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">YouTube Thumbnail URL (Optional)</label>
              <input 
                type="text"
                placeholder="Enter YouTube thumbnail URL..."
                value={newFilm.youtubeThumbnailUrl}
                onChange={(e) => setNewFilm({...newFilm, youtubeThumbnailUrl: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Thumbnail Upload */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Thumbnail Image</label>
              <div className="flex flex-col items-center justify-center w-full">
                <label className={`flex flex-col items-center justify-center w-full aspect-[3/4] max-h-64 max-w-[200px] border-2 border-dashed rounded-xl cursor-pointer transition-all overflow-hidden ${
                  newFilm.thumbnailPreview ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950'
                }`}>
                  {newFilm.thumbnailPreview ? (
                    <img 
                      src={newFilm.thumbnailPreview} 
                      alt="Preview" 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <UploadCloud className="w-10 h-10 mb-3 text-zinc-600" />
                      <p className="mb-2 text-sm text-zinc-500 px-4 text-center">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-[10px] text-zinc-600">PNG, JPG or WEBP</p>
                    </div>
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </label>
                {newFilm.thumbnailPreview && (
                  <button 
                    onClick={() => setNewFilm({...newFilm, thumbnail: null, thumbnailPreview: ''})}
                    className="mt-2 text-xs text-red-400 hover:text-red-300 font-medium flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove image
                  </button>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Description</label>
              <textarea 
                rows={5}
                placeholder="Enter a brief summary or notes about the film..."
                value={newFilm.description}
                onChange={(e) => setNewFilm({...newFilm, description: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              />
            </div>
          </div>

          <div className="pt-4">
            {!isFormValid && (
              <p className="text-xs text-zinc-500 mb-4 flex items-center gap-2 italic">
                <AlertCircle className="w-3 h-3" />
                Please provide at least one field to enable submission.
              </p>
            )}
            <button 
              onClick={handleAddFilm}
              disabled={!isFormValid || isSaving}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
              {isSaving ? 'Adding Film...' : 'Add Film'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <FilmIcon className="w-6 h-6 text-emerald-500" />
            Film Analyzer
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => setActiveSection(item.name)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors group ${
                activeSection === item.name 
                  ? 'bg-zinc-800 text-emerald-400' 
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.name}</span>
              </div>
              {activeSection === item.name && <ChevronRight className="w-4 h-4" />}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold text-xs">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">John Doe</p>
              <p className="text-xs text-zinc-500 truncate">Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-950/50 backdrop-blur-sm sticky top-0 z-10">
          <h2 className="text-lg font-semibold">{activeSection}</h2>
          <div className="flex items-center gap-4">
            <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
              <PlusCircle className="w-4 h-4" />
              Quick Add
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="p-8 min-w-fit">
            {activeSection === 'Dashboard' ? renderDashboard() : 
             activeSection === 'Add New Film' ? renderAddNewFilm() :
             activeSection === 'All Films' ? renderAllFilms() :
             activeSection === 'Settings' ? renderSettings() : (
              <div className="rounded-2xl border border-dashed border-zinc-800 h-[calc(100vh-12rem)] flex flex-col items-center justify-center text-center p-12">
                <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                  <LayoutDashboard className="w-8 h-8 text-zinc-700" />
                </div>
                <h3 className="text-xl font-medium mb-2">{activeSection} Content Coming Soon</h3>
                <p className="text-zinc-500 max-w-md">
                  This section is currently under development. Soon you will be able to manage your film analysis and production workflow here.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      {renderDeleteModal()}
      {renderEditModal()}
    </div>
  );
}
