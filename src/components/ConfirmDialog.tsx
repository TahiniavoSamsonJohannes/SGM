import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
    // État interne : 'closed' | 'opening' | 'open' | 'closing'
    const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
    const onCancelRef = useRef(onCancel);
    useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);

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
        if (phase === 'closing') return;
        document.body.style.overflow = 'hidden';
        const handler = () => onCancelRef.current();
        modalRegistry.register(handler);
        return () => {
            document.body.style.overflow = '';
            modalRegistry.unregister(handler);
        };
    }, [phase]);

    if (phase === 'closed') return null;


    const overlayClass = phase === 'closing'
        ? 'animate-fade-out'
        : 'animate-fade-in';

    const panelClass = phase === 'closing'
        ? 'animate-slide-up'
        : 'animate-slide-down';

    return createPortal(
        <div
            className={`fixed inset-0 z-[60] bg-black/65 overflow-y-auto ${overlayClass}`}
        >
            <div className="flex min-h-full items-start justify-center p-4 py-8">
                <div
                    className={`relative bg-navy-800 border border-navy-600 rounded-2xl
            shadow-2xl w-full max-w-sm ${panelClass}`}
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