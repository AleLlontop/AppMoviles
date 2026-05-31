# Base de Datos — Módulo de Grupos (E2)

## Tablas nuevas

### `groups`

```sql
CREATE TABLE IF NOT EXISTS public.groups (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL CHECK (char_length(name) >= 3 AND char_length(name) <= 50),
  invite_code  TEXT        NOT NULL UNIQUE,
  created_by   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  max_members  INTEGER     NOT NULL DEFAULT 20 CHECK (max_members = 20)
);
```

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | Generado automáticamente |
| `name` | TEXT | Mínimo 3 chars, máximo 50 |
| `invite_code` | TEXT UNIQUE | 6 caracteres alfanuméricos en mayúsculas, generado al crear |
| `created_by` | UUID FK → `auth.users` | Owner del grupo; si el usuario se elimina, se elimina el grupo |
| `created_at` | TIMESTAMPTZ | Timestamp de creación |
| `max_members` | INTEGER | Fijo en 20; el CHECK garantiza que no se pueda cambiar desde el cliente |

---

### `group_members`

```sql
CREATE TABLE IF NOT EXISTS public.group_members (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
```

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | |
| `group_id` | UUID FK → `groups` | Cascade delete: si se borra el grupo, se borran los miembros |
| `user_id` | UUID FK → `auth.users` | Cascade delete: si se borra el usuario, se borra su membresía |
| `role` | TEXT | `owner` · `admin` · `member`. Solo el owner puede cambiar roles |
| `joined_at` | TIMESTAMPTZ | Momento en que el usuario se unió |
| UNIQUE | (group_id, user_id) | Un usuario no puede estar dos veces en el mismo grupo |

---

### `group_activities`

```sql
CREATE TABLE IF NOT EXISTS public.group_activities (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL CHECK (type IN ('timer', 'task', 'form')),
  title        TEXT        NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 100),
  duration_min INTEGER,
  due_date     TIMESTAMPTZ,
  notify_all   BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Columna | Tipo | Notas |
|---------|------|-------|
| `type` | TEXT | `timer` · `task` · `form` |
| `duration_min` | INTEGER | Solo aplica cuando `type = 'timer'`; puede ser NULL |
| `due_date` | TIMESTAMPTZ | Opcional para tareas y formularios |
| `notify_all` | BOOLEAN | Si `true`, se notifica a todos los miembros al publicar |

---

## Modificaciones en tablas existentes

### `study_sessions` *(sin cambio de esquema)*

La tabla ya tiene `user_id`. No se agrega ninguna columna nueva.

Las sesiones grupales **se guardan exactamente igual** que las individuales: el usuario inicia su timer personal, y la sesión se registra con su `user_id` de siempre. Las estadísticas grupales se obtienen con una query que filtra por los `user_id` que pertenecen al grupo en un rango de tiempo, **no** por una columna `group_id` en la sesión.

> **Consideración:** esta decisión evita acoplar la tabla de sesiones al módulo de grupos. Si el usuario abandona el grupo, sus sesiones pasadas siguen siendo suyas y siguen apareciendo en sus estadísticas personales sin ninguna migración adicional.

---

### `profiles` *(sin cambio de esquema)*

No se agrega ninguna columna. La información de grupo se obtiene desde `group_members` mediante el `user_id`.

---

## RLS (Row Level Security)

### `groups`

```sql
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Leer: solo miembros del grupo
CREATE POLICY "groups_member_read" ON public.groups
  FOR SELECT USING (
    id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );

-- Insertar: cualquier usuario autenticado puede crear un grupo
CREATE POLICY "groups_authenticated_insert" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Actualizar / borrar: solo el owner
CREATE POLICY "groups_owner_write" ON public.groups
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "groups_owner_delete" ON public.groups
  FOR DELETE USING (created_by = auth.uid());
```

### `group_members`

```sql
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Leer: solo los miembros del mismo grupo pueden verse entre sí
CREATE POLICY "members_read_same_group" ON public.group_members
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );

-- Insertar: el usuario solo puede insertarse a sí mismo
CREATE POLICY "members_insert_self" ON public.group_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Borrar: el usuario puede salir del grupo (borrar su propia fila)
-- El owner puede expulsar a cualquier miembro
CREATE POLICY "members_delete" ON public.group_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR
    group_id IN (
      SELECT id FROM public.groups WHERE created_by = auth.uid()
    )
  );

-- Actualizar rol: solo owner del grupo
CREATE POLICY "members_update_role" ON public.group_members
  FOR UPDATE USING (
    group_id IN (
      SELECT id FROM public.groups WHERE created_by = auth.uid()
    )
  );
```

### `group_activities`

```sql
ALTER TABLE public.group_activities ENABLE ROW LEVEL SECURITY;

-- Leer: miembros del grupo
CREATE POLICY "activities_member_read" ON public.group_activities
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );

-- Crear: solo owner o admin del grupo
CREATE POLICY "activities_admin_insert" ON public.group_activities
  FOR INSERT WITH CHECK (
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Borrar: quien la creó, o el owner del grupo
CREATE POLICY "activities_delete" ON public.group_activities
  FOR DELETE USING (
    created_by = auth.uid()
    OR
    group_id IN (
      SELECT id FROM public.groups WHERE created_by = auth.uid()
    )
  );
```

---

## Función: generación del código de invitación

```sql
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  -- Se excluyen I, O, 0, 1 para evitar confusión visual
  code  TEXT := '';
  i     INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;
```

> El código se genera desde el cliente con un simple `Math.random().toString(36)` o llamando a esta función. Ante una colisión (probabilidad muy baja con ~32^6 = 1 billón de combinaciones) se reintenta una vez.

---

## Trigger: auto-set `user_id` en `group_activities`

```sql
DROP TRIGGER IF EXISTS trg_activities_user_id ON public.group_activities;
CREATE TRIGGER trg_activities_user_id
  BEFORE INSERT ON public.group_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
-- Reutiliza la función set_user_id() ya existente en el proyecto
```

---

## Índices

```sql
-- Consulta frecuente: "¿a qué grupos pertenece este usuario?"
CREATE INDEX IF NOT EXISTS idx_group_members_user_id
  ON public.group_members(user_id);

-- Consulta frecuente: "¿quiénes son los miembros de este grupo?"
CREATE INDEX IF NOT EXISTS idx_group_members_group_id
  ON public.group_members(group_id);

-- Consulta frecuente: "¿existe este código de invitación?"
CREATE INDEX IF NOT EXISTS idx_groups_invite_code
  ON public.groups(invite_code);

-- Actividades de un grupo ordenadas por fecha
CREATE INDEX IF NOT EXISTS idx_group_activities_group_id
  ON public.group_activities(group_id, created_at DESC);
```

---

## Presencia en tiempo real (Supabase Realtime Presence)

La presencia **no se persiste en ninguna tabla**. Se maneja a través del canal de Presence de Supabase. Cada cliente que entra a la pantalla de grupo ejecuta:

```ts
const channel = supabase.channel(`group:${groupId}`)

channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState()
  // state = { [userId]: [{ is_studying, subject_name, started_at }] }
})

await channel.subscribe()
await channel.track({
  user_id: currentUser.id,
  is_studying: !!activeSubjectId,
  subject_name: activeSubjectName ?? null,
  started_at: sessionStartTime ?? null,
})
```

Cuando el usuario cierra la app o navega fuera de la pantalla:

```ts
await channel.untrack()
supabase.removeChannel(channel)
```

Supabase detecta la desconexión automáticamente si el cliente no responde al heartbeat, marcando al usuario como ausente en todos los demás clientes sin intervención del servidor.

---

## Consideraciones generales

### Límite de 20 miembros

El límite se valida en **dos capas**:

1. **Aplicación (service):** antes de llamar a `insert` en `group_members`, se hace un `count` de los miembros actuales. Si `count >= 20` se lanza el error correspondiente antes de tocar la base de datos.
2. **Base de datos (trigger):** se recomienda un trigger `BEFORE INSERT` como segunda línea de defensa para evitar race conditions cuando dos usuarios intentan unirse al mismo tiempo.

```sql
CREATE OR REPLACE FUNCTION public.check_group_capacity()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.group_members WHERE group_id = NEW.group_id
  ) >= 20 THEN
    RAISE EXCEPTION 'group_full';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_group_capacity
  BEFORE INSERT ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.check_group_capacity();
```

### Estadísticas grupales y personales

Las `study_sessions` no llevan `group_id`. Las estadísticas del grupo se calculan con:

```sql
SELECT
  gm.user_id,
  SUM(ss.duration) AS total_seconds
FROM public.group_members gm
JOIN public.study_sessions ss ON ss.user_id = gm.user_id
WHERE
  gm.group_id = $1
  AND ss.start_time >= $2   -- inicio del período
  AND ss.start_time <  $3   -- fin del período
GROUP BY gm.user_id
ORDER BY total_seconds DESC;
```

Esto garantiza que las sesiones de un usuario siempre cuenten en sus estadísticas personales sin distinción, y también aparezcan en las del grupo mientras sea miembro.

### Roles y permisos

| Acción | member | admin | owner |
|--------|--------|-------|-------|
| Ver miembros y presencia | ✅ | ✅ | ✅ |
| Unirse / salir del grupo | ✅ | ✅ | ✅ |
| Crear actividades | ❌ | ✅ | ✅ |
| Designar admins | ❌ | ❌ | ✅ |
| Expulsar miembros | ❌ | ❌ | ✅ |
| Borrar el grupo | ❌ | ❌ | ✅ |

La validación de roles ocurre **en las políticas RLS**, no solo en la UI. Un miembro no puede crear una actividad aunque manipule la request.

### Cascade deletes

| Evento | Consecuencia |
|--------|-------------|
| Se borra un `auth.user` | Se borran sus filas en `group_members` y `group_activities`. Sus `study_sessions` se borran por el cascade ya existente |
| Se borra un `group` | Se borran todas las filas de `group_members` y `group_activities` de ese grupo |
| Un miembro sale del grupo | Solo se borra su fila en `group_members`. Sus `study_sessions` no se tocan |

### Qué NO se guarda en la base de datos

- El estado de presencia (online/offline/estudiando) → Supabase Realtime Presence
- Los tokens de sesión OAuth → Supabase Auth / AsyncStorage
- El estado local del timer → Zustand + AsyncStorage (ya implementado en E1)
