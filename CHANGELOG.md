# Changelog — Etapa 2

Cambios respecto a Etapa 1.

## Funcionalidades nuevas

### Módulo de Grupos

- Creación de grupos con código de invitación de 6 caracteres generado automáticamente.
- Unirse a un grupo ingresando el código.
- Pantalla de detalle del grupo: lista de miembros con avatar (foto real de Google/GitHub o inicial con color estable), código de invitación visible y compartible vía botón nativo del sistema, role del usuario actual y contador de miembros.
- Sistema de roles `owner` / `admin` / `member` almacenado en `group_members.role`, con permisos diferentes para cada uno.
- Pantalla "Gestionar miembros" para owner y admin: promover a admin, quitar privilegios, expulsar y transferir la propiedad del grupo.
- Editar el nombre del grupo (solo owner).
- Eliminar el grupo (solo owner, con confirmación destructiva).
- Salir del grupo (cualquier rol salvo owner).
- Tab nuevo "Group" en la barra inferior para listar los grupos del usuario.

### Módulo de Tableros (Boards)

- Tab nuevo "Boards" en la barra inferior para gestionar tableros personales de tareas.
- Creación de tableros con nombre, descripción y materia asociada.
- Pantalla de detalle del tablero con sus tareas (`/tablero/[id]`).

### Presencia en tiempo real (RF-12 / RF-13)

- Integración con Supabase Realtime: cada cliente publica su estado y recibe el del resto del grupo en vivo.
- Indicador "X conectados ahora" en la pantalla del grupo.
- Anillo verde alrededor del avatar de los miembros que están estudiando, con materia visible y cronómetro corriendo en tiempo real.
- Tracker global montado en el layout raíz: la presencia se mantiene activa mientras la app esté abierta, incluso fuera de la pantalla del grupo.

### Estadísticas grupales

- Pantalla nueva accesible desde el menú del grupo, con dos tabs: Ranking y Actividad.
- Ranking de miembros por tiempo total de estudio, con barra de progreso normalizada al máximo y card destacada para el primer puesto.
- Barra de contribución que muestra el porcentaje aportado por cada miembro con su color de avatar.
- Selector de período (Hoy / Semana / Mes) que afecta totales, ranking y delta.
- Delta visual con el período anterior (verde si subió, rojo si bajó).
- Tab Actividad: KPIs (sesiones totales, promedio por sesión, racha grupal "al menos uno estudió"), gráfico de los últimos 7 días y hora pico del grupo.



## Cambios sobre funcionalidades existentes

### Pantalla de estadísticas personales (refactor)

- La card debajo del calendario ahora muestra datos reales del día seleccionado, no del período completo.
- Se reemplazó la línea violeta del gráfico (que era un mock fijo de 5 valores) por la distribución horaria real del día.
- Se reemplazó el texto hardcoded "Compared at 23" por "vs. día anterior" con el delta firmado entre ambos días.
- Se corrigió el formato de las horas de inicio y fin: ahora muestran hora del día real (`00:27`) en lugar de duración (`0h 27m`).
- Caso "sin sesiones en el día" cubierto con un guion en cada métrica.

### Sesiones de estudio (RF-15)

- Cada detención del cronómetro genera una sesión nueva en `study_sessions`. Antes se mezclaban todas las sesiones del día en una única fila por materia, lo que producía rangos horarios engañosos en el historial.
- Las sesiones grupales se contabilizan en las estadísticas personales sin captura paralela (todas las sesiones son normales `study_sessions`).
- Se agregó recuperación del cronómetro al volver de segundo plano: el contador visual ya no queda congelado.

### RF-02 Guardián de concentración (refactor completo)

- Se quitó el cartel intrusivo "Bienvenido de vuelta" que aparecía aún cuando el usuario solo había bloqueado la pantalla.
- Se transformó en dos features opcionales en More > Configuraciones, ambas apagadas por defecto:
  - "Resumen al terminar la sesión": muestra una card al detener el cronómetro con la duración y cuántas veces salió de la app.
  - "Avisarme cuando salga": dispara una notificación "Tu sesión de estudio sigue activa" si el usuario sale con el cronómetro corriendo, y la cancela al volver.

### RF-07 Perfil del usuario

- Login adicional con GitHub (antes solo Google).
- El nombre y la foto del usuario se completan automáticamente al iniciar sesión por primera vez, sin que el usuario tenga que abrir el editor de apodo (cumple AC 03 del RF-07).

### Componentes UI reusables nuevos

- `EditNameSheet`: bottom sheet único para editar el apodo, el nombre de una materia y el nombre de un grupo. Reemplaza pantallas modal separadas que existían en E1.
- `ConfirmModal`: ventana de confirmación con icono y descripción, con variante destructiva en rojo. Reemplaza los `Alert.alert` nativos en eliminar materia, cerrar sesión, salir/eliminar grupo y todas las acciones de gestión de miembros.
- `SessionSummaryModal`: card animada que aparece al detener el cronómetro cuando el resumen post-sesión está activado.
- `MemberAvatar`: avatar reutilizable con soporte para foto remota o letra con color estable derivado del user_id.

## Fixes técnicos

- Modal de "Crear Tablero": el teclado tapaba los inputs. Se reemplazó el `KeyboardAvoidingView` (que no funciona bien dentro de un `Modal` en Android) por un listener de altura del teclado con padding dinámico.
- Modal `EditNameSheet`: mismo fix que el anterior, aplicado preventivamente para que el patrón funcione consistente en todas las pantallas con input dentro de modal.
- Cronómetro visual congelado al volver de segundo plano: se agregó un listener de cambio de estado de la app que dispara el recálculo del tiempo real desde la hora de inicio guardada.
- Performance de la pantalla de estadísticas personales: tras los cambios en RLS (ver abajo) la pantalla se colgaba porque procesaba sesiones de todos los miembros del grupo. Se agregó filtro explícito por `user_id` en las queries (`getSubjects`, `getStudySessions`).

## Cambios en la base de datos

### Tablas nuevas

- `groups`: representa un grupo de estudio (id, nombre, código de invitación, owner, fecha de creación, capacidad máxima).
- `group_members`: relación N:N entre usuarios y grupos, con el rol del usuario en cada grupo.
- `group_activities`: actividades creadas dentro de un grupo (estructura preparada en la base, UI a desarrollar).

### Cambios en tablas existentes

- `profiles`: se agregaron las columnas `name` y `avatar_url`, pobladas automáticamente por un trigger desde `auth.users` al iniciar sesión.

### Funciones del servidor (RPC)

- `join_group_by_code(p_code)`: valida y une al usuario al grupo cuyo código coincide. Errores: `invalid_code`, `group_full`, `already_member`.
- `transfer_group_ownership(p_group_id, p_new_owner_id)`: cambia el dueño del grupo y actualiza los roles correspondientes en una sola transacción.
- `get_my_group_ids()`: función auxiliar `SECURITY DEFINER` usada por las reglas de seguridad para evitar recursión.
- `sync_profile_from_auth()`: trigger que copia nombre y avatar desde `auth.users` a `profiles` al login.

### Nuevas reglas de seguridad (RLS)

- `profiles_read_group_mates`: permite leer el perfil de los compañeros de grupo (necesario para mostrar nombre y avatar en la lista de miembros).
- `sessions_read_group_mates`: permite leer las sesiones de los compañeros de grupo (necesario para las estadísticas grupales).
- Extensión de `members_delete`: ahora un admin puede expulsar a members (antes solo el owner podía expulsar).

### Realtime

- Se habilitó Realtime sobre las tablas `profiles` y `group_members` para que los cambios de apodo, avatar, rol y membresía se reflejen en vivo en todos los clientes conectados.
