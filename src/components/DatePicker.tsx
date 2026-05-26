import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, ChevronDown } from 'lucide-react';

interface Props {
    label?: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}

const MONTHS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const DAYS_SHORT = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

type PickerMode = 'calendar' | 'month' | 'year';

export default function DatePicker({
    label, value, onChange, placeholder = 'Sélectionner...'
}: Props) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<PickerMode>('calendar');
    const parsed = value ? new Date(value + 'T00:00:00') : null;
    const [view, setView] = useState(() => {
        const d = parsed ?? new Date();
        return { year: d.getFullYear(), month: d.getMonth() };
    });
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false); setMode('calendar');
            }
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const displayValue = parsed
        ? `${String(parsed.getDate()).padStart(2, '0')} ${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}`
        : '';

    // Grille calendrier
    const firstDow = new Date(view.year, view.month, 1).getDay();
    const offset = firstDow === 0 ? 6 : firstDow - 1;
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

    const selectDay = (day: number) => {
        const iso = `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onChange(iso);
        setOpen(false);
        setMode('calendar');
    };

    const isSelected = (day: number) =>
        parsed?.getFullYear() === view.year &&
        parsed?.getMonth() === view.month &&
        parsed?.getDate() === day;

    const isToday = (day: number) => {
        const t = new Date();
        return t.getFullYear() === view.year && t.getMonth() === view.month && t.getDate() === day;
    };

    // Liste des années (100 ans en arrière, 10 en avant)
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 111 }, (_, i) => currentYear - 100 + i);

    return (
        <div ref={ref} className="relative">
            {label && (
                <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
            )}

            <button
                type="button"
                onClick={() => { setOpen(o => !o); setMode('calendar'); }}
                className="w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2
          text-sm text-left flex items-center justify-between
          focus:outline-none focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 transition"
            >
                <span className={displayValue ? 'text-slate-200' : 'text-slate-500'}>
                    {displayValue || placeholder}
                </span>
                <Calendar size={14} className="text-slate-500 flex-shrink-0" />
            </button>

            {open && (
                <div className="absolute z-50 mt-1 bg-navy-700 border border-navy-500
          rounded-xl shadow-2xl p-3 w-64 slide-down">

                    {/* ── Mode calendrier ── */}
                    {mode === 'calendar' && (
                        <>
                            {/* Navigation mois/an */}
                            <div className="flex items-center justify-between mb-2">
                                <button
                                    onClick={() => {
                                        const d = new Date(view.year, view.month - 1, 1);
                                        setView({ year: d.getFullYear(), month: d.getMonth() });
                                    }}
                                    className="text-slate-400 hover:text-white transition p-1"
                                >
                                    <ChevronLeft size={15} />
                                </button>

                                <div className="flex items-center gap-1">
                                    {/* Bouton mois */}
                                    <button
                                        onClick={() => setMode('month')}
                                        className="flex items-center gap-1 text-sm font-semibold
                      text-slate-200 hover:text-ocean-400 transition px-1 py-0.5 rounded"
                                    >
                                        {MONTHS[view.month]}
                                        <ChevronDown size={12} />
                                    </button>
                                    {/* Bouton année */}
                                    <button
                                        onClick={() => setMode('year')}
                                        className="flex items-center gap-1 text-sm font-semibold
                      text-slate-200 hover:text-ocean-400 transition px-1 py-0.5 rounded"
                                    >
                                        {view.year}
                                        <ChevronDown size={12} />
                                    </button>
                                </div>

                                <button
                                    onClick={() => {
                                        const d = new Date(view.year, view.month + 1, 1);
                                        setView({ year: d.getFullYear(), month: d.getMonth() });
                                    }}
                                    className="text-slate-400 hover:text-white transition p-1"
                                >
                                    <ChevronRight size={15} />
                                </button>
                            </div>

                            {/* Jours semaine */}
                            <div className="grid grid-cols-7 mb-1">
                                {DAYS_SHORT.map(d => (
                                    <div key={d} className="text-center text-xs text-slate-500 py-1">{d}</div>
                                ))}
                            </div>

                            {/* Grille jours */}
                            <div className="grid grid-cols-7 gap-0.5">
                                {cells.map((day, i) => (
                                    <div key={i}>
                                        {day ? (
                                            <button
                                                onClick={() => selectDay(day)}
                                                className={`w-full text-xs py-1.5 rounded transition font-mono
                          ${isSelected(day)
                                                        ? 'bg-ocean-600 text-white font-bold'
                                                        : isToday(day)
                                                            ? 'bg-navy-600 text-ocean-400 font-semibold'
                                                            : 'text-slate-300 hover:bg-navy-600'
                                                    }`}
                                            >
                                                {day}
                                            </button>
                                        ) : <div />}
                                    </div>
                                ))}
                            </div>

                            {value && (
                                <button
                                    onClick={() => { onChange(''); setOpen(false); }}
                                    className="mt-2 w-full text-xs text-slate-500 hover:text-rose-400 transition text-center"
                                >
                                    Effacer
                                </button>
                            )}
                        </>
                    )}

                    {/* ── Mode sélection mois ── */}
                    {mode === 'month' && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-slate-200">
                                    Choisir le mois
                                </span>
                                <button onClick={() => setMode('calendar')}
                                    className="text-xs text-slate-500 hover:text-white transition">
                                    Retour
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                                {MONTHS.map((m, i) => (
                                    <button
                                        key={m}
                                        onClick={() => { setView(v => ({ ...v, month: i })); setMode('calendar'); }}
                                        className={`text-xs py-2 rounded-lg transition
                      ${view.month === i
                                                ? 'bg-ocean-600 text-white'
                                                : 'text-slate-300 hover:bg-navy-600'
                                            }`}
                                    >
                                        {m.slice(0, 3)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Mode sélection année ── */}
                    {mode === 'year' && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-slate-200">
                                    Choisir l'année
                                </span>
                                <button onClick={() => setMode('calendar')}
                                    className="text-xs text-slate-500 hover:text-white transition">
                                    Retour
                                </button>
                            </div>
                            <div className="max-h-48 overflow-y-auto custom-scroll">
                                <div className="grid grid-cols-3 gap-1">
                                    {years.map(y => (
                                        <button
                                            key={y}
                                            onClick={() => { setView(v => ({ ...v, year: y })); setMode('calendar'); }}
                                            className={`text-xs py-2 rounded-lg transition font-mono
                        ${view.year === y
                                                    ? 'bg-ocean-600 text-white'
                                                    : 'text-slate-300 hover:bg-navy-600'
                                                }`}
                                        >
                                            {y}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}