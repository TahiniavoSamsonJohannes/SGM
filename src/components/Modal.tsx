import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: string;
}

export default function Modal({
    open, onClose, title, children, maxWidth = 'max-w-2xl'
}: Props) {
    useEffect(() => {
        if (open) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 bg-black/65 overflow-y-auto"
            onClick={onClose}
        >
            <div className="flex min-h-full items-start justify-center p-4 py-8">
                <div
                    className={`relative bg-navy-800 border border-navy-600 rounded-2xl
            shadow-2xl w-full ${maxWidth} slide-down`}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header sticky */}
                    <div className="flex items-center justify-between px-5 py-4
            border-b border-navy-600 sticky top-0 bg-navy-800 rounded-t-2xl z-10">
                        <h2 className="text-base font-semibold text-slate-100 font-display">
                            {title}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white transition p-1
                rounded-lg hover:bg-navy-700"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="px-5 py-5">
                        {children}
                    </div>
                </div>
            </div>
        </div>,
        document.body   // ← rendu directement dans body, hors de tout conteneur
    );
}