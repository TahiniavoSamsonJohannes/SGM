import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    Plus, Search, FileText, Edit3, Trash2,
    Download, User, ArrowLeft,
    CheckCircle, XCircle,
} from 'lucide-react';
import {
    db, type Contract, type CrewMember,
    computeContractTotals, isContractActive,
    addOrIncrementDynamic,
} from '../db';
import { generateContractPDF, type ContractPDFData } from '../pdfGenerator';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Input from '../components/Input';
import AutoComplete from '../components/AutoComplete';
import DatePicker from '../components/DatePicker';

// ── Formatage ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
    if (!iso) return '—';
    return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR');
}
function fmtNumber(n: number) {
    return n.toLocaleString('fr-FR');
}
function formatId(id: number | undefined) {
    return String(id ?? 0).padStart(10, '0');
}

// ── Formulaire vide ────────────────────────────────────────────────────────────
function emptyContractForm(): Omit<Contract, 'id' | 'crewMemberId' | 'createdAt' | 'updatedAt'> {
    return {
        shipName: '', immatriculation: '', fonction: '',
        dateDebut: '', dateFin: '',
        salaireBaseJournalier: 0, forfaitHeuresSupp: 0,
        salaireCongeJournalier: 0, indemRNC: 0,
        beneficiaire: '', numCompteBancaire: '', montantDelegation: 0,
    };
}

function emptyMemberForm() {
    return {
        nom: '', prenom: '', dateNaissance: '', lieuNaissance: '',
        adresse: '', fascicule: '', brevets: '', telephone: '',
        email: '', fonction: '', nationalite: 'MALAGASY',
    };
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function ContractsPage() {
    const contracts = useLiveQuery(() => db.contracts.toArray()) ?? [];
    const allMembers = useLiveQuery(() => db.crewMembers.orderBy('nom').toArray()) ?? [];
    const ships = useLiveQuery(() => db.ships.toArray()) ?? [];
    const dynValues = useLiveQuery(() => db.dynamicValues.toArray()) ?? [];

    const [search, setSearch] = useState('');
    const [modal, setModal] = useState<'form' | 'detail' | null>(null);
    const [editing, setEditing] = useState<Contract | null>(null);
    const [deleting, setDeleting] = useState<Contract | null>(null);
    const [viewing, setViewing] = useState<Contract | null>(null);

    // Formulaire contrat
    const [form, setForm] = useState(emptyContractForm());

    // Membre lié
    const [memberSearch, setMemberSearch] = useState('');
    const [selectedMember, setSelectedMember] = useState<CrewMember | null>(null);
    const [showNewMember, setShowNewMember] = useState(false);
    const [newMemberForm, setNewMemberForm] = useState(emptyMemberForm());
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const memberSuggestions = allMembers.map(m =>
        `${m.nom.toUpperCase()} ${m.prenom}`
    );

    const fonctionSuggestions = dynValues
        .filter(v => v.type === 'fonction').map(v => v.value);

    const shipSuggestions = ships.map(s =>
        `${s.nom.toUpperCase()} — ${s.immatriculation}`
    );

    // ── Totaux calculés ──────────────────────────────────────────────
    const totals = computeContractTotals({
        salaireBaseJournalier: form.salaireBaseJournalier,
        forfaitHeuresSupp: form.forfaitHeuresSupp,
        salaireCongeJournalier: form.salaireCongeJournalier,
        indemRNC: form.indemRNC,
    });

    // ── Sélection membre existant ────────────────────────────────────
    useEffect(() => {
        if (!memberSearch.trim()) { setSelectedMember(null); return; }
        const found = allMembers.find(m =>
            `${m.nom.toUpperCase()} ${m.prenom}` === memberSearch.trim()
        );
        if (found) {
            setSelectedMember(found);
            setShowNewMember(false);
        } else {
            setSelectedMember(null);
        }
    }, [memberSearch, allMembers]);

    // ── Ouverture formulaire ─────────────────────────────────────────
    const openCreate = () => {
        setEditing(null);
        setForm(emptyContractForm());
        setMemberSearch('');
        setSelectedMember(null);
        setShowNewMember(false);
        setNewMemberForm(emptyMemberForm());
        setFormErrors({});
        setModal('form');
    };

    const openEdit = (c: Contract) => {
        setEditing(c);
        setForm({
            shipName: c.shipName, immatriculation: c.immatriculation,
            fonction: c.fonction, dateDebut: c.dateDebut, dateFin: c.dateFin,
            salaireBaseJournalier: c.salaireBaseJournalier,
            forfaitHeuresSupp: c.forfaitHeuresSupp,
            salaireCongeJournalier: c.salaireCongeJournalier,
            indemRNC: c.indemRNC,
            beneficiaire: c.beneficiaire, numCompteBancaire: c.numCompteBancaire,
            montantDelegation: c.montantDelegation,
        });
        const member = allMembers.find(m => m.id === c.crewMemberId);
        if (member) {
            setMemberSearch(`${member.nom.toUpperCase()} ${member.prenom}`);
            setSelectedMember(member);
        }
        setFormErrors({});
        setModal('form');
    };

    // ── Sauvegarde ────────────────────────────────────────────────────
    const save = async () => {
        const errors: Record<string, string> = {};

        // Validation membre
        if (!selectedMember && !showNewMember)
            errors.member = 'Sélectionnez ou créez un membre';

        if (showNewMember) {
            if (!newMemberForm.nom.trim()) errors.newMember = 'Nom requis';
            else if (!newMemberForm.prenom.trim()) errors.newMember = 'Prénom requis';
            else if (!newMemberForm.dateNaissance) errors.newMember = 'Date de naissance requise';
            else if (!newMemberForm.fascicule.trim()) errors.newMember = 'Fascicule requis';
        }

        // Validation contrat
        if (!form.shipName.trim()) errors.shipName = 'Navire requis';
        if (!form.fonction.trim()) errors.fonction = 'Fonction requise';
        if (!form.dateDebut) errors.dateDebut = 'Date de début requise';
        if (!form.dateFin) errors.dateFin = 'Date de fin requise';

        if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

        const now = new Date();
        let memberId = selectedMember?.id;

        // ── Créer le membre à la volée ──────────────────────────────────
        if (!memberId && showNewMember) {
            memberId = await db.crewMembers.add({
                nom: newMemberForm.nom.toUpperCase().trim(),
                prenom: newMemberForm.prenom.trim(),
                fonction: newMemberForm.fonction.trim(),
                fascicule: newMemberForm.fascicule.trim(),
                brevets: newMemberForm.brevets.trim(),
                dateNaissance: newMemberForm.dateNaissance,
                lieuNaissance: newMemberForm.lieuNaissance.trim(),
                adresse: newMemberForm.adresse.trim(),
                telephone: newMemberForm.telephone.trim(),
                email: newMemberForm.email.trim(),
                nationalite: newMemberForm.nationalite.trim() || 'MALAGASY',
                createdAt: now,
                updatedAt: now,
            });

            // Enregistrer les valeurs dynamiques
            if (newMemberForm.nationalite)
                await addOrIncrementDynamic('nationalite', newMemberForm.nationalite);
            if (newMemberForm.fonction)
                await addOrIncrementDynamic('fonction', newMemberForm.fonction);
            if (newMemberForm.fascicule)
                await addOrIncrementDynamic('fascicule', newMemberForm.fascicule);
            if (newMemberForm.brevets)
                await addOrIncrementDynamic('brevet', newMemberForm.brevets);
        }

        if (!memberId) return;

        // ── Créer ou mettre à jour le contrat ───────────────────────────
        if (editing?.id) {
            await db.contracts.update(editing.id, {
                ...form,
                crewMemberId: memberId,
                updatedAt: now,
            });
        } else {
            await db.contracts.add({
                ...form,
                crewMemberId: memberId,
                createdAt: now,
                updatedAt: now,
            });
        }

        setModal(null);
    };

    // ── Export PDF ────────────────────────────────────────────────────
    const exportPDF = async (c: Contract) => {
        const member = allMembers.find(m => m.id === c.crewMemberId);
        if (!member) return;
        const pdfData: ContractPDFData = {
            nom: member.nom,
            prenom: member.prenom,
            dateNaissance: member.dateNaissance,
            lieuNaissance: member.lieuNaissance,
            adresse: member.adresse || '',
            fascicule: member.fascicule,
            shipName: c.shipName,
            immatriculation: c.immatriculation,
            fonction: c.fonction,
            dateDebut: c.dateDebut,
            dateFin: c.dateFin,
            salaireBaseJournalier: c.salaireBaseJournalier,
            forfaitHeuresSupp: c.forfaitHeuresSupp,
            salaireCongeJournalier: c.salaireCongeJournalier,
            indemRNC: c.indemRNC,
            beneficiaire: c.beneficiaire,
            numCompteBancaire: c.numCompteBancaire,
            montantDelegation: c.montantDelegation,
        };
        await generateContractPDF(pdfData);
    };

    // ── Tri et filtre ─────────────────────────────────────────────────
    const sorted = [...contracts].sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    const filtered = sorted.filter(c => {
        const member = allMembers.find(m => m.id === c.crewMemberId);
        const name = member ? `${member.nom} ${member.prenom}`.toLowerCase() : '';
        return (
            name.includes(search.toLowerCase()) ||
            c.shipName.toLowerCase().includes(search.toLowerCase()) ||
            c.fonction.toLowerCase().includes(search.toLowerCase())
        );
    });

    const viewingMember = viewing
        ? allMembers.find(m => m.id === viewing.crewMemberId)
        : null;

    // Ajouter cette fonction utilitaire dans le fichier :
    function computeDuration(dateDebut: string, dateFin: string): string {
        if (!dateDebut || !dateFin) return '—';
        const start = new Date(dateDebut + 'T00:00:00');
        const end = new Date(dateFin + 'T00:00:00');
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return '—';
        if (end < start) return 'Dates invalides';

        const totalDays = Math.floor(
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );

        const months = Math.floor(totalDays / 30);
        const days = totalDays % 30;

        const parts: string[] = [];
        if (months > 0) parts.push(`${months} mois`);
        if (days > 0) parts.push(`${days} jour${days > 1 ? 's' : ''}`);
        return parts.length > 0 ? parts.join(' ') : '0 jour';
    }

    return (
        <div className="h-full flex flex-col gap-4 overflow-hidden fade-in">

            {/* ── En-tête ── */}
            <div className="flex items-center justify-between flex-shrink-0">
                <h1 className="text-xl font-bold font-display text-white">
                    Contrats d'engagement
                </h1>
                <button onClick={openCreate}
                    className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-500
            text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                    <Plus size={15} /> Nouveau contrat
                </button>
            </div>

            {/* ── Recherche ── */}
            <div className="relative flex-shrink-0">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher par membre, navire, fonction..."
                    className="w-full bg-navy-800 border border-navy-600 rounded-lg pl-9 pr-3
            py-2 text-sm text-slate-200 placeholder-slate-500
            focus:outline-none focus:border-ocean-500 transition" />
            </div>

            {/* ── Liste ── */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scroll space-y-2 pb-4">
                {filtered.length === 0 ? (
                    <div className="bg-navy-800 border border-dashed border-navy-600
            rounded-xl p-10 text-center text-slate-500">
                        <FileText size={28} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm">Aucun contrat trouvé</p>
                    </div>
                ) : filtered.map(c => {
                    const member = allMembers.find(m => m.id === c.crewMemberId);
                    const active = isContractActive(c);
                    return (
                        <div key={c.id} onClick={() => { setViewing(c); setModal('detail'); }}
                            className="bg-navy-800 border border-navy-600 rounded-xl p-4
                hover:border-navy-500 transition cursor-pointer">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs text-slate-600 bg-navy-700
    px-2 py-0.5 rounded flex-shrink-0">
                                            #{formatId(c.id)}
                                        </span>
                                        <span className="font-semibold text-slate-200 text-sm truncate">
                                            {member
                                                ? `${member.nom.toUpperCase()} ${member.prenom}`
                                                : '—'
                                            }
                                        </span>
                                        <span className={`flex items-center gap-1 text-xs font-medium
    ${active ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {active
                                                ? <><CheckCircle size={11} /> Actif</>
                                                : <><XCircle size={11} /> Expiré</>
                                            }
                                        </span>
                                    </div>

                                    <div className="text-xs text-slate-400 mt-1 truncate">
                                        {c.fonction} — {c.shipName.toUpperCase()}
                                    </div>

                                    {/* Période + durée calculée */}
                                    <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-3">
                                        <span>Du {fmtDate(c.dateDebut)} au {fmtDate(c.dateFin)}</span>
                                        <span className="text-slate-600 font-medium">
                                            Durée : {computeDuration(c.dateDebut, c.dateFin)}
                                        </span>
                                    </div>

                                    <div className="text-xs text-slate-600 mt-0.5 font-mono">
                                        Total : {fmtNumber(computeContractTotals(c).totalGeneral)} Ar/mois
                                    </div>
                                </div>
                                <div className="flex gap-1 flex-shrink-0"
                                    onClick={e => e.stopPropagation()}>
                                    <button onClick={() => openEdit(c)}
                                        className="text-slate-400 hover:text-amber-400 transition p-1.5">
                                        <Edit3 size={15} />
                                    </button>
                                    <button onClick={() => exportPDF(c)}
                                        className="text-slate-400 hover:text-ocean-400 transition p-1.5">
                                        <Download size={15} />
                                    </button>
                                    <button onClick={() => setDeleting(c)}
                                        className="text-slate-400 hover:text-rose-400 transition p-1.5">
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Modal formulaire ── */}
            <Modal open={modal === 'form'} onClose={() => setModal(null)}
                title={editing ? `Modifier le contrat #${formatId(editing.id)}` : 'Nouveau contrat'}
                maxWidth="max-w-2xl">
                <div className="space-y-5">

                    {/* Membre */}
                    {/* ── Bloc membre ── */}
                    <div className="bg-navy-700 rounded-xl p-4 space-y-3">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider
    flex items-center gap-2">
                            <User size={12} /> Membre d'équipage
                        </h3>

                        {!showNewMember ? (
                            <>
                                {/* Recherche membre existant */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                        Rechercher un membre existant
                                    </label>
                                    <AutoComplete
                                        value={memberSearch}
                                        onChange={v => { setMemberSearch(v); setFormErrors(e => ({ ...e, member: '' })); }}
                                        suggestions={memberSuggestions}
                                        placeholder="Nom complet du membre..."
                                    />
                                    {formErrors.member && (
                                        <p className="text-rose-400 text-xs mt-1">{formErrors.member}</p>
                                    )}
                                </div>

                                {/* Aperçu membre trouvé */}
                                {selectedMember && (
                                    <div className="bg-navy-600 rounded-lg p-3 text-xs text-slate-300 space-y-1">
                                        <div className="font-semibold text-slate-200 text-sm">
                                            {selectedMember.nom.toUpperCase()} {selectedMember.prenom}
                                        </div>
                                        <div>DDN : {fmtDate(selectedMember.dateNaissance)}
                                            {selectedMember.lieuNaissance && ` — ${selectedMember.lieuNaissance}`}
                                        </div>
                                        {selectedMember.fascicule && (
                                            <div>Fascicule : {selectedMember.fascicule}</div>
                                        )}
                                        {selectedMember.adresse && (
                                            <div>Adresse : {selectedMember.adresse}</div>
                                        )}
                                    </div>
                                )}

                                {/* Bouton créer si membre introuvable */}
                                {memberSearch.trim() && !selectedMember && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            // Pré-remplir le nom depuis la recherche
                                            const parts = memberSearch.trim().split(' ');
                                            setNewMemberForm(f => ({
                                                ...f,
                                                nom: parts[0]?.toUpperCase() ?? '',
                                                prenom: parts.slice(1).join(' ') ?? '',
                                            }));
                                            setShowNewMember(true);
                                        }}
                                        className="text-xs text-ocean-400 hover:text-ocean-300
            hover:underline transition"
                                    >
                                        + Créer "{memberSearch}" comme nouveau membre →
                                    </button>
                                )}

                                {/* Aussi proposer si champ vide */}
                                {!memberSearch.trim() && (
                                    <button
                                        type="button"
                                        onClick={() => { setNewMemberForm(emptyMemberForm()); setShowNewMember(true); }}
                                        className="text-xs text-slate-500 hover:text-slate-300
            hover:underline transition"
                                    >
                                        + Créer un nouveau membre
                                    </button>
                                )}
                            </>
                        ) : (
                            /* ── Sous-formulaire nouveau membre ── */
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-300">
                                        Nouveau membre d'équipage
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => { setShowNewMember(false); setNewMemberForm(emptyMemberForm()); }}
                                        className="text-xs text-slate-500 hover:text-white transition
            flex items-center gap-1"
                                    >
                                        <ArrowLeft size={12} /> Rechercher existant
                                    </button>
                                </div>

                                {formErrors.newMember && (
                                    <p className="text-rose-400 text-xs p-2 bg-rose-500/10
          border border-rose-500/20 rounded-lg">
                                        {formErrors.newMember}
                                    </p>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Input
                                        label="Nom *"
                                        value={newMemberForm.nom}
                                        onChange={e => setNewMemberForm(f => ({
                                            ...f, nom: e.target.value.toUpperCase()
                                        }))}
                                        placeholder="NOM"
                                    />
                                    <Input
                                        label="Prénom *"
                                        value={newMemberForm.prenom}
                                        onChange={e => setNewMemberForm(f => ({ ...f, prenom: e.target.value }))}
                                        placeholder="Prénom"
                                    />
                                    <DatePicker
                                        label="Date de naissance *"
                                        value={newMemberForm.dateNaissance}
                                        onChange={v => setNewMemberForm(f => ({ ...f, dateNaissance: v }))}
                                    />
                                    <Input
                                        label="Lieu de naissance *"
                                        value={newMemberForm.lieuNaissance}
                                        onChange={e => setNewMemberForm(f => ({ ...f, lieuNaissance: e.target.value }))}
                                        placeholder="Lieu de naissance"
                                    />
                                    <div className="col-span-1 sm:col-span-2">
                                        <Input
                                            label="Adresse *"
                                            value={newMemberForm.adresse}
                                            onChange={e => setNewMemberForm(f => ({ ...f, adresse: e.target.value }))}
                                            placeholder="Adresse complète"
                                        />
                                    </div>
                                    <Input
                                        label="Fascicule / LPM *"
                                        value={newMemberForm.fascicule}
                                        onChange={e => setNewMemberForm(f => ({ ...f, fascicule: e.target.value }))}
                                        placeholder="Ex: MJ 22 236"
                                    />
                                    <Input
                                        label="Téléphone"
                                        type="tel"
                                        value={newMemberForm.telephone}
                                        onChange={e => setNewMemberForm(f => ({ ...f, telephone: e.target.value }))}
                                        placeholder="+261..."
                                    />
                                    <Input
                                        label="Email"
                                        type="email"
                                        value={newMemberForm.email}
                                        onChange={e => setNewMemberForm(f => ({ ...f, email: e.target.value }))}
                                        placeholder="email@..."
                                    />
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">
                                            Nationalité
                                        </label>
                                        <AutoComplete
                                            value={newMemberForm.nationalite}
                                            onChange={v => setNewMemberForm(f => ({ ...f, nationalite: v }))}
                                            suggestions={dynValues
                                                .filter(v => v.type === 'nationalite')
                                                .map(v => v.value)}
                                            placeholder="MALAGASY..."
                                        />
                                    </div>
                                    <div className="col-span-1 sm:col-span-2">
                                        <label className="block text-xs font-medium text-slate-400 mb-1">
                                            Brevets
                                        </label>
                                        <AutoComplete
                                            value={newMemberForm.brevets}
                                            onChange={v => setNewMemberForm(f => ({ ...f, brevets: v }))}
                                            suggestions={dynValues
                                                .filter(v => v.type === 'brevet')
                                                .map(v => v.value)}
                                            placeholder="BASE / STCW / ..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Infos navire + fonction */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">
                                Navire *
                            </label>
                            <AutoComplete value={form.shipName}
                                onChange={v => {
                                    const ship = ships.find(s =>
                                        `${s.nom.toUpperCase()} — ${s.immatriculation}` === v
                                    );
                                    setForm(f => ({
                                        ...f,
                                        shipName: ship ? ship.nom : v,
                                        immatriculation: ship ? ship.immatriculation : f.immatriculation,
                                    }));
                                }}
                                suggestions={shipSuggestions}
                                placeholder="Navire..." />
                            {formErrors.shipName && (
                                <p className="text-rose-400 text-xs mt-1">{formErrors.shipName}</p>
                            )}
                        </div>
                        <Input label="Immatriculation" value={form.immatriculation}
                            onChange={e => setForm(f => ({ ...f, immatriculation: e.target.value }))}
                            placeholder="MG-001" />
                        <div className="col-span-1 sm:col-span-2">
                            <label className="block text-xs font-medium text-slate-400 mb-1">
                                Fonction *
                            </label>
                            <AutoComplete value={form.fonction}
                                onChange={v => setForm(f => ({ ...f, fonction: v }))}
                                suggestions={fonctionSuggestions} placeholder="Fonction..." />
                            {formErrors.fonction && (
                                <p className="text-rose-400 text-xs mt-1">{formErrors.fonction}</p>
                            )}
                        </div>
                    </div>

                    {/* Durée */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <DatePicker label="Date de début *" value={form.dateDebut}
                                onChange={v => setForm(f => ({ ...f, dateDebut: v }))} />
                            {formErrors.dateDebut && (
                                <p className="text-rose-400 text-xs mt-1">{formErrors.dateDebut}</p>
                            )}
                        </div>
                        <div>
                            <DatePicker label="Date de fin *" value={form.dateFin}
                                onChange={v => setForm(f => ({ ...f, dateFin: v }))} />
                            {formErrors.dateFin && (
                                <p className="text-rose-400 text-xs mt-1">{formErrors.dateFin}</p>
                            )}
                        </div>
                    </div>

                    {/* Salaires */}
                    <div className="bg-navy-700 rounded-xl p-4 space-y-3">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Rémunération
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {([
                                ['Salaire base journalier (Ar)', 'salaireBaseJournalier'],
                                ['Forfait heures supp. (Ar/mois)', 'forfaitHeuresSupp'],
                                ['Salaire congé journalier (Ar)', 'salaireCongeJournalier'],
                                ['Indemnité RNC (Ar)', 'indemRNC'],
                            ] as [string, keyof typeof form][]).map(([label, key]) => (
                                <div key={key}>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                        {label}
                                    </label>
                                    <input
                                        type="number" min={0}
                                        value={form[key] as number || ''}
                                        onChange={e => setForm(f => ({
                                            ...f, [key]: parseFloat(e.target.value) || 0,
                                        }))}
                                        className="w-full bg-navy-800 border border-navy-600 rounded-lg
                      px-3 py-2 text-sm text-slate-200 focus:outline-none
                      focus:border-ocean-500 transition"
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Totaux calculés */}
                        <div className="border-t border-navy-600 pt-3 space-y-1 text-xs">
                            {[
                                [`Base × 30 :`, totals.totalSalaireBase],
                                [`Forfait :`, totals.totalForfait],
                                [`Congé × 6 :`, totals.totalConge],
                                [`RNC × 12 :`, totals.totalRNC],
                            ].map(([label, val]) => (
                                <div key={String(label)} className="flex justify-between text-slate-500">
                                    <span>{label}</span>
                                    <span className="font-mono">{fmtNumber(val as number)} Ar</span>
                                </div>
                            ))}
                            <div className="flex justify-between text-slate-200 font-semibold pt-1
                border-t border-navy-600">
                                <span>TOTAL mensuel :</span>
                                <span className="font-mono text-ocean-400">
                                    {fmtNumber(totals.totalGeneral)} Ar
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Délégation */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input label="Bénéficiaire" value={form.beneficiaire}
                            onChange={e => setForm(f => ({ ...f, beneficiaire: e.target.value }))}
                            placeholder="Nom du bénéficiaire" />
                        <Input label="N° compte bancaire" value={form.numCompteBancaire}
                            onChange={e => setForm(f => ({ ...f, numCompteBancaire: e.target.value }))}
                            placeholder="N° compte" />
                        <div className="col-span-1 sm:col-span-2">
                            <label className="block text-xs font-medium text-slate-400 mb-1">
                                Montant délégation (Ar)
                            </label>
                            <input type="number" min={0}
                                value={form.montantDelegation || ''}
                                onChange={e => setForm(f => ({
                                    ...f, montantDelegation: parseFloat(e.target.value) || 0,
                                }))}
                                className="w-full bg-navy-800 border border-navy-600 rounded-lg
                  px-3 py-2 text-sm text-slate-200 focus:outline-none
                  focus:border-ocean-500 transition" />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setModal(null)}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">
                            Annuler
                        </button>
                        <button onClick={save}
                            className="bg-ocean-600 hover:bg-ocean-500 text-white px-5 py-2
                rounded-lg text-sm font-medium transition">
                            Enregistrer
                        </button>
                    </div>
                </div>
            </Modal>

            {/* ── Modal détail ── */}
            <Modal open={modal === 'detail'} onClose={() => { setModal(null); setViewing(null); }}
                title={`Contrat #${formatId(viewing?.id)}`} maxWidth="max-w-lg">
                {viewing && viewingMember && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            {([
                                ['Membre', `${viewingMember.nom.toUpperCase()} ${viewingMember.prenom}`],
                                ['Navire', viewing.shipName.toUpperCase()],
                                ['Immat.', viewing.immatriculation],
                                ['Fonction', viewing.fonction],
                                ['Début', fmtDate(viewing.dateDebut)],
                                ['Fin', fmtDate(viewing.dateFin)],
                                ['Statut', isContractActive(viewing) ? '✓ Actif' : '✗ Expiré'],
                                ['Bénéficiaire', viewing.beneficiaire],
                                ['Compte', viewing.numCompteBancaire],
                            ] as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
                                <div key={k} className="bg-navy-700 rounded-lg p-3">
                                    <div className="text-xs text-slate-500 mb-1">{k}</div>
                                    <div className={`text-sm ${k === 'Statut'
                                        ? (isContractActive(viewing) ? 'text-emerald-400' : 'text-rose-400')
                                        : 'text-slate-200'
                                        }`}>{v}</div>
                                </div>
                            ))}
                        </div>

                        {/* Récap salaires */}
                        <div className="bg-navy-700 rounded-xl p-4 space-y-2 text-xs">
                            <div className="font-semibold text-slate-300 mb-2">Rémunération</div>
                            {[
                                ['Base journalière', `${fmtNumber(viewing.salaireBaseJournalier)} Ar × 30 = ${fmtNumber(computeContractTotals(viewing).totalSalaireBase)} Ar`],
                                ['Forfait supp.', `${fmtNumber(viewing.forfaitHeuresSupp)} Ar`],
                                ['Congé journalier', `${fmtNumber(viewing.salaireCongeJournalier)} Ar × 6 = ${fmtNumber(computeContractTotals(viewing).totalConge)} Ar`],
                                ['Indemnité RNC', `${fmtNumber(viewing.indemRNC)} Ar × 12 = ${fmtNumber(computeContractTotals(viewing).totalRNC)} Ar`],
                            ].map(([label, val]) => (
                                <div key={label} className="flex justify-between text-slate-400">
                                    <span>{label}</span>
                                    <span className="font-mono">{val}</span>
                                </div>
                            ))}
                            <div className="flex justify-between text-slate-200 font-semibold
                pt-2 border-t border-navy-600">
                                <span>TOTAL mensuel</span>
                                <span className="font-mono text-ocean-400">
                                    {fmtNumber(computeContractTotals(viewing).totalGeneral)} Ar
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setModal(null); openEdit(viewing); }}
                                className="flex items-center gap-2 bg-navy-700 hover:bg-navy-600
                  text-white px-4 py-2 rounded-lg text-sm border border-navy-500 transition">
                                <Edit3 size={14} /> Modifier
                            </button>
                            <button onClick={() => exportPDF(viewing)}
                                className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-500
                  text-white px-4 py-2 rounded-lg text-sm transition">
                                <Download size={14} /> PDF
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── Confirmation suppression ── */}
            <ConfirmDialog
                open={!!deleting}
                title="Supprimer le contrat"
                message={`Supprimer le contrat #${formatId(deleting?.id)} ? Cette action est irréversible.`}
                confirmLabel="Supprimer" danger
                onConfirm={async () => {
                    if (deleting?.id) await db.contracts.delete(deleting.id);
                    setDeleting(null);
                }}
                onCancel={() => setDeleting(null)}
            />
        </div>
    );
}