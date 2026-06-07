create extension if not exists pgcrypto;

create table if not exists public.debates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  status text not null default 'draft',
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.debates(id) on delete cascade,
  side text not null check (side in ('pro', 'con')),
  nickname text not null,
  content text not null,
  parent_id uuid references public.comments(id) on delete cascade,
  like_count integer not null default 0,
  report_count integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.debates(id) on delete cascade,
  overall_summary text not null,
  pro_summary text not null,
  con_summary text not null,
  key_issue text not null,
  generated_at timestamptz not null default now()
);

create index if not exists debates_active_idx
  on public.debates (status, start_at desc);

create index if not exists comments_debate_created_idx
  on public.comments (debate_id, created_at desc);

create index if not exists comments_parent_idx
  on public.comments (parent_id);

create index if not exists ai_summaries_debate_generated_idx
  on public.ai_summaries (debate_id, generated_at desc);

alter table public.debates enable row level security;
alter table public.comments enable row level security;
alter table public.ai_summaries enable row level security;

drop policy if exists "Public can read active debates" on public.debates;
create policy "Public can read active debates"
  on public.debates
  for select
  to anon
  using (
    status = 'active'
    and (start_at is null or start_at <= now())
    and (end_at is null or end_at >= now())
  );

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
        and (debates.start_at is null or debates.start_at <= now())
        and (debates.end_at is null or debates.end_at >= now())
    )
  );

drop policy if exists "Public can create comments for active debates" on public.comments;
create policy "Public can create comments for active debates"
  on public.comments
  for insert
  to anon
  with check (
    side in ('pro', 'con')
    and char_length(trim(content)) >= 3
    and char_length(trim(content)) <= 300
    and char_length(trim(nickname)) > 0
    and is_hidden = false
    and like_count = 0
    and report_count = 0
    and exists (
      select 1
      from public.debates
      where debates.id = comments.debate_id
        and debates.status = 'active'
        and (debates.start_at is null or debates.start_at <= now())
        and (debates.end_at is null or debates.end_at >= now())
    )
  );

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
        and (debates.start_at is null or debates.start_at <= now())
        and (debates.end_at is null or debates.end_at >= now())
    )
  );

insert into public.debates (title, description, status, start_at)
values (
  'AI 면접을 공공 채용에 확대해도 될까?',
  '채용의 공정성과 알고리즘 차별 우려가 맞서고 있습니다.',
  'active',
  now()
)
on conflict do nothing;

insert into public.ai_summaries (
  debate_id,
  overall_summary,
  pro_summary,
  con_summary,
  key_issue
)
select
  debates.id,
  '현재 의견은 공정성과 효율성을 기대하는 쪽과, 알고리즘 편향과 불투명성을 우려하는 쪽으로 나뉘고 있어요.',
  '찬성하는 사람들은 AI 면접이 면접관의 주관적 판단을 줄이고, 대규모 채용에서 더 빠르고 일관된 평가를 가능하게 한다고 보고 있어요.',
  '반대하는 사람들은 AI가 지원자의 맥락과 태도, 성장 가능성 같은 인간적인 요소를 충분히 판단하기 어렵다고 우려하고 있어요.',
  'AI가 사람보다 더 공정하게 평가할 수 있는가'
from public.debates
where debates.status = 'active'
order by debates.created_at desc
limit 1;
