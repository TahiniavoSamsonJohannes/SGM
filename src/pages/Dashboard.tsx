import { useLiveQuery } from 'dexie-react-hooks';
import { Users, FileText, CheckSquare } from 'lucide-react';
import { db } from '../db';
import logoUrl from '../assets/logo-ae.png';
import type { TabId } from '../types';
import { fmtDateTime } from '../utils/fmtDate';

export default function Dashboard({ setTab }: { setTab: (t: TabId) => void }) {
    const crewCount = useLiveQuery(() => db.crewMembers.count()) ?? 0;
    const shipCount = useLiveQuery(() => db.ships.count()) ?? 0;
    const listCount = useLiveQuery(() => db.crewLists.count()) ?? 0;
    const checkCount = useLiveQuery(() => db.checklistDocs.count()) ?? 0;
    const recent = useLiveQuery(() => db.crewLists.orderBy('updatedAt').reverse().limit(3).toArray()) ?? [];

    const stats = [
        { icon: Users, label: "Membres d'équipage", value: crewCount, tab: 'crew', color: 'text-ocean-400' },
        { icon: FileText, label: 'Navires', value: shipCount, tab: 'ships', color: 'text-emerald-400' },
        { icon: FileText, label: "Listes d'équipage", value: listCount, tab: 'crewlists', color: 'text-amber-400' },
        { icon: CheckSquare, label: 'Checklists', value: checkCount, tab: 'checklist', color: 'text-rose-400' },
    ];

    return (
        <div className="space-y-8 fade-in">
            {/* Hero */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-700
        to-navy-900 border border-navy-600 p-6 sm:p-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-ocean-500/5 rounded-full
          -translate-y-1/2 translate-x-1/2" />
                <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain mb-4" />
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-white mb-2">
                    Armement Eustratiou
                </h1>
                <p className="text-slate-400 text-sm">Système de Gestion Maritime</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {stats.map((s, i) => (
                    <button key={i} onClick={() => setTab(s.tab as TabId)}
                        className="bg-navy-800 border border-navy-600 rounded-xl p-4 sm:p-5 text-left
              hover:border-ocean-500 hover:bg-navy-700 transition group">
                        <s.icon className={`${s.color} mb-3 group-hover:scale-110 transition-transform`} size={22} />
                        <div className="text-2xl font-bold text-white font-mono">{s.value}</div>
                        <div className="text-xs text-slate-400 mt-1 leading-tight">{s.label}</div>
                    </button>
                ))}
            </div>

            {/* Listes récentes */}
            {recent.length === 0 ? (
                <div className="bg-navy-800 border border-dashed border-navy-600
    rounded-xl p-8 text-center text-slate-500">
                    <FileText size={28} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Aucune liste créée</p>
                    <button onClick={() => setTab('crewlists')}
                        className="mt-3 text-ocean-400 text-sm hover:underline">
                        Créer une première liste →
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {recent.map(l => (
                        <div key={l.id}
                            className="bg-navy-800 border border-navy-600 rounded-xl p-4
          hover:border-navy-500 transition cursor-pointer"
                            onClick={() => setTab('crewlists')}
                        >
                            {/* Nom navire */}
                            <div className="font-medium text-slate-200 text-sm truncate">
                                {l.shipName.toUpperCase()}
                            </div>
                            {/* Capitaine */}
                            {l.capitaine && (
                                <div className="text-xs text-slate-400 mt-0.5 truncate">
                                    Cap. {l.capitaine}
                                </div>
                            )}
                            {/* Départ → Destination */}
                            <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-2">
                                {l.lieuDepart && <span>Départ : {l.lieuDepart}</span>}
                                {l.destination && <span>Destination : {l.destination}</span>}
                                <span>{l.members.length} membres</span>
                            </div>
                            {/* Dates */}
                            <div className="text-xs text-slate-600 mt-1.5 space-y-0.5">
                                <div>Créée le : {fmtDateTime(l.createdAt)}</div>
                                <div>Modifiée le : {fmtDateTime(l.updatedAt)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}