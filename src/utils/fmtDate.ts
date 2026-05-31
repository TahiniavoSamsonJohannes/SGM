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