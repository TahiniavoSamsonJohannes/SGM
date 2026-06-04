import { useState, useCallback } from 'react';

// Retourne les IDs en cours de suppression (animation de sortie)
export function useDeleteAnimation(delayMs = 1000) {
    const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

    const triggerDelete = useCallback(
        async (id: number, deleteFunc: () => Promise<void>) => {
            // 1. Marquer l'item comme "en cours de suppression"
            setDeletingIds(prev => new Set(prev).add(id));

            // 2. Attendre la fin de l'animation CSS
            await new Promise(resolve => setTimeout(resolve, delayMs));

            // 3. Supprimer réellement
            await deleteFunc();

            // 4. Nettoyer (la liste Dexie aura déjà retiré l'item)
            setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        },
        [delayMs]
    );

    const isDeleting = useCallback(
        (id: number) => deletingIds.has(id),
        [deletingIds]
    );

    return { triggerDelete, isDeleting };
}