/**
 * Implémentation réelle : Supabase (auth anonyme, Postgres + RLS, Realtime).
 * Voir supabase/migrations pour les règles de sécurité appliquées côté serveur.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Anchor, Candidate, Connection, Me, Message, RarityTable, ReportReason } from '@/core/types';
import type { RepoEvent, Repository } from './repository';

type Row = Record<string, any>;

const toAnchor = (r: Row): Anchor => ({
  id: r.id ?? r.anchor_id,
  kind: r.kind,
  cityKey: r.city_key ?? undefined,
  cityLabel: r.city_label ?? undefined,
  subjectKey: r.subject_key ?? undefined,
  subjectLabel: r.subject_label ?? undefined,
  startYear: r.start_year ?? undefined,
  endYear: r.end_year ?? undefined,
  relation: r.relation ?? undefined,
  visible: r.visible ?? true,
});

const fromAnchor = (a: Anchor, userId: string): Row => ({
  user_id: userId,
  kind: a.kind,
  city_key: a.cityKey ?? null,
  city_label: a.cityLabel ?? null,
  subject_key: a.subjectKey ?? null,
  subject_label: a.subjectLabel ?? null,
  start_year: a.startYear ?? null,
  end_year: a.endYear ?? null,
  relation: a.relation ?? null,
  visible: a.visible,
});

const toConnection = (r: Row): Connection => ({
  id: r.id,
  requesterId: r.requester_id,
  addresseeId: r.addressee_id,
  status: r.status,
  introMessage: r.intro_message,
  createdAt: r.created_at,
});

const toMessage = (r: Row): Message => ({
  id: r.id,
  connectionId: r.connection_id,
  senderId: r.sender_id,
  body: r.body,
  createdAt: r.created_at,
});

function check<T = any>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export class SupabaseRepository implements Repository {
  readonly mode = 'supabase' as const;
  // Non typé pour le prototype ; générer les types avec `supabase gen types typescript`.
  private client: SupabaseClient<any, any, any>;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  private async uid(): Promise<string | null> {
    const { data } = await this.client.auth.getSession();
    return data.session?.user.id ?? null;
  }

  private async requireUid(): Promise<string> {
    const id = await this.uid();
    if (!id) throw new Error('not_authenticated');
    return id;
  }

  async loadMe(): Promise<Me | null> {
    const id = await this.uid();
    if (!id) return null;
    const profile = check(await this.client.from('profiles').select('*').eq('id', id).maybeSingle());
    if (!profile) return null;
    const anchors = check(await this.client.from('anchors').select('*').eq('user_id', id).order('created_at'));
    return {
      id,
      pseudo: profile.pseudo,
      settings: { discoverable: profile.discoverable },
      consentVersion: profile.consent_version,
      consentAt: profile.consent_at,
      anchors: (anchors ?? []).map(toAnchor),
    };
  }

  async createProfile(input: Parameters<Repository['createProfile']>[0]): Promise<Me> {
    // Auth anonyme : pas d'e-mail requis pour le prototype (à lier plus tard).
    let id = await this.uid();
    if (!id) {
      const { data, error } = await this.client.auth.signInAnonymously();
      if (error) throw new Error(error.message);
      id = data.user!.id;
    }
    check(
      await this.client.from('profiles').upsert({
        id,
        pseudo: input.pseudo,
        discoverable: input.settings.discoverable,
        consent_version: input.consentVersion,
        consent_at: new Date().toISOString(),
      }),
    );
    await this.saveAnchors(input.anchors);
    return (await this.loadMe())!;
  }

  async updateProfile(patch: { pseudo?: string; settings?: Me['settings'] }) {
    const id = await this.requireUid();
    const row: Row = {};
    if (patch.pseudo) row.pseudo = patch.pseudo;
    if (patch.settings) row.discoverable = patch.settings.discoverable;
    check(await this.client.from('profiles').update(row).eq('id', id));
  }

  /** Remplacement complet (simple et suffisant pour ≤ 10 ancrages). */
  async saveAnchors(anchors: Anchor[]) {
    const id = await this.requireUid();
    check(await this.client.from('anchors').delete().eq('user_id', id));
    if (anchors.length) check(await this.client.from('anchors').insert(anchors.map((a) => fromAnchor(a, id))));
  }

  async fetchCandidates(): Promise<{ candidates: Candidate[]; rarity: RarityTable }> {
    const [rowsRes, statsRes] = await Promise.all([
      this.client.rpc('match_candidates', { max_people: 200 }),
      this.client.rpc('match_key_stats'),
    ]);
    const rows = check<Row[]>(rowsRes);
    const stats = check<Row[]>(statsRes);
    const byUser = new Map<string, Candidate>();
    for (const r of rows ?? []) {
      const c: Candidate = byUser.get(r.user_id) ?? { id: r.user_id, pseudo: r.pseudo ?? undefined, anchors: [] };
      c.anchors.push(toAnchor({ ...r, visible: true }));
      byUser.set(r.user_id, c);
    }
    const counts: Record<string, number> = {};
    let population = 0;
    for (const s of stats ?? []) {
      counts[s.match_key] = Number(s.n);
      population = Number(s.population);
    }
    return { candidates: [...byUser.values()], rarity: { population, counts } };
  }

  async listConnections() {
    const rows = check(await this.client.from('connections').select('*').order('created_at'));
    return (rows ?? []).map(toConnection);
  }

  async sayHello(otherId: string, introMessage: string) {
    const id = await this.requireUid();
    const row = check(
      await this.client
        .from('connections')
        .insert({ requester_id: id, addressee_id: otherId, intro_message: introMessage })
        .select()
        .single(),
    );
    return toConnection(row);
  }

  async respond(connectionId: string, accept: boolean) {
    check(await this.client.rpc('respond_connection', { p_connection_id: connectionId, p_accept: accept }));
  }

  async listMessages(connectionId: string) {
    const rows = check(
      await this.client.from('messages').select('*').eq('connection_id', connectionId).order('created_at'),
    );
    return (rows ?? []).map(toMessage);
  }

  async sendMessage(connectionId: string, body: string) {
    const id = await this.requireUid();
    const row = check(
      await this.client.from('messages').insert({ connection_id: connectionId, sender_id: id, body }).select().single(),
    );
    return toMessage(row);
  }

  /** Realtime : la RLS s'applique, on ne reçoit que ce qu'on a le droit de voir. */
  subscribe(onEvent: (e: RepoEvent) => void) {
    const channel = this.client
      .channel('fils-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) =>
        onEvent({ type: 'message', message: toMessage(p.new as Row) }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, (p) => {
        if (p.new && (p.new as Row).id) onEvent({ type: 'connection', connection: toConnection(p.new as Row) });
      })
      .subscribe();
    return () => {
      this.client.removeChannel(channel);
    };
  }

  async listBlocked() {
    const rows = check(await this.client.from('blocks').select('blocked_id'));
    return (rows ?? []).map((r: Row) => r.blocked_id as string);
  }

  async block(userId: string) {
    const id = await this.requireUid();
    check(await this.client.from('blocks').upsert({ blocker_id: id, blocked_id: userId }));
  }

  async unblockAll() {
    const id = await this.requireUid();
    check(await this.client.from('blocks').delete().eq('blocker_id', id));
  }

  async report(userId: string, reason: ReportReason, details: string) {
    const id = await this.requireUid();
    check(
      await this.client
        .from('reports')
        .insert({ reporter_id: id, reported_id: userId, reason, details: details || null }),
    );
  }

  async exportData() {
    const me = await this.loadMe();
    const connections = await this.listConnections();
    const messages = check(await this.client.from('messages').select('*'));
    const blocked = await this.listBlocked();
    return { exportedAt: new Date().toISOString(), profile: me, connections, messages, blocked };
  }

  async deleteAccount() {
    check(await this.client.rpc('delete_my_account'));
    await this.client.auth.signOut();
  }
}
