/* ── Foriches / PASSIVE TAB ─────────────────────────────────── */
const { useState, useMemo, useEffect, useRef } = React;

const PASSIVE_SHEET_ID = "1-sPIxLJvK1Y5rB5TXZQss3O_-ZVy7oMvvIAtegDcxbg";
const csvUrl = s => `https://docs.google.com/spreadsheets/d/${PASSIVE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(s)}`;

const MOCK_S = [
  { ticker:"VWRA",  total_shares:"137",  avg_cost:"149.54", current_price:"179.65", current_value:"776326", target_pct:"52.25%", actual_pct:"35.4%", diff_pct:"-16.85%", xirr:"17.25%", currency:"USD", fx_rate:"31.54" },
  { ticker:"0050",  total_shares:"300",  avg_cost:"168.00", current_price:"185.50", current_value:"556500", target_pct:"25%",    actual_pct:"28.1%", diff_pct:"-3.1%",   xirr:"14.20%", currency:"TWD", fx_rate:"1" },
  { ticker:"00878", total_shares:"2000", avg_cost:"20.50",  current_price:"22.80",  current_value:"456000", target_pct:"15%",    actual_pct:"23.0%", diff_pct:"-8.0%",   xirr:"11.80%", currency:"TWD", fx_rate:"1" },
  { ticker:"VTI",   total_shares:"40",   avg_cost:"210.00", current_price:"245.30", current_value:"318890", target_pct:"7.75%",  actual_pct:"16.1%", diff_pct:"-8.35%",  xirr:"19.40%", currency:"USD", fx_rate:"31.54" },
];
const MOCK_M = [
  { month:"2024/08", total_value:"1620000" },{ month:"2024/09", total_value:"1590000" },
  { month:"2024/10", total_value:"1680000" },{ month:"2024/11", total_value:"1750000" },
  { month:"2024/12", total_value:"1820000" },{ month:"2025/01", total_value:"1866357" },
  { month:"2025/02", total_value:"1910000" },{ month:"2025/03", total_value:"1955000" },
  { month:"2025/04", total_value:"1982400" },
];

function parseCsv(text){
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = parseRow(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseRow(line), obj = {};
    headers.forEach((h,i)=>{ obj[h.trim()] = (vals[i]??"").trim(); });
    return obj;
  }).filter(r=>Object.values(r).some(v=>v!==""));
}
function parseRow(line){
  const res=[]; let cur="", q=false;
  for (let i=0;i<line.length;i++){
    const c=line[i];
    if (c==='"'){ if (q&&line[i+1]==='"'){ cur+='"'; i++; } else q=!q; }
    else if (c===','&&!q){ res.push(cur); cur=""; }
    else cur+=c;
  }
  return [...res,cur];
}
const pnum = s => parseFloat(String(s||0).replace(/[NT$,%\s]/g,"")) || 0;
const ppct = s => { const v=pnum(s); return Math.abs(v)<1&&v!==0 ? v*100 : v; };

const MC = { TW:"oklch(0.72 0.17 145)", US:"oklch(0.62 0.22 25)", UK:"oklch(0.78 0.16 78)" };
const ML = { TW:"TW", US:"US", UK:"UK" };
const getMarket = c => c==="TWD"?"TW":c==="GBP"?"UK":"US";
const pfmt  = (n,d=0) => isNaN(n)||n==null?"—":n.toLocaleString("zh-TW",{maximumFractionDigits:d});
const pfmtP = n => isNaN(n)?"—":(n>=0?"+":"")+n.toFixed(2)+"%";

function PBadge({market}){
  return <span className="mbadge" style={{background:MC[market]||"#94a3b8"}}>{ML[market]||market}</span>;
}

function PieChart({data,size=180}){
  const r=size/2, cx=r, cy=r, ir=r*0.55, or=r*0.92;
  const total=data.reduce((s,d)=>s+d.value,0);
  let angle=-Math.PI/2;
  const slices = data.map(d=>{
    const sweep=(d.value/total)*Math.PI*2;
    const a1=angle, a2=angle+sweep; angle=a2;
    const x1=cx+or*Math.cos(a1), y1=cy+or*Math.sin(a1);
    const x2=cx+or*Math.cos(a2), y2=cy+or*Math.sin(a2);
    const xi1=cx+ir*Math.cos(a1), yi1=cy+ir*Math.sin(a1);
    const xi2=cx+ir*Math.cos(a2), yi2=cy+ir*Math.sin(a2);
    const lg=sweep>Math.PI?1:0;
    return {...d, path:`M${xi1},${yi1} L${x1},${y1} A${or},${or} 0 ${lg},1 ${x2},${y2} L${xi2},${yi2} A${ir},${ir} 0 ${lg},0 ${xi1},${yi1} Z`, pct:(d.value/total*100).toFixed(1)};
  });
  return (
    <div style={{display:"flex",alignItems:"center",gap:24,flexWrap:"wrap"}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s,i)=><path key={i} d={s.path} fill={MC[s.market]||"#94a3b8"} stroke="var(--cream)" strokeWidth="2"/>)}
      </svg>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {slices.map((s,i)=>(
          <div key={i} className="mono" style={{display:"flex",alignItems:"center",gap:10,fontSize:12}}>
            <div style={{width:12,height:12,background:MC[s.market]||"#94a3b8",flexShrink:0}}/>
            <span style={{opacity:.75,minWidth:50}}>{s.label}</span>
            <span style={{fontWeight:700}}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({data, height=280}){
  const ref = useRef(null);
  const [w,setW] = useState(700);
  useEffect(()=>{
    if(!ref.current) return;
    const ro = new ResizeObserver(e=>setW(e[0].contentRect.width));
    ro.observe(ref.current);
    return ()=>ro.disconnect();
  },[]);
  if (!data || !data.length) return null;
  const pad={t:24,r:24,b:60,l:64};
  const iw=Math.max(w-pad.l-pad.r,10), ih=height-pad.t-pad.b;
  const vals=data.map(d=>d.value);
  const minV=Math.min(...vals)*0.97, maxV=Math.max(...vals)*1.02, range=maxV-minV||1;
  const px=i=>pad.l+(i/(data.length-1))*iw;
  const py=v=>pad.t+ih-((v-minV)/range)*ih;
  const pts=data.map((d,i)=>`${px(i)},${py(d.value)}`).join(" ");
  const area=`M${px(0)},${py(data[0].value)} `+data.map((d,i)=>`L${px(i)},${py(d.value)}`).join(" ")+` L${px(data.length-1)},${pad.t+ih} L${px(0)},${pad.t+ih} Z`;
  const yTicks=Array.from({length:5},(_,i)=>minV+(maxV-minV)*(i/4));
  const [tip,setTip]=useState(null);
  return (
    <div ref={ref} style={{width:"100%"}}>
      <svg width="100%" height={height} style={{overflow:"visible"}}>
        <defs>
          <linearGradient id="pag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.62 0.22 25)" stopOpacity={0.35}/>
            <stop offset="100%" stopColor="oklch(0.62 0.22 25)" stopOpacity={0}/>
          </linearGradient>
        </defs>
        {yTicks.map((v,i)=>(
          <g key={i}>
            <line x1={pad.l} y1={py(v)} x2={pad.l+iw} y2={py(v)} stroke="#3a3a48" strokeDasharray="2,4" opacity=".5"/>
            <text x={pad.l-10} y={py(v)+4} textAnchor="end" fill="#9ea0ab" fontSize={10} fontFamily="JetBrains Mono">{(v/10000).toFixed(0)}萬</text>
          </g>
        ))}
        {data.map((d,i)=>{
          const rotate=data.length>8, xPos=px(i), yPos=pad.t+ih+22;
          return rotate
            ? <text key={i} x={xPos} y={yPos} textAnchor="end" fill="#9ea0ab" fontSize={10} fontFamily="JetBrains Mono" transform={`rotate(-40, ${xPos}, ${yPos})`}>{d.month}</text>
            : <text key={i} x={xPos} y={yPos} textAnchor="middle" fill="#9ea0ab" fontSize={10} fontFamily="JetBrains Mono">{d.month}</text>;
        })}
        <path d={area} fill="url(#pag)"/>
        <polyline points={pts} fill="none" stroke="oklch(0.62 0.22 25)" strokeWidth={2.5} strokeLinejoin="round"/>
        {data.map((d,i)=>(
          <g key={i} onMouseEnter={()=>setTip({i,d})} onMouseLeave={()=>setTip(null)} style={{cursor:"pointer"}}>
            <circle cx={px(i)} cy={py(d.value)} r={tip?.i===i?7:4.5} fill="oklch(0.62 0.22 25)" stroke="#fff" strokeWidth={tip?.i===i?2:0}/>
            {tip?.i===i && (
              <g>
                <rect x={px(i)-66} y={py(d.value)-44} width={132} height={32} fill="#fff" stroke="oklch(0.62 0.22 25)" strokeWidth="1.5"/>
                <text x={px(i)} y={py(d.value)-26} textAnchor="middle" fill="#0d0d10" fontSize={11} fontFamily="JetBrains Mono" fontWeight="700">{d.month}</text>
                <text x={px(i)} y={py(d.value)-14} textAnchor="middle" fill="oklch(0.62 0.22 25)" fontSize={11} fontFamily="JetBrains Mono" fontWeight="700">NT${pfmt(d.value)}</text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ── HERO — 3-column showpiece ──────────────────────────── */
function Hero({total, xirr, mg, holdingsN, updated, isMock, onReload}){
  const [now, setNow] = useState(new Date());
  useEffect(()=>{
    const t = setInterval(()=>setNow(new Date()), 1000);
    return ()=>clearInterval(t);
  },[]);
  const pad2 = n => String(n).padStart(2,"0");
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  return (
    <div style={{display:"grid",gridTemplateColumns:"minmax(240px,1fr) minmax(360px,2.2fr)",gap:14,marginBottom:14}}>

      {/* LEFT — USR.VAULT */}
      <div style={{background:"var(--ink)",color:"var(--cream)",borderRadius:28,padding:22,position:"relative",overflow:"hidden",minHeight:360,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div className="mono" style={{fontSize:10,letterSpacing:".12em",opacity:.6}}>SYS.STATUS</div>
          <div className="mono" style={{fontSize:10,letterSpacing:".12em",opacity:.6}}>v.2026.05</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:14,alignItems:"end"}}>
          <div className="scale-ticks dark" style={{height:170}}>
            <span>52%</span><span className="lit">7%</span><span>7%</span><span>15%</span><span className="lit">4%</span><span>15%</span><span>26%</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:6}}>
            <div className="display" style={{fontSize:44,color:"var(--cream)"}}>USR.</div>
            <div className="display" style={{fontSize:30,color:"var(--signal)"}}>VAULT</div>
            <div className="mono" style={{fontSize:10,opacity:.55,marginTop:8,lineHeight:1.5}}>
              ACTIVE.PORTFOLIO<br/>
              <span className="blink">⬢</span> AUTHENTICATED
            </div>
          </div>
        </div>
        <div>
          <div className="display" style={{fontSize:26,color:"var(--cream)",lineHeight:.95}}>
            PASSIVE<br/>STRATEGY<br/>ENGINE
          </div>
          <div className="mono" style={{fontSize:10,marginTop:12,opacity:.5,letterSpacing:".08em"}}>// SYS_001 — RUNNING</div>
        </div>
      </div>

      {/* CENTER — big red */}
      <div style={{background:"var(--signal)",borderRadius:28,padding:"28px 32px",position:"relative",overflow:"hidden",minHeight:360,display:"flex",flexDirection:"column",justifyContent:"space-between",color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div className="mono" style={{fontSize:11,letterSpacing:".14em",fontWeight:700,opacity:.92}}>⏵ LIVE / {time}</div>
          <div className="mono" style={{fontSize:11,letterSpacing:".14em",fontWeight:700,opacity:.92}}>REC ● {isMock ? "MOCK" : "SYNC"}</div>
        </div>
        <div>
          <div className="mono" style={{fontSize:11,opacity:.9,letterSpacing:".18em",marginBottom:10}}>NET.WORTH / TWD</div>
          <div className="display" style={{fontSize:"clamp(40px, 5.8vw, 84px)",color:"#0d0d10",lineHeight:.88,letterSpacing:"-.02em"}}>
            {total ? `$${pfmt(total)}` : "$—"}
          </div>
          <div style={{display:"flex",gap:10,marginTop:18,flexWrap:"wrap"}}>
            <span className="chip dark"><span className="star">★</span> XIRR · {xirr!==null?pfmtP(xirr):"—"}</span>
            <span className="chip dark"><span className="star">★</span> M/M · {mg!==null?pfmtP(mg):"—"}</span>
            <span className="chip dark"><span className="star">★</span> HOLDINGS · {pad2(holdingsN||0)}</span>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
          <div className="mono" style={{fontSize:10,opacity:.85,letterSpacing:".1em",lineHeight:1.6}}>
            SYNCED: {updated || "—"}<br/>
            CHANNEL: GOOGLE_SHEETS / GVIZ
          </div>
        </div>
      </div>

      {/* RIGHT — copy removed */}
    </div>
  );
}

/* ── PORTFOLIO SCORE + BEST / ALERT cards ──────────────── */
function StatusStrip({hs, xirr}){
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
      <BestCard hs={hs} kind="best"/>
      <BestCard hs={hs} kind="off"/>
    </div>
  );
}

function _UnusedRightAndScore({hs, xirr}){
  const score = Math.min(99, Math.round(Math.abs(xirr||0)*3));
  const coord = `${(40+Math.random()*.5).toFixed(2)}°N , ${(74+Math.random()*.3).toFixed(2)}°W`;
  return null;
}

function BestCard({hs, kind}){
  if (!hs || !hs.length) return <div style={{borderRadius:28,background:"var(--cream)",padding:24,minHeight:200}}/>;
  const h = kind === "best"
    ? [...hs].sort((a,b)=>b.xirr - a.xirr)[0]
    : [...hs].sort((a,b)=>Math.abs(b.diffPct) - Math.abs(a.diffPct))[0];
  if (!h) return null;
  const title = kind === "best" ? "TOP / RETURN" : "REBALANCE / ALERT";
  const titleZh = kind === "best" ? "最強單兵" : "失衡警示";
  const v = kind === "best" ? pfmtP(h.xirr) : pfmtP(h.diffPct);
  const accent = kind === "best" ? "var(--green)" : "var(--signal)";
  return (
    <div style={{borderRadius:28,background:"var(--cream)",padding:"22px 24px",minHeight:200,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div className="mono" style={{fontSize:10,letterSpacing:".14em",opacity:.55}}>{title}</div>
          <div style={{fontSize:11,opacity:.7,marginTop:3}}>{titleZh}</div>
        </div>
        <PBadge market={h.market}/>
      </div>
      <div>
        <div className="display" style={{fontSize:54,lineHeight:.9}}>{h.ticker}</div>
        <div className="display" style={{fontSize:28,color:accent,lineHeight:.9,marginTop:4}}>{v}</div>
      </div>
      <div className="mono" style={{fontSize:10,opacity:.6,letterSpacing:".05em"}}>
        現價 / NT${pfmt(h.currentValue)} · 目標 {h.targetPct.toFixed(1)}% / 實際 {h.actualPct.toFixed(1)}%
      </div>
    </div>
  );
}

/* ── Ticker — scrolling holdings bar ────────────────────── */
function PassiveTicker({hs}){
  const sym = h => h.currency==="TWD"?"NT$":h.currency==="GBP"?"£":"$";
  if (!hs.length) return null;
  return (
    <div style={{background:"var(--ink)",color:"var(--cream)",borderRadius:999,padding:"12px 4px",marginBottom:18,overflow:"hidden"}}>
      <div className="ticker-wrap">
        <div className="ticker mono" style={{fontSize:12,letterSpacing:".08em"}}>
          {[0,1].map(k=>(
            <div key={k}>
              {hs.map(h=>(
                <span key={h.ticker+k} style={{display:"inline-flex",alignItems:"center",gap:10}}>
                  <span style={{color:"var(--signal)",fontWeight:700}}>●</span>
                  <span style={{fontWeight:700}}>{h.ticker}</span>
                  <span style={{opacity:.7}}>{sym(h)}{pfmt(h.currentPrice,2)}</span>
                  <span style={{color:h.diffPct>=0?"var(--green)":"var(--signal)"}}>{pfmtP(h.diffPct)}</span>
                  <span style={{opacity:.5}}>|</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PassiveApp(){
  const [tab,setTab]      = useState("overview");
  const [fund,setFund]    = useState("");
  const [loading,setLoad] = useState(true);
  const [isMock,setMock]  = useState(false);
  const [updated,setUpd]  = useState("");
  const [summary,setSum]  = useState([]);
  const [monthly,setMon]  = useState([]);
  const [targets,setTgt]  = useState({});
  const [xirr,setXirr]    = useState(null);

  async function load(){
    setLoad(true);
    try{
      const [r1,r2,r3] = await Promise.all([
        fetch(csvUrl("passive_summary")),
        fetch(csvUrl("passive_monthly")),
        fetch(csvUrl("passive_targets")),
      ]);
      if(!r1.ok||!r2.ok||!r3.ok) throw 0;
      const [t1,t2,t3] = await Promise.all([r1.text(),r2.text(),r3.text()]);
      setSum(parseCsv(t1));
      setMon(parseCsv(t2));
      const rawLines = t2.trim().split("\n");
      if (rawLines.length >= 2){
        const dataRow = parseCsv(rawLines.slice(0,2).join("\n"));
        const xirrVal = dataRow[0] ? ppct(dataRow[0].xirr||"") : null;
        setXirr(xirrVal||null);
      }
      const tgtMap = {};
      parseCsv(t3).forEach(r=>{ tgtMap[r.ticker] = ppct(r.target_pct); });
      setTgt(tgtMap);
      setUpd(new Date().toLocaleString("zh-TW",{hour12:false}));
      setMock(false);
    } catch {
      setSum(MOCK_S); setMon(MOCK_M);
      setTgt({ VWRA:52.25, AGGG:10, JPGL:10, AVGS:10, "0050":6.68, "0051":4.39, "006208":6.68 });
      setXirr(70.33);
      setUpd("MOCK MODE / FALLBACK PREVIEW");
      setMock(true);
    } finally { setLoad(false); }
  }
  useEffect(()=>{ load(); window.__passiveReload = load; },[]);

  const hs = useMemo(()=>summary.map(r=>({
    ticker:r.ticker, totalShares:pnum(r.total_shares),
    avgCost:pnum(r.avg_cost), currentPrice:pnum(r.current_price),
    currentValue:pnum(r.current_value),
    targetPct: targets[r.ticker] ?? ppct(r.target_pct),
    actualPct:ppct(r.actual_pct), diffPct:ppct(r.diff_pct),
    xirr:ppct(r.xirr), currency:(r.currency||"USD").trim(),
    fxRate:pnum(r.fx_rate), market:getMarket((r.currency||"USD").trim()),
  })),[summary, targets]);

  const total = useMemo(()=>hs.reduce((s,h)=>s+h.currentValue,0),[hs]);
  const md = useMemo(()=>monthly.map(r=>({month:r.month,value:pnum(r.total_value),note:r.note||""})).filter(r=>r.value>0),[monthly]);
  const fundNum = parseFloat(fund.replace(/,/g,""))||0;
  const rb = useMemo(()=>hs.map(h=>{
    const tv=(h.targetPct/100)*(total+fundNum);
    const dv=tv-h.currentValue;
    const pTWD=h.currency==="TWD"?h.currentPrice:h.currentPrice*h.fxRate;
    return {...h, targetValue:tv, diffValue:dv, approxShares:pTWD>0?Math.abs(dv)/pTWD:0};
  }),[hs, total, fundNum]);
  const pie = useMemo(()=>{
    const m={};
    hs.forEach(h=>{m[h.market]=(m[h.market]||0)+h.currentValue;});
    return Object.entries(m).map(([market,value])=>({market,value,label:ML[market]||market}));
  },[hs]);
  const mg = useMemo(()=>{
    if (md.length<2) return null;
    return ((md.at(-1).value-md.at(-2).value)/md.at(-2).value)*100;
  },[md]);

  const sym = h => h.currency==="TWD"?"NT$":h.currency==="GBP"?"£":"$";
  const TABS = [
    {id:"overview", l:"OVERVIEW", zh:"資產總覽"},
    {id:"rebalance",l:"REBALANCE",zh:"再平衡"},
    {id:"growth",   l:"GROWTH",   zh:"成長曲線"},
    {id:"return",   l:"RETURN",   zh:"年化報酬"},
  ];

  if (loading){
    return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:80,gap:16}}>
        <div style={{width:36,height:36,border:"3px solid rgba(13,13,16,.15)",borderTopColor:"var(--signal)",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
        <span className="mono" style={{fontSize:12,letterSpacing:".12em",opacity:.7}}>SYNCING_GOOGLE_SHEETS...</span>
      </div>
    );
  }

  return (
    <div>
      {/* HERO */}
      <Hero total={total} xirr={xirr} mg={mg} holdingsN={hs.length} updated={updated} isMock={isMock} onReload={load}/>

      {/* STATUS STRIP */}
      <StatusStrip hs={hs} xirr={xirr}/>

      {/* TICKER */}
      <PassiveTicker hs={hs}/>

      {/* SUB-TABS */}
      <div className="tabline" style={{marginBottom:14}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} className={`tab ${tab===t.id?"on":""}`}>
            {t.l}<span className="zh">/ {t.zh}</span>
          </button>
        ))}
      </div>

      {tab==="overview" && <Overview hs={hs} total={total} pie={pie} sym={sym}/>}
      {tab==="rebalance" && <Rebalance hs={hs} rb={rb} total={total} fund={fund} setFund={setFund} fundNum={fundNum} sym={sym}/>}
      {tab==="growth" && <Growth md={md}/>}
      {tab==="return" && <ReturnTab xirr={xirr} hs={hs} sym={sym}/>}
    </div>
  );
}

function Overview({hs, total, pie, sym}){
  return (
    <div>
      <div className="section dark">
        <div className="section-hd">
          <div><div className="section-title">HOLDINGS / MATRIX</div><div className="section-sub">持股明細與配置差異 · TARGET → SHEETS:passive_targets</div></div>
          <div style={{display:"flex",gap:8}}>
            <span className="chip dark"><span className="star">★</span> {hs.length} ASSETS</span>
            <span className="chip dark"><span className="star">★</span> TOL ±2%</span>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="t">
            <thead><tr>
              <th>CODE<span className="zh">代號</span></th>
              <th>MKT<span className="zh">市場</span></th>
              <th>SHARES<span className="zh">股數</span></th>
              <th>PRICE<span className="zh">現價</span></th>
              <th>VAL/TWD<span className="zh">市值</span></th>
              <th>TGT%<span className="zh">目標</span></th>
              <th>ACT%<span className="zh">實際</span></th>
              <th>Δ<span className="zh">差異</span></th>
              <th>ACT<span className="zh">建議</span></th>
            </tr></thead>
            <tbody>
              {hs.map(h=>{
                const ok=Math.abs(h.diffPct)<=2, over=h.diffPct>0;
                const dc=ok?"var(--green)":over?"var(--amber)":"var(--signal)";
                const need=((h.targetPct-h.actualPct)/100)*total;
                return (
                  <tr key={h.ticker}>
                    <td><span className="code" style={{color:"var(--cream)"}}>{h.ticker}</span></td>
                    <td><PBadge market={h.market}/></td>
                    <td className="mn" style={{opacity:.8}}>{pfmt(h.totalShares,4)}</td>
                    <td className="mn" style={{opacity:.8}}>{sym(h)}{pfmt(h.currentPrice,2)}</td>
                    <td className="mn" style={{fontWeight:700}}>NT${pfmt(h.currentValue)}</td>
                    <td className="mn" style={{opacity:.6}}>{h.targetPct.toFixed(2)}%</td>
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:60,height:5,background:"#2a2a36",position:"relative",flexShrink:0}}>
                          <div style={{width:`${Math.min((h.actualPct/Math.max(h.targetPct,1))*100,150)}%`,maxWidth:"100%",height:"100%",background:MC[h.market]}}/>
                        </div>
                        <span className="mn" style={{fontSize:12,fontWeight:600}}>{h.actualPct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td><span className="mn" style={{fontWeight:700,color:dc,fontSize:14}}>{h.diffPct>=0?"+":""}{h.diffPct.toFixed(1)}%</span></td>
                    <td>
                      {ok ? (
                        <span className="mn" style={{fontSize:10,color:"var(--green)",letterSpacing:".08em",fontWeight:700}}>✓ OK</span>
                      ) : (
                        <div>
                          <span className="mn" style={{fontSize:10,fontWeight:700,letterSpacing:".08em",color:over?"var(--amber)":"var(--signal)"}}>{over?"▼ SELL":"▲ BUY"}</span>
                          <div className="mn" style={{fontSize:11,opacity:.7,marginTop:3}}>NT${pfmt(Math.abs(need))}</div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{padding:"14px 26px",borderTop:"1px solid #1f1f29",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}} className="mono">
          <span style={{fontSize:11,opacity:.6,letterSpacing:".1em"}}>TOTAL / <span style={{color:"var(--cream)",fontWeight:700,opacity:1}}>NT${pfmt(total)}</span></span>
          <span style={{fontSize:11,opacity:.6,letterSpacing:".1em"}}>DIFF ±2% = NORMAL</span>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:14}}>
        <div className="section cream" style={{padding:"22px 26px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
            <div><div className="section-title">MARKET / SPLIT</div><div className="section-sub">市場分布</div></div>
            <span className="chip"><span className="star">★</span> {pie.length} REGIONS</span>
          </div>
          <PieChart data={pie}/>
        </div>
        <div className="section cream" style={{padding:"22px 26px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
            <div><div className="section-title">FX / REFERENCE</div><div className="section-sub">各標的匯率參考</div></div>
            <span className="chip"><span className="star">★</span> SPOT</span>
          </div>
          {hs.map(h=>(
            <div key={h.ticker} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px dashed rgba(13,13,16,.15)"}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <span className="code" style={{fontSize:18}}>{h.ticker}</span>
                <PBadge market={h.market}/>
              </div>
              <div className="mn" style={{fontSize:12,opacity:.75}}>
                {h.currency!=="TWD"?`1 ${h.currency} ⇄ ${pfmt(h.fxRate,4)} TWD`:"TWD / native"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Rebalance({hs, rb, total, fund, setFund, fundNum, sym}){
  return (
    <div>
      <div style={{background:"var(--signal)",color:"#fff",borderRadius:24,padding:"24px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap",marginBottom:14}}>
        <div>
          <div className="mono" style={{fontSize:11,letterSpacing:".16em",opacity:.9,marginBottom:6}}>NEW.CAPITAL.INFLOW / TWD</div>
          <div className="display" style={{fontSize:28,color:"#fff"}}>本次新投入資金</div>
        </div>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{background:"#0d0d10",borderRadius:14,padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
            <span className="mono" style={{color:"var(--cream)",opacity:.7,fontSize:13}}>NT$</span>
            <input type="text" placeholder="50000" value={fund} onChange={e=>setFund(e.target.value)} className="mono"
              style={{background:"transparent",border:"none",color:"#fff",fontSize:18,fontWeight:700,width:160}}/>
          </div>
          {fundNum>0 && (
            <div className="mono" style={{fontSize:12,color:"#fff",letterSpacing:".08em"}}>TOTAL_AFTER → NT${pfmt(total+fundNum)}</div>
          )}
        </div>
      </div>

      <div className="section cream" style={{padding:"22px 26px"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
          <div><div className="section-title">EXECUTION / ORDERS</div><div className="section-sub">各標的再平衡建議</div></div>
          <span className="chip"><span className="star">★</span> AUTO.CALC</span>
        </div>
        {rb.map(h=>{
          const over=h.diffValue<0, noAct=Math.abs(h.diffValue)<1000;
          return (
            <div key={h.ticker} style={{padding:"18px 0",borderBottom:"1px dashed rgba(13,13,16,.15)"}}>
              <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",gap:14,alignItems:"center"}}>
                  <span className="code" style={{fontSize:28}}>{h.ticker}</span>
                  <PBadge market={h.market}/>
                </div>
                <div style={{textAlign:"right"}}>
                  {noAct ? (
                    <span className="mn" style={{fontSize:12,color:"var(--green)",letterSpacing:".1em",fontWeight:700}}>✓ HOLD / 無需調整</span>
                  ) : (
                    <>
                      <div className="display" style={{fontSize:22,color:over?"var(--amber)":"var(--signal)"}}>{over?"▼ SELL":"▲ BUY"} NT${pfmt(Math.abs(h.diffValue))}</div>
                      <div className="mn" style={{fontSize:11,opacity:.6,marginTop:3}}>~ {h.approxShares.toFixed(2)} SHRS @ {sym(h)}{pfmt(h.currentPrice,2)}</div>
                    </>
                  )}
                </div>
              </div>
              <div className="mn" style={{fontSize:11,opacity:.65,marginTop:6,display:"flex",gap:10,flexWrap:"wrap"}}>
                <span>CURRENT / NT${pfmt(h.currentValue)}</span>
                <span style={{color:"var(--signal)"}}>→</span>
                <span>TARGET / NT${pfmt(h.targetValue)} ({h.targetPct.toFixed(2)}%)</span>
              </div>
            </div>
          );
        })}
        {fundNum<=0 && (
          <div style={{marginTop:18,padding:"14px 18px",background:"var(--ink)",color:"var(--cream)",borderRadius:14}}>
            <span className="mn" style={{fontSize:11,letterSpacing:".1em"}}>↑ INPUT.CAPITAL — 填入新投入金額後，系統自動計算最佳資金分配</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Growth({md}){
  const last=md.at(-1), first=md[0];
  const gain = last && first ? ((last.value-first.value)/first.value)*100 : 0;
  return (
    <div className="section dark" style={{padding:"26px 30px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:14}}>
        <div>
          <div className="mn" style={{fontSize:11,opacity:.55,letterSpacing:".14em",marginBottom:6}}>MONTHLY.NET.VALUE / TWD</div>
          <div className="display" style={{fontSize:60,color:"var(--signal)",lineHeight:.9}}>${pfmt(last?.value||0)}</div>
          {last?.note && <div className="mn" style={{fontSize:11,opacity:.6,marginTop:8}}>// {last.note}</div>}
        </div>
        {md.length>=2 && (
          <div style={{textAlign:"right"}}>
            <div className="mn" style={{fontSize:11,opacity:.55,letterSpacing:".12em"}}>CUMULATIVE.SINCE / {first.month}</div>
            <div className="display" style={{fontSize:48,color:gain>=0?"var(--green)":"var(--signal)"}}>{pfmtP(gain)}</div>
          </div>
        )}
      </div>
      {md.length>0
        ? <LineChart data={md} height={300}/>
        : <div className="mn" style={{textAlign:"center",opacity:.5,padding:40}}>NO.DATA / 尚無月度資料</div>
      }
    </div>
  );
}

function ReturnTab({xirr, hs, sym}){
  return (
    <div>
      <div className="section dark" style={{padding:"36px 40px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div className="mn" style={{fontSize:11,letterSpacing:".16em",opacity:.65}}>CURRENT.YEAR / XIRR</div>
          <span className="chip dark"><span className="star">★</span> SHEETS_CALC</span>
        </div>
        <div style={{display:"flex",alignItems:"baseline",gap:18,flexWrap:"wrap"}}>
          <div className="display" style={{fontSize:"clamp(80px,12vw,180px)",lineHeight:.85,color:xirr>=0?"var(--green)":"var(--signal)"}}>{xirr!==null?(xirr>=0?"+":"")+xirr.toFixed(2)+"%":"—"}</div>
          <div className="display" style={{fontSize:48,opacity:.4}}>ANNUALIZED</div>
        </div>
        <div className="mn" style={{fontSize:11,opacity:.55,marginTop:18,letterSpacing:".08em"}}>BASIS / {new Date().getFullYear()} 年初資產 → 今日總市值　·　SHEETS 更新後點 ↻ 即同步</div>
      </div>

      <div className="section cream" style={{padding:"22px 26px"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
          <div><div className="section-title">COST / BASIS</div><div className="section-sub">持倉成本明細</div></div>
          <span className="chip"><span className="star">★</span> {hs.length} POS</span>
        </div>
        <div className="tbl-wrap">
          <table className="t">
            <thead><tr>
              <th>CODE<span className="zh">代號</span></th>
              <th>MKT<span className="zh">市場</span></th>
              <th>SHARES<span className="zh">持股</span></th>
              <th>AVG.COST<span className="zh">均成本</span></th>
              <th>PRICE<span className="zh">現價</span></th>
              <th>VAL/TWD<span className="zh">現值</span></th>
            </tr></thead>
            <tbody>
              {hs.map(h=>(
                <tr key={h.ticker}>
                  <td><span className="code">{h.ticker}</span></td>
                  <td><PBadge market={h.market}/></td>
                  <td className="mn" style={{opacity:.75}}>{pfmt(h.totalShares,4)}</td>
                  <td className="mn" style={{opacity:.75}}>{sym(h)}{pfmt(h.avgCost,2)}</td>
                  <td className="mn" style={{opacity:.75}}>{sym(h)}{pfmt(h.currentPrice,2)}</td>
                  <td className="mn" style={{fontWeight:700}}>NT${pfmt(h.currentValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("passive-root")).render(<PassiveApp/>);
