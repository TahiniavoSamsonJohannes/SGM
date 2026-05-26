import { useState, useEffect, useRef } from 'react';

interface Props {
    value: string;
    onChange: (v: string) => void;
    suggestions: string[];
    placeholder?: string;
    className?: string;
}

export default function AutoComplete({ value, onChange, suggestions, placeholder, className = '' }: Props) {
    const [open, setOpen] = useState(false);
    const [filtered, setFiltered] = useState<string[]>([]);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setFiltered(
            value.trim()
                ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s !== value)
                : suggestions.slice(0, 8)
        );
    }, [value, suggestions]);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <div ref={ref} className="relative">
            <input
                value={value}
                onChange={e => { onChange(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                placeholder={placeholder}
                className={`w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm
          text-slate-200 placeholder-slate-500 focus:outline-none focus:border-ocean-500
          focus:ring-1 focus:ring-ocean-500 transition ${className}`}
            />
            {open && filtered.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-navy-700 border border-navy-500 rounded-lg
          shadow-2xl max-h-44 overflow-y-auto">
                    {filtered.map(s => (
                        <li
                            key={s}
                            onMouseDown={() => { onChange(s); setOpen(false); }}
                            className="px-3 py-2 text-sm text-slate-200 hover:bg-ocean-600/50 cursor-pointer transition"
                        >
                            {s}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}