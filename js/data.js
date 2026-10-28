window.SGV = window.SGV || {};
(function (S) {
  'use strict';
  var C = window.APP_CONFIG;

  // khoá nội bộ của ứng dụng -> tên hiển thị của cột trong danh sách SharePoint
  var DN = {
    title: 'Nội dung việc', code: 'Mã việc', owner: 'Phụ trách', collab: 'Phối hợp', followers: 'Người theo dõi',
    project: 'Dự án', week: 'Tuần giao', priority: 'Ưu tiên', status: 'Trạng thái', stage: 'Khâu', type: 'Loại',
    approval: 'Phê duyệt', approver: 'Người duyệt', assigner: 'Người giao', progress: 'Tiến độ (%)',
    score: 'Điểm đánh giá', assigned: 'Ngày giao', due: 'Hạn', done: 'Ngày hoàn thành', repeat: 'Lặp lại',
    waitFor: 'Chờ việc (ID)', reviewNote: 'Nhận xét duyệt', note: 'Ghi chú', source: 'Nguồn'
  };
  var CK = { task: 'Việc', text: 'Tiêu chí', ok: 'Đạt', note: 'Ghi chú' };
  var PERSON = ['owner', 'approver', 'assigner'], PEOPLE = ['collab', 'followers'];
  var DATE = ['assigned', 'due', 'done'], NUM = ['progress', 'score', 'waitFor'];
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var norm = function (s) { return String(s || '').normalize('NFC').trim().toLowerCase(); };

  /* ---------- Microsoft Graph ---------- */
  function GraphData(getToken) {
    var base = 'https://graph.microsoft.com/v1.0';
    var siteId, listId, clId, cm = {}, ccm = {};

    async function api(method, path, body) {
      for (var i = 0; i < 4; i++) {
        var tk = await getToken();
        var r = await fetch(path.indexOf('http') === 0 ? path : base + path, {
          method: method,
          headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined
        });
        if (r.status === 429 || r.status === 503) { await sleep((+r.headers.get('Retry-After') || 2) * 1000); continue; }
        if (!r.ok) {
          var m = '';
          try { m = (await r.json()).error.message; } catch (e) { /* bỏ qua */ }
          var err = new Error(m || r.statusText); err.status = r.status; throw err;
        }
        return r.status === 204 ? null : r.json();
      }
      throw new Error('Máy chủ đang bận, anh thử lại sau ít phút.');
    }
    async function pages(path) {
      var out = [], u = path;
      while (u) { var j = await api('GET', u); out = out.concat(j.value); u = j['@odata.nextLink'] || null; }
      return out;
    }
    function mapColumns(cols, names) {
      var map = {}, byDisplay = {};
      cols.forEach(function (c) { byDisplay[norm(c.displayName)] = c; });
      Object.keys(names).forEach(function (k) {
        var c = byDisplay[norm(names[k])];
        if (c) map[k] = c.name;
      });
      return { map: map, byDisplay: byDisplay };
    }
    function toRaw(p, m) {
      var f = {};
      Object.keys(p).forEach(function (k) {
        var n = m[k]; if (!n) return;
        var v = p[k];
        if (PERSON.indexOf(k) >= 0) f[n + 'LookupId'] = v ? +v : null;
        else if (PEOPLE.indexOf(k) >= 0) { f[n + 'LookupId@odata.type'] = 'Collection(Edm.Int32)'; f[n + 'LookupId'] = (v || []).map(Number); }
        else if (DATE.indexOf(k) >= 0) f[n] = v ? v + 'T12:00:00Z' : null;
        else if (NUM.indexOf(k) >= 0) f[n] = v == null || v === '' ? null : +v;
        else f[n] = v == null || v === '' ? null : v;
      });
      return f;
    }
    function fromRaw(it) {
      var f = it.fields || {}, t = { id: +it.id };
      Object.keys(DN).forEach(function (k) {
        var n = cm[k];
        if (!n) { t[k] = PEOPLE.indexOf(k) >= 0 ? [] : null; return; }
        if (PERSON.indexOf(k) >= 0) { var r = f[n + 'LookupId']; t[k] = r ? +r : null; }
        else if (PEOPLE.indexOf(k) >= 0) { t[k] = (f[n + 'LookupId'] || []).map(Number); }
        else if (DATE.indexOf(k) >= 0) t[k] = f[n] ? String(f[n]).slice(0, 10) : null;
        else if (NUM.indexOf(k) >= 0) t[k] = f[n] == null ? null : +f[n];
        else t[k] = f[n] == null ? '' : f[n];
      });
      if (t.progress == null) t.progress = 0;
      return t;
    }
    function checkFromRaw(it) {
      var f = it.fields || {};
      var tl = f[ccm.task + 'LookupId'];
      return { id: +it.id, taskId: tl ? +tl : null, text: f[ccm.text] || '', ok: !!f[ccm.ok], note: f[ccm.note] || '' };
    }

    return {
      mode: 'live',
      async init() {
        siteId = (await api('GET', '/sites/' + C.siteHost + ':' + C.sitePath)).id;
        var lists = await pages('/sites/' + siteId + '/lists?$select=id,displayName,name');
        var a = lists.filter(function (l) { return norm(l.displayName) === norm(C.listTasks); })[0];
        var b = lists.filter(function (l) { return norm(l.displayName) === norm(C.listChecklist); })[0];
        if (!a) throw new Error('Không tìm thấy danh sách "' + C.listTasks + '" trong site SERVICE.');
        listId = a.id; clId = b ? b.id : null;
        var cols = await pages('/sites/' + siteId + '/lists/' + listId + '/columns');
        var mc = mapColumns(cols, DN); cm = mc.map;
        var choices = {};
        Object.keys(cm).forEach(function (k) {
          var c = mc.byDisplay[norm(DN[k])];
          if (c && c.choice && c.choice.choices) choices[k] = c.choice.choices;
        });
        if (clId) {
          var cc = await pages('/sites/' + siteId + '/lists/' + clId + '/columns');
          ccm = mapColumns(cc, CK).map;
        }
        // người dùng: đọc danh sách người dùng của site, ghép với bảng tên ngắn trong cấu hình
        var users = {};
        (C.users || []).forEach(function (u) { users[u.id] = { id: u.id, name: u.name, email: (u.email || '').toLowerCase() }; });
        try {
          var ul = await pages("/sites/" + siteId + "/lists/User%20Information%20List/items?$expand=fields($select=Title,EMail)&$select=id&$top=999");
          ul.forEach(function (it) {
            var id = +it.id, f = it.fields || {};
            if (!users[id] && f.EMail) users[id] = { id: id, name: f.Title || f.EMail, email: String(f.EMail).toLowerCase() };
          });
        } catch (e) { /* dùng bảng cấu hình */ }
        return { users: Object.keys(users).map(function (k) { return users[k]; }), choices: choices, hasChecklist: !!clId };
      },
      async listTasks() {
        var items = await pages('/sites/' + siteId + '/lists/' + listId + '/items?$expand=fields&$top=500');
        return items.map(fromRaw);
      },
      async listChecks() {
        if (!clId) return [];
        var items = await pages('/sites/' + siteId + '/lists/' + clId + '/items?$expand=fields&$top=999');
        return items.map(checkFromRaw);
      },
      async createTask(t) {
        var r = await api('POST', '/sites/' + siteId + '/lists/' + listId + '/items', { fields: toRaw(t, cm) });
        return fromRaw(r);
      },
      async updateTask(id, patch) {
        await api('PATCH', '/sites/' + siteId + '/lists/' + listId + '/items/' + id + '/fields', toRaw(patch, cm));
      },
      async deleteTask(id) { await api('DELETE', '/sites/' + siteId + '/lists/' + listId + '/items/' + id); },
      async createCheck(taskId, text) {
        var f = {}; f[ccm.text] = text; f[ccm.task + 'LookupId'] = +taskId; f[ccm.ok] = false;
        var r = await api('POST', '/sites/' + siteId + '/lists/' + clId + '/items', { fields: f });
        return checkFromRaw(r);
      },
      async updateCheck(id, patch) {
        var f = {};
        if ('ok' in patch) f[ccm.ok] = !!patch.ok;
        if ('text' in patch) f[ccm.text] = patch.text;
        if ('note' in patch) f[ccm.note] = patch.note;
        await api('PATCH', '/sites/' + siteId + '/lists/' + clId + '/items/' + id + '/fields', f);
      },
      async deleteCheck(id) { await api('DELETE', '/sites/' + siteId + '/lists/' + clId + '/items/' + id); }
    };
  }

  /* ---------- Chế độ giả lập (dùng để xem thử, không cần đăng nhập) ---------- */
  function MockData() {
    var KEY = 'sgv-mock-v1', db;
    function seed() {
      var T = S.today(), d = function (n) { return S.addDays(T, n); }, w = 'W' + S.isoWeek(T);
      var U = { thanh: 9, hieu: 12, thang: 13, dong: 14, doan: 15, luong: 16, duong: 17, dung: 18 };
      var n = 0, tasks = [];
      function add(title, owner, project, status, stage, due, prog, extra) {
        n++;
        var t = {
          id: n, title: title, code: 'GV-' + String(n).padStart(3, '0'), owner: owner ? U[owner] : null, collab: [], followers: [],
          project: project, week: w, priority: 'Trung bình', status: status, stage: stage, type: 'Giao việc', approval: 'Đã duyệt',
          approver: 9, assigner: 9, progress: prog, score: null, assigned: d(-10), due: due, done: null, repeat: 'Không',
          waitFor: null, reviewNote: '', note: '', source: 'Giả lập'
        };
        Object.keys(extra || {}).forEach(function (k) { t[k] = extra[k]; });
        tasks.push(t); return t;
      }
      add('Rà soát bản vẽ móng lò điện hồ quang', 'doan', 'Inteco 13-466', 'Đang làm', 'Thực hiện', d(-6), 40, { priority: 'Cao', collab: [U.duong] });
      add('Phản hồi phương án hút khói EAF cho đối tác', 'duong', 'Inteco 13-466', 'Chưa làm', 'Chuẩn bị', d(-3), 0, { priority: 'Cao' });
      add('Kiểm tra danh mục vật tư điện cho hệ thống sấy', 'luong', 'Inteco 13-466', 'Đang chờ', 'Chờ đối tác', d(-9), 60);
      add('Dịch tài liệu kỹ thuật bộ khuôn 08', 'hieu', 'Khác', 'Chưa làm', 'Chuẩn bị', d(2), 0);
      add('Lập bảng so sánh thông số lò anode hóa', 'thang', 'PAT Z127', 'Đang làm', 'Thực hiện', d(4), 55, { priority: 'Cao' });
      add('Gửi thư nhắc đối tác về lịch giao hàng', 'dong', 'Gửi thư', 'Chưa làm', 'Chuẩn bị', d(-1), 0);
      add('Kiểm tra bản vẽ kết cấu thép tuần trước', 'doan', 'Inteco 13-466', 'Chờ nghiệm thu', 'Nghiệm thu', d(-2), 100);
      add('Chuẩn bị hồ sơ nghiệm thu chạy thử', 'luong', 'APEC G3080-5L', 'Đang làm', 'Thực hiện', d(7), 25);
      add('Cập nhật tiến độ lắp đặt tuần', 'duong', 'PKG', 'Hoàn thành', 'Nghiệm thu', d(-4), 100, { done: d(-5), score: 5 });
      add('Rà dữ liệu hút bụi lò và quạt', 'duong', 'Inteco 13-466', 'Đang làm', 'Thực hiện', d(10), 30);
      add('So sánh báo giá hai nhà cung cấp thiết bị đo', 'thang', 'VTX', 'Chưa làm', 'Chuẩn bị', d(-12), 0, { priority: 'Cao' });
      add('Xem xét bản vẽ phễu nạp liệu', 'thang', 'PAT Z127', 'Đang chờ', 'Chờ đối tác', d(1), 45);
      add('Soạn biên bản họp kỹ thuật', 'dung', 'GFM', 'Hoàn thành', 'Nghiệm thu', d(-8), 100, { done: d(-9), score: 4 });
      add('Hoàn thiện bảng kiểm tra an toàn điện', 'luong', 'PKG', 'Chưa làm', 'Chuẩn bị', d(14), 0);
      add('Phối hợp khảo sát hiện trường nhà xưởng', 'dong', 'Ooksan', 'Đang làm', 'Thực hiện', d(3), 70);
      add('Rà soát hợp đồng phụ lục thiết bị', 'thanh', 'Darting', 'Đang làm', 'Thực hiện', d(-2), 50);
      add('Chốt phương án cáp điều khiển', 'doan', 'APEC G3080-5L', 'Chưa làm', 'Chuẩn bị', d(-5), 0);
      add('Kiểm tra mô hình 3D giá đỡ', 'hieu', 'Khác', 'Đang làm', 'Thực hiện', d(6), 35);
      add('Tổng hợp câu hỏi gửi đối tác tuần này', 'dung', 'Inteco 13-466', 'Chưa làm', 'Chuẩn bị', d(0), 0, { priority: 'Cao' });
      add('Đề xuất đổi nhà cung cấp ống thép', 'dong', 'PKG', 'Chưa làm', 'Chuẩn bị', d(12), 0, { type: 'Đề xuất', approval: 'Chờ duyệt', assigner: 12, approver: 9 });
      add('Việc chưa giao người phụ trách', null, 'Khác', 'Chưa làm', 'Chuẩn bị', d(-4), 0);
      var checks = [], cid = 0;
      function ck(taskId, text, ok) { cid++; checks.push({ id: cid, taskId: taskId, text: text, ok: ok, note: '' }); }
      ck(1, 'Đối chiếu kích thước móng với bản vẽ rev mới', true); ck(1, 'Ghi chú điểm chưa khớp', false); ck(1, 'Gửi danh sách điểm lệch cho anh Thành', false);
      ck(7, 'Kiểm tra các mối nối chính', true); ck(7, 'Lập bảng phản hồi', true);
      ck(8, 'Biên bản chạy thử có chữ ký', false); ck(8, 'Ảnh hiện trường', true);
      return { tasks: tasks, checks: checks, nextTask: n + 1, nextCheck: cid + 1 };
    }
    function load() {
      try { var s = localStorage.getItem(KEY); if (s) { db = JSON.parse(s); return; } } catch (e) { /* bỏ qua */ }
      db = seed();
    }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* bỏ qua */ } }
    var copy = function (o) { return JSON.parse(JSON.stringify(o)); };
    return {
      mode: 'mock',
      async init() {
        load();
        return {
          users: C.users.map(function (u) { return { id: u.id, name: u.name, email: u.email.toLowerCase() }; }),
          choices: {}, hasChecklist: true
        };
      },
      async listTasks() { return copy(db.tasks); },
      async listChecks() { return copy(db.checks); },
      async createTask(t) { var x = copy(t); x.id = db.nextTask++; db.tasks.push(x); save(); return copy(x); },
      async updateTask(id, patch) {
        var t = db.tasks.filter(function (x) { return x.id === id; })[0];
        if (t) Object.keys(patch).forEach(function (k) { t[k] = patch[k]; });
        save();
      },
      async deleteTask(id) {
        db.tasks = db.tasks.filter(function (x) { return x.id !== id; });
        db.checks = db.checks.filter(function (x) { return x.taskId !== id; }); save();
      },
      async createCheck(taskId, text) { var c = { id: db.nextCheck++, taskId: taskId, text: text, ok: false, note: '' }; db.checks.push(c); save(); return copy(c); },
      async updateCheck(id, patch) {
        var c = db.checks.filter(function (x) { return x.id === id; })[0];
        if (c) Object.keys(patch).forEach(function (k) { c[k] = patch[k]; });
        save();
      },
      async deleteCheck(id) { db.checks = db.checks.filter(function (x) { return x.id !== id; }); save(); },
      reset: function () { try { localStorage.removeItem(KEY); } catch (e) { /* bỏ qua */ } load(); }
    };
  }

  S.GraphData = GraphData;
  S.MockData = MockData;
})(window.SGV);
