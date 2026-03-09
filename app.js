/**
 * FIIInvest v2 — Frontend
 * MXRF11 fixo + Top 4 por ML
 * Dividendos, cotas para R$1.000/mês, análise de crescimento
 */

// ══════════════════════════════════════════════════════════
// IMPORTANTE: Substitua pela URL real do seu backend Koyeb
// Exemplo: "https://meu-fiinvest-backend.koyeb.app"
// ══════════════════════════════════════════════════════════
var API_URL = "https://direct-nady-fiinvest-f4173ed0.koyeb.app";

var REGISTERED_USERS = [
    { username: "vitorvargem",  password: "Vvjb1234#",  displayName: "Vítor Vargem" },
    { username: "AnaBeatriz",   password: "AB27250#",    displayName: "Ana Beatriz"  },
    { username: "gustuchiha",   password: "gustavo2004", displayName: "Gustavo"      },
];

var currentUser = null, currentPage = "dashboard", isDark = true, charts = {};

function $(s) { return document.querySelector(s); }
function $$(s) { return document.querySelectorAll(s); }

// ═══ API ═══
function apiGet(endpoint) {
    return fetch(API_URL + endpoint, { method: "GET", headers: { "Accept": "application/json" } })
        .then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
}

function checkApiConnection() {
    var bar = $("#conn-bar"), text = $("#conn-text");
    apiGet("/api/health")
        .then(function() {
            bar.className = "conn-bar online";
            text.textContent = "✓ Conectado à API Python (ML Engine online)";
            setTimeout(function() { bar.classList.add("hidden-bar"); }, 4000);
        })
        .catch(function() {
            bar.className = "conn-bar offline";
            text.textContent = "✗ API offline — Servidor indisponível no momento";
            setTimeout(checkApiConnection, 5000);
        });
}

// ═══ UTILS ═══
function destroyAllCharts() {
    Object.values(charts).forEach(function(c) { try { c.destroy(); } catch(e) {} });
    charts = {};
}
function cTh() {
    return {
        grid: isDark ? "rgba(35,55,95,.2)" : "rgba(195,210,235,.45)",
        tick: isDark ? "#4e5f78" : "#94a3b8",
        tipBg: isDark ? "#111c34" : "#ffffff",
        tipBdr: isDark ? "#1e3058" : "#e2e8f0",
        tipTxt: isDark ? "#f1f5f9" : "#0f172a"
    };
}
function fmtBRL(v) { return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtInt(v) { return v.toLocaleString("pt-BR"); }

var svgUp = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>';
var svgDn = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>';

// ═══ AUTH ═══
function authenticateUser(u, p) {
    for (var i = 0; i < REGISTERED_USERS.length; i++) {
        if (REGISTERED_USERS[i].username === u && REGISTERED_USERS[i].password === p) return REGISTERED_USERS[i];
    }
    return null;
}
function handleLogin(e) {
    e.preventDefault();
    var user = authenticateUser($("#inp-user").value.trim(), $("#inp-pass").value);
    if (user) { currentUser = user; enterApp(); }
    else {
        var err = $("#login-error"); err.textContent = "Usuário ou senha inválidos"; err.classList.add("show");
        var c = $("#login-card"); c.classList.add("shake"); setTimeout(function() { c.classList.remove("shake"); }, 500);
    }
}
function enterApp() {
    $("#login-screen").classList.add("hidden"); $("#app").classList.remove("hidden");
    $("#user-name").textContent = currentUser.displayName;
    $("#avatar").textContent = currentUser.displayName.charAt(0);
    checkApiConnection(); loadDashboard();
}
function logout() {
    currentUser = null; destroyAllCharts();
    $("#app").classList.add("hidden"); $("#login-screen").classList.remove("hidden");
    $("#inp-user").value = ""; $("#inp-pass").value = ""; $("#login-error").classList.remove("show");
    switchPage("dashboard");
}

// ═══ NAV ═══
function switchPage(page) {
    currentPage = page; destroyAllCharts();
    $$(".pg").forEach(function(p) { p.classList.remove("active"); });
    $("#pg-" + page).classList.add("active");
    $$(".tab").forEach(function(t) { t.classList.toggle("active", t.dataset.page === page); });
    $("#mobile-drop").classList.remove("open"); $("#burger").classList.remove("open");
    if (page === "dashboard") loadDashboard(); else loadInsights();
}
function toggleTheme() {
    isDark = !isDark; document.body.className = isDark ? "dark-theme" : "light-theme";
    destroyAllCharts(); if (currentPage === "dashboard") loadDashboard(); else loadInsights();
}

// ═══════════════════════════════════════════
//  DASHBOARD — 5 CARDS (MXRF11 + Top 4)
// ═══════════════════════════════════════════

function loadDashboard() {
    var grid = $("#grid-cards");
    grid.innerHTML = '<div class="loader" style="grid-column:1/-1"><div class="loader-ring" style="border-top-color:var(--blue)"></div><h3>Carregando fundos...</h3><p>Buscando os 4 melhores FIIs por score ML</p></div>';
    return apiGet("/api/dashboard")
        .then(function(data) { $("#dash-ts").textContent = data.timestamp; renderCards(data.funds); })
        .catch(function(err) {
            grid.innerHTML = '<div class="loader" style="grid-column:1/-1"><h3 style="color:var(--red)">API Python offline</h3><p style="margin-top:10px;color:var(--t2)">' + err.message + '</p><p style="margin-top:12px;color:var(--t3);font-size:12px">Execute <code>python server.py</code> no PyCharm</p></div>';
        });
}

function renderCards(funds) {
    var grid = $("#grid-cards");
    grid.innerHTML = "";

    funds.forEach(function(f, i) {
        var up = f.change_pct >= 0;
        var sign = up ? "+" : "";
        var id = "dc-" + f.ticker;
        var d = f.dividends;

        var dyC = f.dy12m > 10 ? "c-green" : f.dy12m > 8 ? "c-blue" : "c-yellow";
        var pvpC = f.pvp < 1 ? "c-green" : f.pvp > 1.05 ? "c-red" : "c-yellow";
        var growC = f.growth_12m >= 8 ? "c-green" : f.growth_12m >= 4 ? "c-blue" : "c-yellow";
        var scoreC = f.score >= 75 ? "c-green" : f.score >= 55 ? "c-yellow" : "c-red";

        // Badge
        var badgeHtml = "";
        if (f.is_fixed) badgeHtml = '<span class="badge badge-fixed">★ FIXO</span>';
        else if (f.rank) badgeHtml = '<span class="badge badge-rank">#' + f.rank + ' ML</span>';

        var el = document.createElement("div");
        el.className = "card anim-up";
        el.style.animationDelay = (i * 0.07) + "s";
        el.innerHTML =
            '<div class="card-accent ' + (up ? "accent-up" : "accent-down") + '"></div>' +

            // Top: ticker + price
            '<div class="card-top">' +
                '<div><div style="display:flex;align-items:center"><span class="card-ticker">' + f.ticker + '</span>' + badgeHtml + '</div>' +
                '<p class="card-sub">' + f.name + ' · ' + f.sector + '</p></div>' +
                '<div class="card-price"><div class="card-price__val">R$ ' + fmtBRL(f.price) + '</div>' +
                '<div class="card-chg ' + (up ? "chg-up" : "chg-down") + '">' + (up ? svgUp : svgDn) + ' ' + sign + f.change_pct.toFixed(2) + '%</div></div>' +
            '</div>' +

            // Mini chart
            '<div class="card-chart"><canvas id="' + id + '"></canvas></div>' +

            // Stats: DY, P/VP, Cresc 12M, Score
            '<div class="card-stats">' +
                '<div class="stat"><div class="stat-lbl">DY 12M</div><div class="stat-val ' + dyC + '">' + f.dy12m + '%</div></div>' +
                '<div class="stat"><div class="stat-lbl">P/VP</div><div class="stat-val ' + pvpC + '">' + f.pvp.toFixed(2) + '</div></div>' +
                '<div class="stat"><div class="stat-lbl">Cresc. 12M</div><div class="stat-val ' + growC + '">+' + f.growth_12m + '%</div></div>' +
                '<div class="stat"><div class="stat-lbl">Score ML</div><div class="stat-val ' + scoreC + '">' + f.score + '</div></div>' +
            '</div>' +

            // Dividendos
            '<div class="card-div">' +
                '<div class="card-div__title">💰 Dividendos</div>' +
                '<div class="card-div__row"><span class="card-div__label">Último dividendo</span><span class="card-div__value" style="color:var(--green)">R$ ' + d.last_dividend.toFixed(2) + '/cota</span></div>' +
                '<div class="card-div__row"><span class="card-div__label">Média mensal (12M)</span><span class="card-div__value">R$ ' + d.avg_dividend.toFixed(2) + '/cota</span></div>' +
                '<div class="card-div__row"><span class="card-div__label">Total acumulado 12M</span><span class="card-div__value">R$ ' + fmtBRL(d.total_12m) + '/cota</span></div>' +
                '<div class="card-div__row"><span class="card-div__label">Tendência</span><span class="card-div__value">' + d.div_trend_icon + ' ' + d.div_trend.charAt(0).toUpperCase() + d.div_trend.slice(1) + '</span></div>' +
            '</div>' +

            // Cotas para R$ 1.000/mês
            '<div class="card-mil">' +
                '<div class="card-mil__label">Cotas para R$ 1.000/mês</div>' +
                '<div class="card-mil__cotas">' + fmtInt(d.cotas_para_1000) + ' cotas</div>' +
                '<div class="card-mil__invest">Investimento: R$ ' + fmtBRL(d.investimento_para_1000) + '</div>' +
            '</div>';

        grid.appendChild(el);
        requestAnimationFrame(function() { drawMini(id, f.history, up); });
    });
}

function drawMini(id, hist, up) {
    var cv = document.getElementById(id); if (!cv) return;
    var ctx = cv.getContext("2d"), th = cTh(), color = up ? "#10b981" : "#ef4444";
    var grad = ctx.createLinearGradient(0, 0, 0, 65);
    grad.addColorStop(0, up ? "rgba(16,185,129,.22)" : "rgba(239,68,68,.22)"); grad.addColorStop(1, "transparent");
    charts[id] = new Chart(ctx, {
        type: "line",
        data: { labels: hist.map(function(h){return h.date;}), datasets: [{ data: hist.map(function(h){return h.price;}), borderColor: color, borderWidth: 2, backgroundColor: grad, fill: true, tension: .4, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: color }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: th.tipBg, borderColor: th.tipBdr, borderWidth: 1, titleColor: th.tick, bodyColor: th.tipTxt, cornerRadius: 10, padding: 10, displayColors: false, callbacks: { label: function(c){return "R$ "+c.raw.toFixed(2);} } } }, scales: { x: { display: false }, y: { display: false } }, interaction: { intersect: false, mode: "index" } }
    });
}

// ═══════════════════════════════════════════
//  INSIGHTS — FULL ML ANALYSIS (5 FIIs)
// ═══════════════════════════════════════════

function loadInsights() {
    var body = $("#ins-body");
    body.innerHTML = '<div class="loader"><div class="loader-ring"></div><h3>Processando análise com IA...</h3><p>Analisando indicadores, dividendos e projeções</p></div>';
    return apiGet("/api/insights")
        .then(function(data) { $("#ins-ts").textContent = data.timestamp; renderInsights(data); })
        .catch(function(err) {
            body.innerHTML = '<div class="loader"><h3 style="color:var(--red)">API Python offline</h3><p style="margin-top:10px;color:var(--t2)">' + err.message + '</p></div>';
        });
}

function renderInsights(data) {
    var body = $("#ins-body");
    var topInfo = data.analyses.find(function(a) { return a.ticker === data.top_pick; });
    var h = '';

    // Market + Top Pick
    h += '<div class="mkt-box"><h3>📊 Visão do Mercado</h3><p>' + data.market_overview + '</p></div>';
    h += '<div class="top-pick"><span style="font-size:22px">🏆</span><div><b>Top Pick: </b><strong>' + data.top_pick + '</strong><span class="sub"> — ' + (topInfo ? topInfo.name : '') + ' (Score ' + (topInfo ? topInfo.score : '') + ')</span></div></div>';

    // Each FII
    data.analyses.forEach(function(a, i) {
        var recCls = a.recommendation === "COMPRA" ? "rec-compra" : a.recommendation === "CAUTELA" ? "rec-cautela" : "rec-manter";
        var recCol = a.recommendation === "COMPRA" ? "var(--green)" : a.recommendation === "CAUTELA" ? "var(--red)" : "var(--yellow)";
        var hId = "ih-" + a.ticker, pId = "ip-" + a.ticker, dId = "id-" + a.ticker;
        var confCol = a.score > 75 ? "var(--green)" : a.score > 55 ? "var(--yellow)" : "var(--red)";
        var confGrad = a.score > 75 ? "linear-gradient(90deg,#10b981,#34d399)" : a.score > 55 ? "linear-gradient(90deg,#f59e0b,#fbbf24)" : "linear-gradient(90deg,#ef4444,#f87171)";
        var up6 = ((a.target_6m - a.current_price) / a.current_price * 100).toFixed(1);
        var up12 = ((a.target_12m - a.current_price) / a.current_price * 100).toFixed(1);
        var d = a.dividends;

        h += '<div class="ins-card">';

        // Header
        h += '<div class="ins-head"><div class="ins-title-row"><div class="ins-rank" style="background:' + recCol + '15;border:1px solid ' + recCol + '30;color:' + recCol + '">' + (i+1) + '</div><div class="ins-info"><h3>' + a.ticker;
        if (a.is_fixed) h += ' <span class="badge-s badge-fix">★ FIXO</span>';
        if (a.ticker === data.top_pick) h += ' <span class="badge-s badge-top">🏆 TOP</span>';
        h += '</h3><p>' + a.name + ' · ' + a.sector + ' · ' + a.admin + '</p></div></div>';
        h += '<div class="ins-price-blk"><div class="ins-price">R$ ' + fmtBRL(a.current_price) + '</div><span class="rec-badge ' + recCls + '">' + a.recommendation + '</span></div></div>';

        // Body
        h += '<div class="ins-body">';

        // WHY CHOOSE
        h += '<div class="why-box"><h4>🎯 Por que o ML selecionou este FII?</h4><ul class="why-list">';
        a.why_choose.forEach(function(reason) { h += '<li>' + reason + '</li>'; });
        h += '</ul></div>';

        // Score bar
        h += '<div class="conf-bar"><div class="conf-bar__top"><span class="conf-bar__lbl">Score de Confiança ML</span><span class="conf-bar__val" style="color:' + confCol + '">' + a.score + '/100</span></div><div class="conf-track"><div class="conf-fill" style="width:' + a.score + '%;background:' + confGrad + '"></div></div></div>';

        // Charts: historical + projection + dividend bars
        h += '<div class="charts-row">';
        h += '<div class="chart-panel"><h4>📈 Histórico 30 dias</h4><div class="chart-wrap"><canvas id="' + hId + '"></canvas></div></div>';
        h += '<div class="chart-panel"><h4>🎯 Projeção de Preço</h4><div class="chart-wrap"><canvas id="' + pId + '"></canvas></div></div>';
        h += '</div>';

        // Dividend chart
        h += '<div class="chart-panel" style="margin-bottom:20px"><h4>💰 Dividendos Mensais (últimos 12 meses)</h4><div class="chart-wrap"><canvas id="' + dId + '"></canvas></div></div>';

        // Growth + Risks + Dividend Explanation
        h += '<div class="ins-grid">';
        h += '<div class="ins-box" style="border-left-color:var(--blue)"><h5 style="color:var(--blue)">📊 Crescimento 12 Meses (' + (a.growth_12m >= 0 ? '+' : '') + a.growth_12m + '%)</h5><p>' + a.growth_analysis + '</p></div>';
        h += '<div class="ins-box" style="border-left-color:var(--yellow)"><h5 style="color:var(--yellow)">⚠️ Riscos</h5><p>' + a.risks + '</p></div>';
        h += '</div>';

        // Full dividend explanation
        h += '<div class="ins-box" style="border-left-color:var(--green);margin-bottom:20px"><h5 style="color:var(--green)">💰 Análise de Dividendos</h5><p>' + a.dividend_explanation + '</p></div>';

        // Dividend calculator
        h += '<div class="div-calc"><div class="div-calc__title">🧮 Simulação: R$ 1.000/mês em dividendos</div><div class="div-calc__row">';
        h += '<div class="div-calc__item"><div class="div-calc__label">Cotas necessárias</div><div class="div-calc__value">' + fmtInt(d.cotas_para_1000) + '</div><div class="div-calc__sub">cotas de ' + a.ticker + '</div></div>';
        h += '<div class="div-calc__item"><div class="div-calc__label">Investimento total</div><div class="div-calc__value">R$ ' + fmtBRL(d.investimento_para_1000) + '</div><div class="div-calc__sub">a R$ ' + fmtBRL(a.current_price) + '/cota</div></div>';
        h += '<div class="div-calc__item"><div class="div-calc__label">Último dividendo</div><div class="div-calc__value">R$ ' + d.last_dividend.toFixed(2) + '</div><div class="div-calc__sub">por cota/mês</div></div>';
        h += '<div class="div-calc__item"><div class="div-calc__label">Tendência</div><div class="div-calc__value">' + d.div_trend_icon + '</div><div class="div-calc__sub">' + d.div_trend + '</div></div>';
        h += '</div></div>';

        // Targets
        h += '<div class="targets">';
        h += '<div class="tgt tgt-6"><div class="tgt-lbl">Alvo 6 meses</div><div class="tgt-price">R$ ' + fmtBRL(a.target_6m) + '</div><div class="tgt-chg">+' + up6 + '%</div></div>';
        h += '<div class="tgt tgt-12"><div class="tgt-lbl">Alvo 12 meses</div><div class="tgt-price">R$ ' + fmtBRL(a.target_12m) + '</div><div class="tgt-chg">+' + up12 + '%</div></div>';
        h += '</div>';

        h += '</div></div>'; // ins-body, ins-card
    });

    h += '<div class="disclaimer">⚠️ Esta análise é gerada por inteligência artificial e não constitui recomendação de investimento. Consulte um assessor financeiro. Dados de ' + data.total_funds_analyzed + ' FIIs analisados pelo algoritmo.</div>';
    body.innerHTML = h;

    // Draw charts
    requestAnimationFrame(function() {
        data.analyses.forEach(function(a) {
            drawHistorical("ih-" + a.ticker, a.history, a.target_12m > a.current_price);
            drawProjection("ip-" + a.ticker, a.current_price, a.target_6m, a.target_12m);
            drawDividendBars("id-" + a.ticker, a.dividends.div_history);
        });
    });
}

function drawHistorical(id, hist, up) {
    var cv = document.getElementById(id); if (!cv) return;
    var ctx = cv.getContext("2d"), th = cTh(), color = up ? "#10b981" : "#ef4444";
    var grad = ctx.createLinearGradient(0, 0, 0, 140);
    grad.addColorStop(0, up ? "rgba(16,185,129,.18)" : "rgba(239,68,68,.18)"); grad.addColorStop(1, "transparent");
    charts[id] = new Chart(ctx, {
        type: "line",
        data: { labels: hist.map(function(h){return h.date;}), datasets: [{ data: hist.map(function(h){return h.price;}), borderColor: color, borderWidth: 2, backgroundColor: grad, fill: true, tension: .4, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: color }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: th.tipBg, borderColor: th.tipBdr, borderWidth: 1, titleColor: th.tick, bodyColor: th.tipTxt, cornerRadius: 10, padding: 10, displayColors: false, callbacks: { label: function(c){return "R$ "+c.raw.toFixed(2);} } } }, scales: { x: { grid:{color:th.grid}, ticks:{color:th.tick,font:{size:10},maxTicksLimit:6} }, y: { grid:{color:th.grid}, ticks:{color:th.tick,font:{size:10},callback:function(v){return v.toFixed(0);}} } }, interaction: { intersect: false, mode: "index" } }
    });
}

function drawProjection(id, cur, t6, t12) {
    var cv = document.getElementById(id); if (!cv) return;
    var ctx = cv.getContext("2d"), th = cTh();
    charts[id] = new Chart(ctx, {
        type: "bar",
        data: { labels: ["Atual", "6 meses", "12 meses"], datasets: [{ data: [cur, t6, t12], backgroundColor: ["#3b82f6", "#8b5cf6", "#10b981"], borderRadius: 8, borderSkipped: false, barPercentage: .55 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: th.tipBg, borderColor: th.tipBdr, borderWidth: 1, titleColor: th.tick, bodyColor: th.tipTxt, cornerRadius: 10, padding: 10, displayColors: false, callbacks: { label: function(c){return "R$ "+c.raw.toFixed(2);} } } }, scales: { x: { grid:{display:false}, ticks:{color:th.tick,font:{size:11}} }, y: { grid:{color:th.grid}, ticks:{color:th.tick,font:{size:10},callback:function(v){return v.toFixed(2);}}, beginAtZero: false } } }
    });
}

function drawDividendBars(id, divHist) {
    var cv = document.getElementById(id); if (!cv) return;
    var ctx = cv.getContext("2d"), th = cTh();
    var months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    // Determine colors based on trend
    var colors = divHist.map(function(v, i) {
        if (i === 0) return "#3b82f6";
        return v >= divHist[i-1] ? "#10b981" : "#ef4444";
    });
    charts[id] = new Chart(ctx, {
        type: "bar",
        data: { labels: months, datasets: [{ data: divHist, backgroundColor: colors, borderRadius: 5, borderSkipped: false, barPercentage: .7 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: th.tipBg, borderColor: th.tipBdr, borderWidth: 1, titleColor: th.tick, bodyColor: th.tipTxt, cornerRadius: 10, padding: 10, displayColors: false, callbacks: { label: function(c){return "R$ "+c.raw.toFixed(2)+"/cota";} } } }, scales: { x: { grid:{display:false}, ticks:{color:th.tick,font:{size:10}} }, y: { grid:{color:th.grid}, ticks:{color:th.tick,font:{size:10},callback:function(v){return "R$"+v.toFixed(2);}}, beginAtZero: false } } }
    });
}

// ═══ INIT ═══
document.addEventListener("DOMContentLoaded", function() {
    $("#login-form").addEventListener("submit", handleLogin);
    $("#eye-btn").addEventListener("click", function() {
        var inp = $("#inp-pass"), show = inp.type === "password";
        inp.type = show ? "text" : "password";
        $(".eye-open").style.display = show ? "none" : "block";
        $(".eye-closed").style.display = show ? "block" : "none";
    });
    $$(".tab").forEach(function(t) { t.addEventListener("click", function() { if (t.dataset.page) switchPage(t.dataset.page); }); });
    $("#theme-btn").addEventListener("click", toggleTheme);
    var tmM = $("#theme-btn-m"); if (tmM) tmM.addEventListener("click", toggleTheme);
    $("#logout-btn").addEventListener("click", logout);
    var lgM = $("#logout-btn-m"); if (lgM) lgM.addEventListener("click", logout);
    $("#burger").addEventListener("click", function() { $("#burger").classList.toggle("open"); $("#mobile-drop").classList.toggle("open"); });
    $("#refresh-dash").addEventListener("click", function() {
        var b = this; b.classList.add("spinning"); b.disabled = true; destroyAllCharts();
        loadDashboard().finally(function() { b.classList.remove("spinning"); b.disabled = false; });
    });
    $("#refresh-ins").addEventListener("click", function() {
        var b = this; b.classList.add("spinning"); b.disabled = true; destroyAllCharts();
        loadInsights().finally(function() { b.classList.remove("spinning"); b.disabled = false; });
    });
});