/* ── Foriches / ACTIVE TAB ────────────────────────────────────── */

let _actTrades  = [];   // parsed trade_log rows (completed trades)
let _actSnaps   = [];   // account_snapshots rows
let _actSubTab  = 'overview';

/* ── entry point ─────────────────────────────────────────────── */
function renderActive() {
  _actSubTab = 'overview';
  const el = document.getElementById('content');
  el.innerHTML = '<div class="empty"><span class="spin"></span> LOADING...</div>';

  Promise.all([
    fetchSheet(SHEETS.active,          COLL_SHEET_ID),
    fetchSheet('account_snapshots',    COLL_SHEET_ID).catch(() => []),
  ]).then(([tradeRows, snapRows]) => {
    _actTrades = _actParseTrades(tradeRows);
    _actSnaps  = _actParseSnaps(snapRows);
    el.innerHTML = _actShellHtml();
    _actRenderBody();
  }).catch(e => {
    el.innerHTML = '<div class="empty">ERR · ' + e.message + '</div>';
  });
}

/* ─────────────── parsers ──────────────────────────────────────── */
const _n = v => parseFloat(String(v || '').replace(/,/g, '')) || 0;

function _actParseTrades(rows) {
  // trade_log columns: ticker, market, account, buy_date, sell_date,
  //   shares, avg_buy_price, avg_sell_price, buy_reason, sell_reason, notes
  return rows.filter(r => r[0]).map(r => {
    const shares  = _n(r[5]);
    const buyPx   = _n(r[6]);
    const sellPx  = _n(r[7]);
    const basis   = buyPx * shares;
    const pnl     = (sellPx > 0 && basis > 0) ? (sellPx - buyPx) * shares : null;
    const ret     = (pnl !== null && basis > 0) ? pnl / basis : null;
    const buyMs   = r[3] ? new Date(String(r[3]).slice(0, 10)).getTime() : null;
    const sellMs  = r[4] ? new Date(String(r[4]).slice(0, 10)).getTime() : null;
    const holdDays = (buyMs && sellMs) ? Math.round((sellMs - buyMs) / 86400000) : null;
    return {
      ticker:      String(r[0] || ''),
      market:      String(r[1] || ''),
      account:     String(r[2] || ''),
      buy_date:    String(r[3] || '').slice(0, 10),
      sell_date:   String(r[4] || '').slice(0, 10),
      shares, buyPx, sellPx, basis, pnl, ret, holdDays,
      buy_reason:  String(r[8]  || ''),
      sell_reason: String(r[9]  || ''),
      notes:       String(r[10] || ''),
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

/* ─────────────── shell & navigation ──────────────────────────── */
function _actShellHtml() {
  const TABS = [
    ['overview', 'OVERVIEW', '帳戶績效'],
    ['journal',  'JOURNAL',  '交易日誌'],
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
      margin-bottom:18px;gap:2px">
    ${btns}
  </div>
  <div id="act-body"></div>`;
}

function _actSwitch(id) {
  _actSubTab = id;
  ['overview', 'journal'].forEach(s => {
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
  body.innerHTML = _actSubTab === 'overview' ? _actOverviewHtml() : _actJournalHtml();
}

/* ─────────────── shared helpers ──────────────────────────────── */
const _MKC = { US: 'oklch(0.62 0.22 25)', TW: 'oklch(0.72 0.17 145)' };
function _mkBadge(mkt) {
  return `<span class="mbadge" style="background:${_MKC[mkt] || _MKC.TW}">${mkt}</span>`;
}
function _retStr(v) {
  if (v === null || v === undefined) return '—';
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%';
}
function _retColor(v) {
  if (v === null || v === undefined) return 'var(--cream)';
  return v > 0 ? 'var(--green)' : v < 0 ? 'var(--signal)' : 'var(--cream)';
}
function _retColorInk(v) {
  if (v === null || v === undefined) return 'var(--ink)';
  return v > 0 ? 'var(--green)' : v < 0 ? 'var(--signal)' : 'var(--ink)';
}
function _fmtUsd(v) {
  const sign = v >= 0 ? '+' : '';
  return sign + '$' + Math.abs(v).toFixed(2);
}

/* ─────────────── snapshot return helpers ─────────────────────── */
function _dietzPeriod(vStart, vEnd, cf) {
  const denom = vStart + cf / 2;
  return denom > 0 ? (vEnd - vStart - cf) / denom : null;
}

function _calcSnapReturns(snaps) {
  if (snaps.length < 2) return null;
  const year = new Date().getFullYear();

  const periods = [];
  for (let i = 0; i < snaps.length - 1; i++) {
    const r = _dietzPeriod(snaps[i].value, snaps[i + 1].value, snaps[i + 1].deposit);
    periods.push({ from: snaps[i].date, to: snaps[i + 1].date, ret: r });
  }

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

/* ══════════════ OVERVIEW ══════════════════════════════════════ */
function _actOverviewHtml() {
  const snaps  = _actSnaps;
  const trades = _actTrades;

  /* ── Performance banner (snapshots) ── */
  let perfHtml = '';
  if (!snaps.length) {
    perfHtml = `<div style="background:var(--ink);color:var(--cream);border-radius:24px;
        padding:22px 28px;margin-bottom:14px">
      <div class="mono" style="font-size:9px;letter-spacing:.15em;opacity:.5;margin-bottom:8px">
        PERFORMANCE / 帳戶績效</div>
      <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:800;font-size:18px">
        尚未記錄快照 · 無法計算報酬率</div>
      <div class="mono" style="font-size:10px;opacity:.45;margin-top:6px;line-height:1.8">
        在 Sheets「account_snapshots」填入今日帳戶總值作為基準<br/>
        每月底再填一筆 → 報酬率自動計算
      </div>
    </div>`;
  } else {
    const latest    = snaps[snaps.length - 1];
    const calc      = _calcSnapReturns(snaps);
    const daysSince = Math.round((Date.now() - new Date(latest.date).getTime()) / 86400000);
    const needsUpd  = daysSince > 25;

    const ytdStr   = calc?.ytd != null ? _retStr(calc.ytd) : snaps.length < 2 ? '需要 ≥2 筆' : '—';
    const ytdColor = calc?.ytd != null ? _retColor(calc.ytd) : 'rgba(236,231,220,.4)';
    const lpStr    = calc?.lastPeriod?.ret != null ? _retStr(calc.lastPeriod.ret) : '—';
    const lpColor  = calc?.lastPeriod?.ret != null ? _retColor(calc.lastPeriod.ret) : 'rgba(236,231,220,.4)';
    const lpLabel  = calc?.lastPeriod
      ? calc.lastPeriod.from.slice(5) + ' → ' + calc.lastPeriod.to.slice(5) : '—';
    const valStr   = '$' + latest.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    perfHtml = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
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
          color:${needsUpd ? 'var(--signal)' : 'var(--green)'}">
          ${needsUpd ? '⚠ 建議本月更新' : '● ' + (daysSince === 0 ? '今天記錄' : daysSince + ' 天前')}</div>
      </div>
    </div>`;
  }

  /* ── Snapshot history timeline ── */
  let histHtml = '';
  if (snaps.length >= 2) {
    const calc = _calcSnapReturns(snaps);
    const rows = calc.periods.map(p => {
      const color = p.ret !== null ? _retColorInk(p.ret) : 'var(--ink)';
      return `<tr>
        <td class="mn" style="opacity:.65">${p.from.slice(5)}</td>
        <td class="mn" style="opacity:.65">${p.to.slice(5)}</td>
        <td class="mn" style="color:${color};font-weight:700">${_retStr(p.ret)}</td>
      </tr>`;
    }).reverse().join('');

    histHtml = `<div class="section cream" style="margin-bottom:14px">
      <div class="section-hd">
        <div>
          <div class="section-title">SNAPSHOT HISTORY / 快照紀錄</div>
          <div class="section-sub">各期間報酬率 · Modified Dietz</div>
        </div>
      </div>
      <div class="tbl-wrap"><table class="t"><thead><tr>
        <th>FROM<span class="zh">起</span></th>
        <th>TO<span class="zh">迄</span></th>
        <th>RETURN<span class="zh">報酬率</span></th>
      </tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
  }

  /* ── Trading stats summary (from trade_log) ── */
  let statsHtml = '';
  if (!trades.length) {
    statsHtml = `<div style="background:var(--ink);color:var(--cream);border-radius:24px;
        padding:22px 28px">
      <div class="mono" style="font-size:9px;letter-spacing:.15em;opacity:.5;margin-bottom:8px">
        TRADING ACTIVITY / 交易紀錄</div>
      <div style="font-family:'Big Shoulders Display',sans-serif;font-weight:800;font-size:18px">
        尚無交易紀錄</div>
      <div class="mono" style="font-size:10px;opacity:.45;margin-top:6px">
        在 Sheets「trade_log」填入已完成的交易 → JOURNAL 頁面顯示檢討
      </div>
    </div>`;
  } else {
    const withRet = trades.filter(t => t.ret !== null);
    const winners = withRet.filter(t => t.ret > 0);
    const winRate = withRet.length ? winners.length / withRet.length : null;
    const avgRet  = withRet.length
      ? withRet.reduce((s, t) => s + t.ret, 0) / withRet.length : null;
    const usTrades = trades.filter(t => t.market === 'US');
    const twTrades = trades.filter(t => t.market !== 'US');
    const usPnl = usTrades.filter(t => t.pnl !== null).reduce((s, t) => s + t.pnl, 0);
    const twPnl = twTrades.filter(t => t.pnl !== null).reduce((s, t) => s + t.pnl, 0);

    statsHtml = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));
        gap:14px">
      <div class="kpi cream">
        <div class="kpi-label">WIN RATE<span class="zh" style="display:block">勝率</span></div>
        <div class="kpi-value" style="color:var(--ink)">
          ${winRate !== null ? (winRate * 100).toFixed(0) + '%' : '—'}</div>
        <div class="kpi-sub">${winners.length}W ${withRet.length - winners.length}L · ${trades.length} 筆</div>
      </div>
      <div class="kpi cream">
        <div class="kpi-label">AVG RETURN<span class="zh" style="display:block">每筆平均</span></div>
        <div class="kpi-value" style="color:${_retColorInk(avgRet)};font-size:32px">
          ${_retStr(avgRet)}</div>
        <div class="kpi-sub">已平倉</div>
      </div>
      ${usTrades.length ? `<div class="kpi cream">
        <div class="kpi-label">US P&amp;L<span class="zh" style="display:block">美股損益</span></div>
        <div class="kpi-value" style="color:${_retColorInk(usPnl)};font-size:28px">
          ${_fmtUsd(usPnl)}</div>
        <div class="kpi-sub">${usTrades.length} 筆</div>
      </div>` : ''}
      ${twTrades.length ? `<div class="kpi cream">
        <div class="kpi-label">TW P&amp;L<span class="zh" style="display:block">台股損益</span></div>
        <div class="kpi-value" style="color:${_retColorInk(twPnl)};font-size:28px">
          ${twPnl >= 0 ? '+' : ''}NT$${Math.round(Math.abs(twPnl)).toLocaleString('zh-TW')}</div>
        <div class="kpi-sub">${twTrades.length} 筆</div>
      </div>` : ''}
    </div>`;
  }

  return perfHtml + histHtml + statsHtml;
}

/* ══════════════ JOURNAL ═══════════════════════════════════════ */
function _actJournalHtml() {
  if (!_actTrades.length) {
    return `<div class="empty">NO TRADES YET · 在 Sheets「trade_log」填入已完成的交易</div>`;
  }

  const trades   = _actTrades;
  const withRet  = trades.filter(t => t.ret !== null);
  const winners  = withRet.filter(t => t.ret > 0);
  const winRate  = withRet.length ? winners.length / withRet.length : null;
  const avgRet   = withRet.length
    ? withRet.reduce((s, t) => s + t.ret, 0) / withRet.length : null;
  const withDays = trades.filter(t => t.holdDays != null);
  const avgDays  = withDays.length
    ? withDays.reduce((s, t) => s + t.holdDays, 0) / withDays.length : null;

  const usTrades = trades.filter(t => t.market === 'US');
  const twTrades = trades.filter(t => t.market !== 'US');
  const usPnl    = usTrades.filter(t => t.pnl !== null).reduce((s, t) => s + t.pnl, 0);
  const twPnl    = twTrades.filter(t => t.pnl !== null).reduce((s, t) => s + t.pnl, 0);

  const stats = `<div class="kpi-row" style="margin-bottom:18px">
    <div class="kpi cream">
      <div class="kpi-label">WIN RATE<span class="zh" style="display:block">勝率</span></div>
      <div class="kpi-value" style="color:var(--ink)">
        ${winRate !== null ? (winRate * 100).toFixed(0) + '%' : '—'}</div>
      <div class="kpi-sub">${winners.length}W ${withRet.length - winners.length}L · ${trades.length} 筆</div>
    </div>
    <div class="kpi cream">
      <div class="kpi-label">AVG RETURN<span class="zh" style="display:block">平均報酬率</span></div>
      <div class="kpi-value" style="color:${_retColorInk(avgRet)};font-size:32px">
        ${_retStr(avgRet)}</div>
      <div class="kpi-sub">每筆平均</div>
    </div>
    <div class="kpi cream">
      <div class="kpi-label">AVG HOLD<span class="zh" style="display:block">平均持倉天數</span></div>
      <div class="kpi-value" style="color:var(--ink)">
        ${avgDays != null ? Math.round(avgDays) : '—'}</div>
      <div class="kpi-sub">DAYS</div>
    </div>
    <div class="kpi cream">
      <div class="kpi-label">REALIZED P&amp;L</div>
      ${usTrades.length ? `<div style="font-family:'Big Shoulders Display',sans-serif;
          font-weight:800;font-size:20px;color:${_retColorInk(usPnl)};margin-bottom:4px">
        ${_fmtUsd(usPnl)} USD</div>` : ''}
      ${twTrades.length ? `<div style="font-family:'Big Shoulders Display',sans-serif;
          font-weight:800;font-size:20px;color:${_retColorInk(twPnl)}">
        ${twPnl >= 0 ? '+' : ''}NT$${Math.round(Math.abs(twPnl)).toLocaleString()} TWD</div>` : ''}
    </div>
  </div>`;

  const rows = [...trades]
    .sort((a, b) => (b.sell_date || b.buy_date).localeCompare(a.sell_date || a.buy_date))
    .map(t => `<tr>
      <td>
        <div class="code" style="color:var(--ink)">${t.ticker}</div>
        <div style="font-size:10px;opacity:.45;font-family:'JetBrains Mono',monospace;margin-top:2px">
          ${t.account}</div>
      </td>
      <td>${_mkBadge(t.market)}</td>
      <td class="mn" style="font-size:11px;line-height:1.8">
        <div style="opacity:.7">${t.buy_date}</div>
        <div style="opacity:.35;font-size:10px">↓</div>
        <div style="opacity:.7">${t.sell_date || '—'}</div>
        <div style="opacity:.4;font-size:10px;margin-top:2px">
          ${t.holdDays != null ? t.holdDays + 'd' : '—'}</div>
      </td>
      <td class="mn">$${t.buyPx.toFixed(2)}</td>
      <td class="mn">$${t.sellPx > 0 ? t.sellPx.toFixed(2) : '—'}</td>
      <td class="mn" style="color:${_retColorInk(t.pnl)};font-weight:700">
        ${t.pnl !== null ? _fmtUsd(t.pnl) : '—'}</td>
      <td class="mn" style="color:${_retColorInk(t.ret)};font-weight:700">
        ${_retStr(t.ret)}</td>
      <td style="font-size:11px;max-width:220px">
        ${t.buy_reason ? `<div style="opacity:.72;font-family:'JetBrains Mono',monospace;
            line-height:1.5">▲ ${t.buy_reason}</div>` : ''}
        ${t.sell_reason ? `<div style="font-family:'JetBrains Mono',monospace;font-size:10px;
            opacity:.5;margin-top:3px;line-height:1.5">▼ ${t.sell_reason}</div>` : ''}
        ${t.notes ? `<div style="font-family:'JetBrains Mono',monospace;font-size:10px;
            opacity:.4;margin-top:3px;font-style:italic">✎ ${t.notes}</div>` : ''}
      </td>
    </tr>`).join('');

  return stats + `<div class="section cream">
    <div class="section-hd">
      <div>
        <div class="section-title">JOURNAL / ALL TRADES</div>
        <div class="section-sub">交易日誌 · 進出場檢討</div>
      </div>
      <span class="chip"><span class="star">★</span> ${trades.length} CLOSED</span>
    </div>
    <div class="tbl-wrap"><table class="t"><thead><tr>
      <th>SYMBOL<span class="zh">標的</span></th>
      <th>MKT</th>
      <th>PERIOD<span class="zh">持倉期間</span></th>
      <th>BUY<span class="zh">買入價</span></th>
      <th>SELL<span class="zh">賣出價</span></th>
      <th>P&amp;L<span class="zh">損益</span></th>
      <th>RETURN<span class="zh">報酬率</span></th>
      <th>NOTES<span class="zh">進出場理由 / 檢討</span></th>
    </tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
}
