
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
