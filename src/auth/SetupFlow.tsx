import { useState, useCallback, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { setupAccount, generateMachineCode } from '../db';
import PinKeypad, { PinDots } from '../components/PinKeypad';
import Input from '../components/Input';
import logoUrl from '../assets/logo-ae.png';

const MAX_PIN = 8;
const LS_EMAIL = 'ae_setup_email';

type Step = 'email' | 'pin' | 'confirm';

interface Props {
    onAccountCreated: () => void;  // ← appelé après création du compte, ouvre ActivationPage
    onHasAccount?: () => void;
}

export default function SetupFlow({ onAccountCreated, onHasAccount }: Props) {
    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState(() =>
        localStorage.getItem(LS_EMAIL) || ''
    );
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Persister l'email
    useEffect(() => {
        if (email) localStorage.setItem(LS_EMAIL, email);
    }, [email]);

    // ── Retour arrière (uniquement entre email et pin) ─────────────
    const canGoBack = step === 'pin';  // confirm ne peut plus revenir après validation

    const goBack = () => {
        setError('');
        if (step === 'pin') { setPin(''); setStep('email'); }
    };

    // ── Email ──────────────────────────────────────────────────────
    const handleEmailNext = () => {
        if (!email.includes('@') || !email.includes('.')) {
            setError('Adresse email invalide'); return;
        }
        setError('');
        setStep('pin');
    };

    // ── PIN ────────────────────────────────────────────────────────
    const handlePinKey = useCallback(async (k: string) => {
        setError('');
        const isConfirm = step === 'confirm';
        const current = isConfirm ? confirmPin : pin;
        const setter = isConfirm ? setConfirmPin : setPin;

        if (k === 'DEL') { setter(current.slice(0, -1)); return; }

        if (k === 'OK') {
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
                setError('Les PIN ne correspondent pas — recommencez');
                setPin('');
                setConfirmPin('');
                setTimeout(() => setStep('pin'), 800);
                return;
            }

            // ── Compte créé → ActivationPage directement ───────────────
            setLoading(true);
            try {
                const mc = await generateMachineCode(email);
                await setupAccount(email, pin, mc);
                // Nettoyer localStorage
                localStorage.removeItem(LS_EMAIL);
                // Plus de retour possible — passer à ActivationPage
                onAccountCreated();
            } catch {
                setError('Erreur lors de la création du compte');
            } finally {
                setLoading(false);
            }
            return;
        }

        if (current.length < MAX_PIN) setter(current + k);
    }, [step, pin, confirmPin, email, onAccountCreated]);

    const currentPin = step === 'confirm' ? confirmPin : pin;

    const stepLabels: Record<Step, string> = {
        email: 'Étape 1 / 3 — Email',
        pin: 'Étape 2 / 3 — Création du PIN',
        confirm: 'Étape 3 / 3 — Confirmation du PIN',
    };

    return (
        <div className="max-h-screen w-screen bg-navy-900 flex justify-center p-4 overflow-y-scroll scrollbar-hide-mobile pb-safe">
            <div className="h-fit w-full max-w-sm bg-navy-800 border border-navy-600 rounded-2xl shadow-2xl p-6 fade-in">
                {/* En-tête */}
                <div className="text-center mb-5 relative">
                    {/* Retour uniquement sur l'étape PIN (pas confirm) */}
                    {canGoBack && (
                        <button onClick={goBack}
                            className="absolute left-0 top-0 text-slate-400
                hover:text-white transition p-1">
                            <ArrowLeft size={18} />
                        </button>
                    )}
                    <img src={logoUrl} alt="Logo"
                        className="w-12 h-12 object-contain mx-auto mb-2" />
                    <h1 className="text-lg font-bold font-display text-white">
                        Armement Eustratiou
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">{stepLabels[step]}</p>
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
                        {error && (
                            <p className="text-rose-400 text-xs text-center">{error}</p>
                        )}
                        <button onClick={handleEmailNext}
                            className="w-full bg-ocean-600 hover:bg-ocean-500 text-white
                py-2.5 rounded-lg text-sm font-medium transition">
                            Continuer
                        </button>

                        {/* Lien compte existant */}
                        {onHasAccount && (
                            <div className="text-center">
                                <button onClick={onHasAccount}
                                    className="text-sm text-ocean-400 hover:text-ocean-300
                    hover:underline transition">
                                    Vous avez déjà un compte ?
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Étapes 2 & 3 : PIN ── */}
                {(step === 'pin' || step === 'confirm') && (
                    <div>
                        <p className="text-sm text-slate-300 text-center mb-1">
                            {step === 'pin'
                                ? `Créez votre code PIN (${MAX_PIN} chiffres)`
                                : 'Confirmez votre code PIN'
                            }
                        </p>
                        <PinDots value={currentPin} max={MAX_PIN} />
                        {error && (
                            <p className="text-rose-400 text-xs text-center mb-2">
                                {error}
                            </p>
                        )}
                        {loading ? (
                            <div className="flex justify-center py-6">
                                <div className="w-6 h-6 border-2 border-ocean-500
                  border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : (
                            <PinKeypad onKey={handlePinKey} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}