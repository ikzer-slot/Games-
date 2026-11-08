/**
 * Génère supabase/seed.sql à partir des 50 profils de démo :
 *   npm run seed:generate
 * (Réservé au développement local : insère directement dans auth.users.)
 */
import { DEMO_PROFILES } from '../src/data/demoProfiles';

const q = (v: unknown) => (v === undefined || v === null ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const lines: string[] = [
  '-- Généré par scripts/generate-seed.ts — NE PAS MODIFIER À LA MAIN',
  '-- 50 profils fictifs pour le développement local uniquement.',
  'begin;',
];
for (const p of DEMO_PROFILES) {
  lines.push(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000000', ${q(p.id)}, 'authenticated', 'authenticated', ${q(`demo${p.id.slice(-4)}@fils.invalid`)}, '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');`,
    `insert into public.profiles (id, pseudo, discoverable, consent_version) values (${q(p.id)}, ${q(p.pseudo)}, true, 'demo');`,
  );
  for (const a of p.anchors) {
    lines.push(
      `insert into public.anchors (user_id, kind, city_key, city_label, subject_key, subject_label, start_year, end_year, relation, visible) values (${[
        p.id, a.kind, a.cityKey, a.cityLabel, a.subjectKey, a.subjectLabel, a.startYear, a.endYear, a.relation,
      ].map(q).join(', ')}, true);`,
    );
  }
}
lines.push('commit;');
console.log(lines.join('\n'));
