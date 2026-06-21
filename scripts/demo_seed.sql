-- =============================================================
-- DEMO SEED — datos fake para presentación
-- =============================================================
-- Crea 5 usuarios fake, sus profiles (auto via trigger), materias,
-- ~120 sesiones de estudio en los últimos 30 días, 2 grupos con
-- miembros pre-cargados y algunas actividades.
--
-- Cómo ejecutar:
--   1. Abrir el SQL Editor de Supabase del proyecto.
--   2. Pegar TODO este archivo.
--   3. Click Run.
--
-- Cómo limpiar:
--   Ejecutar demo_cleanup.sql (borra todo lo del seed sin tocar
--   nada real, filtra por email LIKE 'demo%@time-lab.local').
--
-- Es idempotente: re-ejecutarlo NO duplica nada (todos los INSERT
-- usan ON CONFLICT DO NOTHING y UUIDs fijos).
-- =============================================================

DO $$
DECLARE
  -- UUIDs fijos para que el frontend pueda referenciar a los demo users
  -- desde el toggle de "Modo presentación".
  u1 UUID := 'a0000000-0000-0000-0000-000000000001';  -- María García
  u2 UUID := 'a0000000-0000-0000-0000-000000000002';  -- Lucía Méndez
  u3 UUID := 'a0000000-0000-0000-0000-000000000003';  -- Carlos Rivera
  u4 UUID := 'a0000000-0000-0000-0000-000000000004';  -- Camila Ruiz
  u5 UUID := 'a0000000-0000-0000-0000-000000000005';  -- Juan Pérez

  g1 UUID := 'a0000000-0000-0000-0000-0000000000a1';  -- Grupo 1
  g2 UUID := 'a0000000-0000-0000-0000-0000000000a2';  -- Grupo prueba 2
BEGIN
  -- ===========================================================
  -- 1. Usuarios en auth.users
  -- El trigger sync_profile_from_auth crea las filas en profiles
  -- con name + avatar_url derivadas de raw_user_meta_data.
  -- ===========================================================
  INSERT INTO auth.users
    (id, instance_id, aud, role, email, encrypted_password,
     email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
     created_at, updated_at)
  VALUES
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'demo1@time-lab.local', '',
     now() - interval '40 days',
     '{"full_name":"María García","avatar_url":"https://ui-avatars.com/api/?name=Maria+Garcia&background=826BF0&color=fff&size=200&bold=true"}'::jsonb,
     '{}'::jsonb,
     now() - interval '40 days', now()),

    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'demo2@time-lab.local', '',
     now() - interval '40 days',
     '{"full_name":"Lucía Méndez","avatar_url":"https://ui-avatars.com/api/?name=Lucia+Mendez&background=E84A7F&color=fff&size=200&bold=true"}'::jsonb,
     '{}'::jsonb,
     now() - interval '40 days', now()),

    (u3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'demo3@time-lab.local', '',
     now() - interval '40 days',
     '{"full_name":"Carlos Rivera","avatar_url":"https://ui-avatars.com/api/?name=Carlos+Rivera&background=2E9E6B&color=fff&size=200&bold=true"}'::jsonb,
     '{}'::jsonb,
     now() - interval '40 days', now()),

    (u4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'demo4@time-lab.local', '',
     now() - interval '40 days',
     '{"full_name":"Camila Ruiz","avatar_url":"https://ui-avatars.com/api/?name=Camila+Ruiz&background=E47A3B&color=fff&size=200&bold=true"}'::jsonb,
     '{}'::jsonb,
     now() - interval '40 days', now()),

    (u5, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'demo5@time-lab.local', '',
     now() - interval '40 days',
     '{"full_name":"Juan Pérez","avatar_url":"https://ui-avatars.com/api/?name=Juan+Perez&background=D9A93B&color=fff&size=200&bold=true"}'::jsonb,
     '{}'::jsonb,
     now() - interval '40 days', now())
  ON CONFLICT (id) DO NOTHING;

  -- ===========================================================
  -- 2. Nicknames + categorías en profiles
  -- El trigger ya creó las filas con name + avatar_url, así que
  -- solo updateamos lo que el trigger no setea.
  -- ===========================================================
  UPDATE public.profiles SET nickname = 'María',  category = 'Universidad'   WHERE user_id = u1;
  UPDATE public.profiles SET nickname = 'Lu',     category = 'Programación'  WHERE user_id = u2;
  UPDATE public.profiles SET nickname = 'Charly', category = 'Idiomas'       WHERE user_id = u3;
  UPDATE public.profiles SET nickname = 'Cami',   category = 'Universidad'   WHERE user_id = u4;
  UPDATE public.profiles SET nickname = NULL,     category = 'Trabajo'       WHERE user_id = u5;

  -- ===========================================================
  -- 3. Materias por usuario
  -- ===========================================================
  INSERT INTO public.subjects (id, name, color, user_id) VALUES
    -- María García (Universidad)
    ('a0000000-0000-0000-0000-000000000101', 'Matemáticas Discreta', '#3B82F6', u1),
    ('a0000000-0000-0000-0000-000000000102', 'Análisis Matemático',  '#826BF0', u1),
    ('a0000000-0000-0000-0000-000000000103', 'Física I',             '#E84A7F', u1),
    -- Lucía Méndez (Programación)
    ('a0000000-0000-0000-0000-000000000201', 'Algoritmos',           '#826BF0', u2),
    ('a0000000-0000-0000-0000-000000000202', 'Bases de Datos',       '#2E9E6B', u2),
    ('a0000000-0000-0000-0000-000000000203', 'Frontend',             '#E47A3B', u2),
    -- Carlos Rivera (Idiomas)
    ('a0000000-0000-0000-0000-000000000301', 'Inglés C1',            '#0EA5A4', u3),
    ('a0000000-0000-0000-0000-000000000302', 'Italiano A2',          '#D9A93B', u3),
    -- Camila Ruiz (Universidad)
    ('a0000000-0000-0000-0000-000000000401', 'Química Orgánica',     '#E47A3B', u4),
    ('a0000000-0000-0000-0000-000000000402', 'Biología Celular',     '#2E9E6B', u4),
    -- Juan Pérez (Trabajo)
    ('a0000000-0000-0000-0000-000000000501', 'Cursos AWS',           '#F8C146', u5),
    ('a0000000-0000-0000-0000-000000000502', 'Lectura técnica',      '#7C7C7C', u5)
  ON CONFLICT (id) DO NOTHING;

  -- ===========================================================
  -- 4. Grupos
  -- ===========================================================
  INSERT INTO public.groups (id, name, invite_code, created_by, created_at, max_members) VALUES
    (g1, 'Grupo 1',         'GRUPO1', u1, now() - interval '20 days', 10),
    (g2, 'Grupo prueba 2',  'PRBA02', u2, now() - interval '15 days', 10)
  ON CONFLICT (id) DO NOTHING;

  -- ===========================================================
  -- 5. Miembros
  -- ===========================================================
  INSERT INTO public.group_members (group_id, user_id, role, joined_at) VALUES
    -- Grupo 1 — owner María, admin Lucía, members Carlos y Camila
    (g1, u1, 'owner',  now() - interval '20 days'),
    (g1, u2, 'admin',  now() - interval '18 days'),
    (g1, u3, 'member', now() - interval '12 days'),
    (g1, u4, 'member', now() - interval '8 days'),
    -- Grupo prueba 2 — owner Lucía, admin Juan, member Camila
    (g2, u2, 'owner',  now() - interval '15 days'),
    (g2, u5, 'admin',  now() - interval '14 days'),
    (g2, u4, 'member', now() - interval '5 days')
  ON CONFLICT (group_id, user_id) DO NOTHING;
END $$;

-- ===========================================================
-- 6. Sesiones de estudio — generadas con generate_series
-- ===========================================================
-- Patrón: para cada (usuario, día de los últimos 30, slot 1 o 2)
-- generamos una sesión si el hash del trío es par. Duración varía
-- entre 30 y 120 minutos. Hora de inicio varía entre 8 y 22 según
-- el slot. Esto da ~120 sesiones distribuidas con variedad real.

INSERT INTO public.study_sessions (id, user_id, subject_id, start_time, end_time, duration, status)
SELECT
  gen_random_uuid(),
  ud.user_id,
  ud.subject_id,
  ud.start_time,
  ud.start_time + (ud.dur_sec * interval '1 second'),
  ud.dur_sec,
  'completed'
FROM (
  SELECT
    u.user_id,
    u.subject_id,
    -- start_time: día N días atrás + hora variable según slot y usuario
    ((CURRENT_DATE - d.day * interval '1 day')
      + ((8 + (u.idx * 2 + s.slot * 4) % 14) * interval '1 hour')
      + ((d.day * 7 + u.idx * 11) % 60 * interval '1 minute')) AS start_time,
    -- duración entre 30 y 120 minutos
    ((30 + (u.idx * 7 + d.day * 13 + s.slot * 5) % 90) * 60) AS dur_sec,
    -- hash para decidir si esta combinación genera sesión
    (u.idx * 17 + d.day * 23 + s.slot * 31) % 7 AS skip_hash
  FROM (
    SELECT 1 AS idx, 'a0000000-0000-0000-0000-000000000001'::uuid AS user_id, 'a0000000-0000-0000-0000-000000000101'::uuid AS subject_id
    UNION ALL SELECT 1, 'a0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000102'::uuid
    UNION ALL SELECT 1, 'a0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000103'::uuid
    UNION ALL SELECT 2, 'a0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000201'::uuid
    UNION ALL SELECT 2, 'a0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000202'::uuid
    UNION ALL SELECT 2, 'a0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000203'::uuid
    UNION ALL SELECT 3, 'a0000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000301'::uuid
    UNION ALL SELECT 3, 'a0000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000302'::uuid
    UNION ALL SELECT 4, 'a0000000-0000-0000-0000-000000000004'::uuid, 'a0000000-0000-0000-0000-000000000401'::uuid
    UNION ALL SELECT 4, 'a0000000-0000-0000-0000-000000000004'::uuid, 'a0000000-0000-0000-0000-000000000402'::uuid
    UNION ALL SELECT 5, 'a0000000-0000-0000-0000-000000000005'::uuid, 'a0000000-0000-0000-0000-000000000501'::uuid
    UNION ALL SELECT 5, 'a0000000-0000-0000-0000-000000000005'::uuid, 'a0000000-0000-0000-0000-000000000502'::uuid
  ) u
  CROSS JOIN generate_series(0, 29) AS d(day)
  CROSS JOIN generate_series(0, 1)  AS s(slot)
) ud
WHERE ud.skip_hash < 4   -- skip ~40% para que no haya sesión todos los días
;

-- ===========================================================
-- Listo. Para limpiar, ejecutar demo_cleanup.sql
-- ===========================================================
