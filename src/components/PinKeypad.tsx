import { useEffect } from 'react';
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
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key >= '0' && e.key <= '9') onKey(e.key);
            else if (e.key === 'Backspace') onKey('DEL');
            else if (e.key === 'Enter') onKey('OK');
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onKey]);

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'OK'];

    return (
        <div className="grid grid-cols-3 gap-2 mt-4 w-full max-w-xs mx-auto">
            {keys.map(k => (
                <button
                    key={k}
                    type="button"
                    onClick={() => onKey(k)}
                    className={`
            flex items-center justify-center
            py-3 rounded-xl text-base font-semibold
            transition-all active:scale-95 select-none
            ${k === 'OK'
                            ? 'bg-ocean-600 hover:bg-ocean-500 text-white'
                            : k === 'DEL'
                                ? 'bg-navy-600 hover:bg-navy-500 text-slate-300'
                                : 'bg-navy-700 hover:bg-navy-600 text-slate-200'
                        }
          `}
                >
                    {k === 'DEL' ? <Delete size={18} /> :
                        k === 'OK' ? <Check size={18} /> :
                            k}
                </button>
            ))}
        </div>
    );
}