import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Users, FileText, Ship,
  History, UserCircle, LogOut, Menu, FileSignature,
} from 'lucide-react';
import {
  seedDynamicValues, isFirstLaunch,
  isSubscriptionActive, type CrewList,
} from './db';
import type { TabId } from './types';

import SetupFlow from './auth/SetupFlow';
import LoginPin from './auth/LoginPin';
import ImportAccount from './auth/ImportAccount';

import Dashboard from './pages/Dashboard';
import CrewPage from './pages/CrewPage';
import ShipsPage from './pages/ShipsPage';
import CrewListsPage from './pages/CrewListsPage';
import CrewListPage from './pages/CrewListPage';
import HistoryPage from './pages/HistoryPage';
import AccountPage from './pages/AccountPage';
import DataPage from './pages/DataPage';
import ContractsPage from './pages/ContractsPage';

import logoUrl from './assets/logo-ae.png';
import ConfirmDialog from './components/ConfirmDialog';
import ActivationPage from './pages/ActivationPage';
import LoadingScreen from './components/LoadingScreen';
import { modalRegistry } from './hooks/useModalRegistry';

const TABS = [
  { id: 'dashboard' as TabId, label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'crew' as TabId, label: 'Équipage', icon: Users },
  { id: 'ships' as TabId, label: 'Navires', icon: Ship },
  { id: 'crewlists' as TabId, label: "Listes d'équipage", icon: FileText },
  { id: 'contracts' as TabId, label: 'Contrats', icon: FileSignature },
  { id: 'history' as TabId, label: 'Historique exports', icon: History },
  { id: 'account' as TabId, label: 'Mon compte', icon: UserCircle },
];

type AuthState =
  | 'loading'
  | 'setup'
  | 'login'
  | 'import-account-from-setup'   // ← depuis SetupFlow
  | 'import-account-from-login'   // ← depuis LoginPin
  | 'activation'
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
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const LS_TAB = "ae_active_tab";

  // Ajouter ces refs au début du composant App
  const sidebarOpenRef = useRef(sidebarOpen);
  const tabRef = useRef(tab);
  const authStateRef = useRef(authState);


  const navigate = (id: TabId) => {
    if (id !== 'crewlists') { setEditingList(null); setShowForm(false); }
    setTab(id);
    localStorage.setItem(LS_TAB, id);
    setSidebarOpen(false);
  };

  // Synchroniser les refs à chaque render
  useEffect(() => { sidebarOpenRef.current = sidebarOpen; }, [sidebarOpen]);
  useEffect(() => { tabRef.current = tab; }, [tab]);
  useEffect(() => { authStateRef.current = authState; }, [authState]);

  // Refs stables pour les setters (ne changent jamais)
  const setSidebarOpenRef = useRef(setSidebarOpen);
  const navigateRef = useRef(navigate);
  const setShowLogoutConfirmRef = useRef(setShowLogoutConfirm);

  // Mettre à jour les refs setters si les fonctions changent
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);
  useEffect(() => {
    setShowLogoutConfirmRef.current = setShowLogoutConfirm;
  }, [setShowLogoutConfirm]);

  // ── Un seul useEffect pour le bouton Retour ───────────────────────
  useEffect(() => {
    // Pousser l'état initial
    window.history.pushState({ ae: true }, '', window.location.href);

    const handlePopState = () => {
      // Repousser IMMÉDIATEMENT pour la prochaine interception
      window.history.pushState({ ae: true }, '', window.location.href);

      // P1 : modal ouvert → le fermer
      if (modalRegistry.closeTopmost()) return;

      // P2 : sidebar ouverte sur mobile
      if (sidebarOpenRef.current) {
        setSidebarOpenRef.current(false);
        return;
      }

      // P3 : page ≠ dashboard
      if (tabRef.current !== 'dashboard') {
        navigateRef.current('dashboard');
        return;
      }

      // P4 : déjà sur dashboard → confirmation déconnexion
      setShowLogoutConfirmRef.current(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);

  }, []);

  useEffect(() => {
    async function init() {
      console.log('init start');
      
      await seedDynamicValues();
      const first = await isFirstLaunch();
      if (first) {
        console.log('first init');
        setAuthState('setup');
        return;
      }
      // ── Vérifier si une session active existe ──
      const sessionActive = sessionStorage.getItem(SESSION_KEY) === 'true';
      if (sessionActive) {
        // Vérifier que l'abonnement est toujours valide
        const active = await isSubscriptionActive();
        if (active) {
          const active_tab = localStorage.getItem(LS_TAB);
          if (!active_tab)
            setTab('dashboard');
          else
            setTab(active_tab as TabId);

          setAuthState('ok');
        } else {
          sessionStorage.removeItem(SESSION_KEY);
          setAuthState('activation');
        }
        return;
      }
      setAuthState('login');
    }
    init();
  }, []);



  // ── Après connexion PIN réussie ──
  const handleLoginSuccess = async () => {
    const active = await isSubscriptionActive();
    if (active) {
      setAuthState('loading');
      sessionStorage.setItem(SESSION_KEY, 'true');
      // Délai de transition
      setTimeout(() => {
        setAuthState('ok');
        setTab('dashboard');
      }, 2000);
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      setTimeout(() => setAuthState('activation'), 0);
    }
  };

  // ── Déconnexion avec confirmation
  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    sessionStorage.removeItem(SESSION_KEY);
    setSidebarOpen(false);
    setAuthState('logging-out');
    setTimeout(() => {
      setTab('dashboard');
      setAuthState('login');
    }, 2000);
  };

  const handleEditList = (list: CrewList) => {
    setEditingList(list);
    setShowForm(true);
    setTab('crewlists');
    setSidebarOpen(false);
  };

  // ── Écrans auth
  if (authState === 'loading') return (
    <LoadingScreen message="Chargement..." />
  );

  if (authState === 'logging-out') return (
    <LoadingScreen message="Déconnexion..." />
  );

  if (authState === 'setup')
    return (
      <SetupFlow
        onAccountCreated={() => setAuthState('activation')}
        onHasAccount={() => setAuthState('import-account-from-setup')}
      />
    );

  if (authState === 'activation')
    return (
      <ActivationPage
        onDone={() => { setAuthState('loading'); setTimeout(() => setAuthState('login'), 2000) }}
        onGoToLogin={() => setAuthState('login')}
      />
    );

  if (authState === 'import-account-from-setup')
    return (
      <ImportAccount
        onImported={() => { setAuthState('loading'); setTimeout(() => setAuthState('login'), 2000) }}
        onBack={() => setAuthState('setup')}          // ← retour vers SetupFlow
      />
    );

  if (authState === 'import-account-from-login')
    return (
      <ImportAccount
        onImported={() => { setAuthState('loading'); setTimeout(() => setAuthState('login'), 2000) }}
        onBack={() => setAuthState('login')}           // ← retour vers LoginPin
      />
    );

  if (authState === 'login')
    return (
      <LoginPin
        onSuccess={handleLoginSuccess}
        onImportAccount={() => setAuthState('import-account-from-login')}
        onGoToActivation={() => setAuthState('activation')}
      />
    );


  // ── App shell ─────────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen flex bg-navy-900 overflow-hidden">

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

        <main className="flex-1 overflow-y-auto custom-scroll pb-safe">
          <div className="p-4 sm:p-6 max-w-4xl mx-auto">
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
            {tab === 'contracts' && <ContractsPage />}
            {tab === 'history' && <HistoryPage />}
            {tab === 'account' && <AccountPage />}
            {tab === 'data' && <DataPage />}
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={showLogoutConfirm || showExitConfirm}
        title="Déconnexion"
        message="Voulez-vous vous déconnecter ?"
        confirmLabel="Se déconnecter"
        cancelLabel="Annuler"
        danger
        onConfirm={confirmLogout}
        onCancel={() => { setShowLogoutConfirm(false); setShowExitConfirm(false) }}
      />
    </div>
  );
}