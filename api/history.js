// api/history.js
// GET /api/history — historial de snapshots ELO para el gráfico

const { Redis } = require("@upstash/redis");
const { corsHeaders } = require("./_lib");

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const history = (await redis.get("chamoslandia:history")) || [];
    res.status(200).json(history);
  } catch (err) {
    console.error("/api/history error:", err);
    res.status(500).json({ error: err.message });
  }
};
