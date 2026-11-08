-- ════════════════════════════════════════════════════════════════════════════
--  Fils — schéma Postgres + Row Level Security
--  Principes :
--   • aucune coordonnée GPS : villes déclarées uniquement (clés texte) ;
--   • personne ne peut lire les ancrages d'autrui directement : le matching
--     passe par match_candidates(), qui ne renvoie QUE les ancrages en commun ;
--   • le pseudo n'est lisible qu'après acceptation mutuelle ;
--   • messagerie possible uniquement sur une connexion acceptée et non bloquée ;
--   • suppression du compte = cascade sur toutes les données.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── Profils ────────────────────────────────────────────────────────────────
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  pseudo          text not null check (char_length(trim(pseudo)) between 2 and 30),
  discoverable    boolean not null default true,
  consent_version text not null,
  consent_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- ─── Points d'ancrage ───────────────────────────────────────────────────────
create table public.anchors (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  kind          text not null check (kind in ('city','school','work','ancestor_job','club','event')),
  city_key      text check (city_key ~ '^[a-z0-9-]{1,60}$'),
  city_label    text check (char_length(city_label) <= 80),
  subject_key   text check (subject_key ~ '^[a-z0-9/-]{1,120}$'),
  subject_label text check (char_length(subject_label) <= 120),
  start_year    smallint check (start_year between 1900 and 2100),
  end_year      smallint check (end_year between 1900 and 2100),
  relation      text check (relation in ('grandfather','grandmother','grandparent')),
  visible       boolean not null default true,
  -- Clé de pré-filtrage, identique à matchKey() dans src/core/normalize.ts
  match_key     text generated always as (kind || ':' || coalesce(subject_key, city_key, '')) stored,
  created_at    timestamptz not null default now(),
  check (start_year is null or end_year is null or start_year <= end_year),
  check (kind <> 'city' or city_key is not null),
  check (kind = 'city' or subject_key is not null)
);
create index anchors_match_key_idx on public.anchors (match_key) where visible;
create index anchors_user_idx on public.anchors (user_id);

-- Max 10 ancrages par personne (limite l'énumération par force brute).
create function public.enforce_anchor_limit() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.anchors where user_id = new.user_id) >= 10 then
    raise exception 'anchor_limit_reached';
  end if;
  return new;
end $$;
create trigger anchors_limit before insert on public.anchors
  for each row execute function public.enforce_anchor_limit();

-- ─── Connexions (« Dire bonjour » → acceptation) ────────────────────────────
create table public.connections (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  addressee_id  uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending','accepted','declined')),
  intro_message text not null check (char_length(intro_message) between 1 and 600),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  check (requester_id <> addressee_id)
);
-- Une seule connexion par paire, quel que soit le sens.
create unique index connections_pair_idx on public.connections
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- ─── Messages ───────────────────────────────────────────────────────────────
create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  sender_id     uuid not null references public.profiles (id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 2000),
  created_at    timestamptz not null default now()
);
create index messages_connection_idx on public.messages (connection_id, created_at);

-- ─── Blocages & signalements ────────────────────────────────────────────────
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  reported_id uuid references public.profiles (id) on delete set null,
  reason      text not null check (reason in ('spam','harassment','fake','inappropriate','other')),
  details     text check (char_length(details) <= 1000),
  status      text not null default 'open' check (status in ('open','reviewed','actioned')),
  created_at  timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
--  Fonctions utilitaires (security definer = contournent la RLS de façon
--  contrôlée ; search_path figé pour éviter les détournements)
-- ════════════════════════════════════════════════════════════════════════════

create function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create function public.shares_anchor(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.anchors x join public.anchors y on x.match_key = y.match_key
    where x.user_id = a and y.user_id = b and x.visible and y.visible
  );
$$;

create function public.is_accepted_peer(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.connections
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  ) and not public.is_blocked(a, b);
$$;

-- Matching : profils découvrables qui partagent ≥ 1 clé avec moi.
-- Ne renvoie que les ancrages EN COMMUN, et le pseudo seulement si accord mutuel.
create function public.match_candidates(max_people int default 200)
returns table (
  user_id uuid, pseudo text, anchor_id uuid, kind text, city_key text, city_label text,
  subject_key text, subject_label text, start_year smallint, end_year smallint, relation text
)
language sql stable security definer set search_path = public as $$
  with my_keys as (
    select distinct match_key from public.anchors where user_id = auth.uid() and visible
  ),
  people as (
    select a.user_id
    from public.anchors a
    join my_keys k on k.match_key = a.match_key
    join public.profiles p on p.id = a.user_id
    where a.visible and p.discoverable and a.user_id <> auth.uid()
      and not public.is_blocked(auth.uid(), a.user_id)
    group by a.user_id
    order by count(*) desc
    limit least(max_people, 500)
  )
  select a.user_id,
         case when public.is_accepted_peer(auth.uid(), a.user_id) then p.pseudo end,
         a.id, a.kind, a.city_key, a.city_label, a.subject_key, a.subject_label,
         a.start_year, a.end_year, a.relation
  from people
  join public.anchors a on a.user_id = people.user_id and a.visible
  join my_keys k on k.match_key = a.match_key
  join public.profiles p on p.id = a.user_id;
$$;

-- Statistiques de rareté (agrégées, anonymes) pour mes clés uniquement.
create function public.match_key_stats()
returns table (match_key text, n bigint, population bigint)
language sql stable security definer set search_path = public as $$
  select a.match_key, count(distinct a.user_id),
         (select count(*) from public.profiles where discoverable)
  from public.anchors a
  join public.profiles p on p.id = a.user_id and p.discoverable
  where a.visible and a.match_key in (
    select match_key from public.anchors where user_id = auth.uid() and visible
  )
  group by a.match_key;
$$;

-- Seul·e la personne sollicitée peut accepter / refuser.
create function public.respond_connection(p_connection_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.connections
     set status = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now()
   where id = p_connection_id and addressee_id = auth.uid() and status = 'pending';
  if not found then raise exception 'connection_not_found'; end if;
end $$;

-- Bloquer supprime aussitôt la connexion (et donc les messages, en cascade).
create function public.on_block() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.connections
   where (requester_id = new.blocker_id and addressee_id = new.blocked_id)
      or (requester_id = new.blocked_id and addressee_id = new.blocker_id);
  return new;
end $$;
create trigger blocks_cleanup after insert on public.blocks
  for each row execute function public.on_block();

-- Droit à l'effacement : supprime l'utilisateur auth → cascade sur tout.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end $$;

-- ════════════════════════════════════════════════════════════════════════════
--  Row Level Security
-- ════════════════════════════════════════════════════════════════════════════
alter table public.profiles    enable row level security;
alter table public.anchors     enable row level security;
alter table public.connections enable row level security;
alter table public.messages    enable row level security;
alter table public.blocks      enable row level security;
alter table public.reports     enable row level security;

-- Profils : je vois le mien, et celui des personnes avec qui l'accord est mutuel.
create policy "profiles_select_self_or_peer" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_accepted_peer(auth.uid(), id));
create policy "profiles_insert_self" on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_delete_self" on public.profiles for delete to authenticated
  using (id = auth.uid());

-- Ancrages : strictement privés (lecture d'autrui uniquement via match_candidates()).
create policy "anchors_owner_all" on public.anchors for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Connexions : visibles par les deux parties.
create policy "connections_select_party" on public.connections for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));
-- « Dire bonjour » : seulement vers un profil découvrable, non bloqué, avec un point commun.
create policy "connections_insert_hello" on public.connections for insert to authenticated
  with check (
    requester_id = auth.uid()
    and status = 'pending'
    and not public.is_blocked(requester_id, addressee_id)
    and public.shares_anchor(requester_id, addressee_id)
    and exists (select 1 from public.profiles p where p.id = addressee_id and p.discoverable)
  );
-- Pas de policy UPDATE : les changements de statut passent par respond_connection().
create policy "connections_delete_party" on public.connections for delete to authenticated
  using (auth.uid() in (requester_id, addressee_id));

-- Messages : seulement dans une connexion acceptée et non bloquée.
create policy "messages_select_party" on public.messages for select to authenticated
  using (exists (
    select 1 from public.connections c
    where c.id = connection_id and c.status = 'accepted'
      and auth.uid() in (c.requester_id, c.addressee_id)
  ));
create policy "messages_insert_party" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.connections c
      where c.id = connection_id and c.status = 'accepted'
        and auth.uid() in (c.requester_id, c.addressee_id)
        and not public.is_blocked(c.requester_id, c.addressee_id)
    )
  );

-- Blocages : je gère les miens.
create policy "blocks_owner_all" on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- Signalements : je peux en créer, pas les relire (modération via service_role).
create policy "reports_insert_self" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

-- Les fonctions sensibles ne sont exécutables que par des utilisateurs connectés.
revoke execute on function public.match_candidates(int), public.match_key_stats(),
  public.respond_connection(uuid, boolean), public.delete_my_account() from public, anon;
grant execute on function public.match_candidates(int), public.match_key_stats(),
  public.respond_connection(uuid, boolean), public.delete_my_account() to authenticated;

-- Temps réel pour la messagerie et les demandes (Realtime applique la RLS).
alter publication supabase_realtime add table public.messages, public.connections;
