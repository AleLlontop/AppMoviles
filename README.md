

## 🚀 Requisitos Previos

Asegúrate de tener instalados los siguientes componentes antes de comenzar:
- [Node.js](https://nodejs.org/) (versión 18 o superior recomendada)
- `npm` o `yarn`
- Aplicación **Expo Go** instalada en tu dispositivo móvil (iOS o Android) o un emulador configurado.
- Una cuenta en [Supabase](https://supabase.com/).
- Cuentas de desarrollador en [Google Cloud Console](https://console.cloud.google.com/) y [GitHub](https://github.com/settings/developers) para los inicios de sesión sociales.

---

## ⚙️ Configuración del Proyecto

### 1. Instalación de Dependencias
Abre una terminal en la raíz del proyecto y ejecuta:

```bash
npm install
```

### 2. Variables de Entorno (.env)
El proyecto requiere variables de entorno para conectarse a Supabase. 
Crea un archivo llamado `.env` en la raíz del proyecto (al mismo nivel que `package.json`). Puedes guiarte del archivo `.env.template`:

```env
EXPO_PUBLIC_SUPABASE_URL=tu_url_de_proyecto_aqui
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_aqui
```

*(No compartas ni subas tu archivo `.env` a repositorios públicos).*

---

## 🔐 Configuración de Supabase

Para replicar el backend y la autenticación, sigue estos pasos en tu panel de control de Supabase:

### Paso A: Obtener las credenciales principales
1. Crea un nuevo proyecto en Supabase.
2. Ve a **Project Settings** (Configuración) -> **API**.
3. Copia la URL del proyecto y colócala en `EXPO_PUBLIC_SUPABASE_URL`.
4. Copia la clave `anon` `public` y colócala en `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

### Paso B: Configurar Redirecciones (Deep Links)
Para que Expo Go pueda recibir los datos de inicio de sesión de vuelta a la aplicación móvil, **es obligatorio** configurar las URL de redirección:
1. Ve a **Authentication** -> **URL Configuration**.
2. En la sección **Site URL**, puedes dejar la URL por defecto o poner `http://localhost:3000`.
3. En la sección **Redirect URLs**, añade exactamente las siguientes:
   - `exp://*` *(Crucial para que funcione en Expo Go sin importar tu IP local).*
   - `timelab://*` *(Crucial para cuando exportes/compiles la aplicación final a APK/IPA).*

### Paso C: Configurar Autenticación Social (Google y GitHub)

#### 🔵 Google
1. Ve a **Authentication** -> **Providers** -> **Google**.
2. Habilítalo.
3. Copia el **Callback URI** que te muestra Supabase (termina en `/auth/v1/callback`).
4. Ve a Google Cloud Console, crea credenciales de "ID de cliente de OAuth".
5. En Google, pega el Callback URI de Supabase en "URI de redireccionamiento autorizados".
6. Copia el `Client ID` y `Client Secret` generados por Google y pégalos en Supabase.
7. Guarda los cambios.

#### ⚫ GitHub
1. Ve a **Authentication** -> **Providers** -> **GitHub**.
2. Habilítalo.
3. Copia el **Callback URI**.
4. Ve a GitHub -> Settings -> Developer Settings -> OAuth Apps -> New OAuth App.
5. En "Authorization callback URL", pega el Callback URI de Supabase.
6. Copia el `Client ID` y genera un nuevo `Client Secret` en GitHub.
7. Pégalos en el panel de Supabase y guarda.

---

## ▶️ Ejecutar la Aplicación

Para iniciar el servidor de desarrollo, ejecuta:

```bash
npx expo start
```
- Escanea el código QR desde tu celular con la app de Expo Go (o la cámara si usas iOS).

### 💡 Solución de Problemas de Red (Error común)
Si al abrir la aplicación en tu celular hace un "crash" o muestra el error `java.io.IOException. Failed to download remote update`, significa que hay un firewall bloqueando la conexión local o problemas de Wi-Fi. 

Para solucionarlo, limpia el caché y usa un **Túnel seguro** ejecutando:
```bash
npx expo start -c --tunnel
```
*(Si te solicita instalar `@expo/ngrok`, acéptalo).*

---

## 📂 Estructura Principal del Proyecto

- `app/`: Contiene todas las pantallas y rutas usando Expo Router.
  - `app/(tabs)/`: Vistas de la navegación principal inferior (Home, Estadísticas, Perfil).
  - `app/login.tsx`: Pantalla de inicio de sesión y lógica de OAuth.
- `utils/`: Utilidades y configuraciones, incluyendo la inicialización del cliente de Supabase (`supabase.ts`).
- `assets/`: Imágenes y fuentes locales.
- `.env.template`: Plantilla para las variables de entorno.
