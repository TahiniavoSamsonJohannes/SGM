import { useState, useEffect, useCallback } from 'react';
import PinKeypad, { PinDots } from './PinKeypad';

interface Props {
    maxLength?: number;
    onConfirm: (pin: string) => void;
    onCancel: () => void;
    error?: string;
    loading?: boolean;
    title?: string;
    description?: string;
}

export default function PinKeypadModal({
    maxLength = 8,
    onConfirm,
    onCancel,
    error,
    loading,
    description,
}: Props) {
    const [pin, setPin] = useState('');

    // Reset à chaque montage
    useEffect(() => { setPin(''); }, []);

    const handleKey = useCallback((k: string) => {
        if (k === 'DEL') {
            setPin(p => p.slice(0, -1));
            return;
        }
        if (k === 'OK') {
            if (pin.length >= 4) onConfirm(pin);
            return;
        }
        if (pin.length < maxLength) {
            setPin(p => p + k);
        }
    }, [pin, maxLength, onConfirm]);

    // Clavier physique
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key >= '0' && e.key <= '9') handleKey(e.key);
            else if (e.key === 'Backspace') handleKey('DEL');
            else if (e.key === 'Enter') handleKey('OK');
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [handleKey]);

    return (
        <div className="flex flex-col items-center gap-4 py-2">
            {description && (
                <p className="text-xs text-slate-400 text-center max-w-xs">
                    {description}
                </p>
            )}

            {/* Points PIN */}
            <PinDots value={pin} max={maxLength} />

            {/* Message d'erreur */}
            {error && (
                <p className="text-rose-400 text-xs text-center animate-fade-in">
                    {error}
                </p>
            )}

            {/* Keypad */}
            {loading ? (
                <div className="flex justify-center py-4">
                    <div className="w-6 h-6 border-2 border-ocean-500
            border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <PinKeypad onKey={handleKey} />
            )}

            {/* Annuler */}
            <button
                onClick={onCancel}
                className="text-sm text-slate-500 hover:text-slate-300 transition"
            >
                Annuler
            </button>
        </div>
    );
}