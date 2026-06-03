import Dexie, { type Table } from 'dexie';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface DeviceConfig {
    id?: number;
    deviceId: string;
    createdAt: Date;
}

export interface CrewMember {
    id?: number;
    nom: string;
    prenom: string;
    fascicule: string;
    brevets: string;
    dateNaissance: string;
    lieuNaissance: string;
    adresse: string;
    telephone: string;
    email: string;
    nationalite: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Contract {
    id?: number;
    crewMemberId: number;
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
    createdAt: Date;
    updatedAt: Date;
}

export interface Ship {
    id?: number;
    nom: string;
    immatriculation: string;
    createdAt: Date;
}

export interface CrewList {
    id?: number;
    shipId: number;
    shipName: string;
    capitaine: string;
    lieuDepart: string;
    destination: string;
    referDossier: string;
    members: CrewMember[];
    createdAt: Date;
    updatedAt: Date;
}

export interface ChecklistDoc {
    id?: number;
    crewListId: number;
    shipName: string;
    immatriculation: string;
    destination: string;
    referDossier: string;
    members: CrewMember[];
    createdAt: Date;
}

export interface ExportedFile {
    id?: number;
    type: 'liste' | 'checklist';
    filename: string;
    shipName: string;
    destination: string;
    membersCount: number;
    exportedAt: Date;
}

export interface DynamicValue {
    id?: number;
    type: 'fonction' | 'fascicule' | 'brevet' | 'nationalite';
    value: string;
    usageCount: number;
}

export interface AuthConfig {
    id?: number;
    email: string;
    pinHash: string;
    machineCode: string;
    subscriptionCode: string;
    subscriptionType: 'test' | 'monthly' | 'yearly' | null;
    subscriptionStart: Date | null;
    subscriptionEnd: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export function computeContractTotals(c: {
    totalSalaireBase: number;
    totalForfait: number;
    totalConge: number;
    totalRNC: number;
}) {
    const totalGeneral =
        (c.totalSalaireBase ?? 0) +
        (c.totalForfait ?? 0) +
        (c.totalConge ?? 0) +
        (c.totalRNC ?? 0);

    return {
        totalSalaireBase: c.totalSalaireBase ?? 0,
        totalForfait: c.totalForfait ?? 0,
        totalConge: c.totalConge ?? 0,
        totalRNC: c.totalRNC ?? 0,
        totalGeneral,
    };
}

export function isContractActive(c: Pick<Contract, 'dateFin'>): boolean {
    if (!c.dateFin) return false;
    return new Date(c.dateFin) >= new Date();
}

// ─── DB ───────────────────────────────────────────────────────────────────────

class MaritimeDB extends Dexie {
    crewMembers!: Table<CrewMember>;
    ships!: Table<Ship>;
    crewLists!: Table<CrewList>;
    checklistDocs!: Table<ChecklistDoc>;
    exportedFiles!: Table<ExportedFile>;
    dynamicValues!: Table<DynamicValue>;
    authConfig!: Table<AuthConfig>;
    deviceConfig!: Table<DeviceConfig>;
    contracts!: Table<Contract>;

    constructor() {
        super('MaritimeDB');
        this.version(9).stores({
            crewMembers: '++id, nom, prenom, fascicule, nationalite',
            ships: '++id, nom, immatriculation',
            crewLists: '++id, shipId, updatedAt',
            checklistDocs: '++id, crewListId, createdAt',
            exportedFiles: '++id, type, exportedAt',
            dynamicValues: '++id, type, value',
            authConfig: '++id',
            deviceConfig: '++id',
            contracts: '++id, crewMemberId, dateDebut, dateFin',
        });
    }
}

export const db = new MaritimeDB();

// ─── Device ID — stocké dans IndexedDB ───────────────────────────────────────
export async function getOrCreateDeviceId(): Promise<string> {
    // Attendre que la DB soit prête
    const existing = await db.deviceConfig.toCollection().first();
    if (existing?.deviceId) return existing.deviceId;

    const deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

    await db.deviceConfig.add({ deviceId, createdAt: new Date() });
    return deviceId;
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

export async function seedDynamicValues() {
    const count = await db.dynamicValues.count();
    if (count === 0) {
        // Fonctions seulement — pas de fascicules ni brevets
        await db.dynamicValues.bulkAdd([
            { type: 'fonction', value: 'CAPITAINE', usageCount: 0 },
            { type: 'fonction', value: 'SECOND CAPITAINE', usageCount: 0 },
            { type: 'fonction', value: 'CHEF MÉCANICIEN', usageCount: 0 },
            { type: 'fonction', value: 'SECOND MÉCANICIEN', usageCount: 0 },
            { type: 'fonction', value: 'MAITRE GRAISSEUR', usageCount: 0 },
            { type: 'fonction', value: 'GRAISSEUR', usageCount: 0 },
            { type: 'fonction', value: 'MATELOT QUALIFIÉ', usageCount: 0 },
            { type: 'fonction', value: 'MATELOT', usageCount: 0 },
            { type: 'fonction', value: 'CUISINIER', usageCount: 0 },
            { type: 'nationalite', value: 'MALAGASY', usageCount: 0 },
        ]);
    }
}

export async function addOrIncrementDynamic(
    type: DynamicValue['type'],
    value: string
) {
    if (!value.trim()) return;
    const existing = await db.dynamicValues
        .where({ type, value: value.trim() })
        .first();
    if (existing?.id) {
        await db.dynamicValues.update(existing.id, {
            usageCount: (existing.usageCount || 0) + 1,
        });
    } else {
        await db.dynamicValues.add({ type, value: value.trim(), usageCount: 1 });
    }
}

// ─── PIN & Auth ───────────────────────────────────────────────────────────────

const SALT = 'eustratiou_maritime_2025';

export async function hashPin(pin: string): Promise<string> {
    const data = new TextEncoder().encode(pin + SALT);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function getAuthConfig(): Promise<AuthConfig | undefined> {
    return db.authConfig.toCollection().first();
}

export async function isFirstLaunch(): Promise<boolean> {
    return (await db.authConfig.count()) === 0;
}

export async function setupAccount(
    email: string,
    pin: string,
    machineCode: string
): Promise<void> {
    await getOrCreateDeviceId(); // garantir l'existence en DB
    const pinHash = await hashPin(pin);
    await db.authConfig.add({
        email,
        pinHash,
        machineCode,
        subscriptionCode: '',
        subscriptionType: null,
        subscriptionStart: null,
        subscriptionEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    });
}

export async function verifyPin(pin: string): Promise<boolean> {
    const config = await getAuthConfig();
    if (!config) return false;
    return (await hashPin(pin)) === config.pinHash;
}

export async function changePin(
    oldPin: string,
    newPin: string
): Promise<boolean> {
    const ok = await verifyPin(oldPin);
    if (!ok) return false;
    const config = await getAuthConfig();
    if (!config?.id) return false;
    await db.authConfig.update(config.id, {
        pinHash: await hashPin(newPin),
        updatedAt: new Date(),
    });
    return true;
}

// ─── Abonnement ───────────────────────────────────────────────────────────────
// ─── Chiffrement simple symétrique (XOR + base64) ─────────────────────────────
const CIPHER_KEY = 'AE_MARITIME_2025_KEY';

function xorCipher(input: string, key: string): string {
    return input
        .split('')
        .map((char, i) => String.fromCharCode(
            char.charCodeAt(0) ^ key.charCodeAt(i % key.length)
        ))
        .join('');
}

export function encrypt(data: string): string {
    return btoa(unescape(encodeURIComponent(xorCipher(data, CIPHER_KEY))));
}

export function decrypt(encoded: string): string {
    try {
        return xorCipher(decodeURIComponent(escape(atob(encoded))), CIPHER_KEY);
    } catch {
        return '';
    }
}

// ─── MACHINE_CODE ─────────────────────────────────────────────────────────────
export interface MachineCodePayload {
    type: 'MACHINE_CODE';
    deviceId: string;
    email: string;
    userAgent: string;
    language: string;
    timezone: string;
    cores: number;
    timestamp: number;
}

export async function generateMachineCode(email: string): Promise<string> {
    // Créer/récupérer le device ID depuis IndexedDB AVANT de construire le payload
    const deviceId = await getOrCreateDeviceId();

    const payload: MachineCodePayload = {
        type: 'MACHINE_CODE',
        deviceId,
        email,
        userAgent: navigator.userAgent.slice(0, 80),
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        cores: navigator.hardwareConcurrency || 2,
        timestamp: Date.now(),
    };

    return encrypt(JSON.stringify(payload));
}

export function decodeMachineCode(machineCode: string): MachineCodePayload | null {
    try {
        const raw = decrypt(machineCode);
        const parsed = JSON.parse(raw);
        if (parsed.type !== 'MACHINE_CODE') return null;
        return parsed as MachineCodePayload;
    } catch {
        return null;
    }
}

// ─── SUBSCRIPTION_CODE ────────────────────────────────────────────────────────
export type SubDuration = 'test' | 'monthly' | 'yearly';

export interface SubscriptionCodePayload {
    type: 'SUBSCRIPTION_CODE';
    // données du MACHINE_CODE
    email: string;
    deviceId: string;
    userAgent: string;
    language: string;
    timezone: string;
    cores: number;
    machineTimestamp: number;
    // abonnement
    duration: SubDuration;
    startDate: string; // ISO
    endDate: string; // ISO
}

export function decodeSubscriptionCode(
    subCode: string
): SubscriptionCodePayload | null {
    try {
        const raw = decrypt(subCode);
        const parsed = JSON.parse(raw);
        if (parsed.type !== 'SUBSCRIPTION_CODE') return null;
        return parsed as SubscriptionCodePayload;
    } catch {
        return null;
    }
}

// Fonction depuis le dernier contrat
export async function getMemberFonction(memberId: number): Promise<string> {
    const contracts = await db.contracts
        .where('crewMemberId').equals(memberId)
        .toArray();
    if (contracts.length === 0) return '';
    const latest = contracts.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
    return latest.fonction || '';
}

export async function getMembersFonctions(
    memberIds: number[]
): Promise<Record<number, string>> {
    const all = await db.contracts
        .where('crewMemberId').anyOf(memberIds)
        .toArray();

    const result: Record<number, string> = {};
    memberIds.forEach(id => {
        const memberContracts = all
            .filter(c => c.crewMemberId === id)
            .sort((a, b) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
        result[id] = memberContracts[0]?.fonction || '';
    });
    return result;
}

export interface CrewMemberWithFonction extends CrewMember {
    fonction: string;
    contratActif: boolean | null;
}

export async function enrichMembersWithFonction(
    members: CrewMember[]
): Promise<CrewMemberWithFonction[]> {

    const ids = members
        .map(m => m.id)
        .filter((id): id is number => id !== undefined);

    if (ids.length === 0) {
        return members.map(m => ({
            ...m,
            fonction: '',
            contratActif: null,
        }));
    }

    const allContracts = await db.contracts
        .where('crewMemberId')
        .anyOf(ids)
        .toArray();

    const now = new Date();

    return members.map(member => {
        if (!member.id) {
            return {
                ...member,
                fonction: '',
                contratActif: null,
            };
        }

        const memberContracts = allContracts
            .filter(c => c.crewMemberId === member.id)
            .sort((a, b) =>
                new Date(b.updatedAt ?? 0).getTime() -
                new Date(a.updatedAt ?? 0).getTime()
            );

        if (memberContracts.length === 0) {
            return {
                ...member,
                fonction: '',
                contratActif: null,
            };
        }

        const latest = memberContracts[0];

        return {
            ...member,
            fonction: latest.fonction ?? '',
            contratActif: latest.dateFin
                ? new Date(latest.dateFin) >= now
                : false,
        };
    });
}

export interface CrewListMemberFull extends CrewMember {
    fonction: string;
    age: string;
}

export async function enrichCrewListMembers(
    partialMembers: Array<Partial<CrewMember> & { id: number; nom: string; prenom: string }>
): Promise<CrewListMemberFull[]> {
    if (partialMembers.length === 0) return [];

    const now = new Date();

    function calcAge(dateNaissance: string): string {
        if (!dateNaissance) return '—';
        const birth = new Date(dateNaissance + 'T00:00:00');
        if (isNaN(birth.getTime())) return '—';
        let age = now.getFullYear() - birth.getFullYear();
        const m = now.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
        return String(age);
    }

    // Identifier les membres dont les données sont incomplètes
    // Un membre est "complet" s'il a au moins fascicule ou dateNaissance
    const incompleteIds = partialMembers
        .filter(m => !m.fascicule && !m.dateNaissance)
        .map(m => m.id);

    // Récupérer uniquement les membres incomplets depuis la DB
    let dbMembers: CrewMember[] = [];
    if (incompleteIds.length > 0) {
        dbMembers = await db.crewMembers
            .where('id').anyOf(incompleteIds)
            .toArray();
    }

    // Récupérer toutes les fonctions
    const allIds = partialMembers.map(m => m.id);
    const fonctions = await getMembersFonctions(allIds);

    return partialMembers.map(partial => {
        // Si le membre est déjà complet, l'utiliser directement
        const isComplete = !!(partial.fascicule || partial.dateNaissance);
        const base = isComplete
            ? (partial as CrewMember)
            : (dbMembers.find(m => m.id === partial.id) ?? partial as CrewMember);

        return {
            id: base.id ?? partial.id,
            nom: base.nom ?? partial.nom,
            prenom: base.prenom ?? partial.prenom,
            fascicule: base.fascicule ?? '',
            brevets: base.brevets ?? '',
            dateNaissance: base.dateNaissance ?? '',
            lieuNaissance: base.lieuNaissance ?? '',
            adresse: base.adresse ?? '',
            telephone: base.telephone ?? '',
            email: base.email ?? '',
            nationalite: base.nationalite ?? '',
            createdAt: base.createdAt ?? new Date(),
            updatedAt: base.updatedAt ?? new Date(),
            fonction: fonctions[partial.id] ?? '—',
            age: calcAge(base.dateNaissance ?? ''),
        } as CrewListMemberFull;
    });
}

export async function activateSubscription(
    subCode: string
): Promise<{ ok: boolean; type?: SubDuration; message?: string }> {
    const config = await getAuthConfig();
    if (!config?.id) return { ok: false, message: 'Compte introuvable' };

    const payload = decodeSubscriptionCode(subCode);
    if (!payload) return { ok: false, message: "Code d'abonnement invalide" };

    // Vérifier email
    if (payload.email !== config.email)
        return { ok: false, message: "Code d'abonnement invalide" };

    // Vérifier Device ID
    const deviceId = await getOrCreateDeviceId();
    if (payload.deviceId && payload.deviceId !== deviceId)
        return { ok: false, message: "Code d'abonnement invalide" };

    // Vérifier que l'abonnement n'est pas déjà expiré
    const endDate = new Date(payload.endDate);
    if (endDate < new Date())
        return { ok: false, message: "Code d'abonnement expiré" };

    await db.authConfig.update(config.id, {
        subscriptionCode: subCode,
        subscriptionType: payload.duration,
        subscriptionStart: new Date(payload.startDate),
        subscriptionEnd: endDate,
        updatedAt: new Date(),
    });

    return { ok: true, type: payload.duration };
}

export async function isSubscriptionActive(): Promise<boolean> {
    const config = await getAuthConfig();
    if (!config?.subscriptionEnd) return false;
    return new Date() < new Date(config.subscriptionEnd);
}

// ─── Historique exports ───────────────────────────────────────────────────────

export async function logExport(entry: Omit<ExportedFile, 'id'>) {
    await db.exportedFiles.add(entry);
}