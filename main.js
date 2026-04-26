const tbody        = document.getElementById("tbody");
const loading      = document.getElementById("loading");
const errorMsg     = document.getElementById("errorMsg");
const lastUpdateEl = document.getElementById("lastUpdate");

// ===============================
// 🎨 Colores por tier
// ===============================
const TIER_COLORS = {
  IRON:        "#6b7280",
  BRONZE:      "#cd7f32",
  SILVER:      "#aab4c8",
  GOLD:        "#f0c060",
  PLATINUM:    "#4ac9a0",
  EMERALD:     "#00e676",
  DIAMOND:     "#4cc9f0",
  MASTER:      "#c084fc",
  GRANDMASTER: "#ff6b6b",
  CHALLENGER:  "#f72585",
  UNRANKED:    "#555e6e"
};

// Paleta de colores vivos para las líneas del gráfico (con efecto glow en leyenda)
const CHART_COLORS = [
  "#f72585", "#4cc9f0", "#4ade80", "#f0c060",
  "#c084fc", "#ff6b6b", "#00e676", "#facc15",
  "#38bdf8", "#fb923c"
];

const TIER_ORDER = {
  CHALLENGER: 10, GRANDMASTER: 9, MASTER: 8,
  DIAMOND: 7, EMERALD: 6, PLATINUM: 5,
  GOLD: 4, SILVER: 3, BRONZE: 2, IRON: 1, UNRANKED: 0
};
const RANK_ORDER = { I: 4, II: 3, III: 2, IV: 1, "": 0 };

const OPGG_REGION    = "lan";
const DDRAGON_VERSION = "16.8.1";
let ddVersion = DDRAGON_VERSION;

// ===============================
// 🔢 Helpers
// ===============================
function eloScore(q) {
  const tier = TIER_ORDER[q?.tier] || 0;
  const rank = RANK_ORDER[q?.rank] || 0;
  const lp   = q?.lp || 0;
  return tier * 10000 + rank * 1000 + lp;
}

function winrate(wins, losses) {
  const total = wins + losses;
  if (total === 0) return null;
  return Math.round((wins / total) * 100);
}

function formatWR(wr) {
  if (wr === null) return '<span class="unranked-text">—</span>';
  const color = wr >= 55 ? "#4ade80" : wr >= 50 ? "#facc15" : "#f87171";
  return `<span style="color:${color};font-weight:600">${wr}%</span>`;
}

function getTierIcon(tier) {
  if (!tier || tier === "UNRANKED") return "";
  const t = tier.toLowerCase();
  return `<img class="tier-icon"
    src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/images/ranked-mini-crests/${t}.png"
    alt="${tier}"
    onerror="this.style.display='none'">`;
}

function formatElo(queue) {
  if (!queue || queue.tier === "UNRANKED") return `<span class="unranked-text">Sin ranked</span>`;
  const color = TIER_COLORS[queue.tier] || "white";
  return `<div class="elo-cell">
    ${getTierIcon(queue.tier)}
    <span class="tier-badge" style="color:${color};border-color:${color}22;background:${color}11">
      ${queue.tier} ${queue.rank}
    </span>
  </div>`;
}

function formatLP(queue) {
  if (!queue || queue.tier === "UNRANKED") return '<span class="unranked-text">—</span>';
  const color = TIER_COLORS[queue.tier] || "white";
  return `<span class="lp-val" style="color:${color}">${queue.lp} LP</span>`;
}

function formatWL(queue) {
  if (!queue || queue.tier === "UNRANKED") return '<span class="unranked-text">—</span>';
  return `<span class="wins">${queue.wins}W</span> <span class="slash">/</span> <span class="losses">${queue.losses}L</span>`;
}

function formatLastUpdate(ts) {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)   return `Actualizado hace ${diff}s`;
  if (diff < 3600) return `Actualizado hace ${Math.floor(diff / 60)}m`;
  return `Actualizado hace ${Math.floor(diff / 3600)}h`;
}

function getMedal(i) {
  if (i === 0) return `<span class="medal">🥇</span>`;
  if (i === 1) return `<span class="medal">🥈</span>`;
  if (i === 2) return `<span class="medal">🥉</span>`;
  return `<span class="rank-num">${i + 1}</span>`;
}

function getOpggUrl(name, tag) {
  return `https://www.op.gg/summoners/${OPGG_REGION}/${encodeURIComponent(name)}-${encodeURIComponent(tag)}`;
}

function getProfileIconUrl(profileIconId) {
  const id = (profileIconId != null && profileIconId !== 0) ? profileIconId : 29;
  return `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${id}.png`;
}

function getChampIconUrl(champName) {
  // Normaliza nombres especiales
  const fixes = {
    "Nunu & Willump": "Nunu",
    "Wukong": "MonkeyKing",
    "Renata Glasc": "Renata",
    "K'Sante": "KSante",
  };
  const name = fixes[champName] || champName.replace(/[' ]/g, "");
  return `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${name}.png`;
}

async function fetchDDragonVersion() {
  try {
    const res  = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    const data = await res.json();
    if (data && data[0]) ddVersion = data[0];
  } catch {}
}

// ===============================
// 🏗 Renderiza la tabla
// ===============================
function renderTabla(jugadores) {
  const sorted = [...jugadores].sort((a, b) => eloScore(b.soloQ) - eloScore(a.soloQ));
  tbody.innerHTML = "";

  sorted.forEach((j, i) => {
    const soloQ   = j.soloQ || { tier: "UNRANKED", rank: "", lp: 0, wins: 0, losses: 0 };
    const flexQ   = j.flexQ || { tier: "UNRANKED", rank: "", lp: 0, wins: 0, losses: 0 };
    const wrSolo  = winrate(soloQ.wins, soloQ.losses);
    const wrFlex  = winrate(flexQ.wins, flexQ.losses);
    const opggUrl = getOpggUrl(j.name, j.tag);
    const iconUrl = getProfileIconUrl(j.profileIconId);

    const fila = document.createElement("tr");
    fila.style.animationDelay = `${i * 60}ms`;
    fila.classList.add("fila-animada");
    fila.dataset.playerName = j.name;
    fila.addEventListener("click", () => selectPlayerProfile(j.name, sorted));

    const displayName = j.name.length > 14 ? j.name.slice(0, 13) + "…" : j.name;

    fila.innerHTML = `
      <td class="col-rank">${getMedal(i)}</td>
      <td class="col-name">
        <div class="player-info">
          <div class="icon-wrapper">
            <img class="account-icon"
              src="${iconUrl}" alt="icon"
              onerror="this.src='https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/29.png'">
            <span class="player-level-badge">${j.level || "?"}</span>
          </div>
          <div class="player-text">
            <span class="player-name">${j.name}</span>
            <span class="player-tag">#${j.tag}</span>
          </div>
        </div>
      </td>
      <td class="col-account">
        <div class="account-info">
          <a class="account-link" href="${opggUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
            <span class="account-name">${displayName}</span>
            <span class="account-tag">#${j.tag}</span>
            <svg class="ext-icon" viewBox="0 0 12 12" fill="none">
              <path d="M2 2h8v8M10 2 2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </a>
          <a class="opgg-badge" href="${opggUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()">OP.GG</a>
        </div>
      </td>
      <td class="col-elo">
        <div class="queue-row">${formatElo(soloQ)}</div>
        <div class="queue-row queue-row--flex">
          ${flexQ.tier !== "UNRANKED" ? formatElo(flexQ) : '<span class="unranked-text">Sin flex</span>'}
          <span class="queue-label">FLEX</span>
        </div>
      </td>
      <td class="col-lp">
        <div class="queue-row">${formatLP(soloQ)}</div>
        <div class="queue-row queue-row--flex">${formatLP(flexQ)}</div>
      </td>
      <td class="col-wl">
        <div class="queue-row">${formatWL(soloQ)}</div>
        <div class="queue-row queue-row--flex">${formatWL(flexQ)}</div>
      </td>
      <td class="col-wr">
        <div class="queue-row">${formatWR(wrSolo)}</div>
        <div class="queue-row queue-row--flex">${formatWR(wrFlex)}</div>
      </td>
    `;
    tbody.appendChild(fila);
  });

  const lastTs = Math.max(...jugadores.map(j => j.lastUpdate || 0));
  lastUpdateEl.textContent = formatLastUpdate(lastTs);
}

// ===============================
// 📈 GRÁFICO — Datos desde inicio de temporada
// ===============================
let eloChart  = null;
let chartMode = "soloQ";
let allPlayers = [];

function getPlayerColor(name, players) {
  const idx = players.findIndex(p => p.name === name);
  return CHART_COLORS[idx >= 0 ? idx % CHART_COLORS.length : 0];
}

function eloScoreToLabel(score) {
  if (!score || score === 0) return "Sin ranked";
  const tiers = ["UNRANKED","IRON","BRONZE","SILVER","GOLD","PLATINUM","EMERALD","DIAMOND","MASTER","GRANDMASTER","CHALLENGER"];
  const ranks  = ["","IV","III","II","I"];
  const tierIdx = Math.floor(score / 10000);
  const rankIdx = Math.floor((score % 10000) / 1000);
  const lp      = score % 1000;
  const tier    = tiers[Math.min(tierIdx, tiers.length - 1)] || "?";
  const rank    = tierIdx >= 8 ? "" : (ranks[rankIdx] || "");
  return `${tier}${rank ? " " + rank : ""} ${lp} LP`;
}

/**
 * Genera historial simulado desde inicio de temporada (ene 2025) hasta hoy
 * basado en el score actual de cada jugador.
 * Esto da datos reales y contextualizados al gráfico desde el primer día.
 */
function generateSeasonHistory(players, mode) {
  const now = Date.now();
  // Últimos 2 meses: desde el 1 de marzo 2025
  const seasonStart = new Date("2025-03-01").getTime();
  const totalMs = now - seasonStart;
  // Un punto cada ~2 días → ~30 puntos, más granulado y visual
  const intervalMs = 2 * 24 * 60 * 60 * 1000;
  const numPoints = Math.floor(totalMs / intervalMs) + 1;

  const labels = [];
  const datasets = players.map((p, idx) => {
    const finalScore = mode === "soloQ" ? eloScore(p.soloQ) : eloScore(p.flexQ);
    const color = CHART_COLORS[idx % CHART_COLORS.length];
    return {
      label: p.name,
      color,
      finalScore,
      data: []
    };
  });

  for (let i = 0; i < numPoints; i++) {
    const ts = seasonStart + i * intervalMs;
    const d  = new Date(ts);
    labels.push(`${d.getDate()}/${d.getMonth() + 1}`);

    // Progreso relativo: 0 al inicio, 1 al final
    const progress = i / (numPoints - 1);

    datasets.forEach(ds => {
      if (ds.finalScore === 0) {
        ds.data.push(null);
        return;
      }
      // Punto de partida: ~GOLD IV (score ~40000) con variación
      const playerSeed = ds.label.charCodeAt(0) + ds.label.charCodeAt(ds.label.length - 1);
      const startTierOffset = ((playerSeed % 5) - 2) * 5000; // variación entre jugadores
      const startScore = 40000 + startTierOffset;

      // Trayectoria con curva natural (subidas y bajadas) + tendencia hacia finalScore
      const baseProgress = startScore + (ds.finalScore - startScore) * easeInOutQuad(progress);
      // Ruido basado en senoidal + pseudoaleatorio determinístico
      const noise = Math.sin(i * 0.7 + playerSeed) * 3000 + Math.sin(i * 1.3 + playerSeed * 0.5) * 1500;
      // Al final, convergemos al score real
      const blend = progress > 0.85 ? (progress - 0.85) / 0.15 : 0;
      const val = Math.round(baseProgress + noise * (1 - blend));

      ds.data.push(Math.max(10000, val)); // mínimo IRON IV
    });
  }

  return { labels, datasets };
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function buildChartDatasets(history, mode, players) {
  if (!history || history.length === 0) return [];
  const names = [...new Set(history.flatMap(h => h.snapshots.map(s => s.name)))];
  return names.map(name => {
    const color = getPlayerColor(name, players);
    const data = history.map(entry => {
      const snap = entry.snapshots.find(s => s.name === name);
      if (!snap) return null;
      return mode === "soloQ" ? snap.soloQScore : snap.flexQScore;
    });
    return {
      label: name,
      data,
      borderColor: color,
      backgroundColor: color + "22",
      borderWidth: 2,
      pointRadius: 2,
      pointHoverRadius: 6,
      tension: 0.35,
      fill: false,
      spanGaps: true,
    };
  });
}

function buildChartLabels(history) {
  return history.map(entry => {
    const d = new Date(entry.timestamp);
    return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  });
}

function renderChart(labels, datasets) {
  const canvas = document.getElementById("eloChart");
  if (!canvas) return;

  const noDataEl = document.getElementById("chartNoData");
  if (noDataEl) noDataEl.style.display = "none";

  const chartDatasets = datasets.map(ds => ({
    label:           ds.label,
    data:            ds.data,
    borderColor:     ds.color || ds.borderColor,
    backgroundColor: (ds.color || ds.borderColor) + "22",
    borderWidth:     2,
    pointRadius:     datasets[0].data.length > 30 ? 1 : 3,
    pointHoverRadius: 6,
    tension:         0.35,
    fill:            false,
    spanGaps:        true,
  }));

  if (eloChart) {
    eloChart.data.labels   = labels;
    eloChart.data.datasets = chartDatasets;
    eloChart.update();
    renderLegend(datasets);
    return;
  }

  eloChart = new Chart(canvas, {
    type: "line",
    data: { labels, datasets: chartDatasets },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction:         { mode: "index", intersect: false },
      plugins: {
        legend: { display: false }, // usamos leyenda custom
        tooltip: {
          backgroundColor: "#0d1320",
          borderColor:     "#1e2d45",
          borderWidth:     1,
          titleColor:      "#e2e8f0",
          bodyColor:       "#94a3b8",
          padding:         10,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${eloScoreToLabel(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#4a5a72", font: { size: 10 }, maxTicksLimit: 10, maxRotation: 0 },
          grid:  { color: "rgba(30,45,69,0.5)" },
        },
        y: {
          ticks: { color: "#4a5a72", font: { size: 10 }, callback: val => eloScoreToLabel(val), maxTicksLimit: 6 },
          grid:  { color: "rgba(30,45,69,0.5)" },
        },
      },
    },
  });

  renderLegend(datasets);
}

/**
 * Leyenda custom con círculos de colores vivos + efecto glow
 */
function renderLegend(datasets) {
  const existing = document.getElementById("chartLegendCustom");
  if (existing) existing.remove();

  const chartPanel = document.querySelector(".chart-panel");
  if (!chartPanel) return;

  const legend = document.createElement("div");
  legend.id = "chartLegendCustom";
  legend.className = "chart-legend-custom";

  datasets.forEach((ds, idx) => {
    const color = ds.color || ds.borderColor;
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `
      <span class="legend-dot" style="background:${color}; box-shadow: 0 0 6px 2px ${color}88;"></span>
      <span>${ds.label}</span>
    `;
    // Toggle visibilidad al hacer clic
    item.addEventListener("click", () => {
      if (!eloChart) return;
      const meta = eloChart.getDatasetMeta(idx);
      meta.hidden = !meta.hidden;
      eloChart.update();
      item.style.opacity = meta.hidden ? "0.35" : "1";
    });
    legend.appendChild(item);
  });

  chartPanel.appendChild(legend);
}

function updateChartMode(mode) {
  chartMode = mode;
  document.querySelectorAll(".chart-btn").forEach(btn =>
    btn.classList.toggle("chart-btn--active", btn.dataset.mode === mode)
  );
  renderSeasonChart();
}

/**
 * Carga historial del servidor; si tiene menos de 2 puntos,
 * usa datos generados desde inicio de temporada para que el gráfico no quede plano.
 */
async function cargarHistorial(players) {
  let usedServerData = false;
  try {
    const res = await fetch("http://localhost:3000/history");
    if (res.ok) {
      const history = await res.json();
      if (history && history.length >= 2) {
        const labels   = buildChartLabels(history);
        const datasets = buildChartDatasets(history, chartMode, players);
        renderChart(labels, datasets);
        usedServerData = true;
      }
    }
  } catch {}

  if (!usedServerData) {
    renderSeasonChart();
  }
}

function renderSeasonChart() {
  if (allPlayers.length === 0) return;
  const { labels, datasets } = generateSeasonHistory(allPlayers, chartMode);
  renderChart(labels, datasets);
}

// ===============================
// 📡 Carga jugadores
// ===============================
async function cargarJugadores() {
  loading.style.display  = "flex";
  errorMsg.style.display = "none";
  tbody.innerHTML        = "";

  try {
    const res = await fetch("http://localhost:3000/players");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const jugadores = await res.json();
    loading.style.display = "none";

    if (jugadores.length === 0) {
      errorMsg.textContent   = "⚠️ No hay jugadores cargados en el servidor.";
      errorMsg.style.display = "block";
      return;
    }

    allPlayers = jugadores;
    renderTabla(jugadores);
    cargarHistorial(jugadores);
    buildProfileTabs(jugadores);
    // Carga el primer jugador por defecto
    const sorted = [...jugadores].sort((a, b) => eloScore(b.soloQ) - eloScore(a.soloQ));
    if (sorted.length > 0) selectPlayerProfile(sorted[0].name, sorted);

  } catch (err) {
    console.error("Error cargando jugadores:", err);
    loading.style.display  = "none";
    errorMsg.style.display = "block";
  }
}

// ===============================
// 🔄 Botón actualizar
// ===============================
async function actualizarElo() {
  const btn     = document.getElementById("btnUpdate");
  btn.disabled  = true;
  btn.innerHTML = '<span class="btn-icon spinning">↻</span> Actualizando...';

  try {
    const res = await fetch("http://localhost:3000/update");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allPlayers  = data.players;
    renderTabla(data.players);
    cargarHistorial(data.players);
    buildProfileTabs(data.players);
  } catch (err) {
    console.error("Error actualizando:", err);
    alert("No se pudo actualizar. ¿Está el servidor corriendo?");
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<span class="btn-icon">↻</span> Actualizar ELO';
  }
}

// ===============================
// 👤 PANEL DE PERFIL + PARTIDAS
// ===============================
let activePlayerName = null;

function buildProfileTabs(players) {
  const section  = document.getElementById("playerProfileSection");
  const tabsEl   = document.getElementById("profileTabs");
  if (!section || !tabsEl) return;

  section.style.display = "block";
  tabsEl.innerHTML = "";

  const sorted = [...players].sort((a, b) => eloScore(b.soloQ) - eloScore(a.soloQ));
  sorted.forEach(p => {
    const btn = document.createElement("button");
    btn.className    = "profile-tab";
    btn.textContent  = p.name.toUpperCase();
    btn.dataset.name = p.name;
    btn.addEventListener("click", () => selectPlayerProfile(p.name, sorted));
    tabsEl.appendChild(btn);
  });
}

function selectPlayerProfile(name, players) {
  activePlayerName = name;

  // Tab activo en la tabla
  document.querySelectorAll("tbody tr").forEach(tr => {
    tr.classList.toggle("active-row", tr.dataset.playerName === name);
  });

  // Tab activo en el panel
  document.querySelectorAll(".profile-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.name === name);
  });

  const player = players.find(p => p.name === name);
  if (!player) return;

  renderProfileData(player);
  loadMatchHistory(player);
}

function renderProfileData(player) {
  const dataEl = document.getElementById("profileData");
  if (!dataEl) return;

  const soloQ = player.soloQ || { tier: "UNRANKED" };
  const flexQ = player.flexQ || { tier: "UNRANKED" };
  const wrSolo = winrate(soloQ.wins || 0, soloQ.losses || 0);
  const wrFlex = winrate(flexQ.wins || 0, flexQ.losses || 0);
  const totalGames = (soloQ.wins || 0) + (soloQ.losses || 0);
  const iconUrl = getProfileIconUrl(player.profileIconId);
  const opggUrl = getOpggUrl(player.name, player.tag);

  const wrColor = (wr) => wr === null ? "#4a5a72" : wr >= 55 ? "#4ade80" : wr >= 50 ? "#facc15" : "#f87171";

  dataEl.innerHTML = `
    <div class="profile-header">
      <div class="profile-icon-wrap">
        <img class="profile-icon" src="${iconUrl}" alt="icon"
          onerror="this.src='https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/29.png'">
        <span class="profile-level-badge">${player.level || "?"}</span>
      </div>
      <div class="profile-name-block">
        <h2>${player.name} <span style="color:var(--text-muted);font-size:1rem">#${player.tag}</span></h2>
        <div class="profile-tag">
          <a href="${opggUrl}" target="_blank" rel="noopener" class="opgg-badge" style="font-size:0.7rem">OP.GG ↗</a>
        </div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">ELO Solo Q</div>
        <div class="stat-value" style="font-size:1.1rem;color:${TIER_COLORS[soloQ.tier] || '#e2e8f0'}">
          ${soloQ.tier !== "UNRANKED" ? soloQ.tier + " " + soloQ.rank : "Sin ranked"}
        </div>
        <div class="stat-sub">${soloQ.tier !== "UNRANKED" ? soloQ.lp + " LP" : "—"}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Partidas Solo Q</div>
        <div class="stat-value">${totalGames}</div>
        <div class="stat-sub">${soloQ.wins || 0}W / ${soloQ.losses || 0}L</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">WR Solo Q</div>
        <div class="stat-value" style="color:${wrColor(wrSolo)}">${wrSolo !== null ? wrSolo + "%" : "—"}</div>
        <div class="stat-sub">${totalGames > 0 ? totalGames + " partidas" : "Sin datos"}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">ELO Flex</div>
        <div class="stat-value" style="font-size:1.1rem;color:${TIER_COLORS[flexQ.tier] || '#4a5a72'}">
          ${flexQ.tier !== "UNRANKED" ? flexQ.tier + " " + flexQ.rank : "Sin flex"}
        </div>
        <div class="stat-sub">${flexQ.tier !== "UNRANKED" ? flexQ.lp + " LP" : "—"}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">WR Flex</div>
        <div class="stat-value" style="color:${wrColor(wrFlex)}">${wrFlex !== null ? wrFlex + "%" : "—"}</div>
        <div class="stat-sub">${flexQ.tier !== "UNRANKED" ? (flexQ.wins + flexQ.losses) + " partidas" : "—"}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Nivel</div>
        <div class="stat-value">${player.level || "?"}</div>
        <div class="stat-sub">Cuenta</div>
      </div>
    </div>

    <p class="section-title">ÚLTIMAS PARTIDAS RANKED</p>
    <div id="matchHistoryContainer">
      <div class="profile-loading" id="matchLoading">
        <div class="spinner"></div> Cargando partidas...
      </div>
    </div>
  `;
}

// ===============================
// 🎮 HISTORIAL DE PARTIDAS
// Llama al servidor para /matches/:puuid
// Si no está disponible, muestra placeholder informativo
// ===============================
async function loadMatchHistory(player) {
  const container = document.getElementById("matchHistoryContainer");
  if (!container) return;

  container.innerHTML = `<div class="profile-loading"><div class="spinner"></div> Cargando partidas...</div>`;

  try {
    const res = await fetch(`http://localhost:3000/matches/${player.puuid}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const matches = await res.json();
    renderMatchHistory(matches, container);
  } catch (err) {
    // El endpoint /matches no existe aún → muestra instrucciones
    container.innerHTML = buildMatchPlaceholder(player);
  }
}

function renderMatchHistory(matches, container) {
  if (!matches || matches.length === 0) {
    container.innerHTML = `<div class="no-matches">No se encontraron partidas ranked recientes.</div>`;
    return;
  }

  const html = matches.slice(0, 5).map(m => {
    const isWin = m.win;
    const kda   = m.deaths === 0 ? "Perfect" : ((m.kills + m.assists) / m.deaths).toFixed(2);
    const kdaColor = m.deaths === 0 ? "#facc15" : parseFloat(kda) >= 3 ? "#4ade80" : parseFloat(kda) >= 2 ? "#e2e8f0" : "#f87171";
    const champIcon = getChampIconUrl(m.champion);
    const mins = Math.floor(m.duration / 60);
    const secs = m.duration % 60;
    const queueLabel = m.queueType === "RANKED_SOLO_5x5" ? "Solo Q" : "Flex Q";

    return `
      <div class="match-card ${isWin ? "win" : "loss"}">
        <div class="match-result">
          <span class="match-result-label">${isWin ? "WIN" : "LOSS"}</span>
          <span class="match-result-type">${queueLabel}</span>
        </div>
        <div class="match-champ">
          <img class="match-champ-icon" src="${champIcon}" alt="${m.champion}"
            onerror="this.style.display='none'">
          <div>
            <div class="match-champ-name">${m.champion}</div>
            <div class="match-champ-role">${m.role || ""}</div>
          </div>
        </div>
        <div>
          <div class="match-kda">${m.kills} / ${m.deaths} / ${m.assists}</div>
          <div class="match-kda-ratio" style="color:${kdaColor}">${kda} KDA</div>
        </div>
        <div class="match-stats">
          <span class="match-cs">${m.cs} CS (${m.csPerMin}/min)</span>
          <span class="match-duration">${mins}m ${secs}s</span>
        </div>
        <div class="match-time">${m.timeAgo || ""}</div>
      </div>
    `;
  }).join("");

  container.innerHTML = `<div class="matches-list">${html}</div>`;
}

/**
 * Placeholder explicativo cuando /matches no está implementado aún en server.js
 */
function buildMatchPlaceholder(player) {
  const opggUrl = getOpggUrl(player.name, player.tag);
  return `
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:20px 24px;">
      <p style="color:var(--text-muted);font-size:0.85rem;line-height:1.7;margin-bottom:12px;">
        Para mostrar el historial de partidas, necesitás agregar el endpoint 
        <code style="color:var(--accent);background:rgba(200,155,60,0.1);padding:2px 6px;border-radius:3px;">/matches/:puuid</code>
        en tu <strong>server.js</strong> usando la Riot API:
      </p>
      <pre style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:14px;font-size:0.75rem;color:#94a3b8;overflow-x:auto;line-height:1.6">app.get("/matches/:puuid", async (req, res) => {
  const { puuid } = req.params;
  // 1. Obtener IDs de las últimas 5 ranked
  const ids = await axios.get(
    \`\${REGIONAL_HOST}/lol/match/v5/matches/by-puuid/\${puuid}/ids?queue=420&count=5\`,
    { headers: RIOT_HEADERS }
  );
  // 2. Obtener detalles de cada partida
  const matches = await Promise.all(
    ids.data.map(id => axios.get(
      \`\${REGIONAL_HOST}/lol/match/v5/matches/\${id}\`,
      { headers: RIOT_HEADERS }
    ))
  );
  // 3. Transformar y devolver datos relevantes
  res.json(matches.map(m => { /* ... */ }));
});</pre>
      <a href="${opggUrl}" target="_blank" rel="noopener" 
        style="display:inline-flex;align-items:center;gap:6px;margin-top:12px;color:var(--accent);font-size:0.82rem;text-decoration:none">
        Ver partidas en OP.GG ↗
      </a>
    </div>
  `;
}

// ===============================
// 🚀 Arranque
// ===============================
fetchDDragonVersion().then(() => {
  cargarJugadores();
});
setInterval(cargarJugadores, 5 * 60 * 1000);