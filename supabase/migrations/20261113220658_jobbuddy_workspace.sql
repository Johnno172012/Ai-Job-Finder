create table public.jobbuddy_workspace (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('resume', 'profile', 'applications', 'jobs')),
  data jsonb not null,
  primary key (user_id, kind)
);

alter table public.jobbuddy_workspace enable row level security;
revoke all on public.jobbuddy_workspace from anon, authenticated;
grant select, insert, update on public.jobbuddy_workspace to authenticated;
create policy "Users access their own workspace"
on public.jobbuddy_workspace for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('resume', 'resume', false, 10485760)
on conflict (id) do nothing;

create policy "Users manage their own resume files"
on storage.objects for all to authenticated
using (bucket_id = 'resume' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'resume' and (storage.foldername(name))[1] = (select auth.uid())::text);
