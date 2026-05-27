import { useState, useCallback, useEffect } from 'react';
import { Copy, Check, Phone, Mail, ArrowLeft } from 'lucide-react';
import { setupAccount, generateMachineCode, activateSubscription, getAuthConfig } from '../db';
import PinKeypad, { PinDots } from '../components/PinKeypad';
import Input from '../components/Input';
import logoUrl from '../assets/logo-ae.png';

const MAX_PIN = 8;

// Clés localStorage pour persistance temporaire
const LS_EMAIL = 'ae_setup_email';
const LS_STEP = 'ae_setup_step';

type Step = 'email' | 'pin' | 'confirm' | 'machine';

interface Props {
    onDone: () => void;
    initialStep?: Step;   // permet de démarrer à l'étape machine
}

export default function SetupFlow({ onDone, initialStep = 'email' }: Props) {
    const [step, setStep] = useState<Step>(() => {
        // Restaurer l'étape depuis localStorage si disponible
        return (localStorage.getItem(LS_STEP) as Step) || initialStep;
    });
    const [email, setEmail] = useState(() =>
        localStorage.getItem(LS_EMAIL) || ''
    );
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [machineCode, setMachineCode] = useState('');
    const [subCode, setSubCode] = useState('');
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');   // jamais d'erreur initiale
    const [subResult, setSubResult] = useState('');
    const [loading, setLoading] = useState(false);

    // Persister email dans localStorage
    useEffect(() => {
        if (email) localStorage.setItem(LS_EMAIL, email);
    }, [email]);

    // Persister étape dans localStorage
    useEffect(() => {
        localStorage.setItem(LS_STEP, step);
    }, [step]);

    // Si on démarre à l'étape machine (depuis LoginPin), charger le machine code existant
    useEffect(() => {
        if (initialStep === 'machine') {
            getAuthConfig().then(config => {
                if (config?.machineCode) setMachineCode(config.machineCode);
            });
        }
    }, [initialStep]);

    // ── Navigation arrière ──────────────────────────────────────────────
    const goBack = () => {
        setError('');
        if (step === 'pin') { setStep('email'); return; }
        if (step === 'confirm') { setPin(''); setConfirmPin(''); setStep('pin'); return; }
        if (step === 'machine') { setStep('email'); return; }
    };

    const canGoBack = step !== 'email' && initialStep !== 'machine';

    // ── Email ────────────────────────────────────────────────────────────
    const handleEmailNext = () => {
        if (!email.includes('@') || !email.includes('.')) {
            setError('Adresse email invalide'); return;
        }
        setError('');
        setStep('pin');
    };

    // ── PIN ──────────────────────────────────────────────────────────────
    const handlePinKey = useCallback(async (k: string) => {
        setError(''); // effacer l'erreur à chaque frappe
        const isConfirm = step === 'confirm';
        const current = isConfirm ? confirmPin : pin;
        const setter = isConfirm ? setConfirmPin : setPin;

        if (k === 'DEL') {
            setter(current.slice(0, -1));
            return;
        }

        if (k === 'OK') {
            // Valider uniquement à la soumission
            if (current.length < MAX_PIN) {
                setError(`Le PIN doit contenir exactement ${MAX_PIN} chiffres`);
                return;
            }

            if (step === 'pin') {
                setConfirmPin('');
                setStep('confirm');
                return;
            }

            // Confirmation
            if (current !== pin) {
                // Revenir à la création du PIN
                setError('Les PIN ne correspondent pas — recommencez');
                setPin('');
                setConfirmPin('');
                setTimeout(() => setStep('pin'), 800);
                return;
            }

            // Créer le compte
            setLoading(true);
            try {
                const mc = await generateMachineCode(email);
                setMachineCode(mc);
                await setupAccount(email, pin, mc);
                // Nettoyer localStorage
                localStorage.removeItem(LS_EMAIL);
                localStorage.removeItem(LS_STEP);
                setStep('machine');
            } catch {
                setError('Erreur lors de la création du compte');
            } finally {
                setLoading(false);
            }
            return;
        }

        // Chiffre : ajouter seulement si longueur < MAX
        if (current.length < MAX_PIN) setter(current + k);
    }, [step, pin, confirmPin, email]);

    // ── Copier ────────────────────────────────────────────────────────────
    const copyCode = () => {
        navigator.clipboard.writeText(machineCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    // ── Activer abonnement ────────────────────────────────────────────────
    const handleActivate = async () => {
        if (!subCode.trim()) { setError("Entrez votre code d'abonnement"); return; }
        setError('');
        const res = await activateSubscription(subCode.trim());
        if (res.ok) {
            setSubResult(`Abonnement activé : ${res.type}`);
            setTimeout(() => onDone(), 1500);
        } else {
            setError(res.message || 'Code invalide');
        }
    };

    const currentPin = step === 'confirm' ? confirmPin : pin;

    const stepLabels: Record<Step, string> = {
        email: initialStep === 'machine' ? '' : 'Étape 1 / 4 — Email',
        pin: 'Étape 2 / 4 — Création du PIN',
        confirm: 'Étape 3 / 4 — Confirmation du PIN',
        machine: 'Activation de l\'abonnement',
    };

    return (
        <div className="max-h-screen bg-navy-900 flex items-start justify-center p-4 overflow-y-auto custom-scroll">
            <div className="w-full max-w-sm bg-navy-800 border border-navy-600
        rounded-2xl shadow-2xl p-6 fade-in">

                {/* En-tête */}
                <div className="text-center mb-5 relative">
                    {canGoBack && (
                        <button
                            onClick={goBack}
                            className="absolute left-0 top-0 text-slate-400 hover:text-white
                transition p-1"
                        >
                            <ArrowLeft size={18} />
                        </button>
                    )}
                    <img src={logoUrl} alt="Logo"
                        className="w-12 h-12 object-contain mx-auto mb-2" />
                    <h1 className="text-lg font-bold font-display text-white">
                        Armement Eustratiou
                    </h1>
                    {stepLabels[step] && (
                        <p className="text-xs text-slate-500 mt-1">{stepLabels[step]}</p>
                    )}
                </div>

                {/* ── Étape 1 : Email ── */}
                {step === 'email' && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-300 text-center">
                            Entrez votre adresse email
                        </p>
                        <Input
                            label="Email"
                            type="email"
                            value={email}
                            onChange={e => { setEmail(e.target.value); setError(''); }}
                            placeholder="votre@email.com"
                            onKeyDown={e => e.key === 'Enter' && handleEmailNext()}
                        />
                        {error && <p className="text-rose-400 text-xs text-center">{error}</p>}
                        <button onClick={handleEmailNext}
                            className="w-full bg-ocean-600 hover:bg-ocean-500 text-white
                py-2.5 rounded-lg text-sm font-medium transition">
                            Continuer
                        </button>
                    </div>
                )}

                {/* ── Étapes 2 & 3 : PIN ── */}
                {(step === 'pin' || step === 'confirm') && (
                    <div>
                        <p className="text-sm text-slate-300 text-center mb-1">
                            {step === 'pin'
                                ? `Créez votre code PIN (${MAX_PIN} chiffres)`
                                : 'Confirmez votre code PIN'}
                        </p>
                        <PinDots value={currentPin} max={MAX_PIN} />
                        {/* Erreur uniquement après tentative, jamais au chargement */}
                        {error && (
                            <p className="text-rose-400 text-xs text-center mb-2">{error}</p>
                        )}
                        {loading ? (
                            <div className="flex justify-center py-6">
                                <div className="w-6 h-6 border-2 border-ocean-500
                  border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : (
                            <PinKeypad onKey={handlePinKey} />
                        )}
                        <p className="text-xs text-slate-600 text-center mt-3">
                            Clavier physique supporté
                        </p>
                    </div>
                )}

                {/* ── Étape 4 : Machine code ── */}
                {step === 'machine' && (
                    <div className="space-y-4">
                        {/* Code machine — une ligne scrollable */}
                        <div className="bg-navy-700 rounded-xl p-4 space-y-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Votre code machine
                            </p>
                            <div className="bg-navy-900 rounded-lg px-3 py-2.5
                overflow-x-auto custom-scroll"
                                style={{ whiteSpace: 'nowrap' }}>
                                <span className="font-mono text-xs text-ocean-400">
                                    {machineCode}
                                </span>
                            </div>
                            <button onClick={copyCode}
                                className="w-full flex items-center justify-center gap-2
                  bg-navy-600 hover:bg-navy-500 text-white py-2
                  rounded-lg text-sm transition">
                                {copied
                                    ? <><Check size={14} className="text-emerald-400" /> Copié !</>
                                    : <><Copy size={14} /> Copier le code</>}
                            </button>
                        </div>

                        {/* Contact */}
                        <div className="bg-navy-700/60 rounded-xl p-3 space-y-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Contact pour activer l'abonnement
                            </p>
                            <div className="flex items-center gap-2 text-xs text-slate-300">
                                <Phone size={11} className="text-ocean-400 flex-shrink-0" />
                                +261 34 88 703 22
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-300 break-all">
                                <Mail size={11} className="text-ocean-400 flex-shrink-0" />
                                samsonjohannestahiniavo777@gmail.com
                            </div>
                        </div>

                        {/* Code abonnement */}
                        <div className="space-y-2">
                            <Input
                                label="Code d'abonnement"
                                placeholder="Collez votre code ici..."
                                value={subCode}
                                onChange={e => { setSubCode(e.target.value); setError(''); }}
                            />
                            {error && <p className="text-rose-400 text-xs">{error}</p>}
                            {subResult && <p className="text-emerald-400 text-xs">{subResult}</p>}
                            <button onClick={handleActivate}
                                className="w-full bg-ocean-600 hover:bg-ocean-500 text-white
                  py-2.5 rounded-lg text-sm font-medium transition">
                                Activer l'abonnement
                            </button>
                            <button onClick={onDone}
                                className="w-full text-slate-500 hover:text-slate-300 py-2 text-sm transition">
                                Ignorer pour l'instant
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}