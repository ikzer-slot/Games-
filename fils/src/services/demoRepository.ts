/**
 * Backend simulé : aucune donnée ne quitte l'appareil.
 * Reproduit fidèlement les règles du vrai backend (ancrages communs seulement,
 * pseudo révélé après acceptation, messagerie verrouillée, blocage…).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { matchKey, newId } from '@/core/normalize';
import { computeLinks } from '@/core/scoring';
import type { Anchor, Candidate, Connection, Me, Message, RarityTable } from '@/core/types';
import { DEMO_PROFILES, DEMO_REPLIES } from '@/data/demoProfiles';
import { t } from '@/i18n';
import type { RepoEvent, Repository } from './repository';

const STORAGE_KEY = 'fils.demo.v1';
const ME_ID = 'me-local';

interface DemoState {
  me: Me | null;
  connections: Connection[];
  messages: Message[];
  blocked: string[];
  reports: { userId: string; reason: string; details: string; at: string }[];
}

const empty = (): DemoState => ({ me: null, connections: [], messages: [], blocked: [], reports: [] });
const now = () => new Date().toISOString();
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export class DemoRepository implements Repository {
  readonly mode = 'demo' as const;
  private state: DemoState = empty();
  private loaded = false;
  private listeners = new Set<(e: RepoEvent) => void>();
  private timers: ReturnType<typeof setTimeout>[] = [];

  private async load() {
    if (this.loaded) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) this.state = { ...empty(), ...JSON.parse(raw) };
    } catch {
      this.state = empty();
    }
    this.loaded = true;
  }

  private async persist() {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  private emit(e: RepoEvent) {
    this.listeners.forEach((l) => l(e));
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms));
  }

  async loadMe() {
    await this.load();
    return this.state.me;
  }

  async createProfile(input: Parameters<Repository['createProfile']>[0]) {
    await this.load();
    const me: Me = {
      id: ME_ID,
      pseudo: input.pseudo,
      anchors: input.anchors,
      settings: input.settings,
      consentVersion: input.consentVersion,
      consentAt: now(),
    };
    this.state = { ...empty(), me };
    await this.persist();
    this.scheduleIncomingHello();
    return me;
  }

  /** Simulation : quelques secondes après l'inscription, un de vos fils vous dit bonjour. */
  private scheduleIncomingHello() {
    this.later(9000, async () => {
      const me = this.state.me;
      if (!me || !me.settings.discoverable) return; // invisible = personne ne peut vous écrire
      const { candidates, rarity } = await this.fetchCandidates();
      const links = computeLinks(me.anchors, candidates, rarity);
      const other = links.find((l) => DEMO_PROFILES.find((p) => p.id === l.candidateId)?.acceptsHello) ?? links[0];
      if (!other || this.state.connections.some((c) => c.requesterId === other.candidateId || c.addresseeId === other.candidateId)) return;
      const connection: Connection = {
        id: newId(),
        requesterId: other.candidateId,
        addresseeId: me.id,
        status: 'pending',
        introMessage: t('link.defaultIntro', { reason_lower: lowerFirst(other.why) }),
        createdAt: now(),
      };
      this.state.connections.push(connection);
      await this.persist();
      this.emit({ type: 'connection', connection });
    });
  }

  async updateProfile(patch: { pseudo?: string; settings?: Me['settings'] }) {
    await this.load();
    if (!this.state.me) return;
    this.state.me = { ...this.state.me, ...patch, settings: patch.settings ?? this.state.me.settings };
    await this.persist();
  }

  async saveAnchors(anchors: Anchor[]) {
    await this.load();
    if (!this.state.me) return;
    this.state.me = { ...this.state.me, anchors };
    await this.persist();
  }

  /** Équivalent local de la fonction SQL `match_candidates()` + `match_key_stats()`. */
  async fetchCandidates(): Promise<{ candidates: Candidate[]; rarity: RarityTable }> {
    await this.load();
    const me = this.state.me;
    if (!me) return { candidates: [], rarity: { population: 0, counts: {} } };
    const myKeys = new Set(me.anchors.filter((a) => a.visible).map(matchKey));

    const counts: Record<string, number> = {};
    for (const p of DEMO_PROFILES) {
      for (const k of new Set(p.anchors.map(matchKey))) counts[k] = (counts[k] ?? 0) + 1;
    }
    for (const k of myKeys) counts[k] = (counts[k] ?? 0) + 1;

    const accepted = new Set(
      this.state.connections
        .filter((c) => c.status === 'accepted')
        .map((c) => (c.requesterId === me.id ? c.addresseeId : c.requesterId)),
    );
    const candidates = DEMO_PROFILES.filter((p) => !this.state.blocked.includes(p.id))
      .map((p) => ({
        id: p.id,
        pseudo: accepted.has(p.id) ? p.pseudo : undefined,
        anchors: p.anchors.filter((a) => myKeys.has(matchKey(a))),
      }))
      .filter((c) => c.anchors.length > 0);

    return { candidates, rarity: { population: DEMO_PROFILES.length + 1, counts } };
  }

  async listConnections() {
    await this.load();
    return [...this.state.connections];
  }

  async sayHello(otherId: string, introMessage: string) {
    await this.load();
    const me = this.state.me!;
    const existing = this.state.connections.find(
      (c) => (c.requesterId === otherId || c.addresseeId === otherId) && c.status !== 'declined',
    );
    if (existing) return existing;
    const connection: Connection = {
      id: newId(),
      requesterId: me.id,
      addresseeId: otherId,
      status: 'pending',
      introMessage,
      createdAt: now(),
    };
    this.state.connections.push(connection);
    await this.persist();

    const profile = DEMO_PROFILES.find((p) => p.id === otherId);
    if (profile?.acceptsHello) {
      this.later(2500, async () => {
        const c = this.state.connections.find((x) => x.id === connection.id);
        if (!c || this.state.blocked.includes(otherId)) return;
        c.status = 'accepted';
        await this.persist();
        this.emit({ type: 'connection', connection: { ...c } });
        this.later(1800, async () => {
          const reply: Message = {
            id: newId(),
            connectionId: c.id,
            senderId: otherId,
            body: DEMO_REPLIES[parseInt(otherId.slice(-2), 16) % DEMO_REPLIES.length],
            createdAt: now(),
          };
          this.state.messages.push(reply);
          await this.persist();
          this.emit({ type: 'message', message: reply });
        });
      });
    }
    return connection;
  }

  async respond(connectionId: string, accept: boolean) {
    await this.load();
    const c = this.state.connections.find((x) => x.id === connectionId);
    if (!c || c.addresseeId !== this.state.me?.id || c.status !== 'pending') return;
    c.status = accept ? 'accepted' : 'declined';
    await this.persist();
    this.emit({ type: 'connection', connection: { ...c } });
  }

  async listMessages(connectionId: string) {
    await this.load();
    return this.state.messages.filter((m) => m.connectionId === connectionId);
  }

  async sendMessage(connectionId: string, body: string) {
    await this.load();
    const c = this.state.connections.find((x) => x.id === connectionId);
    if (!c || c.status !== 'accepted') throw new Error(t('messages.locked'));
    const message: Message = { id: newId(), connectionId, senderId: this.state.me!.id, body, createdAt: now() };
    this.state.messages.push(message);
    await this.persist();
    this.emit({ type: 'message', message });
    return message;
  }

  subscribe(onEvent: (e: RepoEvent) => void) {
    this.listeners.add(onEvent);
    return () => {
      this.listeners.delete(onEvent);
    };
  }

  async listBlocked() {
    await this.load();
    return [...this.state.blocked];
  }

  async block(userId: string) {
    await this.load();
    if (!this.state.blocked.includes(userId)) this.state.blocked.push(userId);
    // Comme le trigger SQL : bloquer supprime le lien et la conversation.
    const ids = this.state.connections
      .filter((c) => c.requesterId === userId || c.addresseeId === userId)
      .map((c) => c.id);
    this.state.connections = this.state.connections.filter((c) => !ids.includes(c.id));
    this.state.messages = this.state.messages.filter((m) => !ids.includes(m.connectionId));
    await this.persist();
  }

  async unblockAll() {
    await this.load();
    this.state.blocked = [];
    await this.persist();
  }

  async report(userId: string, reason: string, details: string) {
    await this.load();
    this.state.reports.push({ userId, reason, details, at: now() });
    await this.persist();
  }

  async exportData() {
    await this.load();
    const { me, connections, messages, blocked, reports } = this.state;
    return { exportedAt: now(), profile: me, connections, messages, blocked, reports };
  }

  async deleteAccount() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.state = empty();
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}
