"use strict";
/* ============ データ層 ============ */
const KEY = "oshitecho_v1";
let db = { oshis: [], events: [], expenses: [], budget: 0 };
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) db = Object.assign({ oshis: [], events: [], expenses: [], budget: 0 }, JSON.parse(raw));
  } catch (e) { console.warn("load失敗", e); }
}
function save() { localStorage.setItem(KEY, JSON.stringify(db)); }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ============ 定数 ============ */
const COLORS = ["#e53935","#ec407a","#fb8c00","#f3b300","#43a047","#26bfa5","#29b6f6","#1e6ee8","#8e24aa","#b39ddb","#795548","#37474f"];
const EV_TYPES = ["ライブ・現場","リリイベ","配信","発売・リリース","その他"];
const EX_CATS = ["🎫 チケット","🛍️ グッズ","✈️ 遠征","📱 配信・課金","💿 CD・本","☕ カフェ・コラボ","✨ その他"];

/* ============ ユーティリティ ============ */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const yen = n => "¥" + Math.round(n).toLocaleString("ja-JP");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
function today0() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function parseDate(s) { if (!s) return null; const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); }
function fmtDate(s) {
  const d = parseDate(s); if (!d) return "";
  const w = "日月火水木金土"[d.getDay()];
  return `${d.getMonth()+1}/${d.getDate()}(${w})`;
}
function daysUntil(s) { const d = parseDate(s); if (!d) return null; return Math.round((d - today0()) / 864e5); }
function daysSince(s) { const d = parseDate(s); if (!d) return null; return Math.floor((today0() - d) / 864e5) + 1; }
function nextAnniv(s) { // 毎年繰り返しの次回日付
  const d = parseDate(s); if (!d) return null;
  const t = today0();
  let n = new Date(t.getFullYear(), d.getMonth(), d.getDate());
  if (n < t) n = new Date(t.getFullYear() + 1, d.getMonth(), d.getDate());
  return n;
}
function cdLabel(n) { return n === 0 ? "今日！" : n === 1 ? "あす" : `あと${n}日`; }
const oshiOf = id => db.oshis.find(o => o.id === id);
function oshiDot(o) { return o ? `<span class="dot" style="background:${o.color}"></span>` : ""; }
function tripTotal(t) { return t ? (t.tra||0)+(t.stay||0)+(t.tik||0)+(t.goods||0)+(t.other||0) : 0; }
function ymOf(s) { return s ? s.slice(0, 7) : ""; }
function toInputDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

/* ============ タブ ============ */
function switchTab(name) {
  $$("nav.tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === name));
  $$("section.page").forEach(p => p.classList.toggle("on", p.id === "page-" + name));
  render();
  window.scrollTo(0, 0);
}
$$("nav.tabs button").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));

/* ============ モーダル共通 ============ */
function openModal(id) { $(id).hidden = false; document.body.style.overflow = "hidden"; }
function closeModals() { $$(".modal").forEach(m => m.hidden = true); document.body.style.overflow = ""; }
$$(".modal").forEach(m => {
  m.addEventListener("click", e => { if (e.target === m) closeModals(); });
});
$$("[data-close]").forEach(b => b.addEventListener("click", closeModals));

/* ============ 推し登録 ============ */
let editOshiId = null, selColor = COLORS[1];

function renderSwatches() {
  $("#oshiSwatches").innerHTML = COLORS.map(c =>
    `<button type="button" class="sw ${c === selColor ? "on" : ""}" style="background:${c}" data-c="${c}" aria-label="カラー${c}"></button>`).join("");
  $$("#oshiSwatches .sw").forEach(b => b.addEventListener("click", () => { selColor = b.dataset.c; renderSwatches(); }));
}
function addAnnivRow(label = "", date = "") {
  const div = document.createElement("div");
  div.className = "anniv-row";
  div.innerHTML = `
    <input type="text" class="an-label" maxlength="12" placeholder="例：誕生日" value="${esc(label)}">
    <input type="date" class="an-date" value="${esc(date)}">
    <button type="button" class="iconbtn an-del" aria-label="削除">🗑️</button>`;
  div.querySelector(".an-del").addEventListener("click", () => div.remove());
  $("#annivRows").appendChild(div);
}
function openOshiForm(id = null) {
  editOshiId = id;
  const o = id ? oshiOf(id) : null;
  $("#oshiFormTitle").textContent = o ? "推しを編集" : "推しを登録";
  $("#oshiName").value = o ? o.name : "";
  $("#oshiGenre").value = o ? (o.genre || "") : "";
  $("#oshiSince").value = o ? (o.since || "") : "";
  selColor = o ? o.color : COLORS[(db.oshis.length) % COLORS.length];
  renderSwatches();
  $("#annivRows").innerHTML = "";
  (o?.annivs || []).forEach(a => addAnnivRow(a.label, a.date));
  $("#btnDelOshi").hidden = !o;
  openModal("#modal-oshi");
}
$("#btnNewOshi").addEventListener("click", () => openOshiForm());
$("#btnAddAnniv").addEventListener("click", () => addAnnivRow());
$("#btnSaveOshi").addEventListener("click", () => {
  const name = $("#oshiName").value.trim();
  if (!name) { alert("名前を入れてください"); return; }
  const annivs = $$("#annivRows .anniv-row").map(r => ({
    label: r.querySelector(".an-label").value.trim() || "記念日",
    date: r.querySelector(".an-date").value
  })).filter(a => a.date);
  const data = { name, genre: $("#oshiGenre").value.trim(), color: selColor, since: $("#oshiSince").value, annivs };
  if (editOshiId) Object.assign(oshiOf(editOshiId), data);
  else db.oshis.push(Object.assign({ id: uid() }, data));
  save(); closeModals(); render();
});
$("#btnDelOshi").addEventListener("click", () => {
  const o = oshiOf(editOshiId); if (!o) return;
  if (!confirm(`「${o.name}」を削除しますか？\nこの推しの予定・支出記録も削除されます。`)) return;
  db.oshis = db.oshis.filter(x => x.id !== editOshiId);
  db.events = db.events.filter(x => x.oshiId !== editOshiId);
  db.expenses = db.expenses.filter(x => x.oshiId !== editOshiId);
  save(); closeModals(); render();
});

/* ============ 予定 ============ */
let editEventId = null, selEvType = EV_TYPES[0];

function fillOshiSelect(sel, chosen) {
  sel.innerHTML = db.oshis.map(o => `<option value="${o.id}" ${o.id === chosen ? "selected" : ""}>${esc(o.name)}</option>`).join("");
}
function renderEvTypeChips() {
  $("#evTypeChips").innerHTML = EV_TYPES.map(t =>
    `<button type="button" class="chip ${t === selEvType ? "on" : ""}" data-t="${t}">${t}</button>`).join("");
  $$("#evTypeChips .chip").forEach(b => b.addEventListener("click", () => { selEvType = b.dataset.t; renderEvTypeChips(); }));
}
function updateTripTotal() {
  const t = { tra: +$("#tripTra").value || 0, stay: +$("#tripStay").value || 0, tik: +$("#tripTik").value || 0, goods: +$("#tripGoods").value || 0, other: +$("#tripOther").value || 0 };
  const total = tripTotal(t);
  $("#tripTotal").textContent = total > 0 ? `見積もり合計 ${yen(total)}` : "";
  return t;
}
["#tripTra","#tripStay","#tripTik","#tripGoods","#tripOther"].forEach(s => $(s).addEventListener("input", updateTripTotal));

function openEventForm(id = null) {
  if (!db.oshis.length) { alert("先に「推し」タブで推しを登録してください"); switchTab("oshi"); return; }
  editEventId = id;
  const ev = id ? db.events.find(e => e.id === id) : null;
  $("#eventFormTitle").textContent = ev ? "予定を編集" : "現場・予定を追加";
  $("#evTitle").value = ev ? ev.title : "";
  fillOshiSelect($("#evOshi"), ev?.oshiId);
  selEvType = ev ? ev.type : EV_TYPES[0];
  renderEvTypeChips();
  $("#evDate").value = ev ? ev.date : toInputDate(today0());
  $("#evPlace").value = ev ? (ev.place || "") : "";
  const t = ev?.trip || {};
  $("#tripTra").value = t.tra || ""; $("#tripStay").value = t.stay || "";
  $("#tripTik").value = t.tik || ""; $("#tripGoods").value = t.goods || ""; $("#tripOther").value = t.other || "";
  updateTripTotal();
  $("#btnDelEvent").hidden = !ev;
  openModal("#modal-event");
}
$("#btnNewEvent").addEventListener("click", () => openEventForm());
$("#btnSaveEvent").addEventListener("click", () => {
  const title = $("#evTitle").value.trim();
  const date = $("#evDate").value;
  if (!title) { alert("タイトルを入れてください"); return; }
  if (!date) { alert("日付を選んでください"); return; }
  const trip = updateTripTotal();
  const data = { title, oshiId: $("#evOshi").value, type: selEvType, date, place: $("#evPlace").value.trim(), trip: tripTotal(trip) > 0 ? trip : null };
  if (editEventId) Object.assign(db.events.find(e => e.id === editEventId), data);
  else db.events.push(Object.assign({ id: uid() }, data));
  save(); closeModals(); render();
});
$("#btnDelEvent").addEventListener("click", () => {
  if (!confirm("この予定を削除しますか？")) return;
  db.events = db.events.filter(e => e.id !== editEventId);
  save(); closeModals(); render();
});

function eventCard(ev) {
  const o = oshiOf(ev.oshiId);
  const n = daysUntil(ev.date);
  const tp = tripTotal(ev.trip);
  return `<div class="item" data-ev="${ev.id}" style="cursor:pointer">
    <div class="cd-mini">${n >= 0 ? cdLabel(n) : "終了"}<small>${fmtDate(ev.date)}</small></div>
    <div class="grow">
      <div class="ttl">${esc(ev.title)}</div>
      <div class="muted"><span class="badge ev">${esc(ev.type)}</span>${oshiDot(o)}${esc(o?.name || "")}${ev.place ? "　📍" + esc(ev.place) : ""}</div>
      ${tp > 0 ? `<div class="muted">✈️ 遠征見積 <b>${yen(tp)}</b></div>` : ""}
    </div>
    <div class="iconbtn" aria-hidden="true">›</div>
  </div>`;
}
function renderEvents() {
  const t = toInputDate(today0());
  const future = db.events.filter(e => e.date >= t).sort((a, b) => a.date.localeCompare(b.date));
  const past = db.events.filter(e => e.date < t).sort((a, b) => b.date.localeCompare(a.date));
  let html = "";
  if (!future.length && !past.length) {
    html = `<div class="card empty"><span class="em">📅</span>まだ予定がありません。<br>ライブ・リリイベ・配信などを登録すると<br>カウントダウンが始まります。</div>`;
  } else {
    if (future.length) html += `<div class="card">${future.map(eventCard).join("")}</div>`;
    else html += `<div class="card empty"><span class="em">🕊️</span>この先の予定はありません</div>`;
    if (past.length) html += `<details class="past card"><summary>終了した現場（${past.length}件）</summary>${past.map(eventCard).join("")}</details>`;
  }
  $("#eventList").innerHTML = html;
  $$("#eventList .item[data-ev]").forEach(el => el.addEventListener("click", () => openEventForm(el.dataset.ev)));
}

/* ============ 支出 ============ */
let editExpenseId = null, selExCat = EX_CATS[0];
let moneyYm = ymOf(toInputDate(today0()));

function renderExCatChips() {
  $("#exCatChips").innerHTML = EX_CATS.map(c =>
    `<button type="button" class="chip ${c === selExCat ? "on" : ""}" data-c="${c}">${c}</button>`).join("");
  $$("#exCatChips .chip").forEach(b => b.addEventListener("click", () => { selExCat = b.dataset.c; renderExCatChips(); }));
}
function openExpenseForm(id = null) {
  if (!db.oshis.length) { alert("先に「推し」タブで推しを登録してください"); switchTab("oshi"); return; }
  editExpenseId = id;
  const ex = id ? db.expenses.find(e => e.id === id) : null;
  $("#expenseFormTitle").textContent = ex ? "支出を編集" : "支出を記録";
  $("#exAmount").value = ex ? ex.amount : "";
  fillOshiSelect($("#exOshi"), ex?.oshiId);
  selExCat = ex ? ex.cat : EX_CATS[0];
  renderExCatChips();
  $("#exDate").value = ex ? ex.date : toInputDate(today0());
  $("#exMemo").value = ex ? (ex.memo || "") : "";
  $("#btnDelExpense").hidden = !ex;
  openModal("#modal-expense");
}
$("#btnNewExpense").addEventListener("click", () => openExpenseForm());
$("#btnSaveExpense").addEventListener("click", () => {
  const amount = +$("#exAmount").value;
  const date = $("#exDate").value;
  if (!amount || amount <= 0) { alert("金額を入れてください"); return; }
  if (!date) { alert("日付を選んでください"); return; }
  const data = { amount, oshiId: $("#exOshi").value, cat: selExCat, date, memo: $("#exMemo").value.trim() };
  if (editExpenseId) Object.assign(db.expenses.find(e => e.id === editExpenseId), data);
  else db.expenses.push(Object.assign({ id: uid() }, data));
  save(); closeModals(); render();
});
$("#btnDelExpense").addEventListener("click", () => {
  if (!confirm("この記録を削除しますか？")) return;
  db.expenses = db.expenses.filter(e => e.id !== editExpenseId);
  save(); closeModals(); render();
});

function monthExpenses(ym) { return db.expenses.filter(e => ymOf(e.date) === ym); }
function sum(list) { return list.reduce((s, e) => s + e.amount, 0); }

function shiftMonth(d) {
  const [y, m] = moneyYm.split("-").map(Number);
  const nd = new Date(y, m - 1 + d, 1);
  moneyYm = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`;
  renderMoney();
}
$("#mPrev").addEventListener("click", () => shiftMonth(-1));
$("#mNext").addEventListener("click", () => shiftMonth(1));

function budgetCardHtml(ym, compact) {
  const total = sum(monthExpenses(ym));
  const b = db.budget;
  let inner;
  if (b > 0) {
    const pct = Math.min(100, total / b * 100);
    const over = total > b;
    inner = `
      <div class="muted">${ym.replace("-", "年")}月の推し活費</div>
      <div class="big">${yen(total)} <span class="muted" style="font-size:1rem">/ 予算 ${yen(b)}</span></div>
      <div class="bar"><i class="${over ? "over" : ""}" style="width:${pct}%"></i></div>
      <div class="${over ? "" : "muted"}" style="${over ? "color:var(--warn);font-weight:700" : ""}">
        ${over ? `予算オーバー ${yen(total - b)} 😱` : `あと ${yen(b - total)} 使えます`}
      </div>`;
  } else {
    inner = `
      <div class="muted">${ym.replace("-", "年")}月の推し活費</div>
      <div class="big">${yen(total)}</div>
      <div class="muted">予算を決めると「あといくら使えるか」が見えます</div>`;
  }
  return `<div class="card" id="${compact ? "homeBudgetCard" : "moneyBudgetCard"}" style="cursor:pointer">${inner}
    <div style="text-align:right"><span class="badge">予算を設定 ✏️</span></div></div>`;
}
$("#btnSaveBudget").addEventListener("click", () => {
  db.budget = Math.max(0, +$("#budgetInput").value || 0);
  save(); closeModals(); render();
});
function bindBudgetCard(sel) {
  const el = $(sel); if (!el) return;
  el.addEventListener("click", () => { $("#budgetInput").value = db.budget || ""; openModal("#modal-budget"); });
}

function renderMoney() {
  $("#mLabel").textContent = moneyYm.replace("-", "年") + "月";
  const list = monthExpenses(moneyYm).sort((a, b) => b.date.localeCompare(a.date));
  $("#moneySummary").innerHTML = budgetCardHtml(moneyYm, false);
  bindBudgetCard("#moneyBudgetCard");

  // 推し別
  if (db.oshis.length && list.length) {
    const rows = db.oshis.map(o => {
      const m = sum(list.filter(e => e.oshiId === o.id));
      const all = sum(db.expenses.filter(e => e.oshiId === o.id));
      return m > 0 || all > 0 ? `<div class="item">
        <div class="grow"><div class="ttl">${oshiDot(o)}${esc(o.name)}</div>
        <div class="muted">累計 ${yen(all)}</div></div>
        <div class="amt">${yen(m)}</div></div>` : "";
    }).join("");
    $("#moneyByOshi").innerHTML = rows ? `<h2 class="sec">💖 推しごとの合計（今月）</h2><div class="card">${rows}</div>` : "";
  } else $("#moneyByOshi").innerHTML = "";

  // カテゴリ別
  if (list.length) {
    const max = Math.max(...EX_CATS.map(c => sum(list.filter(e => e.cat === c))));
    const rows = EX_CATS.map(c => {
      const v = sum(list.filter(e => e.cat === c));
      if (!v) return "";
      return `<div class="catrow"><div class="nm">${c}</div>
        <div class="bg"><i style="width:${max ? v / max * 100 : 0}%"></i></div>
        <div class="vl">${yen(v)}</div></div>`;
    }).join("");
    $("#moneyByCat").innerHTML = `<h2 class="sec">📊 カテゴリ別（今月）</h2><div class="card">${rows}</div>`;
  } else $("#moneyByCat").innerHTML = "";

  // 明細
  $("#expenseList").innerHTML = list.length ? list.map(ex => {
    const o = oshiOf(ex.oshiId);
    return `<div class="item" data-ex="${ex.id}" style="cursor:pointer">
      <div class="grow">
        <div class="ttl">${esc(ex.cat)}${ex.memo ? `　<span class="muted" style="font-weight:400">${esc(ex.memo)}</span>` : ""}</div>
        <div class="muted">${fmtDate(ex.date)}　${oshiDot(o)}${esc(o?.name || "")}</div>
      </div>
      <div class="amt">${yen(ex.amount)}</div>
    </div>`;
  }).join("") : `<div class="empty"><span class="em">🧾</span>この月の記録はまだありません</div>`;
  $$("#expenseList .item[data-ex]").forEach(el => el.addEventListener("click", () => openExpenseForm(el.dataset.ex)));
}

/* ============ 推しタブ ============ */
function renderOshi() {
  if (!db.oshis.length) {
    $("#oshiList").innerHTML = `<div class="card empty"><span class="em">💖</span>まずは推しを登録しましょう！<br>複数の推しもOK。推しカラーで色分けされます。</div>`;
    return;
  }
  $("#oshiList").innerHTML = db.oshis.map(o => {
    const ds = daysSince(o.since);
    const all = sum(db.expenses.filter(e => e.oshiId === o.id));
    const nextEv = db.events.filter(e => e.oshiId === o.id && e.date >= toInputDate(today0())).sort((a, b) => a.date.localeCompare(b.date))[0];
    return `<div class="card" data-oshi="${o.id}" style="cursor:pointer; border-left:6px solid ${o.color}">
      <div style="display:flex; align-items:center; gap:8px">
        <div class="grow" style="flex:1">
          <div style="font-weight:800; font-size:1.1rem">${esc(o.name)}</div>
          ${o.genre ? `<div class="muted">${esc(o.genre)}</div>` : ""}
        </div>
        <div class="iconbtn" aria-hidden="true">✏️</div>
      </div>
      <div class="muted" style="margin-top:6px">
        ${ds ? `推して <b style="color:var(--accent-dark)">${ds.toLocaleString()}日目</b>　` : ""}累計 <b>${yen(all)}</b>
        ${nextEv ? `<br>次の現場：${fmtDate(nextEv.date)} ${esc(nextEv.title)}（${cdLabel(daysUntil(nextEv.date))}）` : ""}
      </div>
    </div>`;
  }).join("");
  $$("#oshiList [data-oshi]").forEach(el => el.addEventListener("click", () => openOshiForm(el.dataset.oshi)));
}

/* ============ ホーム ============ */
function renderHome() {
  // ようこそ
  $("#homeWelcome").innerHTML = db.oshis.length ? "" : `
    <div class="card center">
      <div style="font-size:2.4rem">💖</div>
      <div style="font-weight:800; font-size:1.15rem; margin:6px 0">ようこそ、推し活手帳へ！</div>
      <p class="muted">推しの予定・お金・記念日をこれ1つで管理。<br>まずは推しを登録してみましょう。</p>
      <button class="primary" id="btnWelcomeOshi" style="width:100%">💖 推しを登録する</button>
    </div>`;
  const wb = $("#btnWelcomeOshi");
  if (wb) wb.addEventListener("click", () => { switchTab("oshi"); openOshiForm(); });

  // 次の現場
  const t = toInputDate(today0());
  const next = db.events.filter(e => e.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (next) {
    const o = oshiOf(next.oshiId);
    const n = daysUntil(next.date);
    $("#homeNextEvent").innerHTML = `
      <div class="card cdown center">
        <div class="muted">次の現場まで</div>
        <div class="days">${n === 0 ? "本番当日🔥" : `あと${n}日`}</div>
        <div style="font-weight:700; margin-top:4px">${esc(next.title)}</div>
        <div class="muted">${fmtDate(next.date)}　${oshiDot(o)}${esc(o?.name || "")}${next.place ? "　📍" + esc(next.place) : ""}</div>
        ${tripTotal(next.trip) > 0 ? `<div class="muted">✈️ 遠征見積 <b>${yen(tripTotal(next.trip))}</b></div>` : ""}
      </div>`;
  } else {
    $("#homeNextEvent").innerHTML = db.oshis.length ? `
      <div class="card center muted">📅 この先の予定は未登録です。<br>「予定」タブから現場を追加するとカウントダウンが出ます。</div>` : "";
  }

  // 予算
  if (db.oshis.length || db.expenses.length) {
    $("#homeBudget").innerHTML = budgetCardHtml(ymOf(t), true);
    bindBudgetCard("#homeBudgetCard");
  } else $("#homeBudget").innerHTML = "";

  // 推して◯日
  if (db.oshis.length) {
    const rows = db.oshis.map(o => {
      const ds = daysSince(o.since);
      return `<div class="item"><div class="grow"><div class="ttl">${oshiDot(o)}${esc(o.name)}</div></div>
        <div class="amt" style="color:var(--accent-dark)">${ds ? `推して${ds.toLocaleString()}日目` : "—"}</div></div>`;
    }).join("");
    $("#homeOshiDays").innerHTML = `<h2 class="sec">💘 推し歴</h2><div class="card">${rows}</div>`;
  } else $("#homeOshiDays").innerHTML = "";

  // 記念日（60日以内）
  const upcoming = [];
  db.oshis.forEach(o => (o.annivs || []).forEach(a => {
    const nd = nextAnniv(a.date);
    if (!nd) return;
    const n = Math.round((nd - today0()) / 864e5);
    if (n <= 60) {
      const years = nd.getFullYear() - parseDate(a.date).getFullYear();
      upcoming.push({ o, label: a.label, n, nd, years });
    }
  }));
  upcoming.sort((a, b) => a.n - b.n);
  $("#homeAnnivs").innerHTML = upcoming.length ? `<h2 class="sec">🎂 近づく記念日</h2><div class="card">${
    upcoming.map(u => `<div class="item">
      <div class="cd-mini">${cdLabel(u.n)}<small>${u.nd.getMonth()+1}/${u.nd.getDate()}</small></div>
      <div class="grow"><div class="ttl">${esc(u.label)}${u.years > 0 ? `<span class="muted" style="font-weight:400">（${u.years}周年）</span>` : ""}</div>
      <div class="muted">${oshiDot(u.o)}${esc(u.o.name)}</div></div>
    </div>`).join("")}</div>` : "";
}

/* ============ 全体描画 ============ */
function render() { renderHome(); renderEvents(); renderMoney(); renderOshi(); }

load();
render();

/* ============ Service Worker ============ */
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("./sw.js").catch(e => console.warn("SW登録失敗", e));
}
