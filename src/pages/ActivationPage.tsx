import { useState, useEffect } from 'react';
import { Copy, Check, Phone, Mail } from 'lucide-react';
import {
    getAuthConfig, generateMachineCode,
    activateSubscription, db,
} from '../db';
import Input from '../components/Input';
import logoUrl from '../assets/logo-ae.png';

interface Props {
    onDone: () => void;
    onGoToLogin: () => void;
}

export default function ActivationPage({ onDone, onGoToLogin }: Props) {
    const [machineCode, setMachineCode] = useState('');
    const [subCode, setSubCode] = useState('');
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(true);

    // Charger le machine code existant ou en générer un nouveau
    useEffect(() => {
        async function load() {
            try {
                const config = await getAuthConfig();
                if (config?.machineCode) {
                    setMachineCode(config.machineCode);
                } else if (config?.email) {
                    // Régénérer le machine code pour cet appareil
                    const mc = await generateMachineCode(config.email);
                    setMachineCode(mc);
                    // Mettre à jour en base
                    if (config.id) {
                        await db.authConfig.update(config.id, {
                            machineCode: mc,
                            updatedAt: new Date(),
                        });
                    }
                }
            } catch {
                setError('Erreur lors du chargement du compte');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const copyCode = () => {
        if (!machineCode) return;
        navigator.clipboard.writeText(machineCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleActivate = async () => {
        if (!subCode.trim()) { setError('Entrez votre code d\'abonnement'); return; }
        setError('');
        const res = await activateSubscription(subCode.trim());
        if (res.ok) {
            setSuccess(`Abonnement activé (${res.type}) — redirection...`);
            setTimeout(() => onDone(), 1500);
        } else {
            setError(res.message || 'Code invalide');
        }
    };

    return (
        <div className="max-h-screen w-screen bg-navy-900 flex justify-center p-4 overflow-y-scroll scrollbar-hide-mobile pb-safe">
            <div className="h-fit w-full max-w-sm bg-navy-800 border border-navy-600 rounded-2xl shadow-2xl p-6 fade-in space-y-5">
                {/* En-tête — sans bouton retour */}
                <div className="text-center">
                    <img src={logoUrl} alt="Logo"
                        className="w-12 h-12 object-contain mx-auto mb-3" />
                    <h1 className="text-lg font-bold font-display text-white">
                        Armement Eustratiou
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Activation de l'abonnement
                    </p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="w-6 h-6 border-2 border-ocean-500
              border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Machine code */}
                        <div className="bg-navy-700 rounded-xl p-4 space-y-3">
                            <p className="text-xs font-semibold text-slate-400
                uppercase tracking-wider">
                                Votre code machine
                            </p>
                            <div className="bg-navy-900 rounded-lg px-3 py-2.5
                overflow-x-auto custom-scroll"
                                style={{ whiteSpace: 'nowrap' }}>
                                <span className="font-mono text-xs text-ocean-400">
                                    {machineCode || '—'}
                                </span>
                            </div>
                            <button onClick={copyCode}
                                className="w-full flex items-center justify-center gap-2
                  bg-navy-600 hover:bg-navy-500 text-white py-2
                  rounded-lg text-sm transition">
                                {copied
                                    ? <><Check size={14} className="text-emerald-400" /> Copié !</>
                                    : <><Copy size={14} /> Copier</>
                                }
                            </button>
                        </div>

                        {/* Contact */}
                        <div className="bg-navy-700 rounded-xl p-4 space-y-2">
                            <p className="text-xs font-semibold text-slate-400
                uppercase tracking-wider mb-2">
                                Contactez-nous
                            </p>
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <Phone size={13} className="text-ocean-400 flex-shrink-0" />
                                +261 34 88 703 22
                            </div>
                            <div className="flex items-center gap-2 text-sm
                text-slate-300 break-all">
                                <Mail size={13} className="text-ocean-400 flex-shrink-0" />
                                samsonjohannestahiniavo777@gmail.com
                            </div>
                        </div>

                        {/* Code abonnement */}
                        <div className="space-y-3">
                            <Input
                                label="Code d'abonnement"
                                placeholder="Collez votre code ici..."
                                value={subCode}
                                onChange={e => { setSubCode(e.target.value); setError(''); }}
                            />
                            {error && <p className="text-rose-400    text-xs">{error}</p>}
                            {success && <p className="text-emerald-400 text-xs">{success}</p>}
                            <button onClick={handleActivate}
                                className="w-full bg-ocean-600 hover:bg-ocean-500 text-white
                  py-2.5 rounded-lg text-sm font-medium transition">
                                Activer l'abonnement
                            </button>
                        </div>

                        {/* Aller à la connexion (pas "retour") */}
                        <button onClick={onGoToLogin}
                            className="w-full text-slate-500 hover:text-slate-300
                text-sm transition text-center py-1">
                            Aller à la connexion
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}