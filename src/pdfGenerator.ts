import jsPDF from 'jspdf';
import type { CrewList, ChecklistDoc, ExportedFileListe, ExportedFileChecklist, ExportedFileContrat, ExportedFileManifeste } from './db';
import { type CargoItem, computeContractTotals, enrichMembersWithFonction, logExport } from './db';
import { sortCrewByHierarchy, calculateAge } from './utils/crewSort';
import { fmtDate, fmtDateLong, fmtDateNumeric, fmtDateShort, fmtNumber } from './utils/fmt';
import { formatPoidsKg, totalColis, totalPoidsKg, numberToWords, poidsEnLettres } from './utils/cargoFormat';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0'); }

function buildFilename(prefix: 'AE_LISTE_EQUIPAGE' | 'AE_CHECKLIST' | 'AE_MANIFESTE_CARGO' | 'AE_CONTRAT'): string {
    const now = new Date();
    const date = `${pad2(now.getDate())}${pad2(now.getMonth() + 1)}${now.getFullYear()}`;
    const ms = now.getTime();
    return `${prefix}_${date}_${ms}.pdf`;
}

async function loadLogo(name: string): Promise<HTMLImageElement | null> {
    return new Promise(resolve => {
        const img = new Image();
        img.src = `/${name}.png`;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
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
    totalSalaireBase: number;
    totalForfait: number;
    totalConge: number;
    totalRNC: number;
    beneficiaire: string;
    numCompteBancaire: string;
    montantDelegation: number;
}

export interface ManifestePDFData {
    shipName: string;
    capitaine: string;
    lieuDepart: string;
    destination: string;
    date: string;        // ex: "06 MAI 2026"
    agentResponsable: string;
    cargoItems: CargoItem[];
    // Totaux (calculés automatiquement si non fournis)
    totalColisStr?: string;
    totalPoidsStr?: string;
    totalColisLettre?: string;
    totalPoidsLettre?: string;
}

// ── Builders internes ─────────────────────────────────────────────
async function buildCrewListDoc(list: CrewList): Promise<jsPDF> {
    const doc = new jsPDF({
        orientation: 'landscape', unit: 'mm', format: 'a4',
        putOnlyUsedFonts: true, floatPrecision: 'smart',
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
    const membersWithFonction =
        await enrichMembersWithFonction(list.members);

    const sortedMembers =
        sortCrewByHierarchy(membersWithFonction);

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

    return doc;
}

async function buildChecklistDoc(doc_: ChecklistDoc): Promise<jsPDF> {
    const doc = new jsPDF({
        orientation: 'portrait', unit: 'mm', format: 'a4',
        putOnlyUsedFonts: true, floatPrecision: 'smart',
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

    const membersWithFonction =
        await enrichMembersWithFonction(doc_.members);

    const sortedMembers =
        sortCrewByHierarchy(membersWithFonction);

    sortedMembers.forEach((m, idx) => {
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

    return doc;
}

async function buildContractDoc(data: ContractPDFData): Promise<jsPDF> {
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

    return doc;
}

async function buildManifesteDoc(data: ManifestePDFData): Promise<jsPDF> {
    const doc = new jsPDF('p', 'mm', 'a4', true) as any;

    const pageWidth = doc.internal.pageSize.getWidth() as number;
    const pageHeight = doc.internal.pageSize.getHeight() as number;
    const marginX = 12;
    const marginY = 13;

    // ── Helpers ──────────────────────────────────────────────────────
    function addHeader(currentY: number) {
        let y = currentY;
        doc.setFont('times', 'bold');
        doc.setFontSize(11);
        doc.setLineWidth(0.3);
        doc.text('MANIFESTE CARGO', pageWidth / 2, y, { align: 'center' });
        doc.line(pageWidth / 2 - 19, y + 0.5, pageWidth / 2 + 19, y + 0.5);

        y += 7;
        doc.setFontSize(8.5);
        doc.setFont('times', 'bold');
        doc.text('ARMEMENT EUSTRATIOU', marginX, y);

        y += 6;
        doc.setFont('times', 'normal');
        doc.text(`Navire : ${data.shipName}`, marginX, y);
        doc.text(`Départ : ${data.lieuDepart}`, pageWidth / 2 + 19, y);

        y += 3.5;
        doc.text(`Capitaine : ${data.capitaine}`, marginX, y);
        doc.text(`Destination : ${data.destination}`, pageWidth / 2 + 19, y);

        y += 3.5;
        doc.text(`Date : ${data.date}`, marginX, y);
        doc.text(`Agent responsable: ${data.agentResponsable}`, pageWidth / 2 + 19, y);

        return y;
    }

    // ── Colonnes ─────────────────────────────────────────────────────
    const percent = [3, 19, 19, 10, 24, 17.5, 9.5];
    const usable = pageWidth - marginX * 2;
    const col = percent.map(p => (p / 100) * usable);
    const sumPercent = percent.reduce((a, b) => a + b, 0);
    const tableWidth = (sumPercent / 100) * (pageWidth - marginX);

    const headers = ['N°', 'Chargeur', 'Destinataire', 'Nb de colis',
        'Espèces et contenu', 'N° de DÉCLARATION', 'Poids'];
    const lineHeight = 3.5;

    // ── Première passe : rendu ────────────────────────────────────────
    doc.setLineWidth(0.3);
    doc.setFont('times', 'bold');

    let y = marginY;
    y = addHeader(y);

    // En-tête du tableau
    y += 2.5;
    let yRowStart = y;

    function drawTableHeader(startY: number) {
        let x = marginX;
        doc.setFont('times', 'bold');
        doc.setFontSize(8.5);
        headers.forEach((h, i) => {
            doc.rect(x, startY, col[i], 4);
            doc.text(h, x + col[i] / 2, startY + 3, { align: 'center' });
            x += col[i];
        });
    }
    drawTableHeader(y);
    y += 4;

    // ── Données ───────────────────────────────────────────────────────
    let xVerticalLine: number;

    function drawVerticalLines(fromY: number, toY: number) {
        xVerticalLine = marginX;
        for (let i = 0; i < col.length; i++) {
            if (i === 0) doc.line(xVerticalLine, fromY, xVerticalLine, toY);
            xVerticalLine += col[i];
            doc.line(xVerticalLine, fromY, xVerticalLine, toY);
        }
    }

    function newPage(end?: boolean) {
        if (!end) {
            y = pageHeight - 20;
            // END PAGE LINE
            doc.line(marginX, y, tableWidth, y);
            drawVerticalLines(yRowStart, y);
        } else {
            drawVerticalLines(yRowStart, y - 4);
        }
        doc.addPage();
        y = yRowStart = marginY;
        // START PAGE LINE
        if (!end) {
            doc.line(marginX, y, tableWidth, y);
        }
    }

    data.cargoItems.forEach((item, rowIndex) => {
        const x0 = marginX;

        const nomLines: string[] = doc.splitTextToSize(item.expediteurNom, col[1] - 3);
        const adresseLines: string[] = doc.splitTextToSize(item.expediteurAdresse, col[1] - 3);
        // Lignes fixes du chargeur (nom + adresse)
        const chargeurFixeLines = [...nomLines, ...adresseLines];

        const destLines: string[] = [
            ...doc.splitTextToSize(item.destinataireNom, col[2] - 3),
            ...doc.splitTextToSize(item.destinataireAdresse, col[2] - 3),
        ];
        const declLines: string[] = [
            ...doc.splitTextToSize(item.numDeclaration, col[5] - 1),
            ...doc.splitTextToSize('DU ' + fmtDateNumeric(item.dateDeclaration), col[5] - 1),
        ];

        // Pour chaque marchandise : calculer le nombre de lignes de description
        const marchandisesData = item.marchandises.map(m => {
            const descLines: string[] = doc.splitTextToSize(m.description, col[4] - 2);
            // Lignes conteneur/plomb pour la colonne chargeur (alignées avec cette marchandise)
            const conteneurLines: string[] = [];
            if (m.numConteneur?.trim())
                conteneurLines.push(...doc.splitTextToSize(m.numConteneur, col[1] - 3));
            if (m.numPlomb?.trim())
                conteneurLines.push(...doc.splitTextToSize(m.numPlomb, col[1] - 3));

            return {
                m,
                descLines,
                conteneurLines,
                // Hauteur de cette marchandise = max(descLines, conteneurLines)
                lineCount: Math.max(descLines.length, conteneurLines.length),
            };
        });

        // Hauteur totale des marchandises
        const totalMarcHeight = marchandisesData.reduce(
            (sum, md) => sum + md.lineCount * lineHeight + 1, 0
        );

        // Hauteur totale de la ligne = max(chargeur fixe + conteneurs, dest, decl, marchandises)
        const chargeurTotalLines = chargeurFixeLines.length +
            marchandisesData.reduce((sum, md) => sum + md.conteneurLines.length, 0);

        let rowHeight = Math.max(
            chargeurTotalLines * lineHeight,
            destLines.length * lineHeight,
            declLines.length * lineHeight,
            totalMarcHeight,
        ); // padding

        let rowHeader = Math.max(
            chargeurFixeLines.length * lineHeight,
            destLines.length * lineHeight,
            declLines.length * lineHeight,
        );

        if (y + rowHeader > pageHeight - 20) {
            newPage();
        }

        let yRow = y + 4;
        let yLine = yRow;

        // Col 0 — N°
        doc.setFont('times', 'bold');
        doc.setFontSize(8.5);
        doc.text(
            String(item.ordre ?? rowIndex + 1),
            x0 + col[0] / 2, yLine,
            { align: 'center' }
        );

        // ── Col 1 — Chargeur (nom + adresse fixes) ───────────────────
        let cxChargeur = x0 + col[0] + 1;
        let yChargeur = yLine;

        // Nom du chargeur (bold)
        nomLines.forEach((line, li) => {
            doc.setFont('times', 'bold');
            doc.text(line, cxChargeur, yChargeur + li * lineHeight, {
                maxWidth: col[1] - 1,
            });
        });
        yChargeur += nomLines.length * lineHeight;

        // Adresse du chargeur (normal)
        adresseLines.forEach((line, li) => {
            doc.setFont('times', 'bold');
            doc.text(line, cxChargeur, yChargeur + li * lineHeight, {
                maxWidth: col[1] - 1,
            });
        });
        yChargeur += adresseLines.length * lineHeight;

        // ── Col 2 — Destinataire ─────────────────────────────────────
        const cxDest = x0 + col[0] + col[1] + 1;
        destLines.forEach((line, li) => {
            doc.setFont('times', 'bold');
            doc.text(line, cxDest, yLine + li * lineHeight, {
                maxWidth: col[2] - 1,
            });
        });

        // ── Col 5 — Déclaration ──────────────────────────────────────
        const cxDecl = x0 + col[0] + col[1] + col[2] + col[3] + col[4];
        declLines.forEach((line, li) => {
            doc.setFont('times', 'bold');
            doc.text(line, cxDecl + 1, yLine + li * lineHeight, {
                maxWidth: col[5] - 1,
            });
        });

        // ── Cols 3, 4, 6 — Marchandises + Col 1 conteneur/plomb ──────
        const cxMarc = x0 + col[0] + col[1] + col[2];
        let yColis = yChargeur;

        marchandisesData.forEach(({ m, descLines, conteneurLines, lineCount }, idx) => {
            // Vérifier nouvelle page pour la marchandise
            if (yColis + lineCount * lineHeight > pageHeight - 20) {
                let rowHeightLeft = 0;
                for(let i=idx; i < marchandisesData.length - 1; i++){
                    rowHeightLeft += marchandisesData[i].lineCount * lineHeight;
                }
                
                newPage();
                yRow = y;
                yColis = marginY + 4;
                yChargeur = yColis;
                rowHeight = rowHeightLeft;
            }

            // Col 3 — Nb colis (centré verticalement sur la première ligne)
            doc.setFont('times', 'normal');
            doc.setFontSize(8.5);
            doc.text(
                String(m.nbColis),
                cxMarc + col[3] / 2, yColis,
                { align: 'center' }
            );

            // Col 4 — Description
            descLines.forEach((line, li) => {
                doc.setFont('times', 'normal');
                doc.text(line, cxMarc + col[3] + 1, yColis + li * lineHeight, {
                    maxWidth: col[4] - 2,
                });
            });

            // Col 6 — Poids (aligné sur première ligne de la marchandise)
            doc.setFont('times', 'bold');
            doc.text(
                formatPoidsKg(Number(m.poidsKg) || 0),
                cxMarc + col[3] + col[4] + col[5] + col[6] / 2,
                yColis,
                { align: 'center' }
            );
            doc.setFont('times', 'normal');

            // Col 1 — Conteneur/Plomb aligné avec cette marchandise
            if (conteneurLines.length > 0) {
                conteneurLines.forEach((line, li) => {
                    doc.setFont('times', 'normal');
                    doc.text(line, cxChargeur, yColis + li * lineHeight, {
                        maxWidth: col[1] - 2,
                    });
                });
                // yChargeur += conteneurLines.length * lineHeight;
                yColis += lineCount * lineHeight + 2;
            } else {
                yColis += lineCount * lineHeight + 0.5;
            }

            // Espacement entre marchandises (petite marge, pas de ligne)
            yChargeur = yColis;
        });
        
        // Hauteur effective de la ligne
        const effectiveHeight = Math.max(yColis - yRow, rowHeight);
        
        // Petite marge entre items (pas de ligne séparatrice)
        y = yRow + effectiveHeight + 2;
    });

    // Ligne de fermeture du tableau
    doc.line(marginX, y, tableWidth, y);
    if (doc.internal.getNumberOfPages() > 1) {
        drawVerticalLines(marginY, y);
    } else {
        drawVerticalLines(yRowStart, y);
    }

    // ── Ligne TOTAL ────────────────────────────────────────────────
    if (y > pageHeight - 20) { newPage(true); }

    const totalColisVal = data.totalColisStr ?? String(totalColis(data.cargoItems));
    const totalPoidsVal = data.totalPoidsStr ??
        totalPoidsKg(
            data.cargoItems.flatMap(i => i.marchandises.map(m => ({ poidsKg: m.poidsKg })))
        );

    let xTot = marginX + col[0] + col[1] + col[2];
    doc.setFont('times', 'normal');
    doc.setFontSize(8.5);
    [[3, totalColisVal, 'center'], [4, 'TOTAL', 'center'], [5, '', 'center'], [6, totalPoidsVal, 'center']].forEach(
        ([ci, txt, align]) => {
            if (ci === 6) doc.setFont('times', 'bold');
            const idx = ci as number;
            doc.text(String(txt), xTot + col[idx] / 2, y + 3, { align: align as any });
            doc.rect(xTot, y, col[idx], 4);
            xTot += col[idx];
        }
    );
    y += 4;

    // ── Footer ────────────────────────────────────────────────────
    const footerH = 24;
    if (y + footerH > pageHeight - 10) { newPage(true); }
    else { y += 5; }

    const xCenter = marginX + col[0] + col[1] + col[2] + col[3] + col[4] / 2;
    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.text(`Mahajanga, le ${data.date}`, xCenter, y, { align: 'center' });
    y += 8;

    const colisLettre = data.totalColisLettre ?? numberToWords(parseInt(totalColisVal));
    const poidsLettre = poidsEnLettres(totalPoidsVal);

    doc.text(
        `Arrêté le présent manifeste au nombre de ${colisLettre} colis (${totalColisVal})`,
        marginX, y
    );
    y += 6;

    doc.text(
        `Colis pesant ${poidsLettre} (${totalPoidsVal})`,
        marginX, y
    );
    y += 10;

    doc.text('Service de douane', marginX, y);
    doc.text('Le capitaine', xCenter, y, { align: 'center' });

    // ── Numérotation des pages ────────────────────────────────────
    const total = doc.internal.getNumberOfPages();
    const rightX = (sumPercent / 100) * (pageWidth - marginX); // aligné avec le bord droit du tableau

    for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        doc.text(
            `${p} sur ${total}`,
            rightX,
            pageHeight - 10,
            { align: 'right' }
        );
    }

    return doc;
}

// ── API publique ──────────────────────────────────────────────────
export async function generateCrewListPDF(list: CrewList): Promise<void> {
    const doc = await buildCrewListDoc(list);
    const filename = buildFilename('AE_LISTE_EQUIPAGE');
    doc.save(filename);
    await logExport({
        type: 'liste',
        filename,
        shipName: list.shipName,
        destination: list.destination,
        membersCount: list.members.length,
        exportedAt: new Date()
    } satisfies Omit<ExportedFileListe, 'id'>);
}

export async function previewCrewListPDF(list: CrewList): Promise<string> {
    const doc = await buildCrewListDoc(list);
    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
}

export async function generateChecklistPDF(doc_: ChecklistDoc): Promise<void> {
    const doc = await buildChecklistDoc(doc_);
    const filename = buildFilename('AE_CHECKLIST');
    doc.save(filename);
    await logExport({
        type: 'checklist',
        filename,
        shipName: doc_.shipName,
        membersCount: doc_.members.length,
        exportedAt: new Date()
    } satisfies Omit<ExportedFileChecklist, 'id'>);
}

export async function previewChecklistPDF(doc_: ChecklistDoc): Promise<string> {
    const doc = await buildChecklistDoc(doc_);
    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
}

export async function generateContractPDF(data: ContractPDFData): Promise<void> {
    const doc = await buildContractDoc(data);
    const now = new Date();
    const date = `${pad2(now.getDate())}${pad2(now.getMonth() + 1)}${now.getFullYear()}`;
    const ms = now.getTime();
    const filename = `AE_CONTRAT_${data.nom}_${data.prenom}_${date}_${ms}.pdf`;
    doc.save(filename);
    await logExport({
        type: 'contrat',
        filename,
        memberNom: `${data.nom} ${data.prenom}`,
        fonction: data.fonction,
        exportedAt: new Date(),
    } satisfies Omit<ExportedFileContrat, 'id'>);
}

export async function previewContractPDF(data: ContractPDFData): Promise<string> {
    const doc = await buildContractDoc(data);
    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
}

export async function generateManifestePDF(data: ManifestePDFData): Promise<void> {
    const doc = await buildManifesteDoc(data);
    const filename = buildFilename('AE_MANIFESTE_CARGO');
    doc.save(filename);
    await logExport({
        type: 'manifeste',
        filename,
        shipName: data.shipName,
        destination: data.destination,
        cargoCount: data.cargoItems.length,
        exportedAt: new Date(),
    } satisfies Omit<ExportedFileManifeste, 'id'>);
}

export async function previewManifestePDF(data: ManifestePDFData): Promise<string> {
    const doc = await buildManifesteDoc(data);
    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
}