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
