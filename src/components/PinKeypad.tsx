import { useEffect, useRef } from 'react';
import { Delete, Check } from 'lucide-react';

interface Props {
    onKey: (k: string) => void;
}

export function PinDots({ value, max }: { value: string; max: number }) {
    return (
        <div className="flex gap-3 justify-center my-5">
            {Array.from({ length: max }).map((_, i) => (
                <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${i < value.length
                            ? 'bg-ocean-400 border-ocean-400 scale-110'
                            : 'border-slate-600 bg-transparent'
                        }`}
                />
            ))}
        </div>
    );
}

export default function PinKeypad({ onKey }: Props) {
    // Support clavier physique
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key >= '0' && e.key <= '9') onKey(e.key);
            else if (e.key === 'Backspace') onKey('DEL');
            else if (e.key === 'Enter') onKey('OK');
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onKey]);

    // Long clic sur DEL
    const delIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const delTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const startLongDel = () => {
        // Démarrer après 400ms de maintien
        delTimeoutRef.current = setTimeout(() => {
            delIntervalRef.current = setInterval(() => {
                onKey('DEL');
            }, 80);
        }, 400);
    };

    const stopLongDel = () => {
        if (delTimeoutRef.current) { clearTimeout(delTimeoutRef.current); delTimeoutRef.current = null; }
        if (delIntervalRef.current) { clearInterval(delIntervalRef.current); delIntervalRef.current = null; }
    };

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'OK'];

    return (
        <div className="grid grid-cols-3 gap-2 mt-4 w-full max-w-xs mx-auto">
            {keys.map(k => {
                const isDel = k === 'DEL';
                const isOk = k === 'OK';

                return (
                    <button
                        key={k}
                        type="button"
                        onClick={() => onKey(k)}
                        // Long clic uniquement sur DEL
                        onMouseDown={isDel ? startLongDel : undefined}
                        onMouseUp={isDel ? stopLongDel : undefined}
                        onMouseLeave={isDel ? stopLongDel : undefined}
                        onTouchStart={isDel ? startLongDel : undefined}
                        onTouchEnd={isDel ? stopLongDel : undefined}
                        className={`
              flex items-center justify-center
              py-3 rounded-xl text-base font-semibold
              transition-all active:scale-95 select-none
              ${isOk
                                ? 'bg-ocean-600 hover:bg-ocean-500 text-white'
                                : isDel
                                    ? 'bg-navy-600 hover:bg-navy-500 text-slate-300'
                                    : 'bg-navy-700 hover:bg-navy-600 text-slate-200'
                            }
            `}
                    >
                        {isDel ? <Delete size={18} /> :
                            isOk ? <Check size={18} /> :
                                k}
                    </button>
                );
            })}
        </div>
    );
}