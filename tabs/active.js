/* ── Foriches / ACTIVE TAB ────────────────────────────────────── */

let _actRows    = [];   // all parsed position rows
let _actWatch   = [];   // watchlist rows
let _actSubTab  = 'overview';
let _actAccFilt = 'ALL';

/* ── entry point (overrides inline renderActive in index.html) ── */
function renderActive() {
  _actSubTab  = 'overview';
  _actAccFilt = 'ALL';
  const el = document.getElementById('content');
  el.innerHTML = '<div class="empty"><span class="spin"></span> LOADING...</div>';

  Promise.all([
    fetchSheet(SHEETS.active,          COLL_SHEET_ID),
    fetchSheet('active_watchlist',     COLL_SHEET_ID).catch(() => []),
  ]).then(([posRows, watchRows]) => {
    _actRows  = _actParse(posRows);
    _actWatch = _actParseWatch(watchRows);
    el.innerHTML = _actShellHtml();
    _actRenderBody();
  }).catch(e => {
    el.innerHTML = '<div class="empty">ERR · ' + e.message + '</div>';
  });
}

/* ─────────────── parsers ──────────────────────────────────────── */
function _actParse(rows) {
  // gviz strips header row into cols[], so rows[0] is already first data row
  return rows.filter(r => r[3] && !isNaN(Number(r[0]))).map(r => {
    const shares  = parseFloat(r[6])  || 0;
    const cost    = parseFloat(r[7])  || 0;
    const cur     = parseFloat(r[8])  || 0;
    const sl      = parseFloat(r[10]) || 0;
    const tgt     = parseFloat(r[12]) || 0;
    const isSold  = String(r[13] || '').toLowerCase() === 'sold';
    const hasCur  = cur > 0;
    const exitPx  = isSold ? (parseFloat(r[15]) || 0) : cur;
    const basis   = cost * shares;
    // P&L and return are null when current_price is blank (holding) or sell_price missing (sold)
    const canCalc = isSold ? (parseFloat(r[15]) > 0) : hasCur;
    const pnl     = canCalc ? (exitPx - cost) * shares : null;
    const ret     = (canCalc && basis > 0) ? pnl / basis : null;

    // stop-loss room: fraction of current price below current → stop loss
    const slRoom  = (sl > 0 && hasCur) ? (cur - sl) / cur : null;
    // target progress 0–1
    const tgtProg = (tgt > cost && cost > 0 && hasCur)
      ? Math.min(1, Math.max(0, (cur - cost) / (tgt - cost))) : null;

    const buyMs   = r[5] ? new Date(String(r[5]).slice(0, 10)).getTime() : null;
    const endMs   = (isSold && r[14])
      ? new Date(String(r[14]).slice(0, 10)).getTime() : Date.now();
    const holdDays = buyMs ? Math.round((endMs - buyMs) / 86400000) : null;

    return {
      id: r[0], market: String(r[1] || ''), account: String(r[2] || ''),
      ticker: String(r[3] || ''), industry: String(r[4] || ''),
      buy_date: String(r[5] || '').slice(0, 10),
      shares, cost, cur,
      buy_reason:  String(r[9]  || ''),
      sl, sl_reason: String(r[11] || ''), tgt,
      isSold,
      sell_date:   String(r[14] || '').slice(0, 10),
      sell_price:  parseFloat(r[15]) || 0,
      exitPx, pnl, basis, ret, slRoom, tgtProg, holdDays,
    };
  });
}

function _actParseWatch(rows) {
  return rows.filter(r => r[2] && r[2] !== 'ticker').map(r => ({
    market:     String(r[0] || ''),
    account:    String(r[1] || ''),
    ticker:     String(r[2] || ''),
    industry:   String(r[3] || ''),
    note:       String(r[4] || ''),
    target_buy: parseFloat(r[5]) || 0,
  }));
}

/* ─────────────── shell & navigation ──────────────────────────── */
function _actShellHtml() {
  const TABS = [
    ['overview',  'OVERVIEW',  '總覽'],
    ['positions', 'POSITIONS', '持倉'],
    ['journal',   'JOURNAL',   '日誌'],
    ['watchlist', 'WATCHLIST', '觀察'],
  ];
  const btns = TABS.map(([id, en, zh]) =>
    `<button id="ast-${id}" onclick="_actSwitch('${id}')"
      style="padding:8px 18px;border-radius:999px;border:none;cursor:pointer;
        font-family:'Big Shoulders Display',sans-serif;font-weight:700;
        letter-spacing:.06em;text-transform:uppercase;font-size:13px;
        transition:all .15s ease;
        ${id === _actSubTab
          ? 'background:var(--ink);color:var(--cream)'
          : 'background:transparent;color:var(--ink);opacity:.55'}">
      ${en}<span style="font-family:'Noto Sans TC',sans-serif;margin-left:6px;
        letter-spacing:.04em;font-size:10px;opacity:.7">/ ${zh}</span>
    </button>`
  ).join('');

  return `<div style="display:inline-flex;padding:3px;border-radius:999px;
      background:rgba(13,13,16,.08);border:1px solid rgba(13,13,16,.1);
      margin-bottom:18px;gap:2px;flex-wrap:wrap">
    ${btns}
  </div>
  <div id="act-body"></div>`;
}

function _actSwitch(id) {
  _actSubTab = id;
  ['overview','positions','journal','watchlist'].forEach(s => {
    const el = document.getElementById('ast-' + s);
    if (!el) return;
    if (s === id) {
      el.style.background = 'var(--ink)';
      el.style.color      = 'var(--cream)';
      el.style.opacity    = '1';
    } else {
      el.style.background = 'transparent';
      el.style.color      = 'var(--ink)';
      el.style.opacity    = '.55';
    }
  });
  _actRenderBody();
}

function _actRenderBody() {
  const body = document.getElementById('act-body');
  if (!body) return;
  if      (_actSubTab === 'overview')  body.innerHTML = _actOverviewHtml();
  else if (_actSubTab === 'positions') body.innerHTML = _actPositionsHtml();
  else if (_actSubTab === 'journal')   body.innerHTML = _actJournalHtml();
  else                                 body.innerHTML = _actWatchlistHtml();
}

/* ─────────────── shared helpers ──────────────────────────────── */
const _MKC = { US: 'oklch(0.62 0.22 25)', TW: 'oklch(0.72 0.17 145)' };

function _mkBadge(mkt) {
  return `<span class="mbadge" style="background:${_MKC[mkt] || _MKC.TW}">${mkt}</span>`;
}
function _fmtPx(v, mkt) {
  return mkt === 'US'
    ? '$' + v.toFixed(2)
    : 'NT$' + Math.round(v).toLocaleString('zh-TW');
}
function _fmtPnl(v, mkt) {
  const sign = v >= 0 ? '+' : '';
  return mkt === 'US'
    ? sign + v.toFixed(2)
    : sign + Math.round(v).toLocaleString('zh-TW');
}
function _retStr(v) {
  if (v === null || v === undefined) return '—';
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%';
}
function _retColor(v) {
  if (v === null || v === undefined) return 'var(--cream)';
  return v > 0 ? 'var(--green)' : v < 0 ? 'var(--signal)' : 'var(--cream)';
}

/* ══════════════ OVERVIEW ══════════════════════════════════════ */
function _actOverviewHtml() {
  const open = _actRows.filter(p => !p.isSold);
  if (!open.length) return '<div class="empty">NO OPEN POSITIONS</div>';

  const accounts = [...new Set(open.map(p => p.account).filter(Boolean))].sort();

  const acctStats = accounts.map(acc => {
    const ps    = open.filter(p => p.account === acc);
    const basis = ps.reduce((s, p) => s + p.basis, 0);
    const pnl   = ps.filter(p => p.pnl !== null).reduce((s, p) => s + p.pnl, 0);
    const ret   = basis > 0 && ps.some(p => p.ret !== null) ? pnl / basis : null;
    const mkt   = ps[0]?.market || 'TW';
    return { acc, ps, basis, pnl, ret, mkt };
  });

  const twd = acctStats.filter(a => a.mkt !== 'US');
  const usd = acctStats.filter(a => a.mkt === 'US');
  const twdBasis = twd.reduce((s, a) => s + a.basis, 0);
  const twdPnl   = twd.reduce((s, a) => s + a.pnl, 0);
  const twdRet   = twdBasis > 0 && twd.some(a => a.ret !== null) ? twdPnl / twdBasis : null;
  const usdBasis = usd.reduce((s, a) => s + a.basis, 0);
  const usdPnl   = usd.reduce((s, a) => s + a.pnl, 0);
  const usdRet   = usdBasis > 0 && usd.some(a => a.ret !== null) ? usdPnl / usdBasis : null;

  // sparkbars by position size
  const top10  = [...open].sort((a, b) => b.basis - a.basis).slice(0, 10);
  const maxB   = Math.max(...top10.map(p => p.basis), 1);
  const sparks = top10.map(p => {
    const h = Math.max(8, Math.round((p.basis / maxB) * 76));
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0">
      <div style="width:100%;max-width:26px;background:${_retColor(p.ret)};height:${h}px;border-radius:2px 2px 0 0"></div>
      <div class="mono" style="font-size:8px;opacity:.65;white-space:nowrap;overflow:hidden;
        text-overflow:ellipsis;max-width:34px;letter-spacing:.04em">${p.ticker}</div>
    </div>`;
  }).join('');

  // hero
  const now = new Date();
  const p2  = n => String(n).padStart(2, '0');
  const ts  = p2(now.getHours()) + ':' + p2(now.getMinutes()) + ':' + p2(now.getSeconds());
  const withRet = open.filter(p => p.ret !== null);
  const best  = withRet.length ? [...withRet].sort((a, b) => b.ret - a.ret)[0] : null;
  const worst = withRet.length > 1 ? [...withRet].sort((a, b) => a.ret - b.ret)[0] : null;

  const hero = `
    <div style="display:grid;grid-template-columns:minmax(190px,1fr) minmax(260px,2fr) minmax(190px,1fr);
      gap:14px;margin-bottom:14px">

      <div style="background:var(--ink);color:var(--cream);border-radius:28px;padding:22px;
        display:flex;flex-direction:column;justify-content:space-between;min-height:290px">
        <div class="mono" style="font-size:10px;letter-spacing:.12em;opacity:.55">ACTIVE / DECK</div>
        <div>
          <div class="display" style="font-size:40px">TRADE.</div>
          <div class="display" style="font-size:28px;color:oklch(0.62 0.22 25)">DECK</div>
          <div class="mono" style="font-size:10px;opacity:.5;margin-top:8px;line-height:1.6">
            ALPHA.SEEKER<br/><span class="blink">⏵</span> SESSION OPEN</div>
        </div>
        <div>
          <div class="mono" style="font-size:9px;opacity:.5;margin-bottom:5px;letter-spacing:.1em">DISTRIBUTION</div>
          <div style="height:76px;align-items:flex-end;display:flex;gap:3px">${sparks}</div>
        </div>
      </div>

      <div style="background:oklch(0.62 0.22 25);color:#fff;border-radius:28px;padding:26px 30px;
        display:flex;flex-direction:column;justify-content:space-between;min-height:290px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="mono" style="font-size:11px;letter-spacing:.13em;font-weight:700;opacity:.9">⏵ LIVE / ${ts}</div>
          <div class="mono" style="font-size:11px;letter-spacing:.13em;font-weight:700;opacity:.9">● ACTIVE</div>
        </div>
        <div>
          <div class="mono" style="font-size:11px;opacity:.9;letter-spacing:.16em;margin-bottom:8px">OPEN POSITIONS</div>
          <div class="stamp" style="font-size:clamp(52px,6.5vw,92px);color:#0d0d10;line-height:.88">
            ${String(open.length).padStart(2, '0')}</div>
          <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
            ${twdBasis > 0 ? `<span class="chip dark"><span class="star">★</span> TW · ${_retStr(twdRet)}</span>` : ''}
            ${usdBasis > 0 ? `<span class="chip dark"><span class="star">★</span> US · ${_retStr(usdRet)}</span>` : ''}
          </div>
        </div>
        <div class="mono" style="font-size:10px;opacity:.85;letter-spacing:.1em;line-height:1.6">
          ACCOUNTS: ${accounts.length} &nbsp;·&nbsp; POSITIONS: ${open.length}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:14px">
        ${best ? `<div style="background:var(--cream);border-radius:24px;padding:16px 20px;flex:1;
            display:flex;flex-direction:column;justify-content:space-between">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div class="mono" style="font-size:9px;letter-spacing:.13em;opacity:.5">TOP GAINER</div>
            ${_mkBadge(best.market)}
          </div>
          <div>
            <div class="stamp" style="font-size:30px">${best.ticker}</div>
            <div class="stamp" style="font-size:18px;color:var(--green);margin-top:2px">${_retStr(best.ret)}</div>
          </div>
          <div class="mono" style="font-size:10px;opacity:.55">${best.account}</div>
        </div>` : ''}
        ${worst ? `<div style="background:var(--cream);border-radius:24px;padding:16px 20px;flex:1;
            display:flex;flex-direction:column;justify-content:space-between">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div class="mono" style="font-size:9px;letter-spacing:.13em;opacity:.5">BOTTOM</div>
            ${_mkBadge(worst.market)}
          </div>
          <div>
            <div class="stamp" style="font-size:30px">${worst.ticker}</div>
            <div class="stamp" style="font-size:18px;color:${_retColor(worst.ret)};margin-top:2px">${_retStr(worst.ret)}</div>
          </div>
          <div class="mono" style="font-size:10px;opacity:.55">${worst.account}</div>
        </div>` : ''}
      </div>
    </div>`;

  // scrolling ticker
  const tickerItems = open.map(p =>
    `<span style="display:inline-flex;align-items:center;gap:10px">
      <span style="color:oklch(0.62 0.22 25);font-weight:700">●</span>
      <span style="font-weight:700">${p.ticker}</span>
      <span style="opacity:.7">${_fmtPx(p.cur, p.market)}</span>
      <span style="color:${_retColor(p.ret)}">${_retStr(p.ret)}</span>
      <span style="opacity:.4">|</span>
    </span>`
  ).join('');
  const ticker = `<div style="background:var(--ink);color:var(--cream);border-radius:999px;
      padding:12px 4px;margin-bottom:18px;overflow:hidden">
    <div class="ticker-wrap"><div class="ticker mono" style="font-size:12px;letter-spacing:.08em">
      <div>${tickerItems}</div><div>${tickerItems}</div>
    </div></div>
  </div>`;

  // totals row
  const totals = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
      gap:14px;margin-bottom:14px">
    ${twdBasis > 0 ? `<div class="kpi">
      <div class="kpi-label">台股合計 P&amp;L / TWD</div>
      <div class="kpi-value" style="color:${_retColor(twdPnl)};font-size:clamp(26px,3.5vw,42px)">
        ${_fmtPnl(twdPnl, 'TW')}</div>
      <div class="kpi-sub">${_retStr(twdRet)} · 成本 NT$${Math.round(twdBasis).toLocaleString()}</div>
    </div>` : ''}
    ${usdBasis > 0 ? `<div class="kpi">
      <div class="kpi-label">美股合計 P&amp;L / USD</div>
      <div class="kpi-value" style="color:${_retColor(usdPnl)};font-size:clamp(26px,3.5vw,42px)">
        ${_fmtPnl(usdPnl, 'US')}</div>
      <div class="kpi-sub">${_retStr(usdRet)} · 成本 $${usdBasis.toFixed(0)}</div>
    </div>` : ''}
  </div>`;

  // per-account KPI cards
  const cards = acctStats.map(a => {
    const ccy = a.mkt === 'US' ? 'USD' : 'TWD';
    return `<div class="kpi cream" style="position:relative">
      <div style="position:absolute;top:16px;right:16px">${_mkBadge(a.mkt)}</div>
      <div class="kpi-label">${a.acc}</div>
      <div class="kpi-value" style="color:${_retColor(a.pnl)};font-size:28px">
        ${_fmtPnl(a.pnl, a.mkt)}</div>
      <div class="kpi-sub" style="margin-top:6px">
        <span style="font-size:14px;font-weight:700;color:${_retColor(a.ret)}">${_retStr(a.ret)}</span>
        &nbsp;·&nbsp;${a.ps.length} 筆<br/>
        成本 ${a.mkt === 'US' ? '$' + a.basis.toFixed(0) : 'NT$' + Math.round(a.basis).toLocaleString()} ${ccy}
      </div>
    </div>`;
  }).join('');

  return hero + ticker + totals + `<div class="kpi-row">${cards}</div>`;
}

/* ══════════════ POSITIONS ═════════════════════════════════════ */
function _actPositionsHtml() {
  const open = _actRows.filter(p => !p.isSold);
  if (!open.length) return '<div class="empty">NO OPEN POSITIONS</div>';

  const accounts = [...new Set(open.map(p => p.account).filter(Boolean))].sort();
  const pills = ['ALL', ...accounts].map(acc => {
    const on = _actAccFilt === acc;
    return `<button onclick="_actAccFilt='${acc}';_actRenderBody()"
      style="padding:7px 16px;border-radius:999px;cursor:pointer;
        font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.1em;
        transition:all .15s;
        ${on
          ? 'background:var(--ink);color:var(--cream);border:1px solid var(--ink)'
          : 'background:transparent;color:var(--ink);border:1px solid rgba(13,13,16,.2)'}">
      ${acc}
    </button>`;
  }).join('');

  const filtered = _actAccFilt === 'ALL' ? open : open.filter(p => p.account === _actAccFilt);

  const rows = filtered.map(p => {
    // stop-loss bar (normalised to 20% room = full green)
    let slHtml = '';
    if (p.slRoom !== null) {
      const roomPct = (p.slRoom * 100).toFixed(1);
      const danger  = p.slRoom < 0.05;
      const warn    = p.slRoom < 0.10;
      const barW    = Math.min(100, p.slRoom / 0.20 * 100);
      const barC    = danger ? 'var(--signal)' : warn ? 'var(--amber)' : 'var(--green)';
      slHtml = `<div>
        <div style="font-size:9px;font-family:'JetBrains Mono',monospace;opacity:.6;
          margin-bottom:3px;letter-spacing:.05em">
          SL ${_fmtPx(p.sl, p.market)} · 空間 ${roomPct}%
        </div>
        <div style="height:4px;background:rgba(255,255,255,.12);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${barW}%;background:${barC};border-radius:2px"></div>
        </div>
      </div>`;
    }

    // target progress bar
    let tgtHtml = '';
    if (p.tgtProg !== null) {
      const pct = Math.round(p.tgtProg * 100);
      tgtHtml = `<div style="margin-top:7px">
        <div style="font-size:9px;font-family:'JetBrains Mono',monospace;opacity:.6;
          margin-bottom:3px;letter-spacing:.05em">
          TGT ${_fmtPx(p.tgt, p.market)} · 進度 ${pct}%
        </div>
        <div style="height:4px;background:rgba(255,255,255,.12);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:var(--amber);border-radius:2px"></div>
        </div>
      </div>`;
    }

    return `<tr>
      <td>
        <div class="code" style="color:var(--cream)">${p.ticker}</div>
        <div style="font-size:10px;opacity:.45;font-family:'JetBrains Mono',monospace;margin-top:2px">${p.industry}</div>
      </td>
      <td>
        ${_mkBadge(p.market)}
        <div style="font-size:10px;opacity:.5;font-family:'JetBrains Mono',monospace;margin-top:4px">${p.account}</div>
      </td>
      <td class="mn" style="opacity:.8">${p.shares.toLocaleString()}</td>
      <td class="mn">${_fmtPx(p.cost, p.market)}</td>
      <td class="mn" style="font-weight:700">${p.cur > 0 ? _fmtPx(p.cur, p.market) : '—'}</td>
      <td class="mn" style="color:${_retColor(p.ret)};font-weight:700">${p.cur > 0 ? _retStr(p.ret) : '—'}</td>
      <td style="min-width:130px">${slHtml}${tgtHtml}</td>
      <td style="font-size:11px;max-width:180px">
        <div style="opacity:.72;font-family:'JetBrains Mono',monospace;line-height:1.5">${p.buy_reason || '—'}</div>
        <div style="font-size:10px;opacity:.4;font-family:'JetBrains Mono',monospace;margin-top:3px">${p.buy_date}</div>
      </td>
    </tr>`;
  }).join('');

  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${pills}</div>
    <div class="section dark">
      <div class="section-hd">
        <div>
          <div class="section-title">POSITIONS / OPEN</div>
          <div class="section-sub">持倉明細 · 止損目標進度</div>
        </div>
        <span class="chip dark"><span class="star">★</span> ${filtered.length} OPEN</span>
      </div>
      <div class="tbl-wrap"><table class="t"><thead><tr>
        <th>SYMBOL<span class="zh">標的</span></th>
        <th>MKT / ACCT<span class="zh">市場 / 帳戶</span></th>
        <th>SHARES<span class="zh">股數</span></th>
        <th>COST<span class="zh">成本價</span></th>
        <th>CURRENT<span class="zh">現價</span></th>
        <th>RETURN<span class="zh">報酬率</span></th>
        <th>SL / TARGET<span class="zh">止損 / 目標</span></th>
        <th>BUY REASON<span class="zh">買入理由</span></th>
      </tr></thead><tbody>${rows || '<tr><td colspan="8" class="empty">NO DATA</td></tr>'}</tbody></table></div>
    </div>`;
}

/* ══════════════ JOURNAL ═══════════════════════════════════════ */
function _actJournalHtml() {
  const sold = _actRows.filter(p => p.isSold);
  if (!sold.length) {
    return '<div class="empty">NO CLOSED TRADES YET · 將 status 欄位填 sold 即可記錄</div>';
  }

  const winners  = sold.filter(p => p.ret > 0);
  const winRate  = winners.length / sold.length;
  const avgRet   = sold.reduce((s, p) => s + p.ret, 0) / sold.length;
  const withDays = sold.filter(p => p.holdDays != null);
  const avgDays  = withDays.length
    ? withDays.reduce((s, p) => s + p.holdDays, 0) / withDays.length : null;

  const twSold = sold.filter(p => p.market !== 'US');
  const usSold = sold.filter(p => p.market === 'US');
  const twPnl  = twSold.reduce((s, p) => s + p.pnl, 0);
  const usPnl  = usSold.reduce((s, p) => s + p.pnl, 0);

  const stats = `<div class="kpi-row" style="margin-bottom:18px">
    <div class="kpi cream">
      <div class="kpi-label">WIN RATE<span class="zh" style="display:block">勝率</span></div>
      <div class="kpi-value" style="color:var(--ink)">${(winRate * 100).toFixed(0)}%</div>
      <div class="kpi-sub">${winners.length}W ${sold.length - winners.length}L · ${sold.length} 筆</div>
    </div>
    <div class="kpi cream">
      <div class="kpi-label">AVG RETURN<span class="zh" style="display:block">平均報酬率</span></div>
      <div class="kpi-value" style="color:${_retColor(avgRet)};font-size:32px">${_retStr(avgRet)}</div>
      <div class="kpi-sub">每筆平均</div>
    </div>
    <div class="kpi cream">
      <div class="kpi-label">AVG HOLD<span class="zh" style="display:block">平均持倉天數</span></div>
      <div class="kpi-value" style="color:var(--ink)">${avgDays != null ? Math.round(avgDays) : '—'}</div>
      <div class="kpi-sub">DAYS</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">REALIZED P&amp;L</div>
      ${twSold.length ? `<div style="font-family:'Big Shoulders Display',sans-serif;font-weight:800;
          font-size:22px;color:${_retColor(twPnl)};margin-bottom:4px">
        ${_fmtPnl(twPnl, 'TW')} TWD</div>` : ''}
      ${usSold.length ? `<div style="font-family:'Big Shoulders Display',sans-serif;font-weight:800;
          font-size:22px;color:${_retColor(usPnl)}">
        ${_fmtPnl(usPnl, 'US')} USD</div>` : ''}
    </div>
  </div>`;

  const rows = [...sold]
    .sort((a, b) => (b.sell_date || b.buy_date || '').localeCompare(a.sell_date || a.buy_date || ''))
    .map(p => `<tr>
      <td>
        <div class="code" style="color:var(--ink)">${p.ticker}</div>
        <div style="font-size:10px;opacity:.45;font-family:'JetBrains Mono',monospace;margin-top:2px">${p.industry}</div>
      </td>
      <td>
        ${_mkBadge(p.market)}
        <div style="font-size:10px;opacity:.5;font-family:'JetBrains Mono',monospace;margin-top:4px">${p.account}</div>
      </td>
      <td class="mn" style="font-size:11px;line-height:1.8">
        <div style="opacity:.7">${p.buy_date}</div>
        <div style="opacity:.35;font-size:10px">↓</div>
        <div style="opacity:.7">${p.sell_date || '—'}</div>
        <div style="opacity:.4;font-size:10px;margin-top:2px">${p.holdDays != null ? p.holdDays + 'd' : '—'}</div>
      </td>
      <td class="mn">${_fmtPx(p.cost, p.market)}</td>
      <td class="mn">${_fmtPx(p.sell_price, p.market)}</td>
      <td class="mn" style="color:${_retColor(p.pnl)};font-weight:700">${_fmtPnl(p.pnl, p.market)}</td>
      <td class="mn" style="color:${_retColor(p.ret)};font-weight:700">${_retStr(p.ret)}</td>
      <td style="font-size:11px;max-width:200px">
        <div style="opacity:.72;font-family:'JetBrains Mono',monospace;line-height:1.5">${p.buy_reason || '—'}</div>
        ${p.sl_reason ? `<div style="font-family:'JetBrains Mono',monospace;font-size:10px;
            opacity:.45;margin-top:3px;color:var(--signal)">${p.sl_reason}</div>` : ''}
      </td>
    </tr>`).join('');

  return stats + `<div class="section cream">
    <div class="section-hd">
      <div>
        <div class="section-title">JOURNAL / CLOSED</div>
        <div class="section-sub">已平倉紀錄 · 交易檢討</div>
      </div>
      <span class="chip"><span class="star">★</span> ${sold.length} CLOSED</span>
    </div>
    <div class="tbl-wrap"><table class="t"><thead><tr>
      <th>SYMBOL<span class="zh">標的</span></th>
      <th>MKT / ACCT<span class="zh">市場 / 帳戶</span></th>
      <th>PERIOD<span class="zh">持倉期間</span></th>
      <th>COST<span class="zh">成本價</span></th>
      <th>EXIT<span class="zh">出場價</span></th>
      <th>P&amp;L<span class="zh">損益</span></th>
      <th>RETURN<span class="zh">報酬率</span></th>
      <th>NOTES<span class="zh">進出場理由</span></th>
    </tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
}

/* ══════════════ WATCHLIST ═════════════════════════════════════ */
function _actWatchlistHtml() {
  if (!_actWatch.length) {
    return '<div class="empty">WATCHLIST EMPTY · 在 Sheets 新增「watchlist」工作表</div>';
  }

  const rows = _actWatch.map(w => `<tr>
    <td><div class="code" style="color:var(--ink)">${w.ticker}</div></td>
    <td>${_mkBadge(w.market)}</td>
    <td style="font-size:12px;opacity:.65;font-family:'JetBrains Mono',monospace">${w.industry}</td>
    <td style="font-size:11px;max-width:260px;line-height:1.6;
      font-family:'JetBrains Mono',monospace;opacity:.72">${w.note || '—'}</td>
    <td class="mn amb" style="font-weight:700">
      ${w.target_buy > 0 ? _fmtPx(w.target_buy, w.market) : '—'}</td>
  </tr>`).join('');

  return `<div class="section cream">
    <div class="section-hd">
      <div>
        <div class="section-title">WATCHLIST / RADAR</div>
        <div class="section-sub">觀察名單 · 等待進場</div>
      </div>
      <span class="chip"><span class="star">★</span> ${_actWatch.length} ON RADAR</span>
    </div>
    <div class="tbl-wrap"><table class="t"><thead><tr>
      <th>SYMBOL<span class="zh">標的</span></th>
      <th>MKT</th>
      <th>INDUSTRY<span class="zh">產業</span></th>
      <th>NOTE<span class="zh">觀察理由</span></th>
      <th>TARGET BUY<span class="zh">目標買入價</span></th>
    </tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
}
