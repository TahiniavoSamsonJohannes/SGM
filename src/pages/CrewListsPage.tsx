import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    Plus, Edit3, Trash2, Download, FileText, Search,
} from 'lucide-react';
import { db, type CrewList } from '../db';
import { generateCrewListPDF } from '../pdfGenerator';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { fmtDateTime } from '../utils/fmtDate';

interface Props {
    onCreateNew: () => void;
    onEditList: (list: CrewList) => void;
}

// Formate l'id en 10 chiffres avec zéros à gauche
function formatId(id: number | undefined): string {
    return String(id ?? 0).padStart(10, '0');
}

export default function CrewListsPage({ onCreateNew, onEditList }: Props) {
    // Récupérer toutes les listes, tri décroissant par updatedAt en JS
    const rawLists = useLiveQuery(() => db.crewLists.toArray()) ?? [];
    const lists = [...rawLists].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    const [search, setSearch] = useState('');
    const [viewing, setViewing] = useState<CrewList | null>(null);
    const [deleting, setDeleting] = useState<CrewList | null>(null);

    const confirmDelete = async () => {
        if (deleting?.id) await db.crewLists.delete(deleting.id);
        setDeleting(null);
    };

    const filtered = lists.filter(l =>
        l.shipName.toLowerCase().includes(search.toLowerCase()) ||
        l.destination.toLowerCase().includes(search.toLowerCase()) ||
        l.lieuDepart.toLowerCase().includes(search.toLowerCase()) ||
        l.capitaine.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col gap-4 overflow-hidden fade-in">

            {/* ── En-tête fixe ── */}
            <div className="flex items-center justify-between flex-shrink-0">
                <h1 className="text-xl font-bold font-display text-white">
                    Listes d'équipage
                </h1>
                <button
                    onClick={onCreateNew}
                    className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-500
            text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                    <Plus size={15} /> Nouvelle liste
                </button>
            </div>

            {/* ── Recherche fixe ── */}
            <div className="relative flex-shrink-0">
                <Search size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher par navire, destination, capitaine..."
                    className="w-full bg-navy-800 border border-navy-600 rounded-lg pl-9 pr-3
            py-2 text-sm text-slate-200 placeholder-slate-500
            focus:outline-none focus:border-ocean-500 transition"
                />
            </div>

            {/* ── Liste scrollable ── */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scroll space-y-2 pb-4">
                {filtered.length === 0 ? (
                    <div className="bg-navy-800 border border-dashed border-navy-600
            rounded-xl p-10 text-center text-slate-500">
                        <FileText size={28} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm">
                            {search ? 'Aucune liste trouvée' : 'Aucune liste créée'}
                        </p>
                        {!search && (
                            <button
                                onClick={onCreateNew}
                                className="mt-3 text-ocean-400 text-sm hover:underline"
                            >
                                Créer la première liste →
                            </button>
                        )}
                    </div>
                ) : filtered.map(l => (
                    <div
                        key={l.id}
                        onClick={() => setViewing(l)}
                        className="bg-navy-800 border border-navy-600 rounded-xl p-4
              hover:border-navy-500 transition cursor-pointer"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">

                                {/* Numéro identifiant + Nom navire */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs text-slate-600 bg-navy-700
                    px-2 py-0.5 rounded flex-shrink-0">
                                        #{formatId(l.id)}
                                    </span>
                                    <span className="font-semibold text-slate-200 text-sm truncate">
                                        {l.shipName.toUpperCase()}
                                    </span>
                                </div>

                                {/* Capitaine */}
                                {l.capitaine && (
                                    <div className="text-xs text-slate-400 mt-1 truncate">
                                        Cap. {l.capitaine}
                                    </div>
                                )}

                                {/* Départ + Destination */}
                                <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3">
                                    {l.lieuDepart && (
                                        <span>Départ : {l.lieuDepart}</span>
                                    )}
                                    {l.destination && (
                                        <span>Destination : {l.destination}</span>
                                    )}
                                    <span>{l.members.length} membre{l.members.length > 1 ? 's' : ''}</span>
                                </div>

                                {/* Dates avec heure */}
                                <div className="text-xs text-slate-600 mt-1.5 space-y-0.5">
                                    <div>Créée le : {fmtDateTime(l.createdAt)}</div>
                                    <div>Modifiée le : {fmtDateTime(l.updatedAt)}</div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div
                                className="flex gap-1 flex-shrink-0"
                                onClick={e => e.stopPropagation()}
                            >
                                <button
                                    onClick={() => onEditList(l)}
                                    title="Modifier"
                                    className="text-slate-400 hover:text-amber-400 transition p-1.5"
                                >
                                    <Edit3 size={15} />
                                </button>
                                <button
                                    onClick={() => generateCrewListPDF(l)}
                                    title="Exporter PDF"
                                    className="text-slate-400 hover:text-ocean-400 transition p-1.5"
                                >
                                    <Download size={15} />
                                </button>
                                <button
                                    onClick={() => setDeleting(l)}
                                    className="text-slate-400 hover:text-rose-400 transition p-1.5"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Modal détails ── */}
            <Modal
                open={!!viewing}
                onClose={() => setViewing(null)}
                title={`Liste #${formatId(viewing?.id)}`}
                maxWidth="max-w-lg"
            >
                {viewing && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            {([
                                ['Réf. interne', `#${formatId(viewing.id)}`],
                                ['Navire', viewing.shipName.toUpperCase()],
                                ['Capitaine', viewing.capitaine],
                                ['Lieu de départ', viewing.lieuDepart],
                                ['Destination', viewing.destination],
                                ['Réf. dossier', viewing.referDossier],
                                ['Créée le', fmtDateTime(viewing.createdAt)],
                                ['Modifiée le', fmtDateTime(viewing.updatedAt)],
                            ] as [string, string][])
                                .filter(([, v]) => v)
                                .map(([k, v]) => (
                                    <div key={k} className="bg-navy-700 rounded-lg p-3">
                                        <div className="text-xs text-slate-500 mb-1">{k}</div>
                                        <div className="text-slate-200 text-sm break-words">{v}</div>
                                    </div>
                                ))
                            }
                        </div>

                        {/* Membres */}
                        <div>
                            <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                                Membres ({viewing.members.length})
                            </div>
                            <div className="space-y-1 max-h-40 overflow-y-auto custom-scroll pr-1">
                                {viewing.members.map((m, i) => (
                                    <div key={i} className="flex gap-2 text-xs text-slate-400 py-0.5">
                                        <span className="text-slate-600 w-5 flex-shrink-0 text-right">
                                            {i + 1}.
                                        </span>
                                        <span className="text-slate-300 truncate">
                                            {m.nom.toUpperCase()} {m.prenom}
                                        </span>
                                        <span className="text-slate-500 ml-auto flex-shrink-0">
                                            {m.fonction}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => { setViewing(null); onEditList(viewing); }}
                                className="flex items-center gap-2 bg-navy-700 hover:bg-navy-600
                  text-white px-4 py-2 rounded-lg text-sm border border-navy-500
                  transition"
                            >
                                <Edit3 size={14} /> Modifier
                            </button>
                            <button
                                onClick={() => generateCrewListPDF(viewing)}
                                className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-500
                  text-white px-4 py-2 rounded-lg text-sm transition"
                            >
                                <Download size={14} /> PDF
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── Confirmation suppression ── */}
            <ConfirmDialog
                open={!!deleting}
                title="Supprimer la liste"
                message={`Supprimer la liste #${formatId(deleting?.id)} de "${deleting?.shipName}" ? Cette action est irréversible.`}
                confirmLabel="Supprimer"
                danger
                onConfirm={confirmDelete}
                onCancel={() => setDeleting(null)}
            />
        </div>
    );
}