import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface Props {
    // Le conteneur scrollable de la page (ref passé depuis la page)
    scrollContainerRef?: React.RefObject<HTMLElement>;
}

export default function ScrollToTopButton({ scrollContainerRef }: Props) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const container = scrollContainerRef?.current
            ?? document.querySelector('main')
            ?? window;

        const handleScroll = () => {
            const scrollTop = container instanceof Window
                ? window.scrollY
                : (container as HTMLElement).scrollTop;
            setVisible(scrollTop > 200);
        };
        
        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [scrollContainerRef]);

    const scrollToTop = () => {
        const container = scrollContainerRef?.current
            ?? document.querySelector('main')
            ?? window;

        if (container instanceof Window) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            (container as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    if (!visible) return null;

    return (
        <button
            onClick={scrollToTop}
            className={`fixed bottom-20 right-1/2 transform translate-x-1/2 lg:right-10 lg:translate-x-0  z-40
        bg-ocean-600 hover:bg-ocean-500 text-white
        w-10 h-10 rounded-full shadow-lg
        flex items-center justify-center
        transition-all duration-500 ${visible ? 'animate-fade-in' : 'animate-fade-out'}`}
            title="Retour en haut"
        >
            <ArrowUp size={18} />
        </button>
    );
}