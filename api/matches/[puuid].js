// api/matches/[puuid].js
// GET /api/matches/:puuid — últimas 5 partidas ranked del jugador

const {
  axios, REGIONAL_HOST, riotHeaders, wait, SUMMONER_SPELL_MAP, corsHeaders,
} = require("../_lib");

module.exports = async (req, res) => {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();

  const { puuid } = req.query;
  if (!puuid) return res.status(400).json({ error: "puuid requerido" });

  try {
    await wait(200);

    const [soloRes, flexRes] = await Promise.all([
      axios.get(
        `${REGIONAL_HOST}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&count=5&start=0`,
        { headers: riotHeaders() }
      ),
      axios.get(
        `${REGIONAL_HOST}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=440&count=5&start=0`,
        { headers: riotHeaders() }
      ),
    ]);

    const allIds = [...(soloRes.data || []), ...(flexRes.data || [])]
      .sort((a, b) => {
        const tsA = parseInt(a.split("_")[1]) || 0;
        const tsB = parseInt(b.split("_")[1]) || 0;
        return tsB - tsA;
      })
      .slice(0, 5);

    if (allIds.length === 0) return res.status(200).json([]);

    const matchDetails = [];
    for (const matchId of allIds) {
      await wait(250);
      try {
        const matchRes = await axios.get(
          `${REGIONAL_HOST}/lol/match/v5/matches/${matchId}`,
          { headers: riotHeaders() }
        );
        const match       = matchRes.data;
        const participant = match.info.participants.find((p) => p.puuid === puuid);
        if (!participant) continue;

        const duration = match.info.gameDuration;
        const mins     = Math.floor(duration / 60);
        const cs       = participant.totalMinionsKilled + participant.neutralMinionsKilled;
        const csPerMin = mins > 0 ? (cs / mins).toFixed(1) : "0";
        const queueId  = match.info.queueId;
        const gameEndTs = match.info.gameEndTimestamp || (match.info.gameCreation + duration * 1000);
        const diffMs   = Date.now() - gameEndTs;
        const diffH    = Math.floor(diffMs / 3600000);
        const diffD    = Math.floor(diffH / 24);
        const timeAgo  = diffD > 0 ? `Hace ${diffD}d` : diffH > 0 ? `Hace ${diffH}h` : "Hace < 1h";

        matchDetails.push({
          matchId,
          champion:         participant.championName,
          champLevel:       participant.champLevel || 0,
          kills:            participant.kills,
          deaths:           participant.deaths,
          assists:          participant.assists,
          win:              participant.win,
          cs, csPerMin, duration,
          role:             participant.teamPosition || participant.individualPosition || "",
          queueType:        queueId === 420 ? "RANKED_SOLO_5x5" : "RANKED_FLEX_SR",
          timeAgo, gameEndTimestamp: gameEndTs,
          items: [
            participant.item0, participant.item1, participant.item2,
            participant.item3, participant.item4, participant.item5,
            participant.item6,
          ].filter((id) => id > 0),
          summoners: [participant.summoner1Id, participant.summoner2Id]
            .map((id) => SUMMONER_SPELL_MAP[id] || null)
            .filter(Boolean),
          participants: match.info.participants.map((p) => ({
            puuid:        p.puuid,
            summonerName: p.summonerName || p.riotIdGameName || "?",
            champion:     p.championName,
            teamId:       p.teamId,
          })),
        });
      } catch (err) {
        console.error(`Error obteniendo match ${matchId}:`, err.response?.status);
      }
    }

    res.status(200).json(matchDetails);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.message, status });
  }
};
