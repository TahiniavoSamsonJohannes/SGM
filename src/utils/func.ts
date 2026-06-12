import { CARGO_MARCHANDISE_SCHEMA, CREW_MEMBER_SCHEMA, TABLE_SCHEMAS } from "../types";

// ── Normalisation d'un objet simple ──────────────────────────────
function normalizeRecord(
    record: Record<string, unknown>,
    schema: Record<string, unknown>
): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};

    // Conserver id si présent
    if ('id' in record) normalized.id = record.id;

    for (const [key, defaultVal] of Object.entries(schema)) {
        if (key in record && record[key] !== undefined) {
            normalized[key] = record[key];
        } else {
            normalized[key] = defaultVal;
        }
    }

    return normalized;
}

// ── Normalisation récursive des tableaux imbriqués ────────────────
function normalizeArrayField(
    arr: unknown,
    itemSchema: Record<string, unknown>
): Record<string, unknown>[] {
    if (!Array.isArray(arr)) return [];
    return arr.map(item => {
        if (!item || typeof item !== 'object') return { ...itemSchema };
        return normalizeRecord(item as Record<string, unknown>, itemSchema);
    });
}

// ── Normalisation spécifique par table ────────────────────────────
function normalizeTableRecord(
    record: Record<string, unknown>,
    tableName: string
): Record<string, unknown> {
    const schema = TABLE_SCHEMAS[tableName];
    if (!schema) return record;

    const base = normalizeRecord(record, schema);

    // Traitement des champs imbriqués selon la table
    switch (tableName) {
        case 'crewLists':
            base.members = normalizeArrayField(
                record.members,
                CREW_MEMBER_SCHEMA
            );
            break;

        case 'cargoItems':
            base.marchandises = normalizeArrayField(
                record.marchandises,
                CARGO_MARCHANDISE_SCHEMA
            );
            break;

        case 'exportedFiles':
            return normalizeExportedFile(record);
    }

    return base;
}

// ── Normalisation du type union ExportedFile ──────────────────────
function normalizeExportedFile(
    record: Record<string, unknown>
): Record<string, unknown> {
    const type = (record.type as string) ?? 'liste';
    const base: Record<string, unknown> = {
        type,
        filename: record.filename ?? '',
        exportedAt: record.exportedAt ?? new Date().toISOString(),
    };
    if (record.id !== undefined) base.id = record.id;

    switch (type) {
        case 'liste':
            base.shipName = record.shipName ?? '';
            base.destination = record.destination ?? '';
            base.membersCount = record.membersCount ?? 0;
            break;
        case 'checklist':
            base.shipName = record.shipName ?? '';
            base.membersCount = record.membersCount ?? 0;
            break;
        case 'contrat':
            base.memberNom = record.memberNom ?? '';
            base.fonction = record.fonction ?? '';
            break;
        case 'manifeste':
            base.shipName = record.shipName ?? '';
            base.destination = record.destination ?? '';
            base.cargoCount = record.cargoCount ?? 0;
            break;
    }

    return base;
}

// ── Normalisation d'une table entière ────────────────────────────
export function normalizeTable(
    records: unknown[],
    tableName: string
): Record<string, unknown>[] {
    if (!Array.isArray(records)) return [];
    return records.map(r => {
        if (!r || typeof r !== 'object') return {};
        return normalizeTableRecord(r as Record<string, unknown>, tableName);
    });
}