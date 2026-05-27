import jsPDF from 'jspdf';
import type { CrewList, ChecklistDoc } from './db';
import { logExport } from './db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0'); }

function buildFilename(prefix: 'AE_LISTE_EQUIPAGE' | 'AE_CHECKLIST'): string {
    const now = new Date();
    const date = `${pad2(now.getDate())}${pad2(now.getMonth() + 1)}${now.getFullYear()}`;
    const ms = now.getTime();
    return `${prefix}_${date}_${ms}`;
}

const numberToWords = (n: number): string => {
    const units = [
        'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
        'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
        'dix-sept', 'dix-huit', 'dix-neuf',
    ];
    const tens = [
        '', '', 'vingt', 'trente', 'quarante', 'cinquante',
        'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix',
    ];
    if (n < 20) return units[n];
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        if (t === 7) return 'soixante-' + units[10 + u];
        if (t === 9) return 'quatre-vingt-' + units[10 + u];
        const suffix = t === 8
            ? (u === 0 ? 's' : '-' + units[u])
            : (u > 0 ? '-' + units[u] : '');
        return tens[t] + suffix;
    }
    return n.toString();
};

async function loadLogo(name: string): Promise<HTMLImageElement | null> {
    return new Promise(resolve => {
        const img = new Image();
        img.src = `/${name}.png`;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
    });
}

// Formate date
function fmtDate(d: Date): string {
    return new Date(d).toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

// ─── LISTE D'ÉQUIPAGE — reproduit exactement le template fourni ───────────────

export async function generateCrewListPDF(list: CrewList): Promise<void> {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true,
        floatPrecision: 'smart',
    } as any);

    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setLineWidth(0.3);

    const img = await loadLogo('logo-ae');

    // ── Constantes de mise en page ──
    const startX = 15;
    const textX = startX;
    const members = list.members;

    // ── Logo ──
    const armText = 'ARMEMENT EUSTRATIOU';
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    const textWidth = doc.getTextWidth(armText);

    let y = 5;

    if (img) {
        const ratio = img.width / img.height;
        const imgWidth = 18;
        const imgHeight = imgWidth / ratio;
        const imgX = textX + (textWidth - imgWidth) / 2;
        doc.addImage(img, 'PNG', imgX, y, imgWidth, imgHeight);
        y += imgHeight + 10 * 0.3;
    }

    // ── Nom société ──
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(armText, textX, y);
    y += 4;

    // ── Infos navire / capitaine ──
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.text(`Navire : ${list.shipName.toUpperCase()}`, startX, y);
    y += 4;
    doc.text(`Capitaine : ${list.capitaine.toUpperCase()}`, startX, y);
    y += 7;

    // ── Titre centré ──
    const subtitle = "LISTE D'EQUIPAGE";
    const subtitleWidth = doc.getTextWidth(subtitle) + 6;
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.text(subtitle, pageWidth / 2, y, { align: 'center' });
    doc.line(
        pageWidth / 2 - subtitleWidth / 2,
        y + 1,
        pageWidth / 2 + subtitleWidth / 2,
        y + 1
    );
    y += 6;

    // ── Départ / Destination ──
    doc.setFontSize(9);
    doc.setFont('times', 'bold');
    doc.text('Départ de : ', startX, y);
    doc.setFont('times', 'normal');
    doc.text(list.lieuDepart.toUpperCase(), startX + 16, y);
    doc.setFont('times', 'bold');
    doc.text('Destination : ', pageWidth / 2, y);
    doc.setFont('times', 'normal');
    doc.text(list.destination.toUpperCase(), pageWidth / 2 + 18, y);
    y += 2;

    // ── Tableau ──
    // Colonnes : 5%, 30%, 20%, 10%, 35% de (pageWidth - 30)
    const usable = pageWidth - 30;
    const col = [
        usable * 0.05,   // N°
        usable * 0.30,   // Nom
        usable * 0.20,   // Fonction
        usable * 0.10,   // Fascicule
        usable * 0.35,   // Brevets
    ];

    const headers = ['N°', 'NOM ET PRENOMS', 'FONCTION', 'FASCICULE', 'BREVETS'];
    const lineHeight = 3;
    const rowHeight = 6;

    // En-tête
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.setFillColor(255, 255, 255);
    doc.setTextColor(0, 0, 0);

    let x = startX;
    headers.forEach((h, i) => {
        doc.rect(x, y, col[i], 5);
        doc.text(h, x + col[i] / 2, y + 3.5, { align: 'center' });
        x += col[i];
    });
    y += 5;

    // Données
    doc.setFont('times', 'normal');
    doc.setFontSize(7);

    members.forEach((m, idx) => {
        const row = [
            String(idx + 1).padStart(2, '0'),
            `${m.nom.toUpperCase()} ${m.prenom.toUpperCase()}`,
            m.fonction.toUpperCase(),
            m.fascicule,
            m.brevets,
        ];

        const preparedRow = row.map((cell, i) =>
            doc.splitTextToSize(String(cell), col[i] - 4)
        );

        x = startX;
        preparedRow.forEach((lines, i) => {
            doc.rect(x, y, col[i], rowHeight);

            const textBlockHeight = lines.length * lineHeight;
            const textY = y + (rowHeight - textBlockHeight) / 2 + lineHeight - 0.5;

            if (i !== 1) {
                doc.text(lines, x + col[i] / 2, textY, {
                    maxWidth: col[i] - 4,
                    align: 'center',
                });
            } else {
                doc.text(lines, x + 2, textY, { maxWidth: col[i] - 4 });
            }
            x += col[i];
        });

        y += rowHeight;
    });

    // ── Footer ──
    y += 5;
    const words = numberToWords(members.length);
    doc.setFontSize(10);
    doc.setFont('times', 'normal');
    doc.text(
        `Arrêté la présente liste au nombre de ${words} (${members.length}) membres d'équipage.`,
        startX,
        y
    );

    y += 10;
    doc.text(`Bord le ........................`, startX + col[0], y);
    y += 10;
    doc.text('Le Capitaine', startX + col[0], y);

    // ── Sauvegarde ──
    const filename = buildFilename('AE_LISTE_EQUIPAGE');
    doc.save(`${filename}.pdf`);

    await logExport({
        type: 'liste',
        filename: `${filename}.pdf`,
        shipName: list.shipName,
        destination: list.destination,
        membersCount: members.length,
        exportedAt: new Date(),
    });
}

// ─── CHECKLIST — reproduit exactement le template fourni ─────────────────────

export async function generateChecklistPDF(doc_: ChecklistDoc): Promise<void> {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true,
        floatPrecision: 'smart',
    } as any);

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 15;
    const marginY = 10;

    doc.setTextColor(0, 0, 0);
    doc.setFillColor(255, 255, 255);

    // ── Helpers ──────────────────────────────────────────────────────────
    function rect(x: number, y: number, w: number, h: number, lw = 0.3) {
        doc.setLineWidth(lw);
        doc.rect(x, y, w, h);
    }

    function centerText(
        text: string | string[],
        x: number, y: number, w: number, h: number,
        lh = 4
    ) {
        const lines = Array.isArray(text) ? text : doc.splitTextToSize(text, w - 1);
        const total = lines.length * lh;
        const textY = y + h / 2 - total / 2 + lh - 1;
        doc.text(lines, x + w / 2, textY, { align: 'center' });
    }

    function leftText(
        text: string | string[],
        x: number, y: number, w: number, h: number,
        lh = 2
    ) {
        const lines = Array.isArray(text) ? text : doc.splitTextToSize(text, w - 1);
        const total = lines.length * lh;
        const textY = y + h / 2 - total / 2 + lh - 0.5;
        doc.text(lines, x + 1, textY);
    }

    // ── Logo ──────────────────────────────────────────────────────────────
    const img = await loadLogo('logo-ap');
    if (img) doc.addImage(img, 'PNG', marginX, marginY, 20, 20);

    // ── Version ──────────────────────────────────────────────────────────
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.text('Version 003', pageWidth - marginX - 10, 15);
    doc.text('du 30/01/25', pageWidth - marginX - 10, 18);

    // ── Titre ──────────────────────────────────────────────────────────
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.text(
        'CHECKLIST PLAN DE CHARGEMENT – EQUIPAGE',
        pageWidth / 2, marginY + 13,
        { align: 'center' }
    );

    // ── Infos haut ────────────────────────────────────────────────────
    doc.setFontSize(10);
    doc.text(`NOM DU NAVIRE : ........................................................`, marginX, 36);
    doc.text(`DESTINATION : ..............................................................`, marginX, 41);
    doc.text(`IMMATRICULATION : ...................................................................`, 102, 36);
    doc.text(`REFERENCE DOSSIER : .................................................................`, 102, 41);

    // ── Colonnes tableau ──────────────────────────────────────────────
    const startX = 15;
    const startY = 45;

    const col = [
        7.2,    // N°
        27.84,  // Nom
        18.72,  // Date naissance
        16.02,  // Fonction
        13.02,  // LPM
        50.112, // Une ligne par document*
        11.214, // CSGM
        9.078,  // DRA
        33.408, // Observations
    ];

    const rowHeight = 8.25;
    const header1 = 4;
    const header2 = 3.5;
    const totalHeader = header1 + header2;

    // ── En-tête tableau ───────────────────────────────────────────────
    doc.setFont('times', 'bold');
    doc.setFontSize(9);

    let x = startX;

    rect(x, startY, col[0], totalHeader); centerText('N°', x, startY, col[0], totalHeader); x += col[0];
    rect(x, startY, col[1], totalHeader); centerText('Nom et prénoms', x, startY, col[1], totalHeader); x += col[1];
    rect(x, startY, col[2], totalHeader); centerText(['Date et lieu', 'de naissance'], x, startY, col[2], totalHeader); x += col[2];
    rect(x, startY, col[3], totalHeader); centerText('Fonction', x, startY, col[3], totalHeader); x += col[3];
    rect(x, startY, col[4], totalHeader); centerText('LPM', x, startY, col[4], totalHeader); x += col[4];

    rect(x, startY, col[5] + col[6] + col[7], header1);
    centerText('Vérifications', x, startY, col[5] + col[6] + col[7], header1);
    rect(x, startY + header1, col[5], header2); centerText('Une ligne par document*', x, startY + header1, col[5], header2);
    rect(x + col[5], startY + header1, col[6], header2); centerText('CSGM', x + col[5], startY + header1, col[6], header2);
    rect(x + col[5] + col[6], startY + header1, col[7], header2); centerText('DRA', x + col[5] + col[6], startY + header1, col[7], header2);
    x += col[5] + col[6] + col[7];

    rect(x, startY, col[8], totalHeader); centerText('Observations', x, startY, col[8], totalHeader);

    // ── Données ───────────────────────────────────────────────────────
    doc.setFont('times', 'normal');
    doc.setFontSize(7);

    let y = startY + totalHeader;

    doc_.members.forEach((m, idx) => {
        x = startX;

        // ── Dessiner toutes les cellules de la ligne ──────────────────
        for (let i = 0; i < col.length; i++) {
            rect(x, y, col[i], rowHeight);
            x += col[i];
        }

        x = startX;

        // ── N° ────────────────────────────────────────────────────────
        doc.setFont('times', 'bold');
        doc.setFontSize(9);
        centerText(String(idx + 1).padStart(2, '0'), x, y, col[0], rowHeight);
        x += col[0];

        // ── Nom et prénoms ────────────────────────────────────────────
        doc.setFont('times', 'normal');
        doc.setFontSize(6.2);
        leftText(
            `${m.nom.toUpperCase()} ${m.prenom.toUpperCase()}`,
            x, y, col[1], rowHeight
        );
        x += col[1];

        // ── Date et lieu de naissance ─────────────────────────────────
        const ddn = m.dateNaissance
            ? `${fmtDate(new Date(m.dateNaissance))}${m.lieuNaissance ? '\n' + m.lieuNaissance : ''}`
            : '';
        leftText(ddn, x, y, col[2], rowHeight);
        x += col[2];

        // ── Fonction ──────────────────────────────────────────────────
        centerText(m.fonction.toUpperCase(), x, y, col[3], rowHeight);
        x += col[3];

        // ── LPM (fascicule) ───────────────────────────────────────────
        centerText(m.fascicule, x, y, col[4], rowHeight);
        x += col[4];

        // ── Une ligne par document* — brevets séparés par " - " ───────
        const brevetsText = m.brevets
            ? m.brevets
                .split(/[-,;]+/)          // séparer sur tiret, virgule ou point-virgule
                .map(b => b.trim())
                .filter(b => b.length > 0)
                .join(' - ')               // rejoindre avec tiret
            : '';
        leftText(brevetsText, x, y, col[5], rowHeight);
        x += col[5];

        // ── CSGM, DRA, Observations — cellules vides ──────────────────
        // (déjà dessinées dans la boucle rect ci-dessus, rien à écrire)

        y += rowHeight;
    });

    // ─────────────────────────────────────────────────────────────────
    // BLOC INFÉRIEUR — positionné JUSTE sous le tableau (y courant)
    // La note de bas de page est ancrée à pageHeight - 15 (fixe)
    // ─────────────────────────────────────────────────────────────────

    // ── Safe Manning — juste sous le tableau ─────────────────────────
    const safeY = y; // y = position exacte après la dernière ligne

    rect(marginX + col[0] + col[1] + col[2] + col[3] + col[4] + col[5], safeY, col[6], rowHeight);
    rect(marginX + col[0] + col[1] + col[2] + col[3] + col[4] + col[5] + col[6], safeY, col[7], rowHeight);
    rect(marginX + col[0] + col[1] + col[2] + col[3] + col[4] + col[5] + col[6] + col[7], safeY, col[8], rowHeight);

    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text(
        'Vérification de la conformité au',
        pageWidth / 2 - 11, safeY + 5.5,
        { align: 'center' }
    );
    doc.setFont('times', 'italic', 'bold');
    doc.text(
        'Safe Manning',
        pageWidth - col[8] - col[7] - col[6] - 23, safeY + 5.5,
        { align: 'center' }
    );

    // ── Textes administratifs — juste sous Safe Manning ───────────────
    const words = numberToWords(doc_.members.length);

    doc.setFont('times', 'bold');
    doc.setFontSize(11);

    const textStartY = safeY + rowHeight + 3;

    doc.text(
        `Arrêté la présente liste au nombre de ${words} (${doc_.members.length}) membres d'équipage.`,
        marginX, textStartY
    );

    doc.text(
        'Si la liste comporte des annexes, veuillez préciser la page actuelle et le total : page ...................... sur ......................',
        marginX, textStartY + 6,
        { align: 'justify', maxWidth: 185 }
    );

    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    const paragraph = `Le présent checklist a été établit aux fins de vérifications des documents de l'équipage préalablement au chargement des marchandises. En cas d'anomalies, le capitaine du navire pourra bénéficier selon l'appréciation du Directeur Régional ou de toutes personnes qu'il aura désignées du délai de chargement pour la régularisation de ses dossiers. De par sa signature, le capitaine reconnait avoir pris connaissances de ces anomalies et s'engage à les rectifier avant le départ des navires sous peine du retard de son navire et de l'application des sanctions appropriées.`;
    const pLines = doc.splitTextToSize(paragraph, 185);
    doc.text(pLines, marginX, textStartY + 13, { align: 'justify', maxWidth: 185 });

    // ── Signatures — juste sous le paragraphe ─────────────────────────
    const sigY = textStartY + 13 + pLines.length * 4.5 + 4;

    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.text('Mahajanga le ........................', pageWidth / 2, sigY, { align: 'center' });
    doc.text('Le Chef de Section Gens de mer', marginX, sigY + 10);
    doc.text('Le Directeur Régional', pageWidth / 2, sigY + 10, { align: 'center' });
    doc.text('Le Capitaine', 165, sigY + 10);

    // ── Note de bas de page — FIXE en bas ────────────────────────────
    const foot = `*Une ligne par document incluant le contrat, l'aptitude médicale et la liste des brevets, titres, certificats, attestation,... et autres documents pertinents`;
    const footLines = doc.splitTextToSize(foot, 185);
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.text(footLines, marginX, pageHeight - 12);

    // ── Sauvegarde ────────────────────────────────────────────────────
    const filename = buildFilename('AE_CHECKLIST');
    doc.save(`${filename}.pdf`);

    await logExport({
        type: 'checklist',
        filename: `${filename}.pdf`,
        shipName: doc_.shipName,
        destination: doc_.destination,
        membersCount: doc_.members.length,
        exportedAt: new Date(),
    });
}