// api/event.js
// GET  /api/event               — estado actual del evento + standings
// POST /api/event?action=start  — inicia evento (snapshot LP actual)
// POST /api/event?action=stop   — pausa
// POST /api/event?action=reset  — reinicia desde cero

const { Redis } = require("@upstash/redis");
const { corsHeaders } = require("./_lib");

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const EVENT_KEY   = "chamoslandia:event";
const PLAYERS_KEY = "chamoslandia:players";

function eloScore(q) {
  if (!q || !q.tier || q.tier === "UNRANKED") return 0;
  const T = { IRON:1,BRONZE:2,SILVER:3,GOLD:4,PLATINUM:5,EMERALD:6,DIAMOND:7,MASTER:8,GRANDMASTER:9,CHALLENGER:10 };
  const R = { IV:0,III:1,II:2,I:3,"":0 };
  return (T[q.tier]||0)*10000 + (R[q.rank]||0)*1000 + (q.lp||0);
}

module.exports = async (req, res) => {
  const h = corsHeaders();
  Object.entries(h).forEach(([k,v]) => res.setHeader(k,v));
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const defaultEvent = { active:false, startSnapshot:null, startedAt:null, stoppedAt:null };

    if (req.method === "GET") {
      const event   = (await redis.get(EVENT_KEY)) || defaultEvent;
      const players = (await redis.get(PLAYERS_KEY)) || [];

      const standings = players.map(p => {
        const startQ = event.startSnapshot?.[p.name]?.soloQ || null;
        const cur    = p.soloQ || null;
        const gained = startQ !== null ? eloScore(cur) - eloScore(startQ) : null;
        return {
          name: p.name, tag: p.tag,
          profileIconId: p.profileIconId,
          currentTier: cur?.tier || "UNRANKED",
          currentRank: cur?.rank || "",
          currentLP:   cur?.lp  || 0,
          gained,
        };
      }).sort((a,b) => (b.gained??-Infinity) - (a.gained??-Infinity));

      return res.status(200).json({ ...event, standings });
    }

    if (req.method === "POST") {
      const { action } = req.query;
      const players = (await redis.get(PLAYERS_KEY)) || [];
      let event = (await redis.get(EVENT_KEY)) || defaultEvent;

      if (action === "start") {
        const snap = {};
        players.forEach(p => { snap[p.name] = { soloQ: p.soloQ }; });
        event = { active:true, startSnapshot:snap, startedAt:new Date().toISOString(), stoppedAt:null };
        await redis.set(EVENT_KEY, event);
        return res.status(200).json({ ok:true, message:"Evento iniciado" });
      }
      if (action === "stop") {
        event.active = false;
        event.stoppedAt = new Date().toISOString();
        await redis.set(EVENT_KEY, event);
        return res.status(200).json({ ok:true, message:"Evento pausado" });
      }
      if (action === "reset") {
        await redis.set(EVENT_KEY, defaultEvent);
        return res.status(200).json({ ok:true, message:"Evento reiniciado" });
      }
      return res.status(400).json({ error:"Acción inválida" });
    }

    res.status(405).json({ error:"Método no permitido" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
