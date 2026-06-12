import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Edit3, Trash2, Save, Anchor, AlertTriangle } from 'lucide-react';
import { db, type Ship } from '../db';
import Input from '../components/Input';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import logoUrl from '../assets/logo-ae.png';
import { useDeleteAnimation } from '../hooks/useDeleteAnimation';
import SearchBar from '../components/SearchBar';

export default function ShipsPage() {
    const ships = useLiveQuery(() => db.ships.orderBy('nom').toArray()) ?? [];

    const [search, setSearch] = useState('');
    const [modal, setModal] = useState<'add' | 'edit' | 'view' | null>(null);
    const [active, setActive] = useState<Ship | null>(null);
    const [form, setForm] = useState({ nom: '', immatriculation: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [deleting, setDeleting] = useState<Ship | null>(null);
    const { triggerDelete, isDeleting } = useDeleteAnimation(1300);

    // État pour l'erreur de suppression
    const [deleteError, setDeleteError] = useState<string>('');
    const [deleteErrorModal, setDeleteErrorModal] = useState(false);

    const openAdd = () => {
        setActive(null);
        setForm({ nom: '', immatriculation: '' });
        setErrors({});
        setModal('add');
    };
    const openEdit = (s: Ship) => {
        setActive(s);
        setForm({ nom: s.nom, immatriculation: s.immatriculation });
        setErrors({});
        setModal('edit');
    };
    const openView = (s: Ship) => { setActive(s); setModal('view'); };

    const validate = () => {
        const e: Record<string, string> = {};
        if (!form.nom.trim()) e.nom = 'Le nom est requis';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const save = async () => {
        if (!validate()) return;

        const editingId = (modal === 'edit' && active?.id) ? active.id : null;

        // 1. Nom identique
        const sameName = await db.ships
            .filter(s =>
                s.nom.toUpperCase().trim() === form.nom.toUpperCase().trim() &&
                s.id !== editingId
            ).count();
        if (sameName > 0) {
            setErrors(e => ({ ...e, nom: 'Un navire avec ce nom existe déjà.' }));
            return;
        }

        // 2. Immatriculation identique
        if (form.immatriculation.trim()) {
            const sameImmat = await db.ships
                .filter(s =>
                    s.immatriculation.toUpperCase().trim() ===
                    form.immatriculation.toUpperCase().trim() &&
                    s.id !== editingId
                ).count();
            if (sameImmat > 0) {
                setErrors(e => ({
                    ...e,
                    immatriculation: 'Cette immatriculation est déjà utilisée.',
                }));
                return;
            }
        }

        // ── Sauvegarde ─────────────────────────────────────────────────
        if (modal === 'edit' && active?.id) {
            await db.ships.update(active.id, form);
        } else {
            await db.ships.add({ ...form, createdAt: new Date() });
        }
        setModal(null);
    };

    const confirmDelete = async (ship: Ship) => {
        if (!ship?.id) return;

        // Vérifier si ce navire est lié à des voyages
        const linkedLists = await db.crewLists
            .where('shipId')
            .equals(ship.id)
            .count();

        if (linkedLists > 0) {
            setDeleting(null);
            setDeleteError(
                `Impossible de supprimer "${ship.nom}" : ` +
                `ce navire est lié à ${linkedLists} voyage${linkedLists > 1 ? 's' : ''}. ` +
                `Supprimez d'abord les voyages associés.`
            );
            setDeleteErrorModal(true);
            return;
        }

        // Aucun voyage lié → supprimer
        const id = ship.id;
        setDeleting(null);
        await triggerDelete(id, () => db.ships.delete(id));
    };

    const filtered = ships.filter(s =>
        s.nom.toLowerCase().includes(search.toLowerCase()) ||
        s.immatriculation.toLowerCase().includes(search.toLowerCase())
    );

    const fmt = (d: Date) => new Date(d).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
    });

    return (
        // Layout fixe : flex colonne, overflow caché sur le parent
        <div className="h-full flex flex-col gap-4 overflow-hidden fade-in">

            {/* ── En-tête fixe ── */}
            <div className="flex items-center justify-between flex-shrink-0">
                <h1 className="text-xl font-bold font-display text-white">Navires</h1>
                <button onClick={openAdd}
                    className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-500
            text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                    <Plus size={16} /> Ajouter
                </button>
            </div>

            {/* ── Recherche ── */}
            <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Rechercher par nom, fascicule..."
            />

            {/* Total */}
            <p className="text-xs text-slate-500 flex-shrink-0">
                {filtered.length} navire{filtered.length > 1 ? 's' : ''}
                {search ? ` sur ${ships.length}` : ''}
            </p>

            {/* ── Liste scrollable ── */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scroll space-y-2 pb-4">
                {filtered.length === 0 ? (
                    <div className="bg-navy-800 border border-dashed border-navy-600
            rounded-xl p-10 text-center text-slate-500">
                        <Anchor size={28} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm">
                            {search ? 'Aucun navire trouvé' : 'Aucun navire enregistré'}
                        </p>
                    </div>
                ) : filtered.map(s => (
                    <div
                        key={s.id}
                        onClick={() => openView(s)}
                        className={`bg-navy-800 border border-navy-600 rounded-xl p-4
                        flex items-center justify-between hover:border-navy-500
                        transition cursor-pointer
                        ${isDeleting(s.id!) ? 'item-deleting' : ' item-enter'}`}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <img
                                src={logoUrl} alt=""
                                className="w-8 h-8 object-contain opacity-60 flex-shrink-0"
                            />
                            <div className="min-w-0">
                                <div className="font-semibold text-slate-200 text-sm truncate">
                                    {s.nom.toUpperCase()}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                    Immat : {s.immatriculation}
                                </div>
                            </div>
                        </div>
                        <div
                            className="flex gap-1 flex-shrink-0 ml-3"
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                onClick={() => openEdit(s)}
                                className="text-slate-400 hover:text-ocean-400 transition p-1.5"
                            >
                                <Edit3 size={15} />
                            </button>
                            <button
                                onClick={() => setDeleting(s)}
                                className="text-slate-400 hover:text-rose-400 transition p-1.5"
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Modal ajout / édition ── */}
            <Modal
                open={modal === 'add' || modal === 'edit'}
                onClose={() => setModal(null)}
                title={modal === 'edit' ? 'Modifier le navire' : 'Nouveau navire'}
                maxWidth="max-w-sm"
            >
                <div className="space-y-4">
                    <div>
                        <Input
                            label="Nom du navire *"
                            value={form.nom}
                            onChange={e => {
                                setForm(f => ({ ...f, nom: e.target.value }));
                                setErrors(v => ({ ...v, nom: '' }));
                            }}
                            placeholder="Nom du navire"
                        />
                        {errors.nom && (
                            <p className="text-rose-400 text-xs mt-1">{errors.nom}</p>
                        )}
                    </div>
                    <div>
                        <Input
                            label="Immatriculation"
                            value={form.immatriculation}
                            onChange={e => {
                                setForm(f => ({ ...f, immatriculation: e.target.value }));
                                setErrors(v => ({ ...v, immatriculation: '' }));
                            }}
                            placeholder="Ex : MG-001"
                        />
                        {errors.immatriculation && (
                            <p className="text-rose-400 text-xs mt-1">{errors.immatriculation}</p>
                        )}
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={() => setModal(null)}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={save}
                        className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-500
              text-white px-5 py-2 rounded-lg text-sm font-medium transition"
                    >
                        <Save size={15} /> Enregistrer
                    </button>
                </div>
            </Modal>

            {/* ── Modal détails ── */}
            <Modal
                open={modal === 'view'}
                onClose={() => setModal(null)}
                title="Détails du navire"
                maxWidth="max-w-sm"
            >
                {active && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <img
                                src={logoUrl} alt=""
                                className="w-14 h-14 object-contain opacity-70 flex-shrink-0"
                            />
                            <div>
                                <div className="text-lg font-bold text-white">
                                    {active.nom.toUpperCase()}
                                </div>
                                <div className="text-sm text-ocean-400">Armement Eustratiou</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-navy-700 rounded-lg p-3 col-span-2">
                                <div className="text-xs text-slate-500 mb-1">Immatriculation</div>
                                <div className="text-slate-200 text-sm">
                                    {active.immatriculation || '—'}
                                </div>
                            </div>
                            {active.createdAt && (
                                <div className="bg-navy-700 rounded-lg p-3">
                                    <div className="text-xs text-slate-500 mb-1">Enregistré le</div>
                                    <div className="text-slate-200 text-xs">{fmt(active.createdAt)}</div>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={() => { setModal(null); setTimeout(() => openEdit(active), 80); }}
                                className="flex items-center gap-2 bg-navy-700 hover:bg-navy-600
                  text-white px-4 py-2 rounded-lg text-sm border border-navy-500 transition"
                            >
                                <Edit3 size={14} /> Modifier
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── Confirmation suppression ── */}
            <ConfirmDialog
                open={!!deleting}
                title="Supprimer le navire"
                message={`Supprimer "${deleting?.nom}" ? Cette action est irréversible.`}
                confirmLabel="Supprimer"
                danger
                onConfirm={() => deleting && confirmDelete(deleting)}
                onCancel={() => setDeleting(null)}
            />

            {/* MODAL ERROR */}
            <Modal
                open={deleteErrorModal}
                onClose={() => setDeleteErrorModal(false)}
                title="Suppression impossible"
                maxWidth="max-w-sm"
            >
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-amber-500/10
      border border-amber-500/20 rounded-lg">
                        <AlertTriangle size={16}
                            className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-slate-300">{deleteError}</p>
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={() => setDeleteErrorModal(false)}
                            className="bg-navy-700 hover:bg-navy-600 text-white px-4 py-2
          rounded-lg text-sm border border-navy-500 transition"
                        >
                            Compris
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}