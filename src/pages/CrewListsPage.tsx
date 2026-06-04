import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    Plus, Edit3, Trash2, Download, FileText,
    Search, CheckSquare, Eye,
} from 'lucide-react';
import { db, enrichCrewListMembers, type CrewList } from '../db';
import {
    generateCrewListPDF, previewCrewListPDF,
    generateChecklistPDF, previewChecklistPDF,
} from '../pdfGenerator';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import PdfPreviewModal from '../components/PdfPreviewModal';
import { fmtDateTime } from '../utils/fmt';

interface Props {
    onCreateNew: () => void;
    onEditList: (list: CrewList) => void;
}

function formatId(id: number | undefined): string {
    return String(id ?? 0).padStart(10, '0');
}

// Helper : construit la liste avec membres complets
async function buildFullList(l: CrewList) {
    const fullMembers = await enrichCrewListMembers(
        l.members.map(m => ({ id: m.id!, nom: m.nom, prenom: m.prenom }))
    );
    return { ...l, members: fullMembers };
}

// Helper : construit la checklist avec membres complets 
async function buildChecklistData(l: CrewList, ships: { id?: number; nom: string; immatriculation: string }[]) {
    const ship = ships.find(s => s.id === l.shipId);
    const fullMembers = await enrichCrewListMembers(
        l.members.map(m => ({ id: m.id!, nom: m.nom, prenom: m.prenom }))
    );
    return {
        crewListId: l.id!,
        shipName: l.shipName,
        immatriculation: ship?.immatriculation ?? '',
        destination: l.destination,
        referDossier: l.referDossier,
        members: fullMembers,
        createdAt: new Date(),
    };
}

export default function CrewListsPage({ onCreateNew, onEditList }: Props) {
    const rawLists = useLiveQuery(() => db.crewLists.toArray()) ?? [];
    const ships = useLiveQuery(() => db.ships.toArray()) ?? [];

    const lists = [...rawLists].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    const [search, setSearch] = useState('');
    const [viewing, setViewing] = useState<CrewList | null>(null);
    const [deleting, setDeleting] = useState<CrewList | null>(null);

    // Preview
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewTitle, setPreviewTitle] = useState('');
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewDownload, setPreviewDownload] = useState<(() => void) | undefined>();
    const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

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

    // ── Preview liste d'équipage ──────────────────────────────────────
    const handlePreviewListe = async (l: CrewList) => {
        setLoadingPreview(`liste-${l.id}`);
        const fullList = await buildFullList(l);
        const url = await previewCrewListPDF(fullList as any);
        setPreviewUrl(url);
        setPreviewTitle(`Liste d'équipage — ${l.shipName} #${formatId(l.id)}`);
        setPreviewDownload(() => async () => generateCrewListPDF(fullList as any));
        setPreviewOpen(true);
        setLoadingPreview(null);
    };

    const handleDownloadListe = async (l: CrewList) => {
        const fullList = await buildFullList(l);
        await generateCrewListPDF(fullList as any);
    };

    // ── Preview checklist ─────────────────────────────────────────────
    const handlePreviewChecklist = async (l: CrewList) => {
        setLoadingPreview(`check-${l.id}`);
        const docData = await buildChecklistData(l, ships);
        const url = await previewChecklistPDF(docData);
        setPreviewUrl(url);
        setPreviewTitle(`Checklist — ${l.shipName} #${formatId(l.id)}`);
        setPreviewDownload(() => async () => generateChecklistPDF(docData));
        setPreviewOpen(true);
        setLoadingPreview(null);
    };

    // ── Téléchargement direct checklist ──────────────────────────────
    const handleDownloadChecklist = async (l: CrewList) => {
        const docData = await buildChecklistData(l, ships);
        await generateChecklistPDF(docData);
        await db.checklistDocs.add(docData);
    };

    const closePreview = () => {
        setPreviewOpen(false);
        setPreviewUrl('');
    };

    return (
        <div className="h-full flex flex-col gap-4 overflow-hidden fade-in">

            {/* En-tête */}
            <div className="flex items-center justify-between flex-shrink-0">
                <h1 className="text-xl font-bold font-display text-white">
                    Listes d'équipage
                </h1>
                <button onClick={onCreateNew}
                    className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-500
            text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                    <Plus size={15} /> Nouvelle liste
                </button>
            </div>

            {/* Recherche */}
            <div className="relative flex-shrink-0">
                <Search size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher par navire, destination, capitaine..."
                    className="w-full bg-navy-800 border border-navy-600 rounded-lg pl-9 pr-3
            py-2 text-sm text-slate-200 placeholder-slate-500
            focus:outline-none focus:border-ocean-500 transition" />
            </div>

            {/* Liste scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scroll space-y-2 pb-4">
                {filtered.length === 0 ? (
                    <div className="bg-navy-800 border border-dashed border-navy-600
            rounded-xl p-10 text-center text-slate-500">
                        <FileText size={28} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm">
                            {search ? 'Aucune liste trouvée' : 'Aucune liste créée'}
                        </p>
                        {!search && (
                            <button onClick={onCreateNew}
                                className="mt-3 text-ocean-400 text-sm hover:underline">
                                Créer la première liste →
                            </button>
                        )}
                    </div>
                ) : filtered.map(l => (
                    <div key={l.id} onClick={() => setViewing(l)}
                        className="bg-navy-800 border border-navy-600 rounded-xl p-4
              hover:border-navy-500 transition cursor-pointer">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">

                                {/* ID + Nom navire */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs text-slate-600
                    bg-navy-700 px-2 py-0.5 rounded flex-shrink-0">
                                        #{formatId(l.id)}
                                    </span>
                                    <span className="font-semibold text-slate-200 text-sm truncate">
                                        {l.shipName.toUpperCase()}
                                    </span>
                                </div>

                                {/* Capitaine */}
                                {l.capitaine && (
                                    <div className="text-xs text-slate-400 mt-0.5 truncate">
                                        Cap. {l.capitaine}
                                    </div>
                                )}

                                {/* Départ + Destination */}
                                <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3">
                                    {l.lieuDepart && <span>Départ : {l.lieuDepart}</span>}
                                    {l.destination && <span>Destination : {l.destination}</span>}
                                    <span>{l.members.length} membre{l.members.length > 1 ? 's' : ''}</span>
                                </div>

                                {/* Dates */}
                                <div className="text-xs text-slate-600 mt-1.5 space-y-0.5">
                                    <div>Créée le : {fmtDateTime(l.createdAt)}</div>
                                    <div>Modifiée le : {fmtDateTime(l.updatedAt)}</div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-1.5 flex-shrink-0"
                                onClick={e => e.stopPropagation()}>

                                {/* Ligne 1 : Modifier + Supprimer */}
                                <div className="flex gap-1">
                                    <button onClick={() => onEditList(l)} title="Modifier"
                                        className="text-slate-400 hover:text-amber-400 transition p-1.5">
                                        <Edit3 size={14} />
                                    </button>
                                    <button onClick={() => setDeleting(l)} title="Supprimer"
                                        className="text-slate-400 hover:text-rose-400 transition p-1.5">
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                {/* Ligne 2 : Liste PDF */}
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handlePreviewListe(l)}
                                        disabled={loadingPreview === `liste-${l.id}`}
                                        title="Aperçu liste"
                                        className="text-slate-400 hover:text-ocean-400 transition p-1.5
                      disabled:opacity-50">
                                        <Eye size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDownloadListe(l)}
                                        title="Télécharger liste PDF"
                                        className="text-slate-400 hover:text-ocean-400 transition p-1.5">
                                        <Download size={14} />
                                    </button>
                                </div>

                                {/* Ligne 3 : Checklist */}
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handlePreviewChecklist(l)}
                                        disabled={loadingPreview === `check-${l.id}`}
                                        title="Aperçu checklist"
                                        className="text-slate-400 hover:text-amber-400 transition p-1.5
                      disabled:opacity-50">
                                        <Eye size={14} className="text-amber-500/70" />
                                    </button>
                                    <button
                                        onClick={() => handleDownloadChecklist(l)}
                                        title="Télécharger checklist PDF"
                                        className="text-slate-400 hover:text-amber-400 transition p-1.5">
                                        <CheckSquare size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>








            {/* Modal détails */}
            <Modal open={!!viewing} onClose={() => setViewing(null)}
                title={`Liste #${formatId(viewing?.id)}`} maxWidth="max-w-lg">
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
                                        {/* Pas de fonction ici — membres partiels en affichage */}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col items-end sm:flex-row sm:justify-end gap-2">
                            <button onClick={() => { setViewing(null); onEditList(viewing); }}
                                className="flex items-center gap-2 bg-navy-700 hover:bg-navy-600
                  text-white px-4 py-2 rounded-lg text-sm border border-navy-500 transition">
                                <Edit3 size={14} /> Modifier
                            </button>
                            <button onClick={() => handlePreviewListe(viewing)}
                                className="flex items-center gap-2 bg-navy-700 hover:bg-navy-600
                  text-white px-4 py-2 rounded-lg text-sm border border-navy-500 transition">
                                <Eye size={14} /> Aperçu liste
                            </button>
                            <button onClick={() => handlePreviewChecklist(viewing)}
                                className="flex items-center gap-2 bg-amber-700/50 hover:bg-amber-700/70
                  text-amber-300 px-4 py-2 rounded-lg text-sm transition">
                                <Eye size={14} /> Aperçu checklist
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Dialog suppression */}
            <ConfirmDialog
                open={!!deleting}
                title="Supprimer la liste"
                message={`Supprimer la liste de "${deleting?.shipName}" ? Irréversible.`}
                confirmLabel="Supprimer" danger
                onConfirm={confirmDelete}
                onCancel={() => setDeleting(null)}
            />

            {/* Modal preview PDF */}
            <PdfPreviewModal
                open={previewOpen}
                url={previewUrl}
                title={previewTitle}
                onClose={closePreview}
                onDownload={previewDownload}
            />
        </div>
    );
}