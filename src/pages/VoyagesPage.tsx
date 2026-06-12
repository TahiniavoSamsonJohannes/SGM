import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    Plus, Edit3, Trash2, Ship,
    Package,
    ChevronDown,
    Eye,
} from 'lucide-react';
import { db, type CrewList, enrichCrewListMembers } from '../db';
import {
    generateCrewListPDF, previewCrewListPDF,
    generateChecklistPDF, previewChecklistPDF,
} from '../pdfGenerator';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import PdfPreviewModal from '../components/PdfPreviewModal';
import { useDeleteAnimation } from '../hooks/useDeleteAnimation';
import SearchBar from '../components/SearchBar';

interface Props {
    onCreateNew: () => void;
    onEditList: (list: CrewList) => void;
    onViewCargo: (list: CrewList) => void;  // ← nouveau : ouvrir la page cargo
}

function formatId(id: number | undefined) {
    return String(id ?? 0).padStart(10, '0');
}

function fmtDateTime(d: Date) {
    return new Date(d).toLocaleString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export default function VoyagesPage({ onCreateNew, onEditList, onViewCargo }: Props) {
    const rawLists = useLiveQuery(() => db.crewLists.toArray()) ?? [];
    const ships = useLiveQuery(() => db.ships.toArray()) ?? [];

    // Nombre de cargaisons par voyage
    const cargoCountMap = useLiveQuery(async () => {
        const all = await db.cargoItems.toArray();
        const map: Record<number, number> = {};
        all.forEach(c => {
            map[c.crewListId] = (map[c.crewListId] ?? 0) + 1;
        });
        return map;
    }, []) ?? {};

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

    const [membresCollapsed, setMembresCollapsed] = useState(true);

    const { triggerDelete, isDeleting } = useDeleteAnimation(1300);

    const filtered = lists
        .filter(l => (
            l.shipName.toLowerCase().includes(search.toLowerCase()) ||
            l.destination.toLowerCase().includes(search.toLowerCase()) ||
            l.lieuDepart.toLowerCase().includes(search.toLowerCase()) ||
            l.capitaine.toLowerCase().includes(search.toLowerCase())
        ));

    const confirmDelete = async () => {
        if (!deleting?.id) return;
        const id = deleting.id;
        setDeleting(null);
        await triggerDelete(id, async () => {
            await db.crewLists.delete(id);
            await db.cargoItems.where('crewListId').equals(id).delete();
        });
    };

    // ── Helpers preview ────────────────────────────────────────────
    async function buildFullList(l: CrewList) {
        const full = await enrichCrewListMembers(
            l.members.map(m => ({ id: m.id!, nom: m.nom, prenom: m.prenom }))
        );
        return { ...l, members: full };
    }

    async function buildChecklistData(l: CrewList) {
        const ship = ships.find(s => s.id === l.shipId);
        const full = await enrichCrewListMembers(
            l.members.map(m => ({ id: m.id!, nom: m.nom, prenom: m.prenom }))
        );
        return {
            crewListId: l.id!, shipName: l.shipName,
            immatriculation: ship?.immatriculation ?? '',
            destination: l.destination, referDossier: l.referDossier,
            members: full, createdAt: new Date(),
        };
    }

    const openPreview = async (type: 'liste' | 'checklist', l: CrewList) => {
        const key = `${type}-${l.id}`;
        setLoadingPreview(key);
        let url = '';
        let title = '';
        let dl: (() => void) | undefined;

        if (type === 'liste') {
            const full = await buildFullList(l);
            url = await previewCrewListPDF(full as any);
            title = `Liste d'équipage — ${l.shipName} #${formatId(l.id)}`;
            dl = () => generateCrewListPDF(full as any);
        } else {
            const data = await buildChecklistData(l);
            url = await previewChecklistPDF(data);
            title = `Checklist — ${l.shipName} #${formatId(l.id)}`;
            dl = () => generateChecklistPDF(data);
        }

        setPreviewUrl(url);
        setPreviewTitle(title);
        setPreviewDownload(() => dl);
        setPreviewOpen(true);
        setLoadingPreview(null);
    };

    return (
        <div className="h-full flex flex-col gap-4 overflow-hidden fade-in">

            {/* En-tête */}
            <div className="flex items-center justify-between flex-shrink-0">
                <h1 className="text-xl font-bold font-display text-white flex items-center gap-2">
                    Voyages
                </h1>
                <button onClick={onCreateNew}
                    className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-500
            text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                    <Plus size={15} /> Nouveau voyage
                </button>
            </div>

            {/* Recherche */}
            <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Rechercher par nom, fascicule..."
            />

            {/* Total */}
            <p className="text-xs text-slate-500 flex-shrink-0">
                {filtered.length} voyage{filtered.length > 1 ? 's' : ''}
                {search ? ` sur ${lists.length}` : ''}
            </p>

            {/* Liste */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scroll space-y-2 pb-4">
                {filtered.length === 0 ? (
                    <div className="bg-navy-800 border border-dashed border-navy-600
            rounded-xl p-10 text-center text-slate-500">
                        <Ship size={28} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm">{search ? 'Aucun voyage trouvé' : 'Aucun voyage créé'}</p>
                        {!search && (
                            <button onClick={onCreateNew}
                                className="mt-3 text-ocean-400 text-sm hover:underline">
                                Créer le premier voyage →
                            </button>
                        )}
                    </div>
                ) : filtered.map(l => (
                    <div
                        key={l.id}
                        onClick={() => setViewing(l)}
                        className={`bg-navy-800 border border-navy-600 rounded-xl p-4
                        hover:border-navy-500 transition cursor-pointer
                        ${isDeleting(l.id!) ? 'item-deleting' : 'item-enter'}`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">

                                {/* Ligne 1 : ID + Navire */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs text-slate-600 bg-navy-700
            px-2 py-0.5 rounded flex-shrink-0">
                                        #{formatId(l.id)}
                                    </span>
                                    <span className="font-semibold text-slate-200 text-sm truncate">
                                        {l.shipName.toUpperCase()}
                                    </span>
                                </div>

                                {/* Ligne 2 : Capitaine */}
                                {l.capitaine && (
                                    <div className="text-xs text-slate-400 mt-1 truncate">
                                        Cap. {l.capitaine}
                                    </div>
                                )}

                                {/* Ligne 3 : Départ → Destination */}
                                <div className="flex text-xs gap-1 flex-col sm:flex-row text-slate-500 mt-1">
                                    <span className=''>Départ : {l.lieuDepart ? l.lieuDepart + ',' : '—'}</span>
                                    <span className=''>Destination : {l.destination ? l.destination : '—'}</span>
                                </div>

                                {/* Ligne 4 : Compteurs */}
                                <div className="flex items-center gap-3 mt-1.5">
                                    <span className="text-xs text-slate-600">
                                        {l.members.length} membre{l.members.length > 1 ? 's' : ''}
                                    </span>
                                    {(cargoCountMap[l.id!] ?? 0) > 0 && (
                                        <span className="text-xs text-amber-400/80">
                                            {cargoCountMap[l.id!]} cargaison{cargoCountMap[l.id!] > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Boutons */}
                            <div className="flex flex-col sm:flex-row gap-1 flex-shrink-0"
                                onClick={e => e.stopPropagation()}>
                                <button onClick={() => onEditList(l)} title="Modifier"
                                    className="text-slate-400 hover:text-amber-400 transition p-1.5">
                                    <Edit3 size={15} />
                                </button>
                                <button onClick={() => onViewCargo(l)} title="Cargaison"
                                    className="text-slate-400 hover:text-ocean-400 transition p-1.5">
                                    <Package size={15} />
                                </button>
                                <button onClick={() => setDeleting(l)} title="Supprimer"
                                    className="text-slate-400 hover:text-rose-400 transition p-1.5">
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Modal détails ── */}
            <Modal open={!!viewing} onClose={() => setViewing(null)}
                title={`Voyage #${formatId(viewing?.id)}`} maxWidth="max-w-lg">
                {viewing && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            {([
                                ['Réf.', `#${formatId(viewing.id)}`],
                                ['Navire', viewing.shipName.toUpperCase()],
                                ['Capitaine', viewing.capitaine],
                                ['Départ', viewing.lieuDepart],
                                ['Destination', viewing.destination],
                                ['Réf. dossier', viewing.referDossier],
                                ['Membres', String(viewing.members.length)],
                                ['Cargaisons', String(cargoCountMap[viewing.id!] ?? 0)],
                                ['Créé le', fmtDateTime(viewing.createdAt)],
                                ['Modifié le', fmtDateTime(viewing.updatedAt)],
                            ] as [string, string][])
                                .filter(([, v]) => v && v !== '0' || v === '0')
                                .map(([k, v]) => (
                                    <div key={k} className="bg-navy-700 rounded-lg p-3">
                                        <div className="text-xs text-slate-500 mb-1">{k}</div>
                                        <div className="text-slate-200 text-sm break-words">{v}</div>
                                    </div>
                                ))
                            }
                        </div>

                        {/* Membres */}
                        <div className="flex-shrink-0">
                            {/* Bouton toggle */}
                            <button
                                onClick={() => setMembresCollapsed(c => !c)}
                                className="w-full flex items-center gap-2 py-2
                                text-xs font-semibold text-slate-400 uppercase tracking-wider
                                hover:text-white transition"
                            >
                                <span>Membres d'équipage ({viewing?.members.length})</span>
                                <ChevronDown
                                    size={13}
                                    className={`transition-transform duration-300
                                    ${membresCollapsed ? '' : 'rotate-180'}`}
                                />
                            </button>

                            {/* Contenu avec animation max-height */}
                            <div
                                className="overflow-hidden transition-all duration-700 ease-in-out"
                                style={{
                                    maxHeight: membresCollapsed ? '0px' : '1000px',
                                    opacity: membresCollapsed ? 0 : 1,
                                }}
                            >
                                <div className="space-y-1 pt-1 pb-2">
                                    {viewing?.members.map((m, i) => (
                                        <div key={i} className="flex gap-2 text-xs text-slate-400 py-0.5">
                                            <span className="text-slate-600 w-5 flex-shrink-0">{i + 1}.</span>
                                            <span className="text-slate-300 truncate">
                                                {m.nom.toUpperCase()} {m.prenom}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Boutons d'action — responsives */}
                        <div className="flex flex-wrap justify-end gap-2 pt-1">
                            <button onClick={() => { setViewing(null); onEditList(viewing); }}
                                className="flex items-center gap-1.5 bg-navy-700 hover:bg-navy-600
                  text-white px-3 py-2 rounded-lg text-sm border border-navy-500 transition">
                                <Edit3 size={14} /> Modifier
                            </button>
                            <button
                                onClick={() => openPreview('liste', viewing)}
                                disabled={loadingPreview === `liste-${viewing.id}`}
                                className="flex items-center gap-1.5 bg-navy-700 hover:bg-navy-600
                  text-white px-3 py-2 rounded-lg text-sm border border-navy-500 transition
                  disabled:opacity-50">
                                <Eye size={14} /> Liste d'équipage PDF
                            </button>
                            <button
                                onClick={() => openPreview('checklist', viewing)}
                                disabled={loadingPreview === `checklist-${viewing.id}`}
                                className="flex items-center gap-1.5 bg-navy-700 hover:bg-navy-600
                  text-amber-300 px-3 py-2 rounded-lg text-sm border border-navy-500 transition
                  disabled:opacity-50">
                                <Eye size={14} /> Checklist PDF
                            </button>
                            <button
                                onClick={() => { setViewing(null); onViewCargo(viewing); }}
                                className="flex items-center gap-1.5 bg-ocean-600 hover:bg-ocean-500
                  text-white px-3 py-2 rounded-lg text-sm transition">
                                <Package size={14} /> Cargaison
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Confirmation suppression */}
            <ConfirmDialog
                open={!!deleting}
                title="Supprimer le voyage"
                message={`Supprimer le voyage de "${deleting?.shipName}" ? Les cargaisons associées seront aussi supprimées.`}
                confirmLabel="Supprimer" danger
                onConfirm={confirmDelete}
                onCancel={() => setDeleting(null)}
            />

            {/* Preview PDF */}
            <PdfPreviewModal
                open={previewOpen}
                url={previewUrl}
                title={previewTitle}
                onClose={() => { setPreviewOpen(false); setPreviewUrl(''); }}
                onDownload={previewDownload}
            />
        </div>
    );
}