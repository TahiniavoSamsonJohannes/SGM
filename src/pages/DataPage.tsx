import { useState, useRef, useEffect } from 'react';
import {
    Download, Upload,
    Database, Trash2, Shield, Users,
} from 'lucide-react';
import { db } from '../db';
import ConfirmDialog from '../components/ConfirmDialog';

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
    const [confirmReset, setConfirmReset] = useState(false);
    const [stats, setStats] = useState<Record<string, number>>({});

    const fileRef = useRef<HTMLInputElement>(null);

    const showMsg = (text: string, ok: boolean) => {
        setMsg({ text, ok });
        setTimeout(() => setMsg(null), 4000);
    };

    const loadStats = async () => {
        setStats({
            "Membres d'équipage": await db.crewMembers.count(),
            'Navires': await db.ships.count(),
            "Listes d'équipage": await db.crewLists.count(),
            'Checklists': await db.checklistDocs.count(),
            'Fichiers exportés': await db.exportedFiles.count(),
            'Valeurs dynamiques': await db.dynamicValues.count(),
        });
    };

    useEffect(() => { loadStats(); }, []);

    // ── Export données métier (sans authConfig) ──────────────────────────────
    const handleExportData = async () => {
        try {
            const data = {
                version: 3,
                exportType: 'data_only',
                exportedAt: new Date().toISOString(),
                tables: {
                    crewMembers: await db.crewMembers.toArray(),
                    ships: await db.ships.toArray(),
                    crewLists: await db.crewLists.toArray(),
                    checklistDocs: await db.checklistDocs.toArray(),
                    exportedFiles: await db.exportedFiles.toArray(),
                    dynamicValues: await db.dynamicValues.toArray(),
                    contracts: await db.contracts.toArray(),
                },
            };
            await downloadJson(data, buildExportFilename('AE_DATA'));
            showMsg('✓ Données exportées avec succès', true);
        } catch {
            showMsg("✗ Erreur lors de l'export", false);
        }
    };

    // ── Export complet (avec authConfig) ─────────────────────────────────────
    const handleExportFull = async () => {
        try {
            const data = {
                version: 3,
                exportType: 'full_backup',
                exportedAt: new Date().toISOString(),
                tables: {
                    crewMembers: await db.crewMembers.toArray(),
                    ships: await db.ships.toArray(),
                    crewLists: await db.crewLists.toArray(),
                    checklistDocs: await db.checklistDocs.toArray(),
                    exportedFiles: await db.exportedFiles.toArray(),
                    dynamicValues: await db.dynamicValues.toArray(),
                    authConfig: await db.authConfig.toArray(),
                    deviceConfig: await db.deviceConfig.toArray(),
                    contracts: await db.contracts.toArray(),
                },
            };
            await downloadJson(data, buildExportFilename('AE_BACKUP_FULL'));
            showMsg('✓ Sauvegarde complète exportée', true);
        } catch {
            showMsg("✗ Erreur lors de l'export", false);
        }
    };

    // ── Import (data ou full) ─────────────────────────────────────────────────
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);

        try {
            const backup = JSON.parse(await file.text());
            if (!backup.tables) throw new Error('Format de fichier invalide');

            const { tables } = backup;
            const isFull = backup.exportType === 'full_backup';

            // Import sans transaction globale — table par table
            // pour éviter NotFoundError sur tables manquantes
            await db.crewMembers.clear();
            await db.ships.clear();
            await db.crewLists.clear();
            await db.checklistDocs.clear();
            await db.exportedFiles.clear();
            await db.dynamicValues.clear();
            await db.contracts.clear();
            if (tables.crewMembers?.length)
                await db.crewMembers.bulkPut(tables.crewMembers);
            if (tables.ships?.length)
                await db.ships.bulkPut(tables.ships);
            if (tables.crewLists?.length)
                await db.crewLists.bulkPut(tables.crewLists);
            if (tables.checklistDocs?.length)
                await db.checklistDocs.bulkPut(tables.checklistDocs);
            if (tables.exportedFiles?.length)
                await db.exportedFiles.bulkPut(tables.exportedFiles);
            if (tables.dynamicValues?.length)
                await db.dynamicValues.bulkPut(tables.dynamicValues);
            if (tables.contracts?.length)
                await db.contracts.bulkPut(tables.contracts);

            if (isFull) {
                await db.authConfig.clear();
                await db.deviceConfig.clear();
                if (tables.authConfig?.length)
                    await db.authConfig.bulkPut(tables.authConfig);
                if (tables.deviceConfig?.length)
                    await db.deviceConfig.bulkPut(tables.deviceConfig);
            }

            showMsg(
                isFull
                    ? '✓ Sauvegarde complète importée — rechargez l\'application'
                    : '✓ Données importées avec succès',
                true
            );
            await loadStats();

        } catch (err: any) {
            showMsg(`✗ ${err.message || 'Fichier invalide'}`, false);
        } finally {
            setImporting(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    // ── Reset ─────────────────────────────────────────────────────────────────
    const handleReset = async () => {
        await db.delete();
        localStorage.clear();
        window.location.reload();
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
                <input ref={fileRef} type="file" accept=".json"
                    onChange={handleImport} className="hidden" id="import-file" />
                <label htmlFor="import-file"
                    className={`w-full flex items-center justify-center gap-2
            bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-lg
            text-sm font-medium transition cursor-pointer
            ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload size={15} />
                    {importing ? 'Import en cours...' : 'Choisir un fichier JSON'}
                </label>
                {msg && (
                    <p className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {msg.text}
                    </p>
                )}
            </div>

            {/* Reset */}
            <div className="bg-navy-800 border border-rose-900/40 rounded-xl p-5 space-y-3">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider
          flex items-center gap-2">
                    <Trash2 size={13} className="text-rose-400" /> Zone dangereuse
                </h2>
                <p className="text-xs text-slate-500">
                    Supprime définitivement toutes les données et réinitialise l'application.
                    Action <span className="text-rose-400 font-medium">irréversible</span>.
                </p>
                <button onClick={() => setConfirmReset(true)}
                    className="w-full flex items-center justify-center gap-2
            bg-rose-600/20 hover:bg-rose-600/30 text-rose-400
            border border-rose-600/40 py-2.5 rounded-lg text-sm font-medium transition">
                    <Trash2 size={15} /> Réinitialiser la base de données
                </button>
            </div>

            <ConfirmDialog
                open={confirmReset}
                title="Réinitialiser la base ?"
                message="Toutes les données seront supprimées définitivement. Exportez d'abord une sauvegarde."
                confirmLabel="Tout supprimer"
                danger
                onConfirm={handleReset}
                onCancel={() => setConfirmReset(false)}
            />
        </div>
    );
}