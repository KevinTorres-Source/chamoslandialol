// api/live/[puuid].js
// GET /api/live/:puuid — partida en vivo con ELO y WR de cada participante

const { axios, PLATFORM_HOST, riotHeaders, wait, corsHeaders } = require("../_lib");

const QUEUE_MAP = {
  420: "Solo Q Ranked", 440: "Flex Q Ranked",
  400: "Normal Draft",  430: "Normal Ciego",
  450: "ARAM",          700: "Clash",
};

const SPELL_MAP = {
  1: "SummonerBoost", 3: "SummonerExhaust", 4: "SummonerFlash",
  6: "SummonerHaste", 7: "SummonerHeal",   11: "SummonerSmite",
  12: "SummonerTeleport", 14: "SummonerDot", 21: "SummonerBarrier",
  32: "SummonerSnowball",
};

async function getRankedStats(puuid) {
  try {
    const res     = await axios.get(
      `${PLATFORM_HOST}/lol/league/v4/entries/by-puuid/${puuid}`,
      { headers: riotHeaders() }
    );
    const entries = res.data || [];
    const soloQ   = entries.find(e => e.queueType === "RANKED_SOLO_5x5");
    const flexQ   = entries.find(e => e.queueType === "RANKED_FLEX_SR");
    const fmt = q => {
      if (!q) return { tier: "UNRANKED", rank: "", lp: 0, wins: 0, losses: 0, wr: null };
      const total = (q.wins || 0) + (q.losses || 0);
      return { tier: q.tier, rank: q.rank, lp: q.leaguePoints,
               wins: q.wins, losses: q.losses,
               wr: total > 0 ? Math.round((q.wins / total) * 100) : null };
    };
    return { soloQ: fmt(soloQ), flexQ: fmt(flexQ) };
  } catch { return { soloQ: null, flexQ: null }; }
}

module.exports = async (req, res) => {
  const h = corsHeaders();
  Object.entries(h).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();

  const { puuid } = req.query;
  if (!puuid) return res.status(400).json({ error: "puuid requerido" });

  try {
    const response = await axios.get(
      `${PLATFORM_HOST}/lol/spectator/v5/active-games/by-summoner/${puuid}`,
      { headers: riotHeaders() }
    );
    const game          = response.data;
    const gameStartTime = game.gameStartTime || 0;
    const durationSecs  = Math.floor((Date.now() - gameStartTime) / 1000);
    const isRanked      = [420, 440].includes(game.gameQueueConfigId);
    const queueId       = game.gameQueueConfigId;

    const enriched = [];
    for (const p of (game.participants || [])) {
      await wait(250);
      const ranked    = isRanked ? await getRankedStats(p.puuid) : { soloQ: null, flexQ: null };
      const mainQueue = queueId === 440 ? ranked.flexQ : ranked.soloQ;
      const altQueue  = queueId === 440 ? ranked.soloQ : ranked.flexQ;
      const displayed = (mainQueue?.tier && mainQueue.tier !== "UNRANKED") ? mainQueue : altQueue;
      enriched.push({
        puuid:        p.puuid,
        summonerName: p.riotId || p.summonerName || "?",
        championName: p.championName || null,
        championId:   p.championId,
        teamId:       p.teamId,
        spell1:       SPELL_MAP[p.spell1Id] || null,
        spell2:       SPELL_MAP[p.spell2Id] || null,
        ranked:       { soloQ: ranked.soloQ, flexQ: ranked.flexQ, displayed },
      });
    }

    res.status(200).json({
      gameId: game.gameId,
      gameMode: QUEUE_MAP[queueId] || game.gameMode || "Partida",
      queueId, isRanked, durationSecs, gameStartTime,
      participants:    enriched,
      bannedChampions: game.bannedChampions || [],
    });
  } catch (err) {
    const status = err.response?.status || 500;
    if (status === 404) return res.status(200).json({ inGame: false });
    res.status(status).json({ error: err.message });
  }
};
