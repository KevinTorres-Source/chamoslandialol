require("dotenv").config({ path: "./.env" });

const express = require("express");
const axios   = require("axios");
const cors    = require("cors");

const app = express();
app.use(cors());

const PORT = 3000;

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🔑 API KEY cargada:", process.env.RIOT_API_KEY ? "✅ SÍ" : "❌ NO");
console.log("🌎 REGION:", process.env.REGION);
console.log("📏 KEY LENGTH:", process.env.RIOT_API_KEY?.length);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

// ===============================
// ⚙️ REGIONES
// ===============================
const REGIONAL_HOST = "https://americas.api.riotgames.com";
const PLATFORM_HOST = "https://la1.api.riotgames.com";
const RIOT_HEADERS  = { "X-Riot-Token": process.env.RIOT_API_KEY };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ===============================
// 🎮 CUENTAS HARDCODEADAS
// ===============================
const ACCOUNTS = [
  { gameName: "QUÉ MIRÁS BOBO",    tagLine: "6867"  },
  { gameName: "Always Womanizer",   tagLine: "LAN"   },
  { gameName: "Atenc1a activo",     tagLine: "Activ" },
  { gameName: "ALEKYON",            tagLine: "LAN"   },
  { gameName: "how is sapo hpta",   tagLine: "LAN"   },
];

// Cache en memoria
const players = [];

// ===============================
// 📈 HISTORIAL DE ELO
// Cada entrada: { timestamp: Number, date: String, snapshots: [{ name, tag, soloQLP, flexQLP, soloQTier, flexQTier }] }
// Se guarda en memoria — se pierde al reiniciar el servidor.
// Máximo 500 entradas para no crecer indefinidamente.
// ===============================
const eloHistory = [];
const MAX_HISTORY = 500;

// ===============================
// 🔢 Calcula LP absoluto para el gráfico
// (mismo que eloScore en el frontend pero devuelve valor numérico)
// ===============================
const TIER_ORDER = {
  CHALLENGER: 10, GRANDMASTER: 9, MASTER: 8,
  DIAMOND: 7, EMERALD: 6, PLATINUM: 5,
  GOLD: 4, SILVER: 3, BRONZE: 2, IRON: 1, UNRANKED: 0
};
const RANK_ORDER = { I: 4, II: 3, III: 2, IV: 1, "": 0 };

function eloScore(queue) {
  if (!queue || queue.tier === "UNRANKED") return 0;
  const tier = TIER_ORDER[queue.tier] || 0;
  const rank = RANK_ORDER[queue.rank] || 0;
  const lp   = queue.lp || 0;
  return tier * 10000 + rank * 1000 + lp;
}

// ===============================
// 📸 Guarda snapshot del estado actual en el historial
// ===============================
function saveSnapshot() {
  if (players.length === 0) return;

  const snapshot = {
    timestamp: Date.now(),
    date: new Date().toISOString(),
    snapshots: players.map((p) => ({
      name:       p.name,
      tag:        p.tag,
      soloQScore: eloScore(p.soloQ),
      flexQScore: eloScore(p.flexQ),
      soloQTier:  p.soloQ?.tier  || "UNRANKED",
      flexQTier:  p.flexQ?.tier  || "UNRANKED",
      soloQLP:    p.soloQ?.lp    || 0,
      flexQLP:    p.flexQ?.lp    || 0,
    })),
  };

  eloHistory.push(snapshot);

  // Limita el tamaño
  if (eloHistory.length > MAX_HISTORY) {
    eloHistory.splice(0, eloHistory.length - MAX_HISTORY);
  }

  console.log(`📸 Snapshot guardado — total: ${eloHistory.length}`);
}

// ===============================
// 🏆 RANKED por PUUID
// ===============================
async function getRankedByPuuid(puuid) {
  try {
    const response = await axios.get(
      `${PLATFORM_HOST}/lol/league/v4/entries/by-puuid/${puuid}`,
      { headers: RIOT_HEADERS }
    );
    const data  = response.data;
    const soloQ = data.find((q) => q.queueType === "RANKED_SOLO_5x5") || null;
    const flexQ = data.find((q) => q.queueType === "RANKED_FLEX_SR")  || null;
    if (data.length === 0) console.log(`  ℹ️  Sin ranked`);
    return { soloQ, flexQ };
  } catch (err) {
    console.error("  ❌ getRankedByPuuid error:", err.response?.status, err.response?.data?.status?.message);
    return { soloQ: null, flexQ: null };
  }
}

// ===============================
// 🔢 Formatea una cola
// ===============================
function formatQueue(queue) {
  if (!queue) return { tier: "UNRANKED", rank: "", lp: 0, wins: 0, losses: 0 };
  return {
    tier:   queue.tier         || "UNRANKED",
    rank:   queue.rank         || "",
    lp:     queue.leaguePoints || 0,
    wins:   queue.wins         || 0,
    losses: queue.losses       || 0,
  };
}

// ===============================
// 🚀 CARGA INICIAL
// ===============================
async function loadPlayers() {
  console.log("\n🎮 Cargando jugadores hardcodeados...\n");

  for (const account of ACCOUNTS) {
    const { gameName, tagLine } = account;
    console.log(`➕ Cargando: ${gameName}#${tagLine}`);

    try {
      await wait(1500);

      // Paso 1 — PUUID
      const accountRes = await axios.get(
        `${REGIONAL_HOST}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
        { headers: RIOT_HEADERS }
      );
      const { puuid, gameName: name, tagLine: tag } = accountRes.data;
      console.log(`  ✅ PUUID obtenido`);

      // Paso 2 — Summoner (nivel + profileIconId)
      let level         = 0;
      let profileIconId = 0;
      try {
        const summonerRes = await axios.get(
          `${PLATFORM_HOST}/lol/summoner/v4/summoners/by-puuid/${puuid}`,
          { headers: RIOT_HEADERS }
        );
        level         = summonerRes.data.summonerLevel || 0;
        profileIconId = summonerRes.data.profileIconId || 0;
        console.log(`  ✅ Nivel: ${level} | IconId: ${profileIconId}`);
      } catch (err) {
        console.log(`  ⚠️ Sin summoner data [${err.response?.status}]`);
      }

      // Paso 3 — Ranked
      const { soloQ, flexQ } = await getRankedByPuuid(puuid);
      console.log(`  📊 SoloQ: ${formatQueue(soloQ).tier} ${formatQueue(soloQ).rank} ${formatQueue(soloQ).lp}LP`);
      console.log(`  📊 Flex:  ${formatQueue(flexQ).tier} ${formatQueue(flexQ).rank} ${formatQueue(flexQ).lp}LP`);

      players.push({
        name,
        tag,
        puuid,
        level,
        profileIconId,
        soloQ:      formatQueue(soloQ),
        flexQ:      formatQueue(flexQ),
        lastUpdate: Date.now(),
      });

      console.log(`  🎉 Listo!\n`);

    } catch (err) {
      const status  = err.response?.status;
      const message = err.response?.data?.status?.message || err.message;
      console.error(`  ❌ ERROR cargando ${gameName}#${tagLine} [${status}]:`, message, "\n");
    }
  }

  console.log(`✅ Carga inicial terminada — ${players.length}/${ACCOUNTS.length} jugadores cargados`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Guarda el primer snapshot al arrancar
  saveSnapshot();
}

// ===============================
// ✅ GET /
// ===============================
app.get("/", (req, res) => {
  res.json({
    status: "Backend funcionando 🚀",
    jugadores_cargados: players.length,
    snapshots_historial: eloHistory.length,
    endpoints: [
      "GET /players                          → ver todos los jugadores",
      "GET /update                           → actualizar ELO de todos",
      "GET /history                          → historial de ELO para el gráfico",
      "GET /add/:gameName/:tagLine           → agregar jugador extra",
      "GET /debug-account/:gameName/:tagLine → diagnóstico paso a paso",
    ],
  });
});

// ===============================
// 📋 GET /players
// ===============================
app.get("/players", (req, res) => {
  res.json(players);
});

// ===============================
// 📈 GET /history — devuelve el historial de ELO para el gráfico
// ===============================
app.get("/history", (req, res) => {
  res.json(eloHistory);
});

// ===============================
// 🔄 GET /update — refresca ELO de todos y guarda snapshot
// ===============================
app.get("/update", async (req, res) => {
  console.log("\n🔄 Actualizando jugadores...");

  if (players.length === 0) {
    return res.json({ message: "No hay jugadores cargados.", players });
  }

  const resultados = [];

  for (const p of players) {
    console.log(`\n👤 ${p.name}#${p.tag}`);

    try {
      await wait(1500);

      // Actualizar nivel + profileIconId
      try {
        const summonerRes = await axios.get(
          `${PLATFORM_HOST}/lol/summoner/v4/summoners/by-puuid/${p.puuid}`,
          { headers: RIOT_HEADERS }
        );
        p.level         = summonerRes.data.summonerLevel || p.level;
        p.profileIconId = summonerRes.data.profileIconId || p.profileIconId;
      } catch {
        console.log("  ⚠️ No se pudo actualizar summoner data");
      }

      // Actualizar ranked
      const { soloQ, flexQ } = await getRankedByPuuid(p.puuid);
      p.soloQ      = formatQueue(soloQ);
      p.flexQ      = formatQueue(flexQ);
      p.lastUpdate = Date.now();

      console.log(`  📊 SoloQ: ${p.soloQ.tier} ${p.soloQ.rank} ${p.soloQ.lp}LP`);
      console.log(`  📊 Flex:  ${p.flexQ.tier} ${p.flexQ.rank} ${p.flexQ.lp}LP`);

      resultados.push({ name: p.name, status: "ok" });

    } catch (err) {
      const status  = err.response?.status;
      const message = err.response?.data?.status?.message || err.message;
      console.error(`  ❌ [${status}]:`, message);
      resultados.push({ name: p.name, status: "error", httpStatus: status, message });
    }
  }

  // Guarda snapshot después de cada update
  saveSnapshot();

  console.log("\n✅ Update terminado.");
  res.json({ message: "Update terminado", resultados, players });
});

// ===============================
// ➕ GET /add/:gameName/:tagLine
// ===============================
app.get("/add/:gameName/:tagLine", async (req, res) => {
  const { gameName, tagLine } = req.params;
  console.log(`\n➕ Agregando: ${gameName}#${tagLine}`);

  try {
    const accountRes = await axios.get(
      `${REGIONAL_HOST}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      { headers: RIOT_HEADERS }
    );

    const { puuid, gameName: name, tagLine: tag } = accountRes.data;

    if (players.find((p) => p.puuid === puuid)) {
      return res.json({ message: "Jugador ya existe ⚠️", players });
    }

    let level         = 0;
    let profileIconId = 0;
    try {
      const summonerRes = await axios.get(
        `${PLATFORM_HOST}/lol/summoner/v4/summoners/by-puuid/${puuid}`,
        { headers: RIOT_HEADERS }
      );
      level         = summonerRes.data.summonerLevel || 0;
      profileIconId = summonerRes.data.profileIconId || 0;
    } catch {}

    const { soloQ, flexQ } = await getRankedByPuuid(puuid);

    players.push({
      name, tag, puuid, level, profileIconId,
      soloQ: formatQueue(soloQ),
      flexQ:  formatQueue(flexQ),
      lastUpdate: Date.now(),
    });

    console.log(`  🎉 ${name}#${tag} agregado`);
    res.json({ message: "Jugador agregado ✅", players });

  } catch (err) {
    const status  = err.response?.status;
    const message = err.response?.data?.status?.message || err.message;
    res.status(500).json({
      error: "No se pudo agregar jugador", status, message,
      hint: { 403: "API Key expirada", 404: "Jugador no encontrado", 429: "Rate limit — espera 1 minuto" }[status] || "Error desconocido"
    });
  }
});

// ===============================
// 🔍 GET /debug-account/:gameName/:tagLine
// ===============================
app.get("/debug-account/:gameName/:tagLine", async (req, res) => {
  const { gameName, tagLine } = req.params;
  const result = {};

  try {
    const r = await axios.get(
      `${REGIONAL_HOST}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      { headers: RIOT_HEADERS }
    );
    result.paso1_account = { ok: true, data: r.data };
  } catch (err) {
    result.paso1_account = { ok: false, status: err.response?.status, message: err.response?.data?.status?.message };
    return res.json(result);
  }

  const puuid = result.paso1_account.data.puuid;

  try {
    const r = await axios.get(`${PLATFORM_HOST}/lol/summoner/v4/summoners/by-puuid/${puuid}`, { headers: RIOT_HEADERS });
    result.paso2_summoner = { ok: true, campos: Object.keys(r.data), data: r.data };
  } catch (err) {
    result.paso2_summoner = { ok: false, status: err.response?.status, message: err.response?.data?.status?.message };
  }

  try {
    const r = await axios.get(`${PLATFORM_HOST}/lol/league/v4/entries/by-puuid/${puuid}`, { headers: RIOT_HEADERS });
    result.paso3_ranked = { ok: true, queues_encontradas: r.data.length, data: r.data };
  } catch (err) {
    result.paso3_ranked = { ok: false, status: err.response?.status, message: err.response?.data?.status?.message };
  }

  res.json(result);
});

// ===============================

// ===============================
// 🎮 GET /matches/:puuid
// Últimas 5 partidas ranked (SoloQ + FlexQ mezcladas)
// ===============================
app.get("/matches/:puuid", async (req, res) => {
  const { puuid } = req.params;
  console.log(`\n🎮 Cargando partidas de: ${puuid.slice(0, 12)}...`);

  try {
    await wait(300);
    // SoloQ (queue 420)
    const soloRes = await axios.get(
      `${REGIONAL_HOST}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&count=5&start=0`,
      { headers: RIOT_HEADERS }
    );
    const soloQIds = soloRes.data || [];

    await wait(300);
    // Flex (queue 440)
    const flexRes = await axios.get(
      `${REGIONAL_HOST}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=440&count=5&start=0`,
      { headers: RIOT_HEADERS }
    );
    const flexIds = flexRes.data || [];

    // Mezclamos y tomamos las 5 más recientes por timestamp embebido en el ID
    const allIds = [...soloQIds, ...flexIds]
      .sort((a, b) => {
        const tsA = parseInt(a.split("_")[1]) || 0;
        const tsB = parseInt(b.split("_")[1]) || 0;
        return tsB - tsA;
      })
      .slice(0, 5);

    if (allIds.length === 0) return res.json([]);

    const matchDetails = [];
    for (const matchId of allIds) {
      await wait(300);
      try {
        const matchRes = await axios.get(
          `${REGIONAL_HOST}/lol/match/v5/matches/${matchId}`,
          { headers: RIOT_HEADERS }
        );
        const match       = matchRes.data;
        const participant = match.info.participants.find(p => p.puuid === puuid);
        if (!participant) continue;

        const duration = match.info.gameDuration;
        const mins     = Math.floor(duration / 60);
        const cs       = participant.totalMinionsKilled + participant.neutralMinionsKilled;
        const csPerMin = mins > 0 ? (cs / mins).toFixed(1) : "0";
        const queueId  = match.info.queueId;

        const gameEndTs = match.info.gameEndTimestamp || (match.info.gameCreation + duration * 1000);
        const diffMs    = Date.now() - gameEndTs;
        const diffH     = Math.floor(diffMs / 3600000);
        const diffD     = Math.floor(diffH / 24);
        const timeAgo   = diffD > 0 ? `Hace ${diffD}d` : diffH > 0 ? `Hace ${diffH}h` : "Hace < 1h";

        matchDetails.push({
          matchId,
          champion:  participant.championName,
          kills:     participant.kills,
          deaths:    participant.deaths,
          assists:   participant.assists,
          win:       participant.win,
          cs,
          csPerMin,
          duration,
          role:      participant.teamPosition || "",
          queueType: queueId === 420 ? "RANKED_SOLO_5x5" : "RANKED_FLEX_SR",
          timeAgo,
        });
      } catch (err) {
        console.error(`  ❌ Error obteniendo ${matchId}:`, err.response?.status);
      }
    }

    console.log(`  ✅ ${matchDetails.length} partidas cargadas`);
    res.json(matchDetails);

  } catch (err) {
    const status  = err.response?.status;
    const message = err.response?.data?.status?.message || err.message;
    console.error(`❌ /matches error [${status}]:`, message);
    res.status(status || 500).json({ error: message, status });
  }
});

// ===============================
// 🚀 ARRANQUE
// ===============================
loadPlayers().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor en http://localhost:${PORT}\n`);
  });
});