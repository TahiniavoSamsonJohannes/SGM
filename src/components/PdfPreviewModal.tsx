import { useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { createPortal } from 'react-dom';

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
    useEffect(() => {
        if (open) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    // Libérer l'URL blob à la fermeture
    useEffect(() => {
        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [url]);

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[70] bg-black/80 flex flex-col">

            {/* Barre du haut */}
            <div className="flex items-center justify-between px-4 py-3
        bg-navy-800 border-b border-navy-700 flex-shrink-0">
                <h2 className="text-sm font-semibold text-slate-200 truncate">
                    {title}
                </h2>
                <div className="flex items-center gap-2">
                    {onDownload && (
                        <button onClick={onDownload}
                            className="flex items-center gap-2 bg-ocean-600 hover:bg-ocean-500
                text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">
                            <Download size={13} /> Télécharger
                        </button>
                    )}
                    <button onClick={onClose}
                        className="text-slate-400 hover:text-white transition p-1.5
              rounded-lg hover:bg-navy-700">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Iframe PDF */}
            <div className="flex-1 min-h-0">
                {url ? (
                    <iframe
                        src={url}
                        className="w-full h-full border-0"
                        title={title}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                        <div className="w-8 h-8 border-2 border-ocean-500
              border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}