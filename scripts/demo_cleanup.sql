-- =============================================================
-- DEMO CLEANUP — borra todo lo del seed
-- =============================================================
-- Borra los 5 usuarios fake creados por demo_seed.sql. Por los
-- ON DELETE CASCADE de las FKs hacia auth.users, esto arrastra:
--   - profiles
--   - subjects
--   - study_sessions
--   - group_members
--   - groups (los que fueron creados por los demo users)
--   - group_activities (cascade desde groups)
--
-- Es seguro: filtra estrictamente por email LIKE 'demo%@time-lab.local'.
-- Datos reales de usuarios no se tocan.
-- =============================================================

DELETE FROM auth.users
WHERE email LIKE 'demo%@time-lab.local';

-- Por si algún grupo quedó huérfano (no debería, pero just in case):
DELETE FROM public.groups
WHERE id IN (
  'a0000000-0000-0000-0000-0000000000a1',
  'a0000000-0000-0000-0000-0000000000a2'
);
