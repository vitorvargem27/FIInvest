/**
 * FIIInvest v3 — Frontend
 * MXRF11 fixo + Top 4 por ML v3 (11 fatores)
 * Compatível com backend v2 e v3
 */

// ══════════════════════════════════════════════════════════
// IMPORTANTE: Substitua pela URL real do seu backend Koyeb
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

// ═══ SAFE ACCESS HELPERS ═══
// Garantem compatibilidade entre backend v2 (sem risk_level, sharpe, etc) e v3
function safeRisk(obj) {
    if (obj && obj.risk_level && typeof obj.risk_level === "object") return obj.risk_level;
    return { level: "N/D", color: "yellow", score: 0, icon: "⚪" };
}
function safeSharpe(obj) {
    if (obj && typeof obj.sharpe_ratio === "number") return obj.sharpe_ratio;
    return 0;
}
function safeRating(obj) {
    if (obj && obj.rating_gestora) return obj.rating_gestora;
    return "N/D";
}
function safeRec(obj) {
    if (obj && obj.recommendation) return obj.recommendation;
    // Fallback: calcular do score (lógica v2)
    if (obj && typeof obj.score === "number") {
        if (obj.score >= 75) return "COMPRA";
        if (obj.score >= 55) return "MANTER";
        return "CAUTELA";
    }
    return "MANTER";
}
function safePatrimonio(obj) {
    if (obj && typeof obj.patrimonio === "number") return obj.patrimonio;
    return 0;
}

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
            text.textContent = "✓ ML Engine online";
            setTimeout(function() { bar.classList.add("hidden-bar"); }, 4000);
        })
        .catch(function() {
            bar.className = "conn-bar offline";
            text.textContent = "✗ API offline — Servidor indisponível";
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
        grid: isDark ? "rgba(20,40,75,.18)" : "rgba(180,200,225,.35)",
        tick: isDark ? "#3d4f6a" : "#8e9bb2",
        tipBg: isDark ? "#0a1018" : "#ffffff",
        tipBdr: isDark ? "#1a2a48" : "#e0e7f0",
        tipTxt: isDark ? "#e8edf5" : "#0c1322"
    };
}
function fmtBRL(v) { return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtInt(v) { return v.toLocaleString("pt-BR"); }
function fmtPat(v) {
    if (v >= 1e9) return "R$ " + (v / 1e9).toFixed(1) + " bi";
    if (v >= 1e6) return "R$ " + (v / 1e6).toFixed(0) + " mi";
    if (v > 0) return "R$ " + fmtBRL(v);
    return "N/D";
}

var svgUp = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>';
var svgDn = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>';

function recClass(rec) {
    if (!rec) return "manter";
    var r = rec.toUpperCase();
    if (r === "COMPRA FORTE") return "compra-forte";
    if (r === "COMPRA") return "compra";
    if (r === "MANTER") return "manter";
    if (r === "CAUTELA") return "cautela";
    if (r === "VENDA") return "venda";
    return "manter";
}

function riskColorClass(risk) {
    if (!risk) return "c-yellow";
    var c = risk.color || "";
    if (c === "green") return "c-green";
    if (c === "red") return "c-red";
    return "c-yellow";
}

function riskColorVar(risk) {
    if (!risk) return "var(--yellow)";
    var c = risk.color || "";
    if (c === "green") return "var(--green)";
    if (c === "red") return "var(--red)";
    return "var(--yellow)";
}

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

// ═══ MACRO STRIP ═══
function renderMacroStrip(macro) {
    var strip = $("#macro-strip");
    if (!macro || !macro.selic) { strip.innerHTML = ""; return; }
    strip.innerHTML =
        '<div class="macro-chip macro-chip--neutral"><span class="macro-chip__label">SELIC</span><span class="macro-chip__value">' + macro.selic + '%</span></div>' +
        '<div class="macro-chip macro-chip--' + (macro.ipca > 5 ? 'down' : 'up') + '"><span class="macro-chip__label">IPCA 12M</span><span class="macro-chip__value">' + macro.ipca + '%</span></div>' +
        '<div class="macro-chip macro-chip--' + (macro.ifix_ytd >= 0 ? 'up' : 'down') + '"><span class="macro-chip__label">IFIX YTD</span><span class="macro-chip__value">+' + macro.ifix_ytd + '%</span></div>' +
        '<div class="macro-chip macro-chip--' + (macro.ifix_12m >= 0 ? 'up' : 'down') + '"><span class="macro-chip__label">IFIX 12M</span><span class="macro-chip__value">+' + macro.ifix_12m + '%</span></div>' +
        '<div class="macro-chip macro-chip--up"><span class="macro-chip__label">PIB</span><span class="macro-chip__value">+' + macro.pib + '%</span></div>' +
        '<div class="macro-chip macro-chip--neutral"><span class="macro-chip__label">Desemprego</span><span class="macro-chip__value">' + macro.desemprego + '%</span></div>';
}

// ═══════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════

function loadDashboard() {
    var grid = $("#grid-cards");
    grid.innerHTML = '<div class="loader" style="grid-column:1/-1"><div class="loader-ring"></div><h3>Carregando fundos...</h3><p>Buscando os melhores FIIs por score ML</p></div>';
    return apiGet("/api/dashboard")
        .then(function(data) {
            $("#dash-ts").textContent = data.timestamp;
            renderMacroStrip(data.macro || null);
            renderCards(data.funds);
        })
        .catch(function(err) {
            grid.innerHTML = '<div class="loader" style="grid-column:1/-1"><h3 style="color:var(--red)">API Python offline</h3><p style="margin-top:10px;color:var(--t2)">' + err.message + '</p></div>';
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

        var dyC = f.dy12m > 10 ? "c-green" : f.dy12m > 8 ? "c-cyan" : "c-yellow";
        var pvpC = f.pvp < 1 ? "c-green" : f.pvp > 1.05 ? "c-red" : "c-yellow";
        var growC = f.growth_12m >= 8 ? "c-green" : f.growth_12m >= 4 ? "c-cyan" : "c-yellow";
        var scoreC = f.score >= 75 ? "c-green" : f.score >= 55 ? "c-yellow" : "c-red";

        // Safe access for v3 fields
        var risk = safeRisk(f);
        var rC = riskColorClass(risk);
        var sharpe = safeSharpe(f);
        var sharpeC = sharpe > 0.5 ? "c-green" : sharpe > 0 ? "c-yellow" : "c-red";
        var rating = safeRating(f);
        var rec = safeRec(f);
        var rc = recClass(rec);

        var badgeHtml = "";
        if (f.is_fixed) badgeHtml = '<span class="badge badge-fixed">★ FIXO</span>';
        else if (f.rank) badgeHtml = '<span class="badge badge-rank">#' + f.rank + ' ML</span>';

        var el = document.createElement("div");
        el.className = "card anim-up";
        el.style.animationDelay = (i * 0.06) + "s";
        el.innerHTML =
            '<div class="card-accent ' + (up ? "accent-up" : "accent-down") + '"></div>' +
            '<div class="card-top">' +
                '<div><div style="display:flex;align-items:center"><span class="card-ticker">' + f.ticker + '</span>' + badgeHtml + '</div>' +
                '<p class="card-sub">' + f.name + ' · ' + f.sector + '</p></div>' +
                '<div class="card-price"><div class="card-price__val">R$ ' + fmtBRL(f.price) + '</div>' +
                '<div class="card-chg ' + (up ? "chg-up" : "chg-down") + '">' + (up ? svgUp : svgDn) + ' ' + sign + f.change_pct.toFixed(2) + '%</div></div>' +
            '</div>' +

            '<div class="card-chart"><canvas id="' + id + '"></canvas></div>' +

            // Risk + Sharpe + Rating row
            '<div class="card-risk-row">' +
                '<div class="card-risk-item"><div class="card-risk-item__label">Risco</div><div class="card-risk-item__value ' + rC + '">' + risk.icon + ' ' + risk.level + '</div></div>' +
                '<div class="card-risk-item"><div class="card-risk-item__label">Sharpe</div><div class="card-risk-item__value ' + sharpeC + '">' + sharpe.toFixed(2) + '</div></div>' +
                '<div class="card-risk-item"><div class="card-risk-item__label">Gestora</div><div class="card-risk-item__value c-cyan">' + rating + '</div></div>' +
            '</div>' +

            // Stats
            '<div class="card-stats">' +
                '<div class="stat"><div class="stat-lbl">DY 12M</div><div class="stat-val ' + dyC + '">' + f.dy12m + '%</div></div>' +
                '<div class="stat"><div class="stat-lbl">P/VP</div><div class="stat-val ' + pvpC + '">' + f.pvp.toFixed(2) + '</div></div>' +
                '<div class="stat"><div class="stat-lbl">Cresc. 12M</div><div class="stat-val ' + growC + '">+' + f.growth_12m + '%</div></div>' +
                '<div class="stat"><div class="stat-lbl">Score ML</div><div class="stat-val ' + scoreC + '">' + f.score + '</div></div>' +
            '</div>' +

            // Recommendation badge
            '<div class="card-rec card-rec--' + rc + '">' + rec + '</div>' +

            // Dividendos
            '<div class="card-div">' +
                '<div class="card-div__title">💰 Dividendos</div>' +
                '<div class="card-div__row"><span class="card-div__label">Último dividendo</span><span class="card-div__value" style="color:var(--green)">R$ ' + d.last_dividend.toFixed(2) + '/cota</span></div>' +
                '<div class="card-div__row"><span class="card-div__label">Média mensal (12M)</span><span class="card-div__value">R$ ' + d.avg_dividend.toFixed(2) + '/cota</span></div>' +
                '<div class="card-div__row"><span class="card-div__label">Total acumulado 12M</span><span class="card-div__value">R$ ' + fmtBRL(d.total_12m) + '/cota</span></div>' +
                '<div class="card-div__row"><span class="card-div__label">Tendência</span><span class="card-div__value">' + d.div_trend_icon + ' ' + d.div_trend.charAt(0).toUpperCase() + d.div_trend.slice(1) + '</span></div>' +
            '</div>' +

            '<div class="card-mil">' +
                '<div class="card-mil__label">Cotas para R$ 1.000/mês</div>' +
                '<div class="card-mil__cotas">' + fmtInt(d.cotas_para_1000) + ' cotas</div>' +
                '<div class="card-mil__invest">Invest: R$ ' + fmtBRL(d.investimento_para_1000) + '</div>' +
            '</div>';

        grid.appendChild(el);
        requestAnimationFrame(function() { drawMini(id, f.history, up); });
    });
}

function drawMini(id, hist, up) {
    var cv = document.getElementById(id); if (!cv) return;
    var ctx = cv.getContext("2d"), th = cTh(), color = up ? "#10b981" : "#ef4444";
    var grad = ctx.createLinearGradient(0, 0, 0, 60);
    grad.addColorStop(0, up ? "rgba(16,185,129,.18)" : "rgba(239,68,68,.18)"); grad.addColorStop(1, "transparent");
    charts[id] = new Chart(ctx, {
        type: "line",
        data: { labels: hist.map(function(h){return h.date;}), datasets: [{ data: hist.map(function(h){return h.price;}), borderColor: color, borderWidth: 1.5, backgroundColor: grad, fill: true, tension: .4, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: color }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: th.tipBg, borderColor: th.tipBdr, borderWidth: 1, titleColor: th.tick, bodyColor: th.tipTxt, titleFont:{family:"JetBrains Mono",size:10}, bodyFont:{family:"JetBrains Mono",size:11}, cornerRadius: 8, padding: 8, displayColors: false, callbacks: { label: function(c){return "R$ "+c.raw.toFixed(2);} } } }, scales: { x: { display: false }, y: { display: false } }, interaction: { intersect: false, mode: "index" } }
    });
}

// ═══════════════════════════════════════════
//  INSIGHTS
// ═══════════════════════════════════════════

function loadInsights() {
    var body = $("#ins-body");
    body.innerHTML = '<div class="loader"><div class="loader-ring"></div><h3>Processando análise ML...</h3><p>Analisando indicadores, dividendos e projeções</p></div>';
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

    // Macro overview (v3 only)
    if (data.macro && data.macro.selic) {
        var m = data.macro;
        h += '<div class="macro-overview"><h3>📊 Cenário Macroeconômico</h3>';
        h += '<p>' + (m.selic_analysis || '') + '</p>';
        if (m.summary) h += '<p style="margin-top:8px">' + m.summary + '</p>';
        h += '<div class="macro-grid">';
        h += '<div class="macro-item"><div class="macro-item__label">SELIC</div><div class="macro-item__value c-cyan">' + m.selic + '%</div></div>';
        h += '<div class="macro-item"><div class="macro-item__label">IPCA 12M</div><div class="macro-item__value c-yellow">' + m.ipca + '%</div></div>';
        h += '<div class="macro-item"><div class="macro-item__label">IFIX 12M</div><div class="macro-item__value c-green">+' + m.ifix_12m + '%</div></div>';
        h += '<div class="macro-item"><div class="macro-item__label">PIB</div><div class="macro-item__value c-green">+' + m.pib + '%</div></div>';
        h += '</div></div>';
    }

    // Market overview
    h += '<div class="mkt-box"><h3>🧠 Visão do Mercado</h3><p>' + data.market_overview + '</p></div>';

    // Diversification (v3 only)
    if (data.diversification) {
        var dv = data.diversification;
        h += '<div class="diversification-box ' + (dv.is_diversified ? 'good' : 'warn') + '">';
        h += '<span class="div-icon">' + (dv.is_diversified ? '✅' : '⚠️') + '</span>';
        h += '<div class="div-text"><strong>Diversificação: </strong>' + dv.comment + '</div></div>';
    }

    // Top Pick
    h += '<div class="top-pick"><span style="font-size:20px">🏆</span><div><b>Top Pick: </b><strong>' + data.top_pick + '</strong><span class="sub"> — ' + (topInfo ? topInfo.name : '') + ' (Score ' + (topInfo ? topInfo.score : '') + ')</span></div></div>';

    // Each FII
    data.analyses.forEach(function(a, i) {
        var rec = safeRec(a);
        var rc = recClass(rec);
        var recCol = rec.indexOf("COMPRA") >= 0 ? "var(--green)" : (rec === "CAUTELA" || rec === "VENDA") ? "var(--red)" : "var(--yellow)";
        var hId = "ih-" + a.ticker, pId = "ip-" + a.ticker, dId = "id-" + a.ticker;
        var confCol = a.score > 75 ? "var(--green)" : a.score > 55 ? "var(--yellow)" : "var(--red)";
        var confGrad = a.score > 75 ? "linear-gradient(90deg,#10b981,#34d399)" : a.score > 55 ? "linear-gradient(90deg,#f59e0b,#fbbf24)" : "linear-gradient(90deg,#ef4444,#f87171)";
        var up6 = ((a.target_6m - a.current_price) / a.current_price * 100).toFixed(1);
        var up12 = ((a.target_12m - a.current_price) / a.current_price * 100).toFixed(1);
        var d = a.dividends;

        // Safe access for v3 fields
        var risk = safeRisk(a);
        var sharpe = safeSharpe(a);
        var patrimonio = safePatrimonio(a);

        h += '<div class="ins-card">';

        // Header
        h += '<div class="ins-head"><div class="ins-title-row"><div class="ins-rank" style="background:' + recCol + '15;border:1px solid ' + recCol + '30;color:' + recCol + '">' + (i+1) + '</div><div class="ins-info"><h3>' + a.ticker;
        if (a.is_fixed) h += ' <span class="badge-s badge-fix">★ FIXO</span>';
        if (a.ticker === data.top_pick) h += ' <span class="badge-s badge-top">🏆 TOP</span>';
        h += '</h3><p>' + a.name + ' · ' + a.sector + ' · ' + a.admin + '</p></div></div>';
        h += '<div class="ins-price-blk"><div class="ins-price">R$ ' + fmtBRL(a.current_price) + '</div><span class="rec-badge rec-' + rc + '">' + rec + '</span></div></div>';

        // Body
        h += '<div class="ins-body">';

        // Score breakdown (v3 only)
        if (a.score_breakdown) {
            var sb = a.score_breakdown;
            h += '<div class="conf-bar"><div class="conf-bar__top"><span class="conf-bar__lbl">Score de Confiança ML v3</span><span class="conf-bar__val" style="color:' + confCol + '">' + a.score + '/100</span></div><div class="conf-track"><div class="conf-fill" style="width:' + a.score + '%;background:' + confGrad + '"></div></div></div>';

            h += '<div class="score-breakdown">';
            var sbKeys = Object.keys(sb);
            sbKeys.forEach(function(key) {
                var item = sb[key];
                if (!item || typeof item.score !== "number") return;
                var fillCol = item.score >= 75 ? "#10b981" : item.score >= 55 ? "#f59e0b" : "#ef4444";
                var scoreCol = item.score >= 75 ? "c-green" : item.score >= 55 ? "c-yellow" : "c-red";
                h += '<div class="sb-item">';
                h += '<div class="sb-item__top"><span class="sb-item__label">' + (item.label || key) + '</span><span class="sb-item__score ' + scoreCol + '">' + item.score + '</span></div>';
                h += '<div class="sb-item__bar"><div class="sb-item__fill" style="width:' + item.score + '%;background:' + fillCol + '"></div></div>';
                h += '</div>';
            });
            h += '</div>';
        } else {
            // v2 fallback: simple score bar
            h += '<div class="conf-bar"><div class="conf-bar__top"><span class="conf-bar__lbl">Score de Confiança ML</span><span class="conf-bar__val" style="color:' + confCol + '">' + a.score + '/100</span></div><div class="conf-track"><div class="conf-fill" style="width:' + a.score + '%;background:' + confGrad + '"></div></div></div>';
        }

        // Risk + Sharpe + Patrimônio (show for both v2/v3 with safe defaults)
        h += '<div class="ins-grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:18px">';
        var rC2 = riskColorClass(risk);
        var rCV = riskColorVar(risk);
        h += '<div class="ins-box" style="border-left-color:' + rCV + '"><h5>' + risk.icon + ' Nível de Risco</h5><p style="font-size:18px;font-weight:800" class="' + rC2 + '">' + risk.level + '</p></div>';
        var sharpeCol = sharpe > 0.5 ? "var(--green)" : sharpe > 0 ? "var(--yellow)" : "var(--red)";
        h += '<div class="ins-box" style="border-left-color:' + sharpeCol + '"><h5>📐 Sharpe Ratio</h5><p style="font-size:18px;font-weight:800;font-family:var(--mono);color:' + sharpeCol + '">' + sharpe.toFixed(2) + '</p></div>';
        h += '<div class="ins-box" style="border-left-color:var(--cyan)"><h5>🏛️ Patrimônio</h5><p style="font-size:18px;font-weight:800;color:var(--cyan);font-family:var(--mono)">' + fmtPat(patrimonio) + '</p></div>';
        h += '</div>';

        // Sector outlook (v3 only)
        if (a.sector_outlook && a.sector_outlook.driver) {
            var outCol = a.sector_outlook.outlook === "positivo" ? "var(--green)" : (a.sector_outlook.outlook || "").indexOf("neutro") >= 0 ? "var(--yellow)" : "var(--red)";
            h += '<div class="sector-box" style="border-left-color:' + outCol + '"><h5>🏗️ Perspectiva: ' + a.sector + ' (' + a.sector_outlook.outlook + ')</h5>';
            h += '<p>' + a.sector_outlook.driver + '</p></div>';
        }

        // WHY CHOOSE
        if (a.why_choose && a.why_choose.length > 0) {
            h += '<div class="why-box"><h4>🎯 Por que o ML selecionou este FII?</h4><ul class="why-list">';
            a.why_choose.forEach(function(reason) { h += '<li>' + reason + '</li>'; });
            h += '</ul></div>';
        }

        // Charts
        h += '<div class="charts-row">';
        h += '<div class="chart-panel"><h4>📈 Histórico 30 dias</h4><div class="chart-wrap"><canvas id="' + hId + '"></canvas></div></div>';
        h += '<div class="chart-panel"><h4>🎯 Projeção de Preço</h4><div class="chart-wrap"><canvas id="' + pId + '"></canvas></div></div>';
        h += '</div>';

        // Dividend chart
        h += '<div class="chart-panel" style="margin-bottom:18px"><h4>💰 Dividendos Mensais (últimos 12 meses)</h4><div class="chart-wrap"><canvas id="' + dId + '"></canvas></div></div>';

        // Risk analysis (v3 only — a.risks is an array of objects in v3)
        if (a.risks && Array.isArray(a.risks) && a.risks.length > 0 && typeof a.risks[0] === "object") {
            h += '<div class="risk-grid">';
            a.risks.forEach(function(rk) {
                if (!rk || !rk.category) return;
                h += '<div class="risk-item risk-item--' + (rk.level || 'Moderado') + '">';
                h += '<div class="risk-item__head"><span class="risk-item__cat">' + rk.category + '</span><span class="risk-item__level risk-item__level--' + (rk.level || 'Moderado') + '">' + (rk.level || 'N/D') + '</span></div>';
                h += '<div class="risk-item__text">' + (rk.text || '') + '</div>';
                h += '</div>';
            });
            h += '</div>';
        } else if (a.risks && typeof a.risks === "string") {
            // v2 fallback: risks is a single string
            h += '<div class="ins-box" style="border-left-color:var(--yellow);margin-bottom:18px"><h5 style="color:var(--yellow)">⚠️ Riscos</h5><p>' + a.risks + '</p></div>';
        }

        // Growth + Dividend explanation
        h += '<div class="ins-grid">';
        if (a.growth_analysis) {
            h += '<div class="ins-box" style="border-left-color:var(--cyan)"><h5 style="color:var(--cyan)">📊 Crescimento 12M (' + (a.growth_12m >= 0 ? '+' : '') + a.growth_12m + '%)</h5><p>' + a.growth_analysis + '</p></div>';
        }
        if (a.dividend_explanation) {
            h += '<div class="ins-box" style="border-left-color:var(--green)"><h5 style="color:var(--green)">💰 Análise de Dividendos</h5><p>' + a.dividend_explanation + '</p></div>';
        }
        h += '</div>';

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

    h += '<div class="disclaimer">⚠️ <strong>AVISO LEGAL:</strong> Esta análise é gerada por inteligência artificial e algoritmos quantitativos. <strong>Não constitui recomendação de investimento.</strong> Rentabilidade passada não garante resultados futuros. Consulte um assessor financeiro certificado antes de investir. Dados de ' + data.total_funds_analyzed + ' FIIs analisados.</div>';
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
    var grad = ctx.createLinearGradient(0, 0, 0, 130);
    grad.addColorStop(0, up ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)"); grad.addColorStop(1, "transparent");
    charts[id] = new Chart(ctx, {
        type: "line",
        data: { labels: hist.map(function(h){return h.date;}), datasets: [{ data: hist.map(function(h){return h.price;}), borderColor: color, borderWidth: 1.5, backgroundColor: grad, fill: true, tension: .4, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: color }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: th.tipBg, borderColor: th.tipBdr, borderWidth: 1, titleColor: th.tick, bodyColor: th.tipTxt, titleFont:{family:"JetBrains Mono",size:10}, bodyFont:{family:"JetBrains Mono",size:11}, cornerRadius: 8, padding: 8, displayColors: false, callbacks: { label: function(c){return "R$ "+c.raw.toFixed(2);} } } }, scales: { x: { grid:{color:th.grid}, ticks:{color:th.tick,font:{size:9,family:"JetBrains Mono"},maxTicksLimit:6} }, y: { grid:{color:th.grid}, ticks:{color:th.tick,font:{size:9,family:"JetBrains Mono"},callback:function(v){return v.toFixed(0);}} } }, interaction: { intersect: false, mode: "index" } }
    });
}

function drawProjection(id, cur, t6, t12) {
    var cv = document.getElementById(id); if (!cv) return;
    var ctx = cv.getContext("2d"), th = cTh();
    charts[id] = new Chart(ctx, {
        type: "bar",
        data: { labels: ["Atual", "6 meses", "12 meses"], datasets: [{ data: [cur, t6, t12], backgroundColor: ["#0ea5e9", "#8b5cf6", "#10b981"], borderRadius: 6, borderSkipped: false, barPercentage: .5 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: th.tipBg, borderColor: th.tipBdr, borderWidth: 1, titleColor: th.tick, bodyColor: th.tipTxt, titleFont:{family:"JetBrains Mono",size:10}, bodyFont:{family:"JetBrains Mono",size:11}, cornerRadius: 8, padding: 8, displayColors: false, callbacks: { label: function(c){return "R$ "+c.raw.toFixed(2);} } } }, scales: { x: { grid:{display:false}, ticks:{color:th.tick,font:{size:10,family:"DM Sans"}} }, y: { grid:{color:th.grid}, ticks:{color:th.tick,font:{size:9,family:"JetBrains Mono"},callback:function(v){return v.toFixed(2);}}, beginAtZero: false } } }
    });
}

function drawDividendBars(id, divHist) {
    var cv = document.getElementById(id); if (!cv) return;
    var ctx = cv.getContext("2d"), th = cTh();
    var months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    var colors = divHist.map(function(v, i) {
        if (i === 0) return "#0ea5e9";
        return v >= divHist[i-1] ? "#10b981" : "#ef4444";
    });
    charts[id] = new Chart(ctx, {
        type: "bar",
        data: { labels: months, datasets: [{ data: divHist, backgroundColor: colors, borderRadius: 4, borderSkipped: false, barPercentage: .65 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: th.tipBg, borderColor: th.tipBdr, borderWidth: 1, titleColor: th.tick, bodyColor: th.tipTxt, titleFont:{family:"JetBrains Mono",size:10}, bodyFont:{family:"JetBrains Mono",size:11}, cornerRadius: 8, padding: 8, displayColors: false, callbacks: { label: function(c){return "R$ "+c.raw.toFixed(2)+"/cota";} } } }, scales: { x: { grid:{display:false}, ticks:{color:th.tick,font:{size:9,family:"DM Sans"}} }, y: { grid:{color:th.grid}, ticks:{color:th.tick,font:{size:9,family:"JetBrains Mono"},callback:function(v){return "R$"+v.toFixed(2);}}, beginAtZero: false } } }
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