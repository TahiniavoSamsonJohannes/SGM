// Registre simple — pas besoin de Context pour ce cas
type CloseHandler = () => void;

const openModals: CloseHandler[] = [];

export const modalRegistry = {
    register(close: CloseHandler) {
        openModals.push(close);
    },
    unregister(close: CloseHandler) {
        const idx = openModals.indexOf(close);
        if (idx !== -1) openModals.splice(idx, 1);
    },
    closeTopmost(): boolean {
        if (openModals.length === 0) return false;
        const close = openModals[openModals.length - 1];
        close();
        return true;
    },
    hasOpen(): boolean {
        return openModals.length > 0;
    },
};