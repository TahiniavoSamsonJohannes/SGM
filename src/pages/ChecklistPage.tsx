import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Hash } from 'lucide-react';
import { db } from '../db';
import { generateChecklistPDF } from '../pdfGenerator';
import AutoComplete from '../components/AutoComplete';

// Formate l'id en 10 chiffres
function formatId(id: number | undefined): string {
    return String(id ?? 0).padStart(10, '0');
}

export default function ChecklistPage() {
    const lists = useLiveQuery(() =>
        db.crewLists.toArray()
    ) ?? [];
    const ships = useLiveQuery(() => db.ships.toArray()) ?? [];

    const [search, setSearch] = useState('');

    // Label affiché dans l'autocomplétion : ID + nom navire + destination + date
    const suggestions = lists.map(l =>
        `#${formatId(l.id)} — ${l.shipName} → ${l.destination} (${new Date(l.updatedAt).toLocaleDateString('fr-FR')
        })`
    );

    const selectedList = lists.find((_, idx) =>
        suggestions[idx] === search
    );
    const selectedShip = ships.find(s => s.id === selectedList?.shipId);

    const exportPDF = () => {
        if (!selectedList || !selectedShip) return;
        const docData = {
            crewListId: selectedList.id!,
            shipName: selectedList.shipName,
            immatriculation: selectedShip.immatriculation,
            destination: selectedList.destination,
            referDossier: selectedList.referDossier,
            members: selectedList.members,
            createdAt: new Date(),
        };
        generateChecklistPDF(docData);
        db.checklistDocs.add(docData);
    };

    return (
        <div className="space-y-6 fade-in">
            <h1 className="text-xl font-bold font-display text-white">
                Checklist Plan de Chargement
            </h1>

            <div className="bg-navy-800 border border-navy-600 rounded-xl p-5 space-y-4">

                {/* Sélection liste */}
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                        Sélectionner une liste d'équipage
                    </label>
                    <AutoComplete
                        value={search}
                        onChange={setSearch}
                        suggestions={suggestions}
                        placeholder="Rechercher par ID, navire, destination..."
                    />
                </div>

                {/* Aperçu */}
                {selectedList && (
                    <div className="bg-navy-700 rounded-lg p-4 space-y-3">

                        {/* ID de la liste — mis en avant */}
                        <div className="flex items-center gap-2 pb-2 border-b border-navy-600">
                            <Hash size={14} className="text-ocean-400 flex-shrink-0" />
                            <span className="text-xs text-slate-400">Référence liste :</span>
                            <span className="font-mono text-sm font-bold text-ocean-400">
                                #{formatId(selectedList.id)}
                            </span>
                        </div>

                        {/* Infos */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            {[
                                ['Navire', selectedList.shipName],
                                ['Immat.', selectedShip?.immatriculation ?? '—'],
                                ['Capitaine', selectedList.capitaine],
                                ['Départ', selectedList.lieuDepart],
                                ['Destination', selectedList.destination],
                                ['Membres', String(selectedList.members.length)],
                            ].map(([label, value]) => (
                                <div key={label}>
                                    <span className="text-slate-500">{label} : </span>
                                    <span className="text-slate-200">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end">
                <button
                    onClick={exportPDF}
                    disabled={!selectedList}
                    className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-500
            disabled:opacity-40 text-white px-5 py-2.5 rounded-lg
            text-sm font-medium transition"
                >
                    <Download size={15} /> Générer et exporter Checklist PDF
                </button>
            </div>
        </div>
    );
}