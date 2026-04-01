/**
 * FIIInvest v4 — Frontend
 * MXRF11 + Top 10 · Insights por Categoria · Google Auth
 */

// Para teste local: "http://localhost:5000"
// Para produção (Koyeb): "https://direct-nady-fiinvest-f4173ed0.koyeb.app"
var API_URL = "http://localhost:5000";

// ══════════════════════════════════════════════════
//  GOOGLE AUTH — CONFIGURAÇÃO
//  Substitua pelo seu Client ID do Google Cloud Console
// ══════════════════════════════════════════════════
var GOOGLE_CLIENT_ID = "756693315955-d8hmv61t47vr77ekt3rgt61hqg2jhe1n.apps.googleusercontent.com";

// ══════════════════════════════════════════════════
//  LISTA DE EMAILS AUTORIZADOS (GOOGLE AUTH)
//  ➜ ADICIONE AQUI os emails que podem acessar a plataforma
// ══════════════════════════════════════════════════
var ALLOWED_GOOGLE_EMAILS = [
    "vitorvargem27@gmail.com",
    "anabeatriz27250@gmail.com",
    "gustavovargem2@gmail.com"
    // Adicione mais emails conforme necessário
];

var REGISTERED_USERS = [
    { username: "vitorvargem",  password: "Vvjb1234#",  displayName: "Vítor Vargem" },
    { username: "AnaBeatriz",   password: "AB27250#",    displayName: "Ana Beatriz"  },
    { username: "gustuchiha",   password: "gustavo2004", displayName: "Gustavo"      },
];

var currentUser=null,currentPage="dashboard",isDark=true,charts={},currentInsightsCat="todos";
function $(s){return document.querySelector(s)}function $$(s){return document.querySelectorAll(s)}

function safeRisk(o){return o&&o.risk_level&&typeof o.risk_level==="object"?o.risk_level:{level:"N/D",color:"yellow",score:0,icon:"⚪"}}
function safeSharpe(o){return o&&typeof o.sharpe_ratio==="number"?o.sharpe_ratio:0}
function safeRating(o){return o&&o.rating_gestora?o.rating_gestora:"N/D"}
function safeRec(o){if(o&&o.recommendation)return o.recommendation;if(o&&typeof o.score==="number"){if(o.score>=75)return"COMPRA";if(o.score>=55)return"MANTER";return"CAUTELA"}return"MANTER"}
function safePatrimonio(o){return o&&typeof o.patrimonio==="number"?o.patrimonio:0}

function apiGet(ep){return fetch(API_URL+ep,{method:"GET",headers:{"Accept":"application/json"}}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json()})}
function checkApiConnection(){var b=$("#conn-bar"),t=$("#conn-text");apiGet("/api/health").then(function(){b.className="conn-bar online";t.textContent="✓ ML Engine v4 online";setTimeout(function(){b.classList.add("hidden-bar")},4000)}).catch(function(){b.className="conn-bar offline";t.textContent="✗ API offline";setTimeout(checkApiConnection,5000)})}
function destroyAllCharts(){Object.values(charts).forEach(function(c){try{c.destroy()}catch(e){}});charts={}}
function cTh(){return{grid:isDark?"rgba(20,40,75,.18)":"rgba(180,200,225,.35)",tick:isDark?"#3d4f6a":"#8e9bb2",tipBg:isDark?"#0a1018":"#ffffff",tipBdr:isDark?"#1a2a48":"#e0e7f0",tipTxt:isDark?"#e8edf5":"#0c1322"}}
function fmtBRL(v){return v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}
function fmtInt(v){return v.toLocaleString("pt-BR")}
function fmtPat(v){if(v>=1e9)return"R$ "+(v/1e9).toFixed(1)+" bi";if(v>=1e6)return"R$ "+(v/1e6).toFixed(0)+" mi";if(v>0)return"R$ "+fmtBRL(v);return"N/D"}
var svgUp='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>';
var svgDn='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>';
function recClass(r){if(!r)return"manter";var u=r.toUpperCase();if(u==="COMPRA FORTE")return"compra-forte";if(u==="COMPRA")return"compra";if(u==="MANTER")return"manter";if(u==="CAUTELA")return"cautela";if(u==="VENDA")return"venda";return"manter"}
function riskColorClass(r){if(!r)return"c-yellow";var c=r.color||"";return c==="green"?"c-green":c==="red"?"c-red":"c-yellow"}
function riskColorVar(r){if(!r)return"var(--yellow)";var c=r.color||"";return c==="green"?"var(--green)":c==="red"?"var(--red)":"var(--yellow)"}

// ══════════════════════════════════════════════════
//  AUTH — Login com usuário/senha + Google
// ══════════════════════════════════════════════════
function authenticateUser(u,p){for(var i=0;i<REGISTERED_USERS.length;i++){if(REGISTERED_USERS[i].username===u&&REGISTERED_USERS[i].password===p)return REGISTERED_USERS[i]}return null}

function handleLogin(e){
    e.preventDefault();
    var user=authenticateUser($("#inp-user").value.trim(),$("#inp-pass").value);
    if(user){currentUser=user;enterApp()}
    else{var err=$("#login-error");err.textContent="Usuário ou senha inválidos";err.classList.add("show");var c=$("#login-card");c.classList.add("shake");setTimeout(function(){c.classList.remove("shake")},500)}
}

function handleGoogleAuth(response){
    // Decodifica o JWT token do Google
    try{
        var payload=JSON.parse(atob(response.credential.split('.')[1]));
        var email=payload.email;
        var name=payload.name||email.split('@')[0];
        var picture=payload.picture||"";
        // Verifica se o email está na lista de permitidos
        if(ALLOWED_GOOGLE_EMAILS.indexOf(email)===-1){
            var err=$("#login-error");
            err.textContent="Email "+email+" não autorizado. Contate o administrador.";
            err.classList.add("show");
            var c=$("#login-card");c.classList.add("shake");setTimeout(function(){c.classList.remove("shake")},500);
            return;
        }
        currentUser={username:email,displayName:name,email:email,picture:picture,isGoogle:true};
        enterApp();
    }catch(e){
        var err=$("#login-error");
        err.textContent="Erro na autenticação Google.";
        err.classList.add("show");
    }
}

// Fallback: botão customizado abre popup Google
function initGoogleAuth(){
    if(typeof google!=="undefined"&&google.accounts){
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleAuth
        });
        google.accounts.id.renderButton(
            document.getElementById("google-login-btn"),
            { theme: "outline", size: "large", width: 360, text: "signin_with", shape: "pill" }
        );
    }
}

function enterApp(){
    $("#login-screen").classList.add("hidden");$("#app").classList.remove("hidden");
    $("#user-name").textContent=currentUser.displayName;
    $("#avatar").textContent=currentUser.displayName.charAt(0);
    if(currentUser.picture){
        var av=$("#avatar");av.style.backgroundImage="url("+currentUser.picture+")";
        av.style.backgroundSize="cover";av.textContent="";
    }
    checkApiConnection();loadDashboard();
}

function logout(){
    currentUser=null;destroyAllCharts();
    $("#app").classList.add("hidden");$("#login-screen").classList.remove("hidden");
    $("#inp-user").value="";$("#inp-pass").value="";
    $("#login-error").classList.remove("show");
    var av=$("#avatar");av.style.backgroundImage="";av.textContent="V";
    switchPage("dashboard");
}

function switchPage(page){
    currentPage=page;destroyAllCharts();
    $$(".pg").forEach(function(p){p.classList.remove("active")});
    $("#pg-"+page).classList.add("active");
    $$(".tab").forEach(function(t){t.classList.toggle("active",t.dataset.page===page)});
    $("#mobile-drop").classList.remove("open");$("#burger").classList.remove("open");
    if(page==="dashboard")loadDashboard();
    else if(page==="insights")loadInsightsByCategory(currentInsightsCat);
    else if(page==="other")loadOther();
}

function toggleTheme(){isDark=!isDark;document.body.className=isDark?"dark-theme":"light-theme";destroyAllCharts();if(currentPage==="dashboard")loadDashboard();else if(currentPage==="insights")loadInsightsByCategory(currentInsightsCat);else if(currentPage==="other")loadOther()}

// MACRO STRIP
function renderMacroStrip(m){var s=$("#macro-strip");if(!m||!m.selic){s.innerHTML="";return}s.innerHTML='<div class="macro-chip macro-chip--neutral"><span class="macro-chip__label">SELIC</span><span class="macro-chip__value">'+m.selic+'%</span></div><div class="macro-chip macro-chip--'+(m.ipca>5?"down":"up")+'"><span class="macro-chip__label">IPCA</span><span class="macro-chip__value">'+m.ipca+'%</span></div><div class="macro-chip macro-chip--'+(m.ifix_ytd>=0?"up":"down")+'"><span class="macro-chip__label">IFIX YTD</span><span class="macro-chip__value">+'+m.ifix_ytd+'%</span></div><div class="macro-chip macro-chip--'+(m.ifix_12m>=0?"up":"down")+'"><span class="macro-chip__label">IFIX 12M</span><span class="macro-chip__value">+'+m.ifix_12m+'%</span></div><div class="macro-chip macro-chip--up"><span class="macro-chip__label">PIB</span><span class="macro-chip__value">+'+m.pib+'%</span></div><div class="macro-chip macro-chip--neutral"><span class="macro-chip__label">Desemprego</span><span class="macro-chip__value">'+m.desemprego+'%</span></div>'}

// ═══ DASHBOARD ═══
function loadDashboard(){var grid=$("#grid-cards");grid.innerHTML='<div class="loader" style="grid-column:1/-1"><div class="loader-ring"></div><h3>Carregando fundos...</h3><p>ML v4 · 30+ FIIs · Top 10</p></div>';return apiGet("/api/dashboard").then(function(data){$("#dash-ts").textContent=data.timestamp;renderMacroStrip(data.macro||null);renderCards(data.funds)}).catch(function(err){grid.innerHTML='<div class="loader" style="grid-column:1/-1"><h3 style="color:var(--red)">API Python offline</h3><p style="margin-top:10px;color:var(--t2)">'+err.message+'</p></div>'})}

function renderCards(funds){var grid=$("#grid-cards");grid.innerHTML="";funds.forEach(function(f,i){var up=f.change_pct>=0,sign=up?"+":"",id="dc-"+f.ticker,d=f.dividends;var dyC=f.dy12m>10?"c-green":f.dy12m>8?"c-cyan":"c-yellow";var pvpC=f.pvp<1?"c-green":f.pvp>1.05?"c-red":"c-yellow";var growC=f.growth_12m>=8?"c-green":f.growth_12m>=4?"c-cyan":"c-yellow";var scoreC=f.score>=75?"c-green":f.score>=55?"c-yellow":"c-red";var risk=safeRisk(f),rC=riskColorClass(risk),sharpe=safeSharpe(f),sharpeC=sharpe>0.5?"c-green":sharpe>0?"c-yellow":"c-red",rating=safeRating(f),rec=safeRec(f),rc=recClass(rec);var badgeHtml="";if(f.is_fixed)badgeHtml='<span class="badge badge-fixed">★ FIXO</span>';else if(f.rank)badgeHtml='<span class="badge badge-rank">#'+f.rank+' ML</span>';var el=document.createElement("div");el.className="card anim-up";el.style.animationDelay=(i*0.05)+"s";el.innerHTML='<div class="card-accent '+(up?"accent-up":"accent-down")+'"></div><div class="card-top"><div><div style="display:flex;align-items:center"><span class="card-ticker">'+f.ticker+'</span>'+badgeHtml+'</div><p class="card-sub">'+f.name+' · '+f.sector+'</p></div><div class="card-price"><div class="card-price__val">R$ '+fmtBRL(f.price)+'</div><div class="card-chg '+(up?"chg-up":"chg-down")+'">'+(up?svgUp:svgDn)+' '+sign+f.change_pct.toFixed(2)+'%</div></div></div><div class="card-chart"><canvas id="'+id+'"></canvas></div><div class="card-risk-row"><div class="card-risk-item"><div class="card-risk-item__label">Risco</div><div class="card-risk-item__value '+rC+'">'+risk.icon+' '+risk.level+'</div></div><div class="card-risk-item"><div class="card-risk-item__label">Sharpe</div><div class="card-risk-item__value '+sharpeC+'">'+sharpe.toFixed(2)+'</div></div><div class="card-risk-item"><div class="card-risk-item__label">Gestora</div><div class="card-risk-item__value c-cyan">'+rating+'</div></div></div><div class="card-stats"><div class="stat"><div class="stat-lbl">DY 12M</div><div class="stat-val '+dyC+'">'+f.dy12m+'%</div></div><div class="stat"><div class="stat-lbl">P/VP</div><div class="stat-val '+pvpC+'">'+f.pvp.toFixed(2)+'</div></div><div class="stat"><div class="stat-lbl">Cresc.</div><div class="stat-val '+growC+'">+'+f.growth_12m+'%</div></div><div class="stat"><div class="stat-lbl">Score</div><div class="stat-val '+scoreC+'">'+f.score+'</div></div></div><div class="card-rec card-rec--'+rc+'">'+rec+'</div><div class="card-div"><div class="card-div__title">💰 Dividendos</div><div class="card-div__row"><span class="card-div__label">Último</span><span class="card-div__value" style="color:var(--green)">R$ '+d.last_dividend.toFixed(2)+'/cota</span></div><div class="card-div__row"><span class="card-div__label">Total 12M</span><span class="card-div__value">R$ '+fmtBRL(d.total_12m)+'/cota</span></div><div class="card-div__row"><span class="card-div__label">Tendência</span><span class="card-div__value">'+d.div_trend_icon+' '+d.div_trend.charAt(0).toUpperCase()+d.div_trend.slice(1)+'</span></div></div><div class="card-mil"><div class="card-mil__label">Cotas para R$ 1.000/mês</div><div class="card-mil__cotas">'+fmtInt(d.cotas_para_1000)+' cotas</div><div class="card-mil__invest">R$ '+fmtBRL(d.investimento_para_1000)+'</div></div>';grid.appendChild(el);requestAnimationFrame(function(){drawMini(id,f.history,up)})})}

function drawMini(id,hist,up){var cv=document.getElementById(id);if(!cv)return;var ctx=cv.getContext("2d"),th=cTh(),color=up?"#10b981":"#ef4444";var grad=ctx.createLinearGradient(0,0,0,60);grad.addColorStop(0,up?"rgba(16,185,129,.18)":"rgba(239,68,68,.18)");grad.addColorStop(1,"transparent");charts[id]=new Chart(ctx,{type:"line",data:{labels:hist.map(function(h){return h.date}),datasets:[{data:hist.map(function(h){return h.price}),borderColor:color,borderWidth:1.5,backgroundColor:grad,fill:true,tension:.4,pointRadius:0,pointHoverRadius:4,pointHoverBackgroundColor:color}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:th.tipBg,borderColor:th.tipBdr,borderWidth:1,titleColor:th.tick,bodyColor:th.tipTxt,cornerRadius:8,padding:8,displayColors:false,callbacks:{label:function(c){return"R$ "+c.raw.toFixed(2)}}}},scales:{x:{display:false},y:{display:false}},interaction:{intersect:false,mode:"index"}}})}

// ═══ INSIGHTS IA (POR CATEGORIA) ═══
function loadInsightsByCategory(cat){
    currentInsightsCat=cat;
    var body=$("#ins-body");
    var catLabels={"todos":"Top 10 Geral","papel":"Fundos de Papel","shoppings":"Fundos de Shopping","logistica":"Fundos de Logística","escritorio":"Fundos de Escritório","renda_urbana":"Fundos de Renda Urbana","fof":"Fundos de Fundos"};
    body.innerHTML='<div class="loader"><div class="loader-ring"></div><h3>Analisando '+catLabels[cat]+'...</h3><p>ML v4 · 11 fatores</p></div>';
    // Update active state of category buttons
    $$("#cat-selector .cat-btn").forEach(function(b){b.classList.toggle("active",b.dataset.cat===cat)});
    var endpoint="/api/insights/"+cat;
    return apiGet(endpoint).then(function(data){
        $("#ins-ts").textContent=data.timestamp;
        renderCategoryInsights(data);
    }).catch(function(err){
        body.innerHTML='<div class="loader"><h3 style="color:var(--red)">API offline</h3><p style="margin-top:10px;color:var(--t2)">'+err.message+'</p></div>';
    });
}

function renderCategoryInsights(data){
    var body=$("#ins-body"),h='';
    // Category header
    h+='<div class="cat-header"><span class="cat-header__icon">'+data.category_icon+'</span><div class="cat-header__info"><h3>'+data.category_label+'</h3><p>'+data.total_funds_analyzed+' FIIs analisados · '+(data.analyses?data.analyses.length:0)+' selecionados</p></div>';
    if(data.top_pick)h+='<div class="cat-header__top"><span>🏆</span> Top Pick: <strong>'+data.top_pick+'</strong></div>';
    h+='</div>';
    // Macro
    if(data.macro&&data.macro.selic){var m=data.macro;h+='<div class="macro-overview"><h3>📊 Cenário Macroeconômico</h3><p>'+m.selic_analysis+'</p>'+(m.summary?'<p style="margin-top:8px">'+m.summary+'</p>':'')+'<div class="macro-grid"><div class="macro-item"><div class="macro-item__label">SELIC</div><div class="macro-item__value c-cyan">'+m.selic+'%</div></div><div class="macro-item"><div class="macro-item__label">IPCA</div><div class="macro-item__value c-yellow">'+m.ipca+'%</div></div><div class="macro-item"><div class="macro-item__label">IFIX 12M</div><div class="macro-item__value c-green">+'+m.ifix_12m+'%</div></div><div class="macro-item"><div class="macro-item__label">PIB</div><div class="macro-item__value c-green">+'+m.pib+'%</div></div></div></div>'}
    // Sector outlook
    if(data.sector_outlook&&data.sector_outlook.driver){var so=data.sector_outlook;var oc=so.outlook==="positivo"?"var(--green)":(so.outlook||"").indexOf("neutro")>=0?"var(--yellow)":"var(--red)";h+='<div class="sector-box" style="border-left-color:'+oc+'"><h5>🏗️ Perspectiva: '+so.outlook+'</h5><p>'+so.driver+'</p></div>'}
    // Market overview
    if(data.market_overview)h+='<div class="mkt-box"><h3>🧠 Visão do ML v4</h3><p>'+data.market_overview+'</p></div>';
    // Sector distribution (for "todos")
    if(data.sector_distribution){var sd=data.sector_distribution;h+='<div class="sector-dist"><h4>📊 Distribuição por Setor</h4><div class="sector-dist__chips">';var colors={"Recebíveis":"var(--cyan)","Logística":"var(--green)","Shoppings":"var(--purple)","Lajes Corporativas":"var(--yellow)","Renda Urbana":"var(--blue)","FOF":"var(--red)","Híbrido":"var(--green-l)"};Object.keys(sd).forEach(function(s){h+='<span class="sector-dist__chip" style="border-color:'+(colors[s]||"var(--t3)")+';color:'+(colors[s]||"var(--t3)")+'">'+s+': '+sd[s]+'</span>'});h+='</div></div>'}
    // Analysis cards
    if(!data.analyses||data.analyses.length===0){h+='<div class="loader"><h3>Nenhum fundo encontrado nesta categoria</h3></div>';body.innerHTML=h;return}
    data.analyses.forEach(function(a,i){
        var rec=safeRec(a),rc=recClass(rec),recCol=rec.indexOf("COMPRA")>=0?"var(--green)":(rec==="CAUTELA"||rec==="VENDA")?"var(--red)":"var(--yellow)";
        var hId="ih-"+a.ticker,pId="ip-"+a.ticker,dId="id-"+a.ticker;
        var confCol=a.score>75?"var(--green)":a.score>55?"var(--yellow)":"var(--red)";
        var confGrad=a.score>75?"linear-gradient(90deg,#10b981,#34d399)":a.score>55?"linear-gradient(90deg,#f59e0b,#fbbf24)":"linear-gradient(90deg,#ef4444,#f87171)";
        var up6=((a.target_6m-a.current_price)/a.current_price*100).toFixed(1),up12=((a.target_12m-a.current_price)/a.current_price*100).toFixed(1),d=a.dividends;
        var risk=safeRisk(a),sharpe=safeSharpe(a),patrimonio=safePatrimonio(a);
        h+='<div class="ins-card"><div class="ins-head"><div class="ins-title-row"><div class="ins-rank" style="background:'+recCol+'15;border:1px solid '+recCol+'30;color:'+recCol+'">'+(i+1)+'</div><div class="ins-info"><h3>'+a.ticker;
        if(a.is_fixed)h+=' <span class="badge-s badge-fix">★ FIXO</span>';
        if(data.top_pick&&a.ticker===data.top_pick)h+=' <span class="badge-s badge-top">🏆 TOP</span>';
        h+='</h3><p>'+a.name+' · '+a.sector+' · '+a.admin+'</p></div></div><div class="ins-price-blk"><div class="ins-price">R$ '+fmtBRL(a.current_price)+'</div><span class="rec-badge rec-'+rc+'">'+rec+'</span></div></div><div class="ins-body">';
        // Score
        if(a.score_breakdown){var sb=a.score_breakdown;h+='<div class="conf-bar"><div class="conf-bar__top"><span class="conf-bar__lbl">Score ML v4</span><span class="conf-bar__val" style="color:'+confCol+'">'+a.score+'/100</span></div><div class="conf-track"><div class="conf-fill" style="width:'+a.score+'%;background:'+confGrad+'"></div></div></div><div class="score-breakdown">';Object.keys(sb).forEach(function(k){var it=sb[k];if(!it||typeof it.score!=="number")return;var fc=it.score>=75?"#10b981":it.score>=55?"#f59e0b":"#ef4444",sc=it.score>=75?"c-green":it.score>=55?"c-yellow":"c-red";h+='<div class="sb-item"><div class="sb-item__top"><span class="sb-item__label">'+(it.label||k)+'</span><span class="sb-item__score '+sc+'">'+it.score+'</span></div><div class="sb-item__bar"><div class="sb-item__fill" style="width:'+it.score+'%;background:'+fc+'"></div></div></div>'});h+='</div>'}
        // Metrics row
        h+='<div class="ins-grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:18px"><div class="ins-box" style="border-left-color:'+riskColorVar(risk)+'"><h5>'+risk.icon+' Risco</h5><p style="font-size:18px;font-weight:800" class="'+riskColorClass(risk)+'">'+risk.level+'</p></div><div class="ins-box" style="border-left-color:'+(sharpe>0.5?"var(--green)":sharpe>0?"var(--yellow)":"var(--red)")+'"><h5>📐 Sharpe</h5><p style="font-size:18px;font-weight:800;font-family:var(--mono);color:'+(sharpe>0.5?"var(--green)":sharpe>0?"var(--yellow)":"var(--red)")+'">'+sharpe.toFixed(2)+'</p></div><div class="ins-box" style="border-left-color:var(--cyan)"><h5>🏛️ Patrimônio</h5><p style="font-size:18px;font-weight:800;color:var(--cyan);font-family:var(--mono)">'+fmtPat(patrimonio)+'</p></div></div>';
        // Why choose
        if(a.why_choose&&a.why_choose.length){h+='<div class="why-box"><h4>🎯 Por que o ML selecionou</h4><ul class="why-list">';a.why_choose.forEach(function(r){h+='<li>'+r+'</li>'});h+='</ul></div>'}
        // Charts
        h+='<div class="charts-row"><div class="chart-panel"><h4>📈 Histórico 30d</h4><div class="chart-wrap"><canvas id="'+hId+'"></canvas></div></div><div class="chart-panel"><h4>🎯 Projeção</h4><div class="chart-wrap"><canvas id="'+pId+'"></canvas></div></div></div><div class="chart-panel" style="margin-bottom:18px"><h4>💰 Dividendos 12M</h4><div class="chart-wrap"><canvas id="'+dId+'"></canvas></div></div>';
        // Risks
        if(a.risks&&Array.isArray(a.risks)&&a.risks.length&&typeof a.risks[0]==="object"){h+='<div class="risk-grid">';a.risks.forEach(function(rk){if(!rk||!rk.category)return;h+='<div class="risk-item risk-item--'+(rk.level||'Moderado')+'"><div class="risk-item__head"><span class="risk-item__cat">'+rk.category+'</span><span class="risk-item__level risk-item__level--'+(rk.level||'Moderado')+'">'+(rk.level||'N/D')+'</span></div><div class="risk-item__text">'+(rk.text||'')+'</div></div>'});h+='</div>'}
        // Growth + Dividends explanation
        h+='<div class="ins-grid">';if(a.growth_analysis)h+='<div class="ins-box" style="border-left-color:var(--cyan)"><h5 style="color:var(--cyan)">📊 Crescimento</h5><p>'+a.growth_analysis+'</p></div>';if(a.dividend_explanation)h+='<div class="ins-box" style="border-left-color:var(--green)"><h5 style="color:var(--green)">💰 Dividendos</h5><p>'+a.dividend_explanation+'</p></div>';h+='</div>';
        // Dividend calc
        h+='<div class="div-calc"><div class="div-calc__title">🧮 R$ 1.000/mês</div><div class="div-calc__row"><div class="div-calc__item"><div class="div-calc__label">Cotas</div><div class="div-calc__value">'+fmtInt(d.cotas_para_1000)+'</div><div class="div-calc__sub">'+a.ticker+'</div></div><div class="div-calc__item"><div class="div-calc__label">Investimento</div><div class="div-calc__value">R$ '+fmtBRL(d.investimento_para_1000)+'</div><div class="div-calc__sub">a R$ '+fmtBRL(a.current_price)+'/cota</div></div><div class="div-calc__item"><div class="div-calc__label">Último Div.</div><div class="div-calc__value">R$ '+d.last_dividend.toFixed(2)+'</div><div class="div-calc__sub">/cota/mês</div></div><div class="div-calc__item"><div class="div-calc__label">Tendência</div><div class="div-calc__value">'+d.div_trend_icon+'</div><div class="div-calc__sub">'+d.div_trend+'</div></div></div></div>';
        // Targets
        h+='<div class="targets"><div class="tgt tgt-6"><div class="tgt-lbl">Alvo 6M</div><div class="tgt-price">R$ '+fmtBRL(a.target_6m)+'</div><div class="tgt-chg">+'+up6+'%</div></div><div class="tgt tgt-12"><div class="tgt-lbl">Alvo 12M</div><div class="tgt-price">R$ '+fmtBRL(a.target_12m)+'</div><div class="tgt-chg">+'+up12+'%</div></div></div></div></div>';
    });
    h+='<div class="disclaimer">⚠️ <strong>AVISO LEGAL:</strong> Análise gerada por IA. <strong>Não constitui recomendação de investimento.</strong> Consulte um assessor financeiro. '+data.total_funds_analyzed+' FIIs analisados.</div>';
    body.innerHTML=h;
    requestAnimationFrame(function(){data.analyses.forEach(function(a){drawHistorical("ih-"+a.ticker,a.history,a.target_12m>a.current_price);drawProjection("ip-"+a.ticker,a.current_price,a.target_6m,a.target_12m);drawDividendBars("id-"+a.ticker,a.dividends.div_history)})});
}

// Legacy loadInsights (redirect to category)
function loadInsights(){return loadInsightsByCategory(currentInsightsCat)}

function drawHistorical(id,hist,up){var cv=document.getElementById(id);if(!cv)return;var ctx=cv.getContext("2d"),th=cTh(),color=up?"#10b981":"#ef4444";var grad=ctx.createLinearGradient(0,0,0,130);grad.addColorStop(0,up?"rgba(16,185,129,.15)":"rgba(239,68,68,.15)");grad.addColorStop(1,"transparent");charts[id]=new Chart(ctx,{type:"line",data:{labels:hist.map(function(h){return h.date}),datasets:[{data:hist.map(function(h){return h.price}),borderColor:color,borderWidth:1.5,backgroundColor:grad,fill:true,tension:.4,pointRadius:0,pointHoverRadius:4,pointHoverBackgroundColor:color}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:th.tipBg,borderColor:th.tipBdr,borderWidth:1,titleColor:th.tick,bodyColor:th.tipTxt,cornerRadius:8,padding:8,displayColors:false,callbacks:{label:function(c){return"R$ "+c.raw.toFixed(2)}}}},scales:{x:{grid:{color:th.grid},ticks:{color:th.tick,font:{size:9},maxTicksLimit:6}},y:{grid:{color:th.grid},ticks:{color:th.tick,font:{size:9},callback:function(v){return v.toFixed(0)}}}},interaction:{intersect:false,mode:"index"}}})}

function drawProjection(id,cur,t6,t12){var cv=document.getElementById(id);if(!cv)return;var ctx=cv.getContext("2d"),th=cTh();charts[id]=new Chart(ctx,{type:"bar",data:{labels:["Atual","6M","12M"],datasets:[{data:[cur,t6,t12],backgroundColor:["#0ea5e9","#8b5cf6","#10b981"],borderRadius:6,borderSkipped:false,barPercentage:.5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:th.tipBg,borderColor:th.tipBdr,borderWidth:1,titleColor:th.tick,bodyColor:th.tipTxt,cornerRadius:8,padding:8,displayColors:false,callbacks:{label:function(c){return"R$ "+c.raw.toFixed(2)}}}},scales:{x:{grid:{display:false},ticks:{color:th.tick,font:{size:10}}},y:{grid:{color:th.grid},ticks:{color:th.tick,font:{size:9},callback:function(v){return v.toFixed(2)}},beginAtZero:false}}}})}

function drawDividendBars(id,divHist){var cv=document.getElementById(id);if(!cv)return;var ctx=cv.getContext("2d"),th=cTh();var months=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];var colors=divHist.map(function(v,i){return i===0?"#0ea5e9":v>=divHist[i-1]?"#10b981":"#ef4444"});charts[id]=new Chart(ctx,{type:"bar",data:{labels:months,datasets:[{data:divHist,backgroundColor:colors,borderRadius:4,borderSkipped:false,barPercentage:.65}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:th.tipBg,borderColor:th.tipBdr,borderWidth:1,titleColor:th.tick,bodyColor:th.tipTxt,cornerRadius:8,padding:8,displayColors:false,callbacks:{label:function(c){return"R$ "+c.raw.toFixed(2)+"/cota"}}}},scales:{x:{grid:{display:false},ticks:{color:th.tick,font:{size:9}}},y:{grid:{color:th.grid},ticks:{color:th.tick,font:{size:9},callback:function(v){return"R$"+v.toFixed(2)}},beginAtZero:false}}}})}

// ═══ OUTROS INVESTIMENTOS ═══
function loadOther(){var body=$("#oth-body");body.innerHTML='<div class="loader"><div class="loader-ring" style="border-top-color:var(--green)"></div><h3>Analisando mercado...</h3><p>Ações · ETFs · BDRs · Renda Fixa</p></div>';return apiGet("/api/other-investments").then(function(data){$("#oth-ts").textContent=data.timestamp;renderOther(data)}).catch(function(err){body.innerHTML='<div class="loader"><h3 style="color:var(--red)">API offline</h3><p style="margin-top:10px;color:var(--t2)">'+err.message+'</p></div>'})}
function renderOther(data){var body=$("#oth-body"),cats=data.categories;if(!cats){body.innerHTML='<p style="color:var(--t3)">Endpoint não disponível nesta versão do backend.</p>';return}var h='';var catKeys=Object.keys(cats);
h+='<div class="oth-filter"><button class="oth-filter-btn active" data-cat="all">Todos</button>';catKeys.forEach(function(k){var c=cats[k];h+='<button class="oth-filter-btn" data-cat="'+k+'">'+c.icon+' '+c.label+'</button>'});h+='</div>';
catKeys.forEach(function(k,ci){var cat=cats[k];
h+='<div class="oth-cat" data-catid="'+k+'" style="animation-delay:'+(ci*0.08)+'s">';
h+='<div class="oth-cat-head"><span class="oth-icon">'+cat.icon+'</span><h3>'+cat.label+'</h3>';
if(cat.top_pick)h+=' <span class="badge badge-rank" style="margin-left:8px">🏆 '+cat.top_pick+'</span>';
h+='</div>';
h+='<p class="oth-cat-desc">'+cat.description+'</p>';
h+='<div class="oth-grid">';
cat.items.forEach(function(item,ii){
var up=item.change_pct>=0;var sign=up?"+":"";var cid="oc-"+item.ticker;var rc=recClass(item.recommendation);
var riskC=item.risk==="Baixo"||item.risk==="Mínimo"?"c-green":item.risk==="Moderado"?"c-yellow":"c-red";
var detailId="detail-"+k+"-"+ii;
h+='<div class="oth-card oth-card--expandable" style="animation-delay:'+(ii*0.04)+'s">';
h+='<div class="oth-card-accent '+(up?"accent-up":"accent-down")+'"></div>';
// Top section
h+='<div class="oth-card-top"><div><div class="oth-ticker">'+item.ticker+'</div><div class="oth-name">'+item.name+' · '+item.sector+'</div></div><div class="oth-price-blk"><div class="oth-price">R$ '+fmtBRL(item.price)+'</div><div class="oth-change '+(up?"chg-up":"chg-down")+'" style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px">'+sign+item.change_pct.toFixed(2)+'%</div></div></div>';
// Chart
h+='<div class="oth-chart"><canvas id="'+cid+'"></canvas></div>';
// Metrics
h+='<div class="oth-metrics">';
if(item.dy12m>0)h+='<div class="oth-metric"><div class="oth-metric__label">DY 12M</div><div class="oth-metric__value c-green">'+item.dy12m+'%</div></div>';
else h+='<div class="oth-metric"><div class="oth-metric__label">Cresc.</div><div class="oth-metric__value c-cyan">+'+item.growth_12m+'%</div></div>';
h+='<div class="oth-metric"><div class="oth-metric__label">Score</div><div class="oth-metric__value '+(item.score>=75?"c-green":item.score>=55?"c-yellow":"c-red")+'">'+item.score+'</div></div>';
h+='<div class="oth-metric"><div class="oth-metric__label">Risco</div><div class="oth-metric__value '+riskC+'">'+item.risk+'</div></div></div>';
// Recommendation badge
h+='<div class="oth-rec card-rec--'+rc+'">'+item.recommendation+'</div>';
// Analysis summary
h+='<div class="oth-analysis">'+item.analysis+'</div>';
// Trust / Risk badge (visible directly on card)
if(item.trust_level==="confiavel"){
h+='<div class="oth-trust-badge oth-trust-badge--safe"><div class="oth-trust-badge__icon">🛡️</div><div class="oth-trust-badge__content"><div class="oth-trust-badge__title">Investimento Confiável</div><div class="oth-trust-badge__sub">Risco baixo · Fundamentos sólidos</div></div></div>';
}else{
var riskPct=item.risk_pct||0;
var riskBarCol=riskPct>=60?"var(--red)":riskPct>=35?"var(--yellow)":"var(--cyan)";
h+='<div class="oth-trust-badge oth-trust-badge--risk"><div class="oth-trust-badge__icon">⚠️</div><div class="oth-trust-badge__content"><div class="oth-trust-badge__title">Risco de '+riskPct+'%</div><div class="oth-trust-badge__sub">'+(riskPct>=60?"Risco elevado — apenas para perfil arrojado":riskPct>=35?"Risco moderado — avalie seu perfil":"Risco controlado — fundamentos positivos")+'</div><div class="oth-trust-bar"><div class="oth-trust-bar__fill" style="width:'+riskPct+'%;background:'+riskBarCol+'"></div></div></div></div>';
}
// Expand button
h+='<button class="oth-expand-btn" data-target="'+detailId+'"><span class="oth-expand-icon">▼</span> Ver análise completa da IA</button>';
// Expandable detail section
h+='<div class="oth-detail" id="'+detailId+'" style="display:none">';
// TRUST REASONS (for safe investments)
if(item.trust_level==="confiavel"&&item.trust_reasons&&item.trust_reasons.length){
h+='<div class="oth-trust-detail oth-trust-detail--safe"><h4>🛡️ Por que é confiável</h4><ul class="trust-list">';
item.trust_reasons.forEach(function(r){h+='<li>'+r+'</li>'});
h+='</ul></div>';
}
// RISK REASONS (for risky investments)
if(item.trust_level==="risco"&&item.risk_reasons&&item.risk_reasons.length){
var riskPct2=item.risk_pct||0;
h+='<div class="oth-trust-detail oth-trust-detail--risk"><h4>⚠️ Análise de Risco — '+riskPct2+'%</h4><ul class="risk-reason-list">';
item.risk_reasons.forEach(function(r){h+='<li>'+r+'</li>'});
h+='</ul></div>';
}
// Why invest
if(item.why_invest&&item.why_invest.length){
h+='<div class="oth-why"><h4>🎯 Por que investir</h4><ul class="why-list">';
item.why_invest.forEach(function(r){h+='<li>'+r+'</li>'});
h+='</ul></div>';
}
// Risks
if(item.risks){
h+='<div class="oth-risks"><h4>⚠️ Riscos</h4><p>'+item.risks+'</p></div>';
}
// Extra metrics
h+='<div class="oth-detail-metrics">';
h+='<div class="oth-detail-metric"><div class="oth-detail-metric__label">Crescimento 12M</div><div class="oth-detail-metric__value c-cyan">+'+item.growth_12m+'%</div></div>';
if(item.dy12m>0)h+='<div class="oth-detail-metric"><div class="oth-detail-metric__label">Dividend Yield</div><div class="oth-detail-metric__value c-green">'+item.dy12m+'%</div></div>';
h+='<div class="oth-detail-metric"><div class="oth-detail-metric__label">Risco</div><div class="oth-detail-metric__value '+riskC+'">'+item.risk+'</div></div>';
h+='<div class="oth-detail-metric"><div class="oth-detail-metric__label">Score IA</div><div class="oth-detail-metric__value '+(item.score>=75?"c-green":item.score>=55?"c-yellow":"c-red")+'">'+item.score+'/100</div></div>';
h+='</div>';
h+='</div>'; // end detail
h+='</div>'; // end card
});
h+='</div></div>'});
h+='<div class="disclaimer">⚠️ <strong>AVISO LEGAL:</strong> Análise gerada por IA. <strong>Não constitui recomendação de investimento.</strong> Rentabilidade passada não garante resultados futuros. Consulte um assessor financeiro certificado.</div>';
body.innerHTML=h;
// Draw charts
requestAnimationFrame(function(){catKeys.forEach(function(k){cats[k].items.forEach(function(item){drawMini("oc-"+item.ticker,item.history,item.change_pct>=0)})})});
// Filter logic
body.querySelectorAll(".oth-filter-btn").forEach(function(btn){btn.addEventListener("click",function(){body.querySelectorAll(".oth-filter-btn").forEach(function(b){b.classList.remove("active")});btn.classList.add("active");var cat=btn.dataset.cat;body.querySelectorAll(".oth-cat").forEach(function(el){if(cat==="all")el.style.display="";else el.style.display=el.dataset.catid===cat?"":"none"})})});
// Expand/collapse logic
body.querySelectorAll(".oth-expand-btn").forEach(function(btn){btn.addEventListener("click",function(){var target=document.getElementById(btn.dataset.target);var icon=btn.querySelector(".oth-expand-icon");if(target.style.display==="none"){target.style.display="block";icon.textContent="▲";btn.childNodes[1].textContent=" Fechar análise"}else{target.style.display="none";icon.textContent="▼";btn.childNodes[1].textContent=" Ver análise completa da IA"}})});
}

// INIT
document.addEventListener("DOMContentLoaded",function(){
    // Google Auth init
    setTimeout(initGoogleAuth, 500);
    // Login form
    $("#login-form").addEventListener("submit",handleLogin);
    $("#eye-btn").addEventListener("click",function(){var inp=$("#inp-pass"),show=inp.type==="password";inp.type=show?"text":"password";$(".eye-open").style.display=show?"none":"block";$(".eye-closed").style.display=show?"block":"none"});
    // Tabs
    $$(".tab").forEach(function(t){t.addEventListener("click",function(){if(t.dataset.page)switchPage(t.dataset.page)})});
    // Theme
    $("#theme-btn").addEventListener("click",toggleTheme);
    var tmM=$("#theme-btn-m");if(tmM)tmM.addEventListener("click",toggleTheme);
    // Logout
    $("#logout-btn").addEventListener("click",logout);
    var lgM=$("#logout-btn-m");if(lgM)lgM.addEventListener("click",logout);
    // Burger
    $("#burger").addEventListener("click",function(){$("#burger").classList.toggle("open");$("#mobile-drop").classList.toggle("open")});
    // Refresh buttons
    $("#refresh-dash").addEventListener("click",function(){var b=this;b.classList.add("spinning");b.disabled=true;destroyAllCharts();loadDashboard().finally(function(){b.classList.remove("spinning");b.disabled=false})});
    $("#refresh-oth").addEventListener("click",function(){var b=this;b.classList.add("spinning");b.disabled=true;destroyAllCharts();loadOther().finally(function(){b.classList.remove("spinning");b.disabled=false})});
    // Category selector in Insights
    $$("#cat-selector .cat-btn").forEach(function(btn){
        btn.addEventListener("click",function(){
            destroyAllCharts();
            loadInsightsByCategory(btn.dataset.cat);
        });
    });
});