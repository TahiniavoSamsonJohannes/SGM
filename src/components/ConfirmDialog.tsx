import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { modalRegistry } from '../hooks/useModalRegistry';

interface Props {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmDialog({
    open, title, message,
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    danger = false,
    onConfirm, onCancel,
}: Props) {
    const onCancelRef = useRef(onCancel);
    useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);

    useEffect(() => {
        if (!open) return;
        document.body.style.overflow = 'hidden';
        const handler = () => onCancelRef.current();
        modalRegistry.register(handler);
        return () => {
            document.body.style.overflow = '';
            modalRegistry.unregister(handler);
        };
    }, [open]);

    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[60] bg-black/65 overflow-y-auto"
            onClick={onCancel}
        >
            <div className="flex min-h-full items-start justify-center p-4 py-8">
                <div
                    className="relative bg-navy-800 border border-navy-600 rounded-2xl
            shadow-2xl w-full max-w-sm slide-down"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-5">
                        <div className="flex items-start gap-3 mb-4">
                            <AlertTriangle size={20}
                                className={danger
                                    ? 'text-rose-400 flex-shrink-0 mt-0.5'
                                    : 'text-amber-400 flex-shrink-0 mt-0.5'
                                } />
                            <div>
                                <h3 className="font-semibold text-white text-sm">{title}</h3>
                                <p className="text-slate-400 text-sm mt-1">{message}</p>
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={onCancel}
                                className="px-4 py-2 text-sm text-slate-400 hover:text-white
                  bg-navy-700 hover:bg-navy-600 rounded-lg border
                  border-navy-500 transition">
                                {cancelLabel}
                            </button>
                            <button onClick={onConfirm}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition
                  ${danger
                                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                        : 'bg-ocean-600 hover:bg-ocean-500 text-white'
                                    }`}>
                                {confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}