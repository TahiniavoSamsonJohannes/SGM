import { useState, useRef } from 'react';
import { Upload, ArrowLeft, CheckCircle } from 'lucide-react';
import { db } from '../db';
import logoUrl from '../assets/logo-ae.png';

interface Props {
    onImported: () => void;  // redirige vers LoginPin après succès
    onBack: () => void;  // retour vers LoginPin sans import
}

export default function ImportAccount({ onImported, onBack }: Props) {
    const [importing, setImporting] = useState(false);
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
    const [success, setSuccess] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setMsg(null);

        try {
            const backup = JSON.parse(await file.text());

            if (!backup.tables || backup.exportType !== 'full_backup')
                throw new Error("Ce fichier n'est pas une sauvegarde complète (full_backup)");

            const { tables } = backup;

            await db.crewMembers.clear();
            await db.ships.clear();
            await db.crewLists.clear();
            await db.checklistDocs.clear();
            await db.exportedFiles.clear();
            await db.dynamicValues.clear();
            await db.authConfig.clear();
            await db.deviceConfig.clear();

            if (tables.crewMembers?.length) await db.crewMembers.bulkPut(tables.crewMembers);
            if (tables.ships?.length) await db.ships.bulkPut(tables.ships);
            if (tables.crewLists?.length) await db.crewLists.bulkPut(tables.crewLists);
            if (tables.checklistDocs?.length) await db.checklistDocs.bulkPut(tables.checklistDocs);
            if (tables.exportedFiles?.length) await db.exportedFiles.bulkPut(tables.exportedFiles);
            if (tables.dynamicValues?.length) await db.dynamicValues.bulkPut(tables.dynamicValues);
            if (tables.authConfig?.length) await db.authConfig.bulkPut(tables.authConfig);
            if (tables.deviceConfig?.length) await db.deviceConfig.bulkPut(tables.deviceConfig);

            setMsg({ text: 'Compte restauré avec succès !', ok: true });
            setSuccess(true);

            // Redirection automatique vers LoginPin après 1.5s
            setTimeout(() => onImported(), 1500);

        } catch (err: any) {
            setMsg({ text: err.message || 'Fichier invalide', ok: false });
        } finally {
            setImporting(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-navy-800 border border-navy-600
        rounded-2xl shadow-2xl p-8 fade-in">

                {/* En-tête */}
                <div className="text-center mb-8">
                    <img src={logoUrl} alt="Logo"
                        className="w-14 h-14 object-contain mx-auto mb-4" />
                    <h1 className="text-xl font-bold font-display text-white">
                        Armement Eustratiou
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Restaurer votre compte
                    </p>
                </div>

                {/* Zone d'import */}
                {!success ? (
                    <div className="space-y-4">
                        <p className="text-xs text-slate-500 text-center leading-relaxed">
                            Sélectionnez votre fichier de sauvegarde complète
                            <span className="text-slate-400 font-medium"> (AE_BACKUP_FULL_...json)</span>
                            pour restaurer votre compte et vos données.
                        </p>

                        <input
                            ref={fileRef}
                            type="file"
                            accept=".json"
                            onChange={handleImport}
                            className="hidden"
                            id="restore-account-file"
                        />
                        <label
                            htmlFor="restore-account-file"
                            className={`w-full flex flex-col items-center justify-center gap-3
                border-2 border-dashed border-navy-500 hover:border-ocean-500
                rounded-xl p-8 cursor-pointer transition group
                ${importing ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            <Upload
                                size={28}
                                className="text-slate-500 group-hover:text-ocean-400 transition"
                            />
                            <span className="text-sm text-slate-400 group-hover:text-slate-200 transition">
                                {importing ? 'Restauration en cours...' : 'Choisir le fichier de sauvegarde'}
                            </span>
                        </label>

                        {msg && (
                            <p className={`text-xs text-center ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {msg.text}
                            </p>
                        )}
                    </div>
                ) : (
                    /* Succès */
                    <div className="text-center space-y-3">
                        <CheckCircle size={40} className="text-emerald-400 mx-auto" />
                        <p className="text-emerald-400 font-medium text-sm">
                            Compte restauré avec succès !
                        </p>
                        <p className="text-slate-500 text-xs">
                            Redirection vers la connexion...
                        </p>
                    </div>
                )}

                {/* Retour */}
                {!success && (
                    <button
                        onClick={onBack}
                        className="mt-6 w-full flex items-center justify-center gap-2
              text-slate-500 hover:text-slate-300 text-sm transition"
                    >
                        <ArrowLeft size={14} /> Retour à la connexion
                    </button>
                )}
            </div>
        </div>
    );
}