// =====================================================
// _lib.js — utilidades compartidas entre las funciones
// =====================================================
const axios = require("axios");

const REGIONAL_HOST = "https://americas.api.riotgames.com";
const PLATFORM_HOST = "https://la1.api.riotgames.com";

function riotHeaders() {
  return { "X-Riot-Token": process.env.RIOT_API_KEY };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const TIER_ORDER = {
  CHALLENGER: 10, GRANDMASTER: 9, MASTER: 8,
  DIAMOND: 7, EMERALD: 6, PLATINUM: 5,
  GOLD: 4, SILVER: 3, BRONZE: 2, IRON: 1, UNRANKED: 0,
};
const RANK_ORDER = { I: 4, II: 3, III: 2, IV: 1, "": 0 };

function eloScore(queue) {
  if (!queue || queue.tier === "UNRANKED") return 0;
  return (TIER_ORDER[queue.tier] || 0) * 10000
       + (RANK_ORDER[queue.rank] || 0) * 1000
       + (queue.lp || 0);
}

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

async function getRankedByPuuid(puuid) {
  try {
    const response = await axios.get(
      `${PLATFORM_HOST}/lol/league/v4/entries/by-puuid/${puuid}`,
      { headers: riotHeaders() }
    );
    const data  = response.data;
    const soloQ = data.find((q) => q.queueType === "RANKED_SOLO_5x5") || null;
    const flexQ = data.find((q) => q.queueType === "RANKED_FLEX_SR")  || null;
    return { soloQ, flexQ };
  } catch {
    return { soloQ: null, flexQ: null };
  }
}

const ACCOUNTS = [
  { gameName: "QUÉ MIRÁS BOBO",    tagLine: "6867"  },
  { gameName: "Always Womanizer",   tagLine: "LAN"   },
  { gameName: "Atenc1a activo",     tagLine: "Activ" },
  { gameName: "ALEKYON",            tagLine: "LAN"   },
  { gameName: "how is sapo hpta",   tagLine: "LAN"   },
];

const SUMMONER_SPELL_MAP = {
  1: "SummonerBoost", 3: "SummonerExhaust", 4: "SummonerFlash",
  6: "SummonerHaste", 7: "SummonerHeal",    11: "SummonerSmite",
  12: "SummonerTeleport", 13: "SummonerMana", 14: "SummonerDot",
  21: "SummonerBarrier", 32: "SummonerSnowball",
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

module.exports = {
  axios, REGIONAL_HOST, PLATFORM_HOST, riotHeaders, wait,
  eloScore, formatQueue, getRankedByPuuid,
  ACCOUNTS, SUMMONER_SPELL_MAP, corsHeaders,
};
