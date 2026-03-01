/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';
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
  posterUrl?: string;
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

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>('Dashboard');
  const [films, setFilms] = useState<Film[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
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
    summary: '',
    posterUrl: ''
  });
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  const handleAnalyze = async () => {
    if (!newFilm.chineseTitle || !newFilm.summary) return;
    
    setIsAnalyzing(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this Chinese film for the Vietnamese market:
          Title: ${newFilm.chineseTitle}
          Summary: ${newFilm.summary}
          
          Provide the response in JSON format with the following structure:
          {
            "vietnameseTitle": "string",
            "potentialScore": number (0-10),
            "seoKeywords": ["string", "string", "string"],
            "seoDescription": "string",
            "analysisReasoning": "string",
            "targetAudience": "string"
          }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              vietnameseTitle: { type: Type.STRING },
              potentialScore: { type: Type.NUMBER },
              seoKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              seoDescription: { type: Type.STRING },
              analysisReasoning: { type: Type.STRING },
              targetAudience: { type: Type.STRING }
            },
            required: ["vietnameseTitle", "potentialScore", "seoKeywords", "seoDescription", "analysisReasoning", "targetAudience"]
          }
        }
      });

      const result = JSON.parse(response.text);
      setAnalysisResult(result);
    } catch (error) {
      console.error("Analysis error:", error);
      alert("Failed to analyze film. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveFilm = async () => {
    if (!analysisResult) return;

    try {
      const filmsRef = ref(database, 'films');
      const newFilmRef = push(filmsRef);
      await set(newFilmRef, {
        ...newFilm,
        ...analysisResult,
        status: 'researching',
        lastUpdated: new Date().toISOString()
      });
      
      setNewFilm({ chineseTitle: '', summary: '', posterUrl: '' });
      setAnalysisResult(null);
      setActiveSection('Dashboard');
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save film to database.");
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

  const handleDeleteFilm = async (id: string) => {
    if (!confirm("Are you sure you want to delete this film?")) return;
    try {
      const filmRef = ref(database, `films/${id}`);
      await remove(filmRef);
    } catch (error) {
      console.error("Delete error:", error);
    }
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
      <div className="space-y-8 animate-in fade-in duration-500">
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
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
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
      <div className="max-w-md mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center shadow-xl">
          <div className={`flex items-center gap-3 px-6 py-3 rounded-full text-sm font-bold border transition-all duration-500 ${
            dbStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            dbStatus === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
            'bg-zinc-800 text-zinc-400 border-zinc-700'
          }`}>
            {dbStatus === 'connected' && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
            {dbStatus === 'connected' ? 'Connected' : dbStatus === 'error' ? 'Disconnected' : 'Checking Connection...'}
          </div>

          {dbStatus === 'error' && (
            <div className="mt-6 text-center animate-in slide-in-from-top-2">
              <p className="text-sm text-red-400 font-medium">
                Connection failed. Please check environment configuration.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAddNewFilm = () => {
    return (
      <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6 shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <PlusCircle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-100">Film Details</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Chinese Title</label>
                <input 
                  type="text"
                  placeholder="e.g. 庆余年 第二季"
                  value={newFilm.chineseTitle}
                  onChange={(e) => setNewFilm({...newFilm, chineseTitle: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Poster Image URL</label>
                <input 
                  type="text"
                  placeholder="https://example.com/poster.jpg"
                  value={newFilm.posterUrl}
                  onChange={(e) => setNewFilm({...newFilm, posterUrl: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Episode Summary</label>
                <textarea 
                  rows={6}
                  placeholder="Paste the film summary or episode details here..."
                  value={newFilm.summary}
                  onChange={(e) => setNewFilm({...newFilm, summary: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>
            </div>

            <button 
              onClick={handleAnalyze}
              disabled={isAnalyzing || !newFilm.chineseTitle || !newFilm.summary}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
            >
              {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {isAnalyzing ? 'Analyzing with AI...' : 'Analyze Potential'}
            </button>
          </div>

          {/* Analysis Result */}
          <div className="space-y-6">
            {analysisResult ? (
              <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-8 space-y-6 shadow-xl animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    AI Analysis Result
                  </h3>
                  <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/20">
                    Score: {analysisResult.potentialScore}/10
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Vietnamese Title</label>
                    <p className="text-xl font-bold text-zinc-100">{analysisResult.vietnameseTitle}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">SEO Keywords</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {analysisResult.seoKeywords.map((kw: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded text-xs">{kw}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Target Audience</label>
                    <p className="text-sm text-zinc-300">{analysisResult.targetAudience}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Reasoning</label>
                    <p className="text-sm text-zinc-400 leading-relaxed">{analysisResult.analysisReasoning}</p>
                  </div>
                </div>

                <button 
                  onClick={handleSaveFilm}
                  className="w-full py-4 bg-zinc-100 hover:bg-white text-zinc-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Save to Production
                </button>
              </div>
            ) : (
              <div className="h-full border border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center p-12 text-zinc-600">
                <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">Analysis results will appear here after processing.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <FilmIcon className="w-6 h-6 text-emerald-500" />
            Film Analyzer
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
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

        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-6xl mx-auto">
            {activeSection === 'Dashboard' ? renderDashboard() : 
             activeSection === 'Add New Film' ? renderAddNewFilm() :
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
    </div>
  );
}
