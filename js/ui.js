window.SGV = window.SGV || {};
(function (S) {
  'use strict';
  var esc = S.esc;
  var ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    mine: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    board: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    approve: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    refresh: '<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>',
    upload: '<path d="M12 16V5M7 9l5-5 5 5M4 20h16"/>',
    report: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    logout: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>'
  };
  S.icon = function (n) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + '</svg>'; };

  S.avatar = function (name, key) {
    return '<span class="av" style="--h:' + S.hue(key == null ? name : key) + '">' + esc(S.initials(name)) + '</span>';
  };
  S.dueChip = function (t) {
    if (S.isDone(t)) return '<span class="chip ok">Xong ' + S.fmt(t.done || t.due) + '</span>';
    if (!t.due) return '<span class="chip">Chưa đặt hạn</span>';
    var d = S.diffDays(t.due, S.today());
    if (d < 0) return '<span class="chip late">Trễ ' + (-d) + ' ngày</span>';
    if (d === 0) return '<span class="chip warn">Hôm nay</span>';
    if (d <= 3) return '<span class="chip warn">Còn ' + d + ' ngày</span>';
    return '<span class="chip">' + S.fmt(t.due) + '</span>';
  };
  S.statusChip = function (t) {
    var cls = { 'Hoàn thành': 'ok', 'Chờ nghiệm thu': 'brand', 'Đang làm': 'info', 'Đang chờ': 'warn' }[t.status] || '';
    return '<span class="chip ' + cls + '">' + esc(t.status || '—') + '</span>';
  };
  S.progBar = function (p) {
    p = Math.max(0, Math.min(100, +p || 0));
    return '<div class="prog"><div class="track"><i style="width:' + p + '%"></i></div><span>' + p + '%</span></div>';
  };

  /* ---------- Tổng quan ---------- */
  S.viewOverview = function (st, ts) {
    var T = ts.filter(S.counted), u = st.uMap;
    var k = { total: T.length, done: 0, open: 0, doing: 0, late: 0, soon: 0, review: 0 };
    T.forEach(function (t) {
      if (S.isDone(t)) { k.done++; return; }
      k.open++;
      if (t.status === 'Đang làm') k.doing++;
      if (t.status === 'Chờ nghiệm thu') k.review++;
      if (S.isLate(t)) k.late++;
      else if (t.due && S.diffDays(t.due, S.today()) <= 3) k.soon++;
    });
    var pct = k.total ? Math.round(k.done * 100 / k.total) : 0;
    var onTime = 0, doneWithDue = 0;
    T.forEach(function (t) { if (S.isDone(t) && t.due && t.done) { doneWithDue++; if (t.done <= t.due) onTime++; } });
    var ontimePct = doneWithDue ? Math.round(onTime * 100 / doneWithDue) + '%' : '—';

    var kpi = function (cls, n, l, act) {
      return '<button class="kpi ' + cls + '" data-act="kpi" data-q="' + act + '"><div class="n">' + n + '</div><div class="l">' + l + '</div></button>';
    };
    var html = '<div class="kpis">' +
      kpi('', k.total, 'Tổng số việc', 'all') + kpi('ok', k.done + ' <small style="font-size:14px;color:var(--ink3)">(' + pct + '%)</small>', 'Đã hoàn thành', 'done') +
      kpi('info', k.open, 'Đang mở', 'open') + kpi('late', k.late, 'Quá hạn', 'late') +
      kpi('warn', k.soon, 'Sắp đến hạn (≤3 ngày)', 'soon') + kpi('', ontimePct, 'Xong đúng hạn', 'done') + '</div>';

    // Ma trận trễ: người × khâu
    var rows = {}, ensure = function (pid) {
      var key = pid || 0;
      if (!rows[key]) rows[key] = { pid: pid || 0, total: 0, done: 0, late: 0, st: {} };
      return rows[key];
    };
    T.forEach(function (t) {
      var r = ensure(t.owner); r.total++;
      if (S.isDone(t)) r.done++;
      else if (S.isLate(t)) { r.late++; var s = S.stageOf(t); r.st[s] = (r.st[s] || 0) + 1; }
    });
    var list = Object.keys(rows).map(function (x) { return rows[x]; }).sort(function (a, b) { return b.late - a.late || b.total - a.total; });
    var tot = { total: 0, done: 0, late: 0, st: {} };
    var cell = function (n, pid, stage) {
      if (!n) return '<span class="cell zero">·</span>';
      return '<button class="cell ' + (n >= 3 ? 'l3' : n === 2 ? '' : 'l1') + '" data-act="drill" data-p="' + pid + '" data-s="' + esc(stage) + '">' + n + '</button>';
    };
    var body = list.map(function (r) {
      tot.total += r.total; tot.done += r.done; tot.late += r.late;
      S.STAGES.forEach(function (s) { tot.st[s] = (tot.st[s] || 0) + (r.st[s] || 0); });
      var nm = r.pid ? (u[r.pid] ? u[r.pid].name : 'Người #' + r.pid) : '(chưa giao)';
      return '<tr><td><span class="who">' + S.avatar(nm, r.pid) + esc(nm) + '</span></td>' +
        S.STAGES.map(function (s) { return '<td>' + cell(r.st[s] || 0, r.pid, s) + '</td>'; }).join('') +
        '<td>' + cell(r.late, r.pid, '') + '</td><td>' + r.total + '</td><td>' + r.done + '</td></tr>';
    }).join('');
    var matrix = '<div class="card"><h2>Việc quá hạn theo khâu và người</h2><p class="sub">Số việc chưa hoàn thành và đã quá hạn. Bấm vào số để xem danh sách.</p>' +
      '<div class="scroll-x"><table class="mx"><thead><tr><th>Người phụ trách</th>' + S.STAGES.map(function (s) { return '<th>' + s + '</th>'; }).join('') +
      '<th>Tổng trễ</th><th>Tổng việc</th><th>Xong</th></tr></thead><tbody>' + (body || '<tr><td colspan="8" class="note">Chưa có việc.</td></tr>') + '</tbody>' +
      '<tfoot><tr><td>Cộng</td>' + S.STAGES.map(function (s) { return '<td>' + (tot.st[s] || 0) + '</td>'; }).join('') +
      '<td>' + tot.late + '</td><td>' + tot.total + '</td><td>' + tot.done + '</td></tr></tfoot></table></div></div>';

    // Theo khâu (chỉ việc đang mở)
    var stBars = S.STAGES.map(function (s) {
      var open = 0, late = 0;
      T.forEach(function (t) { if (!S.isDone(t) && S.stageOf(t) === s) { open++; if (S.isLate(t)) late++; } });
      return { s: s, open: open, late: late };
    });
    var mxStage = Math.max.apply(null, stBars.map(function (b) { return b.open; }).concat([1]));
    var stageCard = '<div class="card"><h2>Việc đang mở theo khâu</h2><p class="sub">Phần đỏ là việc đã quá hạn.</p><div class="bars">' +
      stBars.map(function (b) {
        return '<div class="bar"><span>' + b.s + '</span><div class="track"><span class="seg open" style="width:' + ((b.open - b.late) / mxStage * 100) + '%"></span><span class="seg late" style="width:' + (b.late / mxStage * 100) + '%"></span></div><span class="num">' + b.open + (b.late ? ' · trễ ' + b.late : '') + '</span></div>';
      }).join('') + '</div></div>';

    // Theo dự án
    var pj = {};
    T.forEach(function (t) {
      var p = t.project || '(chưa gán dự án)';
      pj[p] = pj[p] || { total: 0, done: 0, late: 0 };
      pj[p].total++; if (S.isDone(t)) pj[p].done++; else if (S.isLate(t)) pj[p].late++;
    });
    var pjl = Object.keys(pj).sort(function (a, b) { return pj[b].total - pj[a].total; });
    var mxP = Math.max.apply(null, pjl.map(function (x) { return pj[x].total; }).concat([1]));
    var pjCard = '<div class="card"><h2>Theo dự án</h2><p class="sub">Xanh: hoàn thành · Xanh dương: đang mở · Đỏ: quá hạn</p><div class="bars">' +
      pjl.map(function (p) {
        var d = pj[p], op = d.total - d.done - d.late;
        return '<div class="bar"><span title="' + esc(p) + '" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p) + '</span><div class="track"><span class="seg done" style="width:' + (d.done / mxP * 100) + '%"></span><span class="seg open" style="width:' + (op / mxP * 100) + '%"></span><span class="seg late" style="width:' + (d.late / mxP * 100) + '%"></span></div><span class="num">' + d.done + '/' + d.total + (d.late ? ' · trễ ' + d.late : '') + '</span></div>';
      }).join('') + '</div></div>';

    // Trễ nhiều nhất
    var worst = T.filter(S.isLate).sort(function (a, b) { return S.lateDays(b) - S.lateDays(a); }).slice(0, 8);
    var worstCard = '<div class="card"><h2>Việc trễ lâu nhất</h2><p class="sub">Tám việc quá hạn nhiều ngày nhất.</p>' +
      (worst.length ? worst.map(function (t) {
        var nm = t.owner && u[t.owner] ? u[t.owner].name : '(chưa giao)';
        return '<div class="trow" style="grid-template-columns:minmax(0,1fr) auto" data-act="open" data-id="' + t.id + '"><div><div class="ttitle">' + esc(t.title) + '</div><div class="tmeta"><span>' + esc(nm) + '</span><span>' + esc(S.stageOf(t)) + '</span><span>' + esc(t.project || '') + '</span></div></div>' + S.dueChip(t) + '</div>';
      }).join('') : '<div class="empty">Không có việc nào quá hạn.</div>') + '</div>';

    return html + '<div style="margin-bottom:16px">' + matrix + '</div><div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">' + stageCard + pjCard + '</div><div>' + worstCard + '</div>';
  };

  /* ---------- Việc của tôi ---------- */
  S.taskRow = function (st, t, actions) {
    var u = st.uMap, nm = t.owner && u[t.owner] ? u[t.owner].name : '(chưa giao)';
    return '<div class="trow ' + (S.isLate(t) ? 'late' : '') + '" data-act="open" data-id="' + t.id + '">' +
      '<div><div class="ttitle">' + esc(t.title) + '</div><div class="tmeta"><span>' + esc(t.code) + '</span>' + (t.project ? '<span>' + esc(t.project) + '</span>' : '') + '<span>' + esc(nm) + '</span>' + (t.priority === 'Cao' ? '<span class="chip late">Ưu tiên cao</span>' : '') + (t.approval === 'Chờ duyệt' ? '<span class="chip warn">Chờ duyệt</span>' : '') + '</div></div>' +
      '<div class="tprog">' + S.progBar(t.progress) + '</div><div>' + S.dueChip(t) + '</div><div class="tact">' + (actions || '') + '</div></div>';
  };
  S.viewMine = function (st) {
    var me = st.me, mine = st.tasks.filter(function (t) { return me && (t.owner === me.id || (t.collab || []).indexOf(me.id) >= 0) && t.approval !== 'Từ chối'; });
    var T = S.today(), grp = { late: [], week: [], later: [], review: [], done: [] };
    mine.forEach(function (t) {
      if (S.isDone(t)) grp.done.push(t);
      else if (t.status === 'Chờ nghiệm thu') grp.review.push(t);
      else if (S.isLate(t)) grp.late.push(t);
      else if (t.due && S.diffDays(t.due, T) <= 7) grp.week.push(t);
      else grp.later.push(t);
    });
    var byDue = function (a, b) { return (a.due || '9999').localeCompare(b.due || '9999'); };
    var act = function (t) {
      if (!st.canEdit(t)) return '';
      if (t.status === 'Chưa làm') return '<button class="btn sm" data-act="quick" data-id="' + t.id + '" data-do="start">Bắt đầu</button>';
      if (t.status === 'Đang làm' || t.status === 'Đang chờ') return '<button class="btn sm pri" data-act="quick" data-id="' + t.id + '" data-do="submit">Gửi nghiệm thu</button>';
      return '';
    };
    var sec = function (title, arr, cls, collapsed) {
      if (!arr.length) return '';
      arr = arr.slice().sort(byDue);
      return '<div class="group"><h3>' + title + ' <span class="chip ' + (cls || '') + '">' + arr.length + '</span></h3>' + arr.slice(0, collapsed ? 6 : 999).map(function (t) { return S.taskRow(st, t, act(t)); }).join('') + '</div>';
    };
    var out = sec('Quá hạn', grp.late, 'late') + sec('Đến hạn trong 7 ngày', grp.week, 'warn') + sec('Chờ nghiệm thu', grp.review, 'brand') +
      sec('Việc còn lại', grp.later, '') + sec('Đã hoàn thành gần đây', grp.done.sort(function (a, b) { return (b.done || '').localeCompare(a.done || ''); }), 'ok', true);
    return out || '<div class="empty">Chưa có việc nào giao cho ' + (me ? esc(me.name) : 'anh') + '.</div>';
  };

  /* ---------- Bảng theo khâu ---------- */
  S.viewBoard = function (st, ts) {
    var u = st.uMap, T = ts.filter(function (t) { return S.counted(t) && (st.showDone || !S.isDone(t)); });
    var cols = S.STAGES.map(function (s) {
      var arr = T.filter(function (t) { return S.stageOf(t) === s; }).sort(function (a, b) { return (a.due || '9999').localeCompare(b.due || '9999'); });
      var late = arr.filter(S.isLate).length;
      return '<div class="col" data-stage="' + esc(s) + '"><h3>' + s + '<span class="chip ' + (late ? 'late' : '') + '">' + arr.length + (late ? ' · trễ ' + late : '') + '</span></h3>' +
        arr.map(function (t) {
          var nm = t.owner && u[t.owner] ? u[t.owner].name : '(chưa giao)';
          var blocked = t.waitFor && st.byId[t.waitFor] && !S.isDone(st.byId[t.waitFor]);
          return '<div class="tcard ' + (S.isLate(t) ? 'late' : '') + '" draggable="' + (st.canEdit(t) ? 'true' : 'false') + '" data-act="open" data-id="' + t.id + '">' +
            '<div class="ttitle">' + esc(t.title) + '</div>' + S.progBar(t.progress) +
            '<div class="ft"><span class="who">' + S.avatar(nm, t.owner || 0) + '<span>' + esc(nm) + '</span></span><span style="flex:1"></span>' + S.dueChip(t) + '</div>' +
            ((t.project || blocked) ? '<div class="tmeta">' + (t.project ? '<span>' + esc(t.project) + '</span>' : '') + (blocked ? '<span class="chip warn">Chờ việc #' + t.waitFor + '</span>' : '') + '</div>' : '') + '</div>';
        }).join('') + (arr.length ? '' : '<div class="note" style="padding:8px">Không có việc.</div>') + '</div>';
    }).join('');
    return '<div class="chips"><button class="chipbtn ' + (st.showDone ? 'on' : '') + '" data-act="toggleDone">Hiện cả việc đã xong</button><span class="note" style="align-self:center">Kéo thả thẻ sang cột khác để đổi khâu.</span></div><div class="board">' + cols + '</div>';
  };

  /* ---------- Danh sách ---------- */
  S.viewList = function (st, ts) {
    var f = st.f, u = st.uMap;
    var T = ts.filter(function (t) {
      if (!S.counted(t) && f.quick !== 'review' && f.quick !== 'all') return false;
      if (f.stage && S.stageOf(t) !== f.stage) return false;
      if (f.q) {
        var hay = (t.title + ' ' + t.code + ' ' + (t.project || '') + ' ' + (t.owner && u[t.owner] ? u[t.owner].name : '') + ' ' + (t.note || '')).toLowerCase();
        if (hay.indexOf(f.q.toLowerCase()) < 0) return false;
      }
      switch (f.quick) {
        case 'late': return S.isLate(t);
        case 'open': return !S.isDone(t);
        case 'soon': return !S.isDone(t) && !S.isLate(t) && t.due && S.diffDays(t.due, S.today()) <= 3;
        case 'done': return S.isDone(t);
        case 'review': return t.status === 'Chờ nghiệm thu' || t.approval === 'Chờ duyệt';
        default: return true;
      }
    });
    var s = st.sort, dir = s.dir;
    var key = function (t) {
      switch (s.k) {
        case 'owner': return t.owner && u[t.owner] ? u[t.owner].name : '~';
        case 'progress': return t.progress || 0;
        case 'due': return t.due || '9999';
        default: return String(t[s.k] || '');
      }
    };
    T.sort(function (a, b) { var x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
    st.listRows = T;
    var chip = function (id, label) { return '<button class="chipbtn ' + (f.quick === id ? 'on' : '') + '" data-act="quickf" data-q="' + id + '">' + label + '</button>'; };
    var th = function (k, label) { return '<th data-act="sort" data-k="' + k + '">' + label + (s.k === k ? (dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; };
    var body = T.map(function (t) {
      var nm = t.owner && u[t.owner] ? u[t.owner].name : '(chưa giao)';
      return '<tr data-act="open" data-id="' + t.id + '"><td class="code">' + esc(t.code) + '</td><td class="tt">' + esc(t.title) + '</td><td><span class="who">' + S.avatar(nm, t.owner || 0) + esc(nm) + '</span></td><td>' + esc(t.project || '') + '</td><td>' + esc(S.stageOf(t)) + '</td><td>' + S.statusChip(t) + '</td><td style="min-width:110px">' + S.progBar(t.progress) + '</td><td>' + S.dueChip(t) + '</td></tr>';
    }).join('');
    return '<div class="chips">' + chip('all', 'Tất cả') + chip('open', 'Đang mở') + chip('late', 'Quá hạn') + chip('soon', 'Sắp đến hạn') + chip('review', 'Chờ duyệt / nghiệm thu') + chip('done', 'Đã xong') +
      (f.stage ? '<button class="chipbtn on" data-act="clearStage">Khâu: ' + esc(f.stage) + ' ✕</button>' : '') +
      '<span style="flex:1"></span><button class="btn sm" data-act="export">' + S.icon('download') + ' Xuất CSV</button></div>' +
      '<div class="scroll-x"><table class="list"><thead><tr>' + th('code', 'Mã') + th('title', 'Nội dung') + th('owner', 'Phụ trách') + th('project', 'Dự án') + th('stage', 'Khâu') + th('status', 'Trạng thái') + th('progress', 'Tiến độ') + th('due', 'Hạn') + '</tr></thead><tbody>' +
      (body || '<tr><td colspan="8"><div class="empty" style="border:0">Không có việc phù hợp.</div></td></tr>') + '</tbody></table></div><p class="note">' + T.length + ' việc</p>';
  };

  /* ---------- Chờ duyệt ---------- */
  S.viewApprovals = function (st) {
    var props = st.tasks.filter(function (t) { return t.approval === 'Chờ duyệt'; });
    var revs = st.tasks.filter(function (t) { return t.status === 'Chờ nghiệm thu' && t.approval !== 'Từ chối' && t.approval !== 'Chờ duyệt'; });
    var out = '';
    out += '<div class="group"><h3>Đề xuất chờ duyệt <span class="chip warn">' + props.length + '</span></h3>' + (props.map(function (t) {
      return S.taskRow(st, t, st.isAdmin ? '<button class="btn sm ok" data-act="decide" data-id="' + t.id + '" data-do="approve">Duyệt</button><button class="btn sm" data-act="open" data-id="' + t.id + '">Xem</button>' : '');
    }).join('') || '<div class="empty">Không có đề xuất nào chờ duyệt.</div>') + '</div>';
    out += '<div class="group"><h3>Chờ nghiệm thu <span class="chip brand">' + revs.length + '</span></h3>' + (revs.map(function (t) {
      return S.taskRow(st, t, st.isAdmin ? '<button class="btn sm pri" data-act="open" data-id="' + t.id + '">Nghiệm thu</button>' : '');
    }).join('') || '<div class="empty">Không có việc nào chờ nghiệm thu.</div>') + '</div>';
    return out;
  };

  /* ---------- Ngăn chi tiết / thêm việc ---------- */
  S.viewDrawer = function (st) {
    var d = st.drawer; if (!d) return '';
    var t = d.draft, isNew = d.mode === 'new', u = st.users, canE = isNew || st.canEdit(d.orig), adm = st.isAdmin;
    var dis = function (f) { return canE && (isNew || adm || st.engFields.indexOf(f) >= 0) ? '' : ' disabled'; };
    var opt = function (arr, v, blank) { return (blank ? '<option value=""' + (!v ? ' selected' : '') + '>' + blank + '</option>' : '') + arr.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join(''); };
    var statusOpts = adm ? S.STATUSES : S.STATUSES.filter(function (x) { return x !== 'Hoàn thành' || t.status === 'Hoàn thành'; });
    var userOpt = function (v, blank) { return '<option value=""' + (!v ? ' selected' : '') + '>' + blank + '</option>' + u.map(function (x) { return '<option value="' + x.id + '"' + (x.id === v ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join(''); };
    var projects = st.projects();
    var others = st.tasks.filter(function (x) { return x.id !== t.id; });
    var checks = isNew ? d.newChecks.map(function (c, i) { return { id: 'n' + i, text: c, ok: false }; }) : st.checks.filter(function (c) { return c.taskId === t.id; });
    var done = checks.filter(function (c) { return c.ok; }).length;

    var wkList = st.weekChoices(t.week), weekOpt = '<option value="">(chưa đặt)</option>' + wkList.map(function (w) { return '<option' + (w === t.week ? ' selected' : '') + '>' + esc(w) + '</option>'; }).join('');
    var h = '<div class="scrim" data-act="close"></div><aside class="drawer" role="dialog" aria-label="Chi tiết việc"><header><h2>' + (isNew ? (adm ? 'Giao việc mới' : 'Đề xuất việc mới') : esc(t.code || 'Chi tiết việc')) + '</h2>' +
      (isNew ? '' : S.statusChip(t) + S.dueChip(t)) + '<button class="iconbtn" data-act="close" title="Đóng">' + S.icon('x') + '</button></header><div class="body">';
    if (!isNew && !canE) h += '<div class="banner">Anh chỉ xem được việc này. Chỉ người phụ trách, người phối hợp và người giao việc mới sửa được.</div>';
    if (!isNew && t.approval === 'Chờ duyệt') h += '<div class="banner">Đề xuất này đang chờ anh Thành duyệt.</div>';
    h += '<div class="frm">' +
      '<div class="full"><label>Nội dung việc</label><textarea data-f="title"' + dis('title') + '>' + esc(t.title) + '</textarea></div>' +
      '<div><label>Phụ trách</label><select data-f="owner"' + dis('owner') + '>' + userOpt(t.owner, '(chưa giao)') + '</select></div>' +
      '<div><label>Dự án</label><input data-f="project" list="dl-projects" value="' + esc(t.project || '') + '"' + dis('project') + '><datalist id="dl-projects">' + projects.map(function (p) { return '<option value="' + esc(p) + '">'; }).join('') + '</datalist></div>' +
      '<div class="full"><label>Phối hợp</label><div class="pick">' + u.map(function (x) { return '<button type="button" class="' + ((t.collab || []).indexOf(x.id) >= 0 ? 'on' : '') + '" data-act="toggleCollab" data-id="' + x.id + '"' + (canE ? '' : ' disabled') + '>' + esc(x.name) + '</button>'; }).join('') + '</div></div>' +
      '<div><label>Tuần giao</label><select data-f="week"' + dis('week') + '>' + weekOpt + '</select></div>' +
      '<div><label>Tuần hoàn thành</label><input value="' + esc(t.weekDone || '') + '" placeholder="(tự điền khi nghiệm thu)" disabled></div>' +
      '<div><label>Ngày giao</label><input type="date" data-f="assigned" value="' + esc(t.assigned || '') + '"' + dis('assigned') + '></div>' +
      '<div><label>Hạn hoàn thành</label><input type="date" data-f="due" value="' + esc(t.due || '') + '"' + dis('due') + '></div>' +
      '<div><label>Khâu</label><select data-f="stage"' + dis('stage') + '>' + opt(S.STAGES, t.stage || 'Chuẩn bị') + '</select></div>' +
      '<div><label>Trạng thái</label><select data-f="status"' + dis('status') + '>' + opt(statusOpts, t.status || 'Chưa làm') + '</select></div>' +
      '<div><label>Ưu tiên</label><select data-f="priority"' + dis('priority') + '>' + opt(S.PRIORITIES, t.priority || 'Trung bình') + '</select></div>' +
      '<div><label>Lặp lại</label><select data-f="repeat"' + dis('repeat') + '>' + opt(S.REPEATS, t.repeat || 'Không') + '</select></div>' +
      '<div class="full"><label>Tiến độ</label><div class="rng"><input type="range" min="0" max="100" step="5" data-f="progress" value="' + (t.progress || 0) + '"' + dis('progress') + '><b id="progv">' + (t.progress || 0) + '%</b></div></div>' +
      '<div><label>Chờ việc (phụ thuộc)</label><select data-f="waitFor"' + dis('waitFor') + '><option value="">Không</option>' + others.map(function (x) { return '<option value="' + x.id + '"' + (x.id === t.waitFor ? ' selected' : '') + '>' + esc((x.code || '#' + x.id) + ' · ' + x.title.slice(0, 40)) + '</option>'; }).join('') + '</select></div>' +
      '<div><label>Người theo dõi</label><select data-f="followers1"' + dis('followers') + '>' + userOpt((t.followers || [])[0] || null, '(không)') + '</select></div>' +
      '<div class="full"><label>Ghi chú</label><textarea data-f="note"' + dis('note') + '>' + esc(t.note || '') + '</textarea></div></div>';

    // Tiêu chí đánh giá
    h += '<div class="sec"><h3>Tiêu chí đánh giá ' + (checks.length ? '<span class="chip">' + done + '/' + checks.length + '</span>' : '') + '</h3>' +
      checks.map(function (c) {
        return '<div class="ck ' + (c.ok ? 'done' : '') + '"><input type="checkbox" data-act="ckToggle" data-id="' + c.id + '"' + (c.ok ? ' checked' : '') + (canE && !isNew ? '' : ' disabled') + '><span>' + esc(c.text) + '</span>' +
          (canE ? '<button class="iconbtn" data-act="ckDel" data-id="' + c.id + '" title="Xóa tiêu chí">' + S.icon('x') + '</button>' : '') + '</div>';
      }).join('') + (checks.length ? '' : '<div class="note">Chưa có tiêu chí. Thêm các điều kiện để coi là đạt, ví dụ "có biên bản ký".</div>') +
      (canE ? '<div class="addrow"><input id="ck-new" placeholder="Thêm tiêu chí rồi nhấn Enter" data-act-enter="ckAdd"><button class="btn" data-act="ckAdd">Thêm</button></div>' : '') +
      (isNew ? '<div class="note" style="margin-top:6px">Tiêu chí được lưu cùng lúc khi bấm Lưu.</div>' : '') + '</div>';

    // Duyệt / nghiệm thu
    if (!isNew && adm) {
      if (t.approval === 'Chờ duyệt') {
        h += '<div class="sec"><h3>Duyệt đề xuất</h3><div class="review"><div class="frm"><div class="full"><label>Nhận xét (nếu cần sửa hoặc từ chối)</label><textarea data-f="reviewNote">' + esc(t.reviewNote || '') + '</textarea></div></div>' +
          '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn ok" data-act="decide" data-do="approve" data-id="' + t.id + '">Duyệt</button><button class="btn" data-act="decide" data-do="revise" data-id="' + t.id + '">Cần sửa</button><button class="btn bad" data-act="decide" data-do="reject" data-id="' + t.id + '">Từ chối</button></div></div></div>';
      } else if (t.status === 'Chờ nghiệm thu') {
        h += '<div class="sec"><h3>Nghiệm thu</h3><div class="review"><div class="frm"><div><label>Điểm đánh giá (1–5)</label><select id="acc-score">' + [5, 4, 3, 2, 1].map(function (n) { return '<option' + (n === (t.score || 4) ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>' +
          '<div class="full"><label>Nhận xét</label><textarea data-f="reviewNote">' + esc(t.reviewNote || '') + '</textarea></div></div>' +
          '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn ok" data-act="accept" data-id="' + t.id + '">Nghiệm thu, hoàn thành</button><button class="btn bad" data-act="rework" data-id="' + t.id + '">Yêu cầu làm lại</button></div>' +
          (checks.length && done < checks.length ? '<div class="note" style="margin-top:8px">Còn ' + (checks.length - done) + ' tiêu chí chưa đạt.</div>' : '') + '</div></div>';
      } else if (S.isDone(t)) {
        h += '<div class="sec"><h3>Kết quả</h3><div class="review">Điểm <b>' + (t.score || '—') + '</b>' + (t.reviewNote ? ' · ' + esc(t.reviewNote) : '') + '</div></div>';
      }
    } else if (!isNew && (S.isDone(t) || t.reviewNote)) {
      h += '<div class="sec"><h3>Nhận xét của người duyệt</h3><div class="review">' + (S.isDone(t) ? 'Điểm <b>' + (t.score || '—') + '</b> · ' : '') + esc(t.reviewNote || 'Không có nhận xét.') + '</div></div>';
    }

    h += '</div><footer>' + (canE ? '<button class="btn pri" data-act="save">' + (isNew ? (adm ? 'Giao việc' : 'Gửi đề xuất') : 'Lưu thay đổi') + '</button>' : '') +
      '<button class="btn" data-act="close">Đóng</button><span style="flex:1"></span>' +
      (!isNew && adm ? '<button class="btn bad" data-act="del" data-id="' + t.id + '">Xóa việc</button>' : '') + '</footer></aside>';
    return h;
  };

  /* ---------- Hộp nhập báo cáo tuần ---------- */
  function viewAssign(st, im) {
    var a = im.asg, nc = a.creates.filter(function (x) { return x.include; }).length, nu = a.updates.filter(function (x) { return x.include; }).length;
    var nm = function (id) { return id && st.uMap[id] ? st.uMap[id].name : '(trống)'; };
    var h = '<div class="scrim" data-act="impClose"></div><aside class="drawer wide" role="dialog" aria-label="Đồng bộ giao việc từ Excel"><header><h2>Đồng bộ giao việc từ Excel</h2><button class="iconbtn" data-act="impClose" title="Đóng">' + S.icon('x') + '</button></header><div class="body">';
    h += '<p class="note">File: ' + esc(a.file) + '. Excel làm chủ thông tin giao việc (mã, nội dung, người nhận, phối hợp, tuần giao, hạn). Trạng thái và tiến độ giữ nguyên, lấy từ báo cáo tuần.</p>';
    h += '<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))"><div class="kpi ok"><div class="n">' + a.creates.length + '</div><div class="l">Việc mới sẽ tạo</div></div><div class="kpi info"><div class="n">' + a.updates.length + '</div><div class="l">Việc có thay đổi</div></div><div class="kpi"><div class="n">' + a.same + '</div><div class="l">Đã khớp, không đổi</div></div><div class="kpi"><div class="n">' + a.props + '</div><div class="l">Việc đề xuất chờ gán mã (bỏ qua)</div></div></div>';
    if (a.warns.length) h += '<h3>Cần xem lại (' + a.warns.length + ')</h3><ul class="sm">' + a.warns.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>';
    if (a.creates.length) h += '<h3>Việc mới (' + nc + '/' + a.creates.length + ' sẽ tạo)</h3><table class="tbl"><thead><tr><th></th><th>Mã</th><th>Nội dung</th><th>Phụ trách</th><th>Tuần</th><th>Hạn</th></tr></thead><tbody>' + a.creates.map(function (c, i) {
      return '<tr><td><input type="checkbox" data-asg="c' + i + '"' + (c.include ? ' checked' : '') + '></td><td><b>' + esc(c.code) + '</b></td><td class="sm">' + esc(c.want.title) + '</td><td>' + esc(c.ownerName || '(trống)') + '</td><td>' + esc(c.want.week) + '</td><td>' + (c.want.due ? S.fmt(c.want.due) : '') + '</td></tr>';
    }).join('') + '</tbody></table>';
    if (a.updates.length) h += '<h3>Việc có thay đổi (' + nu + '/' + a.updates.length + ' sẽ cập nhật)</h3><table class="tbl"><thead><tr><th></th><th>Mã</th><th>Việc</th><th>Đổi</th></tr></thead><tbody>' + a.updates.map(function (u, i) {
      var d = [];
      if ('owner' in u.patch) d.push('phụ trách: ' + esc(nm(u.before.owner)) + ' → <b>' + esc(nm(u.patch.owner)) + '</b>');
      if ('due' in u.patch) d.push('hạn: ' + (u.before.due ? S.fmt(u.before.due) : '(trống)') + ' → <b>' + S.fmt(u.patch.due) + '</b>');
      if ('week' in u.patch) d.push('tuần giao: ' + esc(u.before.week || '(trống)') + ' → <b>' + esc(u.patch.week) + '</b>');
      if ('collab' in u.patch) d.push('phối hợp: <b>' + (u.patch.collab.map(nm).join(', ') || '(trống)') + '</b>');
      if ('title' in u.patch) d.push('nội dung được sửa');
      return '<tr class="' + (u.done ? 'dim' : '') + '"><td><input type="checkbox" data-asg="u' + i + '"' + (u.include ? ' checked' : '') + '></td><td><b>' + esc(u.code) + '</b></td><td class="sm">' + esc(u.title) + (u.done ? '<br><span class="chip">đã hoàn thành, mặc định không đổi</span>' : '') + '</td><td class="sm">' + d.join('<br>') + '</td></tr>';
    }).join('') + '</tbody></table>';
    if (a.orphans.length) h += '<h3>Có trên web nhưng không có trong Excel (' + a.orphans.length + ')</h3><p class="note">Không bị xóa hay sửa. Có thể là việc tạo trực tiếp trên web.</p><ul class="sm">' + a.orphans.slice(0, 15).map(function (t) { return '<li><b>' + esc(t.code) + '</b> ' + esc(t.title.slice(0, 80)) + '</li>'; }).join('') + (a.orphans.length > 15 ? '<li>…và ' + (a.orphans.length - 15) + ' việc khác</li>' : '') + '</ul>';
    return h + '</div><footer><button class="btn" data-act="asgPick">Chọn file khác</button><span class="sp"></span><button class="btn" data-act="impClose">Hủy</button><button class="btn pri" data-act="asgApply"' + (nc + nu ? '' : ' disabled') + '>Xác nhận ghi ' + (nc + nu) + ' mục</button></footer></aside>';
  }
  S.viewImport = function (st) {
    var im = st.imp; if (!im) return '';
    var h = '<div class="scrim" data-act="impClose"></div><aside class="drawer wide" role="dialog" aria-label="Nhập báo cáo tuần"><header><h2>Đồng bộ báo cáo tuần</h2><button class="iconbtn" data-act="impClose" title="Đóng">' + S.icon('x') + '</button></header><div class="body">';
    if (im.busy) { h += '<div class="loading">' + esc(im.busy) + '</div></div></aside>'; return h; }
    if (im.done) {
      h += '<div class="banner ok">' + esc(im.done) + '</div></div><footer><button class="btn pri" data-act="impClose">Đóng</button></footer></aside>'; return h;
    }
    if (im.asg) return viewAssign(st, im);
    var pl = im.plan;
    if (!pl) {
      if (im.libMsg) { h += '<div class="banner">' + esc(im.libMsg) + '</div>'; }
      h += '<p>Chọn các file báo cáo tuần (<b>BCT_Wxx-2026_Sx_….xlsx</b>) mà nhân viên đã gửi. Có thể chọn nhiều file một lúc. Ứng dụng chỉ đọc, chưa ghi gì cho đến khi anh bấm xác nhận.</p>' +
        '<p><button class="btn pri" data-act="impPick">' + S.icon('upload') + ' Chọn file Excel…</button> <button class="btn" data-act="impLib">' + S.icon('refresh') + ' Thử đồng bộ lại từ thư viện</button></p>' +
        '<h3>Giao việc từ Excel</h3><p>Chọn file <b>QUANLY_Bao_cao_tuan_KT.xlsm</b> để đưa việc giao trong sheet Mã Việc lên SharePoint. Nếu file đang mở trong Excel mà trình duyệt không đọc được, anh lưu một bản sao rồi chọn bản sao.</p><p><button class="btn" data-act="asgPick">' + S.icon('upload') + ' Chọn file Excel Quản lý…</button></p>' + (im.error ? '<div class="banner err">' + esc(im.error) + '</div>' : '');
      return h + '</div></aside>';
    }
    var nUp = pl.updates.filter(function (u) { return u.include; }).length, nPr = pl.proposals.filter(function (u) { return u.include; }).length;
    h += '<h3>Các file đã đọc</h3><table class="tbl"><thead><tr><th>File</th><th>Người</th><th>Tuần</th><th>Dòng việc</th><th>Đề xuất</th></tr></thead><tbody>' +
      pl.files.map(function (f) {
        if (f.error) return '<tr><td>' + esc(f.name) + '</td><td colspan="4"><span class="chip late">' + esc(f.error) + '</span></td></tr>';
        return '<tr><td class="sm">' + esc(f.name) + '</td><td>' + esc(f.who) + (f.person ? '' : ' <span class="chip warn">chưa khớp người dùng</span>') + '</td><td>' + esc(f.week) + '</td><td>' + f.entries + '</td><td>' + f.proposals + '</td></tr>';
      }).join('') + '</tbody></table>';
    if (pl.ignored && pl.ignored.length) h += '<p class="note">Bỏ qua ' + pl.ignored.length + ' file bản cũ (cùng người, cùng tuần, đã có bản mới hơn): ' + pl.ignored.map(esc).join(', ') + '</p>';
    h += '<h3>Cập nhật việc đã giao (' + nUp + '/' + pl.updates.length + ' sẽ ghi)</h3>';
    if (!pl.updates.length) h += '<p class="note">Không có dòng nào khớp mã việc trong Sổ giao việc.</p>';
    else h += '<table class="tbl"><thead><tr><th></th><th>Mã</th><th>Việc</th><th>Người báo</th><th>Thay đổi</th></tr></thead><tbody>' + pl.updates.map(function (u, i) {
      var ch = [];
      if (u.patch.status) ch.push(esc(u.from.status) + ' → <b>' + esc(u.patch.status) + '</b>');
      if (u.patch.progress != null) ch.push('tiến độ ' + u.patch.progress + '%');
      if (!ch.length) ch.push(u.superseded ? 'chỉ ghi chú (đã có báo cáo tuần mới hơn)' : u.stale ? 'chỉ ghi chú (tuần cũ hơn lần nhập trước)' : u.driver ? 'giữ nguyên trạng thái' : 'chỉ ghi chú (' + u.role + ')');
      return '<tr class="' + (u.already ? 'dim' : '') + '"><td><input type="checkbox" data-imp="u' + i + '"' + (u.include ? ' checked' : '') + '></td><td><b>' + esc(u.code) + '</b></td><td class="sm">' + esc(u.title) + '</td><td>' + esc(u.who) + '<br><span class="note">' + esc(u.rating || '') + '</span></td><td class="sm">' + ch.join('; ') + (u.already ? '<br><span class="chip">đã nhập trước đó</span>' : '') + '</td></tr>';
    }).join('') + '</tbody></table>';
    if (pl.unmatched.length) h += '<h3>Mã việc không có trong Sổ giao việc (' + pl.unmatched.length + ')</h3><p class="note">Các dòng này sẽ không được ghi. Có thể nhân viên gõ sai mã hoặc việc chưa được giao.</p><ul class="sm">' + pl.unmatched.map(function (u) { return '<li><b>' + esc(u.code) + '</b> — ' + esc(u.who) + (u.did ? ': ' + esc(u.did.slice(0, 90)) : '') + '</li>'; }).join('') + '</ul>';
    h += '<h3>Việc nhân viên đề xuất (' + nPr + '/' + pl.proposals.length + ' sẽ tạo)</h3>';
    if (!pl.proposals.length) h += '<p class="note">Không có đề xuất mới.</p>';
    else h += '<table class="tbl"><thead><tr><th></th><th>Mã tạm</th><th>Nội dung</th><th>Người đề xuất</th></tr></thead><tbody>' + pl.proposals.map(function (u, i) {
      return '<tr class="' + (u.dup ? 'dim' : '') + '"><td><input type="checkbox" data-imp="p' + i + '"' + (u.include ? ' checked' : '') + (u.owner ? '' : ' disabled') + '></td><td><b>' + esc(u.code) + '</b></td><td class="sm">' + esc(u.text) + '</td><td>' + esc(u.who) + (u.dup ? '<br><span class="chip">đã có</span>' : '') + (u.owner ? '' : '<br><span class="chip warn">không khớp người dùng</span>') + '</td></tr>';
    }).join('') + '</tbody></table>';
    if (pl.opinions.length) h += '<h3>Ý kiến đề xuất (' + pl.opinions.length + ')</h3><p class="note">Chỉ để anh đọc, ứng dụng không ghi.</p><ul class="sm">' + pl.opinions.map(function (o) { return '<li><b>' + esc(o.who) + ':</b> ' + esc(o.text) + '</li>'; }).join('') + '</ul>';
    h += '</div><footer><button class="btn" data-act="impPick">Chọn file khác</button><span class="sp"></span><button class="btn" data-act="impClose">Hủy</button><button class="btn pri" data-act="impApply"' + (nUp + nPr ? '' : ' disabled') + '>Xác nhận ghi ' + (nUp + nPr) + ' mục</button></footer></aside>';
    return h;
  };

  /* ---------- Báo cáo tuần ---------- */
  var RCLS = { 'Hoàn thành': 'ok', 'Đang thực hiện': 'info', 'Chờ quyết định': 'warn', 'Chưa hoàn thành': 'late' };
  var rchip = function (r) { return r ? '<span class="chip ' + (RCLS[r] || '') + '">' + esc(r) + '</span>' : ''; };

  function repMine(st) {
    var R = st.rep, me = st.me, wk = R.week;
    if (!me || !me.id) return '<div class="empty">Tài khoản này chưa có trong danh sách người dùng của site SERVICE nên chưa báo cáo được.</div>';
    var sm = R.sum, subRow = st.reports.filter(function (r) { return r.kind === 'Tổng kết' && r.week === wk && r.who === me.id; })[0];
    var tasks = st.tasks.filter(function (t) {
      if (t.approval === 'Từ chối' || !(t.owner === me.id || (t.collab || []).indexOf(me.id) >= 0)) return false;
      return !S.isDone(t) || R.drafts[t.id];
    }).sort(function (a, b) { return (a.due || '9999').localeCompare(b.due || '9999'); });
    var h = subRow ? '<div class="banner ok">Anh đã nộp báo cáo ' + esc(wk) + ' ngày ' + S.fmtFull(subRow.date) + '. Anh vẫn sửa được và nộp lại.</div>' :
      '<div class="banner">Báo cáo ' + esc(wk) + ' chưa nộp. Chọn đánh giá và ghi kết quả cho từng việc, rồi bấm <b>Nộp báo cáo</b>.</div>';
    h += '<div class="group"><h3>Việc của tôi <span class="chip">' + tasks.length + '</span></h3>';
    if (!tasks.length) h += '<div class="empty">Không có việc đang mở. Anh có thể ghi ý kiến hoặc kế hoạch tuần tới ở phía dưới.</div>';
    h += tasks.map(function (t) {
      var d = R.drafts[t.id] || { rating: '', result: '' };
      return '<div class="rp-row"><div class="rp-head"><div><div class="ttitle">' + esc(t.title) + '</div><div class="tmeta"><span>' + esc(t.code) + '</span>' + (t.project ? '<span>' + esc(t.project) + '</span>' : '') +
        (t.owner === me.id ? '' : '<span class="chip">phối hợp</span>') + '</div></div><div>' + S.dueChip(t) + '</div></div>' +
        '<div class="rp-fields"><label class="field"><select data-rp="rating" data-id="' + t.id + '"><option value="">Chưa báo cáo</option>' +
        S.RATINGS.map(function (x) { return '<option' + (d.rating === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' +
        '<textarea class="rp-ta" rows="2" data-rp="result" data-id="' + t.id + '" placeholder="Kết quả tuần này: đã làm gì, còn vướng gì">' + esc(d.result || '') + '</textarea></div></div>';
    }).join('') + '</div>';
    h += '<div class="card rp-sum"><h2>Tổng kết tuần</h2><p class="sub">Kế hoạch, ý kiến và giờ làm thêm.</p>' +
      '<label class="lbl">Công việc tuần tới<textarea class="rp-ta" rows="3" data-rps="next">' + esc(sm.next) + '</textarea></label>' +
      '<label class="lbl">Ý kiến, đề xuất<textarea class="rp-ta" rows="2" data-rps="opinion">' + esc(sm.opinion) + '</textarea></label>' +
      '<label class="lbl" style="max-width:180px">Giờ làm thêm<input class="rp-in" type="number" min="0" step="0.5" data-rps="hours" value="' + esc(sm.hours) + '"></label></div>' +
      '<div class="rp-foot"><button class="btn" data-act="new">' + S.icon('plus') + ' Đề xuất việc mới</button><span class="sp"></span><button class="btn pri" data-act="repSubmit"' + (R.busy ? ' disabled' : '') + '>' + (R.busy ? 'Đang nộp…' : (subRow ? 'Nộp lại báo cáo' : 'Nộp báo cáo')) + '</button></div>';
    return h;
  }

  function repTeam(st) {
    var wk = st.rep.week, rows = st.reports.filter(function (r) { return r.week === wk; });
    var people = st.users.filter(function (u) {
      if ((window.APP_CONFIG.admins || []).indexOf((u.email || '').toLowerCase()) >= 0) return false;
      return st.tasks.some(function (t) { return t.owner === u.id; }) || rows.some(function (r) { return r.who === u.id; });
    });
    var sub = {}; rows.forEach(function (r) { if (r.kind === 'Tổng kết') sub[r.who] = r; });
    var done = people.filter(function (u) { return sub[u.id]; }), miss = people.filter(function (u) { return !sub[u.id]; });
    var h = '<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"><div class="kpi ok"><div class="n">' + done.length + '/' + people.length + '</div><div class="l">Đã nộp báo cáo ' + esc(wk) + '</div></div>' +
      '<div class="kpi ' + (miss.length ? 'late' : '') + '"><div class="n">' + miss.length + '</div><div class="l">Chưa nộp' + (miss.length ? ': ' + miss.map(function (u) { return esc(u.name); }).join(', ') : '') + '</div></div>' +
      '<div class="kpi info"><div class="n">' + rows.filter(function (r) { return r.kind === 'Việc'; }).length + '</div><div class="l">Dòng việc được báo cáo</div></div></div>' +
      '<div style="display:flex;margin-bottom:10px"><span class="sp"></span><button class="btn" data-act="repCsv">' + S.icon('download') + ' Xuất CSV</button></div>';
    h += people.map(function (u) {
      var mine = rows.filter(function (r) { return r.who === u.id && r.kind === 'Việc'; }), sm = sub[u.id];
      var body = mine.map(function (r) {
        var t = st.byId[r.taskId] || st.tasks.filter(function (x) { return x.code === r.code; })[0];
        return '<div class="rp-line"><div><b>' + esc(r.code || '') + '</b> ' + esc(t ? t.title : '') + '</div><div>' + rchip(r.rating) + '</div><div class="rp-res">' + esc(r.result || '') + '</div></div>';
      }).join('') || '<div class="note">Chưa có dòng việc nào.</div>';
      if (sm && (sm.next || sm.opinion || sm.hours)) body += '<div class="rp-extra">' + (sm.next ? '<div><b>Tuần tới:</b> ' + esc(sm.next) + '</div>' : '') + (sm.opinion ? '<div><b>Ý kiến:</b> ' + esc(sm.opinion) + '</div>' : '') + (sm.hours ? '<div><b>Giờ làm thêm:</b> ' + esc(sm.hours) + '</div>' : '') + '</div>';
      return '<div class="card rp-person"><div class="rp-ph">' + S.avatar(u.name, u.id) + '<b>' + esc(u.name) + '</b><span class="sp"></span>' + (sm ? '<span class="chip ok">Đã nộp ' + S.fmt(sm.date) + '</span>' : '<span class="chip late">Chưa nộp</span>') + '</div>' + body + '</div>';
    }).join('');
    return h;
  }

  S.viewReport = function (st) {
    var R = st.rep;
    if (!st.hasReports) {
      return st.isAdmin ? '<div class="card" style="max-width:640px"><h2>Bật báo cáo tuần trên web</h2><p class="sub">Cần một danh sách "Báo cáo tuần" trong site SERVICE để lưu báo cáo của từng người. Anh bấm nút dưới đây, ứng dụng tự tạo danh sách và các cột cần thiết.</p><button class="btn pri" data-act="repCreate">Tạo danh sách Báo cáo tuần</button></div>' :
        '<div class="empty">Anh Thành chưa bật báo cáo tuần trên web. Khi bật xong, anh sẽ điền báo cáo tại đây.</div>';
    }
    var tabs = st.isAdmin ? '<div class="segs"><button class="' + (R.tab === 'mine' ? 'on' : '') + '" data-act="repTab" data-v="mine">Báo cáo của tôi</button><button class="' + (R.tab === 'team' ? 'on' : '') + '" data-act="repTab" data-v="team">Tổng hợp cả team</button></div>' : '';
    var wk = '<label class="field"><select data-rep="week">' + st.repWeeks().map(function (w) { return '<option' + (w === R.week ? ' selected' : '') + '>' + esc(w) + '</option>'; }).join('') + '</select></label>';
    return '<div class="rp-bar">' + tabs + '<span class="sp"></span>' + wk + '</div>' + (R.tab === 'team' && st.isAdmin ? repTeam(st) : repMine(st));
  };
})(window.SGV);
