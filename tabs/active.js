/* ── Foriches / ACTIVE TAB ────────────────────────────────────── */

let _actRows    = [];   // all parsed position rows
let _actWatch   = [];   // watchlist rows
let _actSnaps   = [];   // account_snapshots rows
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
    fetchSheet('account_snapshots',    COLL_SHEET_ID).catch(() => []),
  ]).then(([posRows, watchRows, snapRows]) => {
    _actRows  = _actParse(posRows);
    _actWatch = _actParseWatch(watchRows);
    _actSnaps = _actParseSnaps(snapRows);
    el.innerHTML = _actShellHtml();
    _actRenderBody();
  }).catch(e => {
    el.innerHTML = '<div class="empty">ERR · ' + e.message + '</div>';
  });
}

/* ─────────────── parsers ──────────────────────────────────────── */
// gviz may format numbers with thousands separator (e.g. "1,000.00")
const _n = v => parseFloat(String(v || '').replace(/,/g, '')) || 0;

function _actParse(rows) {
  // gviz strips header row into cols[], so rows[0] is already first data row
  // filter: numeric id + non-empty ticker
  return rows.filter(r => r[3] && !isNaN(Number(String(r[0] || '').replace(/,/g, '')))).map(r => {
    const shares  = _n(r[6]);
    const cost    = _n(r[7]);
    const cur     = _n(r[8]);
    const sl      = _n(r[10]);
    const tgt     = _n(r[12]);
    const isSold  = String(r[13] || '').toLowerCase() === 'sold';
    const hasCur  = cur > 0;
    const exitPx  = isSold ? _n(r[15]) : cur;
    const basis   = cost * shares;
    // P&L and return are null when current_price is blank (holding) or sell_price missing (sold)
    const canCalc = isSold ? (_n(r[15]) > 0) : hasCur;
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

function _actParseSnaps(rows) {
  return rows
    .filter(r => r[0] && r[1])
    .map(r => ({
      date:    String(r[0] || '').slice(0, 10),
      value:   _n(r[1]),
      deposit: _n(r[2]),
      note:    String(r[3] || ''),
    }))
    .filter(s => s.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
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

/* ─────────────── snapshot return helpers ─────────────────────── */
function _dietzPeriod(vStart, vEnd, cf) {
  // Modified Dietz: assume deposit arrives mid-period
  const denom = vStart + cf / 2;
  return denom > 0 ? (vEnd - vStart - cf) / denom : null;
}

function _calcSnapReturns(snaps) {
  if (snaps.length < 2) return null;
  const year = new Date().getFullYear();

  // Per-period returns
  const periods = [];
  for (let i = 0; i < snaps.length - 1; i++) {
    const r = _dietzPeriod(snaps[i].value, snaps[i + 1].value, snaps[i + 1].deposit);
    periods.push({ from: snaps[i].date, to: snaps[i + 1].date, ret: r });
  }

  // YTD: chain from first snapshot of current year
  const ytdIdx = snaps.findIndex(s => s.date >= `${year}-01-01`);
  let ytd = null;
  if (ytdIdx >= 0 && ytdIdx < snaps.length - 1) {
    const ytdPeriods = periods.slice(ytdIdx);
    if (ytdPeriods.every(p => p.ret !== null)) {
      ytd = ytdPeriods.reduce((acc, p) => (1 + acc) * (1 + p.ret) - 1, 0);
    }
  }

  return { ytd, lastPeriod: periods[periods.length - 1], periods };
}

/* ─────────────── performance banner ──────────────────────────── */
function _actPerfBanner() {
  const snaps = _actSnaps;

  if (!snaps.length) {
    return `<div style="background:var(--ink);color:var(--cream);border-radius:24px;
        padding:22px 28px;margin-bottom:14px;display:flex;align-items:center;
        justify-content:space-between;gap:20px;flex-wrap:wrap">
      <div>
        <div class="mono" style="font-size:9px;letter-spacing:.15em;opacity:.5;margin-bottom:8px">
          PERFORMANCE / 帳戶績效</div>
        <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:800;font-size:18px">
          尚未記錄快照 · 無法計算報酬率</div>
        <div class="mono" style="font-size:10px;opacity:.45;margin-top:6px;line-height:1.8">
          在 Sheets「account_snapshots」填入今日帳戶總值作為基準<br/>
          下個月底再填一筆 → 報酬率自動計算
        </div>
      </div>
      <div class="mono" style="font-size:10px;opacity:.35;text-align:right;flex-shrink:0">
        A · date<br/>B · total_value<br/>C · deposit<br/>D · note
      </div>
    </div>`;
  }

  const latest = snaps[snaps.length - 1];
  const calc   = _calcSnapReturns(snaps);
  const daysSince = Math.round((Date.now() - new Date(latest.date).getTime()) / 86400000);
  const needsUpdate = daysSince > 25;

  const ytdStr   = calc?.ytd   != null ? _retStr(calc.ytd)              : snaps.length < 2 ? '需要 ≥2 筆快照' : '—';
  const ytdColor = calc?.ytd   != null ? _retColor(calc.ytd)            : 'rgba(236,231,220,.45)';
  const lpStr    = calc?.lastPeriod?.ret != null ? _retStr(calc.lastPeriod.ret) : '—';
  const lpColor  = calc?.lastPeriod?.ret != null ? _retColor(calc.lastPeriod.ret) : 'rgba(236,231,220,.45)';
  const lpLabel  = calc?.lastPeriod
    ? calc.lastPeriod.from.slice(5) + ' → ' + calc.lastPeriod.to.slice(5) : '—';

  const valStr = '$' + latest.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
      gap:14px;margin-bottom:14px">
    <div style="background:var(--ink);color:var(--cream);border-radius:24px;padding:22px 26px">
      <div class="mono" style="font-size:9px;letter-spacing:.12em;opacity:.5;margin-bottom:10px">
        YTD RETURN / 今年報酬率</div>
      <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:800;
        font-size:clamp(32px,4vw,52px);color:${ytdColor};line-height:1">${ytdStr}</div>
      <div class="mono" style="font-size:10px;opacity:.4;margin-top:10px">
        ${new Date().getFullYear()} YTD · ${snaps.length} 個快照</div>
    </div>
    <div style="background:var(--ink);color:var(--cream);border-radius:24px;padding:22px 26px">
      <div class="mono" style="font-size:9px;letter-spacing:.12em;opacity:.5;margin-bottom:10px">
        LAST PERIOD / 上期報酬率</div>
      <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:800;
        font-size:clamp(32px,4vw,52px);color:${lpColor};line-height:1">${lpStr}</div>
      <div class="mono" style="font-size:10px;opacity:.4;margin-top:10px">${lpLabel}</div>
    </div>
    <div style="background:var(--cream);color:var(--ink);border-radius:24px;padding:22px 26px">
      <div class="mono" style="font-size:9px;letter-spacing:.12em;opacity:.5;margin-bottom:10px">
        LATEST SNAPSHOT / 最近快照</div>
      <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:800;
        font-size:22px;line-height:1">${valStr}</div>
      <div class="mono" style="font-size:10px;opacity:.5;margin-top:8px">${latest.date}</div>
      <div class="mono" style="font-size:10px;margin-top:4px;
        color:${needsUpdate ? 'var(--signal)' : 'var(--green)'}">
        ${needsUpdate ? '⚠ 建議本月更新' : '● ' + (daysSince === 0 ? '今天記錄' : daysSince + ' 天前')}</div>
    </div>
  </div>`;
}

/* ══════════════ OVERVIEW ══════════════════════════════════════ */
function _actOverviewHtml() {
  const open = _actRows.filter(p => !p.isSold);
  if (!open.length) return '<div class="empty">NO OPEN POSITIONS</div>';

  // Group by account × market — never mix TWD and USD
  const groupMap = {};
  open.forEach(p => {
    const key = p.account + '||' + p.market;
    if (!groupMap[key]) groupMap[key] = { acc: p.account, mkt: p.market, ps: [] };
    groupMap[key].ps.push(p);
  });
  const groups = Object.values(groupMap).map(g => {
    const basis  = g.ps.reduce((s, p) => s + p.basis, 0);
    const mv     = g.ps.reduce((s, p) => s + (p.cur > 0 ? p.cur * p.shares : p.basis), 0);
    const knownPnl = g.ps.filter(p => p.pnl !== null);
    const pnl    = knownPnl.length ? knownPnl.reduce((s, p) => s + p.pnl, 0) : null;
    const ret    = (pnl !== null && basis > 0) ? pnl / basis : null;
    const hasMv  = g.ps.some(p => p.cur > 0);
    return { ...g, basis, mv, pnl, ret, hasMv };
  }).sort((a, b) => a.acc.localeCompare(b.acc) || a.mkt.localeCompare(b.mkt));

  // Aggregate totals (split by currency)
  const twGroups  = groups.filter(g => g.mkt !== 'US');
  const usGroups  = groups.filter(g => g.mkt === 'US');
  const _agg = gs => {
    const basis = gs.reduce((s, g) => s + g.basis, 0);
    const mv    = gs.reduce((s, g) => s + g.mv, 0);
    const pnl   = gs.some(g => g.pnl !== null)
      ? gs.filter(g => g.pnl !== null).reduce((s, g) => s + g.pnl, 0) : null;
    const ret   = (pnl !== null && basis > 0) ? pnl / basis : null;
    return { basis, mv, pnl, ret };
  };
  const twAgg = _agg(twGroups);
  const usAgg = _agg(usGroups);

  // sparkbars (by cost basis, coloured by ret)
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

  // ticker bar
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
      padding:12px 4px;margin-bottom:22px;overflow:hidden">
    <div class="ticker-wrap"><div class="ticker mono" style="font-size:12px;letter-spacing:.08em">
      <div>${tickerItems}</div><div>${tickerItems}</div>
    </div></div>
  </div>`;

  // hero (left: deck, center: aggregate summary, right: best gainer)
  const now = new Date();
  const p2  = n => String(n).padStart(2, '0');
  const ts  = p2(now.getHours()) + ':' + p2(now.getMinutes()) + ':' + p2(now.getSeconds());
  const withRet = open.filter(p => p.ret !== null);
  const best = withRet.length ? [...withRet].sort((a, b) => b.ret - a.ret)[0] : null;

  const hero = `
    <div style="display:grid;grid-template-columns:minmax(180px,1fr) minmax(240px,2fr) minmax(180px,1fr);
      gap:14px;margin-bottom:14px">

      <div style="background:var(--ink);color:var(--cream);border-radius:28px;padding:22px;
        display:flex;flex-direction:column;justify-content:space-between;min-height:270px">
        <div class="mono" style="font-size:10px;letter-spacing:.12em;opacity:.55">ACTIVE / DECK</div>
        <div>
          <div class="display" style="font-size:38px">TRADE.</div>
          <div class="display" style="font-size:26px;color:oklch(0.62 0.22 25)">DECK</div>
          <div class="mono" style="font-size:10px;opacity:.5;margin-top:8px;line-height:1.6">
            ALPHA.SEEKER<br/><span class="blink">⏵</span> SESSION OPEN</div>
        </div>
        <div>
          <div class="mono" style="font-size:9px;opacity:.5;margin-bottom:5px;letter-spacing:.1em">DISTRIBUTION</div>
          <div style="height:70px;align-items:flex-end;display:flex;gap:3px">${sparks}</div>
        </div>
      </div>

      <div style="background:oklch(0.62 0.22 25);color:#fff;border-radius:28px;padding:26px 30px;
        display:flex;flex-direction:column;justify-content:space-between;min-height:270px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="mono" style="font-size:11px;letter-spacing:.12em;font-weight:700;opacity:.9">⏵ LIVE / ${ts}</div>
          <div class="mono" style="font-size:11px;font-weight:700;opacity:.9">● ACTIVE</div>
        </div>
        <div>
          <div class="mono" style="font-size:10px;opacity:.85;letter-spacing:.14em;margin-bottom:6px">OPEN POSITIONS</div>
          <div class="stamp" style="font-size:clamp(48px,6vw,84px);color:#0d0d10;line-height:.9">
            ${String(open.length).padStart(2, '0')}</div>
          <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
            ${twAgg.ret !== null ? `<span class="chip dark"><span class="star">★</span> TW · ${_retStr(twAgg.ret)}</span>` : ''}
            ${usAgg.ret !== null ? `<span class="chip dark"><span class="star">★</span> US · ${_retStr(usAgg.ret)}</span>` : ''}
          </div>
        </div>
        <div class="mono" style="font-size:10px;opacity:.85;letter-spacing:.1em;line-height:1.6">
          ACCTS: ${groups.length} &nbsp;·&nbsp; POS: ${open.length}
        </div>
      </div>

      <div style="background:var(--cream);border-radius:28px;padding:22px;
        display:flex;flex-direction:column;justify-content:space-between;min-height:270px">
        <div class="mono" style="font-size:9px;letter-spacing:.13em;opacity:.5">TOP GAINER</div>
        ${best ? `
        <div>
          ${_mkBadge(best.market)}
          <div class="stamp" style="font-size:36px;margin-top:10px">${best.ticker}</div>
          <div class="stamp" style="font-size:22px;color:var(--green);margin-top:4px">${_retStr(best.ret)}</div>
        </div>
        <div>
          <div class="mono" style="font-size:10px;opacity:.55;margin-bottom:2px">${best.account}</div>
          <div class="mono" style="font-size:10px;opacity:.45">P&L ${_fmtPnl(best.pnl, best.market)}</div>
        </div>` : '<div class="mono" style="opacity:.4;font-size:11px">—</div><div></div>'}
      </div>
    </div>`;

  // Account cards — one per account×market, main metric = 帳戶淨值
  const cards = groups.map(g => {
    const ccy    = g.mkt === 'US' ? 'USD' : 'TWD';
    const isUsd  = g.mkt === 'US';
    const mvStr  = isUsd
      ? '$' + g.mv.toFixed(2)
      : 'NT$' + Math.round(g.mv).toLocaleString('zh-TW');
    const basisStr = isUsd
      ? '$' + g.basis.toFixed(0)
      : 'NT$' + Math.round(g.basis).toLocaleString('zh-TW');

    return `
      <div style="background:var(--cream);color:var(--ink);border-radius:24px;padding:24px 26px;
        position:relative;display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="mono" style="font-size:10px;letter-spacing:.12em;opacity:.5;margin-bottom:4px">ACCOUNT</div>
            <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:800;
              font-size:20px;letter-spacing:.02em">${g.acc}</div>
          </div>
          ${_mkBadge(g.mkt)}
        </div>

        <div>
          <div class="mono" style="font-size:9px;letter-spacing:.12em;opacity:.5;margin-bottom:4px">帳戶淨值 / NET VALUE</div>
          <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:800;
            font-size:clamp(24px,3vw,36px);line-height:1;letter-spacing:-.01em">
            ${g.hasMv ? mvStr : basisStr}
          </div>
          ${!g.hasMv ? `<div class="mono" style="font-size:10px;opacity:.4;margin-top:3px">現價未填入，顯示成本</div>` : ''}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <div class="mono" style="font-size:9px;opacity:.45;margin-bottom:3px;letter-spacing:.1em">報酬率</div>
            <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:800;
              font-size:22px;color:${_retColor(g.ret)}">${_retStr(g.ret)}</div>
          </div>
          <div>
            <div class="mono" style="font-size:9px;opacity:.45;margin-bottom:3px;letter-spacing:.1em">損益</div>
            <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:800;
              font-size:18px;color:${_retColor(g.pnl)}">
              ${g.pnl !== null ? _fmtPnl(g.pnl, g.mkt) : '—'}</div>
          </div>
        </div>

        <div style="border-top:1px solid rgba(13,13,16,.1);padding-top:12px;
          display:flex;justify-content:space-between;align-items:center">
          <div class="mono" style="font-size:10px;opacity:.5">
            投入成本 ${basisStr} ${ccy}
          </div>
          <div class="mono" style="font-size:10px;opacity:.5">${g.ps.length} 筆</div>
        </div>
      </div>`;
  }).join('');

  return _actPerfBanner() + hero + ticker
    + `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
        gap:14px">${cards}</div>`;
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
