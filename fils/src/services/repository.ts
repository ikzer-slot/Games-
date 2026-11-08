import type { Anchor, Candidate, Connection, Me, Message, ProfileSettings, RarityTable, ReportReason } from '@/core/types';

export type RepoEvent = { type: 'connection'; connection: Connection } | { type: 'message'; message: Message };

/**
 * Contrat unique entre l'UI et le backend. Deux implémentations :
 *  - DemoRepository     : tout en local (AsyncStorage) + 50 faux profils ;
 *  - SupabaseRepository : auth, Postgres + RLS, Realtime.
 */
export interface Repository {
  readonly mode: 'demo' | 'supabase';

  loadMe(): Promise<Me | null>;
  createProfile(input: { pseudo: string; anchors: Anchor[]; settings: ProfileSettings; consentVersion: string }): Promise<Me>;
  updateProfile(patch: { pseudo?: string; settings?: ProfileSettings }): Promise<void>;
  saveAnchors(anchors: Anchor[]): Promise<void>;

  /** Profils partageant au moins un ancrage visible avec moi (ancrages communs uniquement). */
  fetchCandidates(): Promise<{ candidates: Candidate[]; rarity: RarityTable }>;

  listConnections(): Promise<Connection[]>;
  sayHello(otherId: string, introMessage: string): Promise<Connection>;
  respond(connectionId: string, accept: boolean): Promise<void>;

  listMessages(connectionId: string): Promise<Message[]>;
  sendMessage(connectionId: string, body: string): Promise<Message>;
  subscribe(onEvent: (e: RepoEvent) => void): () => void;

  listBlocked(): Promise<string[]>;
  block(userId: string): Promise<void>;
  unblockAll(): Promise<void>;
  report(userId: string, reason: ReportReason, details: string): Promise<void>;

  /** Droit d'accès / portabilité (RGPD art. 15 & 20). */
  exportData(): Promise<unknown>;
  /** Droit à l'effacement (RGPD art. 17) : supprime tout, immédiatement. */
  deleteAccount(): Promise<void>;
}

export const CONSENT_VERSION = '2026-11-v1';
