create table public.students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null unique,
  current_level int not null default 1,
  best_streak int not null default 0,
  current_streak int not null default 0,
  total_correct int not null default 0,
  total_wrong int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  table_num int not null,
  multiplier int not null,
  correct boolean not null,
  question_type text not null default 'multiple_choice',
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  level_at_start int not null default 1,
  level_at_end int not null default 1
);

create table public.teacher_settings (
  id int primary key default 1,
  password text not null default '140799',
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into public.teacher_settings (id, password) values (1, '140799');

create index idx_attempts_student on public.attempts(student_id);
create index idx_attempts_table on public.attempts(table_num);
create index idx_sessions_student on public.sessions(student_id);

alter table public.students enable row level security;
alter table public.attempts enable row level security;
alter table public.sessions enable row level security;
alter table public.teacher_settings enable row level security;

create policy "public read students" on public.students for select using (true);
create policy "public insert students" on public.students for insert with check (true);
create policy "public update students" on public.students for update using (true);

create policy "public read attempts" on public.attempts for select using (true);
create policy "public insert attempts" on public.attempts for insert with check (true);

create policy "public read sessions" on public.sessions for select using (true);
create policy "public insert sessions" on public.sessions for insert with check (true);
create policy "public update sessions" on public.sessions for update using (true);

create policy "public read teacher_settings" on public.teacher_settings for select using (true);
create policy "public update teacher_settings" on public.teacher_settings for update using (true);