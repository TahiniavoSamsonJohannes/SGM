import { useEffect, useRef, useState } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { createPortal } from 'react-dom';
import { modalRegistry } from '../hooks/useModalRegistry';

interface Props {
    open: boolean;
    url: string;           // blob URL
    title: string;
    onClose: () => void;
    onDownload?: () => void;
}

// Détection mobile simple
function isMobile(): boolean {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

// Convertit un blob URL en base64 Data URL
async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export default function PdfPreviewModal({
    open, url, title, onClose, onDownload,
}: Props) {
    const [displayUrl, setDisplayUrl] = useState('');
    const [converting, setConverting] = useState(false);
    const [mobile, setMobile] = useState(false);
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

    // Enregistrement dans le registre modal
    useEffect(() => {
        if (!open) return;
        document.body.style.overflow = 'hidden';
        const handler = () => onCloseRef.current();
        modalRegistry.register(handler);
        return () => {
            document.body.style.overflow = '';
            modalRegistry.unregister(handler);
        };
    }, [open]);

    // Préparer l'URL selon la plateforme
    useEffect(() => {
        if (!open || !url) return;

        const mobile = isMobile();
        setMobile(mobile);

        if (!mobile) {
            // Desktop : iframe avec blob URL directement
            setDisplayUrl(url);
            return;
        }

        // Mobile : convertir en base64 pour l'iframe
        setConverting(true);
        blobUrlToDataUrl(url)
            .then(dataUrl => {
                setDisplayUrl(dataUrl);
                setConverting(false);
            })
            .catch(() => {
                // Fallback : ouvrir dans nouvel onglet
                setConverting(false);
                setDisplayUrl('');
            });
    }, [open, url]);

    // Ouvrir dans un nouvel onglet (fallback mobile)
    const openInNewTab = () => {
        if (url) window.open(url, '_blank');
    };

    // Libérer le blob URL à la fermeture
    useEffect(() => {
        if (!open && url) {
            const t = setTimeout(() => URL.revokeObjectURL(url), 1000);
            return () => clearTimeout(t);
        }
    }, [open, url]);

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[70] bg-black/90 flex flex-col">

            {/* Barre du haut */}
            <div className="flex items-center justify-between px-4 py-3
        bg-navy-800 border-b border-navy-700 flex-shrink-0">
                <h2 className="text-sm font-semibold text-slate-200 truncate flex-1 mr-4">
                    {title}
                </h2>
                <div className="flex items-center gap-2">
                    {/* Sur mobile : bouton pour ouvrir dans un nouvel onglet */}
                    {mobile && (
                        <button onClick={openInNewTab}
                            className="flex items-center gap-1.5 bg-navy-700 hover:bg-navy-600
                text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium transition
                border border-navy-500">
                            <Smartphone size={12} /> Ouvrir
                        </button>
                    )}
                    {onDownload && (
                        <button onClick={onDownload}
                            className="flex items-center gap-1.5 bg-ocean-600 hover:bg-ocean-500
                text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">
                            <Download size={12} /> Télécharger
                        </button>
                    )}
                    <button onClick={onClose}
                        className="text-slate-400 hover:text-white transition p-1.5
              rounded-lg hover:bg-navy-700">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Contenu */}
            <div className="flex-1 min-h-0 relative">
                {converting ? (
                    <div className="flex flex-col items-center justify-center h-full
            gap-4 text-slate-500">
                        <div className="w-8 h-8 border-2 border-ocean-500
              border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm">Préparation de l'aperçu...</p>
                    </div>
                ) : displayUrl ? (
                    <iframe
                        src={displayUrl}
                        className="w-full h-full border-0 bg-white"
                        title={title}
                    />
                ) : mobile ? (
                    /* Fallback mobile si conversion échouée */
                    <div className="flex flex-col items-center justify-center h-full
            gap-4 text-slate-500 p-6 text-center">
                        <Smartphone size={40} className="opacity-40" />
                        <p className="text-sm">
                            L'aperçu intégré n'est pas disponible sur cet appareil.
                        </p>
                        <button onClick={openInNewTab}
                            className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-500
                text-white px-5 py-2.5 rounded-lg text-sm font-medium transition">
                            <Smartphone size={15} /> Ouvrir le PDF
                        </button>
                        {onDownload && (
                            <button onClick={onDownload}
                                className="flex items-center gap-2 bg-navy-700 hover:bg-navy-600
                  text-white px-5 py-2.5 rounded-lg text-sm
                  border border-navy-500 transition">
                                <Download size={15} /> Télécharger
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                        <p className="text-sm">Impossible de charger l'aperçu</p>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
} 