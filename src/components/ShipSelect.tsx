import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { Ship } from '../db';

interface Props {
    label?: string;
    value: string;       // shipId (string)
    onChange: (id: string) => void;
    ships: Ship[];
    placeholder?: string;
    error?: string;
}

export default function ShipSelect({
    label, value, onChange, ships, placeholder = 'Sélectionner...', error,
}: Props) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Initialiser le query depuis la valeur courante
    useEffect(() => {
        if (value) {
            const ship = ships.find(s => String(s.id) === value);
            if (ship) setQuery(ship.nom.toUpperCase());
        } else {
            setQuery('');
        }
    }, [value, ships]);

    // Fermeture au clic extérieur
    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
                // Restaurer le nom affiché si une valeur est sélectionnée
                if (value) {
                    const ship = ships.find(s => String(s.id) === value);
                    if (ship) setQuery(ship.nom.toUpperCase());
                } else {
                    setQuery('');
                }
            }
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [value, ships]);

    const filtered = ships.filter(s =>
        s.nom.toUpperCase().includes(query.toUpperCase()) ||
        s.immatriculation.toUpperCase().includes(query.toUpperCase())
    );

    return (
        <div ref={ref} className="relative">
            {label && (
                <label className="block text-xs font-medium text-slate-400 mb-1">
                    {label}
                </label>
            )}

            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={e => {
                        setQuery(e.target.value);
                        setOpen(true);
                        // Si l'utilisateur efface, désélectionner
                        if (!e.target.value.trim()) onChange('');
                    }}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    className={`w-full bg-navy-800 border rounded-lg px-3 py-2 pr-8 text-sm
            text-slate-200 placeholder-slate-500 focus:outline-none
            focus:ring-1 focus:ring-ocean-500 transition
            ${error ? 'border-rose-500' : 'border-navy-600 focus:border-ocean-500'}`}
                />
                <ChevronDown
                    size={14}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500
            transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </div>

            {error && <p className="text-rose-400 text-xs mt-1">{error}</p>}

            {open && filtered.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-navy-700 border border-navy-500
          rounded-lg shadow-2xl max-h-48 overflow-y-auto custom-scroll slide-down">
                    {filtered.map(s => (
                        <li
                            key={s.id}
                            onMouseDown={() => {
                                onChange(String(s.id));
                                setQuery(s.nom.toUpperCase());
                                setOpen(false);
                            }}
                            className={`flex items-center justify-between px-3 py-2.5
                text-sm cursor-pointer transition
                ${String(s.id) === value
                                    ? 'bg-ocean-600/20 text-ocean-300'
                                    : 'text-slate-200 hover:bg-ocean-600/20'
                                }`}
                        >
                            <span>
                                <span className="font-medium">{s.nom.toUpperCase()}</span>
                                {s.immatriculation && (
                                    <span className="text-slate-500 ml-2 text-xs">
                                        {s.immatriculation}
                                    </span>
                                )}
                            </span>
                            {String(s.id) === value && (
                                <Check size={13} className="text-ocean-400 flex-shrink-0" />
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}