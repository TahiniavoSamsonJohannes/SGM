import { useState, useEffect } from 'react';
import {
    Download, Upload,
    Database, Trash2, Shield, Users,
} from 'lucide-react';
import { db, seedDynamicValues, verifyPin } from '../db';
import Modal from '../components/Modal';
import { ALL_TABLES, BUSINESS_TABLES, TABLE_SCHEMAS } from '../types';
import PinKeypadModal from '../components/PinKeypadModal';
import { normalizeTable } from '../utils/func';

// ─── Helpers export ───────────────────────────────────────────────────────────

function buildExportFilename(prefix: string): string {
    const now = new Date();
    const date = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
    return `${prefix}_${date}_${now.getTime()}.json`;
}

async function downloadJson(data: object, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function DataPage() {
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
    const [importing, setImporting] = useState(false);
    const [stats, setStats] = useState<Record<string, number>>({});

    const [resetType, setResetType] = useState<'data' | 'full' | null>(null);
    const [resetModal, setResetModal] = useState(false);
    const [resetError, setResetError] = useState('');

    const openReset = (type: 'data' | 'full') => {
        setResetType(type);
        setResetError('');
        setResetModal(true);
    };

    const showMsg = (text: string, ok: boolean) => {
        setMsg({ text, ok });
        setTimeout(() => setMsg(null), 4000);
    };

    const loadStats = async () => {
        setStats({
            "Membres d'équipage": await db.crewMembers.count(),
            'Navires': await db.ships.count(),
            "Voyages": await db.crewLists.count(),
            "Contrats": await db.contracts.count(),
            'Fichiers exportés': await db.exportedFiles.count(),
            // 'Valeurs dynamiques': await db.dynamicValues.count(),
        });
    };

    useEffect(() => { loadStats(); }, []);

    // ── Logique export données métier ────────────────────────────────
    const handleExportData = async () => {
        try {
            const tables: Record<string, unknown[]> = {};
            for (const name of BUSINESS_TABLES) {
                tables[name] = await (db as any)[name].toArray();
            }

            const data = {
                version: 3,
                exportType: 'data_only',
                exportedAt: new Date().toISOString(),
                tables,
            };
            await downloadJson(data, buildExportFilename('AE_DATA'));
            showMsg('✓ Données exportées avec succès', true);
        } catch {
            showMsg("✗ Erreur lors de l'export", false);
        }
    };

    // ── Logique export full backup ────────────────────────────────────
    const handleExportFull = async () => {
        try {
            const tables: Record<string, unknown[]> = {};
            for (const name of ALL_TABLES) {
                tables[name] = await (db as any)[name].toArray();
            }
            const data = {
                version: 3,
                exportType: 'full_backup',
                exportedAt: new Date().toISOString(),
                tables,
            };

            await downloadJson(data, buildExportFilename('AE_BACKUP_FULL'));
            showMsg('✓ Sauvegarde complète exportée', true);
        } catch {
            showMsg("✗ Erreur lors de l'export", false);
        }
    };

    // ── Logique import ────────────────────────────────────────────────
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setImporting(true);
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const backup = JSON.parse(await file.text());
            if (!backup.tables) throw new Error('Format de fichier invalide');

            const { tables } = backup;
            const isFull = backup.exportType === 'full_backup';

            const normalizedTables: Record<string, unknown[]> = {};
            const tableNames = Object.keys(TABLE_SCHEMAS);
            for (const tableName of tableNames) {
                const raw = (tables[tableName] ?? []) as Record<string, unknown>[];
                normalizedTables[tableName] = normalizeTable(raw, tableName);
            }

            await db.crewMembers.clear();
            await db.ships.clear();
            await db.crewLists.clear();
            await db.checklistDocs.clear();
            await db.exportedFiles.clear();
            await db.dynamicValues.clear();
            await db.contracts.clear();
            await db.cargoItems.clear();

            if (normalizedTables.crewMembers?.length)
                await db.crewMembers.bulkPut(normalizedTables.crewMembers as any);
            if (normalizedTables.ships?.length)
                await db.ships.bulkPut(normalizedTables.ships as any);
            if (normalizedTables.crewLists?.length)
                await db.crewLists.bulkPut(normalizedTables.crewLists as any);
            if (normalizedTables.exportedFiles?.length)
                await db.exportedFiles.bulkPut(normalizedTables.exportedFiles as any);
            if (normalizedTables.dynamicValues?.length)
                await db.dynamicValues.bulkPut(normalizedTables.dynamicValues as any);
            if (normalizedTables.contracts?.length)
                await db.contracts.bulkPut(normalizedTables.contracts as any);
            if (normalizedTables.cargoItems?.length)
                await db.cargoItems.bulkPut(normalizedTables.cargoItems as any);

            if (isFull) {
                await db.authConfig.clear();
                await db.deviceConfig.clear();
                if (normalizedTables.authConfig?.length)
                    await db.authConfig.bulkPut(normalizedTables.authConfig as any);
                if (normalizedTables.deviceConfig?.length)
                    await db.deviceConfig.bulkPut(normalizedTables.deviceConfig as any);
            }

            showMsg(
                isFull
                    ? "✓ Sauvegarde complète importée"
                    : '✓ Données importées avec succès',
                true
            );
            await loadStats();
            window.location.reload();
        } catch (err: any) {
            showMsg(`✗ ${err.message || 'Fichier invalide'}`, false);
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    // ── Reset ─────────────────────────────────────────────────────────────────
    const handleReset = async (pin: string) => {
        const ok = await verifyPin(pin);
        if (!ok) { setResetError('Code PIN incorrect'); return; }

        setResetError('');
        if (resetType === 'full') {
            // Suppression complète + compte
            await db.delete();
            localStorage.clear();
            window.location.reload();
        } else {
            // Suppression données métier uniquement — compte préservé
            await db.crewMembers.clear();
            await db.ships.clear();
            await db.crewLists.clear();
            await db.checklistDocs.clear();
            await db.contracts.clear();
            await db.cargoItems.clear();
            await db.exportedFiles.clear();
            await db.dynamicValues.clear();
            // authConfig et deviceConfig conservés
            await seedDynamicValues(); // remettre les fonctions par défaut
            setResetModal(false);
            await loadStats();
            window.location.reload();
        }
    };

    return (
        <div className="space-y-6 fade-in max-w-lg">

            {/* Stats */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl p-5">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider
          flex items-center gap-2 mb-3">
                    <Database size={13} className="text-ocean-400" /> État de la base
                </h2>
                {Object.entries(stats).map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between py-2
            border-b border-navy-700 last:border-0">
                        <span className="text-sm text-slate-400">{label}</span>
                        <span className="text-sm font-mono text-slate-200">{count}</span>
                    </div>
                ))}
            </div>

            {/* Export données métier */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl p-5 space-y-3">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider
          flex items-center gap-2">
                    <Users size={13} className="text-ocean-400" /> Export données métier
                </h2>
                <p className="text-xs text-slate-500">
                    Exporte uniquement les membres, navires, listes et checklists.
                    Ne contient <span className="text-slate-300 font-medium">pas</span> les informations du compte.
                </p>
                <button onClick={handleExportData}
                    className="w-full flex items-center justify-center gap-2
            bg-ocean-600 hover:bg-ocean-500 text-white py-2.5 rounded-lg
            text-sm font-medium transition">
                    <Download size={15} /> Exporter les données
                </button>
            </div>

            {/* Export complet */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl p-5 space-y-3">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider
          flex items-center gap-2">
                    <Shield size={13} className="text-emerald-400" /> Export sauvegarde complète
                </h2>
                <p className="text-xs text-slate-500">
                    Exporte <span className="text-slate-300 font-medium">toute</span> la base y compris votre compte.
                    Permet de migrer vers un autre appareil avec votre compte intact.
                </p>
                <button onClick={handleExportFull}
                    className="w-full flex items-center justify-center gap-2
            bg-emerald-700 hover:bg-emerald-600 text-white py-2.5 rounded-lg
            text-sm font-medium transition">
                    <Shield size={15} /> Exporter la sauvegarde complète
                </button>
            </div>

            {/* Import */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl p-5 space-y-3">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider
          flex items-center gap-2">
                    <Upload size={13} className="text-amber-400" /> Importer une sauvegarde
                </h2>
                <p className="text-xs text-slate-500">
                    Fonctionne avec les deux types d'export.
                    <span className="text-amber-400 font-medium"> Remplace les données actuelles.</span>
                </p>
                <input type="file" accept=".json"
                    onChange={handleImport} className="hidden" id="import-file" />
                <label htmlFor="import-file"
                    className={`w-full flex items-center justify-center gap-2
            bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-lg
            text-sm font-medium transition cursor-pointer
            ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload size={15} />
                    {importing ? 'Import en cours...' : 'Choisir un fichier JSON'}
                </label>
            </div>
            {msg && (
                <p className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {msg.text}
                </p>
            )}

            {/* Reset */}
            <div className="bg-navy-800 border border-rose-900/40 rounded-xl p-5 space-y-4">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider
    flex items-center gap-2">
                    <Trash2 size={13} className="text-rose-400" /> Zone dangereuse
                </h2>

                {/* Suppression données métier */}
                <div className="space-y-2">
                    <p className="text-xs text-slate-500">
                        Supprime les membres, navires, voyages, contrats, cargaisons et historique.
                        <span className="text-amber-400 font-medium"> Votre compte est conservé.</span>
                    </p>
                    <button
                        onClick={() => openReset('data')}
                        className="w-full flex items-center justify-center gap-2
        bg-amber-600/20 hover:bg-amber-600/30 text-amber-400
        border border-amber-600/40 py-2.5 rounded-lg text-sm font-medium transition"
                    >
                        <Trash2 size={15} /> Supprimer les données métier
                    </button>
                </div>

                <div className="border-t border-navy-700" />

                {/* Suppression complète */}
                <div className="space-y-2">
                    <p className="text-xs text-slate-500">
                        Supprime <span className="text-rose-400 font-medium">tout</span>,
                        y compris votre compte. L'application sera réinitialisée complètement.
                    </p>
                    <button
                        onClick={() => openReset('full')}
                        className="w-full flex items-center justify-center gap-2
        bg-rose-600/20 hover:bg-rose-600/30 text-rose-400
        border border-rose-600/40 py-2.5 rounded-lg text-sm font-medium transition"
                    >
                        <Trash2 size={15} /> Réinitialisation complète
                    </button>
                </div>
            </div>

            <Modal
                open={resetModal}
                onClose={() => setResetModal(false)}
                title={resetType === 'full'
                    ? 'Réinitialisation complète'
                    : 'Supprimer les données métier'
                }
                maxWidth="max-w-xs"
            >
                <PinKeypadModal
                    description={resetType === 'full'
                        ? 'Toutes les données et votre compte seront supprimés. Cette action est irréversible.'
                        : 'Les données métier seront supprimées. Votre compte est conservé.'
                    }
                    onConfirm={handleReset}
                    onCancel={() => { setResetModal(false); setResetError(''); }}
                    error={resetError}
                />
            </Modal>
        </div>
    );
}