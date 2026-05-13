/* ── Foriches / VAULT (COLLECTIONS) TAB ─────────────────────── */

const GRADE_ORDER = ['SSS','SS','S','A','B','C'];
const GRADE_STYLE = {
  'SSS': { bg:'oklch(0.78 0.16 78)',  text:'#0d0d10' },
  'SS':  { bg:'#ece7dc',              text:'#0d0d10' },
  'S':   { bg:'oklch(0.62 0.22 25)',  text:'#fff'    },
  'A':   { bg:'#2b6fbd',              text:'#fff'    },
  'B':   { bg:'#475569',              text:'#fff'    },
  'C':   { bg:'#334155',              text:'#cbd5e1' },
};

const CAT_COLORS = {
  '棒球':'#2b6fbd', '棒球周邊':'#2b6fbd',
  '公仔':'oklch(0.62 0.22 25)', '公仔玩具':'oklch(0.62 0.22 25)',
  '追星':'#7a4cbf',
  '其他':'#475569'
};
const CAT_CODE = {
  '棒球':'BSB', '棒球周邊':'BSB',
  '公仔':'FIG', '公仔玩具':'FIG',
  '追星':'IDL',
  '其他':'MSC'
};

function parseTags(v){
  if (!v) return [];
  return String(v).split(',').map(t=>t.trim()).filter(Boolean);
}
function getGradeTag(tags){ return tags.find(t=>GRADE_ORDER.includes(t.toUpperCase())) || null; }
function getNonGradeTags(tags){ return tags.filter(t=>!GRADE_ORDER.includes(t.toUpperCase())); }
function isSold(v){ return v===true || String(v).toUpperCase()==='TRUE'; }
function isWishlist(v){ return v===true || String(v).toUpperCase()==='TRUE'; }
function driveImg(url){
  if (!url) return '';
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400` : url;
}

let collCatFilter = '';
let collSearch    = '';
let _collData     = [];
let _collSeries   = {};
let collCollapsed = new Set();
let _collSelectedId = null;

function filterColl(cat){ collCatFilter = cat; renderCollBody(); }
function searchColl(v){ collSearch = v; renderCollBody(); }
function toggleCabinet(type){
  const key = type || '';
  collCollapsed.has(key) ? collCollapsed.delete(key) : collCollapsed.add(key);
  renderCollBody();
}

function showCollPanel(id){
  const r = _collData.find(x=>String(x[0])===String(id));
  if (!r) return;
  document.querySelectorAll('.coll-card.sel').forEach(el=>el.classList.remove('sel'));
  const cardEl = document.getElementById('cc-'+id);
  if (cardEl) cardEl.classList.add('sel');
  _collSelectedId = id;

  const panel = document.getElementById('coll-panel');
  const inner = document.getElementById('coll-panel-inner');
  if (!panel || !inner) return;

  const catColor = CAT_COLORS[r[4]] || '#475569';
  const catCode  = CAT_CODE[r[4]] || 'MSC';
  const imgUrl   = driveImg(r[10]||'');
  const series   = _collSeries[String(r[6]||'')];

  const tags  = parseTags(r[13]);
  const grade = getGradeTag(tags);
  const otherT= getNonGradeTags(tags);
  const gs    = grade ? GRADE_STYLE[grade.toUpperCase()] : null;

  let panelGradeBadge = '';
  if (grade && gs){
    panelGradeBadge = '<span class="mono" style="font-size:10px;padding:3px 9px;background:' + gs.bg + ';color:' + gs.text + ';font-weight:800;letter-spacing:.1em">' + grade.toUpperCase() + '</span>';
  }
  const otherTagsHtml = otherT.length
    ? '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:' + (r[14] ? '8' : '14') + 'px">'
      + otherT.map(t=>'<span class="mono" style="font-size:10px;padding:3px 8px;background:rgba(13,13,16,.06);color:var(--ink);opacity:.7;letter-spacing:.06em">'+t+'</span>').join('')
      + '</div>'
    : '';
  const tagNoteHtml = r[14]
    ? '<div style="display:flex;align-items:flex-start;gap:8px;padding:12px 14px;background:rgba(245,158,11,.1);border-left:3px solid var(--amber);margin-bottom:14px"><span class="mono" style="font-size:10px;color:var(--amber);font-weight:700;letter-spacing:.12em">NOTE</span><span style="font-size:12px;color:var(--ink);line-height:1.55;flex:1">' + r[14] + '</span></div>'
    : '';

  const rawAmt = parseFloat(String(r[2]||'').replace(/[^0-9.]/g,''));
  const amountRow = (!isNaN(rawAmt) && rawAmt > 0) ? ['COST',  'NT$ ' + rawAmt.toLocaleString()] : false;

  const detailDefs = [
    series && ['IP / SERIES', series.name],
    r[5]   && ['ITEM.TYPE',   r[5]],
    r[1]   && ['ACQUIRED',    fmt.d(r[1])],
    amountRow,
    r[11]  && ['SOURCE',      r[11]],
  ].filter(Boolean);

  const detailsHtml = detailDefs.length
    ? '<div style="display:flex;flex-direction:column;gap:14px;margin-bottom:16px">'
      + detailDefs.map(d =>
        '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;border-bottom:1px dashed rgba(13,13,16,.12);padding-bottom:10px">'
        + '<div class="mono" style="font-size:10px;opacity:.55;letter-spacing:.12em;flex-shrink:0">' + d[0] + '</div>'
        + '<div class="mono" style="font-size:12px;color:var(--ink);text-align:right;line-height:1.4">' + d[1] + '</div>'
        + '</div>'
      ).join('')
      + '</div>'
    : '';

  const imgHtml = imgUrl
    ? '<div style="height:260px;background:#0d0d10;overflow:hidden"><img src="' + imgUrl + '" style="width:100%;height:100%;object-fit:cover;display:block"></div>'
    : '<div style="height:200px;background:linear-gradient(135deg,' + catColor + '22,' + catColor + '08);display:flex;align-items:center;justify-content:center"><span class="display" style="font-size:80px;color:' + catColor + ';opacity:.4">' + catCode + '</span></div>';

  const noteHtml = r[9]
    ? '<div style="padding:14px;background:rgba(13,13,16,.04);font-size:12px;color:var(--ink);opacity:.75;line-height:1.7">' + r[9] + '</div>'
    : '';

  inner.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px">'
    + '<div class="mono" style="font-size:10px;letter-spacing:.16em;opacity:.55">VAULT.ITEM / #' + String(r[0]).padStart(3,'0') + '</div>'
    + '<button onclick="hideCollPanel()" class="circle-btn" style="width:30px;height:30px;font-size:14px;background:var(--ink)">×</button>'
    + '</div>'
    + imgHtml
    + '<div style="padding:20px 18px">'
    +   '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;align-items:center">'
    +     '<span class="mono" style="font-size:10px;padding:3px 9px;background:' + catColor + ';color:#fff;font-weight:700;letter-spacing:.12em">' + catCode + ' / ' + (r[4]||'') + '</span>'
    +     (r[5] ? '<span class="mono" style="font-size:10px;padding:3px 9px;background:rgba(13,13,16,.06);color:var(--ink);opacity:.7;letter-spacing:.08em">' + r[5] + '</span>' : '')
    +     panelGradeBadge
    +   '</div>'
    +   '<div class="display" style="font-size:24px;color:var(--ink);line-height:1.05;margin-bottom:14px">' + (r[3]||'') + '</div>'
    +   otherTagsHtml
    +   tagNoteHtml
    +   detailsHtml
    +   noteHtml
    + '</div>';

  panel.classList.add('open');
}

function hideCollPanel(){
  const panel = document.getElementById('coll-panel');
  if (panel) panel.classList.remove('open');
  document.querySelectorAll('.coll-card.sel').forEach(el=>el.classList.remove('sel'));
  _collSelectedId = null;
}

function makeCollCard(r){
  const imgUrl   = driveImg(r[10]||'');
  const catColor = CAT_COLORS[r[4]] || '#475569';
  const catCode  = CAT_CODE[r[4]] || 'MSC';
  const tags     = parseTags(r[13]);
  const grade    = getGradeTag(tags);
  const gs       = grade ? GRADE_STYLE[grade.toUpperCase()] : null;
  const otherT   = getNonGradeTags(tags);

  const gradeBadge = gs
    ? '<div class="mono" style="position:absolute;top:8px;right:8px;background:' + gs.bg + ';color:' + gs.text + ';font-size:10px;font-weight:800;padding:3px 8px;letter-spacing:.08em;z-index:1">' + grade.toUpperCase() + '</div>'
    : '';

  const tagPills = otherT.slice(0,3).length
    ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">'
      + otherT.slice(0,3).map(t=>'<span class="mono" style="font-size:9px;padding:1px 6px;background:rgba(255,255,255,.05);color:var(--cream);opacity:.55;letter-spacing:.05em">'+t+'</span>').join('')
      + '</div>'
    : '';

  const imgArea = imgUrl
    ? '<img src="' + imgUrl + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block">'
    : '<div style="height:100%;background:linear-gradient(135deg,' + catColor + '33,' + catColor + '0a);display:flex;align-items:center;justify-content:center"><span class="display" style="font-size:36px;color:' + catColor + ';opacity:.6">' + catCode + '</span></div>';

  return '<div id="cc-' + r[0] + '" class="coll-card' + (_collSelectedId===String(r[0]) ? ' sel' : '') + '" onclick="showCollPanel(\'' + r[0] + '\')">'
    + '<div class="coll-img" style="position:relative">' + gradeBadge + imgArea + '</div>'
    + '<div class="coll-body">'
    +   '<div class="mono" style="font-size:9px;font-weight:700;letter-spacing:.12em;color:' + catColor + ';margin-bottom:5px">' + catCode + ' · ' + String(r[0]).padStart(3,'0') + '</div>'
    +   '<div style="font-size:13px;font-weight:700;color:var(--cream);line-height:1.35;margin-bottom:5px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;min-height:36px">' + (r[3]||'') + '</div>'
    +   '<div class="mono" style="font-size:10px;color:var(--cream);opacity:.45;letter-spacing:.05em">' + fmt.d(r[1]) + '</div>'
    +   tagPills
    + '</div>'
    + '</div>';
}

function renderColl(){
  const rows  = cache[SHEETS.coll] || [];
  const sRows = cache[SHEETS.collSeries] || [];
  if (!rows.length){
    document.getElementById('content').innerHTML = '<div class="empty"><span class="spin"></span> LOADING VAULT...</div>';
    return;
  }
  _collData = rows.filter(r => r[0] != null && r[0] !== '');
  _collSeries = {};
  sRows.filter(r=>r[0]).forEach(r=>{ _collSeries[String(r[0])] = { mainCat:r[1]||'', name:r[2]||'', total:parseInt(r[3])||0 }; });

  // Shell with persistent search input
  document.getElementById('content').innerHTML =
    // styles for collection cards
    '<style>'
    + '.coll-card{background:#161620;border:1px solid #22222c;border-radius:14px;overflow:hidden;cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s}'
    + '.coll-card:hover{transform:translateY(-3px);border-color:var(--signal);box-shadow:0 8px 24px rgba(0,0,0,.3)}'
    + '.coll-card.sel{border-color:var(--signal);box-shadow:0 0 0 2px oklch(0.62 0.22 25 / 0.3)}'
    + '.coll-img{height:170px;overflow:hidden;background:#0a0a0d;display:flex;align-items:center;justify-content:center}'
    + '.coll-card:hover .coll-img img{transform:scale(1.04)}'
    + '.coll-img img{transition:transform .3s}'
    + '.coll-body{padding:12px 14px}'
    + '.coll-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}'
    + '#coll-wrapper{display:flex;gap:18px;align-items:flex-start}'
    + '#coll-main{flex:1;min-width:0}'
    + '#coll-panel{width:0;overflow:hidden;transition:width .28s cubic-bezier(.4,0,.2,1);flex-shrink:0}'
    + '#coll-panel.open{width:340px}'
    + '#coll-panel-inner{width:340px;background:var(--cream);border-radius:24px;overflow-y:auto;max-height:calc(100vh - 110px);position:sticky;top:18px}'
    + '#coll-search{width:100%;background:var(--ink);border:none;border-radius:999px;padding:14px 22px;color:var(--cream);font-size:13px;font-family:\'JetBrains Mono\',monospace;letter-spacing:.06em;margin-bottom:16px}'
    + '#coll-search::placeholder{color:rgba(236,231,220,.45);font-family:\'JetBrains Mono\',monospace}'
    + '#coll-search:focus{outline:none;box-shadow:0 0 0 2px var(--signal)}'
    + '.cab-head{display:flex;align-items:center;gap:12px;padding:10px 14px;cursor:pointer;user-select:none;border-radius:10px;margin-bottom:14px;background:rgba(13,13,16,.06);transition:background .15s}'
    + '.cab-head:hover{background:rgba(13,13,16,.1)}'
    + '</style>'
    + '<div id="coll-kpi"></div>'
    + '<input id="coll-search" placeholder="SEARCH / 搜尋名稱、IP、物品型態、備註…" value="' + collSearch.replace(/"/g,'&quot;') + '">'
    + '<div id="coll-pills" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px;align-items:center"></div>'
    + '<div id="coll-wrapper">'
    +   '<div id="coll-main"><div id="coll-body"></div></div>'
    +   '<div id="coll-panel"><div id="coll-panel-inner"></div></div>'
    + '</div>';

  const inp = document.getElementById('coll-search');
  let _imeOn=false, _timer=null;
  inp.addEventListener('compositionstart', ()=>{ _imeOn=true; });
  inp.addEventListener('compositionend',  ()=>{ _imeOn=false; clearTimeout(_timer); searchColl(inp.value); });
  inp.addEventListener('input', ()=>{
    if (_imeOn) return;
    clearTimeout(_timer);
    _timer = setTimeout(()=>searchColl(inp.value), 120);
  });

  renderCollBody();
}

function renderCollBody(){
  if (!_collData.length) return;

  const wishlistItems = _collData.filter(r => isWishlist(r[12]));
  const soldItems     = _collData.filter(r => !isWishlist(r[12]) && isSold(r[7]));
  const owned         = _collData.filter(r => !isWishlist(r[12]) && !isSold(r[7]));

  const cats = [...new Set(owned.map(r=>r[4]).filter(Boolean))];
  const catCounts = {};
  owned.forEach(r=>{ const c=r[4]||'其他'; catCounts[c]=(catCounts[c]||0)+1; });
  if (!collCatFilter || !cats.includes(collCatFilter)) collCatFilter = cats[0] || '';

  const catSpend = {};
  owned.forEach(r=>{
    const c = r[4] || '其他';
    const amt = parseFloat(String(r[2]||'').replace(/[^0-9.]/g,''));
    catSpend[c] = (catSpend[c]||0) + (isNaN(amt) ? 0 : amt);
  });

  const catOwned   = owned.filter(r=>r[4]===collCatFilter);
  const catSold    = soldItems.filter(r=>r[4]===collCatFilter);
  const totalSpent = catOwned.reduce((s,r)=>{ const v=parseFloat(String(r[2]||'').replace(/[^0-9.]/g,'')); return s+(isNaN(v)?0:v); },0);
  const totalRecov = catSold.reduce((s,r)=>{ const v=parseFloat(String(r[8]||'').replace(/[^0-9.]/g,'')); return s+(isNaN(v)?0:v); },0);
  const netSpent   = totalSpent - totalRecov;
  const fmtAmt     = v => 'NT$' + Math.abs(Math.round(v)).toLocaleString();
  const catCode    = CAT_CODE[collCatFilter] || 'MSC';

  // ─── KPI BLOCK ───────────────────────────────────────────
  // SVG donut of category split
  const r=58, cx=72, cy=72, sw=14, circ=2*Math.PI*r;
  let accum=0;
  const arcSegs = cats.filter(c=>catCounts[c]>0).map(c=>{
    const pct=(catCounts[c]||0)/(owned.length||1);
    const seg=Math.max(0, pct*circ - (cats.length>1?3:0));
    const color=CAT_COLORS[c]||'#475569';
    const el='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+sw+'"'
      +' stroke-dasharray="'+seg.toFixed(1)+' '+circ.toFixed(1)+'"'
      +' stroke-dashoffset="'+(-accum).toFixed(1)+'"'
      +' transform="rotate(-90 '+cx+' '+cy+')" stroke-linecap="butt"/>';
    accum+=pct*circ; return el;
  }).join('');

  const catRowsHtml = cats.filter(c=>catCounts[c]>0).map(c =>
    '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed rgba(255,255,255,.05)">'
    + '<span style="width:8px;height:8px;background:' + (CAT_COLORS[c]||'#475569') + ';flex-shrink:0"></span>'
    + '<span class="mono" style="font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--cream)">' + (CAT_CODE[c]||'MSC') + '</span>'
    + '<span style="font-size:11px;color:var(--cream);opacity:.7">' + c + '</span>'
    + '<div style="margin-left:auto;text-align:right">'
    + '<div class="mn" style="font-size:13px;color:var(--cream);font-weight:700">' + catCounts[c] + '<span style="font-size:9px;opacity:.6;font-weight:400"> 件</span></div>'
    + ((catSpend[c]||0)>0 ? '<div class="mn" style="font-size:10px;color:var(--cream);opacity:.5">NT$' + Math.round(catSpend[c]).toLocaleString() + '</div>' : '')
    + '</div>'
    + '</div>'
  ).join('');

  const catLabel = catCode + ' / ' + collCatFilter;
  const statDefs = [
    { en:'TOTAL.SPENT', zh:catLabel+' 總花費', val: totalSpent>0 ? fmtAmt(totalSpent) : '—', color:'var(--signal)' },
    { en:'RECOVERED',   zh:catLabel+' 已回收', val: totalRecov>0 ? fmtAmt(totalRecov) : '—', color:'var(--green)' },
    { en:'NET.SPEND',   zh:'淨支出（扣回收後）', val: totalSpent>0 ? (netSpent<0?'-':'')+fmtAmt(netSpent) : '—', color: (totalSpent>0&&netSpent<=0) ? 'var(--green)' : 'var(--amber)' },
  ];
  const statCardsHtml = statDefs.map(s =>
    '<div class="kpi cream" style="background:var(--cream);padding:18px 22px;display:flex;align-items:center;gap:14px">'
    + '<div style="flex:1;min-width:0">'
    +   '<div class="mono" style="font-size:10px;letter-spacing:.14em;opacity:.55">' + s.en + '</div>'
    +   '<div style="font-size:11px;opacity:.6;margin-top:2px">' + s.zh + '</div>'
    + '</div>'
    + '<div class="display" style="font-size:24px;color:' + s.color + ';flex-shrink:0">' + s.val + '</div>'
    + '</div>'
  ).join('');

  document.getElementById('coll-kpi').innerHTML =
    // ───────── VAULT HERO — 3-column showpiece ─────────
    (function(){
      const latest = [...owned].sort((a,b)=>String(b[1]||'').localeCompare(String(a[1]||'')))[0];
      const totalSpentAll = owned.reduce((s,r)=>{ const v=parseFloat(String(r[2]||'').replace(/[^0-9.]/g,'')); return s+(isNaN(v)?0:v); }, 0);
      const now = new Date();
      const pad2 = n => String(n).padStart(2,'0');
      const timeStr = pad2(now.getHours())+':'+pad2(now.getMinutes())+':'+pad2(now.getSeconds());

      // Latest item card content
      let latestBlock = '';
      if (latest){
        const lImg = driveImg(latest[10]||'');
        const lCatColor = CAT_COLORS[latest[4]] || '#475569';
        const lCode = CAT_CODE[latest[4]] || 'MSC';
        const lTags = parseTags(latest[13]);
        const lGrade = getGradeTag(lTags);
        const lgs = lGrade ? GRADE_STYLE[lGrade.toUpperCase()] : null;
        latestBlock =
          '<div onclick="showCollPanel(\''+latest[0]+'\')" style="background:oklch(0.62 0.22 25);color:#fff;border-radius:28px;padding:0;min-height:340px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;cursor:pointer;position:relative">'
          + '<div style="position:absolute;inset:0">' + (lImg ? '<img src="'+lImg+'" style="width:100%;height:100%;object-fit:cover;opacity:.32" alt="">' : '') + '</div>'
          + '<div style="position:relative;padding:22px 26px 0;display:flex;justify-content:space-between;align-items:center">'
          +   '<div class="mono" style="font-size:11px;letter-spacing:.14em;font-weight:700;opacity:.92">⏵ LATEST.HAUL / '+timeStr+'</div>'
          +   '<div class="mono" style="font-size:11px;letter-spacing:.14em;font-weight:700;opacity:.92">#'+String(latest[0]).padStart(3,'0')+'</div>'
          + '</div>'
          + '<div style="position:relative;padding:0 26px;display:flex;flex-direction:column;gap:10px">'
          +   '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
          +     '<span class="mono" style="font-size:10px;padding:3px 9px;background:#0d0d10;color:var(--cream);font-weight:700;letter-spacing:.12em">'+lCode+' / '+(latest[4]||'')+'</span>'
          +     (latest[5] ? '<span class="mono" style="font-size:10px;padding:3px 9px;background:rgba(0,0,0,.35);color:#fff;letter-spacing:.08em">'+latest[5]+'</span>' : '')
          +     (lGrade && lgs ? '<span class="mono" style="font-size:10px;padding:3px 9px;background:'+lgs.bg+';color:'+lgs.text+';font-weight:800;letter-spacing:.1em">'+lGrade.toUpperCase()+'</span>' : '')
          +   '</div>'
          +   '<div class="stamp" style="font-size:clamp(36px,4vw,56px);color:#0d0d10;line-height:.95;text-shadow:1px 1px 0 rgba(255,255,255,.18)">'+(latest[3]||'')+'</div>'
          + '</div>'
          + '<div style="position:relative;padding:0 26px 22px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:8px">'
          +   '<div class="mono" style="font-size:11px;letter-spacing:.06em;opacity:.95">ACQUIRED '+fmt.d(latest[1])+(latest[11]?' · '+latest[11]:'')+'</div>'
          +   '<span class="chip dark"><span class="star">★</span> 點擊查看詳情</span>'
          + '</div>'
          + '</div>';
      } else {
        latestBlock = '<div style="background:oklch(0.62 0.22 25);color:#fff;border-radius:28px;padding:32px;min-height:340px;display:flex;align-items:center;justify-content:center"><div class="display" style="font-size:40px;color:#0d0d10">EMPTY.VAULT</div></div>';
      }

      return '<div style="display:grid;grid-template-columns:minmax(240px,1fr) minmax(360px,2fr) minmax(240px,1fr);gap:14px;margin-bottom:14px">'
        // LEFT — VAULT.ID stamp
        + '<div style="background:var(--ink);color:var(--cream);border-radius:28px;padding:22px;min-height:340px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden">'
        +   '<div style="display:flex;justify-content:space-between;align-items:flex-start">'
        +     '<div class="mono" style="font-size:10px;letter-spacing:.12em;opacity:.6">VAULT.ID</div>'
        +     '<div class="mono" style="font-size:10px;letter-spacing:.12em;opacity:.6">SEC.LV.03</div>'
        +   '</div>'
        +   '<div>'
        +     '<div class="display" style="font-size:46px;color:var(--cream);line-height:.9">YOUR.</div>'
        +     '<div class="display" style="font-size:46px;color:var(--cream);line-height:.9">PRIVATE</div>'
        +     '<div class="display" style="font-size:30px;color:oklch(0.62 0.22 25);line-height:.9;margin-top:6px">VAULT.</div>'
        +     '<div class="mono" style="font-size:10px;opacity:.55;margin-top:10px;line-height:1.5"><span class="blink">⬢</span> ENCRYPTED · LOCKED</div>'
        +   '</div>'
        +   '<div style="display:flex;flex-direction:column;gap:4px">'
        +     '<div class="mono" style="font-size:10px;opacity:.55;letter-spacing:.1em;margin-bottom:4px">SUMMARY</div>'
        +     '<div style="display:flex;justify-content:space-between;border-bottom:1px dashed #2a2a36;padding:6px 0"><span class="mono" style="font-size:11px;opacity:.7">OWNED</span><span class="mn" style="font-weight:700">'+owned.length+'</span></div>'
        +     '<div style="display:flex;justify-content:space-between;border-bottom:1px dashed #2a2a36;padding:6px 0"><span class="mono" style="font-size:11px;opacity:.7">WISHLIST</span><span class="mn" style="font-weight:700;color:var(--amber)">'+wishlistItems.length+'</span></div>'
        +     '<div style="display:flex;justify-content:space-between;padding:6px 0"><span class="mono" style="font-size:11px;opacity:.7">ARCHIVED</span><span class="mn" style="font-weight:700;opacity:.65">'+soldItems.length+'</span></div>'
        +   '</div>'
        + '</div>'

        // CENTER — LATEST.HAUL
        + latestBlock

        // RIGHT — copy + total
        + '<div style="display:flex;flex-direction:column;gap:14px">'
        +   '<div style="background:var(--cream);border-radius:24px;padding:18px 22px;flex:1;display:flex;flex-direction:column;justify-content:space-between;min-height:160px">'
        +     '<div class="mono" style="font-size:10px;letter-spacing:.14em;opacity:.55">TOTAL.INVESTED</div>'
        +     '<div class="display" style="font-size:38px;color:oklch(0.62 0.22 25)">$'+Math.round(totalSpentAll).toLocaleString()+'</div>'
        +     '<div class="mono" style="font-size:10px;letter-spacing:.06em;opacity:.6">ACROSS '+cats.length+' CATEGORIES</div>'
        +   '</div>'
        +   '<div style="background:var(--cream);border-radius:24px;padding:18px 22px;flex:1;min-height:160px;display:flex;flex-direction:column;justify-content:space-between">'
        +     '<div><div class="display" style="font-size:18px;line-height:1.1">OBJECTS ARE THE</div><div class="display" style="font-size:18px;line-height:1.1;color:oklch(0.62 0.22 25)">NEW CURRENCY.</div></div>'
        +     '<div style="font-size:11px;opacity:.65;line-height:1.6">每件收藏都是一段故事，也是一筆資產。<br/>追蹤、保存、欣賞。</div>'
        +   '</div>'
        + '</div>'
        + '</div>';
    })()

    // ─── Existing KPI block ────────────────────────────
    + '<div style="display:grid;grid-template-columns:1.1fr 1fr;gap:14px;margin-bottom:18px">'
    +   '<div class="section dark" style="padding:24px 28px;display:flex;gap:24px;align-items:center;flex-wrap:wrap">'
    +     '<div style="position:relative;flex-shrink:0">'
    +       '<svg width="144" height="144" style="display:block">'
    +         '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#22222c" stroke-width="' + sw + '"/>'
    +         arcSegs
    +       '</svg>'
    +       '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column">'
    +         '<div class="display" style="font-size:32px;color:var(--cream);line-height:.85">' + owned.length + '</div>'
    +         '<div class="mono" style="font-size:9px;color:var(--cream);opacity:.55;letter-spacing:.14em;margin-top:4px">ITEMS</div>'
    +       '</div>'
    +     '</div>'
    +     '<div style="flex:1;min-width:200px">'
    +       '<div class="mono" style="font-size:10px;letter-spacing:.16em;opacity:.55;margin-bottom:6px">VAULT / TOTAL.OWNED</div>'
    +       '<div class="display" style="font-size:34px;color:var(--cream);line-height:.9;margin-bottom:14px">YOUR COLLECTION</div>'
    +       '<div style="display:flex;flex-direction:column;gap:0">' + catRowsHtml + '</div>'
    +     '</div>'
    +   '</div>'
    +   '<div style="display:flex;flex-direction:column;gap:10px">' + statCardsHtml + '</div>'
    + '</div>';

  // ─── Filter pills ────────────────────────────────────────
  const pillsEl = document.getElementById('coll-pills');
  pillsEl.innerHTML =
    '<span class="mono" style="font-size:10px;letter-spacing:.14em;opacity:.55;margin-right:6px">FILTER</span>'
    + cats.map(c=>{
        const active = collCatFilter === c;
        const color  = CAT_COLORS[c] || '#475569';
        const style = active
          ? 'background:'+color+';color:#fff;'
          : 'background:transparent;color:var(--ink);opacity:.55;border:1px solid rgba(13,13,16,.2);';
        return '<button onclick="filterColl(\''+c+'\')" class="pill-btn" style="'+style+'padding:8px 16px;font-size:11px">'+(CAT_CODE[c]||'MSC')+' · '+c+' '+(catCounts[c]||0)+'</button>';
      }).join('');

  // ─── Body: cabinet groups ────────────────────────────────
  let filtered = owned.filter(r=>r[4]===collCatFilter);
  if (collSearch){
    const q = collSearch.toLowerCase();
    filtered = filtered.filter(r=>{
      const ipName = (_collSeries[String(r[6]||'')]?.name || '').toLowerCase();
      const tagStr = parseTags(r[13]).join(' ').toLowerCase();
      return (r[3]||'').toLowerCase().includes(q)
          || (r[5]||'').toLowerCase().includes(q)
          || (r[9]||'').toLowerCase().includes(q)
          || ipName.includes(q)
          || tagStr.includes(q);
    });
  }

  const typeMap = {};
  filtered.forEach(r=>{ const t=r[5]||''; if(!typeMap[t]) typeMap[t]=[]; typeMap[t].push(r); });
  const sortedTypes = Object.keys(typeMap).sort((a,b)=>{ if(!a) return 1; if(!b) return -1; return a.localeCompare(b,'zh-TW'); });

  const cabinetHtml = filtered.length
    ? sortedTypes.map(type=>{
        const items = typeMap[type];
        const label = type || '未分類';
        const collapsed = collCollapsed.has(type);
        const chev = collapsed ? '▸' : '▾';
        const gridHtml = collapsed ? '' : '<div class="coll-grid">' + items.map(makeCollCard).join('') + '</div>';
        return '<div style="margin-bottom:' + (collapsed?'10':'28') + 'px">'
          + '<div class="cab-head" data-type="' + type.replace(/"/g,'&quot;') + '" onclick="toggleCabinet(this.dataset.type)">'
          +   '<span class="mono" style="font-size:10px;letter-spacing:.14em;opacity:.55">CABINET</span>'
          +   '<span class="display" style="font-size:20px;color:var(--ink)">' + label + '</span>'
          +   '<span class="mono" style="font-size:10px;color:var(--ink);opacity:.6">[' + items.length + ' UNITS]</span>'
          +   '<div style="flex:1;height:1px;background:rgba(13,13,16,.1)"></div>'
          +   '<span class="mono" style="font-size:14px;color:var(--ink);opacity:.7">' + chev + '</span>'
          + '</div>'
          + gridHtml
          + '</div>';
      }).join('')
    : '<div class="empty">' + (collSearch ? 'NO.MATCH / 找不到符合的收藏' : 'EMPTY / 此分類尚無收藏') + '</div>';

  // Wishlist
  const wishHtml = wishlistItems.length
    ? '<div class="section cream" style="padding:22px 24px;margin-top:24px;border:1px dashed var(--amber)">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'
      +   '<div><div class="section-title" style="color:var(--amber)">✦ WISHLIST</div><div class="section-sub">願望清單</div></div>'
      +   '<span class="chip"><span class="star">★</span> ' + wishlistItems.length + ' ITEMS</span>'
      + '</div>'
      + '<div class="coll-grid">'
      + wishlistItems.map(r=>{
          const catColor = CAT_COLORS[r[4]] || '#475569';
          const catCode  = CAT_CODE[r[4]] || 'MSC';
          return '<div class="coll-card" onclick="showCollPanel(\''+r[0]+'\')" style="opacity:.85;border-style:dashed;background:rgba(245,158,11,.04);border-color:var(--amber)">'
            + '<div class="coll-img" style="background:rgba(245,158,11,.06)">'
            +   '<span class="display" style="font-size:36px;color:var(--amber);opacity:.6">'+catCode+'</span>'
            + '</div>'
            + '<div class="coll-body">'
            +   '<div class="mono" style="font-size:9px;font-weight:700;letter-spacing:.12em;color:var(--amber);margin-bottom:5px">★ WISH · ' + catCode + '</div>'
            +   '<div style="font-size:13px;font-weight:700;color:var(--ink);line-height:1.35;opacity:.85">'+(r[3]||'')+'</div>'
            + '</div>'
            + '</div>';
        }).join('')
      + '</div>'
    + '</div>'
    : '';

  // Sold collapsible
  const soldHtml = soldItems.length
    ? '<details style="margin-top:18px"><summary class="mono" style="cursor:pointer;font-size:10px;letter-spacing:.14em;opacity:.55;padding:10px 0">▸ ARCHIVED / 已出售 ' + soldItems.length + ' 件</summary>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">'
      + soldItems.map(r=>'<span class="mono" style="font-size:11px;color:var(--ink);opacity:.55;background:rgba(13,13,16,.06);padding:6px 12px;border-radius:6px">'+(r[3]||'')+'</span>').join('')
      + '</div></details>'
    : '';

  document.getElementById('coll-body').innerHTML = cabinetHtml + wishHtml + soldHtml;
}
