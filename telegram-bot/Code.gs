// ══════════════════════════════════════════════════════════════
//  Cashie 記帳機器人 — Google Apps Script
//  解析策略：本地規則（快速）→ Gemini（僅限模糊輸入）
//  並發策略：doPost 層單一大鎖，序列化所有執行，永不拋出
// ══════════════════════════════════════════════════════════════

const TELEGRAM_TOKEN  = '8584996875:AAGaWTZqwqYZlUonZzQe5SVd1lXGmD6qKwM';
const GEMINI_API_KEY  = 'AIzaSyCyOj_PnI2FNokoiq9KJNMEhfc0US6lkXs';
const SHEET_ID        = '1-sPIxLJvK1Y5rB5TXZQss3O_-ZVy7oMvvIAtegDcxbg';
const SHEET_NAME      = 'cashflow';
const TELEGRAM_API    = 'https://api.telegram.org/bot' + TELEGRAM_TOKEN;
const GEMINI_MODEL    = 'gemini-2.0-flash-lite';
const EXEC_URL        = 'https://script.google.com/macros/s/AKfycbwi7jfwTzOkw4CwEYVO_nHgCsZBKyfSDmgq5A07KjjxvfEBKpSEOMWt_lBjbgcV5nOa/exec';
const ALLOWED_USER_ID = 1041361870;

// ── 規則解析表 ────────────────────────────────────────────────
const CATEGORY_RULES = [
  { kw:['薪資','薪水','月薪','工資'],      cat:'薪資',    type:'income',      col:false },
  { kw:['獎金','紅包','分紅'],             cat:'獎金',    type:'income',      col:false },
  { kw:['投資收益','股利','配息'],          cat:'投資收益', type:'income',      col:false },
  { kw:['房租','租金','房費'],             cat:'房租',    type:'fixed',       col:false },
  { kw:['保險'],                          cat:'保險',    type:'fixed',       col:false },
  { kw:['電信','手機費','網路費','網費'],   cat:'電信費',  type:'fixed',       col:false },
  { kw:['訂閱','Netflix','Spotify','YouTube','Apple One'], cat:'訂閱服務', type:'fixed', col:false },
  { kw:['早餐','午餐','晚餐','消夜','宵夜','餐','飯','麵','鍋','壽司','咖啡','飲料','珍奶','便當','小吃','火鍋'], cat:'餐飲', type:'variable', col:false },
  { kw:['捷運','公車','YouBike','計程車','Uber','加油','油費','停車','高鐵','火車'], cat:'交通', type:'variable', col:false },
  { kw:['電影','演唱會','KTV','遊樂','娛樂','遊戲','酒'],  cat:'娛樂',  type:'variable', col:false },
  { kw:['衣服','鞋','包包','服飾','外套','褲'],            cat:'服飾',  type:'variable', col:false },
  { kw:['醫院','診所','藥','看診','掛號'],                 cat:'醫療',  type:'variable', col:false },
  { kw:['書','課程','補習','學費','教育'],                  cat:'教育',  type:'variable', col:false },
  { kw:['球','簽名球','卡','球員卡','公仔','手辦','模型','周邊','收藏'], cat:'收藏品', type:'variable', col:true },
  { kw:['股票','台積電','聯發科'],         cat:'股票',    type:'investment',  col:false },
  { kw:['ETF','0050','00878','006208'],   cat:'ETF',     type:'investment',  col:false },
  { kw:['基金'],                          cat:'其他投資', type:'investment',  col:false },
];
const CARD_KEYWORDS = ['台新','玉山','國泰','中信','聯邦','永豐','一卡通','悠遊卡','Line Pay','linepay','街口','Apple Pay','JCB'];

// ══════════════════════════════════════════════════════════════
//  去重輔助（在大鎖保護下呼叫，不需自己加鎖）
// ══════════════════════════════════════════════════════════════
function isDuplicate(updateId) {
  if (!updateId) return false;
  const props = PropertiesService.getScriptProperties();
  const ids   = JSON.parse(props.getProperty('processedIds') || '[]');
  return ids.indexOf(updateId) !== -1;
}

function markProcessed(updateId) {
  if (!updateId) return;
  const props = PropertiesService.getScriptProperties();
  const ids   = JSON.parse(props.getProperty('processedIds') || '[]');
  ids.push(updateId);
  if (ids.length > 50) ids.splice(0, ids.length - 50);
  props.setProperty('processedIds', JSON.stringify(ids));
}

// ══════════════════════════════════════════════════════════════
//  Webhook 入口
//
//  並發策略：
//  • 在 doPost 最頂層取得單一腳本鎖（waitLock 25s）
//  • 鎖保護整個流程：去重 + 解析 + 寫入
//  • 永不拋出例外 → Apps Script 永遠回傳 200 → 不產生 302
//  • 第二則訊息靜待第一則完成後再執行
// ══════════════════════════════════════════════════════════════
function doPost(e) {
  var chatId = null;
  const lock = LockService.getScriptLock();

  // 等待前一筆完成（最多 25 秒）；幾乎不可能超時（正常 < 5s）
  try {
    lock.waitLock(25000);
  } catch (lockErr) {
    // 極端罕見：25 秒都等不到，記 log 後直接回 200
    // （不拋出 → 不觸發 302 → 不產生 Telegram 重試風暴）
    Logger.log('Lock wait timeout: ' + lockErr);
    return ok();
  }

  try {
    const body     = JSON.parse(e.postData.contents);
    const updateId = body.update_id;
    const msg      = body.message;
    if (!msg) return ok();

    // ── 去重（鎖內安全讀寫）────────────────────────────────
    if (isDuplicate(updateId)) {
      Logger.log('Duplicate update_id: ' + updateId + ', skipping.');
      return ok();
    }
    markProcessed(updateId);

    // ── 權限 ────────────────────────────────────────────────
    if (ALLOWED_USER_ID !== 0 && msg.from.id !== ALLOWED_USER_ID) return ok();

    chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    if (!text) return ok();

    // ── 指令 ────────────────────────────────────────────────
    if (text === '/start' || text === '/help') {
      sendMsg(chatId,
        '👋 嗨！我是你的 Cashie 記帳機器人\n\n' +
        '直接輸入消費就好：\n' +
        '• 午餐 200\n• 房租 8000 現金\n• 薪資 60000\n• 買了簽名球 1500 台新\n\n' +
        '📊 查詢：\n• 「今天」→ 今日摘要\n• 「本月」→ 月度摘要\n\n' +
        '🗑️ 「刪除上一筆」→ 刪除最新一筆記錄'
      );
      return ok();
    }
    if (text === '今天' || text === '今日')   { sendDailySummary(chatId);   return ok(); }
    if (text === '本月' || text === '這個月') { sendMonthlySummary(chatId); return ok(); }
    if (text === '刪除上一筆' || text === '刪除' || text === '/delete') {
      deleteLastRow(chatId);
      return ok();
    }

    // ── 解析：本地優先，類別為「其他」才用 Gemini ───────────
    var parsed = parseLocally(text);
    if (parsed && parsed.category === '其他') {
      var geminiResult = parseWithGemini(text);
      if (geminiResult && geminiResult.amount) parsed = geminiResult;
    }

    if (!parsed || !parsed.amount) {
      sendMsg(chatId, '❓ 看不懂這筆，試試：\n午餐 200\n房租 8000 現金\n薪資 60000');
      return ok();
    }

    // ── 寫入 Sheets（鎖保護中，不需再加鎖）────────────────
    writeToSheet(parsed);

    const E = { income:'💚', fixed:'🏠', variable:'🛍️', investment:'📈' };
    const L = { income:'收入', fixed:'固定支出', variable:'變動支出', investment:'投資' };
    var reply =
      '✅ 記帳完成！\n\n' +
      '📅 ' + parsed.date + '\n' +
      (E[parsed.type]||'💰') + ' ' + parsed.category + '（' + (L[parsed.type]||parsed.type) + '）\n' +
      '💵 NT$' + Number(parsed.amount).toLocaleString() + '\n' +
      '💳 ' + parsed.card;
    if (parsed.note)             reply += '\n📝 ' + parsed.note;
    if (parsed.collectible_flag) reply += '\n🏷️ 已標記為收藏品';
    reply += '\n\n如需刪除請回覆「刪除上一筆」';
    sendMsg(chatId, reply);

  } catch (err) {
    // 任何錯誤都不再拋出（防止 302），記 log 並通知使用者
    Logger.log('doPost error: ' + err.toString());
    if (chatId) {
      try { sendMsg(chatId, '❌ 發生錯誤，請稍後再試\n(' + err.message + ')'); } catch(e2) {}
    }
  } finally {
    lock.releaseLock();
  }
  return ok();
}

// ── 本地規則解析（< 50ms，永遠可用）────────────────────────
function parseLocally(text) {
  const today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  const amtMatch = text.match(/\d[\d,]*/);
  if (!amtMatch) return null;
  const amount = parseFloat(amtMatch[0].replace(/,/g,''));

  var card = '現金';
  for (var i = 0; i < CARD_KEYWORDS.length; i++) {
    if (text.indexOf(CARD_KEYWORDS[i]) > -1) { card = CARD_KEYWORDS[i]; break; }
  }
  var category = '其他', type = 'variable', collectible = false;
  for (var j = 0; j < CATEGORY_RULES.length; j++) {
    var rule    = CATEGORY_RULES[j];
    var matched = rule.kw.some(function(k){ return text.indexOf(k) > -1; });
    if (matched) { category = rule.cat; type = rule.type; collectible = rule.col; break; }
  }
  var note = text.replace(amtMatch[0],'').replace(card,'').trim();
  return { date:today, amount:amount, type:type, category:category, card:card, note:note, collectible_flag:collectible };
}

// ── Gemini 解析（僅限模糊輸入，deadline 4s）────────────────
function parseWithGemini(text) {
  const today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  const prompt =
    '你是記帳助手，把輸入解析成 JSON。今天：' + today + '\n輸入：「' + text + '」\n\n' +
    'income: 薪資、獎金、投資收益\nfixed: 房租、保險、訂閱服務、電信費\n' +
    'variable: 餐飲、交通、娛樂、服飾、醫療、教育、收藏品、其他\ninvestment: 股票、ETF、其他投資\n\n' +
    '只回傳 JSON：{"date":"' + today + '","amount":數字,"type":"...","category":"...","card":"支付方式(找不到填現金)","note":"備註","collectible_flag":false}\n找不到金額 → null';
  try {
    const res = UrlFetchApp.fetch(
      'https://generativelanguage.googleapis.com/v1/models/' + GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY,
      { method:'post', contentType:'application/json',
        payload: JSON.stringify({ contents:[{parts:[{text:prompt}]}], generationConfig:{temperature:0.1,maxOutputTokens:200} }),
        muteHttpExceptions:true, deadline:4 }
    );
    if (res.getResponseCode() !== 200) return null;
    const raw     = (JSON.parse(res.getContentText()).candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    const cleaned = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/,'').trim();
    if (!cleaned || cleaned === 'null') return null;
    return JSON.parse(cleaned);
  } catch(err) { Logger.log('Gemini: ' + err); return null; }
}

// ── 寫入 Sheets（在大鎖保護下執行，不需再加鎖）────────────
function writeToSheet(data) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  sheet.appendRow([
    data.date, data.amount, data.type, data.category,
    data.card, data.note||'', data.collectible_flag ? 'TRUE' : 'FALSE'
  ]);
  SpreadsheetApp.flush();
}

// ── 刪除最後一筆 ──────────────────────────────────────────────
function deleteLastRow(chatId) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const last  = sheet.getLastRow();
    if (last <= 1) { sendMsg(chatId, '📭 沒有可以刪除的記錄'); return; }
    const row = sheet.getRange(last, 1, 1, 7).getValues()[0];
    sheet.deleteRow(last);
    sendMsg(chatId, '🗑️ 已刪除：\n📅 ' + String(row[0]).slice(0,10) + '\n📂 ' + row[3] + '  💵 NT$' + Number(row[1]).toLocaleString());
  } catch(err) {
    Logger.log('deleteLastRow: ' + err);
    sendMsg(chatId, '❌ 刪除失敗：' + err.message);
  }
}

// ── 今日摘要 ──────────────────────────────────────────────────
function sendDailySummary(chatId) {
  var target = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var rows   = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME).getDataRange().getValues();
  var E = { income:'💚', fixed:'🏠', variable:'🛍️', investment:'📈' };
  var income=0, expense=0, invest=0, lines=[];
  rows.slice(1).forEach(function(r) {
    if (String(r[0]).slice(0,10) !== target) return;
    var amt=parseFloat(r[1])||0, type=String(r[2]||''), cat=String(r[3]||''), card=String(r[4]||'');
    if (type==='income') income+=amt; else if (type==='investment') invest+=amt; else expense+=amt;
    lines.push((E[type]||'💰')+' '+cat+' NT$'+amt.toLocaleString()+(card?'  '+card:''));
  });
  if (!lines.length) { sendMsg(chatId, '📭 '+target+' 還沒有記錄'); return; }
  var msg = '📊 '+target+' 收支摘要\n─────────────────\n'+lines.join('\n')+'\n─────────────────\n';
  if (income)  msg += '💚 收入   NT$'+income.toLocaleString()+'\n';
  if (expense) msg += '🔴 支出   NT$'+expense.toLocaleString()+'\n';
  if (invest)  msg += '📈 投資   NT$'+invest.toLocaleString()+'\n';
  msg += '✨ 淨餘   NT$'+(income-expense-invest).toLocaleString();
  sendMsg(chatId, msg);
}

// ── 本月摘要 ──────────────────────────────────────────────────
function sendMonthlySummary(chatId) {
  var month = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM');
  var rows  = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME).getDataRange().getValues();
  var income=0, expense=0, invest=0, catMap={};
  rows.slice(1).forEach(function(r) {
    if (String(r[0]).slice(0,7) !== month) return;
    var amt=parseFloat(r[1])||0, type=String(r[2]||''), cat=String(r[3]||'其他');
    if (type==='income') income+=amt; else if (type==='investment') invest+=amt;
    else { expense+=amt; catMap[cat]=(catMap[cat]||0)+amt; }
  });
  var msg = '📊 '+month+' 月度摘要\n─────────────────\n';
  msg += '💚 收入   NT$'+income.toLocaleString()+'\n';
  msg += '🔴 支出   NT$'+expense.toLocaleString()+'\n';
  if (invest) msg += '📈 投資   NT$'+invest.toLocaleString()+'\n';
  msg += '✨ 淨餘   NT$'+(income-expense-invest).toLocaleString()+'\n';
  if (income>0) msg += '💾 儲蓄率  '+((income-expense)/income*100).toFixed(1)+'%\n';
  var sorted = Object.entries(catMap).sort(function(a,b){return b[1]-a[1];}).slice(0,3);
  if (sorted.length) { msg += '\n📋 支出前三名\n'; sorted.forEach(function(e,i){ msg+=(i+1)+'. '+e[0]+' NT$'+e[1].toLocaleString()+'\n'; }); }
  sendMsg(chatId, msg);
}

// ── 傳送訊息 ──────────────────────────────────────────────────
function sendMsg(chatId, text) {
  UrlFetchApp.fetch(TELEGRAM_API+'/sendMessage', {
    method:'post', contentType:'application/json',
    payload: JSON.stringify({chat_id:chatId, text:text}),
    muteHttpExceptions:true
  });
}

function ok() { return ContentService.createTextOutput('ok'); }

// ══════════════════════════════════════════════════════════════
//  工具函數（手動執行）
// ══════════════════════════════════════════════════════════════
function stopSpam() {
  UrlFetchApp.fetch(TELEGRAM_API+'/deleteWebhook?drop_pending_updates=true');
  Utilities.sleep(1500);
  Logger.log(UrlFetchApp.fetch(TELEGRAM_API+'/setWebhook?url='+encodeURIComponent(EXEC_URL)).getContentText());
}
function setWebhook()   { Logger.log(UrlFetchApp.fetch(TELEGRAM_API+'/setWebhook?url='+encodeURIComponent(EXEC_URL)).getContentText()); }
function checkWebhook() { Logger.log(UrlFetchApp.fetch(TELEGRAM_API+'/getWebhookInfo').getContentText()); }
function resetProcessedIds() { PropertiesService.getScriptProperties().deleteProperty('processedIds'); Logger.log('cleared'); }
function testGemini() {
  ['晚餐 125','午餐 200','房租 8000 現金'].forEach(function(t){
    Logger.log('=== '+t+' ===');
    Logger.log('Local:  '+JSON.stringify(parseLocally(t)));
    Logger.log('Gemini: '+JSON.stringify(parseWithGemini(t)));
  });
}
