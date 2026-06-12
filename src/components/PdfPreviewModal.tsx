import { useEffect, useRef, useState } from 'react';
import { X, Download, Printer } from 'lucide-react';
import { createPortal } from 'react-dom';
import { modalRegistry } from '../hooks/useModalRegistry';
import PdfViewer from './PdfViewer';

interface Props {
    open: boolean;
    url: string;
    title: string;
    onClose: () => void;
    onDownload?: () => void;
}

export default function PdfPreviewModal({
    open, url, title, onClose, onDownload,
}: Props) {
    // État interne : 'closed' | 'opening' | 'open' | 'closing'
    const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

    // Transition à l'ouverture
    useEffect(() => {
        if (open) {
            setPhase('open');
        } else if (phase === 'open') {
            // Déclencher l'animation de fermeture
            setPhase('closing');
            const t = setTimeout(() => setPhase('closed'), 220);
            return () => clearTimeout(t);
        }
    }, [open]);

    // Registre modal
    useEffect(() => {
        if (phase !== 'open') return;
        document.body.style.overflow = 'hidden';
        const handler = () => onCloseRef.current();
        modalRegistry.register(handler);
        return () => {
            document.body.style.overflow = '';
            modalRegistry.unregister(handler);
        };
    }, [phase]);

    // Libérer blob URL
    useEffect(() => {
        if (phase === 'closed' && url) {
            const t = setTimeout(() => {
                try { URL.revokeObjectURL(url); } catch { }
            }, 500);
            return () => clearTimeout(t);
        }
    }, [phase, url]);

    const handlePrint = () => {
        if (!url) return;

        // Créer un iframe caché temporaire pour l'impression
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        iframe.src = url;

        document.body.appendChild(iframe);

        iframe.onload = () => {
            try {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();

                // Nettoyer uniquement après la fermeture du dialogue d'impression (n'est pas fiable sur certains navigateurs)
                iframe.contentWindow?.addEventListener('afterprint', () => {
                    document.body.removeChild(iframe);
                });
            } catch {
                // Fallback : ouvrir dans un nouvel onglet pour impression manuelle
                window.open(url, '_blank');
                document.body.removeChild(iframe);
            }

        };
    };

    if (phase === 'closed') return null;

    const overlayClass = phase === 'closing'
        ? 'animate-fade-out'
        : 'animate-fade-in';

    const panelClass = phase === 'closing'
        ? 'animate-slide-up'
        : 'animate-slide-down';

    return createPortal(
        <div className={`fixed inset-0 z-[70] bg-black/90 flex flex-col ${overlayClass}`}>

            {/* Barre du haut */}
            <div className={`flex items-center justify-between px-4 py-3
        bg-navy-800 border-b border-navy-700 flex-shrink-0 ${panelClass}`}>
                <h2 className="text-sm font-semibold text-slate-200 truncate flex-1 mr-4">
                    {title}
                </h2>
                <div className="flex items-center gap-2">
                    {onDownload && (
                        <button
                            onClick={onDownload}
                            className="flex items-center gap-1.5 bg-ocean-600 hover:bg-ocean-500
                text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
                        >
                            <Download size={12} /> Télécharger
                        </button>
                    )}

                    {/* Bouton imprimer */}
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 bg-navy-700 hover:bg-navy-600
      text-white px-3 py-1.5 rounded-lg text-xs font-medium
      border border-navy-500 transition"
                        title="Imprimer"
                    >
                        <Printer size={12} /> Imprimer
                    </button>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition p-1.5
              rounded-lg hover:bg-navy-700"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* PDF rendu via PDF.js — fonctionne sur mobile et desktop */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {url && <PdfViewer url={url} />}
            </div>
        </div>,
        document.body
    );
}