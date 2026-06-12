export type TabId = 'dashboard' | 'crew' | 'ships' | 'voyages' | 'contracts' | 'history' | 'account';

// ── Sous-schémas pour les objets imbriqués ────────────────────────
export const CREW_MEMBER_SCHEMA: Record<string, unknown> = {
  nom:           '',
  prenom:        '',
  fascicule:     '',
  brevets:       '',
  dateNaissance: '',
  lieuNaissance: '',
  adresse:       '',
  telephone:     '',
  email:         '',
  nationalite:   '',
  createdAt:     new Date().toISOString(),
  updatedAt:     new Date().toISOString(),
  // Champs enrichis présents dans crewLists.members
  fonction:      '',
  age:           '',
};

export const CARGO_MARCHANDISE_SCHEMA: Record<string, unknown> = {
  nbColis:     0,
  description: '',
  poidsKg:     0,
};

// ── Schémas principaux ────────────────────────────────────────────
export const TABLE_SCHEMAS: Record<string, Record<string, unknown>> = {

  crewMembers: {
    nom:           '',
    prenom:        '',
    fascicule:     '',
    brevets:       '',
    dateNaissance: '',
    lieuNaissance: '',
    adresse:       '',
    telephone:     '',
    email:         '',
    nationalite:   '',
    createdAt:     new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
  },

  ships: {
    nom:           '',
    immatriculation: '',
    createdAt:     new Date().toISOString(),
  },

  crewLists: {
    shipId:      0,
    shipName:    '',
    capitaine:   '',
    lieuDepart:  '',
    destination: '',
    referDossier: '',
    members:     [],   // tableau d'objets — normalisé via CREW_MEMBER_SCHEMA
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  },

  contracts: {
    crewMemberId:          0,
    shipName:              '',
    immatriculation:       '',
    fonction:              '',
    dateDebut:             '',
    dateFin:               '',
    salaireBaseJournalier: 0,
    forfaitHeuresSupp:     0,
    salaireCongeJournalier: 0,
    indemRNC:              0,
    totalSalaireBase:      0,
    totalForfait:          0,
    totalConge:            0,
    totalRNC:              0,
    beneficiaire:          '',
    numCompteBancaire:     '',
    montantDelegation:     0,
    createdAt:             new Date().toISOString(),
    updatedAt:             new Date().toISOString(),
  },

  cargoItems: {
    crewListId:          0,
    ordre:               0,
    expediteurNom:       '',
    expediteurAdresse:   '',
    numCommande:         '',
    numConteneur:        '',
    destinataireNom:     '',
    destinataireAdresse: '',
    marchandises:        [],  // tableau — normalisé via CARGO_MARCHANDISE_SCHEMA
    numDeclaration:      '',
    dateDeclaration:     '',
    createdAt:           new Date().toISOString(),
    updatedAt:           new Date().toISOString(),
  },

  // exportedFiles : type union discriminant → schéma de base commun
  // Les champs spécifiques sont gérés dans normalizeExportedFile
  exportedFiles: {
    type:       'liste',
    filename:   '',
    exportedAt: new Date().toISOString(),
  },

  dynamicValues: {
    type:       'fonction',
    value:      '',
    usageCount: 0,
  },

  // authConfig et deviceConfig : jamais normalisés (préservés tels quels)
  authConfig: {
    email:             '',
    pinHash:           '',
    machineCode:       '',
    subscriptionCode:  '',
    subscriptionType:  null,
    subscriptionStart: null,
    subscriptionEnd:   null,
    createdAt:         new Date().toISOString(),
    updatedAt:         new Date().toISOString(),
  },

  deviceConfig: {
    deviceId:  '',
    createdAt: new Date().toISOString(),
  },
};

// ── Tables métier (sans auth) ─────────────────────────────────────
export const BUSINESS_TABLES = [
  'crewMembers', 'ships', 'crewLists',
  'contracts', 'cargoItems',
  'exportedFiles', 'dynamicValues',
] as const;

// ── Tables complètes (backup) ─────────────────────────────────────
export const ALL_TABLES = [
  ...BUSINESS_TABLES,
  'authConfig', 'deviceConfig',
] as const;
