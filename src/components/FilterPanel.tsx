import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, X, Check } from 'lucide-react';

export interface FilterOption {
    value: string;
    label: string;
}

export interface FilterGroup {
    key: string;
    label: string;
    options: FilterOption[];
    type: 'single' | 'multi';
}

interface Props {
    groups: FilterGroup[];
    values: Record<string, string | string[]>;
    onChange: (key: string, value: string | string[]) => void;
    onReset: () => void;
}

export default function FilterPanel({ groups, values, onChange, onReset }: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const hasActive = Object.values(values).some(v =>
        Array.isArray(v) ? v.length > 0 : v !== ''
    );

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm
          border transition
          ${hasActive
                        ? 'bg-ocean-600/20 border-ocean-500 text-ocean-400'
                        : 'bg-navy-800 border-navy-600 text-slate-400 hover:text-white hover:border-navy-500'
                    }`}
            >
                <SlidersHorizontal size={14} />
                Filtrer
                {hasActive && (
                    <span className="bg-ocean-500 text-white text-xs rounded-full
            w-4 h-4 flex items-center justify-center font-bold">
                        {Object.values(values).filter(v =>
                            Array.isArray(v) ? v.length > 0 : v !== ''
                        ).length}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-1 z-40 bg-navy-800
          border border-navy-600 rounded-xl shadow-2xl p-4 w-64 space-y-4 slide-down">

                    {groups.map(group => (
                        <div key={group.key}>
                            <div className="text-xs font-semibold text-slate-400 uppercase
                tracking-wider mb-2">
                                {group.label}
                            </div>
                            <div className="space-y-1">
                                {group.options.map(opt => {
                                    const current = values[group.key];
                                    const isActive = Array.isArray(current)
                                        ? current.includes(opt.value)
                                        : current === opt.value;

                                    return (
                                        <button
                                            key={opt.value}
                                            onClick={() => {
                                                if (group.type === 'single') {
                                                    onChange(group.key, isActive ? '' : opt.value);
                                                } else {
                                                    const arr = (Array.isArray(current) ? current : []) as string[];
                                                    onChange(group.key, isActive
                                                        ? arr.filter(v => v !== opt.value)
                                                        : [...arr, opt.value]
                                                    );
                                                }
                                            }}
                                            className={`w-full flex items-center justify-between
                        px-3 py-1.5 rounded-lg text-sm transition
                        ${isActive
                                                    ? 'bg-ocean-600/20 text-ocean-300'
                                                    : 'text-slate-300 hover:bg-navy-700'
                                                }`}
                                        >
                                            {opt.label}
                                            {isActive && <Check size={13} className="text-ocean-400" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={() => { onReset(); setOpen(false); }}
                        className="w-full flex items-center justify-center gap-2 text-xs
              text-slate-500 hover:text-rose-400 transition pt-2
              border-t border-navy-700"
                    >
                        <X size={12} /> Réinitialiser les filtres
                    </button>
                </div>
            )}
        </div>
    );
}