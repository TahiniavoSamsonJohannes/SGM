import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    ArrowLeft, Plus, Edit3, Trash2, Package, Eye, ChevronDown,
    Save,
} from 'lucide-react';
import {
    db, type CargoItem, type CrewList,
} from '../db';
import { formatPoidsKg, totalColis, totalPoidsKg } from '../utils/cargoFormat';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Input from '../components/Input';
import DatePicker from '../components/DatePicker';
import PdfPreviewModal from '../components/PdfPreviewModal';
import { generateManifestePDF, previewManifestePDF } from '../pdfGenerator';
import { useDeleteAnimation } from '../hooks/useDeleteAnimation';
import { fmtDate, fmtDateLong } from '../utils/fmt';
import SearchBar from '../components/SearchBar';

interface Props {
    voyage: CrewList;
    onBack: () => void;
}

function emptyMarchandise() {
    return { nbColis: 0, description: '', poidsKg: 0 };
}

function emptyCargoForm() {
    return {
        expediteurNom: '',
        expediteurAdresse: '',
        numCommande: '',
        numConteneur: '',
        destinataireNom: '',
        destinataireAdresse: '',
        numDeclaration: '',
        dateDeclaration: '',
        marchandises: [emptyMarchandise()],
    };
}

export default function CargoPage({ voyage, onBack }: Props) {
    const items = useLiveQuery(() =>
        db.cargoItems.where('crewListId').equals(voyage.id!).toArray()
    ) ?? [];

    const sortedItems = [...items].sort((a, b) => a.ordre - b.ordre);

    const [search, setSearch] = useState('');
    const [modal, setModal] = useState<'add' | 'edit' | null>(null);
    const [editing, setEditing] = useState<CargoItem | null>(null);
    const [deleting, setDeleting] = useState<CargoItem | null>(null);
    const [viewingCargo, setViewingCargo] = useState<CargoItem | null>(null);
    const [form, setForm] = useState(emptyCargoForm());
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Collapse infos (chargeur/destinataire/déclaration)
    const [infosCollapsed, setInfosCollapsed] = useState(false);

    // Manifeste
    const [manifesteDate, setManifesteDate] = useState(new Date().toISOString().split('T')[0]);

    const [manifesteAgent, setManifesteAgent] = useState('ARMEMENT EUSTRATIOU');

    // Preview
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewDl, setPreviewDl] = useState<(() => void) | undefined>();

    const { triggerDelete, isDeleting } = useDeleteAnimation(1300);

    // Ref pour le scroll du conteneur marchandises
    const marchandisesContainerRef = useRef<HTMLDivElement>(null);
    const [marcCollapsed, setMarcCollapsed] = useState(true);
    const [deletingMarcIdx, setDeletingMarcIdx] = useState<Set<number>>(new Set());

    const removeMarchandise = (idx: number) => {
        // Marquer pour animation
        setDeletingMarcIdx(prev => new Set(prev).add(idx));
        setTimeout(() => {
            setForm(f => ({
                ...f,
                marchandises: f.marchandises.filter((_, i) => i !== idx),
            }));
            setDeletingMarcIdx(prev => {
                const n = new Set(prev); n.delete(idx); return n;
            });
        }, 250);
    };

    // ── Filtrage ────────────────────────────────────────────────────
    const filtered = sortedItems.filter(item =>
    (
        item.expediteurNom.toLowerCase().includes(search.toLowerCase()) ||
        item.destinataireNom.toLowerCase().includes(search.toLowerCase()) ||
        item.marchandises.some(m =>
            m.description.toLowerCase().includes(search.toLowerCase())
        )
    )
    );

    // ── Ouvrir formulaire ────────────────────────────────────────────
    const openAdd = () => {
        setEditing(null);
        setForm(emptyCargoForm());
        setErrors({});
        setInfosCollapsed(false);
        setModal('add');
    };

    const openEdit = (item: CargoItem) => {
        setEditing(item);
        setForm({
            expediteurNom: item.expediteurNom,
            expediteurAdresse: item.expediteurAdresse,
            numCommande: item.numCommande,
            numConteneur: item.numConteneur,
            destinataireNom: item.destinataireNom,
            destinataireAdresse: item.destinataireAdresse,
            numDeclaration: item.numDeclaration,
            dateDeclaration: item.dateDeclaration,
            marchandises: item.marchandises.length > 0
                ? item.marchandises.map(m => ({
                    ...m,
                    poidsKg: Number(m.poidsKg) || 0,
                }))
                : [emptyMarchandise()],
        });
        setErrors({});
        setInfosCollapsed(false);
        setModal('edit');
    };

    // ── Ajouter une marchandise + scroll ────────────────────────────
    const addMarchandise = () => {
        setForm(f => ({
            ...f,
            marchandises: [...f.marchandises, emptyMarchandise()],
        }));
        // Scroll vers le bas du conteneur marchandises uniquement
        setTimeout(() => {
            if (marchandisesContainerRef.current) {
                marchandisesContainerRef.current.scrollTop =
                    marchandisesContainerRef.current.scrollHeight;
            }
        }, 50);
    };

    // ── Sauvegarde ───────────────────────────────────────────────────
    const save = async () => {
        const e: Record<string, string> = {};
        if (!form.expediteurNom.trim()) e.expediteurNom = 'Nom chargeur requis';
        if (!form.destinataireNom.trim()) e.destinataireNom = 'Destinataire requis';
        if (form.marchandises.length === 0) e.marchandises = 'Au moins une marchandise';
        if (Object.keys(e).length > 0) { setErrors(e); return; }

        const now = new Date();
        const cleanForm = {
            ...form,
            marchandises: form.marchandises.map(m => ({
                ...m,
                poidsKg: Number(m.poidsKg) || 0,
                nbColis: Number(m.nbColis) || 0,
            })),
        };

        if (editing?.id) {
            await db.cargoItems.update(editing.id, { ...cleanForm, updatedAt: now });
        } else {
            await db.cargoItems.add({
                crewListId: voyage.id!,
                ordre: sortedItems.length + 1,
                ...cleanForm,
                createdAt: now,
                updatedAt: now,
            });
        }
        setModal(null);
    };

    const confirmDelete = async () => {
        if (!deleting?.id) return;
        const id = deleting.id;
        setDeleting(null);
        await triggerDelete(id, () => db.cargoItems.delete(id));
    };

    // ── Manifeste PDF ────────────────────────────────────────────────
    const buildManifesteData = () => ({
        shipName: voyage.shipName,
        capitaine: voyage.capitaine,
        lieuDepart: voyage.lieuDepart,
        destination: voyage.destination,
        date: fmtDateLong(manifesteDate).toUpperCase() || fmtDateLong(new Date().toISOString().split('T')[0]).toUpperCase(),
        agentResponsable: manifesteAgent,
        cargoItems: sortedItems,
    });

    const handlePreviewManifeste = async () => {
        const url = await previewManifestePDF(buildManifesteData());
        setPreviewUrl(url);
        setPreviewDl(() => () => generateManifestePDF(buildManifesteData()));
        setPreviewOpen(true);
    };

    // ── Totaux ───────────────────────────────────────────────────────
    const nbTotal = totalColis(sortedItems);
    const poidsTotal = totalPoidsKg(
        sortedItems.flatMap(item =>
            item.marchandises.map(m => ({ poidsKg: Number(m.poidsKg) || 0 }))
        )
    );

    return (
        <div className="h-full flex flex-col gap-4 overflow-hidden fade-in">

            {/* En-tête */}
            <div className="flex-shrink-0 space-y-3">
                <button onClick={onBack}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-white
            text-sm transition">
                    <ArrowLeft size={15} /> Retour aux voyages
                </button>

                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-xl font-bold font-display text-white">
                            Cargaison — {voyage.shipName.toUpperCase()}
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Destination : {voyage.destination} · {sortedItems.length} déclaration{sortedItems.length > 1 ? 's' : ''}
                            {nbTotal > 0 && ` · ${nbTotal} colis · Poids Total : ${poidsTotal}`}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                        {nbTotal > 0 && (
                            <button onClick={handlePreviewManifeste}
                                className="flex items-center gap-1.5 bg-navy-700 hover:bg-navy-600
                                text-white px-3 py-2 rounded-lg text-sm border border-navy-500 transition">
                                <Eye size={14} /> Manifeste Cargo PDF
                            </button>
                        )}
                        <button onClick={openAdd}
                            className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-500
                text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                            <Plus size={15} /> Ajouter
                        </button>
                    </div>
                </div>

                {/* Champs manifeste */}
                <div className="bg-navy-800 border border-navy-600 rounded-xl p-4
          grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DatePicker
                        label="Date du manifeste"
                        value={manifesteDate}
                        onChange={setManifesteDate}
                        placeholder="Sélectionner une date"
                    />
                    <Input label="Agent responsable" value={manifesteAgent}
                        onChange={e => setManifesteAgent(e.target.value)}
                        placeholder="ARMEMENT EUSTRATIOU" />
                </div>
            </div>

            {/* Recherche */}
            <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Rechercher par nom, fascicule..."
            />

            {/* Total trouvé */}
            <p className="text-xs text-slate-500 flex-shrink-0 -mt-2">
                {filtered.length} cargaison{filtered.length > 1 ? 's' : ''}
                {search ? ` sur ${sortedItems.length}` : ''}
            </p>

            {/* Liste */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scroll space-y-2 pb-4">
                {filtered.length === 0 ? (
                    <div className="bg-navy-800 border border-dashed border-navy-600
            rounded-xl p-10 text-center text-slate-500">
                        <Package size={28} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm">
                            {search ? 'Aucune cargaison trouvée' : 'Aucune cargaison ajoutée'}
                        </p>
                        {!search && (
                            <button onClick={openAdd}
                                className="mt-3 text-ocean-400 text-sm hover:underline">
                                Ajouter la première cargaison →
                            </button>
                        )}
                    </div>
                ) : filtered.map(item => (
                    <div
                        key={item.id}
                        onClick={() => setViewingCargo(item)}
                        className={`bg-navy-800 border border-navy-600 rounded-xl p-4
              hover:border-navy-500 transition cursor-pointer
              ${isDeleting(item.id!) ? 'item-deleting' : 'item-enter'}`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    {/* Numérotation 3 chiffres */}
                                    <span className="font-mono text-xs text-slate-600 bg-navy-700
                    px-2 py-0.5 rounded">
                                        #{String(item.ordre).padStart(3, '0')}
                                    </span>
                                    <span className="font-semibold text-slate-200 text-sm truncate">
                                        {item.expediteurNom.toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex text-xs flex-col sm:flex-col gap-1 text-slate-500">
                                    <div>Destinataire : {item.destinataireNom}</div>
                                    <div>
                                        {item.marchandises.length} marchandise{item.marchandises.length > 1 ? 's' : ''} · {item.marchandises.reduce((s, m) => s + (Number(m.nbColis) || 0), 0)} colis</div>
                                    <div>
                                        Poids : {formatPoidsKg(
                                            item.marchandises.reduce((s, m) => s + (Number(m.poidsKg) || 0), 0)
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-1 flex-shrink-0"
                                onClick={e => e.stopPropagation()}>
                                <button onClick={() => openEdit(item)}
                                    className="text-slate-400 hover:text-amber-400 transition p-1.5">
                                    <Edit3 size={14} />
                                </button>
                                <button onClick={() => setDeleting(item)}
                                    className="text-slate-400 hover:text-rose-400 transition p-1.5">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Modal formulaire — layout fixe, scroll isolé ── */}
            <Modal
                open={modal === 'add' || modal === 'edit'}
                onClose={() => setModal(null)}
                title={editing ? `Modifier cargaison #${String(editing.ordre).padStart(3, '0')}` : 'Nouvelle cargaison'}
                maxWidth="max-w-2xl"
            >
                {/*
          Le modal lui-même ne scrolle PAS.
          Le contenu est divisé en 2 zones avec hauteur fixe :
          - Zone collapsible : infos (chargeur/destinataire/déclaration)
          - Zone fixe : marchandises (flex-1, scroll interne uniquement)
        */}
                <div className="flex flex-col gap-4">

                    {/* ── Zone collapsible : Infos ── */}
                    <div className={`flex-shrink-0 bg-navy-700/50 rounded-xl ${infosCollapsed ? 'overflow-hidden' : ''}`}>

                        {/* Bouton toggle */}
                        <button
                            onClick={() => setInfosCollapsed(c => !c)}
                            className="w-full flex items-center justify-between px-4 py-3
                            text-xs font-semibold text-slate-400 uppercase tracking-wider
                            hover:text-white transition"
                        >
                            <span>Informations de la cargaison</span>
                            <ChevronDown
                                size={14}
                                className={`transition-transform duration-300
                                ${infosCollapsed ? '' : 'rotate-180'}`}
                            />
                        </button>

                        {/* Contenu collapsible */}
                        <div
                            className={`${infosCollapsed ? 'overflow-hidden' : ''} transition-all duration-300 ease-in-out`}
                            style={{
                                maxHeight: infosCollapsed ? '0px' : '600px',
                                opacity: infosCollapsed ? 0 : 1,
                            }}
                        >
                            <div className="px-4 pb-4 space-y-4">
                                {/* Chargeur */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Input label="Nom du chargeur *"
                                            value={form.expediteurNom}
                                            onChange={e => setForm(f => ({ ...f, expediteurNom: e.target.value }))}
                                            placeholder="Nom du chargeur" />
                                        {errors.expediteurNom && (
                                            <p className="text-rose-400 text-xs mt-1">{errors.expediteurNom}</p>
                                        )}
                                    </div>
                                    <Input label="Adresse chargeur"
                                        value={form.expediteurAdresse}
                                        onChange={e => setForm(f => ({ ...f, expediteurAdresse: e.target.value }))}
                                        placeholder="Adresse" />
                                    <Input label="N° commande"
                                        value={form.numCommande}
                                        onChange={e => setForm(f => ({ ...f, numCommande: e.target.value }))}
                                        placeholder="N° commande" />
                                    <Input label="N° conteneur"
                                        value={form.numConteneur}
                                        onChange={e => setForm(f => ({ ...f, numConteneur: e.target.value }))}
                                        placeholder="N° conteneur" />
                                </div>

                                {/* Destinataire */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Input label="Nom du destinataire *"
                                            value={form.destinataireNom}
                                            onChange={e => setForm(f => ({ ...f, destinataireNom: e.target.value }))}
                                            placeholder="Nom du destinataire" />
                                        {errors.destinataireNom && (
                                            <p className="text-rose-400 text-xs mt-1">{errors.destinataireNom}</p>
                                        )}
                                    </div>
                                    <Input label="Adresse destinataire"
                                        value={form.destinataireAdresse}
                                        onChange={e => setForm(f => ({ ...f, destinataireAdresse: e.target.value }))}
                                        placeholder="Adresse" />
                                </div>

                                {/* Déclaration */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Input label="N° déclaration"
                                        value={form.numDeclaration}
                                        onChange={e => setForm(f => ({ ...f, numDeclaration: e.target.value }))}
                                        placeholder="N° déclaration" />
                                    <DatePicker
                                        label="Date de déclaration"
                                        value={form.dateDeclaration}
                                        onChange={v => setForm(f => ({ ...f, dateDeclaration: v }))}
                                        placeholder="Sélectionner une date"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Zone marchandises — scroll interne ── */}
                    <div className="bg-navy-700/50 rounded-xl overflow-hidden flex flex-col">

                        {/* Header marchandises */}
                        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0
              border-b border-navy-600">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Marchandises *
                            </span>
                            <button
                                onClick={addMarchandise}
                                className="text-xs text-ocean-400 hover:text-ocean-300 transition
                  flex items-center gap-1"
                            >
                                <Plus size={12} /> Ajouter
                            </button>
                        </div>

                        {errors.marchandises && (
                            <p className="text-rose-400 text-xs px-4 pt-2">{errors.marchandises}</p>
                        )}

                        {/* Liste marchandises — SCROLL ISOLÉ ICI */}
                        <div
                            ref={marchandisesContainerRef}
                            className="overflow-y-auto custom-scroll scroll-smooth p-4 space-y-3"
                            style={{
                                minHeight: '200px',   // hauteur min garantie pour le scroll
                                maxHeight: '350px',   // hauteur max — au-delà ça scrolle en interne
                            }}
                        >
                            {form.marchandises.map((m, idx) => (
                                <div
                                    key={idx}
                                    className={`bg-navy-800 rounded-lg p-3 space-y-2 border border-navy-600
                                        transition-all duration-250
                                        ${deletingMarcIdx.has(idx)
                                            ? 'opacity-0 scale-95 max-h-0 overflow-hidden'
                                            : 'opacity-100 scale-100 item-enter'
                                        }`}
                                >
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        {/* Nb colis */}
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">Nb colis</label>
                                            <input
                                                type="number" min={0}
                                                value={m.nbColis || ''}
                                                onChange={e => setForm(f => {
                                                    const ms = [...f.marchandises];
                                                    ms[idx] = { ...ms[idx], nbColis: parseInt(e.target.value) || 0 };
                                                    return { ...f, marchandises: ms };
                                                })}
                                                className="w-full bg-navy-700 border border-navy-600 rounded-lg
                                                px-2 py-1.5 text-sm text-slate-200 focus:outline-none
                                                focus:border-ocean-500 transition"
                                            />
                                        </div>

                                        {/* Poids kg */}
                                        <div className='flex gap-1.5'>
                                            <div className='flex-1'>
                                                <label className="block text-xs text-slate-500 mb-1">
                                                    Poids (kg)
                                                    {m.poidsKg > 0 && (
                                                        <span className="ml-1 text-ocean-400 font-mono text-xs">
                                                            = {formatPoidsKg(Number(m.poidsKg))}
                                                        </span>
                                                    )}
                                                </label>
                                                <input
                                                    type="number" min={0} step="0.01"
                                                    value={m.poidsKg || ''}
                                                    onChange={e => setForm(f => {
                                                        const ms = [...f.marchandises];
                                                        ms[idx] = { ...ms[idx], poidsKg: parseFloat(e.target.value) || 0 };
                                                        return { ...f, marchandises: ms };
                                                    })}
                                                    className="w-full bg-navy-700 border border-navy-600 rounded-lg
                          px-2 py-1.5 text-sm text-slate-200 focus:outline-none
                          focus:border-ocean-500 transition"
                                                />
                                            </div>
                                            {/* Supprimer */}
                                            <div className="flex items-end pb-0.5">
                                                <button
                                                    onClick={() => removeMarchandise(idx)}
                                                    disabled={form.marchandises.length <= 1}
                                                    className="text-slate-500 hover:text-rose-400 transition p-1.5 disabled:opacity-30"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                    </div>

                                    {/* Description — textarea */}
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Description</label>
                                        <textarea
                                            value={m.description}
                                            onChange={e => setForm(f => {
                                                const ms = [...f.marchandises];
                                                ms[idx] = { ...ms[idx], description: e.target.value };
                                                return { ...f, marchandises: ms };
                                            })}
                                            placeholder="Nature, espèce, contenu..."
                                            rows={2}
                                            className="w-full bg-navy-700 border border-navy-600 rounded-lg
                        px-3 py-2 text-sm text-slate-200 focus:outline-none
                        focus:border-ocean-500 transition resize-none"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 flex-shrink-0 pt-1">
                        <button onClick={() => setModal(null)}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">
                            Annuler
                        </button>
                        <button onClick={save}
                            className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-500 text-white px-5 py-2
                rounded-lg text-sm font-medium transition">
                            <Save size={15} /> Enregistrer
                        </button>
                    </div>
                </div>
            </Modal>

            {/* ── Modal détail cargaison ── */}
            <Modal
                open={!!viewingCargo}
                onClose={() => { setViewingCargo(null); setMarcCollapsed(true); }}
                title={`Cargaison #${String(viewingCargo?.ordre ?? 0).padStart(3, '0')}`}
                maxWidth="max-w-lg"
            >
                {viewingCargo && (
                    <div className="space-y-4">

                        {/* Chargeur + Destinataire */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-navy-700 rounded-lg p-3">
                                <div className="text-xs text-slate-500 mb-1">Chargeur</div>
                                <div className="text-slate-200 text-sm font-semibold">
                                    {viewingCargo.expediteurNom}
                                </div>
                                {viewingCargo.expediteurAdresse && (
                                    <div className="text-slate-400 text-xs mt-1">
                                        {viewingCargo.expediteurAdresse}
                                    </div>
                                )}
                                {viewingCargo.numCommande && (
                                    <div className="text-slate-500 text-xs mt-1">
                                        Cmd : {viewingCargo.numCommande}
                                    </div>
                                )}
                                {viewingCargo.numConteneur && (
                                    <div className="text-slate-500 text-xs">
                                        Cont : {viewingCargo.numConteneur}
                                    </div>
                                )}
                            </div>

                            <div className="bg-navy-700 rounded-lg p-3">
                                <div className="text-xs text-slate-500 mb-1">Destinataire</div>
                                <div className="text-slate-200 text-sm font-semibold">
                                    {viewingCargo.destinataireNom}
                                </div>
                                {viewingCargo.destinataireAdresse && (
                                    <div className="text-slate-400 text-xs mt-1">
                                        {viewingCargo.destinataireAdresse}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Déclaration */}
                        {(viewingCargo.numDeclaration || viewingCargo.dateDeclaration) && (
                            <div className="bg-navy-700 rounded-lg p-3">
                                <div className="text-xs text-slate-500 mb-1">Déclaration douanière</div>
                                <div className="text-slate-200 text-sm">
                                    {viewingCargo.numDeclaration}
                                    {viewingCargo.dateDeclaration && (
                                        <span className="text-slate-400 ml-2">
                                            {/* Date formatée en 05 juin 2026 */}
                                            du {fmtDate(new Date(viewingCargo.dateDeclaration))}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Marchandises */}
                        <div>
                            <button
                                onClick={() => setMarcCollapsed(c => !c)}
                                className="w-full flex items-center justify-between py-2
      text-xs font-semibold text-slate-400 uppercase tracking-wider
      hover:text-white transition"
                            >
                                <span>Marchandises ({viewingCargo?.marchandises.length})</span>
                                <ChevronDown
                                    size={13}
                                    className={`transition-transform duration-300
        ${marcCollapsed ? '' : 'rotate-180'}`}
                                />
                            </button>

                            <div
                                className="overflow-y-auto custom-scroll transition-all duration-700 ease-in-out"
                                style={{
                                    maxHeight: marcCollapsed ? '0px' : '500px',
                                    opacity: marcCollapsed ? 0 : 1,
                                }}
                            >
                                <div className="space-y-2 pt-1">
                                    {viewingCargo?.marchandises.map((m, i) => (
                                        <div key={i} className="bg-navy-700 rounded-lg p-3 flex items-start
          justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-slate-200 text-sm">{m.description}</div>
                                                <div className="text-slate-500 text-xs mt-1">{m.nbColis} colis</div>
                                            </div>
                                            <div className="text-ocean-400 font-mono text-sm font-semibold flex-shrink-0">
                                                {formatPoidsKg(Number(m.poidsKg) || 0)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Totaux */}
                        <div className="bg-navy-700/50 rounded-lg p-3 flex items-center
              justify-between text-sm">
                            <div className="text-slate-400">
                                Total : {viewingCargo.marchandises.reduce(
                                    (s, m) => s + (Number(m.nbColis) || 0), 0
                                )} colis
                            </div>
                            <div className="font-mono font-bold text-ocean-400">
                                {formatPoidsKg(
                                    viewingCargo.marchandises.reduce(
                                        (s, m) => s + (Number(m.poidsKg) || 0), 0
                                    )
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap justify-end gap-2">
                            <button
                                onClick={() => { setViewingCargo(null); openEdit(viewingCargo); }}
                                className="flex items-center gap-1.5 bg-navy-700 hover:bg-navy-600
                  text-white px-3 py-2 rounded-lg text-sm border border-navy-500 transition"
                            >
                                <Edit3 size={14} /> Modifier
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Confirmation suppression */}
            <ConfirmDialog
                open={!!deleting}
                title="Supprimer la cargaison"
                message="Supprimer cette entrée ? Irréversible."
                confirmLabel="Supprimer" danger
                onConfirm={confirmDelete}
                onCancel={() => setDeleting(null)}
            />

            {/* Preview manifeste */}
            <PdfPreviewModal
                open={previewOpen}
                url={previewUrl}
                title={`Manifeste Cargo — ${voyage.shipName}`}
                onClose={() => { setPreviewOpen(false); setPreviewUrl(''); }}
                onDownload={previewDl}
            />
        </div>
    );
}