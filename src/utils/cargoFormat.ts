// Conversion kg (peut être décimal) → format XXTXXX,XX
export function formatPoidsKg(kg: number): string {
    const n = Number(kg);
    if (isNaN(n)) return '00T000,00';
    if (n === 0) return '00T000,00';

    const abs = Math.abs(kg);
    const tonnes = Math.floor(abs / 1000);
    const resteKg = abs % 1000;

    const resteInt = Math.floor(resteKg);
    const resteDec = Math.round((resteKg - resteInt) * 100);

    const tStr = String(tonnes).padStart(2, '0');
    const rStr = String(resteInt).padStart(3, '0');
    const dStr = String(resteDec).padStart(2, '0');

    return `${tStr}T${rStr},${dStr}`;
}

// Somme totale en kg → format tonne
export function totalPoidsKg(items: { poidsKg: number }[]): string {
    const total = items.reduce((sum, i) => sum + (Number(i.poidsKg) || 0), 0);
    return formatPoidsKg(total);
}

// Somme des colis
export function totalColis(
    items: { marchandises: { nbColis: number }[] }[]
): number {
    return items.reduce(
        (sum, item) =>
            sum + item.marchandises.reduce((s, m) => s + (m.nbColis || 0), 0),
        0
    );
}

// Nombre en lettres (simplifié pour les usages PDF)
const UNITS = [
    '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
    'dix-sept', 'dix-huit', 'dix-neuf',
];
const TENS = [
    '', '', 'vingt', 'trente', 'quarante', 'cinquante',
    'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix',
];

function dizaines(n: number): string {
    if (n < 20) return UNITS[n];
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (t === 7) return 'soixante-' + UNITS[10 + u];
    if (t === 9) return 'quatre-vingt-' + UNITS[10 + u];
    const suffix = t === 8
        ? (u === 0 ? 's' : '-' + UNITS[u])
        : (u > 0 ? '-' + UNITS[u] : '');
    return TENS[t] + suffix;
}

function centaines(n: number): string {
    if (n < 100) return dizaines(n);
    const c = Math.floor(n / 100);
    const r = n % 100;
    const centStr = c === 1 ? 'cent' : UNITS[c] + ' cent';
    return r === 0
        ? centStr + (c > 1 ? 's' : '')
        : centStr + ' ' + dizaines(r);
}

export function numberToWords(n: number): string {
    if (!n || isNaN(n)) return 'zéro';
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'zéro';
    if (n < 1000) return centaines(n);
    if (n < 1000000) {
        const m = Math.floor(n / 1000);
        const r = n % 1000;
        const milleStr = m === 1 ? 'mille' : centaines(m) + ' mille';
        return r === 0 ? milleStr : milleStr + ' ' + centaines(r);
    }
    return String(n);
}

// ── Poids format XXTXXX,XX → lettres françaises ───────────────────
// Ex: "22T572,00" → "vingt-deux tonnes cinq cent soixante-douze kilogrammes"
export function poidsEnLettres(poidsFormate: string): string {
    if (!poidsFormate || !poidsFormate.includes('T')) return '';

    const [tPart, kgPart] = poidsFormate.split('T');
    const [kgInt, kgDec] = (kgPart ?? '').split(',');

    const tonnes = parseInt(tPart ?? '0', 10) || 0;
    const kg = parseInt(kgInt ?? '0', 10) || 0;
    const dec = parseInt(kgDec ?? '0', 10) || 0;

    const parts: string[] = [];

    if (tonnes > 0) {
        parts.push(`${numberToWords(tonnes)} tonne${tonnes > 1 ? 's' : ''}`);
    }
    if (kg > 0) {
        parts.push(`${numberToWords(kg)} kilo${kg > 1 ? 's' : ''}`);
    }
    if (dec > 0) {
        parts.push(`${numberToWords(dec)}`);
    }

    if (parts.length === 0) return 'zéro kilo';
    return parts.join(' ');
}