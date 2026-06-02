import { useState, useCallback } from 'react';
import { verifyPin } from '../db';
import PinKeypad, { PinDots } from '../components/PinKeypad';
import logoUrl from '../assets/logo-ae.png';

const MAX = 8;

interface Props {
    onSuccess: () => void;
    onImportAccount: () => void;
    onGoToActivation: () => void; // ← retour vers SetupFlow étape machine
}

export default function LoginPin({
    onSuccess,
    onImportAccount,
    onGoToActivation,
}: Props) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [shake, setShake] = useState(false);

    const handleKey = useCallback(async (k: string) => {
        setError('');
        if (k === 'DEL') { setPin(p => p.slice(0, -1)); return; }
        if (k === 'OK') {
            if (pin.length < MAX) { setError('PIN incomplet'); return; }
            const ok = await verifyPin(pin);
            if (ok) { onSuccess(); return; }
            setError('Code PIN incorrect');
            setShake(true);
            setPin('');
            setTimeout(() => setShake(false), 500);
            return;
        }
        if (pin.length < MAX) setPin(p => p + k);
    }, [pin, onSuccess]);

    return (
        <div className="max-h-screen w-screen bg-navy-900 flex justify-center p-4 overflow-y-scroll scrollbar-hide-mobile">
            <div className={`h-fit w-full max-w-xs bg-navy-800 border border-navy-600
        rounded-2xl p-6 sm:p-8 shadow-2xl text-center
        ${shake ? 'animate-bounce' : ''} fade-in`}>

                <img src={logoUrl} alt="Logo"
                    className="w-12 h-12 sm:w-14 sm:h-14 object-contain mx-auto mb-4" />
                <h1 className="text-lg sm:text-xl font-bold font-display text-white">
                    Armement Eustratiou
                </h1>
                <p className="text-sm text-slate-400 mt-1">Connexion</p>

                <PinDots value={pin} max={MAX} />
                {error && <p className="text-rose-400 text-xs mb-1">{error}</p>}

                <PinKeypad onKey={handleKey} />

                {/* Séparateur */}
                <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-navy-700" />
                    <span className="text-xs text-slate-600">ou</span>
                    <div className="flex-1 h-px bg-navy-700" />
                </div>

                {/* Actions secondaires */}
                <div className="space-y-2">
                    <button
                        onClick={onGoToActivation}
                        className="w-full text-sm text-ocean-400 hover:text-ocean-300
              hover:underline transition"
                    >
                        Renouveler / Activer mon abonnement
                    </button>
                    <button
                        onClick={onImportAccount}
                        className="w-full text-sm text-slate-500 hover:text-slate-300
              hover:underline transition"
                    >
                        Vous avez déjà un compte ?
                    </button>
                </div>
            </div>
        </div>
    );
}