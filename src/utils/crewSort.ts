// Ordre hiérarchique décroissant des fonctions
export const FONCTION_ORDER: string[] = [
    'CAPITAINE',
    'SECOND CAPITAINE',
    'CHEF MÉCANICIEN',
    'SECOND MÉCANICIEN',
    'MAITRE GRAISSEUR',
    'GRAISSEUR',
    'BOSCO',
    'MATELOT QUALIFIÉ',
    'MATELOT',
    'CUISINIER',
];

/**
 * Retourne le rang hiérarchique d'une fonction.
 * Les fonctions inconnues sont placées en fin de liste.
 */
export function getFonctionRank(fonction: string): number {
    const normalized = fonction.toUpperCase().trim();
    const index = FONCTION_ORDER.findIndex(f => normalized.includes(f) || f.includes(normalized));
    return index === -1 ? FONCTION_ORDER.length : index;
}

/**
 * Trie un tableau de membres selon la hiérarchie des fonctions.
 * Les membres avec la même fonction sont triés alphabétiquement par nom.
 */
export function sortCrewByHierarchy<T extends { fonction: string; nom: string; prenom: string }>(
    members: T[]
): T[] {
    return [...members].sort((a, b) => {
        const rankA = getFonctionRank(a.fonction);
        const rankB = getFonctionRank(b.fonction);
        if (rankA !== rankB) return rankA - rankB;
        // Même rang → tri alphabétique
        const nameA = `${a.nom} ${a.prenom}`.toUpperCase();
        const nameB = `${b.nom} ${b.prenom}`.toUpperCase();
        return nameA.localeCompare(nameB);
    });
}

/**
 * Calcule l'âge en années depuis une date de naissance ISO (YYYY-MM-DD).
 * Retourne '—' si la date est invalide.
 */
export function calculateAge(dateNaissance: string): string {
    if (!dateNaissance) return '—';
    const birth = new Date(dateNaissance);
    if (isNaN(birth.getTime())) return '—';
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return String(age);
}