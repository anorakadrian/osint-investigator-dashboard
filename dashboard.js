/* Live scoring engine: World Bank WDI + WGI, percentile ranks, canvas rule table. No secrets. */
const GEOJSON_URL = "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson";
const WB = "https://api.worldbank.org/v2/country/all/indicator/";
const SERIES = {
  internet: { id: "IT.NET.USER.ZS", source: 2 },
  mktCap: { id: "CM.MKT.LCAP.CD", source: 2 },
  listed: { id: "CM.MKT.LDOM.NO", source: 2 },
  gdp: { id: "NY.GDP.MKTP.CD", source: 2 },
  rq: { id: "GOV_WGI_RQ.SC", source: 3 },
  rl: { id: "GOV_WGI_RL.SC", source: 3 },
  pv: { id: "GOV_WGI_PV.SC", source: 3 }
};
const AGGREGATE_ISO = new Set(["AFE","AFW","ARB","CEB","CSS","EAP","EAR","EAS","ECA","ECS","EMU","EUU","FCS","HIC","HPC","IBD","IBT","IDA","IDB","IDX","LAC","LCN","LDC","LIC","LMC","LMY","LTE","MEA","MIC","MNA","NAC","OED","OSS","PRE","PSS","PST","SAS","SSA","SSF","SST","TEA","TEC","TLA","TMN","TSA","TSS","UMC","WLD","INX"]);
const metricsConfig = {
  social: { name: "Digital attention proxy", note: "Observed: World Bank IT.NET.USER.ZS. Percentile of internet-user share. Not social reach or WTP.", colorScale: d3.scaleLinear().domain([0, 50, 100]).range(["#1e1b4b", "#6d28d9", "#c4b5fd"]) },
  osint: { name: "Public-source climate", note: "Observed: mean of WGI regulatory quality, rule of law, political stability. Not a threat score.", colorScale: d3.scaleLinear().domain([0, 50, 100]).range(["#4c0519", "#be185d", "#fbcfe8"]) },
  corporate: { name: "Listed-market depth", note: "Observed: 0.6*percentile(log market cap) + 0.4*percentile(log listed firms). Not deal flow.", colorScale: d3.scaleLinear().domain([0, 50, 100]).range(["#082f49", "#0369a1", "#bae6fd"]) }
};
const PROP_CATALOG = ["Zero-Trust Identity Fabric","Autonomous Edge Orchestration","Quantum-Safe Data Vaults","Generative Supply Chain Models","Hyper-Personalized Meta-Retail","Decentralized Carbon Ledger","Neuromorphic Process Synergy","Synthetic Resource Allocation","Orbital Data Sovereignty"];
let currentMetric = "social", currentSelected = null, countryIndex = [], zoomBehavior, projection, path;
function latestByIso(rows) {
  const map = new Map();
  for (const r of rows) {
    const iso = r.countryiso3code;
    if (!iso || AGGREGATE_ISO.has(iso) || r.value == null) continue;
    const year = +r.date;
    const prev = map.get(iso);
    if (!prev || year > prev.year) map.set(iso, { value: +r.value, year: year });
  }
  return map;
}
async function fetchIndicator(spec) {
  const url = WB + spec.id + "?format=json&per_page=20000&mrv=8&source=" + spec.source;
  const res = await fetch(url);
  if (!res.ok) throw new Error(spec.id + " HTTP " + res.status);
  const json = await res.json();
  const rows = Array.isArray(json) ? json[1] : null;
  if (!rows) throw new Error(spec.id + " unexpected payload");
  return { spec: spec, map: latestByIso(rows), lastUpdated: json[0] && json[0].lastupdated };
}
function percentileRanks(values) {
  const sorted = values.filter(Number.isFinite).slice().sort(function(a,b){return a-b;});
  const n = sorted.length, rank = new Map();
  if (!n) return rank;
  sorted.forEach(function(v,i){ if (!rank.has(v)) rank.set(v, n===1?100:(i/(n-1))*100); });
  return rank;
}
function mean(nums) {
  const xs = nums.filter(Number.isFinite);
  return xs.length ? xs.reduce(function(a,b){return a+b;},0)/xs.length : null;
}
function fmtUsd(v) {
  if (!Number.isFinite(v)) return "No data";
  if (v >= 1e12) return "$" + (v/1e12).toFixed(2) + "T";
  if (v >= 1e9) return "$" + (v/1e9).toFixed(1) + "B";
  if (v >= 1e6) return "$" + (v/1e6).toFixed(1) + "M";
  return "$" + Math.round(v);
}
function bucket(score) {
  if (!Number.isFinite(score)) return "U";
  if (score >= 67) return "H";
  if (score >= 33) return "M";
  return "L";
}
function deriveCanvas(obs) {
  const d = bucket(obs.metrics.social), g = bucket(obs.metrics.osint), c = bucket(obs.metrics.corporate);
  const key = d + g + c;
  const propIdx = {HHH:4,HHL:0,HLH:2,HLL:8,MHH:3,MHL:1,MLH:5,MLL:7,LHH:6,LHL:1,LLH:5,LLL:7};
  const concept = PROP_CATALOG[propIdx[key] != null ? propIdx[key] : 3];
  const customer = d==="H" ? "Digital-native enterprises and platforms" : d==="M" ? "Regional operators digitizing operations" : "Public agencies and infrastructure buyers";
  const problem = g==="L" ? "Opaque compliance and weak public-record reliability; workarounds live in spreadsheets" : g==="M" ? "Cross-border rules exist but are uneven; teams stitch filings by hand" : "High-trust markets still leak identity and supply-chain latency";
  const industry = c==="H" ? "Listed-market infrastructure / fintech rails" : c==="M" ? "DeepTech supply chain" : "GovTech and public-service platforms";
  return {
    concept: concept, customer: customer, problem: problem, industry: industry,
    bmc: {
      "Customer segments": customer,
      "Value propositions": concept,
      "Channels": d==="H" ? "Cloud marketplace + developer self-serve" : "Direct enterprise / integrator",
      "Customer relationships": g==="H" ? "Named-account CSM + public SLA" : "Assisted onboard + regulator liaison",
      "Revenue streams": c==="H" ? "Usage + seat hybrid on listed-market rails" : "Annual platform license + pilot",
      "Key resources": "Policy graph, regional hosting, assurance bench",
      "Key activities": "Locale certification, partner enablement, continuous eval",
      "Key partners": c==="H" ? "Exchanges, hyperscalers, auditors" : "National CSIRTs, trade bodies, labs",
      "Cost structure": "Sovereign hosting, audits, on-call analysts"
    }
  };
}
function attachLive(feature, tables, ranks) {
  const iso = String(feature.id || feature.properties.iso_a3 || "").toUpperCase();
  const name = feature.properties.name || iso;
  const raw = {};
  Object.keys(tables).forEach(function(k){ raw[k] = tables[k].map.get(iso) || null; });
  const internet = raw.internet && raw.internet.value;
  const wgi = mean([raw.rq && raw.rq.value, raw.rl && raw.rl.value, raw.pv && raw.pv.value]);
  const logCap = raw.mktCap && raw.mktCap.value > 0 ? Math.log(raw.mktCap.value) : null;
  const logListed = raw.listed && raw.listed.value > 0 ? Math.log(raw.listed.value) : null;
  const capPct = logCap == null ? null : ranks.logCap.get(logCap);
  const listedPct = logListed == null ? null : ranks.logListed.get(logListed);
  const corpParts = [];
  if (Number.isFinite(capPct)) corpParts.push({w:0.6,v:capPct});
  if (Number.isFinite(listedPct)) corpParts.push({w:0.4,v:listedPct});
  const wsum = corpParts.reduce(function(s,p){return s+p.w;},0);
  const corporate = wsum ? corpParts.reduce(function(s,p){return s+p.w*p.v;},0)/wsum : null;
  const social = Number.isFinite(internet) ? ranks.internet.get(internet) : null;
  const osint = Number.isFinite(wgi) ? ranks.wgi.get(wgi) : null;
  feature.properties.displayName = name;
  feature.properties.iso3 = iso || "XXX";
  feature.properties.raw = raw;
  feature.properties.metrics = {
    social: social == null ? null : Math.round(social),
    osint: osint == null ? null : Math.round(osint),
    corporate: corporate == null ? null : Math.round(corporate)
  };
  feature.properties.observed = { internet: internet, wgi: wgi, mktCap: raw.mktCap && raw.mktCap.value, listed: raw.listed && raw.listed.value };
  const years = [raw.internet, raw.rq, raw.rl, raw.pv, raw.mktCap, raw.listed].map(function(x){return x && x.year;}).filter(Boolean);
  feature.properties.asOf = years.length ? Math.min.apply(null, years) + "\u2013" + Math.max.apply(null, years) : "no series";
  feature.properties.canvas = deriveCanvas(feature.properties);
}
const container = document.getElementById("map-container");
const tooltip = d3.select("#tooltip");
const svg = d3.select("#map-container").append("svg").attr("width","100%").attr("height","100%").style("display","none");
const g = svg.append("g");
function dims(){ return { w: container.clientWidth || 800, h: container.clientHeight || 600 }; }
function makeProjection(){ const d = dims(); return d3.geoMercator().scale(d.w/6.4).translate([d.w/2, d.h/1.52]); }
projection = makeProjection();
path = d3.geoPath().projection(projection);
zoomBehavior = d3.zoom().scaleExtent([1,8]).on("zoom", function(event){ g.attr("transform", event.transform); });
svg.call(zoomBehavior);
function getCountryColor(d, metric) {
  const val = d.properties.metrics && d.properties.metrics[metric];
  return Number.isFinite(val) ? metricsConfig[metric].colorScale(val) : "#1a2433";
}
function updateLegend() {
  const config = metricsConfig[currentMetric];
  const legendScale = d3.select("#legend-scale");
  legendScale.selectAll("*").remove();
  const gradient = legendScale.append("defs").append("linearGradient").attr("id","legend-grad");
  gradient.selectAll("stop").data(d3.range(0,1.05,0.1)).enter().append("stop").attr("offset", function(d){return (d*100)+"%";}).attr("stop-color", function(d){return config.colorScale(d*100);});
  legendScale.append("rect").attr("width",200).attr("height",10).attr("rx",5).style("fill","url(#legend-grad)");
  document.getElementById("legend-metric-name").innerText = config.name;
  document.getElementById("legend-note").innerText = config.note;
}
function generateMetricHTML(key, val, label) {
  const shown = Number.isFinite(val) ? val + "/100" : "No data";
  const isActive = currentMetric === key ? "active-metric" : "";
  return '<div class="metric-item '+isActive+'"><div class="metric-label"><div class="label-left"><span class="dot '+key+'"></span> '+label+'</div><span style="font-family:ui-monospace,monospace;font-weight:650;">'+shown+' <span class="tag obs">Observed</span></span></div><div class="metric-bar-container"><div class="metric-bar '+key+'" id="bar-'+key+'"></div></div></div>';
}
function renderSidePanel(d) {
  currentSelected = d;
  document.getElementById("panel-empty").style.display = "none";
  document.getElementById("panel-content").style.display = "flex";
  document.getElementById("country-name-display").innerText = d.properties.displayName;
  document.getElementById("country-iso").innerText = d.properties.iso3;
  document.getElementById("country-asof").innerText = "as-of " + d.properties.asOf;
  const c = d.properties.canvas, o = d.properties.observed, raw = d.properties.raw;
  document.getElementById("canvas-concept").innerText = c.concept;
  document.getElementById("canvas-customer").innerText = c.customer;
  document.getElementById("canvas-problem").innerText = c.problem;
  document.getElementById("canvas-industry").innerText = c.industry;
  document.getElementById("canvas-similarweb").innerText = Number.isFinite(o.internet) ? o.internet.toFixed(1)+"%" : "No data";
  document.getElementById("canvas-competitors").innerText = Number.isFinite(o.listed) ? Math.round(o.listed).toLocaleString()+" firms" : "No data";
  document.getElementById("canvas-legal").innerText = raw.rq && Number.isFinite(raw.rq.value) ? raw.rq.value.toFixed(1)+" / 100" : "No data";
  document.getElementById("canvas-financial").innerText = fmtUsd(o.mktCap);
  document.getElementById("src-internet").innerText = "World Bank IT.NET.USER.ZS \u00b7 " + ((raw.internet && raw.internet.year) || "\u2014") + " \u00b7 not Similarweb";
  document.getElementById("src-listed").innerText = "World Bank CM.MKT.LDOM.NO \u00b7 " + ((raw.listed && raw.listed.year) || "\u2014");
  document.getElementById("src-rq").innerText = "WGI GOV_WGI_RQ.SC \u00b7 " + ((raw.rq && raw.rq.year) || "\u2014") + " \u00b7 not a legal finding";
  document.getElementById("src-cap").innerText = "World Bank CM.MKT.LCAP.CD \u00b7 " + ((raw.mktCap && raw.mktCap.year) || "\u2014") + " \u00b7 not startup TAM";
  document.getElementById("bmc-grid").innerHTML = Object.keys(c.bmc).map(function(k,i){
    return '<div class="bmc-cell '+(i<2?"span2":"")+'"><div class="canvas-label"><span>'+k+'</span><span class="tag hyp">Hyp.</span></div><div class="canvas-value" style="font-size:.8rem;">'+c.bmc[k]+'</div></div>';
  }).join("");
  const m = d.properties.metrics;
  document.getElementById("matrix-content").innerHTML = [
    generateMetricHTML("social", m.social, "Digital attention (internet-user percentile)"),
    generateMetricHTML("osint", m.osint, "Public-source climate (WGI mean percentile)"),
    generateMetricHTML("corporate", m.corporate, "Listed-market depth")
  ].join("");
  requestAnimationFrame(function(){
    function set(id,v){ const el=document.getElementById(id); if(el) el.style.width = Number.isFinite(v)? v+"%":"0%"; }
    set("bar-social", m.social); set("bar-osint", m.osint); set("bar-corporate", m.corporate);
  });
}
function clearSelection() {
  currentSelected = null;
  g.selectAll(".country").classed("selected", false);
  document.getElementById("panel-empty").style.display = "block";
  document.getElementById("panel-content").style.display = "none";
}
function selectFeature(d, node) {
  g.selectAll(".country").classed("selected", false);
  d3.select(node).classed("selected", true).raise();
  renderSidePanel(d);
}
function flyTo(d) {
  const dim = dims(), b = path.bounds(d);
  const dx = b[1][0]-b[0][0], dy = b[1][1]-b[0][1];
  const x = (b[0][0]+b[1][0])/2, y = (b[0][1]+b[1][1])/2;
  const scale = Math.max(1, Math.min(8, 0.7/Math.max(dx/dim.w, dy/dim.h)));
  svg.transition().duration(650).call(zoomBehavior.transform, d3.zoomIdentity.translate(dim.w/2 - scale*x, dim.h/2 - scale*y).scale(scale));
}
async function boot() {
  const loadMsg = document.getElementById("load-msg");
  try {
    loadMsg.textContent = "Loading country polygons\u2026";
    const geoRes = await fetch(GEOJSON_URL);
    if (!geoRes.ok) throw new Error("GeoJSON " + geoRes.status);
    const geo = await geoRes.json();
    loadMsg.textContent = "Loading World Bank and WGI series\u2026";
    const entries = await Promise.all(Object.keys(SERIES).map(function(key){
      return fetchIndicator(SERIES[key]).then(function(pack){ return [key, pack]; });
    }));
    const tables = {};
    entries.forEach(function(e){ tables[e[0]] = e[1]; });
    const internetVals = Array.from(tables.internet.map.values()).map(function(x){return x.value;});
    const wgiVals = [], logCapVals = [], logListedVals = [];
    const isoSet = new Set([].concat(Array.from(tables.rq.map.keys()), Array.from(tables.rl.map.keys()), Array.from(tables.pv.map.keys())));
    isoSet.forEach(function(iso){
      const m = mean([tables.rq.map.get(iso)&&tables.rq.map.get(iso).value, tables.rl.map.get(iso)&&tables.rl.map.get(iso).value, tables.pv.map.get(iso)&&tables.pv.map.get(iso).value]);
      if (Number.isFinite(m)) wgiVals.push(m);
    });
    tables.mktCap.map.forEach(function(v){ if (v.value>0) logCapVals.push(Math.log(v.value)); });
    tables.listed.map.forEach(function(v){ if (v.value>0) logListedVals.push(Math.log(v.value)); });
    const ranks = {
      internet: percentileRanks(internetVals),
      wgi: percentileRanks(wgiVals),
      logCap: percentileRanks(logCapVals),
      logListed: percentileRanks(logListedVals)
    };
    geo.features.forEach(function(f){ attachLive(f, tables, ranks); });
    countryIndex = geo.features.filter(function(d){ return d.properties.displayName && d.properties.displayName !== "Antarctica"; }).map(function(d){ return {name:d.properties.displayName, iso:d.properties.iso3, feature:d}; });
    const updated = Array.from(new Set(Object.keys(tables).map(function(k){return tables[k].lastUpdated;}).filter(Boolean))).join(" \u00b7 ");
    document.getElementById("live-badge").textContent = "Live open data \u00b7 " + (updated || "retrieved now");
    document.getElementById("loading").style.display = "none";
    svg.style("display","block");
    document.getElementById("legend-container").style.display = "block";
    document.getElementById("prop-strip").innerHTML = PROP_CATALOG.map(function(p){ return '<span class="prop-chip">'+p+'</span>'; }).join("");
    g.selectAll("path").data(geo.features).enter().append("path")
      .attr("d", path)
      .attr("class", function(d){ return (d.properties.displayName==="Antarctica" || !Number.isFinite(d.properties.metrics && d.properties.metrics[currentMetric])) ? "country no-data" : "country"; })
      .attr("fill", function(d){ return d.properties.displayName==="Antarctica" ? "#1a2433" : getCountryColor(d, currentMetric); })
      .on("mouseover", function(){ tooltip.style("opacity",1); })
      .on("mousemove", function(event,d){
        if (d.properties.displayName==="Antarctica") return;
        const val = d.properties.metrics[currentMetric];
        const cfg = metricsConfig[currentMetric];
        tooltip.html("<div style='font-weight:650;margin-bottom:6px;'>"+d.properties.displayName+" <span class='tag obs'>Observed</span></div><div style='color:#cbd5e1;'>"+cfg.name+": <b style='color:#fff'>"+(Number.isFinite(val)?val:"No data")+"</b></div><div style='font-size:.72rem;color:var(--accent-canvas);margin-top:4px;'>"+d.properties.canvas.concept+"</div><div style='font-size:.65rem;color:#64748b;margin-top:4px;'>ISO "+d.properties.iso3+" \u00b7 "+d.properties.asOf+"</div>")
          .style("left", (event.clientX+14)+"px").style("top", (event.clientY-18)+"px");
      })
      .on("mouseout", function(){ tooltip.style("opacity",0); })
      .on("click", function(event,d){ if (d.properties.displayName!=="Antarctica") selectFeature(d, this); });
    updateLegend();
  } catch (err) {
    loadMsg.textContent = "Source fetch failed: " + err.message + ". No scores will be invented.";
  }
}
document.querySelectorAll(".switcher-btn").forEach(function(btn){
  btn.addEventListener("click", function(){
    document.querySelectorAll(".switcher-btn").forEach(function(b){ b.classList.remove("active"); });
    this.classList.add("active");
    currentMetric = this.dataset.metric;
    g.selectAll(".country")
      .attr("class", function(d){ return (d.properties.displayName==="Antarctica" || !Number.isFinite(d.properties.metrics && d.properties.metrics[currentMetric])) ? "country no-data" : "country"; })
      .attr("fill", function(d){ return d.properties.displayName==="Antarctica" ? "#1a2433" : getCountryColor(d, currentMetric); });
    updateLegend();
    if (currentSelected) renderSidePanel(currentSelected);
  });
});
document.querySelectorAll(".tab-btn").forEach(function(btn){
  btn.addEventListener("click", function(){
    document.querySelectorAll(".tab-btn").forEach(function(b){ b.classList.remove("active"); });
    document.querySelectorAll(".tab-content").forEach(function(c){ c.classList.remove("active"); });
    this.classList.add("active");
    document.getElementById(this.dataset.target).classList.add("active");
  });
});
document.getElementById("close-panel").addEventListener("click", clearSelection);
document.addEventListener("keydown", function(e){ if (e.key==="Escape") clearSelection(); });
document.getElementById("zoom-in").addEventListener("click", function(){ svg.transition().duration(200).call(zoomBehavior.scaleBy, 1.35); });
document.getElementById("zoom-out").addEventListener("click", function(){ svg.transition().duration(200).call(zoomBehavior.scaleBy, 1/1.35); });
document.getElementById("zoom-reset").addEventListener("click", function(){ svg.transition().duration(350).call(zoomBehavior.transform, d3.zoomIdentity); });
const searchInput = document.getElementById("country-search");
const resultsBox = document.getElementById("finder-results");
searchInput.addEventListener("input", function(){
  const q = searchInput.value.trim().toLowerCase();
  if (!q) { resultsBox.style.display="none"; resultsBox.innerHTML=""; return; }
  const hits = countryIndex.filter(function(c){ return c.name.toLowerCase().indexOf(q)>=0 || c.iso.toLowerCase().indexOf(q)>=0; }).slice(0,8);
  resultsBox.innerHTML = hits.map(function(c){ return '<button type="button" data-name="'+c.name+'">'+c.name+' <span style="color:#64748b">'+c.iso+'</span></button>'; }).join("");
  resultsBox.style.display = hits.length ? "block" : "none";
});
resultsBox.addEventListener("click", function(e){
  const btn = e.target.closest("button"); if (!btn) return;
  const hit = countryIndex.find(function(c){ return c.name===btn.dataset.name; }); if (!hit) return;
  const node = g.selectAll(".country").filter(function(d){ return d===hit.feature; }).node();
  if (node) selectFeature(hit.feature, node);
  flyTo(hit.feature);
  resultsBox.style.display = "none";
  searchInput.value = hit.name;
});
window.addEventListener("resize", function(){
  const d = dims();
  projection = makeProjection();
  path = d3.geoPath().projection(projection);
  g.selectAll("path").attr("d", path);
  svg.attr("viewBox", "0 0 "+d.w+" "+d.h);
});
boot();
