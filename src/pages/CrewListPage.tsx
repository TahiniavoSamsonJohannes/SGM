import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    Save, Download, Search, AlertCircle, CheckSquare, ArrowLeft,
} from 'lucide-react';
import { db, enrichCrewListMembers, enrichMembersWithFonction, type CrewList } from '../db';
import { generateCrewListPDF } from '../pdfGenerator';
import AutoComplete from '../components/AutoComplete';
import Input from '../components/Input';
import CustomSelect from '../components/CustomSelect';
import { sortCrewByHierarchy } from '../utils/crewSort';

interface Props {
    editingList?: CrewList | null;
    onSaved?: () => void;
    onBack?: () => void;
}

// Formate id sur 10 chiffres
function formatId(id: number | undefined): string {
    return String(id ?? 0).padStart(10, '0');
}

export default function CrewListPage({ editingList, onSaved, onBack }: Props) {

    const membersWithFonction = useLiveQuery(async () => {
        const members = await db.crewMembers.toArray();

        if (members.length === 0) return [];
        return enrichMembersWithFonction(members);
    }, []) ?? [];

    const ships = useLiveQuery(() => db.ships.toArray()) ?? [];
    const captains = membersWithFonction.filter(m =>
        m.fonction.toUpperCase().includes('CAPITAINE')
    );

    const [shipId, setShipId] = useState('');
    const [capitaine, setCapitaine] = useState('');
    const [lieuDepart, setLieuDepart] = useState('');
    const [destination, setDestination] = useState('');
    const [referDossier, setReferDossier] = useState('');
    const [selected, setSelected] = useState<number[]>([]);
    const [search, setSearch] = useState('');
    const [saved, setSaved] = useState(false);

    // Erreurs de validation
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Capitaine auto-sélection
    const [capitaineError, setCapitaineError] = useState('');
    const lastAutoSelectedCapRef = useRef<number | null>(null);


    // ── Pré-remplir si édition ─────────────────────────────────────────
    useEffect(() => {
        if (editingList) {
            setShipId(String(editingList.shipId));
            setCapitaine(editingList.capitaine);
            setLieuDepart(editingList.lieuDepart);
            setDestination(editingList.destination);
            setReferDossier(editingList.referDossier);
            setSelected(
                editingList.members.map(m => m.id!).filter(Boolean)
            );
        }
    }, [editingList]);

    // ── Auto-sélection / déselection capitaine ─────────────────────────
    useEffect(() => {
        if (!capitaine.trim()) {
            if (lastAutoSelectedCapRef.current !== null) {
                setSelected(sel =>
                    sel.filter(id => id !== lastAutoSelectedCapRef.current)
                );
                lastAutoSelectedCapRef.current = null;
            }
            setCapitaineError('');
            return;
        }

        const match = membersWithFonction.find(m =>
            `${m.nom.toUpperCase()} ${m.prenom.toUpperCase()}` ===
            capitaine.toUpperCase().trim()
        );

        if (match?.id) {
            setCapitaineError('');
            if (
                lastAutoSelectedCapRef.current !== null &&
                lastAutoSelectedCapRef.current !== match.id
            ) {
                setSelected(sel =>
                    sel.filter(id => id !== lastAutoSelectedCapRef.current)
                );
            }
            lastAutoSelectedCapRef.current = match.id;
            if (!selected.includes(match.id)) {
                setSelected(sel => [...sel, match.id!]);
            }
        } else {
            setCapitaineError(
                "Ce capitaine n'existe pas dans la base de données"
            );
            if (lastAutoSelectedCapRef.current !== null) {
                setSelected(sel =>
                    sel.filter(id => id !== lastAutoSelectedCapRef.current)
                );
                lastAutoSelectedCapRef.current = null;
            }
        }
    }, [capitaine, membersWithFonction]);

    // ── Dérivés ────────────────────────────────────────────────────────
    const captainSuggestions =
        captains.map(c => `${c.nom.toUpperCase()} ${c.prenom}`);

    const selectedShip =
        ships.find(s => s.id === Number(shipId));

    const selectedMembers = sortCrewByHierarchy(
        membersWithFonction.filter(
            m => m.id && selected.includes(m.id)
        )
    );

    const filtered = membersWithFonction.filter(m =>
        `${m.nom} ${m.prenom} ${m.fonction}`
            .toLowerCase()
            .includes(search.toLowerCase())
    );

    const toggle = (id: number) =>
        setSelected(sel =>
            sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]
        );

    // ── Validation ─────────────────────────────────────────────────────
    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!shipId) e.shipId = 'Sélectionnez un navire';
        if (!capitaine.trim()) e.capitaine = 'Le capitaine est requis';
        if (capitaineError) e.capitaine = capitaineError;
        if (!lieuDepart.trim()) e.lieuDepart = 'Le lieu de départ est requis';
        if (!destination.trim()) e.destination = 'La destination est requise';
        if (selectedMembers.length === 0) e.members = 'Sélectionnez au moins un membre';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    // ── Sauvegarde ─────────────────────────────────────────────────────
    const save = async () => {
        if (!validate() || !selectedShip) return;

        const now = new Date();

        // Enrichir les membres avec toutes leurs données avant sauvegarde
        const fullMembers = await enrichCrewListMembers(
            selectedMembers.map(m => ({
                id: m.id!,
                nom: m.nom,
                prenom: m.prenom,
            }))
        );

        const data = {
            shipId: selectedShip.id!,
            shipName: selectedShip.nom,
            capitaine,
            lieuDepart,
            destination,
            referDossier,
            members: fullMembers,   // ← membres complets avec fonction + age
            updatedAt: now,
        };

        if (editingList?.id) {
            await db.crewLists.update(editingList.id, data);
        } else {
            await db.crewLists.add({ ...data, createdAt: now });
        }

        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        onSaved?.();
    };

    // ── Export PDF ─────────────────────────────────────────────────────
    const exportPDF = () => {
        if (!validate() || !selectedShip) return;
        generateCrewListPDF({
            shipId: selectedShip.id!,
            shipName: selectedShip.nom,
            capitaine,
            lieuDepart,
            destination,
            referDossier,
            members: selectedMembers.map(({ fonction, ...m }) => m),
            createdAt: editingList?.createdAt ?? new Date(),
            updatedAt: new Date(),
        });
    };

    return (
        <div className="space-y-5 fade-in">

            {/* Bouton retour + titre */}
            {onBack && (
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-white
            text-sm transition mb-1"
                >
                    <ArrowLeft size={15} /> Retour aux listes
                </button>
            )}

            <h1 className="text-xl font-bold font-display text-white">
                {editingList
                    ? `Modifier la liste #${formatId(editingList.id)}`
                    : "Créer une liste d'équipage"
                }
            </h1>

            {/* ── Informations du voyage ── */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl p-5 space-y-4">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Informations du voyage
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* Navire */}
                    <div>
                        <CustomSelect
                            label="Navire *"
                            value={shipId}
                            onChange={v => {
                                setShipId(v);
                                setErrors(e => ({ ...e, shipId: '' }));
                            }}
                            options={ships.map(s => ({
                                value: String(s.id),
                                label: s.nom.toUpperCase(),
                            }))}
                            placeholder="Sélectionner un navire..."
                        />
                        {errors.shipId && (
                            <p className="text-rose-400 text-xs mt-1">{errors.shipId}</p>
                        )}
                    </div>

                    {/* Capitaine */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                            Capitaine *
                        </label>
                        <AutoComplete
                            value={capitaine}
                            onChange={v => {
                                setCapitaine(v);
                                setErrors(e => ({ ...e, capitaine: '' }));
                            }}
                            suggestions={captainSuggestions}
                            placeholder="Nom du capitaine..."
                        />
                        {(capitaineError || errors.capitaine) && (
                            <p className="text-rose-400 text-xs mt-1">
                                {capitaineError || errors.capitaine}
                            </p>
                        )}
                    </div>

                    {/* Lieu de départ */}
                    <div>
                        <Input
                            label="Lieu de départ *"
                            value={lieuDepart}
                            onChange={e => {
                                setLieuDepart(e.target.value);
                                setErrors(v => ({ ...v, lieuDepart: '' }));
                            }}
                            placeholder="Lieu de départ"
                        />
                        {errors.lieuDepart && (
                            <p className="text-rose-400 text-xs mt-1">{errors.lieuDepart}</p>
                        )}
                    </div>

                    {/* Destination */}
                    <div>
                        <Input
                            label="Destination *"
                            value={destination}
                            onChange={e => {
                                setDestination(e.target.value);
                                setErrors(v => ({ ...v, destination: '' }));
                            }}
                            placeholder="Destination"
                        />
                        {errors.destination && (
                            <p className="text-rose-400 text-xs mt-1">{errors.destination}</p>
                        )}
                    </div>

                    {/* Référence dossier */}
                    <div className="col-span-1 sm:col-span-2">
                        <Input
                            label="Référence dossier"
                            value={referDossier}
                            onChange={e => setReferDossier(e.target.value)}
                            placeholder="Réf. dossier (optionnel)"
                        />
                    </div>
                </div>
            </div>

            {/* ── Membres sélectionnés ── */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2
          flex-shrink-0">
                    <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Membres sélectionnés ({selected.length})
                    </h2>
                    <div className="relative">
                        <Search size={13}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Filtrer..."
                            className="bg-navy-700 border border-navy-500 rounded-lg pl-7 pr-3
                py-1.5 text-xs text-slate-200 focus:outline-none
                focus:border-ocean-500 transition w-40"
                        />
                    </div>
                </div>

                {/* Erreur membres */}
                {errors.members && (
                    <p className="text-rose-400 text-xs">{errors.members}</p>
                )}

                {membersWithFonction.length === 0 ? (
                    <div className="text-center text-slate-500 py-5 text-sm">
                        <AlertCircle size={18} className="mx-auto mb-2 opacity-40" />
                        Ajoutez d'abord des membres
                    </div>
                ) : (
                    // Hauteur max fixe + scroll interne
                    <div className="max-h-64 overflow-y-auto custom-scroll space-y-1.5 pr-1">
                        {filtered.map(m => (
                            <label
                                key={m.id}
                                className={`flex items-center gap-3 p-2.5 rounded-lg border
                  cursor-pointer transition
                  ${selected.includes(m.id!)
                                        ? 'border-ocean-500 bg-ocean-600/10'
                                        : 'border-navy-600 hover:border-navy-500'
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.includes(m.id!)}
                                    onChange={() => m.id && toggle(m.id)}
                                    className="accent-ocean-500 w-4 h-4 flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0 text-sm">
                                    <span className="font-medium text-slate-200 truncate">
                                        {m.nom} {m.prenom}
                                    </span>
                                    <span className="text-slate-500 ml-2 text-xs">
                                        {m.fonction}
                                    </span>
                                </div>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Aperçu membres sélectionnés ── */}
            {selected.length > 0 && (
                <div className="bg-navy-800 border border-navy-600 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">
                        Aperçu — {selected.length} membre{selected.length > 1 ? 's' : ''}
                    </h3>
                    <div className="space-y-1">
                        {selectedMembers.map((m, i) => (
                            <div key={m.id} className="flex items-center gap-2 text-xs text-slate-400">
                                <span className="text-slate-600 w-5 text-right flex-shrink-0">
                                    {i + 1}.
                                </span>
                                <span className="text-slate-300 truncate">
                                    {m.nom.toUpperCase()} {m.prenom}
                                </span>
                                <span className="text-slate-500 truncate">— {m.fonction}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Actions ── */}
            <div className="flex flex-wrap gap-3 justify-end pb-4">
                {saved && (
                    <span className="text-emerald-400 text-sm flex items-center gap-1">
                        <CheckSquare size={14} /> Enregistré !
                    </span>
                )}
                <button
                    onClick={save}
                    className="flex items-center gap-2 bg-navy-700 hover:bg-navy-600
            text-white px-4 py-2 rounded-lg text-sm font-medium
            border border-navy-500 transition"
                >
                    <Save size={15} /> Enregistrer
                </button>
                <button
                    onClick={exportPDF}
                    className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-500
            text-white px-5 py-2 rounded-lg text-sm font-medium transition"
                >
                    <Download size={15} /> Exporter PDF
                </button>
            </div>
        </div>
    );
}