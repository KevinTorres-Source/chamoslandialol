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
  const color = wr > 50 ? "#4ade80" : wr === 50 ? "#9aa4b2" : "#f87171";
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

function getRoleIconUrl(role) {
  const base = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions";
  const map = {
    TOP:     `${base}/icon-position-top.png`,
    JUNGLE:  `${base}/icon-position-jungle.png`,
    MIDDLE:  `${base}/icon-position-middle.png`,
    BOTTOM:  `${base}/icon-position-bottom.png`,
    UTILITY: `${base}/icon-position-utility.png`,
  };
  return map[role?.toUpperCase()] || null;
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
/**
 * Snapea un eloScore (número) a un valor válido:
 * - LP siempre entre 0 y 99
 * - Tier/rank se mantiene según la escala interna
 * Esto evita valores imposibles como "GOLD 359 LP"
 */
function clampToValidElo(score) {
  if (!score || score <= 0) return 0;
  const tier = Math.floor(score / 10000);       // 1=IRON … 10=CHALLENGER
  const rank = Math.floor((score % 10000) / 1000); // 0-3 → IV-I
  const lp   = score % 1000;

  // Clamp LP a 0-99 (100 LP = sube de división, no es un estado válido)
  const clampedLp = Math.min(99, Math.max(0, lp));
  return tier * 10000 + rank * 1000 + clampedLp;
}

function generateSeasonHistory(players, mode) {
  const now         = Date.now();
  const seasonStart = new Date("2025-04-01").getTime();
  const totalMs     = now - seasonStart;
  const intervalMs  = 24 * 60 * 60 * 1000; // 1 punto por día
  const numPoints   = Math.floor(totalMs / intervalMs) + 1;

  const labels = [];
  const datasets = players.map((p, idx) => {
    const finalScore = mode === "soloQ" ? eloScore(p.soloQ) : eloScore(p.flexQ);
    const color = CHART_COLORS[idx % CHART_COLORS.length];
    return { label: p.name, color, finalScore, data: [] };
  });

  for (let i = 0; i < numPoints; i++) {
    const ts = seasonStart + i * intervalMs;
    const d  = new Date(ts);
    labels.push(`${d.getDate()}/${d.getMonth() + 1}`);

    const progress = numPoints > 1 ? i / (numPoints - 1) : 1;

    datasets.forEach(ds => {
      if (ds.finalScore === 0) { ds.data.push(null); return; }

      // Seed determinístico por jugador
      const seed = ds.label.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);

      // Punto de partida: 1 tier por debajo del actual, mínimo SILVER IV
      const startScore = Math.max(30000, ds.finalScore - 15000);

      // Trayectoria suave hacia el score final
      const base = startScore + (ds.finalScore - startScore) * easeInOutQuad(progress);

      // Ruido pequeño: máximo ±800 (menos de 1 división), se reduce al final
      const noiseAmp = 800 * (1 - progress * 0.7);
      const noise    = Math.sin(i * 0.5 + seed * 0.1) * noiseAmp
                     + Math.sin(i * 1.1 + seed * 0.3) * noiseAmp * 0.4;

      // Aplicar ruido y clamp a LP válido (0-99 dentro de cada división)
      const raw      = Math.round(base + noise);
      const clamped  = clampToValidElo(Math.max(10000, raw));
      ds.data.push(clamped);
    });
  }

  return { labels, datasets };
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function renderSeasonChart() {
  if (allPlayers.length === 0) return;
  const { labels, datasets } = generateSeasonHistory(allPlayers, chartMode);
  renderChart(labels, datasets);
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

// Plugin que dibuja un círculo con glow en el punto hovered
const hoverGlowPlugin = {
  id: "hoverGlow",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden) return;
      meta.data.forEach((point, j) => {
        if (!point.active) return;
        const color = dataset.borderColor;
        ctx.save();
        // Glow exterior
        ctx.beginPath();
        ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = color + "33";
        ctx.shadowColor   = color;
        ctx.shadowBlur    = 16;
        ctx.fill();
        // Círculo interior sólido
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fillStyle   = color;
        ctx.shadowColor = color;
        ctx.shadowBlur  = 10;
        ctx.fill();
        // Punto blanco central
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.shadowBlur = 0;
        ctx.fill();
        ctx.restore();
      });
    });
  }
};


function renderChart(labels, datasets) {
  const canvas = document.getElementById("eloChart");
  if (!canvas) return;

  const noDataEl = document.getElementById("chartNoData");
  if (noDataEl) noDataEl.style.display = "none";

  // Tooltip externo — un solo div que controlamos 100%
  let tooltipEl = document.getElementById("chartTooltipCustom");
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.id = "chartTooltipCustom";
    tooltipEl.className = "chart-tooltip-custom";
    document.querySelector(".chart-area").appendChild(tooltipEl);
  }

  const chartDatasets = datasets.map(ds => ({
    label:                ds.label,
    data:                 ds.data,
    borderColor:          ds.color || ds.borderColor,
    backgroundColor:      (ds.color || ds.borderColor) + "18",
    borderWidth:          2.5,
    pointRadius:          datasets[0].data.length > 30 ? 0 : 2,
    pointHoverRadius:     8,
    hoverRadius:          8,
    pointBackgroundColor: ds.color || ds.borderColor,
    pointBorderColor:     ds.color || ds.borderColor,
    pointBorderWidth:     0,
    tension:              0.4,
    fill:                 false,
    spanGaps:             true,
  }));

  // Handler del tooltip custom — muestra SOLO el dataset más cercano
  const customTooltip = (context) => {
    const { chart, tooltip } = context;

    if (tooltip.opacity === 0) {
      tooltipEl.style.opacity = "0";
      tooltipEl.style.pointerEvents = "none";
      return;
    }

    // tooltip.dataPoints tiene solo 1 item en modo nearest
    const item = tooltip.dataPoints?.[0];
    if (!item) return;

    const color   = item.dataset.borderColor;
    const name    = item.dataset.label;
    const score   = item.parsed.y;
    const label   = tooltip.title?.[0] || "";

    tooltipEl.innerHTML = `
      <div class="ctt-date">${label}</div>
      <div class="ctt-row">
        <span class="ctt-dot" style="background:${color}; box-shadow:0 0 8px 3px ${color}99;"></span>
        <div class="ctt-info">
          <span class="ctt-name">${name}</span>
          <span class="ctt-elo">${eloScoreToLabel(score)}</span>
        </div>
      </div>
    `;

    // Posición relativa al canvas
    const { offsetLeft: posX, offsetTop: posY } = chart.canvas;
    const canvasWidth  = chart.canvas.offsetWidth;
    const ttWidth      = 190;
    let   left         = posX + tooltip.caretX + 12;
    const top          = posY + tooltip.caretY - 30;

    // Flip si se sale por la derecha
    if (left + ttWidth > canvasWidth + posX) {
      left = posX + tooltip.caretX - ttWidth - 12;
    }

    tooltipEl.style.left    = left + "px";
    tooltipEl.style.top     = top  + "px";
    tooltipEl.style.opacity = "1";
    tooltipEl.style.borderColor = color + "66";
  };

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
    plugins: [hoverGlowPlugin],
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      // nearest + intersect:true → solo activa el punto exactamente bajo el cursor
      interaction:         { mode: "nearest", intersect: false, axis: "xy" },
      plugins: {
        legend:  { display: false },
        tooltip: {
          enabled:  false,         // desactiva el tooltip nativo de Chart.js
          external: customTooltip, // usamos el nuestro
          mode:     "nearest",
          intersect: false,
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
  cargarHistorial(allPlayers);
}

/**
 * Carga historial real desde el servidor.
 * Si no hay datos aún, muestra el mensaje "sin datos" en el gráfico.
 */
async function cargarHistorial(players) {
  try {
    const res = await fetch("/api/history");
    if (res.ok) {
      const history = await res.json();
      if (history && history.length >= 2) {
        const labels   = buildChartLabels(history);
        const datasets = buildChartDatasets(history, chartMode, players);
        renderChart(labels, datasets);
        return;
      }
    }
  } catch {}

  // Sin datos reales: usa simulación corregida como placeholder
  renderSeasonChart();
}

// ===============================
// 📡 Carga jugadores
// ===============================
async function cargarJugadores() {
  loading.style.display  = "flex";
  errorMsg.style.display = "none";
  tbody.innerHTML        = "";

  try {
    const res = await fetch("/api/players");
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
    const res = await fetch("/api/update");
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
  checkLiveGame(player);
  loadMatchHistory(player);
}

// ===============================
// 👤 PROFILE DATA — Layout estilo LoL client
// ===============================
function renderProfileData(player) {
  const dataEl = document.getElementById("profileData");
  if (!dataEl) return;

  const soloQ      = player.soloQ || { tier: "UNRANKED", rank: "", lp: 0, wins: 0, losses: 0 };
  const flexQ      = player.flexQ || { tier: "UNRANKED", rank: "", lp: 0, wins: 0, losses: 0 };
  const wrSolo     = winrate(soloQ.wins || 0, soloQ.losses || 0);
  const wrFlex     = winrate(flexQ.wins || 0, flexQ.losses || 0);
  const totalGames = (soloQ.wins || 0) + (soloQ.losses || 0);
  const iconUrl    = getProfileIconUrl(player.profileIconId);
  const opggUrl    = getOpggUrl(player.name, player.tag);

  const wrColor = (wr) => wr === null ? "#9aa4b2" : wr > 50 ? "#4ade80" : wr === 50 ? "#9aa4b2" : "#f87171";
  const tierColor = (t) => TIER_COLORS[t] || "#9aa4b2";

  // Barra de progreso LP dentro del tier actual
  const lpBar = soloQ.tier !== "UNRANKED" ? buildLPBar(soloQ) : "";

  dataEl.innerHTML = `
    <!-- HEADER DEL JUGADOR -->
    <div class="pf-header">
      <div class="pf-icon-wrap">
        <img class="pf-icon" src="${iconUrl}" alt="icon"
          onerror="this.src='https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/29.png'">
        <span class="pf-level">${player.level || "?"}</span>
      </div>
      <div class="pf-name-wrap">
        <div class="pf-name">${player.name} <span class="pf-tag">#${player.tag}</span></div>
        <a href="${opggUrl}" target="_blank" rel="noopener" class="pf-opgg-btn">OP.GG ↗</a>
      </div>
    </div>

    <!-- STATS HORIZONTALES -->
    <div class="pf-stats-row">
      <div class="pf-stat">
        <div class="pf-stat-val">${totalGames}</div>
        <div class="pf-stat-lbl">Partidas</div>
      </div>
      <div class="pf-stat-divider"></div>
      <div class="pf-stat">
        <div class="pf-stat-val" style="color:${wrColor(wrSolo)}">${wrSolo !== null ? wrSolo + "%" : "—"}</div>
        <div class="pf-stat-lbl" style="color:${wrColor(wrSolo) === '#9aa4b2' ? '' : wrColor(wrSolo)+'99'}">
          ${soloQ.wins || 0}W / ${soloQ.losses || 0}L
        </div>
      </div>
      <div class="pf-stat-divider"></div>
      <div class="pf-stat">
        <div class="pf-stat-val" style="color:${tierColor(soloQ.tier)}">
          ${soloQ.tier !== "UNRANKED" ? soloQ.tier + " " + soloQ.rank : "Unranked"}
        </div>
        <div class="pf-stat-lbl">${soloQ.tier !== "UNRANKED" ? soloQ.lp + " LP  Solo Q" : "Solo Q"}</div>
      </div>
      <div class="pf-stat-divider"></div>
      <div class="pf-stat">
        <div class="pf-stat-val" style="color:${tierColor(flexQ.tier)}">
          ${flexQ.tier !== "UNRANKED" ? flexQ.tier + " " + flexQ.rank : "Unranked"}
        </div>
        <div class="pf-stat-lbl">${flexQ.tier !== "UNRANKED" ? flexQ.lp + " LP  Flex" : "Flex"}</div>
      </div>
      <div class="pf-stat-divider"></div>
      <div class="pf-stat">
        <div class="pf-stat-val" style="color:${wrColor(wrFlex)}">${wrFlex !== null ? wrFlex + "%" : "—"}</div>
        <div class="pf-stat-lbl">WR Flex</div>
      </div>
      <div class="pf-stat-divider"></div>
      <div class="pf-stat">
        <div class="pf-stat-val">${player.level || "?"}</div>
        <div class="pf-stat-lbl">Nivel</div>
      </div>
    </div>

    ${lpBar}

    <!-- PARTIDA EN VIVO -->
    <div id="liveGameContainer"></div>

    <!-- ÚLTIMAS PARTIDAS -->
    <div class="pf-matches-title">ÚLTIMAS PARTIDAS RANKED</div>
    <div id="matchHistoryContainer">
      <div class="pf-loading"><div class="spinner"></div> Cargando partidas...</div>
    </div>
  `;
}

function buildLPBar(soloQ) {
  // Mínimo del tier: 0 LP, máximo: 100 LP (por división)
  // Master+ no tienen divisiones
  const isMasterPlus = ["MASTER","GRANDMASTER","CHALLENGER"].includes(soloQ.tier);
  if (isMasterPlus) return "";

  const lp = soloQ.lp || 0;
  const pct = Math.min(100, lp);
  const tierLabel = `${soloQ.tier} ${soloQ.rank}`;
  const color = TIER_COLORS[soloQ.tier] || "#c89b3c";

  return `
    <div class="pf-lpbar-wrap">
      <div class="pf-lpbar-label">
        <span>${tierLabel}</span>
        <span style="color:${color};font-weight:700">${lp} LP</span>
      </div>
      <div class="pf-lpbar-track">
        <div class="pf-lpbar-fill" style="width:${pct}%;background:${color};box-shadow:0 0 8px ${color}88"></div>
      </div>
    </div>
  `;
}


// ===============================
// 🔴 PARTIDA EN VIVO
// ===============================
let liveGameInterval = null;

async function checkLiveGame(player) {
  const container = document.getElementById("liveGameContainer");
  if (!container) return;

  // Limpiar intervalo anterior
  if (liveGameInterval) { clearInterval(liveGameInterval); liveGameInterval = null; }

  container.innerHTML = "";

  try {
    const res  = await fetch(`/api/live/${player.puuid}`);
    const data = await res.json();

    if (!data || data.inGame === false || !data.gameId) return;

    renderLiveGame(data, player, container);

    // Actualizar el timer cada segundo
    liveGameInterval = setInterval(() => {
      const el = document.getElementById("liveGameTimer");
      if (!el) { clearInterval(liveGameInterval); return; }
      const elapsed = Math.floor((Date.now() - data.gameStartTime) / 1000);
      el.textContent = formatDuration(elapsed);
    }, 1000);

  } catch {}
}

function formatDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function renderLiveGame(game, currentPlayer, container) {
  const blue    = game.participants.filter(p => p.teamId === 100);
  const red     = game.participants.filter(p => p.teamId === 200);
  const elapsed = Math.floor((Date.now() - game.gameStartTime) / 1000);

  const TIER_COLORS = {
    IRON:"#6b7280", BRONZE:"#cd7f32", SILVER:"#aab4c8", GOLD:"#f0c060",
    PLATINUM:"#4ac9a0", EMERALD:"#00e676", DIAMOND:"#4cc9f0",
    MASTER:"#c084fc", GRANDMASTER:"#ff6b6b", CHALLENGER:"#f72585", UNRANKED:"#4a5a72"
  };

  const fmtRanked = (r) => {
    if (!r || r.tier === "UNRANKED" || !r.tier) return `<span class="lg-unranked">Sin ranked</span>`;
    const color = TIER_COLORS[r.tier] || "#fff";
    const wrColor = r.wr === null ? "" : r.wr > 50 ? "#4ade80" : r.wr === 50 ? "#9aa4b2" : "#f87171";
    const wr = r.wr !== null ? `<span class="lg-wr" style="color:${wrColor}">${r.wr}%</span>` : "";
    return `<span class="lg-tier" style="color:${color}">${r.tier} ${r.rank}</span>
            <span class="lg-lp">${r.lp} LP</span>${wr}`;
  };

  const playerRow = (p) => {
    const isSelf  = p.puuid === currentPlayer.puuid;
    const champ   = p.championName ? getChampIconUrl(p.championName) : "";
    const name    = (p.summonerName || "?").replace(/#.*$/, "").slice(0, 16);
    const ranked  = p.ranked?.displayed;
    const soloQ   = p.ranked?.soloQ;

    // Determinar el tier a mostrar
    const tierToShow = (ranked?.tier && ranked.tier !== "UNRANKED") ? ranked
                     : (soloQ?.tier && soloQ.tier !== "UNRANKED") ? soloQ
                     : null;

    // URLs verificadas — jsDelivr CDN con assets oficiales de Riot
    const TIER_ICON_MAP = {
      IRON:        "https://cdn.jsdelivr.net/gh/magisteriis/lol-icons-and-emblems/tier-icons/base-icons/iron.png",
      BRONZE:      "https://cdn.jsdelivr.net/gh/magisteriis/lol-icons-and-emblems/tier-icons/base-icons/bronze.png",
      SILVER:      "https://cdn.jsdelivr.net/gh/magisteriis/lol-icons-and-emblems/tier-icons/base-icons/silver.png",
      GOLD:        "https://cdn.jsdelivr.net/gh/magisteriis/lol-icons-and-emblems/tier-icons/base-icons/gold.png",
      PLATINUM:    "https://cdn.jsdelivr.net/gh/magisteriis/lol-icons-and-emblems/tier-icons/base-icons/platinum.png",
      EMERALD:     "https://cdn.jsdelivr.net/gh/magisteriis/lol-icons-and-emblems/tier-icons/base-icons/emerald.png",
      DIAMOND:     "https://cdn.jsdelivr.net/gh/magisteriis/lol-icons-and-emblems/tier-icons/base-icons/diamond.png",
      MASTER:      "https://cdn.jsdelivr.net/gh/magisteriis/lol-icons-and-emblems/tier-icons/base-icons/master.png",
      GRANDMASTER: "https://cdn.jsdelivr.net/gh/magisteriis/lol-icons-and-emblems/tier-icons/base-icons/grandmaster.png",
      CHALLENGER:  "https://cdn.jsdelivr.net/gh/magisteriis/lol-icons-and-emblems/tier-icons/base-icons/challenger.png",
    };

    const nameTierIcon = tierToShow && TIER_ICON_MAP[tierToShow.tier]
      ? `<img class="lg-name-tier-icon" src="${TIER_ICON_MAP[tierToShow.tier]}" title="${tierToShow.tier}" onerror="this.style.display='none'">`
      : `<span class="lg-name-tier-na">N/A</span>`;

    return `
      <div class="lg-row${isSelf ? " lg-self" : ""}">
        <div class="lg-row-champ">
          ${champ ? `<img class="lg-champ-img" src="${champ}" onerror="this.style.opacity='0.3'">` : `<div class="lg-champ-ph"></div>`}
        </div>
        <div class="lg-row-name">
          <div class="lg-name-row">
            <span class="lg-summ-name">${name}</span>
            ${nameTierIcon}
          </div>
          ${soloQ && soloQ.tier !== "UNRANKED" ? `<span class="lg-games">${(soloQ.wins||0)+(soloQ.losses||0)} partidas</span>` : ""}
        </div>
        <div class="lg-row-ranked">
          <div class="lg-row-ranked-text">${fmtRanked(ranked)}</div>
        </div>
      </div>`;
  };

  const teamBlock = (team, label, color) => `
    <div class="lg-team-block">
      <div class="lg-team-header" style="color:${color}">${label}</div>
      ${team.map(playerRow).join("")}
    </div>`;

  container.innerHTML = `
    <div class="lg-panel">
      <div class="lg-header">
        <div class="lg-live-badge"><span class="lg-dot"></span>EN VIVO</div>
        <span class="lg-mode">${game.gameMode}</span>
        <span class="lg-timer" id="liveGameTimer">${formatDuration(elapsed)}</span>
      </div>
      <div class="lg-body">
        ${teamBlock(blue, "Equipo Azul", "#60a5fa")}
        <div class="lg-divider">VS</div>
        ${teamBlock(red, "Equipo Rojo", "#f87171")}
      </div>
    </div>`;
}

// ===============================
// 🎮 CARGAR HISTORIAL DE PARTIDAS
// ===============================
async function loadMatchHistory(player) {
  const container = document.getElementById("matchHistoryContainer");
  if (!container) return;

  container.innerHTML = `<div class="pf-loading"><div class="spinner"></div> Cargando partidas...</div>`;

  try {
    const res = await fetch(`/api/matches/${player.puuid}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const matches = await res.json();
    renderMatchHistory(matches, container, player);
  } catch (err) {
    container.innerHTML = buildMatchPlaceholder(player);
  }
}

// ===============================
// 🃏 RENDER PARTIDAS — Layout fiel al original
// ===============================
function renderMatchHistory(matches, container, player) {
  if (!matches || matches.length === 0) {
    container.innerHTML = `<div class="pf-no-matches">No se encontraron partidas ranked recientes.</div>`;
    return;
  }

  // Agrupa por fecha
  const groups = {};
  matches.slice(0, 5).forEach(m => {
    const d = new Date((m.gameEndTimestamp || 0));
    const key = d.toLocaleDateString("es-ES", { weekday:"long", day:"numeric", month:"long" });
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });

  let html = "";
  matches.slice(0, 5).forEach((m, idx) => {
    const isWin     = m.win;
    const kda       = m.deaths === 0 ? "Perfect" : ((m.kills + m.assists) / m.deaths).toFixed(1);
    const kdaColor  = m.deaths === 0 ? "#facc15" : parseFloat(kda) >= 3 ? "#4ade80" : parseFloat(kda) >= 2 ? "#e2e8f0" : "#f87171";
    const champIcon = getChampIconUrl(m.champion);
    const mins      = Math.floor(m.duration / 60);
    const secs      = String(m.duration % 60).padStart(2,"0");
    const qLbl      = m.queueType === "RANKED_SOLO_5x5" ? "Solo Q" : "Flex Q";
    const lpDelta   = m.lpDelta != null ? (m.lpDelta >= 0 ? `+${m.lpDelta}` : `${m.lpDelta}`) : null;
    const lpColor   = m.lpDelta >= 0 ? "#4ade80" : "#f87171";

    // Ítems (hasta 7 slots)
    const itemSlots = (m.items || []).slice(0, 7);
    const itemsHtml = itemSlots.map(itemId => {
      if (!itemId) return `<div class="mi-empty"></div>`;
      return `<img class="mi-icon" src="https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/item/${itemId}.png"
        alt="" onerror="this.style.display='none'">`;
    }).join("") + (itemSlots.length < 7 ? Array(7 - itemSlots.length).fill(`<div class="mi-empty"></div>`).join("") : "");

    // Participantes de ambos equipos (5+5)
    const blue = (m.participants || []).filter(p => p.teamId === 100).slice(0,5);
    const red  = (m.participants || []).filter(p => p.teamId === 200).slice(0,5);

    const teamHtml = (team) => team.map(p => {
      const isSelf = p.puuid === player.puuid;
      const pIcon  = getChampIconUrl(p.champion || p.championName || "");
      return `<div class="mp-player${isSelf ? " mp-self" : ""}">
        <img class="mp-icon" src="${pIcon}" alt="${p.champion || p.championName}"
          onerror="this.style.visibility='hidden'">
        <span class="mp-name">${(p.summonerName || p.riotIdGameName || "?").slice(0,12)}</span>
      </div>`;
    }).join("");

    html += `
      <div class="mc-card ${isWin ? "mc-win" : "mc-loss"}">

        <!-- COL 1: META -->
        <div class="mc-meta">
          <div class="mc-queue">${qLbl}</div>
          <div class="mc-result ${isWin ? "mc-v" : "mc-d"}">${isWin ? "Victoria" : "Derrota"}</div>
          <div class="mc-dur">${mins}:${secs}</div>
          ${lpDelta !== null ? `<div class="mc-lp" style="color:${lpColor}">${lpDelta} LP</div>` : ""}
          <div class="mc-ago">${m.timeAgo || ""}</div>
        </div>

        <!-- COL 2: CAMPEÓN + SUMMONERS -->
        <div class="mc-champ-col">
          <div class="mc-champ-wrap">
            <img class="mc-champ-img" src="${champIcon}" alt="${m.champion}"
              onerror="this.style.opacity='0.3'">
            <span class="mc-champ-lv">${m.champLevel || ""}</span>
            ${(() => { const url = getRoleIconUrl(m.role); return url ? `<img class="mc-role-icon" src="${url}" alt="${m.role}" onerror="this.style.display='none'">` : ""; })()}
          </div>
          <div class="mc-spells">
            ${(m.summoners || []).map(s =>
              `<img class="mc-spell" src="https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/spell/${s}.png"
                alt="" onerror="this.style.display='none'">`
            ).join("") || '<div class="mc-spell-ph"></div><div class="mc-spell-ph"></div>'}
          </div>
        </div>

        <!-- COL 3: KDA + CS -->
        <div class="mc-kda-col">
          <div class="mc-kda-nums">
            <span class="mc-k">${m.kills}</span>
            <span class="mc-sep"> / </span>
            <span class="mc-d">${m.deaths}</span>
            <span class="mc-sep"> / </span>
            <span class="mc-a">${m.assists}</span>
          </div>
          <div class="mc-kda-ratio" style="color:${kdaColor}">${kda} KDA</div>
          <div class="mc-cs">${m.cs || 0} CS · ${m.csPerMin || 0}/min</div>
        </div>

        <!-- COL 4: ÍTEMS -->
        <div class="mc-items">
          ${itemsHtml}
        </div>

        <!-- COL 5: EQUIPOS 5v5 -->
        <div class="mc-teams">
          <div class="mc-team">${teamHtml(blue)}</div>
          <div class="mc-team">${teamHtml(red)}</div>
        </div>

      </div>
    `;
  });

  container.innerHTML = `<div class="mc-list">${html}</div>`;
}

function buildMatchPlaceholder(player) {
  const opggUrl = getOpggUrl(player.name, player.tag);
  return `
    <div class="pf-placeholder">
      <p>El servidor necesita el endpoint <code>/matches/:puuid</code> para mostrar el historial.
      Asegurate de reiniciar el servidor con el <strong>server.js</strong> actualizado.</p>
      <a href="${opggUrl}" target="_blank" rel="noopener" class="pf-opgg-link">Ver partidas en OP.GG ↗</a>
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
