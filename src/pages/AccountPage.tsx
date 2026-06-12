import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    KeyRound, ShieldCheck, User, ChevronRight,
    ArrowLeft, Database,
    Check,
    Copy,
    Phone,
    Mail,
} from 'lucide-react';
import { db, changePin, activateSubscription } from '../db';
import Input from '../components/Input';

type SubPage = 'main' | 'pin' | 'subscription' | 'data';

// Import lazy des sous-pages
import DataPage from './DataPage';

export default function AccountPage() {
    const [subPage, setSubPage] = useState<SubPage>('main');
    const config = useLiveQuery(() => db.authConfig.toCollection().first());
    const scrollRef = useRef<HTMLDivElement>(null);

    // Scroller vers le haut à chaque changement de sous-page
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
        // Aussi scroller le conteneur parent (main)
        const main = document.querySelector('main');
        if (main) main.scrollTop = 0;
    }, [subPage]);

    const subLabel: Record<string, string> = {
        test: 'Test (5 min)',
        monthly: '1 mois',
        yearly: '1 an',
    };

    const fmt = (d: Date | null | undefined) => d
        ? new Date(d).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric',
        })
        : '—';

    const isActive = config?.subscriptionEnd
        ? new Date() < new Date(config.subscriptionEnd)
        : false;

    // ── Sous-page : Modifier PIN ──────────────────────────────────────
    if (subPage === 'pin') return <ChangePinPage onBack={() => setSubPage('main')} />;

    // ── Sous-page : Renouveler abonnement ─────────────────────────────
    if (subPage === 'subscription')
        return <RenewSubscriptionPage onBack={() => setSubPage('main')} />;

    // ── Sous-page : Données ───────────────────────────────────────────
    if (subPage === 'data') return (
        <div className="space-y-4 fade-in">
            <div className="flex items-center gap-3">
                <button onClick={() => setSubPage('main')}
                    className="text-slate-400 hover:text-white transition p-1">
                    <ArrowLeft size={18} />
                </button>
                <h1 className="text-xl font-bold font-display text-white">
                    Données & Sauvegarde
                </h1>
            </div>
            <DataPage />
        </div>
    );

    // ── Page principale Mon compte ────────────────────────────────────
    return (
        <div ref={scrollRef} className="space-y-5 fade-in max-w-lg">
            <h1 className="text-xl font-bold font-display text-white">Mon compte</h1>

            {/* Infos compte */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-navy-700">
                    <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider
            flex items-center gap-2">
                        <User size={13} className="text-ocean-400" /> Informations
                    </h2>
                </div>
                <div className="px-5 py-4">
                    <div className="text-sm">
                        <span className="text-slate-500">Email : </span>
                        <span className="text-slate-200">{config?.email || '—'}</span>
                    </div>
                </div>
            </div>

            {/* Abonnement */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-navy-700">
                    <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider
            flex items-center gap-2">
                        <ShieldCheck size={13} className="text-ocean-400" /> Abonnement
                    </h2>
                </div>
                <div className="px-5 py-4 space-y-3">
                    {config?.subscriptionType ? (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-navy-700 rounded-lg p-3">
                                <div className="text-xs text-slate-500 mb-1">Type</div>
                                <div className="text-slate-200">
                                    {subLabel[config.subscriptionType] || config.subscriptionType}
                                </div>
                            </div>
                            <div className="bg-navy-700 rounded-lg p-3">
                                <div className="text-xs text-slate-500 mb-1">Statut</div>
                                <div className={`text-sm font-medium ${isActive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {isActive && <div className="relative inline-flex mr-1 w-fit items-center justify-center">
                                        {/* Pulsation */}
                                        <span className="absolute inline-flex h-2 w-2 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full bg-green-400 opacity-75" />
                                        {/* Cercle principal */}
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                                    </div>}
                                    {isActive ? 'Actif' : 'Expiré'}
                                </div>
                            </div>
                            <div className="bg-navy-700 rounded-lg p-3">
                                <div className="text-xs text-slate-500 mb-1">Début</div>
                                <div className="text-slate-200 text-xs">
                                    {fmt(config.subscriptionStart)}
                                </div>
                            </div>
                            <div className="bg-navy-700 rounded-lg p-3">
                                <div className="text-xs text-slate-500 mb-1">Expiration</div>
                                <div className={`text-xs font-medium
                  ${isActive ? 'text-slate-200' : 'text-rose-400'}`}>
                                    {fmt(config.subscriptionEnd)}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500">Aucun abonnement actif</p>
                    )}
                </div>
            </div>

            {/* Menu liens */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden">
                {[
                    {
                        icon: ShieldCheck, label: 'Renouveler / Activer l\'abonnement',
                        color: 'text-ocean-400', action: () => setSubPage('subscription'),
                    },
                    {
                        icon: KeyRound, label: 'Modifier le code PIN',
                        color: 'text-amber-400', action: () => setSubPage('pin'),
                    },
                    {
                        icon: Database, label: 'Données & Sauvegarde',
                        color: 'text-emerald-400', action: () => setSubPage('data'),
                    },
                ].map((item, i, arr) => (
                    <button
                        key={item.label}
                        onClick={item.action}
                        className={`w-full flex items-center justify-between px-5 py-4
              hover:bg-navy-700 transition
              ${i < arr.length - 1 ? 'border-b border-navy-700' : ''}`}
                    >
                        <div className="flex items-center gap-3">
                            <item.icon size={16} className={item.color} />
                            <span className="text-sm text-slate-200">{item.label}</span>
                        </div>
                        <ChevronRight size={15} className="text-slate-600" />
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Sous-composant : Modifier PIN ─────────────────────────────────────────────
function ChangePinPage({ onBack }: { onBack: () => void }) {
    const [oldPin, setOldPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

    const handle = async () => {
        if (!oldPin || !newPin || !confirmPin) {
            setMsg({ text: 'Remplissez tous les champs', ok: false }); return;
        }
        if (newPin.length < 8) {
            setMsg({ text: 'PIN minimum 8 chiffres', ok: false }); return;
        }
        if (newPin !== confirmPin) {
            setMsg({ text: 'Les nouveaux PIN ne correspondent pas', ok: false }); return;
        }
        const ok = await changePin(oldPin, newPin);
        setMsg(ok
            ? { text: 'PIN modifié avec succès', ok: true }
            : { text: 'Ancien PIN incorrect', ok: false }
        );
        if (ok) { setOldPin(''); setNewPin(''); setConfirmPin(''); }
        setTimeout(() => setMsg(null), 3000);
    };

    return (
        <div className="space-y-5 fade-in max-w-sm">
            <div className="flex items-center gap-3">
                <button onClick={onBack}
                    className="text-slate-400 hover:text-white transition p-1">
                    <ArrowLeft size={18} />
                </button>
                <h1 className="text-xl font-bold font-display text-white">
                    Modifier le PIN
                </h1>
            </div>
            <div className="bg-navy-800 border border-navy-600 rounded-xl p-5 space-y-4">
                <Input label="Ancien PIN" type="password" value={oldPin}
                    onChange={e => setOldPin(e.target.value)} placeholder="••••••••" />
                <Input label="Nouveau PIN (8 chiffres)" type="password" value={newPin}
                    onChange={e => setNewPin(e.target.value)} placeholder="••••••••" />
                <Input label="Confirmer le nouveau PIN" type="password" value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value)} placeholder="••••••••" />
                {msg && (
                    <p className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {msg.text}
                    </p>
                )}
                <button onClick={handle}
                    className="w-full bg-ocean-600 hover:bg-ocean-500 text-white
            py-2.5 rounded-lg text-sm font-medium transition">
                    Modifier le PIN
                </button>
            </div>
        </div>
    );
}

// ── Sous-composant : Renouveler abonnement ────────────────────────────────────
function RenewSubscriptionPage({ onBack }: { onBack: () => void }) {
    const config = useLiveQuery(() => db.authConfig.toCollection().first());
    const [subCode, setSubCode] = useState('');
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const copyCode = () => {
        if (!config?.machineCode) return;
        navigator.clipboard.writeText(config.machineCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handle = async () => {
        if (!subCode.trim()) { setMsg({ text: 'Entrez un code', ok: false }); return; }
        setLoading(true);
        const res = await activateSubscription(subCode.trim());
        setLoading(false);
        setMsg(res.ok
            ? { text: `Abonnement activé : ${res.type}`, ok: true }
            : { text: res.message || 'Code invalide', ok: false }
        );
        setTimeout(() => setMsg(null), 4000);
    };

    return (
        <div className="space-y-5 fade-in max-w-sm">
            <div className="flex items-center gap-3">
                <button onClick={onBack}
                    className="text-slate-400 hover:text-white transition p-1">
                    <ArrowLeft size={18} />
                </button>
                <h1 className="text-xl font-bold font-display text-white">
                    Renouveler l'abonnement
                </h1>
            </div>

            {/* Machine code */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Votre code machine
                </p>
                <div
                    className="bg-navy-900 rounded-lg px-3 py-2.5
            overflow-x-auto custom-scroll"
                    style={{ whiteSpace: 'nowrap' }}
                >
                    <span className="font-mono text-xs text-ocean-400">
                        {config?.machineCode || '—'}
                    </span>
                </div>
                <button
                    onClick={copyCode}
                    className="w-full flex items-center justify-center gap-2
            bg-navy-700 hover:bg-navy-600 text-white py-2
            rounded-lg text-sm transition"
                >
                    {copied
                        ? <><Check size={14} className="text-emerald-400" /> Copié !</>
                        : <><Copy size={14} /> Copier</>
                    }
                </button>
            </div>

            {/* Contact */}
            <div className="bg-navy-700/60 border border-navy-600 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Contactez-nous
                </p>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Phone size={11} className="text-ocean-400 flex-shrink-0" />
                    +261 34 88 703 22
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300 break-all">
                    <Mail size={11} className="text-ocean-400 flex-shrink-0" />
                    samsonjohannestahiniavo777@gmail.com
                </div>
            </div>

            {/* Saisie code */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl p-4 space-y-3">
                <Input
                    label="Code d'abonnement"
                    placeholder="Collez votre code ici..."
                    value={subCode}
                    onChange={e => { setSubCode(e.target.value); setMsg(null); }}
                />
                {msg && (
                    <p className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {msg.text}
                    </p>
                )}
                <button
                    onClick={handle}
                    disabled={loading}
                    className="w-full bg-ocean-600 hover:bg-ocean-500 disabled:opacity-50
            text-white py-2.5 rounded-lg text-sm font-medium transition"
                >
                    {loading ? 'Activation...' : "Activer l'abonnement"}
                </button>
            </div>
        </div>
    );
}