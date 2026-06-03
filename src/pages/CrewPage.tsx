import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Edit3, Trash2, Save, Users, Search } from 'lucide-react';
import {
    db, addOrIncrementDynamic,
    type CrewMember,
    enrichMembersWithFonction,
} from '../db';
import AutoComplete from '../components/AutoComplete';
import Input from '../components/Input';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import DatePicker from '../components/DatePicker';
import { fmtDate } from '../utils/fmt';

// ── emptyForm sans fonction ────────────────────────────────────────
function emptyForm() {
    return {
        nom: '', prenom: '', fascicule: '', brevets: '',
        dateNaissance: '', lieuNaissance: '', adresse: '',
        telephone: '', email: '', nationalite: '',
    };
}

interface FormProps {
    form: ReturnType<typeof emptyForm>;
    setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyForm>>>;
    fasciculeSuggestions: string[];
    brevetSuggestions: string[];
    nationSuggestions: string[];
}

// ── MemberForm sans champ fonction ────────────────────────────────
function MemberForm({
    form, setForm,
    fasciculeSuggestions, brevetSuggestions, nationSuggestions,
}: FormProps) {
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
                    Fascicule *
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

            <div className="col-span-1 sm:col-span-2">
                <Input label="Adresse *" value={form.adresse}
                    onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                    placeholder="Adresse complète" />
            </div>

            <Input label="Téléphone *" type="tel" value={form.telephone}
                onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
                placeholder="+261..." />
            <Input label="Email *" type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@..." />

            <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                    Nationalité *
                </label>
                <AutoComplete value={form.nationalite}
                    onChange={v => setForm(f => ({ ...f, nationalite: v }))}
                    suggestions={nationSuggestions}
                    placeholder="Ex: MALAGASY..." />
            </div>
        </div>
    );
}

// ── Page Équipage ─────────────────────────────────────────────────
export default function CrewPage() {
    const membersWithFonction = useLiveQuery(async () => {
        const members = await db.crewMembers.toArray();
        console.log('MEMBERS', members);
        
        if (members.length === 0) return [];
        return enrichMembersWithFonction(members);
    }, []) ?? [];
    const dynamicValues = useLiveQuery(() => db.dynamicValues.toArray()) ?? [];

    // Tri décroissant par updatedAt
    const members = [...membersWithFonction].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    const [search, setSearch] = useState('');
    const [modal, setModal] = useState<'add' | 'edit' | 'view' | null>(null);
    const [active, setActive] = useState<CrewMember | null>(null);
    const [form, setForm] = useState(emptyForm());
    const [formError, setFormError] = useState('');
    const [deleting, setDeleting] = useState<CrewMember | null>(null);

    const getSuggestions = (type: 'fascicule' | 'brevet' | 'nationalite') =>
        dynamicValues.filter(v => v.type === type).map(v => v.value);

    const openAdd = () => {
        setActive(null); setForm(emptyForm()); setFormError(''); setModal('add');
    };
    const openEdit = (m: CrewMember) => {
        setActive(m);
        setForm({
            nom: m.nom, prenom: m.prenom,
            fascicule: m.fascicule, brevets: m.brevets,
            dateNaissance: m.dateNaissance, lieuNaissance: m.lieuNaissance,
            adresse: m.adresse ?? '',
            telephone: m.telephone ?? '', email: m.email ?? '',
            nationalite: m.nationalite ?? '',
        });
        setFormError(''); setModal('edit');
    };
    const openView = (m: CrewMember) => { setActive(m); setModal('view'); };

    const save = async () => {
        // Validation
        const required: Record<string, string> = {};
        if (!form.nom.trim()) required.nom = 'Nom requis';
        if (!form.prenom.trim()) required.prenom = 'Prénom requis';
        if (!form.fascicule.trim()) required.fascicule = 'Fascicule requis';
        if (!form.brevets.trim()) required.brevets = 'Brevets requis';
        if (!form.dateNaissance) required.ddn = 'Date de naissance requise';
        if (!form.lieuNaissance.trim()) required.lieu = 'Lieu de naissance requis';
        if (!form.adresse.trim()) required.adresse = 'Adresse requise';
        if (!form.telephone.trim()) required.tel = 'Téléphone requis';
        if (!form.email.trim()) required.email = 'Email requis';
        if (!form.nationalite.trim()) required.nat = 'Nationalité requise';

        if (Object.keys(required).length > 0) {
            setFormError(Object.values(required)[0]);
            return;
        }

        const editId = modal === 'edit' && active?.id ? active.id : null;

        // Unicité
        const sameNameExists = await db.crewMembers.filter(m =>
            m.nom.toUpperCase() === form.nom.toUpperCase().trim() &&
            m.prenom.toUpperCase() === form.prenom.toUpperCase().trim() &&
            m.id !== editId
        ).count();
        if (sameNameExists > 0) { setFormError('Ce membre existe déjà.'); return; }

        const sameFascicule = await db.crewMembers.filter(m =>
            m.fascicule.trim() === form.fascicule.trim() && m.id !== editId
        ).count();
        if (sameFascicule > 0) { setFormError('Ce fascicule est déjà utilisé.'); return; }

        if (form.email.trim()) {
            const sameEmail = await db.crewMembers.filter(m =>
                m.email.trim().toLowerCase() === form.email.trim().toLowerCase() &&
                m.id !== editId
            ).count();
            if (sameEmail > 0) { setFormError('Cet email est déjà utilisé.'); return; }
        }

        await addOrIncrementDynamic('fascicule', form.fascicule);
        await addOrIncrementDynamic('brevet', form.brevets);
        await addOrIncrementDynamic('nationalite', form.nationalite);

        const now = new Date();
        if (editId) {
            await db.crewMembers.update(editId, { ...form, updatedAt: now });
        } else {
            await db.crewMembers.add({ ...form, createdAt: now, updatedAt: now });
        }
        setFormError('');
        setModal(null);
    };

    const del = async (id: number) => {
        await db.crewMembers.delete(id);
        setDeleting(null);
    };

    const filtered = members.filter(m =>
        `${m.nom} ${m.prenom} ${m.fonction}`
            .toLowerCase()
            .includes(search.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col gap-4 overflow-hidden fade-in">

            {/* En-tête */}
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

            {/* Recherche */}
            <div className="relative flex-shrink-0">
                <Search size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher par nom, fascicule..."
                    className="w-full bg-navy-800 border border-navy-600 rounded-lg
            pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500
            focus:outline-none focus:border-ocean-500 transition" />
            </div>

            {/* Liste scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scroll space-y-2 pb-4">
                {filtered.length === 0 ? (
                    <div className="bg-navy-800 border border-dashed border-navy-600
            rounded-xl p-10 text-center text-slate-500">
                        <Users size={28} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm">Aucun membre trouvé</p>
                    </div>
                ) : filtered.map(m => {
                    return (
                        <div key={m.id} onClick={() => openView(m)}
                            className="bg-navy-800 border border-navy-600 rounded-xl p-4
                flex items-center justify-between hover:border-navy-500
                transition cursor-pointer">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-full bg-ocean-600/20
                  border border-ocean-600/30 flex items-center justify-center
                  text-ocean-400 font-bold text-sm flex-shrink-0">
                                    {m.nom[0]}{m.prenom[0]}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-semibold text-slate-200 text-sm truncate">
                                        {m.nom.toUpperCase()} {m.prenom}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate flex items-center gap-1.5 flex-wrap">
                                        <span>{m.fonction || '—'}</span>
                                        {m.contratActif === true && (
                                            <span className="inline-flex items-center gap-0.5 text-emerald-400
      bg-emerald-400/10 px-1.5 py-0.5 rounded-full text-xs font-medium
      flex-shrink-0">
                                                Actif
                                            </span>
                                        )}
                                        {m.contratActif === false && (
                                            <span className="inline-flex items-center gap-0.5 text-rose-400
      bg-rose-400/10 px-1.5 py-0.5 rounded-full text-xs font-medium
      flex-shrink-0">
                                                Expiré
                                            </span>
                                        )}
                                        {m.contratActif === null && (
                                            <span className="inline-flex items-center gap-0.5 text-slate-600
      bg-slate-600/10 px-1.5 py-0.5 rounded-full text-xs flex-shrink-0">
                                                Sans contrat
                                            </span>
                                        )}
                                        <span className="text-slate-600">· Fasc. {m.fascicule}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0 ml-2"
                                onClick={e => e.stopPropagation()}>
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
                    );
                })}
            </div>

            {/* Modal ajout/édition */}
            <Modal open={modal === 'add' || modal === 'edit'} onClose={() => setModal(null)}
                title={modal === 'edit' ? 'Modifier le membre' : 'Nouveau membre'}>
                <MemberForm
                    form={form} setForm={setForm}
                    fasciculeSuggestions={getSuggestions('fascicule')}
                    brevetSuggestions={getSuggestions('brevet')}
                    nationSuggestions={getSuggestions('nationalite')}
                />
                {formError && (
                    <p className="text-rose-400 text-xs mt-4 p-3 bg-rose-500/10
            border border-rose-500/20 rounded-lg">
                        {formError}
                    </p>
                )}
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={() => setModal(null)}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">
                        Annuler
                    </button>
                    <button onClick={save}
                        className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-500
              text-white px-5 py-2 rounded-lg text-sm font-medium transition">
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
                            <div className="w-14 h-14 rounded-full bg-ocean-600/20
                border border-ocean-600/30 flex items-center justify-center
                text-ocean-400 font-bold text-xl flex-shrink-0">
                                {active.nom[0]}{active.prenom[0]}
                            </div>
                            <div>
                                <div className="text-lg font-bold text-white">
                                    {active.nom.toUpperCase()} {active.prenom}
                                </div>
                                <div className="text-sm flex items-center gap-2 flex-wrap">
                                    <span className="text-ocean-400">
                                        {membersWithFonction.find(m => m.id === active.id)?.fonction || '—'}
                                    </span>
                                    {(() => {
                                        const mwf = membersWithFonction.find(m => m.id === active.id);
                                        if (!mwf) return null;
                                        if (mwf.contratActif === true) return (
                                            <span className="text-xs text-emerald-400 bg-emerald-400/10
        px-2 py-0.5 rounded-full font-medium">
                                                Contrat actif
                                            </span>
                                        );
                                        if (mwf.contratActif === false) return (
                                            <span className="text-xs text-rose-400 bg-rose-400/10
        px-2 py-0.5 rounded-full font-medium">
                                                Contrat expiré
                                            </span>
                                        );
                                        return (
                                            <span className="text-xs text-slate-500 bg-slate-600/10
        px-2 py-0.5 rounded-full">
                                                Sans contrat
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            {([
                                ['Fascicule', active.fascicule],
                                ['Brevets', active.brevets],
                                ['Nationalité', active.nationalite],
                                ['Naissance', active.dateNaissance
                                    ? `${fmtDate(new Date(active.dateNaissance))}${active.lieuNaissance ? ', ' + active.lieuNaissance : ''}`
                                    : ''],
                                ['Adresse', active.adresse],
                                ['Téléphone', active.telephone],
                                ['Email', active.email],
                            ] as [string, string][])
                                .filter(([, v]) => v)
                                .map(([label, value]) => (
                                    <div key={label} className="bg-navy-700 rounded-lg p-3">
                                        <div className="text-xs text-slate-500 mb-1">{label}</div>
                                        <div className="text-slate-200 text-sm break-words">{value}</div>
                                    </div>
                                ))
                            }
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => { setModal(null); setTimeout(() => openEdit(active), 80); }}
                                className="flex items-center gap-2 bg-navy-700 hover:bg-navy-600
                  text-white px-4 py-2 rounded-lg text-sm border border-navy-500 transition">
                                <Edit3 size={14} /> Modifier
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Confirmation suppression */}
            <ConfirmDialog
                open={!!deleting}
                title="Supprimer le membre"
                message={`Supprimer ${deleting?.nom} ${deleting?.prenom} ? Cette action est irréversible.`}
                confirmLabel="Supprimer" danger
                onConfirm={() => deleting?.id && del(deleting.id)}
                onCancel={() => setDeleting(null)}
            />
        </div>
    );
}