import { Phone, Mail, KeyRound } from 'lucide-react';
import logoUrl from '../assets/logo-ae.png';
import Input from '../components/Input';
import { useState } from 'react';
import { activateSubscription } from '../db';

interface Props {
    onActivated: () => void;  // abonnement activé → accès app
    onLogout: () => void;  // déconnexion
}

export default function SubscriptionExpired({ onActivated, onLogout }: Props) {
    const [subCode, setSubCode] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleActivate = async () => {
        if (!subCode.trim()) { setError('Entrez votre code d\'abonnement'); return; }
        setError('');
        setLoading(true);
        const res = await activateSubscription(subCode.trim());
        setLoading(false);
        if (res.ok) {
            setSuccess(`Abonnement activé (${res.type}) — accès autorisé`);
            setTimeout(() => onActivated(), 1500);
        } else {
            setError(res.message || 'Code invalide');
        }
    };

    return (
        <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-navy-800 border border-navy-600
        rounded-2xl shadow-2xl p-6 fade-in space-y-5">

                {/* En-tête */}
                <div className="text-center">
                    <img src={logoUrl} alt="Logo"
                        className="w-12 h-12 object-contain mx-auto mb-3 opacity-70" />
                    <h1 className="text-lg font-bold font-display text-white">
                        Abonnement requis
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Votre abonnement est inexistant ou expiré.
                        Contactez le développeur pour l'activer ou le renouveler.
                    </p>
                </div>

                {/* Contact développeur */}
                <div className="bg-navy-700 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Contact
                    </p>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Phone size={13} className="text-ocean-400 flex-shrink-0" />
                        +261 34 88 703 22
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-300 break-all">
                        <Mail size={13} className="text-ocean-400 flex-shrink-0" />
                        samsonjohannestahiniavo777@gmail.com
                    </div>
                </div>

                {/* Activation */}
                <div className="space-y-3">
                    <Input
                        label="Code d'abonnement"
                        placeholder="Collez votre code ici..."
                        value={subCode}
                        onChange={e => setSubCode(e.target.value)}
                    />
                    {error && <p className="text-rose-400 text-xs">{error}</p>}
                    {success && <p className="text-emerald-400 text-xs">{success}</p>}
                    <button
                        onClick={handleActivate}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2
              bg-ocean-600 hover:bg-ocean-500 disabled:opacity-50
              text-white py-2.5 rounded-lg text-sm font-medium transition"
                    >
                        <KeyRound size={14} />
                        {loading ? 'Activation...' : "Activer l'abonnement"}
                    </button>
                </div>

                {/* Déconnexion */}
                <button
                    onClick={onLogout}
                    className="w-full text-slate-500 hover:text-slate-300
            text-sm transition py-1"
                >
                    Se déconnecter
                </button>
            </div>
        </div>
    );
}