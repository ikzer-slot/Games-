import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { computeLinks, type LinkResult } from '@/core/scoring';
import type { Anchor, Candidate, Connection, Me, Message, ProfileSettings, RarityTable, ReportReason } from '@/core/types';
import { CONSENT_VERSION, repository } from '@/services';

/** Brouillon de l'onboarding (rien n'est envoyé avant la dernière étape). */
export interface Draft {
  consent: boolean;
  pseudo: string;
  anchors: Anchor[];
  settings: ProfileSettings;
}

export type AnchorTarget = 'draft' | 'profile';

interface AppState {
  ready: boolean;
  mode: 'demo' | 'supabase';
  me: Me | null;
  draft: Draft;
  candidates: Candidate[];
  links: LinkResult[];
  connections: Connection[];
  blocked: string[];
  /** Liens jamais vus (pour l'effet « découverte »). */
  newLinkIds: Set<string>;
  lastMessage: Message | null;
}

interface AppActions {
  setDraft: (patch: Partial<Draft>) => void;
  anchorsOf: (target: AnchorTarget) => Anchor[];
  upsertAnchor: (target: AnchorTarget, anchor: Anchor) => Promise<void>;
  removeAnchor: (target: AnchorTarget, id: string) => Promise<void>;
  setAnchorVisible: (target: AnchorTarget, id: string, visible: boolean) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  updateProfile: (patch: { pseudo?: string; settings?: ProfileSettings }) => Promise<void>;
  refresh: () => Promise<void>;
  markLinksSeen: () => void;
  sayHello: (otherId: string, intro: string) => Promise<void>;
  respond: (connectionId: string, accept: boolean) => Promise<void>;
  block: (userId: string) => Promise<void>;
  unblockAll: () => Promise<void>;
  report: (userId: string, reason: ReportReason, details: string) => Promise<void>;
  exportData: () => Promise<unknown>;
  deleteAccount: () => Promise<void>;
  connectionWith: (otherId: string) => Connection | undefined;
  peerOf: (c: Connection) => string;
}

const emptyDraft = (): Draft => ({ consent: false, pseudo: '', anchors: [], settings: { discoverable: true } });
const SEEN_KEY = 'fils.seenLinks.v1';

const Ctx = createContext<(AppState & AppActions) | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [draft, setDraftState] = useState<Draft>(emptyDraft);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [rarity, setRarity] = useState<RarityTable | undefined>();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [seen, setSeen] = useState<Set<string> | null>(null);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const meRef = useRef<Me | null>(null);
  meRef.current = me;

  const refresh = useCallback(async () => {
    if (!meRef.current) return;
    const [{ candidates: c, rarity: r }, conns, bl] = await Promise.all([
      repository.fetchCandidates(),
      repository.listConnections(),
      repository.listBlocked(),
    ]);
    setCandidates(c);
    setRarity(r);
    setConnections(conns);
    setBlocked(bl);
  }, []);

  // Démarrage : session existante ?
  useEffect(() => {
    (async () => {
      try {
        const [loaded, seenRaw] = await Promise.all([repository.loadMe(), AsyncStorage.getItem(SEEN_KEY)]);
        setSeen(new Set(seenRaw ? JSON.parse(seenRaw) : []));
        setMe(loaded);
        meRef.current = loaded;
        if (loaded) await refresh();
      } finally {
        setReady(true);
      }
    })();
  }, [refresh]);

  // Temps réel : demandes de connexion et messages.
  useEffect(() => {
    if (!me) return;
    return repository.subscribe((e) => {
      if (e.type === 'connection') {
        setConnections((prev) => [...prev.filter((c) => c.id !== e.connection.id), e.connection]);
        if (e.connection.status === 'accepted') refresh(); // révèle le pseudo
      } else {
        setLastMessage(e.message);
      }
    });
  }, [me?.id, refresh]);

  const links = useMemo(() => {
    if (!me) return [];
    const blockedSet = new Set(blocked);
    return computeLinks(
      me.anchors,
      candidates.filter((c) => !blockedSet.has(c.id)),
      rarity,
    );
  }, [me, candidates, rarity, blocked]);

  const newLinkIds = useMemo(
    () => new Set(seen ? links.filter((l) => !seen.has(l.candidateId)).map((l) => l.candidateId) : []),
    [links, seen],
  );

  const markLinksSeen = useCallback(() => {
    const all = new Set([...(seen ?? []), ...links.map((l) => l.candidateId)]);
    setSeen(all);
    AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...all]));
  }, [links, seen]);

  const setDraft = useCallback((patch: Partial<Draft>) => setDraftState((d) => ({ ...d, ...patch })), []);

  const anchorsOf = useCallback((target: AnchorTarget) => (target === 'draft' ? draft.anchors : me?.anchors ?? []), [draft, me]);

  const writeAnchors = useCallback(
    async (target: AnchorTarget, next: Anchor[]) => {
      if (target === 'draft') {
        setDraftState((d) => ({ ...d, anchors: next }));
        return;
      }
      if (!meRef.current) return;
      const updated = { ...meRef.current, anchors: next };
      setMe(updated);
      meRef.current = updated;
      await repository.saveAnchors(next);
      await refresh();
    },
    [refresh],
  );

  const upsertAnchor = useCallback(
    async (target: AnchorTarget, anchor: Anchor) => {
      const list = anchorsOf(target);
      const exists = list.some((a) => a.id === anchor.id);
      await writeAnchors(target, exists ? list.map((a) => (a.id === anchor.id ? anchor : a)) : [...list, anchor]);
    },
    [anchorsOf, writeAnchors],
  );

  const removeAnchor = useCallback(
    (target: AnchorTarget, id: string) => writeAnchors(target, anchorsOf(target).filter((a) => a.id !== id)),
    [anchorsOf, writeAnchors],
  );

  const setAnchorVisible = useCallback(
    (target: AnchorTarget, id: string, visible: boolean) =>
      writeAnchors(target, anchorsOf(target).map((a) => (a.id === id ? { ...a, visible } : a))),
    [anchorsOf, writeAnchors],
  );

  const completeOnboarding = useCallback(async () => {
    const created = await repository.createProfile({
      pseudo: draft.pseudo.trim(),
      anchors: draft.anchors,
      settings: draft.settings,
      consentVersion: CONSENT_VERSION,
    });
    setMe(created);
    meRef.current = created;
    await refresh();
  }, [draft, refresh]);

  const updateProfile = useCallback(async (patch: { pseudo?: string; settings?: ProfileSettings }) => {
    await repository.updateProfile(patch);
    setMe((m) => (m ? { ...m, ...patch, settings: patch.settings ?? m.settings } : m));
  }, []);

  const sayHello = useCallback(async (otherId: string, intro: string) => {
    const c = await repository.sayHello(otherId, intro);
    setConnections((prev) => [...prev.filter((x) => x.id !== c.id), c]);
  }, []);

  const respond = useCallback(
    async (connectionId: string, accept: boolean) => {
      await repository.respond(connectionId, accept);
      await refresh();
    },
    [refresh],
  );

  const block = useCallback(
    async (userId: string) => {
      await repository.block(userId);
      await refresh();
    },
    [refresh],
  );

  const unblockAll = useCallback(async () => {
    await repository.unblockAll();
    await refresh();
  }, [refresh]);

  const deleteAccount = useCallback(async () => {
    await repository.deleteAccount();
    await AsyncStorage.removeItem(SEEN_KEY);
    setMe(null);
    meRef.current = null;
    setCandidates([]);
    setConnections([]);
    setBlocked([]);
    setSeen(new Set());
    setDraftState(emptyDraft());
  }, []);

  const connectionWith = useCallback(
    (otherId: string) =>
      connections.find(
        (c) => (c.requesterId === otherId || c.addresseeId === otherId) && c.status !== 'declined',
      ) ?? connections.find((c) => c.requesterId === otherId || c.addresseeId === otherId),
    [connections],
  );

  const peerOf = useCallback((c: Connection) => (c.requesterId === me?.id ? c.addresseeId : c.requesterId), [me?.id]);

  const value = {
    ready,
    mode: repository.mode,
    me,
    draft,
    candidates,
    links,
    connections,
    blocked,
    newLinkIds,
    lastMessage,
    setDraft,
    anchorsOf,
    upsertAnchor,
    removeAnchor,
    setAnchorVisible,
    completeOnboarding,
    updateProfile,
    refresh,
    markLinksSeen,
    sayHello,
    respond,
    block,
    unblockAll,
    report: repository.report.bind(repository),
    exportData: repository.exportData.bind(repository),
    deleteAccount,
    connectionWith,
    peerOf,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp doit être utilisé dans <AppProvider>');
  return ctx;
}
