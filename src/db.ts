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
    fonction: string;
    fascicule: string;
    brevets: string;
    dateNaissance: string;
    lieuNaissance: string;
    telephone: string;
    email: string;
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
    type: 'fonction' | 'fascicule' | 'brevet';
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

    constructor() {
        super('MaritimeDB');
        this.version(5).stores({
            crewMembers: '++id, nom, prenom, fonction, fascicule',
            ships: '++id, nom, immatriculation',
            crewLists: '++id, shipId, updatedAt',
            checklistDocs: '++id, crewListId, createdAt',
            exportedFiles: '++id, type, exportedAt',
            dynamicValues: '++id, type, value',
            authConfig: '++id',
            deviceConfig: '++id',
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

export async function activateSubscription(
    subCode: string
): Promise<{ ok: boolean; type?: SubDuration; message?: string }> {
    const config = await getAuthConfig();
    if (!config?.id) return { ok: false, message: 'Compte introuvable' };

    const payload = decodeSubscriptionCode(subCode);
    if (!payload) return { ok: false, message: 'Code d\'abonnement invalide' };

    // Vérifier que l'email correspond
    if (payload.email !== config.email)
        return { ok: false, message: 'Ce code ne correspond pas à votre compte' };

    await db.authConfig.update(config.id, {
        subscriptionCode: subCode,
        subscriptionType: payload.duration,
        subscriptionStart: new Date(payload.startDate),
        subscriptionEnd: new Date(payload.endDate),
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