// api/players.js
// GET /api/players — devuelve la lista de jugadores guardada en Redis.
// Si no hay datos aún, carga desde Riot y los persiste.

const { Redis } = require("@upstash/redis");
const {
  axios, REGIONAL_HOST, PLATFORM_HOST, riotHeaders,
  wait, formatQueue, getRankedByPuuid, ACCOUNTS, corsHeaders,
} = require("./_lib");

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const PLAYERS_KEY = "chamoslandia:players";

async function loadFromRiot() {
  const players = [];
  for (const { gameName, tagLine } of ACCOUNTS) {
    try {
      await wait(1200);
      const accountRes = await axios.get(
        `${REGIONAL_HOST}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
        { headers: riotHeaders() }
      );
      const { puuid, gameName: name, tagLine: tag } = accountRes.data;

      let level = 0, profileIconId = 0;
      try {
        const sumRes = await axios.get(
          `${PLATFORM_HOST}/lol/summoner/v4/summoners/by-puuid/${puuid}`,
          { headers: riotHeaders() }
        );
        level         = sumRes.data.summonerLevel || 0;
        profileIconId = sumRes.data.profileIconId || 0;
      } catch {}

      const { soloQ, flexQ } = await getRankedByPuuid(puuid);
      players.push({
        name, tag, puuid, level, profileIconId,
        soloQ: formatQueue(soloQ),
        flexQ:  formatQueue(flexQ),
        lastUpdate: Date.now(),
      });
    } catch (err) {
      console.error(`Error cargando ${gameName}:`, err.message);
    }
  }
  return players;
}

module.exports = async (req, res) => {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    let players = await redis.get(PLAYERS_KEY);

    // Si no hay datos en Redis todavía, cargamos de Riot
    if (!players || players.length === 0) {
      players = await loadFromRiot();
      if (players.length > 0) {
        // TTL de 10 minutos para que no quede stale indefinidamente
        await redis.set(PLAYERS_KEY, players, { ex: 600 });
      }
    }

    res.status(200).json(players || []);
  } catch (err) {
    console.error("/api/players error:", err);
    res.status(500).json({ error: err.message });
  }
};
