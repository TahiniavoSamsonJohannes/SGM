import { useEffect, useRef } from 'react';
import { X, Download } from 'lucide-react';
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

    // Libérer le blob URL à la fermeture
    useEffect(() => {
        if (!open && url) {
            const t = setTimeout(() => {
                try { URL.revokeObjectURL(url); } catch { }
            }, 1000);
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
                    {onDownload && (
                        <button
                            onClick={onDownload}
                            className="flex items-center gap-1.5 bg-ocean-600 hover:bg-ocean-500
                text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
                        >
                            <Download size={12} /> Télécharger
                        </button>
                    )}
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