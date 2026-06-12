import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, CheckSquare, Clock, Trash2, FileSignature, Package } from 'lucide-react';
import { db, type ExportedFile } from '../db';
import ConfirmDialog from '../components/ConfirmDialog';
import { useDeleteAnimation } from '../hooks/useDeleteAnimation';
import SearchBar from '../components/SearchBar';

export default function HistoryPage() {
    const rawExports = useLiveQuery(() => db.exportedFiles.toArray()) ?? [];
    const [search, setSearch] = useState('');

    const { triggerDelete, isDeleting } = useDeleteAnimation(1300);
    const [clearConfirm, setClearConfirm] = useState(false);

    const TYPE_ICONS = {
        liste: { icon: FileText, color: 'text-ocean-400', bg: 'bg-ocean-600/15' },
        checklist: { icon: CheckSquare, color: 'text-amber-400', bg: 'bg-amber-500/15' },
        contrat: { icon: FileSignature, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
        manifeste: { icon: Package, color: 'text-purple-400', bg: 'bg-purple-500/15' },
    };

    // Fonction pour extraire la ligne d'info secondaire selon le type
    function getExportSubtitle(e: ExportedFile): string {
        switch (e.type) {
            case 'liste':
                return `${e.shipName} · ${e.destination} · ${e.membersCount} membres`;
            case 'checklist':
                return `${e.shipName} · ${e.membersCount} membres`;
            case 'contrat':
                return `${e.memberNom} · ${e.fonction}`;
            case 'manifeste':
                return `${e.shipName} · ${e.destination} · ${e.cargoCount} cargaison${e.cargoCount > 1 ? 's' : ''}`;
            default:
                return '';
        }
    }

    const deleteExport = async (id: number) => {
        await triggerDelete(id, () => db.exportedFiles.delete(id));
    };

    const clearAll = async () => {
        await db.exportedFiles.clear();
        setClearConfirm(false);
    };

    const exports = [...rawExports]
        .sort((a, b) =>
            new Date(b.exportedAt).getTime() - new Date(a.exportedAt).getTime()
        )
        .slice(0, 100);

    const filtered = exports.filter(e =>
        e.filename.toLowerCase().includes(search.toLowerCase())
    );

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
            {exports.length > 0 && (
                <button onClick={() => setClearConfirm(true)}
                    className="flex w-fit items-center self-end gap-1.5 text-xs text-rose-400
                    hover:text-rose-300 transition px-3 py-1.5 rounded-lg
                    hover:bg-rose-500/10 border border-rose-500/20">
                    <Trash2 size={13} /> Tout supprimer
                </button>
            )}

            {/* Recherche */}
            <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Rechercher par nom, fascicule..."
            />
            {/* Total */}
            <p className="text-xs text-slate-500 flex-shrink-0">
                {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
                {search ? ` sur ${rawExports.length}` : ''}
            </p>

            {/* Liste scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scroll space-y-2 pb-4">
                {filtered.length === 0 ? (
                    <div className="bg-navy-800 border border-dashed border-navy-600
            rounded-xl p-10 text-center text-slate-500">
                        <Clock size={28} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm">
                            {search ? 'Aucun résultat' : 'Aucun fichier exporté'}
                        </p>
                    </div>
                ) : (

                    filtered.map(e => {
                        const typeInfo = TYPE_ICONS[e.type] ?? TYPE_ICONS.liste;
                        const Icon = typeInfo.icon;
                        return (
                            <div key={e.id}
                                className={`bg-navy-800 border border-navy-600 rounded-xl p-4
                                flex items-center gap-3 hover:border-navy-500 transition
                                ${isDeleting(e.id!) ? 'item-deleting' : 'item-enter'}`}
                            >
                                <div className={`flex-shrink-0 p-2 rounded-lg ${typeInfo.bg}`}>
                                    <Icon size={16} className={typeInfo.color} />
                                </div>
                                <div className="flex-1 flex flex-col items-start sm:flex-row sm:justify-between sm:items-center min-w-0 truncate">
                                    <div className='min-w-0 w-full'>
                                        <div className="text-sm font-medium text-slate-200 truncate">
                                            {e.filename}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                                            {getExportSubtitle(e)}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-600 text-right truncate sm:flex-shrink-0">
                                        Exporté le {fmt(e.exportedAt)}
                                    </div>
                                </div>
                                <div className="flex items-center flex-shrink-0">
                                    <button
                                        onClick={() => deleteExport(e.id!)}
                                        className="text-slate-500 hover:text-rose-400 transition p-1">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })

                )}
            </div>
            <ConfirmDialog
                open={clearConfirm}
                title="Vider l'historique"
                message="Supprimer tous les exports de l'historique ? Irréversible."
                confirmLabel="Tout supprimer" danger
                onConfirm={clearAll}
                onCancel={() => setClearConfirm(false)}
            />
        </div>
    );
}