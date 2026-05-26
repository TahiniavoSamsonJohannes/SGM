import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
    value: string;
    label: string;
}

interface Props {
    label?: string;
    value: string;
    onChange: (v: string) => void;
    options: SelectOption[];
    placeholder?: string;
    className?: string;
}

export default function CustomSelect({
    label, value, onChange, options, placeholder = 'Sélectionner...', className = ''
}: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const selected = options.find(o => o.value === value);

    return (
        <div ref={ref} className={`relative ${className}`}>
            {label && (
                <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
            )}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2
          text-sm flex items-center justify-between gap-2
          focus:outline-none focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500
          transition hover:border-navy-500"
            >
                <span className={selected ? 'text-slate-200' : 'text-slate-500'}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown
                    size={14}
                    className={`text-slate-500 flex-shrink-0 transition-transform
            ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <ul className="absolute z-50 w-full mt-1 bg-navy-700 border border-navy-500
          rounded-lg shadow-2xl max-h-52 overflow-y-auto custom-scroll slide-down">
                    {options.length === 0 ? (
                        <li className="px-3 py-3 text-sm text-slate-500 text-center">
                            Aucune option
                        </li>
                    ) : options.map(o => (
                        <li
                            key={o.value}
                            onMouseDown={() => { onChange(o.value); setOpen(false); }}
                            className={`flex items-center justify-between px-3 py-2 text-sm
                cursor-pointer transition
                ${o.value === value
                                    ? 'bg-ocean-600/30 text-ocean-300'
                                    : 'text-slate-200 hover:bg-ocean-600/20'
                                }`}
                        >
                            {o.label}
                            {o.value === value && <Check size={13} className="text-ocean-400" />}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}