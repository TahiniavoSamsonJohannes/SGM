import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, CheckSquare, Clock } from 'lucide-react';
import { db } from '../db';

export default function HistoryPage() {
    // Récupérer tous les exports puis trier en JS (robuste)
    const rawExports = useLiveQuery(() =>
        db.exportedFiles.toArray()
    ) ?? [];

    // Tri décroissant par date d'exportation en JS
    const exports = [...rawExports].sort((a, b) =>
        new Date(b.exportedAt).getTime() - new Date(a.exportedAt).getTime()
    ).slice(0, 50);

    const fmt = (d: Date) =>
        new Date(d).toLocaleString('fr-FR', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });

    return (
        <div className="h-full flex flex-col gap-4 overflow-hidden fade-in">

            {/* En-tête fixe */}
            <h1 className="text-xl font-bold font-display text-white flex-shrink-0">
                Historique des exports
            </h1>

            {/* Liste scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scroll space-y-2 pb-4">
                {exports.length === 0 ? (
                    <div className="bg-navy-800 border border-dashed border-navy-600
            rounded-xl p-10 text-center text-slate-500">
                        <Clock size={28} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm">Aucun fichier exporté</p>
                    </div>
                ) : (
                    exports.map(e => (
                        <div key={e.id}
                            className="bg-navy-800 border border-navy-600 rounded-xl p-4
                flex items-center gap-3 hover:border-navy-500 transition">
                            <div className={`flex-shrink-0 p-2 rounded-lg
                ${e.type === 'liste' ? 'bg-ocean-600/15' : 'bg-amber-500/15'}`}>
                                {e.type === 'liste'
                                    ? <FileText size={16} className="text-ocean-400" />
                                    : <CheckSquare size={16} className="text-amber-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-200 truncate">
                                    {e.filename}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                    {e.shipName} · {e.destination} · {e.membersCount} membres
                                </div>
                            </div>
                            <div className="text-xs text-slate-600 flex-shrink-0 text-right">
                                {fmt(e.exportedAt)}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}