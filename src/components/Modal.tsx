import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { modalRegistry } from '../hooks/useModalRegistry';

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

    if (phase === 'closed') return null;

    const overlayClass = phase === 'closing'
        ? 'animate-fade-out'
        : 'animate-fade-in';

    const panelClass = phase === 'closing'
        ? 'animate-slide-up'
        : 'animate-slide-down';

    return createPortal(
        <div
            className={`fixed inset-0 z-50 bg-black/65 overflow-y-scroll ${overlayClass}`}
        >
            <div className="flex min-h-full items-start justify-center p-4 py-8">
                <div
                    className={`relative bg-navy-800 border border-navy-600 rounded-2xl
            shadow-2xl w-full ${maxWidth} ${panelClass}`}
                    onClick={e => e.stopPropagation()}
                >
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
                    <div className="px-5 py-5">{children}</div>
                </div>
            </div>
        </div>,
        document.body
    );
}