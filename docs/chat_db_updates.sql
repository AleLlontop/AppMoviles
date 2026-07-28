-- SQL Script para actualizaciones del Chat Grupal: Edición, Eliminación y Fijado de Mensajes

-- 1. Agregar columna is_edited a la tabla group_messages si no existe
ALTER TABLE public.group_messages 
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;

-- 2. Habilitar política para actualizar (editar) mensajes
-- Solo el autor original puede editar su mensaje
DROP POLICY IF EXISTS "messages_update_policy" ON public.group_messages;
CREATE POLICY "messages_update_policy" ON public.group_messages
  FOR UPDATE USING (
    auth.uid() = user_id
  );

-- 3. Habilitar política para eliminar mensajes
-- El autor original puede borrarlo, OR el admin/owner del grupo puede borrarlo
DROP POLICY IF EXISTS "messages_delete_policy" ON public.group_messages;
CREATE POLICY "messages_delete_policy" ON public.group_messages
  FOR DELETE USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_messages.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin')
    )
  );

-- 4. Crear tabla para los mensajes fijados por grupo
CREATE TABLE IF NOT EXISTS public.group_pinned_messages (
  group_id UUID PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  pinned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  pinned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Habilitar RLS en la tabla de fijados
ALTER TABLE public.group_pinned_messages ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas RLS para los mensajes fijados
-- Todos los miembros pueden leer los mensajes fijados del grupo
DROP POLICY IF EXISTS "pinned_messages_read" ON public.group_pinned_messages;
CREATE POLICY "pinned_messages_read" ON public.group_pinned_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_pinned_messages.group_id
        AND gm.user_id = auth.uid()
    )
  );

-- Todos los miembros pueden fijar/desfijar mensajes del grupo
DROP POLICY IF EXISTS "pinned_messages_write" ON public.group_pinned_messages;
CREATE POLICY "pinned_messages_write" ON public.group_pinned_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_pinned_messages.group_id
        AND gm.user_id = auth.uid()
    )
  );
