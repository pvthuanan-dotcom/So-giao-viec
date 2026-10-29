(function (S) {
  'use strict';
  var C = window.APP_CONFIG, esc = S.esc;
  var $ = function (s) { return document.querySelector(s); };
  var VIEWS = {
    overview: { title: 'Tổng quan', icon: 'grid', filters: true },
    mine: { title: 'Việc của tôi', icon: 'mine' },
    report: { title: 'Báo cáo tuần', icon: 'report' },
    board: { title: 'Bảng theo khâu', icon: 'board', filters: true, search: true },
    list: { title: 'Tất cả việc', icon: 'list', filters: true, search: true },
    approvals: { title: 'Chờ duyệt', icon: 'approve', adminOnly: false }
  };
  var st = S.st = {
    data: null, me: null, isAdmin: false, users: [], uMap: {}, tasks: [], byId: {}, checks: [], reports: [], hasReports: false, rep: { week: '', tab: 'mine', drafts: {}, sum: { next: '', opinion: '', hours: '' }, busy: false }, choices: {},
    view: 'overview', f: { q: '', person: '', project: '', week: '', stage: '', quick: 'all' },
    sort: { k: 'due', dir: 1 }, drawer: null, showDone: false, loading: true, mock: false, listRows: [],
    engFields: ['progress', 'status', 'stage', 'note', 'waitFor', 'followers']
  };
  st.canEdit = function (t) {
    if (!t) return false;
    if (st.isAdmin) return true;
    var m = st.me; if (!m || !m.id) return false;
    return t.owner === m.id || (t.collab || []).indexOf(m.id) >= 0;
  };
  st.projects = function () {
    var set = {}, out = [];
    (st.choices.project || S.DEFAULT_PROJECTS).concat(st.tasks.map(function (t) { return t.project; })).forEach(function (p) { if (p && !set[p]) { set[p] = 1; out.push(p); } });
    return out;
  };

  function setTasks(ts) {
    st.tasks = ts; st.byId = {};
    ts.forEach(function (t) { st.byId[t.id] = t; });
  }
  function weeks() {
    var set = {}; st.tasks.forEach(function (t) { if (t.week) set[t.week] = 1; });
    return Object.keys(set).sort();
  }
  function weekLabel() {
    var smp = ''; for (var i = 0; i < st.tasks.length; i++) { if (st.tasks[i].week) { smp = st.tasks[i].week; break; } }
    var m = /^(\D*)(\d+)(\D*)$/.exec(smp), w = S.isoWeek(S.today());
    return m ? m[1] + w + m[3] : 'W' + w;
  }
  function weekLabelFor(n) {
    var cur = weekLabel(), w = S.isoWeek(S.today());
    return cur.replace(String(w), String(n));
  }
  st.repWeeks = function () {
    var w = S.isoWeek(S.today()), out = [];
    for (var i = 0; i < 8 && w - i >= 1; i++) out.push(weekLabelFor(w - i));
    return out;
  };
  function repInit(week) {
    var R = st.rep, me = st.me || {};
    R.week = week || weekLabel(); R.drafts = {}; R.sum = { next: '', opinion: '', hours: '' };
    st.reports.forEach(function (r) {
      if (r.week !== R.week || r.who !== me.id) return;
      if (r.kind === 'Tổng kết') R.sum = { next: r.next || '', opinion: r.opinion || '', hours: r.hours == null ? '' : r.hours };
      else if (r.taskId) R.drafts[r.taskId] = { rating: r.rating || '', result: r.result || '' };
    });
  }
  function nextCode() {
    var cnt = {}, max = {}, width = {};
    st.tasks.forEach(function (t) {
      var m = /^(.*?)(\d+)$/.exec(t.code || ''); if (!m) return;
      cnt[m[1]] = (cnt[m[1]] || 0) + 1; max[m[1]] = Math.max(max[m[1]] || 0, +m[2]); width[m[1]] = Math.max(width[m[1]] || 0, m[2].length);
    });
    var best = 'GV-', bc = 0;
    Object.keys(cnt).forEach(function (p) { if (cnt[p] > bc) { bc = cnt[p]; best = p; } });
    var n = (max[best] || 0) + 1;
    return best + String(n).padStart(width[best] || 3, '0');
  }

  /* ---------- Hiển thị ---------- */
  function base() {
    var f = st.f;
    return st.tasks.filter(function (t) {
      if (f.person === 'none') { if (t.owner) return false; }
      else if (f.person && t.owner !== +f.person) return false;
      if (f.project && t.project !== f.project) return false;
      if (f.week && t.week !== f.week) return false;
      if (st.view === 'board' && f.q) {
        var hay = (t.title + ' ' + t.code + ' ' + (t.project || '')).toLowerCase();
        if (hay.indexOf(f.q.toLowerCase()) < 0) return false;
      }
      return true;
    });
  }
  function counts() {
    var me = st.me, mine = 0, late = 0, appr = 0;
    st.tasks.forEach(function (t) {
      if (me && (t.owner === me.id) && !S.isDone(t) && S.counted(t)) { mine++; if (S.isLate(t)) late++; }
      if (t.approval === 'Chờ duyệt' || (t.status === 'Chờ nghiệm thu' && t.approval !== 'Từ chối')) appr++;
    });
    return { mine: mine, mineLate: late, appr: appr };
  }
  function renderNav() {
    var c = counts();
    var items = Object.keys(VIEWS).map(function (k) {
      var v = VIEWS[k], badge = '';
      if (k === 'mine' && c.mine) badge = '<span class="cnt ' + (c.mineLate ? 'red' : '') + '">' + c.mine + '</span>';
      if (k === 'approvals' && c.appr) badge = '<span class="cnt amber">' + c.appr + '</span>';
      return '<button class="nav ' + (st.view === k ? 'on' : '') + '" data-act="nav" data-v="' + k + '">' + S.icon(v.icon) + '<span>' + v.title + '</span>' + badge + '</button>';
    }).join('');
    var m = st.me || { name: '?' };
    $('#side').innerHTML = '<div class="brand"><div class="logo">CNH</div><div>Sổ giao việc<small>' + esc(C.orgName) + '</small></div></div>' + items + '<div class="grow"></div>' +
      '<div class="me">' + S.avatar(m.name, m.id) + '<div class="mewho"><b>' + esc(m.name) + '</b><small>' + (st.isAdmin ? 'Quản lý, giao và duyệt việc' : 'Kỹ sư') + '</small></div>' +
      (st.mock ? '' : '<button class="iconbtn" data-act="logout" title="Đăng xuất">' + S.icon('logout') + '</button>') + '</div>';
    $('#bottomnav').innerHTML = items;
  }
  function renderTop() {
    var v = VIEWS[st.view], f = st.f, h = '<h1>' + v.title + '</h1>';
    if (st.mock) h += '<span class="chip warn" title="Dữ liệu giả lập, không ghi vào SharePoint">Chế độ xem thử</span>';
    h += '<span class="sp"></span>';
    if (v.search) h += '<label class="field search">' + S.icon('search') + '<input id="q" placeholder="Tìm việc" value="' + esc(f.q) + '"></label>';
    if (v.filters) {
      var opt = function (arr, cur, blank) { return '<option value="">' + blank + '</option>' + arr.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (String(x[0]) === String(cur) ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join(''); };
      h += '<label class="field"><select data-fl="person">' + opt(st.users.map(function (u) { return [u.id, u.name]; }).concat([['none', '(chưa giao)']]), f.person, 'Tất cả người') + '</select></label>' +
        '<label class="field"><select data-fl="project">' + opt(st.projects().map(function (p) { return [p, p]; }), f.project, 'Tất cả dự án') + '</select></label>' +
        '<label class="field"><select data-fl="week">' + opt(weeks().map(function (p) { return [p, p]; }), f.week, 'Tất cả tuần') + '</select></label>';
    }
    if (st.isAdmin) h += '<button class="btn" data-act="imp" title="Nhập báo cáo tuần từ file Excel">' + S.icon('upload') + ' Nhập BCT</button>';
    h += '<button class="iconbtn" data-act="refresh" title="Tải lại">' + S.icon('refresh') + '</button>' +
      '<button class="btn pri" data-act="new">' + S.icon('plus') + (st.isAdmin ? ' Giao việc' : ' Đề xuất việc') + '</button>';
    $('#top').innerHTML = h;
  }
  function renderContent() {
    var el = $('#content'), h = '';
    if (st.loading) { el.innerHTML = '<div class="loading">Đang tải dữ liệu…</div>'; return; }
    if (st.view === 'overview') {
      var d = new Date(), wd = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][d.getDay()];
      h = '<p class="hello">Xin chào ' + esc(st.me.name) + ' · ' + wd + ' ' + S.fmtFull(S.today()) + '</p>' + S.viewOverview(st, base());
    } else if (st.view === 'mine') h = S.viewMine(st);
    else if (st.view === 'report') h = S.viewReport(st);
    else if (st.view === 'board') h = S.viewBoard(st, base());
    else if (st.view === 'list') h = S.viewList(st, base());
    else h = S.viewApprovals(st);
    el.innerHTML = h;
  }
  function renderDrawer() {
    var el = $('#drawer'), prev = el.querySelector('.body'), top = prev ? prev.scrollTop : 0;
    el.innerHTML = S.viewDrawer(st);
    var b = el.querySelector('.body'); if (b) b.scrollTop = top;
  }
  function renderModal() { var el = $('#modal'); if (el) el.innerHTML = S.viewImport(st); }
  function renderAll() { renderNav(); renderTop(); renderContent(); renderDrawer(); }

  /* ---------- Ghi dữ liệu ---------- */
  async function patchTask(id, patch, quiet) {
    var t = st.byId[id], old = {};
    Object.keys(patch).forEach(function (k) { old[k] = t[k]; });
    Object.assign(t, patch); renderNav(); renderContent();
    try { await st.data.updateTask(id, patch); if (!quiet) S.toast('Đã lưu'); }
    catch (e) { Object.assign(t, old); renderNav(); renderContent(); S.toast('Không lưu được: ' + e.message, 'err'); throw e; }
  }
  async function createTask(t, checks) {
    var made;
    for (var i = 0; i < 5; i++) {
      try { made = await st.data.createTask(t); break; }
      catch (e) { if (i === 4 || !/unique|duplicate|đã tồn tại/i.test(e.message)) throw e; t.code = nextCode().replace(/\d+$/, function (n) { return String(+n + i + 1).padStart(n.length, '0'); }); }
    }
    st.tasks.push(made); st.byId[made.id] = made;
    for (var j = 0; j < (checks || []).length; j++) {
      var c = await st.data.createCheck(made.id, checks[j]); st.checks.push(c);
    }
    return made;
  }
  function today() { return S.today(); }

  function openDrawer(id) {
    var t = st.byId[id]; if (!t) return;
    st.drawer = { mode: 'edit', orig: t, draft: JSON.parse(JSON.stringify(t)), newChecks: [] };
    renderDrawer();
  }
  function newDrawer() {
    var adm = st.isAdmin, me = st.me || {};
    var admin = st.users.filter(function (u) { return (C.admins || []).indexOf((u.email || '').toLowerCase()) >= 0; })[0];
    st.drawer = {
      mode: 'new', orig: null, newChecks: [], draft: {
        id: 0, title: '', code: nextCode(), owner: adm ? null : me.id || null, collab: [], followers: [], project: '', week: weekLabel(),
        priority: 'Trung bình', status: 'Chưa làm', stage: 'Chuẩn bị', type: adm ? 'Giao việc' : 'Đề xuất', approval: adm ? 'Đã duyệt' : 'Chờ duyệt',
        approver: admin ? admin.id : null, assigner: me.id || null, progress: 0, score: null, assigned: today(), due: null, done: null,
        repeat: 'Không', waitFor: null, reviewNote: '', note: '', source: 'Ứng dụng'
      }
    };
    renderDrawer();
    var ta = document.querySelector('[data-f="title"]'); if (ta) ta.focus();
  }
  function setField(f, el) {
    var d = st.drawer; if (!d) return;
    var t = d.draft, v = el.value;
    if (f === 'progress') { t.progress = +v; var pv = $('#progv'); if (pv) pv.textContent = v + '%'; return; }
    if (f === 'owner' || f === 'waitFor') { t[f] = v ? +v : null; return; }
    if (f === 'followers1') { t.followers = v ? [+v] : []; return; }
    t[f] = v;
    if (f === 'status') { if (!d.stageTouched) t.stage = S.statusToStage(v, t.stage); if (v === 'Chờ nghiệm thu' && (t.progress || 0) < 100 && st.isAdmin === false) t.progress = 100; renderDrawer(); }
    if (f === 'stage') { d.stageTouched = true; t.status = S.stageToStatus(v, t.status); renderDrawer(); }
  }
  async function saveDraft() {
    var d = st.drawer; if (!d) return;
    var t = d.draft;
    if (!String(t.title || '').trim()) { S.toast('Anh nhập nội dung việc trước nhé.', 'err'); return; }
    if (d.mode === 'new' && st.isAdmin && t.type === 'Giao việc' && (!t.owner || !t.due)) { S.toast('Việc giao cần có người phụ trách và hạn hoàn thành.', 'err'); return; }
    var btn = document.querySelector('[data-act="save"]'); if (btn) btn.disabled = true;
    try {
      if (d.mode === 'new') {
        t.title = t.title.trim();
        await createTask(t, d.newChecks);
        S.toast(st.isAdmin ? 'Đã giao việc' : 'Đã gửi đề xuất, chờ anh Thành duyệt');
      } else {
        var patch = {}, o = d.orig;
        Object.keys(t).forEach(function (k) {
          if (k === 'id') return;
          if (JSON.stringify(t[k]) !== JSON.stringify(o[k])) patch[k] = t[k];
        });
        if ('status' in patch) {
          if (patch.status === 'Hoàn thành' && !t.done) patch.done = today();
          if (patch.status !== 'Hoàn thành' && o.done) patch.done = null;
        }
        if (!Object.keys(patch).length) { st.drawer = null; renderDrawer(); return; }
        if (!st.isAdmin) { var ok = {}; Object.keys(patch).forEach(function (k) { if (st.engFields.indexOf(k) >= 0) ok[k] = patch[k]; }); patch = ok; }
        await patchTask(o.id, patch);
      }
      st.drawer = null; renderAll();
    } catch (e) { S.toast('Không lưu được: ' + e.message, 'err'); if (btn) btn.disabled = false; }
  }
  async function moveStage(id, stage) {
    var t = st.byId[id]; if (!t || !st.canEdit(t) || S.stageOf(t) === stage) return;
    var patch = { stage: stage, status: S.stageToStatus(stage, t.status) };
    if (patch.status === t.status) delete patch.status;
    if (patch.status === 'Chờ nghiệm thu' && (t.progress || 0) < 100 && !st.isAdmin) patch.progress = 100;
    try { await patchTask(id, patch); } catch (e) { /* đã báo lỗi */ }
  }
  async function accept(id) {
    var t = st.byId[id], d = st.drawer;
    var scoreEl = $('#acc-score'), score = scoreEl ? +scoreEl.value : (t.score || 4);
    var note = d && d.draft && d.orig && d.orig.id === id ? d.draft.reviewNote : t.reviewNote;
    try {
      await patchTask(id, { status: 'Hoàn thành', stage: 'Nghiệm thu', done: today(), score: score, reviewNote: note || '', progress: 100, approval: 'Đã duyệt' }, true);
      if (t.repeat && t.repeat !== 'Không') {
        var due0 = t.due || today();
        var nt = JSON.parse(JSON.stringify(t));
        nt.id = 0; nt.code = nextCode(); nt.status = 'Chưa làm'; nt.stage = 'Chuẩn bị'; nt.progress = 0; nt.score = null; nt.done = null; nt.reviewNote = '';
        nt.assigned = today(); nt.due = t.repeat === 'Hằng tuần' ? S.addDays(due0, 7) : S.addMonths(due0, 1); nt.week = weekLabel(); nt.approval = 'Đã duyệt';
        var items = st.checks.filter(function (c) { return c.taskId === id; }).map(function (c) { return c.text; });
        await createTask(nt, items);
        S.toast('Đã nghiệm thu. Đã tạo việc lặp lại hạn ' + S.fmtFull(nt.due));
      } else S.toast('Đã nghiệm thu');
      st.drawer = null; renderAll();
    } catch (e) { S.toast('Không lưu được: ' + e.message, 'err'); }
  }
  async function decide(id, what) {
    var d = st.drawer, note = d && d.orig && d.orig.id === id ? d.draft.reviewNote : '';
    var map = { approve: 'Đã duyệt', revise: 'Cần sửa', reject: 'Từ chối' };
    if (what !== 'approve' && !String(note || '').trim()) { S.toast('Anh ghi nhận xét ngắn trước khi trả lại hoặc từ chối.', 'err'); return; }
    var patch = { approval: map[what] };
    if (note) patch.reviewNote = note;
    if (what === 'approve') patch.type = st.byId[id].type;
    try { await patchTask(id, patch); S.toast(what === 'approve' ? 'Đã duyệt' : what === 'revise' ? 'Đã trả lại để sửa' : 'Đã từ chối'); if (d) { st.drawer = null; } renderAll(); }
    catch (e) { /* đã báo */ }
  }
  async function rework(id) {
    var d = st.drawer, note = d && d.orig && d.orig.id === id ? d.draft.reviewNote : '';
    if (!String(note || '').trim()) { S.toast('Anh ghi rõ cần làm lại điều gì.', 'err'); return; }
    var t = st.byId[id];
    try { await patchTask(id, { status: 'Đang làm', stage: 'Thực hiện', reviewNote: note, progress: Math.min(t.progress || 0, 90) }); st.drawer = null; renderAll(); }
    catch (e) { /* đã báo */ }
  }
  async function ckToggle(id, on) {
    var d = st.drawer; if (!d || d.mode !== 'edit') return;
    var c = st.checks.filter(function (x) { return String(x.id) === String(id); })[0]; if (!c) return;
    var old = c.ok; c.ok = on;
    try {
      await st.data.updateCheck(c.id, { ok: on });
      var list = st.checks.filter(function (x) { return x.taskId === d.orig.id; });
      var pct = Math.round(list.filter(function (x) { return x.ok; }).length * 100 / list.length);
      if (!S.isDone(d.orig) && pct !== d.orig.progress && list.length) { d.draft.progress = pct; await patchTask(d.orig.id, { progress: pct }, true); d.draft.progress = pct; }
      renderDrawer();
    } catch (e) { c.ok = old; renderDrawer(); S.toast('Không lưu được: ' + e.message, 'err'); }
  }
  async function ckAdd() {
    var inp = $('#ck-new'), v = inp && inp.value.trim(); if (!v) return;
    var d = st.drawer;
    if (d.mode === 'new') { d.newChecks.push(v); renderDrawer(); }
    else {
      try { var c = await st.data.createCheck(d.orig.id, v); st.checks.push(c); renderDrawer(); }
      catch (e) { S.toast('Không thêm được tiêu chí: ' + e.message, 'err'); return; }
    }
    var n = $('#ck-new'); if (n) n.focus();
  }
  async function ckDel(id) {
    var d = st.drawer;
    if (d.mode === 'new') { d.newChecks.splice(+String(id).slice(1), 1); renderDrawer(); return; }
    try { await st.data.deleteCheck(+id); st.checks = st.checks.filter(function (c) { return c.id !== +id; }); renderDrawer(); }
    catch (e) { S.toast('Không xóa được: ' + e.message, 'err'); }
  }
  async function delTask(id) {
    if (!confirm('Xóa việc này? Thao tác không hoàn tác được từ ứng dụng.')) return;
    try {
      await st.data.deleteTask(id);
      st.tasks = st.tasks.filter(function (t) { return t.id !== id; }); delete st.byId[id];
      st.checks = st.checks.filter(function (c) { return c.taskId !== id; });
      st.drawer = null; renderAll(); S.toast('Đã xóa việc');
    } catch (e) { S.toast('Không xóa được: ' + e.message, 'err'); }
  }
  async function reload(quiet) {
    try {
      var r = await Promise.all([st.data.listTasks(), st.data.listChecks(), st.data.listReports()]);
      setTasks(r[0]); st.checks = r[1]; st.reports = r[2];
      if (st.drawer && st.drawer.mode === 'edit') { var t = st.byId[st.drawer.orig.id]; if (t) st.drawer.orig = t; }
      renderNav(); if (!(quiet && st.view === 'report')) renderContent(); if (!st.drawer) renderDrawer();
      if (!quiet) S.toast('Đã tải lại');
    } catch (e) { if (!quiet) S.toast('Không tải được: ' + e.message, 'err'); }
  }

  /* ---------- Nhập báo cáo tuần ---------- */
  async function repSubmit() {
    var R = st.rep, me = st.me; if (!me || !me.id || R.busy) return;
    R.busy = true; renderContent();
    var wk = R.week, today = S.today(), errs = [], n = 0;
    var find = function (kind, taskId) { return st.reports.filter(function (r) { return r.kind === kind && r.week === wk && r.who === me.id && (kind === 'Tổng kết' || r.taskId === taskId); })[0]; };
    var upsert = async function (payload, old) {
      if (old) { await st.data.updateReport(old.id, payload); Object.assign(old, payload); }
      else { var made = await st.data.createReport(payload); st.reports.push(made); }
    };
    var ids = Object.keys(R.drafts);
    for (var i = 0; i < ids.length; i++) {
      var id = +ids[i], d = R.drafts[id], t = st.byId[id]; if (!t) continue;
      var old = find('Việc', id), has = d.rating || (d.result || '').trim();
      if (!has && !old) continue;
      try {
        await upsert({ title: wk + ' · ' + me.name + ' · ' + t.code, week: wk, who: me.id, code: t.code, taskId: id, result: (d.result || '').trim(), rating: d.rating, kind: 'Việc', date: today }, old);
        n++;
        if (t.owner === me.id && d.rating) {
          var stt = S.Bct.ratingToState(d.rating), patch = {};
          if (stt && !S.isDone(t)) {
            if (t.status !== stt.status) patch.status = stt.status;
            if (t.stage !== stt.stage) patch.stage = stt.stage;
            if (stt.progress != null && t.progress !== stt.progress) patch.progress = stt.progress;
            if (Object.keys(patch).length) await patchTask(id, patch, true);
          }
        }
      } catch (e) { errs.push(t.code + ': ' + e.message); }
    }
    try {
      var sm = R.sum, oldS = find('Tổng kết');
      if (sm.next || sm.opinion || sm.hours !== '' || oldS || n)
        await upsert({ title: wk + ' · ' + me.name + ' · Tổng kết', week: wk, who: me.id, kind: 'Tổng kết', next: sm.next, opinion: sm.opinion, hours: sm.hours === '' ? null : +sm.hours, date: today }, oldS);
    } catch (e) { errs.push('Tổng kết: ' + e.message); }
    R.busy = false; renderAll();
    if (errs.length) S.toast('Có lỗi: ' + errs.join(' | '), 'err'); else S.toast('Đã nộp báo cáo ' + wk);
  }
  function repCsv() {
    var wk = st.rep.week, rows = [['Tuần', 'Người', 'Mã việc', 'Nội dung việc', 'Đánh giá', 'Kết quả', 'Tuần tới', 'Ý kiến', 'Giờ làm thêm', 'Ngày nộp']];
    st.reports.filter(function (r) { return r.week === wk; }).forEach(function (r) {
      var t = st.byId[r.taskId];
      rows.push([r.week, st.uMap[r.who] ? st.uMap[r.who].name : '', r.code, t ? t.title : '', r.rating, r.result, r.next, r.opinion, r.hours, r.date]);
    });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([S.csv(rows)], { type: 'text/csv;charset=utf-8' }));
    a.download = 'bao-cao-tuan-' + wk + '.csv'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  async function repCreate() {
    try { st.hasReports = await st.data.createReportList(); st.reports = await st.data.listReports(); repInit(); renderAll(); S.toast('Đã tạo danh sách Báo cáo tuần'); }
    catch (e) { S.toast('Chưa tự tạo được (' + e.message + '). Anh xem hướng dẫn tạo thủ công trong tài liệu triển khai.', 'err'); }
  }
  async function impRead(files) {
    st.imp = { busy: 'Đang đọc ' + files.length + ' file…' }; renderModal();
    var parsed = [];
    for (var i = 0; i < files.length; i++) {
      try { parsed.push(await S.Bct.readFile(files[i])); }
      catch (e) { parsed.push({ file: files[i].name, error: e.message }); }
    }
    st.imp = { plan: S.Bct.plan(parsed, st.tasks, st.users) }; renderModal();
  }
  async function impApply() {
    var pl = st.imp && st.imp.plan; if (!pl) return;
    var ups = pl.updates.filter(function (u) { return u.include; }), prs = pl.proposals.filter(function (u) { return u.include; });
    var okU = 0, okP = 0, errs = [], admin = st.users.filter(function (u) { return (C.admins || []).indexOf((u.email || '').toLowerCase()) >= 0; })[0];
    for (var i = 0; i < ups.length; i++) {
      st.imp = { busy: 'Đang ghi ' + (i + 1) + '/' + (ups.length + prs.length) + '…' }; renderModal();
      var u = ups[i], patch = Object.assign({}, u.patch), t = st.byId[u.id];
      patch.note = ((t && t.note) ? t.note + '\n' : '') + u.noteAdd;
      try { await patchTask(u.id, patch, true); okU++; } catch (e) { errs.push(u.code + ': ' + e.message); }
    }
    for (var j = 0; j < prs.length; j++) {
      st.imp = { busy: 'Đang ghi ' + (ups.length + j + 1) + '/' + (ups.length + prs.length) + '…' }; renderModal();
      var p = prs[j];
      try {
        await createTask({ id: 0, title: p.text, code: p.code, owner: p.owner, collab: [], followers: [], project: '', week: weekLabel(), priority: 'Trung bình',
          status: 'Chưa làm', stage: 'Chuẩn bị', type: 'Đề xuất', approval: 'Chờ duyệt', approver: admin ? admin.id : null, assigner: p.owner, progress: 0,
          score: null, assigned: today(), due: null, done: null, repeat: 'Không', waitFor: null, reviewNote: '', note: '[BCT] Đề xuất từ báo cáo tuần của ' + p.who, source: 'Ứng dụng' }, []);
        okP++;
      } catch (e) { errs.push(p.code + ': ' + e.message); }
    }
    renderAll();
    st.imp = { done: 'Đã cập nhật ' + okU + ' việc và tạo ' + okP + ' đề xuất mới (chờ anh duyệt).' + (errs.length ? ' Lỗi: ' + errs.join(' | ') : '') };
    renderModal();
  }
  function exportCsv() {
    var rows = [['Mã', 'Nội dung', 'Phụ trách', 'Dự án', 'Khâu', 'Trạng thái', 'Tiến độ (%)', 'Ngày giao', 'Hạn', 'Quá hạn (ngày)', 'Ngày hoàn thành', 'Điểm']];
    (st.listRows.length ? st.listRows : base()).forEach(function (t) {
      rows.push([t.code, t.title, t.owner && st.uMap[t.owner] ? st.uMap[t.owner].name : '', t.project, S.stageOf(t), t.status, t.progress, t.assigned, t.due, S.lateDays(t) || '', t.done, t.score || '']);
    });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([S.csv(rows)], { type: 'text/csv;charset=utf-8' }));
    a.download = 'so-giao-viec-' + S.today() + '.csv'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  /* ---------- Sự kiện ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
    var a = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    if (el.tagName === 'INPUT' && el.type === 'checkbox') return;
    switch (a) {
      case 'nav': st.view = el.getAttribute('data-v'); st.f.quick = st.view === 'list' ? st.f.quick : 'all'; renderAll(); window.scrollTo(0, 0); break;
      case 'open': openDrawer(+id); break;
      case 'new': newDrawer(); break;
      case 'close': st.drawer = null; renderDrawer(); break;
      case 'save': saveDraft(); break;
      case 'refresh': reload(false); break;
      case 'logout': S.Auth.logout(); break;
      case 'kpi':
        st.view = 'list'; st.f.quick = el.getAttribute('data-q'); st.f.stage = ''; renderAll(); break;
      case 'drill':
        st.view = 'list'; st.f.quick = 'late'; st.f.stage = el.getAttribute('data-s') || ''; st.f.person = el.getAttribute('data-p') === '0' ? 'none' : el.getAttribute('data-p'); renderAll(); break;
      case 'quickf': st.f.quick = el.getAttribute('data-q'); renderContent(); break;
      case 'clearStage': st.f.stage = ''; renderContent(); break;
      case 'sort': var k = el.getAttribute('data-k'); st.sort = { k: k, dir: st.sort.k === k ? -st.sort.dir : 1 }; renderContent(); break;
      case 'export': exportCsv(); break;
      case 'repTab': st.rep.tab = el.getAttribute('data-v'); renderContent(); break;
      case 'repSubmit': repSubmit(); break;
      case 'repCsv': repCsv(); break;
      case 'repCreate': repCreate(); break;
      case 'imp': st.imp = {}; renderModal(); break;
      case 'impClose': st.imp = null; renderModal(); break;
      case 'impPick': var fi = $('#imp-file'); fi.value = ''; fi.click(); break;
      case 'impApply': impApply(); break;
      case 'toggleDone': st.showDone = !st.showDone; renderContent(); break;
      case 'toggleCollab':
        var dd = st.drawer, n = +id, i = dd.draft.collab.indexOf(n);
        if (i >= 0) dd.draft.collab.splice(i, 1); else dd.draft.collab.push(n);
        renderDrawer(); break;
      case 'quick':
        var t = st.byId[+id], what = el.getAttribute('data-do');
        patchTask(+id, what === 'start' ? { status: 'Đang làm', stage: 'Thực hiện' } : { status: 'Chờ nghiệm thu', stage: 'Nghiệm thu', progress: 100 }).catch(function () { });
        break;
      case 'decide': decide(+id, el.getAttribute('data-do')); break;
      case 'accept': accept(+id); break;
      case 'rework': rework(+id); break;
      case 'ckAdd': ckAdd(); break;
      case 'ckDel': ckDel(id); break;
      case 'del': delTask(+id); break;
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.matches('[data-act="ckToggle"]')) { ckToggle(el.getAttribute('data-id'), el.checked); return; }
    if (el.matches('[data-rep="week"]')) { repInit(el.value); renderContent(); return; }
    if (el.id === 'imp-file') { if (el.files.length) impRead(Array.prototype.slice.call(el.files)); return; }
    if (el.matches('[data-imp]')) { var k = el.getAttribute('data-imp'), arr = k[0] === 'u' ? st.imp.plan.updates : st.imp.plan.proposals; arr[+k.slice(1)].include = el.checked; var b = $('#modal .body'), top = b ? b.scrollTop : 0; renderModal(); b = $('#modal .body'); if (b) b.scrollTop = top; return; }
    if (el.matches('[data-fl]')) { st.f[el.getAttribute('data-fl')] = el.value; renderTop(); renderContent(); return; }
    if (el.matches('[data-f]')) setField(el.getAttribute('data-f'), el);
  });
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.matches('[data-rp]')) { var dd = st.rep.drafts[+el.getAttribute('data-id')] = st.rep.drafts[+el.getAttribute('data-id')] || { rating: '', result: '' }; dd[el.getAttribute('data-rp')] = el.value; return; }
    if (el.matches('[data-rps]')) { st.rep.sum[el.getAttribute('data-rps')] = el.value; return; }
    if (el.id === 'q') { st.f.q = el.value; clearTimeout(st._qt); st._qt = setTimeout(renderContent, 200); return; }
    if (el.matches('[data-f]') && (el.tagName === 'TEXTAREA' || el.type === 'range' || el.type === 'text' || el.type === 'date')) setField(el.getAttribute('data-f'), el);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && st.drawer) { st.drawer = null; renderDrawer(); }
    if (e.key === 'Enter' && e.target.id === 'ck-new') { e.preventDefault(); ckAdd(); }
  });
  document.addEventListener('dragstart', function (e) {
    var c = e.target.closest && e.target.closest('.tcard'); if (!c) return;
    e.dataTransfer.setData('text/plain', c.getAttribute('data-id')); e.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragover', function (e) {
    var col = e.target.closest && e.target.closest('.col'); if (!col) return;
    e.preventDefault(); col.classList.add('over');
  });
  document.addEventListener('dragleave', function (e) { var col = e.target.closest && e.target.closest('.col'); if (col) col.classList.remove('over'); });
  document.addEventListener('drop', function (e) {
    var col = e.target.closest && e.target.closest('.col'); if (!col) return;
    e.preventDefault(); col.classList.remove('over');
    moveStage(+e.dataTransfer.getData('text/plain'), col.getAttribute('data-stage'));
  });

  /* ---------- Khởi động ---------- */
  function shell() {
    $('#app').innerHTML = '<div class="shell"><aside class="side" id="side"></aside><div class="main"><div class="top" id="top"></div><div class="content" id="content"></div></div></div><nav class="bottomnav" id="bottomnav"></nav><div id="drawer"></div><div id="modal"></div><input type="file" id="imp-file" accept=".xlsx" multiple hidden>';
  }
  function gate(msg, loginBtn, err) {
    $('#app').innerHTML = '<div class="gate"><div class="logo">CNH</div><h1>Sổ giao việc CNH</h1><p>' + msg + '</p>' + (err ? '<div class="err">' + esc(err) + '</div>' : '') +
      (loginBtn ? '<button class="btn pri" id="btn-login">Đăng nhập bằng Microsoft 365</button>' : '') + '<p class="note" style="margin-top:16px">Muốn xem thử không cần đăng nhập? <a href="?mock=1">Mở chế độ xem thử</a></p></div>';
    var b = $('#btn-login'); if (b) b.addEventListener('click', function () { S.Auth.login(); });
  }
  function loadScript(src) {
    return new Promise(function (ok, bad) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error('Không tải được ' + src)); }; document.head.appendChild(s); });
  }
  async function boot() {
    var q = new URLSearchParams(location.search), data, email = '', dispName = '';
    if (q.get('today')) S.fakeToday = q.get('today');
    try {
      if (q.get('mock') === '1') {
        st.mock = true; data = S.MockData();
        var who = q.get('as') || 'thanh', key = { thanh: 9, hieu: 12, thang: 13, dong: 14, doan: 15, luong: 16, duong: 17, dung: 18 }[who] || 9;
        var u0 = C.users.filter(function (u) { return u.id === key; })[0]; email = u0.email.toLowerCase(); dispName = u0.name;
        if (q.get('reset') === '1') data.reset && data.reset();
      } else {
        if (!S.Auth.configured()) { gate('Ứng dụng chưa được kết nối với Microsoft 365. Quản trị viên cần điền Client ID và Tenant ID trong file js/config.js.', false); return; }
        await loadScript('vendor/msal-browser.min.js');
        var acc = await S.Auth.start();
        if (!acc) { gate('Đăng nhập bằng tài khoản công ty để xem và cập nhật công việc.', true); return; }
        email = (acc.username || '').toLowerCase(); dispName = acc.name || email;
        data = S.GraphData(S.Auth.token);
      }
      shell(); st.loading = true; renderAll();
      var info = await data.init();
      st.data = data; st.users = info.users; st.choices = info.choices || {};
      st.users.sort(function (a, b) { return a.name.localeCompare(b.name, 'vi'); });
      st.users.forEach(function (u) { st.uMap[u.id] = u; });
      var me = st.users.filter(function (u) { return u.email === email; })[0];
      st.me = me || { id: null, name: dispName, email: email };
      st.isAdmin = (C.admins || []).indexOf(email) >= 0;
      st.hasReports = !!info.hasReports;
      var r = await Promise.all([data.listTasks(), data.listChecks(), data.listReports()]);
      setTasks(r[0]); st.checks = r[1]; st.reports = r[2]; repInit();
      st.view = st.isAdmin ? 'overview' : 'mine';
      if (!st.isAdmin && !me) S.toast('Tài khoản này chưa có trong danh sách người dùng của site SERVICE.', 'err');
      st.loading = false; renderAll();
      if (C.refreshSeconds && !st.mock) setInterval(function () { if (!document.hidden && !st.drawer) reload(true); }, C.refreshSeconds * 1000);
    } catch (e) {
      console.error(e);
      var acc2 = !st.mock && S.Auth.configured() && S.Auth.account && S.Auth.account();
      if (acc2) {
        gate('Đang đăng nhập bằng <b>' + esc(acc2.username) + '</b> nhưng tài khoản này chưa mở được dữ liệu. Anh chọn đúng tài khoản công ty (@cnh.com.vn).', false, e.message);
        var g = $('.gate'), b2 = document.createElement('button'); b2.className = 'btn pri'; b2.textContent = 'Đăng xuất, chọn tài khoản khác';
        b2.addEventListener('click', function () { S.Auth.logout(); }); g.insertBefore(b2, g.querySelector('.note'));
      } else gate('Không mở được dữ liệu.', !st.mock && S.Auth.configured(), e.message);
    }
  }
  S.boot = boot;
  document.addEventListener('DOMContentLoaded', boot);
})(window.SGV);
