# time-lab.

Aplicación móvil de cronómetro de estudio con soporte offline-first, estadísticas y seguimiento de concentración. Desarrollada con Expo + React Native y Supabase como backend.

---

## Requisitos previos

Antes de comenzar asegurate de tener instalado:

- [Node.js](https://nodejs.org/) v18 o superior
- [npm](https://www.npmjs.com/) v9 o superior
- [Expo Go](https://expo.dev/go) en tu dispositivo físico, **o** un emulador configurado:
  - Android: [Android Studio + emulador](https://docs.expo.dev/workflow/android-studio-emulator/)
  - iOS: [Xcode + simulador](https://docs.expo.dev/workflow/ios-simulator/) *(solo macOS)*

---

## Configuración del entorno

1. Cloná el repositorio:

   ```bash
   git clone <url-del-repositorio>
   cd time-lab
   ```

2. Creá el archivo `.env` en la raíz del proyecto con las credenciales de Supabase:

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=tu_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
   ```

   > Podés obtener estos valores desde el panel de tu proyecto en [supabase.com](https://supabase.com) → Settings → API.

3. Instalá las dependencias:

   ```bash
   npm install
   ```

---

## Ejecutar el proyecto

```bash
npx expo start
```

Una vez iniciado el servidor, escaneá el QR con la app **Expo Go** desde tu dispositivo, o presioná:

| Tecla | Acción |
|-------|--------|
| `a` | Abrir en emulador Android |
| `i` | Abrir en simulador iOS |
| `w` | Abrir en navegador web |
| `r` | Recargar la app |

---

## Estructura del proyecto

```
time-lab/
├── app/                  # Pantallas y navegación (Expo Router)
│   ├── (tabs)/           # Navegación por tabs
│   │   ├── index.tsx     # Pantalla principal con cronómetro
│   │   ├── estadisticas.tsx
│   │   └── more.tsx      # Configuración y perfil
│   ├── login.tsx
│   └── add-subject.tsx
├── components/           # Componentes reutilizables
├── hooks/                # Hooks personalizados
│   ├── use-network-sync.ts  # Sync offline con NetInfo
│   └── use-focus-guard.ts   # Monitor de concentración
├── store/
│   └── useAppStore.ts    # Estado global con Zustand
├── services/             # Llamadas a Supabase
├── utils/
│   ├── supabase.ts
│   └── network.ts        # Helper de detección de errores de red

```

---

## Tecnologías principales

| Tecnología | Uso |
|------------|-----|
| Expo 54 + React Native | Framework principal |
| Expo Router | Navegación basada en archivos |
| Supabase | Autenticación y base de datos |
| Zustand + AsyncStorage | Estado global y persistencia offline |
| NativeWind | Estilos con Tailwind CSS |
| NetInfo | Detección de conectividad en tiempo real |

---
