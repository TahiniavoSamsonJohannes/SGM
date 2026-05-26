import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, FileText, CheckSquare,
  History, UserCircle, LogOut, Menu,
} from 'lucide-react';
import {
  seedDynamicValues, isFirstLaunch,
  isSubscriptionActive, type CrewList,
} from './db';
import type { TabId } from './types';

import SetupFlow from './auth/SetupFlow';
import LoginPin from './auth/LoginPin';
import ImportAccount from './auth/ImportAccount';
import SubscriptionExpired from './auth/SubscriptionExpired';

import Dashboard from './pages/Dashboard';
import CrewPage from './pages/CrewPage';
import ShipsPage from './pages/ShipsPage';
import CrewListsPage from './pages/CrewListsPage';
import CrewListPage from './pages/CrewListPage';
import ChecklistPage from './pages/ChecklistPage';
import HistoryPage from './pages/HistoryPage';
import AccountPage from './pages/AccountPage';
import DataPage from './pages/DataPage';

import logoUrl from './assets/logo-ae.png';

const TABS = [
  { id: 'dashboard' as TabId, label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'crew' as TabId, label: 'Équipage', icon: Users },
  { id: 'ships' as TabId, label: 'Navires', icon: FileText },
  { id: 'crewlists' as TabId, label: "Listes d'équipage", icon: FileText },
  { id: 'checklist' as TabId, label: 'Checklist', icon: CheckSquare },
  { id: 'history' as TabId, label: 'Historique exports', icon: History },
  { id: 'account' as TabId, label: 'Mon compte', icon: UserCircle },
];

type AuthState =
  | 'loading'
  | 'setup'
  | 'login'
  | 'import-account'
  | 'activation'       // retour vers SetupFlow étape machine
  | 'no-subscription'  // connecté mais pas d'abonnement actif
  | 'ok'
  | 'logging-out';

// ── Clé session ──
const SESSION_KEY = 'ae_session_active';

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingList, setEditingList] = useState<CrewList | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    async function init() {
      await seedDynamicValues();
      const first = await isFirstLaunch();
      if (first) {
        setAuthState('setup');
        return;
      }
      // ── Vérifier si une session active existe ──
      const sessionActive = sessionStorage.getItem(SESSION_KEY) === 'true';
      if (sessionActive) {
        // Vérifier que l'abonnement est toujours valide
        const active = await isSubscriptionActive();
        if (active) {
          setTab('dashboard');
          setAuthState('ok');
        } else {
          setAuthState('no-subscription');
        }
        return;
      }
      setAuthState('login');
    }
    init();
  }, []);

  // ── Après connexion PIN réussie ──
  const handleLoginSuccess = async () => {
    setTab('dashboard');
    const active = await isSubscriptionActive();
    if (active) {
      // Enregistrer la session
      sessionStorage.setItem(SESSION_KEY, 'true');
      setTimeout(() => setAuthState('ok'), 0);
    } else {
      setTimeout(() => setAuthState('no-subscription'), 0);
    }
  };

  // ── Déconnexion ──
  const handleLogout = () => {
    // Effacer la session
    sessionStorage.removeItem(SESSION_KEY);
    setAuthState('logging-out');
    setTimeout(() => { setTab('dashboard'); setAuthState('login'); }, 500);
  };

  const navigate = (id: TabId) => {
    if (id !== 'crewlists') { setEditingList(null); setShowForm(false); }
    setTab(id);
    setSidebarOpen(false);
  };

  const handleEditList = (list: CrewList) => {
    setEditingList(list);
    setShowForm(true);
    setTab('crewlists');
    setSidebarOpen(false);
  };

  // ── Écrans auth ───────────────────────────────────────────────────
  if (authState === 'loading') return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-ocean-500
        border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (authState === 'setup')
    return <SetupFlow onDone={() => setAuthState('login')} />;

  if (authState === 'activation')
    return (
      <SetupFlow
        onDone={() => setAuthState('login')}
        initialStep="machine"
      />
    );

  if (authState === 'login')
    return (
      <LoginPin
        onSuccess={handleLoginSuccess}
        onImportAccount={() => setAuthState('import-account')}
        onGoToActivation={() => setAuthState('activation')}
      />
    );

  if (authState === 'import-account')
    return (
      <ImportAccount
        onImported={() => setAuthState('login')}
        onBack={() => setAuthState('login')}
      />
    );

  if (authState === 'no-subscription')
    return (
      <SubscriptionExpired
        onActivated={() => setAuthState('ok')}
        onLogout={handleLogout}
      />
    );

  if (authState === 'logging-out') return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center fade-out">
      <div className="w-8 h-8 border-2 border-ocean-500
        border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── App shell ─────────────────────────────────────────────────────
  return (
    <div className="h-screen flex bg-navy-900 overflow-hidden">

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-56 bg-navy-800 border-r border-navy-700
        flex flex-col transform transition-transform duration-300
        lg:relative lg:translate-x-0 lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-navy-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Logo"
              className="w-9 h-9 object-contain flex-shrink-0" />
            <div className="leading-tight">
              <div className="text-xs font-bold text-white font-display">Armement</div>
              <div className="text-xs font-bold text-ocean-400 font-display">Eustratiou</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto custom-scroll">
          {TABS.map(t => (
            <button key={t.id} onClick={() => navigate(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                text-sm font-medium transition-all
                ${tab === t.id
                  ? 'bg-ocean-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-navy-700'
                }`}>
              <t.icon size={15} className="flex-shrink-0" />
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-navy-700 flex-shrink-0">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
              text-sm text-slate-400 hover:text-rose-400
              hover:bg-rose-500/10 transition">
            <LogOut size={15} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Zone principale */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar mobile */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3
          bg-navy-800/90 border-b border-navy-700 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-white transition">
            <Menu size={20} />
          </button>
          <img src={logoUrl} alt="" className="w-6 h-6 object-contain" />
          <span className="text-sm font-semibold text-white truncate">
            {TABS.find(t => t.id === tab)?.label}
          </span>
        </header>

        <main className="flex-1 overflow-y-auto custom-scroll">
          <div className="h-full p-4 sm:p-6 max-w-4xl mx-auto">
            {tab === 'dashboard' && <Dashboard setTab={navigate} />}
            {tab === 'crew' && <CrewPage />}
            {tab === 'ships' && <ShipsPage />}
            {tab === 'crewlists' && !showForm && (
              <CrewListsPage
                onCreateNew={() => { setEditingList(null); setShowForm(true); }}
                onEditList={handleEditList}
              />
            )}
            {tab === 'crewlists' && showForm && (
              <CrewListPage
                editingList={editingList}
                onSaved={() => setShowForm(false)}
                onBack={() => setShowForm(false)}
              />
            )}
            {tab === 'checklist' && <ChecklistPage />}
            {tab === 'history' && <HistoryPage />}
            {tab === 'account' && <AccountPage />}
            {tab === 'data' && <DataPage />}
          </div>
        </main>
      </div>
    </div>
  );
}