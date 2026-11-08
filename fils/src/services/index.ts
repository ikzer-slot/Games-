import { DemoRepository } from './demoRepository';
import type { Repository } from './repository';
import { SupabaseRepository } from './supabaseRepository';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Sans configuration Supabase, l'app démarre en mode démo (100 % local). */
export const repository: Repository = url && anonKey ? new SupabaseRepository(url, anonKey) : new DemoRepository();

export type { Repository, RepoEvent } from './repository';
export { CONSENT_VERSION } from './repository';
