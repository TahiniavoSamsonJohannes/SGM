// src/components/SearchBar.tsx
import { Search, X } from 'lucide-react';

interface Props {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
}

export default function SearchBar({
    value, onChange, placeholder = 'Rechercher...', className = '',
}: Props) {
    return (
        <div className={`relative flex-shrink-0 ${className}`}>
            <Search size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500
          pointer-events-none" />
            <input
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-navy-800 border border-navy-600 rounded-lg
          pl-9 pr-8 py-2 text-sm text-slate-200 placeholder-slate-500
          focus:outline-none focus:border-ocean-500 transition"
            />
            {/* Bouton vider — visible seulement quand il y a du texte */}
            {value && (
                <button
                    onClick={() => onChange('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2
            text-slate-500 hover:text-white transition p-0.5
            rounded"
                    title="Vider la recherche"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
}