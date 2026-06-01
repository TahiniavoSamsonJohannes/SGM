import jsPDF from 'jspdf';
import type { CrewList, ChecklistDoc } from './db';
import { computeContractTotals, logExport } from './db';
import { sortCrewByHierarchy, calculateAge } from './utils/crewSort';
import { fmtDate, fmtDateLong, fmtDateShort, fmtNumber } from './utils/fmt';

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
    doc.setTextColor(0, 0, 0);
    doc.setFillColor(255, 255, 255);

    const img = await loadLogo('logo-ae');

    // ── Logo + infos haut gauche ──────────────────────────────────────
    const armText = 'ARMEMENT EUSTRATIOU';
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    const textWidth = doc.getTextWidth(armText);

    let y = 5;

    if (img) {
        const ratio = img.width / img.height;
        const imgWidth = 18;
        const imgHeight = imgWidth / ratio;
        const imgX = 15 + (textWidth - imgWidth) / 2;
        doc.addImage(img, 'PNG', imgX, y, imgWidth, imgHeight);
        y += imgHeight + 10 * 0.3;
    }

    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.text(armText, 15, y);
    y += 4;

    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.text(`Navire : ${list.shipName.toUpperCase()}`, 15, y);
    y += 4;
    doc.text(`Capitaine : ${list.capitaine.toUpperCase()}`, 15, y);
    y += 7;

    // ── Titre centré ──────────────────────────────────────────────────
    const subtitle = "LISTE D'EQUIPAGE";
    const subtitleWidth = doc.getTextWidth(subtitle) + 6;
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.text(subtitle, pageWidth / 2, y, { align: 'center' });
    doc.line(
        pageWidth / 2 - subtitleWidth / 2, y + 1,
        pageWidth / 2 + subtitleWidth / 2, y + 1
    );
    y += 6;

    // ── Départ / Destination ──────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont('times', 'bold');
    doc.text('Départ de : ', 15, y);
    doc.setFont('times', 'normal');
    doc.text(list.lieuDepart.toUpperCase(), 15 + 16, y);
    doc.setFont('times', 'bold');
    doc.text('Destination : ', pageWidth / 2, y);
    doc.setFont('times', 'normal');
    doc.text(list.destination.toUpperCase(), pageWidth / 2 + 18, y);
    y += 2;

    // ── Colonnes ──────────────────────────────────────────────────────
    const usable = pageWidth - 30;
    const col = [
        (4 / 100) * usable,  // N°
        (17 / 100) * usable,  // NOM ET PRENOMS
        (10 / 100) * usable,  // FONCTION
        (19 / 100) * usable,  // DATE ET LIEU DE NAISSANCE
        (4 / 100) * usable,  // AGE
        (8 / 100) * usable,  // CONTACT
        (10 / 100) * usable,  // NATIONALITE
        (8 / 100) * usable,  // FASCICULE
        (20 / 100) * usable,  // BREVETS
    ];

    const headers = [
        'N°',
        'NOM ET PRENOM(S)',
        'FONCTION',
        'DATE ET LIEU DE NAISSANCE',
        'AGE',
        'CONTACT',
        'NATIONALITE',
        'FASCICULE',
        'BREVETS',
    ];

    const headerH = 5;
    const lineHeight = 3;
    const rowHeight = 6;

    // ── En-tête ───────────────────────────────────────────────────────
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.setFillColor(255, 255, 255);

    let x = 15;
    headers.forEach((h, i) => {
        doc.rect(x, y, col[i], headerH);
        const lines = doc.splitTextToSize(h, col[i] - 2);
        const textY = y + 3.5;
        doc.text(lines, x + col[i] / 2, textY, { align: 'center' });
        x += col[i];
    });
    y += headerH;

    // ── Données — triées par hiérarchie ───────────────────────────────
    const sortedMembers = sortCrewByHierarchy(list.members);

    doc.setFont('times', 'normal');
    doc.setFontSize(6.5);

    sortedMembers.forEach((m, idx) => {
        const age = calculateAge(m.dateNaissance);
        const ddn = m.dateNaissance
            ? `${fmtDate(new Date(m.dateNaissance))}${m.lieuNaissance ? ', ' + m.lieuNaissance : ''}`
            : '';

        const row = [
            String(idx + 1).padStart(2, '0'),
            `${m.nom.toUpperCase()} ${m.prenom.toUpperCase()}`,
            m.fonction.toUpperCase(),
            ddn,
            age,
            m.telephone || '',
            (m.nationalite || '').toUpperCase(),
            m.fascicule,
            m.brevets
                ? m.brevets.split(/[/,;-]+/).filter(b => b.trim()).join('-')
                : '',
        ];

        // Préparer les lignes de chaque cellule
        const preparedRow = row.map((cell, i) =>
            doc.splitTextToSize(String(cell), col[i] - 2)
        );

        x = 15;
        preparedRow.forEach((lines, i) => {
            doc.rect(x, y, col[i], rowHeight);

            const textBlockH = lines.length * lineHeight;
            const textY = y + (rowHeight - textBlockH) / 2 + lineHeight - 0.5;

            // Alignement : centré sauf col 1 (nom)
            if (i === 0) {
                doc.setFontSize(8);
                doc.setFont('times', 'bold');
            } else {
                doc.setFont('times', 'normal');
                doc.setFontSize(6.5);
            }
            const isLeft = i === 1;
            if (isLeft) {
                doc.text(lines, x + 1.5, textY, { maxWidth: col[i] - 2 });
            } else {
                doc.text(lines, x + col[i] / 2, textY, {
                    align: 'center',
                    maxWidth: col[i] - 2,
                });
            }
            x += col[i];
        });

        y += rowHeight;
    });

    // ── Footer ────────────────────────────────────────────────────────
    y += 5;
    const words = numberToWords(sortedMembers.length);
    doc.setFontSize(10);
    doc.setFont('times', 'normal');
    doc.text(
        `Arrêté la présente liste au nombre de ${words} (${sortedMembers.length}) membres d'équipage.`,
        15, y
    );
    y += 10;
    doc.text('Bord le ........................', 15 + col[0], y);
    y += 10;
    doc.text('Le Capitaine', 15 + col[0], y);

    // ── Sauvegarde ────────────────────────────────────────────────────
    const filename = buildFilename('AE_LISTE_EQUIPAGE');
    doc.save(`${filename}.pdf`);

    await logExport({
        type: 'liste',
        filename: `${filename}.pdf`,
        shipName: list.shipName,
        destination: list.destination,
        membersCount: sortedMembers.length,
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
    doc.text(`NOM DU NAVIRE : ${doc_.shipName.toUpperCase()}`, marginX, 36);
    doc.text(`DESTINATION : ${doc_.destination.toUpperCase()}`, marginX, 41);
    doc.text(`IMMATRICULATION : ${doc_.immatriculation}`, 102, 36);
    doc.text(`REFERENCE DOSSIER : ${doc_.referDossier}`, 102, 41);

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
    rect(x, startY, col[1], totalHeader); centerText('Nom et prénom(s)', x, startY, col[1], totalHeader); x += col[1];
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
                .split(/[/,;-]+/)          // séparer sur tiret, virgule ou point-virgule
                .map(b => b.trim())
                .filter(b => b.length > 0)
                .join('-')               // rejoindre avec tiret
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

export interface ContractPDFData {
    nom: string;
    prenom: string;
    dateNaissance: string;
    lieuNaissance: string;
    adresse: string;
    fascicule: string;
    shipName: string;
    immatriculation: string;
    fonction: string;
    dateDebut: string;
    dateFin: string;
    salaireBaseJournalier: number;
    forfaitHeuresSupp: number;
    salaireCongeJournalier: number;
    indemRNC: number;
    beneficiaire: string;
    numCompteBancaire: string;
    montantDelegation: number;
}

export async function generateContractPDF(data: ContractPDFData): Promise<void> {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true,
        floatPrecision: 'smart',
    } as any);

    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 15;
    const marginY = 25;

    // ── Calculs automatiques ──────────────────────────────────────
    const {
        totalSalaireBase,
        totalForfait,
        totalConge,
        totalRNC,
        totalGeneral,
    } = computeContractTotals(data);

    let y = marginY;

    // ═══════════════════════════════════════════════════════════════
    // PAGE 1
    // ═══════════════════════════════════════════════════════════════

    // ── Titre ──────────────────────────────────────────────────────
    doc.setFont('times', 'bold');
    doc.setFontSize(17);
    doc.rect(marginX, y, pageWidth - marginX * 2, -12);
    doc.text(
        "CONTRAT INDIVIDUEL D'ENGAGEMENT MARITIME",
        pageWidth / 2, y - 4,
        { align: 'center' }
    );

    y += 20;

    // ── Préambule ──────────────────────────────────────────────────
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    const p1 = 'Nous soussignés, Société Eustratiou & Fils, ARMEMENT EUTRATIOU, 18 Rue Richelieu Amparisaka 401 MAHAJANGA.';
    doc.text(doc.splitTextToSize(p1, pageWidth - marginX * 2), marginX, y);

    y += 20;

    // ── Déclaration ────────────────────────────────────────────────
    const col2X = pageWidth / 2 - 25;  // position des valeurs
    const sepX = pageWidth / 2 - 29;  // position des ":"

    doc.setFont('times', 'bold');
    doc.text('Déclarons embaucher,', marginX, y);

    const fields: [string, string][] = [
        ['Nom', data.nom.toUpperCase()],
        ['Prénom(s)', data.prenom],
        ['Date et lieu de naissance', `${fmtDateLong(data.dateNaissance)} à ${data.lieuNaissance}`],
        ['N° de livret Maritime', data.fascicule],
        ['Adresse', data.adresse],
        ['Pour embarquer à bord du navire', data.shipName.toUpperCase()],
        ['Immatriculé', data.immatriculation],
        ['En qualité de', data.fonction.toUpperCase()],
    ];

    fields.forEach(([label, value]) => {
        y += (label === 'Nom') ? 6 : 8;
        doc.setFont('times', 'normal');
        doc.text(label, marginX + 5, y);
        doc.text(':', sepX, y);
        doc.text(value, col2X, y);
    });

    // ── Section 1 : Durée ──────────────────────────────────────────
    y += 8;
    doc.setFont('times', 'bold');
    doc.text('1- Durée du contrat', marginX, y);
    doc.setLineWidth(0.3);
    doc.line(marginX, y + 1, 48, y + 1);

    y += 6;
    doc.setFont('times', 'normal');
    doc.text('Ce contrat prend effet à compter du :', marginX + 5, y);
    doc.text(`${fmtDateShort(data.dateDebut)},`, pageWidth / 2 - 25, y);
    doc.text("jusqu'au :", pageWidth / 2 + 10, y);
    doc.text(fmtDateShort(data.dateFin), pageWidth / 2 + 28, y);

    // ── Section 2 : Obligations ────────────────────────────────────
    y += 8;
    doc.setFont('times', 'bold');
    doc.text('2- Obligations et fonctions', marginX, y);
    doc.line(marginX, y + 1, 58.5, y + 1);

    y += 6;
    doc.setFont('times', 'normal');
    const p2 = "Le marin embarquera à n'importe quel moment sur un navire appartenant ou géré par l'armateur pour occuper le poste en fonction pour lequel il a été formé. En tout état de cause, les conditions d'engagement restent les mêmes quelle que soit la taille du navire à bord duquel il va servir. Il s'engage à respecter les disciplines à bord du navire et les règlements intérieurs de la société.";
    doc.text(doc.splitTextToSize(p2, pageWidth - marginX * 2), marginX + 5, y);

    y += 22;
    const p3 = "Le marin est tenu à une obligation de résultat. A part son esprit d'initiative, il doit prouver à son armateur sa capacité d'adaptation, d'innovation, d'organisation.";
    doc.text(doc.splitTextToSize(p3, pageWidth - marginX * 2 - 5), marginX + 5, y);

    y += 12;
    const p4 = "Le manquement à cette obligation de résultat peut entraîner la suspension de toutes ou parties des primes.";
    doc.text(doc.splitTextToSize(p4, pageWidth - marginX * 2 - 5), marginX + 5, y);

    // ── Section 3 : Rémunération ───────────────────────────────────
    y += 8;
    doc.setFont('times', 'bold');
    doc.text('3- Rémunération', marginX, y);
    doc.line(marginX, y + 1, 43.5, y + 1);

    y += 6;
    doc.setFont('times', 'normal');
    doc.text('Les parties ont adopté un mode de rémunération mensuelle :', marginX + 5, y);

    // ── 3.1 Salaire ────────────────────────────────────────────────
    y += 6;
    doc.setFont('times', 'bold');
    doc.text('3.1- La salaire', marginX + 10, y);
    doc.line(marginX + 10, y + 1, 48.8, y + 1);
    doc.text('Nbj/mois', pageWidth / 2 + 10, y);
    doc.text('Total mensuel', pageWidth / 2 + 50, y);

    const salaryRows: [string, number, string, string, number][] = [
        // [label, valeur journalière, unité, nbj, total]
        ['Salaire de base journalier', data.salaireBaseJournalier, 'Ar', '30', totalSalaireBase],
        ['Forfait heures supplémentaires', data.forfaitHeuresSupp, 'Ar', 'Mensuel', totalForfait],
        ['Salaire journalier de congé', data.salaireCongeJournalier, 'Ar', '06', totalConge],
        ['Indemnité de RNC', data.indemRNC, 'Ar', '12', totalRNC],
    ];

    salaryRows.forEach(([label, valeur, unite, nbj, total]) => {
        y += 7;
        doc.setFont('times', 'normal');
        doc.text(`-  ${label}`, marginX + 12, y);
        doc.text(':', pageWidth / 2 - 20, y);
        doc.text(fmtNumber(valeur), pageWidth / 2 - 17, y);
        doc.text(unite, pageWidth / 2 + 2, y);
        doc.text(String(nbj), pageWidth / 2 + 15, y);
        doc.text(`${fmtNumber(total)} Ar`, pageWidth - marginX - 15, y, { align: 'right' });
    });

    y += 6;
    doc.setFont('times', 'bold');
    doc.text('TOTAL :', pageWidth / 2 + 49, y, { align: 'right' });
    doc.text(`${fmtNumber(totalGeneral)} Ar`, pageWidth - marginX - 15, y, { align: 'right' });

    // ── 3.2 Délégation ─────────────────────────────────────────────
    y += 6;
    doc.setFont('times', 'bold');
    doc.text('3.2- Délégation de salaire', marginX + 10, y);
    doc.line(marginX + 10, y + 1, 66.8, y + 1);

    y += 7;
    doc.setFont('times', 'normal');
    doc.text(`-  Bénéficiaire : ${data.beneficiaire || ''}`, marginX + 12, y);
    y += 7;
    doc.text(`-  Compte bancaire n° : ${data.numCompteBancaire || ''}`, marginX + 12, y);
    y += 7;
    doc.text(`-  Montant : ${data.montantDelegation ? fmtNumber(data.montantDelegation) + ' Ar' : ''}`, marginX + 12, y);

    // ═══════════════════════════════════════════════════════════════
    // PAGE 2
    // ═══════════════════════════════════════════════════════════════
    doc.addPage();
    doc.setFontSize(11);
    y = marginY;

    const sections: Array<{
        title: string;
        underlineEnd: number;
        text: string;
        afterY: number;
    }> = [
            {
                title: '4- Nourriture et hébergement',
                underlineEnd: 64,
                text: "Pendant la durée de son embarquement, le marin est nourri en tenant compte des habitudes alimentaires de l'ensemble du personnel. Il est logé à bord dans une bonne condition d'hygiène et de sécurité.",
                afterY: 12,
            },
            {
                title: '5- Congés et repos',
                underlineEnd: 45.5,
                text: "Pendant la durée de son embarquement effectif, le marin aura droit à un congé de 6 jours par mois d'embarquement. Un mois d'embarquement effectif donne droit à 10 jours de repos.",
                afterY: 12,
            },
            {
                title: '6- Retenues',
                underlineEnd: 34.5,
                text: "Le salaire brut du marin est soumis aux différentes retenues légales (sociales et fiscales) en vigueur à Madagascar.",
                afterY: 12,
            },
            {
                title: '7- Blessures et maladies',
                underlineEnd: 54.5,
                text: "Au cas où une maladie ou une blessure surviendrait au marin lors de l'exercice de sa fonction, les charges relatives à son traitement (jusqu'à son rétablissement ou pour une période maximum de quatre mois après la date de son embarquement) sont supportées à 80% par l'OSIEM.",
                afterY: 16,
            },
            {
                title: '8- Sécurité sociale',
                underlineEnd: 45,
                text: "L'employé sera affilié par l'Employeur à la CNAPS pour toutes les questions de prévoyance sociale, et accepte de payer les cotisations subséquentes par voie de précompte sur appointements notamment en matière :",
                afterY: 12,
            },
        ];

    sections.forEach(s => {
        doc.setFont('times', 'bold');
        doc.text(s.title, marginX, y);
        doc.line(marginX, y + 1, s.underlineEnd, y + 1);
        y += 6;
        doc.setFont('times', 'normal');
        doc.text(doc.splitTextToSize(s.text, pageWidth - marginX - 10), marginX + 5, y);
        y += s.afterY;
    });

    // Points CNAPS
    [
        "d'accident de travail",
        'de maladies professionnelles',
        'de régime de retraite',
        "d'allocations familiales",
    ].forEach(item => {
        doc.text(`-    ${item}`, marginX + 12, y);
        y += 6;
    });

    // Sections 9 à 12
    const sections2: Array<{
        title: string;
        underlineEnd: number;
        text: string;
        afterY: number;
    }> = [
            {
                title: '9- Accident et décès',
                underlineEnd: 48,
                text: "En cas de décès ou infirmité permanente, le marin est couvert par une « assurance individuelle contre les accidents » contracté auprès de l'assurance ARO.",
                afterY: 12,
            },
            {
                title: '10- Litiges',
                underlineEnd: 32.5,
                text: "Les litiges entre le marin et l'armateur relèvent du tribunal de droit commun malgache après l'échec d'une tentative de conciliation devant l'autorité administrative maritime.",
                afterY: 12,
            },
            {
                title: '11- Rapatriement du marin',
                underlineEnd: 61,
                text: "Le rapatriement du marin est à la charge du navire ou de l'armateur quel que soit le port de débarquement du marin jusqu'à son port d'embarquement ou au port d'attache du navire.",
                afterY: 12,
            },
            {
                title: '12- Résiliation du contrat',
                underlineEnd: 57.5,
                text: "Le contrat d'engagement maritime prend fin selon les conditions prévues par les articles 3.7.01 jusqu'à 3.7.05 du code maritime malgache.",
                afterY: 12,
            },
        ];

    sections2.forEach(s => {
        y += 2;
        doc.setFont('times', 'bold');
        doc.text(s.title, marginX, y);
        doc.line(marginX, y + 1, s.underlineEnd, y + 1);
        y += 6;
        doc.setFont('times', 'normal');
        doc.text(doc.splitTextToSize(s.text, pageWidth - marginX - 10), marginX + 5, y);
        y += s.afterY;
    });

    // ── Clause finale ──────────────────────────────────────────────
    const pFinal = "Les parties ayant acceptées les conditions d'engagement citées ci-dessus, déclarent avoir pris connaissances des conditions générales d'engagement maritime des marins malgache prévue par la loi n°99-028 du 03 Février 2000 portant code maritime malgache.";
    doc.setFont('times', 'normal');
    doc.text(doc.splitTextToSize(pFinal, pageWidth - marginX - 10), marginX, y);

    // ── Signatures ─────────────────────────────────────────────────
    y += 20;
    doc.text('Fait à Mahajanga, le ………………………………', marginX, y);

    y += 8;
    doc.setFont('times', 'bold');
    doc.text('Lu et Approuvé,', marginX, y);
    doc.text("L'Armateur ou son représentant", pageWidth / 2, y, { align: 'center' });
    doc.text("L'autorité administrative", pageWidth - marginX - 5, y, { align: 'right' });

    y += 5;
    doc.setFont('times', 'normal');
    doc.text('Le marin', marginX, y);

    // ── Sauvegarde ─────────────────────────────────────────────────
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${pad2(now.getDate())}${pad2(now.getMonth() + 1)}${now.getFullYear()}`;
    const filename = `AE_CONTRAT_${data.nom.toUpperCase()}_${dateStr}_${now.getTime()}.pdf`;

    doc.save(filename);

    await logExport({
        type: 'liste',          // réutilise le type existant
        filename,
        shipName: data.shipName,
        destination: data.fonction,
        membersCount: 1,
        exportedAt: now,
    });
}