/**
 * Modèle de données partagé par l'app, le mode démo et le backend Supabase.
 * Aucune coordonnée GPS : les lieux sont toujours déclarés au niveau « ville ».
 */

export type AnchorKind =
  | 'city' // Une ville + une période        ex. « Lyon, 2008-2012 »
  | 'school' // Une école (dans une ville)     ex. « Lycée Ampère, Lyon, 2001-2004 »
  | 'work' // Un lieu de travail             ex. « Hôpital Edouard-Herriot, Lyon »
  | 'ancestor_job' // Métier d'un grand-parent  ex. « grand-père boulanger à Lille »
  | 'club' // Club ou activité               ex. « aviron à Nantes, 1995-2000 »
  | 'event'; // Événement vécu               ex. « canicule 2003 (à Paris) »

export const ANCHOR_KINDS: AnchorKind[] = ['city', 'school', 'work', 'ancestor_job', 'club', 'event'];

export type AncestorRelation = 'grandfather' | 'grandmother' | 'grandparent';

export interface Anchor {
  id: string;
  kind: AnchorKind;
  /** Clé normalisée de la ville (ex. "lyon"). Optionnelle pour les événements. */
  cityKey?: string;
  cityLabel?: string;
  /**
   * Clé normalisée du « sujet » : nom d'école / lieu de travail / métier /
   * activité / identifiant d'événement. Vide pour le type « city ».
   * Pour school & work, la clé inclut la ville (ex. "lyon/lycee-ampere") afin
   * que deux « Lycée Victor-Hugo » de villes différentes ne se confondent pas.
   */
  subjectKey?: string;
  subjectLabel?: string;
  startYear?: number;
  endYear?: number;
  relation?: AncestorRelation;
  /** false = n'est ni utilisé pour le matching ni montré aux autres. */
  visible: boolean;
}

export interface ProfileSettings {
  /** Apparaître dans les graphes des autres utilisateurs. */
  discoverable: boolean;
}

export interface Me {
  id: string;
  pseudo: string;
  anchors: Anchor[];
  settings: ProfileSettings;
  consentVersion: string;
  consentAt: string;
}

/**
 * Un autre utilisateur tel que le client le reçoit : identifiant opaque +
 * UNIQUEMENT les ancrages qui recoupent les miens. Le pseudo n'est fourni
 * qu'après acceptation mutuelle.
 */
export interface Candidate {
  id: string;
  pseudo?: string;
  anchors: Anchor[];
}

export type ConnectionStatus = 'pending' | 'accepted' | 'declined';

export interface Connection {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: ConnectionStatus;
  introMessage: string;
  createdAt: string;
}

export interface Message {
  id: string;
  connectionId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export type ReportReason = 'spam' | 'harassment' | 'fake' | 'inappropriate' | 'other';

/** Nombre de profils partageant chaque clé de matching (pour pondérer la rareté). */
export interface RarityTable {
  population: number;
  counts: Record<string, number>;
}
