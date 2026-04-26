// api/update.js
// GET /api/update — refresca el ELO de todos los jugadores y guarda un snapshot de historial.

const { Redis } = require("@upstash/redis");
const {
  axios, PLATFORM_HOST, riotHeaders, wait,
  formatQueue, getRankedByPuuid, eloScore, corsHeaders,
} = require("./_lib");

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const PLAYERS_KEY = "chamoslandia:players";
const HISTORY_KEY = "chamoslandia:history";
const MAX_HISTORY = 500;

module.exports = async (req, res) => {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    let players = await redis.get(PLAYERS_KEY);
    if (!players || players.length === 0) {
      return res.status(200).json({ message: "No hay jugadores. Visita /api/players primero.", players: [] });
    }

    const resultados = [];

    for (const p of players) {
      try {
        await wait(1200);

        // Actualizar nivel e icono
        try {
          const sumRes = await axios.get(
            `${PLATFORM_HOST}/lol/summoner/v4/summoners/by-puuid/${p.puuid}`,
            { headers: riotHeaders() }
          );
          p.level         = sumRes.data.summonerLevel || p.level;
          p.profileIconId = sumRes.data.profileIconId || p.profileIconId;
        } catch {}

        // Actualizar ranked
        const { soloQ, flexQ } = await getRankedByPuuid(p.puuid);
        p.soloQ      = formatQueue(soloQ);
        p.flexQ      = formatQueue(flexQ);
        p.lastUpdate = Date.now();

        resultados.push({ name: p.name, status: "ok" });
      } catch (err) {
        resultados.push({ name: p.name, status: "error", message: err.message });
      }
    }

    // Persiste jugadores actualizados (TTL 10 min)
    await redis.set(PLAYERS_KEY, players, { ex: 600 });

    // Guarda snapshot en el historial
    const history = (await redis.get(HISTORY_KEY)) || [];
    const snapshot = {
      timestamp: Date.now(),
      date: new Date().toISOString(),
      snapshots: players.map((p) => ({
        name:       p.name,
        tag:        p.tag,
        soloQScore: eloScore(p.soloQ),
        flexQScore: eloScore(p.flexQ),
        soloQTier:  p.soloQ?.tier || "UNRANKED",
        flexQTier:  p.flexQ?.tier || "UNRANKED",
        soloQLP:    p.soloQ?.lp   || 0,
        flexQLP:    p.flexQ?.lp   || 0,
      })),
    };
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

    // Historial sin TTL: persiste indefinidamente
    await redis.set(HISTORY_KEY, history);

    res.status(200).json({ message: "Update terminado", resultados, players });
  } catch (err) {
    console.error("/api/update error:", err);
    res.status(500).json({ error: err.message });
  }
};
