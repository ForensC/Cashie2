/* ── Foriches / CASHFLOW TAB ─────────────────────────────────── */

const CF_COLOR = {
  income:     'oklch(0.72 0.17 145)',   // green
  fixed:      '#2b6fbd',                 // blue
  variable:   '#7a4cbf',                 // violet
  investment: 'oklch(0.78 0.16 78)',     // amber
};
const CF_LABEL = { income:'INCOME', fixed:'FIXED', variable:'VARIABLE', investment:'INVEST' };
const CF_ZH    = { income:'收入',    fixed:'固定支出', variable:'變動支出', investment:'投資' };

function cfMonth(r)    { return String(r[0]||'').slice(0,7); }
function cfAmt(r)      { return parseFloat(String(r[1]||'').replace(/[^0-9.]/g,'')) || 0; }
function cfIsType(r,t) { return String(r[2]||'') === t; }
function cfIsCollect(r){ return String(r[6]||'').toUpperCase() === 'TRUE'; }

let cfMonthFilter = '';
function cfSelectMonth(m){ cfMonthFilter = m; renderCF(); }

function renderCF(){
  const rows = cache[SHEETS.cf] || [];
  if (!rows.length){
    document.getElementById('content').innerHTML = '<div class="empty"><span class="spin"></span> LOADING...</div>';
    return;
  }
  const data = rows.filter(r => r[0] && r[1] != null && r[1] !== '');
  if (!data.length){
    document.getElementById('content').innerHTML = '<div class="empty">NO.RECORDS / 試算表中尚無資料</div>';
    return;
  }
  const months = [...new Set(data.map(cfMonth).filter(Boolean))].sort();
  if (!cfMonthFilter || !months.includes(cfMonthFilter)) cfMonthFilter = months[months.length-1] || '';

  const md = data.filter(r => cfMonth(r) === cfMonthFilter);
  const income  = md.filter(r=>cfIsType(r,'income')).reduce((s,r)=>s+cfAmt(r),0);
  const fixed   = md.filter(r=>cfIsType(r,'fixed')).reduce((s,r)=>s+cfAmt(r),0);
  const varExp  = md.filter(r=>cfIsType(r,'variable')).reduce((s,r)=>s+cfAmt(r),0);
  const invest  = md.filter(r=>cfIsType(r,'investment')).reduce((s,r)=>s+cfAmt(r),0);
  const totalExp= fixed + varExp;
  const netSave = income - totalExp - invest;
  const saveRate= income > 0 ? (income - totalExp) / income : null;

  const fN = v => Math.round(v).toLocaleString();
  const fR = v => v == null ? '—' : (v*100).toFixed(1) + '%';

  // ── Monthly sparkbars (last 12 months) ───────────────
  const last12 = months.slice(-12);
  const monthData = last12.map(m => {
    const mdRows = data.filter(r => cfMonth(r) === m);
    const inc = mdRows.filter(r=>cfIsType(r,'income')).reduce((s,r)=>s+cfAmt(r),0);
    const fx  = mdRows.filter(r=>cfIsType(r,'fixed')).reduce((s,r)=>s+cfAmt(r),0);
    const va  = mdRows.filter(r=>cfIsType(r,'variable')).reduce((s,r)=>s+cfAmt(r),0);
    const iv  = mdRows.filter(r=>cfIsType(r,'investment')).reduce((s,r)=>s+cfAmt(r),0);
    return { m, net: inc - fx - va - iv, inc, exp: fx+va+iv };
  });
  const maxAbs = Math.max(1, ...monthData.map(d=>Math.abs(d.net)));
  const sparkBars = monthData.map(d => {
    const h = Math.max(6, Math.round((Math.abs(d.net)/maxAbs)*72));
    const c = d.net >= 0 ? 'oklch(0.72 0.17 145)' : 'oklch(0.62 0.22 25)';
    const dim = d.m === cfMonthFilter ? 1 : 0.45;
    return '<button onclick="cfSelectMonth(\'' + d.m + '\')" style="display:flex;flex-direction:column;align-items:center;gap:5px;flex:1;min-width:0;background:none;border:none;cursor:pointer;padding:0;opacity:' + dim + ';transition:opacity .15s" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=' + dim + '">'
      + '<div style="width:100%;max-width:14px;display:flex;flex-direction:column;justify-content:flex-end;height:78px">'
      +   (d.net>=0 ? '<div style="width:100%;background:' + c + ';height:' + h + 'px;border-radius:2px 2px 0 0"></div>' : '<div style="width:100%;background:' + c + ';height:' + h + 'px;border-radius:0 0 2px 2px;align-self:flex-start"></div>')
      + '</div>'
      + '<div class="mono" style="font-size:8px;opacity:.6;letter-spacing:.03em;color:var(--cream);white-space:nowrap">' + d.m.slice(5) + '</div>'
      + '</button>';
  }).join('');

  // ─ month pills ─
  const monthPillsHtml = months.map(m => {
    const active = m === cfMonthFilter;
    const style = active
      ? 'background:var(--ink);color:var(--cream);'
      : 'background:transparent;color:var(--ink);opacity:.6;';
    return `<button onclick="cfSelectMonth('${m}')" class="pill-btn" style="${style}padding:8px 16px;font-size:11px">${m.replace('-','/')}</button>`;
  }).join('');

  // ─ KPI 4 cards ─
  const kpiItems = [
    { type:'income',     val:income,  label:'INCOME',     zh:'收入'    },
    { type:'fixed',      val:fixed,   label:'FIXED',      zh:'固定支出' },
    { type:'variable',   val:varExp,  label:'VARIABLE',   zh:'變動支出' },
    { type:'investment', val:invest,  label:'INVESTMENT', zh:'投資'    },
  ];
  const kpiHtml = kpiItems.map(k =>
    '<div class="kpi" style="background:var(--cream);color:var(--ink);border:1px solid rgba(13,13,16,.08)">'
    + '<div class="kpi-label" style="opacity:.5;color:var(--ink)">' + k.label + ' / ' + k.zh + '</div>'
    + '<div class="kpi-value" style="color:' + CF_COLOR[k.type] + ';font-size:36px">NT$' + fN(k.val) + '</div>'
    + '</div>'
  ).join('');

  // ─ NET SAVINGS hero — 3-column showpiece ─
  const saveColor = netSave >= 0 ? 'oklch(0.72 0.17 145)' : 'oklch(0.62 0.22 25)';
  const rateLabel = saveRate != null && saveRate >= .3 ? 'EXCELLENT / 優秀'
                  : saveRate != null && saveRate >= .2 ? 'GOOD / 良好'
                  : saveRate != null && saveRate >= 0  ? 'LOW / 偏低' : '—';
  const now = new Date();
  const pad2 = n => String(n).padStart(2,'0');
  const timeStr = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());

  // Quick avg
  const avgNet = monthData.length ? monthData.reduce((s,d)=>s+d.net,0) / monthData.length : 0;

  const savingsHtml =
    '<div style="display:grid;grid-template-columns:minmax(260px,1fr) minmax(360px,2fr) minmax(240px,1fr);gap:14px;margin-bottom:14px">'

    // LEFT — FLOW.PULSE
    + '<div style="background:var(--ink);color:var(--cream);border-radius:28px;padding:22px;min-height:340px;display:flex;flex-direction:column;justify-content:space-between">'
    +   '<div style="display:flex;justify-content:space-between;align-items:flex-start">'
    +     '<div class="mono" style="font-size:10px;letter-spacing:.12em;opacity:.6">FLOW.PULSE</div>'
    +     '<div class="mono" style="font-size:10px;letter-spacing:.12em;opacity:.6">' + last12.length + ' MO</div>'
    +   '</div>'
    +   '<div>'
    +     '<div class="display" style="font-size:38px;color:var(--cream);line-height:.9">MONTHLY</div>'
    +     '<div class="display" style="font-size:38px;color:oklch(0.62 0.22 25);line-height:.9">NET.WAVE</div>'
    +     '<div class="mono" style="font-size:10px;opacity:.55;margin-top:8px;letter-spacing:.06em">點擊任一月份切換 →</div>'
    +   '</div>'
    +   '<div>'
    +     '<div style="display:flex;align-items:flex-end;gap:4px;justify-content:space-between;border-top:1px solid #2a2a36;border-bottom:1px solid #2a2a36;padding:14px 0;position:relative">'
    +       '<div style="position:absolute;left:0;right:0;top:50%;height:1px;background:#3a3a48;opacity:.4"></div>'
    +       sparkBars
    +     '</div>'
    +     '<div class="mono" style="font-size:10px;opacity:.55;margin-top:10px;letter-spacing:.08em;display:flex;justify-content:space-between">'
    +       '<span>AVG.NET / ' + (avgNet>=0?'+':'') + 'NT$' + fN(Math.abs(avgNet)) + '</span>'
    +       '<span>RANGE / ' + last12[0] + ' → ' + last12[last12.length-1] + '</span>'
    +     '</div>'
    +   '</div>'
    + '</div>'

    // CENTER — big red NET.SAVINGS
    + '<div style="background:oklch(0.62 0.22 25);color:#fff;border-radius:28px;padding:28px 32px;min-height:340px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden">'
    +   '<div style="display:flex;justify-content:space-between;align-items:center">'
    +     '<div class="mono" style="font-size:11px;letter-spacing:.14em;font-weight:700;opacity:.92">⏵ LIVE / ' + timeStr + '</div>'
    +     '<div class="mono" style="font-size:11px;letter-spacing:.14em;font-weight:700;opacity:.92">MONTH ● ' + cfMonthFilter + '</div>'
    +   '</div>'
    +   '<div>'
    +     '<div class="mono" style="font-size:11px;opacity:.9;letter-spacing:.18em;margin-bottom:10px">NET.SAVINGS / TWD</div>'
    +     '<div class="stamp" style="font-size:clamp(40px,5.8vw,84px);color:#0d0d10;line-height:.88;letter-spacing:-.02em">' + (netSave>=0?'+':'-') + '$' + fN(Math.abs(netSave)) + '</div>'
    +     '<div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">'
    +       '<span class="chip dark"><span class="star">★</span> RATE · ' + fR(saveRate) + '</span>'
    +       '<span class="chip dark"><span class="star">★</span> INC · NT$' + fN(income) + '</span>'
    +       '<span class="chip dark"><span class="star">★</span> EXP · NT$' + fN(totalExp+invest) + '</span>'
    +     '</div>'
    +   '</div>'
    +   '<div>'
    +     '<div style="display:flex;height:14px;background:#0d0d10;border-radius:2px;overflow:hidden">'
    +       (income>0 ? '<div style="flex:' + fixed   + ';background:' + CF_COLOR.fixed      + '" title="固定支出"></div>' : '')
    +       (income>0 ? '<div style="flex:' + varExp  + ';background:' + CF_COLOR.variable   + '" title="變動支出"></div>' : '')
    +       (income>0 ? '<div style="flex:' + invest  + ';background:' + CF_COLOR.investment + '" title="投資"></div>' : '')
    +       (income>0 ? '<div style="flex:' + Math.max(0,netSave) + ';background:#0d0d10;border-left:1px dashed rgba(255,255,255,.3)" title="淨存"></div>' : '')
    +     '</div>'
    +     '<div class="mono" style="font-size:10px;opacity:.85;margin-top:8px;letter-spacing:.08em">// 收入 = 固定 ' + fN(fixed) + ' + 變動 ' + fN(varExp) + ' + 投資 ' + fN(invest) + ' + 淨存 ' + fN(Math.max(0,netSave)) + '</div>'
    +   '</div>'
    + '</div>'

    // RIGHT — gauge + status
    + '<div style="display:flex;flex-direction:column;gap:14px">'
    +   '<div style="background:var(--cream);border-radius:24px;padding:22px;min-height:160px;display:flex;flex-direction:column;justify-content:space-between">'
    +     '<div class="mono" style="font-size:10px;letter-spacing:.14em;opacity:.55">SAVING.RATE</div>'
    +     '<div class="display" style="font-size:64px;color:' + saveColor + ';line-height:.85">' + fR(saveRate) + '</div>'
    +     '<div class="mono" style="font-size:10px;letter-spacing:.12em;opacity:.7">' + rateLabel + '</div>'
    +   '</div>'
    +   '<div style="background:var(--cream);border-radius:24px;padding:18px 22px;flex:1;display:flex;flex-direction:column;gap:10px;justify-content:center">'
    +     '<div style="display:flex;justify-content:space-between;align-items:center"><span class="mono" style="font-size:10px;letter-spacing:.12em;opacity:.55">REC</span><span class="mn" style="font-weight:700;font-size:14px">' + md.length + ' TX</span></div>'
    +     '<div style="display:flex;justify-content:space-between;align-items:center"><span class="mono" style="font-size:10px;letter-spacing:.12em;opacity:.55">CATEGORIES</span><span class="mn" style="font-weight:700;font-size:14px">' + Object.keys(Object.fromEntries(md.map(r=>[r[3]||'',1]))).length + '</span></div>'
    +     '<div style="display:flex;justify-content:space-between;align-items:center"><span class="mono" style="font-size:10px;letter-spacing:.12em;opacity:.55">INV.RATIO</span><span class="mn" style="font-weight:700;font-size:14px;color:var(--amber)">' + (income>0?((invest/income)*100).toFixed(1):'—') + '%</span></div>'
    +   '</div>'
    + '</div>'

    + '</div>';

  // ─ category breakdown (right column) ─
  const expTypes = ['fixed','variable','investment'];
  const catMap = {};
  md.filter(r => !cfIsType(r,'income')).forEach(r=>{
    const t = String(r[2]||''), c = String(r[3]||'其他');
    if (!catMap[t]) catMap[t] = {};
    catMap[t][c] = (catMap[t][c] || 0) + cfAmt(r);
  });
  const breakdownHtml = expTypes.filter(t=>catMap[t]).map(t=>{
    const typeTotal = Object.values(catMap[t]).reduce((s,v)=>s+v,0);
    const catRows = Object.entries(catMap[t]).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>{
      const pct = typeTotal>0 ? amt/typeTotal : 0;
      const barW = Math.max(4, Math.round(pct*100));
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed rgba(13,13,16,.08)">'
        + '<div style="font-size:12px;color:var(--ink);opacity:.75;flex:1;min-width:0">' + cat + '</div>'
        + '<div style="width:64px;height:3px;background:rgba(13,13,16,.08);flex-shrink:0">'
        +   '<div style="width:' + barW + '%;height:100%;background:' + CF_COLOR[t] + '"></div>'
        + '</div>'
        + '<div class="mn" style="font-size:12px;color:var(--ink);min-width:76px;text-align:right;font-weight:500">NT$' + fN(amt) + '</div>'
        + '</div>';
    }).join('');
    return '<div style="background:var(--cream);border-radius:18px;padding:18px 20px;margin-bottom:10px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
      +   '<span class="mono" style="font-size:11px;font-weight:700;letter-spacing:.12em;color:' + CF_COLOR[t] + '">' + CF_LABEL[t] + ' / ' + CF_ZH[t] + '</span>'
      +   '<span class="mn" style="font-size:14px;font-weight:700">NT$' + fN(typeTotal) + '</span>'
      + '</div>'
      + catRows
      + '</div>';
  }).join('') || '<div class="empty">NO.EXPENSE / 本月尚無支出</div>';

  // ─ transactions table ─
  const txRows = [...md].sort((a,b)=>String(b[0]).localeCompare(String(a[0]))).map(r=>{
    const type = String(r[2]||'');
    const amt  = cfAmt(r);
    const isInc = cfIsType(r,'income');
    const isInv = cfIsType(r,'investment');
    const sign = isInc ? '+' : '−';
    const amtColor = isInc ? 'var(--green)' : isInv ? 'var(--amber)' : 'var(--cream)';
    const day  = String(r[0]||'').slice(8).replace(/^0/,'') + '日';
    const cat  = r[3] || '';
    const catColor = CF_COLOR[type] || '#94a3b8';
    const collectBadge = cfIsCollect(r)
      ? ' <span class="mn" style="font-size:9px;padding:1px 5px;background:rgba(245,158,11,.12);color:var(--amber);border:1px solid rgba(245,158,11,.25);margin-left:4px">◆ COLL</span>'
      : '';
    const note = r[5] || '';
    const card = r[4] || '';
    const desc = note ? note + (card ? '（'+card+'）' : '') : (card || '—');
    return '<tr>'
      + '<td class="mn" style="opacity:.55;white-space:nowrap">' + day + '</td>'
      + '<td style="font-weight:600;color:' + catColor + '">' + cat + collectBadge + '</td>'
      + '<td style="opacity:.7;font-size:12px">' + desc + '</td>'
      + '<td class="mn" style="color:' + amtColor + ';font-weight:700;text-align:right;white-space:nowrap">' + sign + 'NT$' + fN(amt) + '</td>'
      + '</tr>';
  }).join('');

  document.getElementById('content').innerHTML =
    // savings hero (already has month switcher via sparkbars)
    savingsHtml
    // KPI 4
    + '<div class="kpi-row" style="grid-template-columns:repeat(4,1fr)">' + kpiHtml + '</div>'
    // mid grid: donut + breakdown
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">'
    +   '<div class="section dark" style="padding:22px 26px;display:flex;flex-direction:column">'
    +     '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">'
    +       '<div><div class="section-title" style="font-size:22px">SPEND / SPLIT</div><div class="section-sub">支出結構占比</div></div>'
    +       '<span class="chip dark"><span class="star">★</span> ' + cfMonthFilter + '</span>'
    +     '</div>'
    +     '<div style="display:flex;align-items:center;gap:24px;flex:1;flex-wrap:wrap">'
    +       '<div style="position:relative;width:160px;height:160px;flex-shrink:0"><canvas id="cf-donut-chart"></canvas></div>'
    +       '<div style="display:flex;flex-direction:column;gap:12px;flex:1;min-width:140px">'
    +         (fixed>0  ? '<div style="display:flex;align-items:center;gap:10px"><div style="width:14px;height:14px;background:' + CF_COLOR.fixed      + '"></div><div class="mono" style="flex:1;font-size:11px;opacity:.7;letter-spacing:.1em">FIXED</div><div class="mn" style="font-weight:700;font-size:13px">NT$' + fN(fixed) + '</div></div>' : '')
    +         (varExp>0 ? '<div style="display:flex;align-items:center;gap:10px"><div style="width:14px;height:14px;background:' + CF_COLOR.variable   + '"></div><div class="mono" style="flex:1;font-size:11px;opacity:.7;letter-spacing:.1em">VARIABLE</div><div class="mn" style="font-weight:700;font-size:13px">NT$' + fN(varExp) + '</div></div>' : '')
    +         (invest>0 ? '<div style="display:flex;align-items:center;gap:10px"><div style="width:14px;height:14px;background:' + CF_COLOR.investment + '"></div><div class="mono" style="flex:1;font-size:11px;opacity:.7;letter-spacing:.1em">INVEST</div><div class="mn" style="font-weight:700;font-size:13px">NT$' + fN(invest) + '</div></div>' : '')
    +         (totalExp+invest===0 ? '<div class="empty" style="padding:0">NO.EXPENSE</div>' : '')
    +       '</div>'
    +     '</div>'
    +   '</div>'
    +   '<div style="overflow-y:auto;max-height:340px">' + breakdownHtml + '</div>'
    + '</div>'
    // transactions
    + '<div class="section dark">'
    +   '<div class="section-hd">'
    +     '<div><div class="section-title">LEDGER / ' + cfMonthFilter + '</div><div class="section-sub">' + md.length + ' RECORDS</div></div>'
    +     '<span class="chip dark"><span class="star">★</span> ALL.TX</span>'
    +   '</div>'
    +   (txRows
      ? '<div class="tbl-wrap"><table class="t" style="min-width:480px"><thead><tr>'
        + '<th>DATE<span class="zh">日期</span></th>'
        + '<th>CATEGORY<span class="zh">類別</span></th>'
        + '<th>NOTE<span class="zh">說明</span></th>'
        + '<th style="text-align:right">AMOUNT<span class="zh">金額</span></th>'
        + '</tr></thead><tbody>' + txRows + '</tbody></table></div>'
      : '<div class="empty">NO.TX / 本月尚無記錄</div>')
    + '</div>';

  // donut chart
  const donutCanvas = document.getElementById('cf-donut-chart');
  if (donutCanvas && (fixed+varExp+invest) > 0){
    const labels=[], dataArr=[], colors=[];
    if (fixed  > 0){ labels.push('固定'); dataArr.push(fixed);  colors.push(CF_COLOR.fixed); }
    if (varExp > 0){ labels.push('變動'); dataArr.push(varExp); colors.push(CF_COLOR.variable); }
    if (invest > 0){ labels.push('投資'); dataArr.push(invest); colors.push(CF_COLOR.investment); }
    charts.cfDonut = new Chart(donutCanvas, {
      type:'doughnut',
      data:{ labels, datasets:[{ data:dataArr, backgroundColor:colors, borderWidth:0, hoverOffset:6 }] },
      options:{
        responsive:true, maintainAspectRatio:false, cutout:'62%',
        plugins:{
          legend:{display:false},
          tooltip:{
            callbacks:{
              label: ctx => ' NT$' + Math.round(ctx.parsed).toLocaleString() + '  (' + ((ctx.parsed/(fixed+varExp+invest))*100).toFixed(1) + '%)'
            }
          }
        }
      }
    });
  }
}
