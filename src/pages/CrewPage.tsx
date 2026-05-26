import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Edit3, Trash2, Save, Users, Search } from 'lucide-react';
import DatePicker from '../components/DatePicker';
import { db, addOrIncrementDynamic, type CrewMember } from '../db';
import AutoComplete from '../components/AutoComplete';
import Input from '../components/Input';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

// ── Formulaire défini HORS du composant parent pour éviter la perte de focus ──
interface FormProps {
    form: ReturnType<typeof emptyForm>;
    setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyForm>>>;
    fonctionSuggestions: string[];
    fasciculeSuggestions: string[];
    brevetSuggestions: string[];
}

function emptyForm() {
    return {
        nom: '', prenom: '', fonction: '', fascicule: '', brevets: '',
        dateNaissance: '', lieuNaissance: '', telephone: '', email: '',
    };
}

function MemberForm({ form, setForm, fonctionSuggestions, fasciculeSuggestions, brevetSuggestions }: FormProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nom *" value={form.nom}
                onChange={e => setForm(f => ({ ...f, nom: e.target.value.toUpperCase() }))}
                placeholder="NOM" />
            <Input label="Prénom *" value={form.prenom}
                onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                placeholder="Prénom" />

            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                    Fonction *
                </label>
                <AutoComplete value={form.fonction}
                    onChange={v => setForm(f => ({ ...f, fonction: v }))}
                    suggestions={fonctionSuggestions} placeholder="Fonction..." />
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                    Fascicule / LPM *
                </label>
                <AutoComplete value={form.fascicule}
                    onChange={v => setForm(f => ({ ...f, fascicule: v }))}
                    suggestions={fasciculeSuggestions} placeholder="Fascicule..." />
            </div>

            <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                    Brevets *
                </label>
                <AutoComplete value={form.brevets}
                    onChange={v => setForm(f => ({ ...f, brevets: v }))}
                    suggestions={brevetSuggestions}
                    placeholder="Ex: STCW - BST - FPFF..." />
            </div>

            <DatePicker label="Date de naissance *" value={form.dateNaissance}
                onChange={v => setForm(f => ({ ...f, dateNaissance: v }))} />
            <Input label="Lieu de naissance *" value={form.lieuNaissance}
                onChange={e => setForm(f => ({ ...f, lieuNaissance: e.target.value }))}
                placeholder="Lieu de naissance" />
            <Input label="Téléphone *" type="tel" value={form.telephone}
                onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
                placeholder="+261..." />
            <Input label="Email" type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@..." />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
export default function CrewPage() {
    const members = useLiveQuery(() => db.crewMembers.orderBy('nom').toArray()) ?? [];
    const dynamicValues = useLiveQuery(() => db.dynamicValues.toArray()) ?? [];

    const [search, setSearch] = useState('');
    const [modal, setModal] = useState<'add' | 'edit' | 'view' | null>(null);
    const [active, setActive] = useState<CrewMember | null>(null);
    const [form, setForm] = useState(emptyForm());
    const [deleting, setDeleting] = useState<CrewMember | null>(null);
    const [formError, setFormError] = useState('');

    const confirmDelete = async () => {
        if (deleting?.id) await db.crewMembers.delete(deleting.id);
        setDeleting(null);
    };

    const getSuggestions = (type: 'fonction' | 'fascicule' | 'brevet') =>
        dynamicValues.filter(v => v.type === type).map(v => v.value);

    const openAdd = () => { setActive(null); setForm(emptyForm()); setFormError(''); setModal('add'); };
    const openEdit = (m: CrewMember) => {
        setActive(m);
        setForm({
            nom: m.nom, prenom: m.prenom, fonction: m.fonction, fascicule: m.fascicule,
            brevets: m.brevets, dateNaissance: m.dateNaissance, lieuNaissance: m.lieuNaissance,
            telephone: m.telephone ?? '', email: m.email ?? ''
        });
        setModal('edit'); setFormError(''); setModal('edit');
    };

    const openView = (m: CrewMember) => { setActive(m); setModal('view'); };

    const save = async () => {
        // ── Validation champs requis ─────────────────────────────────────
        const required: Record<string, string> = {};
        if (!form.nom.trim()) required.nom = 'Le nom est requis';
        if (!form.prenom.trim()) required.prenom = 'Le prénom est requis';
        if (!form.fonction.trim()) required.fonction = 'La fonction est requise';
        if (!form.fascicule.trim()) required.fascicule = 'Le fascicule / LPM est requis';
        if (!form.brevets.trim()) required.brevets = 'Les brevets sont requis';
        if (!form.dateNaissance.trim()) required.dateNaissance = 'La date de naissance est requise';
        if (!form.lieuNaissance.trim()) required.lieuNaissance = 'Le lieu de naissance est requis';
        if (!form.telephone.trim()) required.telephone = 'Le téléphone est requis';

        if (Object.keys(required).length > 0) {
            // Afficher la première erreur rencontrée
            setFormError(Object.values(required)[0]);
            return;
        }

        // ── Vérifications d'unicité ──────────────────────────────────────
        const editingId = (modal === 'edit' && active?.id) ? active.id : null;

        // 1. Nom + prénom identiques
        const sameNameExists = await db.crewMembers
            .filter(m =>
                m.nom.toUpperCase() === form.nom.toUpperCase().trim() &&
                m.prenom.toUpperCase() === form.prenom.toUpperCase().trim() &&
                m.id !== editingId
            ).count();
        if (sameNameExists > 0) {
            setFormError('Un membre avec ce nom et prénom existe déjà.');
            return;
        }

        // 2. Fascicule
        if (form.fascicule.trim()) {
            const sameFascicule = await db.crewMembers
                .filter(m =>
                    m.fascicule.trim() === form.fascicule.trim() &&
                    m.id !== editingId
                ).count();
            if (sameFascicule > 0) {
                setFormError('Ce numéro de fascicule est déjà utilisé.');
                return;
            }
        }

        // 3. Email
        if (form.email.trim()) {
            const sameEmail = await db.crewMembers
                .filter(m =>
                    m.email.trim().toLowerCase() === form.email.trim().toLowerCase() &&
                    m.id !== editingId
                ).count();
            if (sameEmail > 0) {
                setFormError('Cet email est déjà utilisé par un autre membre.');
                return;
            }
        }

        // 4. Téléphone
        if (form.telephone.trim()) {
            const samePhone = await db.crewMembers
                .filter(m =>
                    m.telephone.trim() === form.telephone.trim() &&
                    m.id !== editingId
                ).count();
            if (samePhone > 0) {
                setFormError('Ce numéro de téléphone est déjà utilisé par un autre membre.');
                return;
            }
        }

        // ── Sauvegarde ───────────────────────────────────────────────────
        await addOrIncrementDynamic('fonction', form.fonction);
        await addOrIncrementDynamic('fascicule', form.fascicule);
        if (form.brevets) await addOrIncrementDynamic('brevet', form.brevets);

        if (modal === 'edit' && active?.id) {
            await db.crewMembers.update(active.id, { ...form, updatedAt: new Date() });
        } else {
            await db.crewMembers.add({ ...form, createdAt: new Date(), updatedAt: new Date() });
        }
        setFormError('');
        setModal(null);
    };

    const filtered = members.filter(m =>
        `${m.nom} ${m.prenom} ${m.fonction}`.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col gap-4 fade-in overflow-hidden">
            {/* En-tête fixe */}
            <div className="flex items-center justify-between flex-shrink-0">
                <h1 className="text-xl font-bold font-display text-white">
                    Membres d'équipage
                </h1>
                <button onClick={openAdd}
                    className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-500
          text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                    <Plus size={16} /> Ajouter
                </button>
            </div>

            {/* Barre de recherche fixe */}
            <div className="relative flex-shrink-0">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher par nom, fonction..."
                    className="w-full bg-navy-800 border border-navy-600 rounded-lg pl-9 pr-3
          py-2 text-sm text-slate-200 placeholder-slate-500
          focus:outline-none focus:border-ocean-500 transition" />
            </div>

            {/* Liste scrollable — touche le bas de l'écran */}
            <div className="flex-1 overflow-y-auto custom-scroll min-h-0 space-y-2 pb-4">
                {filtered.length === 0 ? (
                    <div className="bg-navy-800 border border-dashed border-navy-600
          rounded-xl p-10 text-center text-slate-500">
                        <Users size={28} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm">Aucun membre trouvé</p>
                    </div>
                ) : filtered.map(m => (
                    <div key={m.id} onClick={() => openView(m)}
                        className="bg-navy-800 border border-navy-600 rounded-xl p-4
            flex items-center justify-between hover:border-navy-500
            transition cursor-pointer">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-ocean-600/20 border border-ocean-600/30 flex items-center justify-center text-ocean-400 font-bold text-sm flex-shrink-0">
                                {m.nom[0]}{m.prenom[0]}
                            </div>
                            <div className="min-w-0">
                                <div className="font-semibold text-slate-200 text-sm truncate">
                                    {m.nom.toUpperCase()} {m.prenom}
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                    {m.fonction} · Fasc. {m.fascicule}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                            <button onClick={() => openEdit(m)}
                                className="text-slate-400 hover:text-ocean-400 transition p-1">
                                <Edit3 size={15} />
                            </button>
                            <button onClick={() => setDeleting(m)}
                                className="text-slate-400 hover:text-rose-400 transition p-1">
                                <Trash2 size={15} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal ajout / édition */}
            <Modal
                open={modal === 'add' || modal === 'edit'}
                onClose={() => setModal(null)}
                title={modal === 'edit' ? 'Modifier le membre' : 'Nouveau membre'}
            >
                <MemberForm
                    form={form} setForm={setForm}
                    fonctionSuggestions={getSuggestions('fonction')}
                    fasciculeSuggestions={getSuggestions('fascicule')}
                    brevetSuggestions={getSuggestions('brevet')}
                />
                {formError && (
                    <p className="text-rose-400 text-xs mt-4 p-3 bg-rose-500/10
    border border-rose-500/30 rounded-lg">
                        {formError}
                    </p>
                )}
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={() => setModal(null)}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">
                        Annuler
                    </button>
                    <button onClick={save}
                        className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-500 text-white
              px-5 py-2 rounded-lg text-sm font-medium transition">
                        <Save size={15} /> Enregistrer
                    </button>
                </div>
            </Modal>

            {/* Modal détails */}
            <Modal open={modal === 'view'} onClose={() => setModal(null)}
                title="Détails du membre" maxWidth="max-w-lg">
                {active && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-ocean-600/20 border border-ocean-600/30
                flex items-center justify-center text-ocean-400 font-bold text-xl flex-shrink-0">
                                {active.nom[0]}{active.prenom[0]}
                            </div>
                            <div>
                                <div className="text-lg font-bold text-white">
                                    {active.nom.toUpperCase()} {active.prenom}
                                </div>
                                <div className="text-sm text-ocean-400">{active.fonction}</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            {([
                                ['Fascicule / LPM', active.fascicule],
                                ['Brevets', active.brevets],
                                ['Naissance', active.dateNaissance && `${active.dateNaissance}${active.lieuNaissance ? ' — ' + active.lieuNaissance : ''}`],
                                ['Téléphone', active.telephone],
                                ['Email', active.email],
                            ] as [string, string][]).filter(([, v]) => v).map(([label, value]) => (
                                <div key={label} className="bg-navy-700 rounded-lg p-3">
                                    <div className="text-xs text-slate-500 mb-1">{label}</div>
                                    <div className="text-slate-200 text-sm">{value}</div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={() => { setModal(null); setTimeout(() => openEdit(active), 80); }}
                                className="flex items-center gap-2 bg-navy-700 hover:bg-navy-600 text-white
                  px-4 py-2 rounded-lg text-sm border border-navy-500 transition">
                                <Edit3 size={14} /> Modifier
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── Confirmation suppression ── */}
            <ConfirmDialog
                open={!!deleting}
                title="Supprimer la liste"
                message={`Supprimer "${deleting?.nom.toUpperCase()} ${deleting?.prenom}" ? Cette action est irréversible.`}
                confirmLabel="Supprimer"
                danger
                onConfirm={confirmDelete}
                onCancel={() => setDeleting(null)}
            />
        </div>
    );
}