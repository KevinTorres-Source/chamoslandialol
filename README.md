# Chamoslandia LOL 🎮

Leaderboard privado de ELO para el grupo de League of Legends.

---

## 🚀 Deploy en Vercel (paso a paso)

### 1. Subir a GitHub

```bash
git init
git add .
git commit -m "feat: chamoslandia inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/chamoslandia-lol.git
git push -u origin main
```

### 2. Crear base de datos en Upstash (gratis)

1. Ir a https://upstash.com y crear cuenta (gratis, sin tarjeta)
2. Crear una nueva base de datos Redis
   - Name: `chamoslandia`
   - Region: `US-East-1` (o la más cercana)
   - Plan: **Free**
3. En el panel de la base de datos, copiar:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 3. Conectar con Vercel

1. Ir a https://vercel.com → **Add New Project**
2. Importar el repo de GitHub (`chamoslandia-lol`)
3. En **Environment Variables** agregar:

| Variable | Valor |
|---|---|
| `RIOT_API_KEY` | Tu API key de developer.riotgames.com |
| `UPSTASH_REDIS_REST_URL` | URL copiada de Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Token copiado de Upstash |

4. Click **Deploy** ✅

### 4. Primera carga de jugadores

Al entrar por primera vez a la URL de Vercel, el sitio cargará automáticamente los jugadores desde Riot. Si queda en loading, visitar directamente:

```
https://TU-PROYECTO.vercel.app/api/players
```

---

## 🔑 Renovar la API Key de Riot

La API Key de Riot Games personal expira cada **24 horas**. Para actualizarla:

1. Ir a https://developer.riotgames.com y generar una nueva key
2. En Vercel → Settings → Environment Variables → editar `RIOT_API_KEY`
3. **Redeploy** el proyecto (Vercel → Deployments → ··· → Redeploy)

> Si quieres que el sitio funcione permanentemente sin renovar la key, tenés que solicitar una **Production API Key** a Riot Games desde el portal de desarrolladores.

---

## 📁 Estructura del proyecto

```
chamoslandia-lol/
├── api/
│   ├── _lib.js           # Utilidades compartidas (Riot API, helpers)
│   ├── players.js        # GET /api/players
│   ├── update.js         # GET /api/update
│   ├── history.js        # GET /api/history
│   └── matches/
│       └── [puuid].js    # GET /api/matches/:puuid
├── public/
│   ├── index.html
│   ├── main.js
│   └── styles.css
├── vercel.json
├── package.json
└── .gitignore
```
