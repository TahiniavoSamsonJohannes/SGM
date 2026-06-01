// Formate date + heure
export function fmtDateTime(d: Date): string {
    return new Date(d).toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// Formate date + heure
export function fmtDate(d: Date): string {
    return new Date(d).toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

// ── Formatage nombre avec séparateur de milliers ──────────────────
export function fmtNumber(n: number): string {
    if (!n && n !== 0) return '0';
    // Séparateur de milliers = espace simple ASCII
    return Math.round(n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// ── Formatage date ISO → texte français ──────────────────────────
export const MOIS_FR = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export function fmtDateLong(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    const jour = String(d.getDate()).padStart(2, '0');
    const mois = MOIS_FR[d.getMonth()];
    const annee = d.getFullYear();
    return `${jour} ${mois} ${annee}`;
}

export function fmtDateShort(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    const jour = String(d.getDate()).padStart(2, '0');
    const mois = MOIS_FR[d.getMonth()];
    const annee = d.getFullYear();
    return `${jour} ${mois} ${annee}`;
}