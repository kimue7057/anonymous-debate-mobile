create extension if not exists pgcrypto;

create table if not exists public.debates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'draft',
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint debates_status_check check (status in ('draft', 'active', 'archived'))
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.debates(id) on delete cascade,
  side text not null,
  nickname text,
  content text not null,
  parent_id uuid references public.comments(id) on delete cascade,
  like_count integer not null default 0,
  report_count integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint comments_side_check check (side in ('pro', 'con')),
  constraint comments_content_not_blank_check check (char_length(trim(content)) > 0),
  constraint comments_like_count_check check (like_count >= 0),
  constraint comments_report_count_check check (report_count >= 0)
);

create table if not exists public.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.debates(id) on delete cascade,
  overall_summary text,
  pro_summary text,
  con_summary text,
  key_issue text,
  generated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  constraint admin_users_user_id_unique unique (user_id),
  constraint admin_users_email_unique unique (email),
  constraint admin_users_role_check check (role = 'admin')
);

alter table public.debates
  add column if not exists updated_at timestamptz not null default now();

alter table public.debates
  alter column description drop not null;

alter table public.comments
  alter column nickname drop not null;

alter table public.ai_summaries
  alter column overall_summary drop not null,
  alter column pro_summary drop not null,
  alter column con_summary drop not null,
  alter column key_issue drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'debates_status_check'
      and conrelid = 'public.debates'::regclass
  ) then
    alter table public.debates
      add constraint debates_status_check
      check (status in ('draft', 'active', 'archived'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'comments_side_check'
      and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
      add constraint comments_side_check
      check (side in ('pro', 'con'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'comments_content_not_blank_check'
      and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
      add constraint comments_content_not_blank_check
      check (char_length(trim(content)) > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'comments_like_count_check'
      and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
      add constraint comments_like_count_check
      check (like_count >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'comments_report_count_check'
      and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
      add constraint comments_report_count_check
      check (report_count >= 0);
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists debates_set_updated_at on public.debates;
create trigger debates_set_updated_at
  before update on public.debates
  for each row
  execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create index if not exists debates_status_created_idx
  on public.debates (status, created_at desc);

create index if not exists debates_active_idx
  on public.debates (status, start_at desc);

create unique index if not exists debates_single_active_idx
  on public.debates ((status))
  where status = 'active';

create index if not exists comments_visible_debate_created_idx
  on public.comments (debate_id, is_hidden, created_at desc);

create index if not exists comments_debate_side_idx
  on public.comments (debate_id, side);

create index if not exists comments_parent_idx
  on public.comments (parent_id);

create index if not exists ai_summaries_debate_generated_idx
  on public.ai_summaries (debate_id, generated_at desc);

create index if not exists admin_users_user_id_idx
  on public.admin_users (user_id);

alter table public.debates enable row level security;
alter table public.comments enable row level security;
alter table public.ai_summaries enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Public can read active debates" on public.debates;
create policy "Public can read active debates"
  on public.debates
  for select
  to anon
  using (status = 'active');

drop policy if exists "Admin can manage debates" on public.debates;
create policy "Admin can manage debates"
  on public.debates
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Public can read visible comments for active debates" on public.comments;
create policy "Public can read visible comments for active debates"
  on public.comments
  for select
  to anon
  using (
    is_hidden = false
    and exists (
      select 1
      from public.debates
      where debates.id = comments.debate_id
        and debates.status = 'active'
    )
  );

drop policy if exists "Public can create comments for active debates" on public.comments;
create policy "Public can create comments for active debates"
  on public.comments
  for insert
  to anon
  with check (
    side in ('pro', 'con')
    and char_length(trim(content)) > 0
    and char_length(trim(content)) <= 300
    and (nickname is null or char_length(trim(nickname)) > 0)
    and is_hidden = false
    and like_count = 0
    and report_count = 0
    and exists (
      select 1
      from public.debates
      where debates.id = comments.debate_id
        and debates.status = 'active'
    )
  );

drop policy if exists "Admin can read all comments" on public.comments;
create policy "Admin can read all comments"
  on public.comments
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admin can update comments" on public.comments;
create policy "Admin can update comments"
  on public.comments
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Public can read summaries for active debates" on public.ai_summaries;
create policy "Public can read summaries for active debates"
  on public.ai_summaries
  for select
  to anon
  using (
    exists (
      select 1
      from public.debates
      where debates.id = ai_summaries.debate_id
        and debates.status = 'active'
    )
  );

drop policy if exists "Admin can manage summaries" on public.ai_summaries;
create policy "Admin can manage summaries"
  on public.ai_summaries
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Authenticated users can read own admin row" on public.admin_users;
create policy "Authenticated users can read own admin row"
  on public.admin_users
  for select
  to authenticated
  using (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;

grant select on public.debates to anon;
grant select, insert on public.comments to anon;
grant select on public.ai_summaries to anon;

grant select, insert, update, delete on public.debates to authenticated;
grant select, update on public.comments to authenticated;
grant select, insert, update, delete on public.ai_summaries to authenticated;
grant select on public.admin_users to authenticated;

-- Seed SQL
-- 아래 샘플 데이터는 테스트가 필요할 때만 주석을 풀고 실행하세요.
--
-- insert into public.debates (title, description, status, start_at)
-- values (
--   'AI 면접을 공공 채용에 확대해도 될까?',
--   '채용의 공정성과 알고리즘 차별 우려가 맞서고 있습니다.',
--   'active',
--   now()
-- )
-- returning id;
--
-- 위에서 반환된 debate id를 아래 <DEBATE_ID> 자리에 넣어 실행하세요.
--
-- insert into public.comments (debate_id, side, nickname, content, like_count)
-- values
--   ('<DEBATE_ID>', 'pro', '무명 703', 'AI 면접은 주관적 편견을 줄일 수 있어 공정성 향상에 도움이 됩니다.', 128),
--   ('<DEBATE_ID>', 'con', '무명 921', '사람을 알고리즘으로 평가하는 것은 위험하다고 생각합니다.', 97);
--
-- insert into public.ai_summaries (
--   debate_id,
--   overall_summary,
--   pro_summary,
--   con_summary,
--   key_issue
-- )
-- values (
--   '<DEBATE_ID>',
--   '현재 의견은 공정성과 효율성을 기대하는 쪽과, 알고리즘 편향과 불투명성을 우려하는 쪽으로 나뉘고 있어요.',
--   '찬성하는 사람들은 AI 면접이 면접관의 주관적 판단을 줄이고, 대규모 채용에서 더 빠르고 일관된 평가를 가능하게 한다고 보고 있어요.',
--   '반대하는 사람들은 AI가 지원자의 맥락과 태도, 성장 가능성 같은 인간적인 요소를 충분히 판단하기 어렵다고 우려하고 있어요.',
--   'AI가 사람보다 더 공정하게 평가할 수 있는가'
-- );
--
-- 관리자 등록 예시
-- 1. Supabase Authentication에서 관리자 이메일 계정을 먼저 생성하세요.
-- 2. auth.users에서 해당 계정의 id를 확인한 뒤 아래 값을 바꿔 실행하세요.
--
-- insert into public.admin_users (user_id, email, role)
-- values ('<AUTH_USER_ID>', 'admin@example.com', 'admin');
