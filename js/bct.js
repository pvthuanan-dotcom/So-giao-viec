/* Đọc file báo cáo tuần (BCT_Wxx-2026_Sx_*.xlsx) ngay trong trình duyệt và lập kế hoạch cập nhật Sổ giao việc.
   Không dùng thư viện ngoài: tự đọc gói .xlsx (zip) và bảng tblXuat trong sheet "Xuất". */
window.SGV = window.SGV || {};
(function (S) {
  'use strict';
  var nfc = function (s) { return String(s == null ? '' : s).normalize('NFC'); };
  var key = function (s) { return nfc(s).trim().toLowerCase(); };

  /* ---------- Đọc .xlsx ---------- */
  async function inflateRaw(u8) {
    var ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter();
    w.write(u8); w.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }
  async function unzip(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(buf), e = u8.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Không phải file Excel .xlsx');
    var n = dv.getUint16(e + 10, true), p = dv.getUint32(e + 16, true), files = {}, dec = new TextDecoder();
    for (var i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('File Excel bị lỗi cấu trúc');
      var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      var nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      files[dec.decode(u8.subarray(p + 46, p + 46 + nl))] = { method: method, csize: csize, lho: lho };
      p += 46 + nl + el + cl;
    }
    return {
      has: function (name) { return !!files[name]; },
      async text(name) {
        var f = files[name]; if (!f) return null;
        var lnl = dv.getUint16(f.lho + 26, true), lel = dv.getUint16(f.lho + 28, true), st = f.lho + 30 + lnl + lel;
        var data = u8.subarray(st, st + f.csize);
        return dec.decode(f.method === 0 ? data : await inflateRaw(data));
      }
    };
  }
  var xml = function (s) { return new DOMParser().parseFromString(s, 'application/xml'); };
  var colIdx = function (ref) { var m = /^([A-Z]+)/.exec(ref), n = 0; for (var i = 0; i < m[1].length; i++) n = n * 26 + m[1].charCodeAt(i) - 64; return n - 1; };
  var textOf = function (el) { var t = el.getElementsByTagName('t'), s = ''; for (var i = 0; i < t.length; i++) s += t[i].textContent; return s; };

  async function readRows(buf, which, noFallback) {
    which = which || ['xuất', 'xuat'];
    var z = await unzip(buf);
    var wb = xml(await z.text('xl/workbook.xml')), rels = xml(await z.text('xl/_rels/workbook.xml.rels'));
    var relMap = {}, rl = rels.getElementsByTagName('Relationship');
    for (var i = 0; i < rl.length; i++) relMap[rl[i].getAttribute('Id')] = rl[i].getAttribute('Target');
    var shared = [];
    if (z.has('xl/sharedStrings.xml')) {
      var ss = xml(await z.text('xl/sharedStrings.xml')).getElementsByTagName('si');
      for (var k = 0; k < ss.length; k++) shared.push(textOf(ss[k]));
    }
    var sheets = wb.getElementsByTagName('sheet'), found = null;
    var load = async function (sh) {
      var rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      var target = relMap[rid]; if (!target) return null;
      target = target.replace(/^\//, ''); if (target.indexOf('xl/') !== 0) target = 'xl/' + target;
      var doc = xml(await z.text(target)), rows = [], rs = doc.getElementsByTagName('row');
      for (var r = 0; r < rs.length; r++) {
        var cs = rs[r].getElementsByTagName('c'), arr = [];
        for (var c = 0; c < cs.length; c++) {
          var cell = cs[c], t = cell.getAttribute('t'), v = cell.getElementsByTagName('v')[0], val = '';
          if (t === 'inlineStr') val = textOf(cell);
          else if (v) val = t === 's' ? (shared[+v.textContent] || '') : t === 'b' ? (v.textContent === '1') : t === 'str' || t === 'e' ? v.textContent : (v.textContent === '' ? '' : +v.textContent);
          arr[colIdx(cell.getAttribute('r'))] = val;
        }
        arr.rn = +rs[r].getAttribute('r') || (r + 1); rows.push(arr);
      }
      return rows;
    };
    for (var s = 0; s < sheets.length && !found; s++) {
      var name = key(sheets[s].getAttribute('name'));
      if (which.indexOf(name) >= 0) found = await load(sheets[s]);
    }
    if (!found && noFallback) throw new Error('Không thấy sheet "' + which[0] + '" trong file này.');
    if (!found) {
      for (var s2 = 0; s2 < sheets.length && !found; s2++) {
        var rows = await load(sheets[s2]);
        if (rows && rows[0] && rows[0].some(function (h) { return key(h) === 'mã việc'; }) && rows[0].some(function (h) { return key(h) === 'mã nv'; })) found = rows;
      }
    }
    if (!found) throw new Error('Không thấy sheet "Xuất" (bảng tblXuat). Đây có đúng file báo cáo tuần mẫu không?');
    return found;
  }

  var serialToYmd = function (n) { return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 864e5).toISOString().slice(0, 10); };
  var asDate = function (v) {
    if (typeof v === 'number') return serialToYmd(v);
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? m[0] : '';
  };
  var clean = function (v) { return nfc(v).replace(/\s+/g, ' ').trim(); };

  var excelDate = function (v) {
    if (typeof v === 'number' && v > 20000) return serialToYmd(v);
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v || '').trim());
    if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    return asDate(v);
  };

  S.Bct = {
    /* ---------- Giao việc từ sheet "Mã Việc" của QUANLY_Bao_cao_tuan_KT.xlsm ---------- */
    async readAssign(file) {
      var rows = await readRows(await file.arrayBuffer(), ['mã việc', 'ma viec'], true), hr = -1;
      for (var i = 0; i < Math.min(rows.length, 12); i++) if (rows[i] && key(rows[i][0]).indexOf('mã công việc') === 0) { hr = i; break; }
      if (hr < 0) throw new Error('Sheet "Mã Việc" không đúng mẫu (không thấy cột "Mã công việc").');
      var hdr = rows[hr].map(function (h) { return key(h); }), at = function (pre) { for (var j = 0; j < hdr.length; j++) if (hdr[j].indexOf(pre) === 0) return j; return -1; };
      var ix = { code: at('mã công việc'), proj: at('khách hàng'), title: at('việc cần làm'), owner: at('giao cho'), pm1: at('phối hợp 1'), pm2: at('phối hợp 2'),
        week: at('tuần giao'), due: at('hạn áp dụng'), due0: at('hạn ('), check: at('kiểm tra') };
      ['code', 'title', 'owner', 'week'].forEach(function (k) { if (ix[k] < 0) throw new Error('Sheet "Mã Việc" thiếu cột cho ' + k + '.'); });
      var out = { file: file.name, rows: [] }, g = function (r, k) { return ix[k] >= 0 ? r[ix[k]] : ''; };
      for (var r = hr + 1; r < rows.length; r++) {
        var x = rows[r] || [], code = clean(g(x, 'code')), title = clean(g(x, 'title'));
        if (!code && !title) continue;
        out.rows.push({ row: x.rn || r + 1, code: code, project: clean(g(x, 'proj')), title: title, owner: clean(g(x, 'owner')), pm1: clean(g(x, 'pm1')), pm2: clean(g(x, 'pm2')),
          week: clean(g(x, 'week')), due: excelDate(g(x, 'due')) || excelDate(g(x, 'due0')), check: clean(g(x, 'check')) });
      }
      return out;
    },
    userByName: function (name, users) {
      var n = key(name); if (!n || n === 'cả nhóm') return null;
      var last = n.split(/\s+/).pop();
      return users.filter(function (u) { return key(u.name) === n; })[0] || users.filter(function (u) { return key(u.name) === last; })[0] || null;
    },
    planAssign: function (parsed, tasks, users, projChoices) {
      var byCode = {}, seen = {}, pl = { creates: [], updates: [], same: 0, props: 0, warns: [], orphans: [] };
      tasks.forEach(function (t) { if (t.code) byCode[key(t.code)] = t; });
      var proj = function (b) {
        if (!projChoices) return b || '';
        var hit = projChoices.filter(function (c) { return key(c) === key(b); })[0];
        return hit || (projChoices.indexOf('Khác') >= 0 ? 'Khác' : '');
      };
      parsed.rows.forEach(function (r) {
        if (!r.code || !r.title) { pl.warns.push('Dòng ' + r.row + ': thiếu mã hoặc nội dung, bỏ qua.'); return; }
        if (/chờ gán mã/i.test(r.check)) { pl.props++; seen[key(r.code)] = 1; return; }
        if (r.check && !/^ok$/i.test(r.check)) { pl.warns.push('Dòng ' + r.row + ' (' + r.code + '): cột Kiểm tra báo "' + r.check + '", bỏ qua.'); return; }
        var k = key(r.code); if (seen[k]) { pl.warns.push('Dòng ' + r.row + ': mã ' + r.code + ' trùng, bỏ qua.'); return; } seen[k] = 1;
        var ow = S.Bct.userByName(r.owner, users);
        if (r.owner && !ow) pl.warns.push(r.code + ': "' + r.owner + '" chưa có trong danh sách người dùng của site, để trống người phụ trách.');
        var col = [];
        [r.pm1, r.pm2].forEach(function (n) { var u = S.Bct.userByName(n, users); if (u && col.indexOf(u.id) < 0 && (!ow || u.id !== ow.id)) col.push(u.id); else if (n && key(n) !== 'cả nhóm' && !u) pl.warns.push(r.code + ': người phối hợp "' + n + '" chưa có trong danh sách, bỏ qua.'); });
        var want = { title: r.title, owner: ow ? ow.id : null, collab: col, week: r.week || '', due: r.due || null };
        var t = byCode[k];
        if (!t) { pl.creates.push({ code: r.code, project: proj(r.project), want: want, ownerName: ow ? ow.name : r.owner, include: true }); return; }
        var patch = {}, diff = [];
        if (key(t.title) !== key(want.title)) { patch.title = want.title; diff.push('nội dung'); }
        if ((t.owner || null) !== want.owner && (want.owner || r.owner === '')) { patch.owner = want.owner; diff.push('người phụ trách'); }
        if (JSON.stringify((t.collab || []).slice().sort()) !== JSON.stringify(col.slice().sort())) { patch.collab = col; diff.push('phối hợp'); }
        if ((t.week || '') !== want.week && want.week) { patch.week = want.week; diff.push('tuần giao'); }
        if ((t.due || null) !== want.due && want.due) { patch.due = want.due; diff.push('hạn'); }
        if (!diff.length) { pl.same++; return; }
        pl.updates.push({ id: t.id, code: t.code, title: t.title, patch: patch, diff: diff, done: S.isDone(t), before: { owner: t.owner, due: t.due, week: t.week }, include: !S.isDone(t) });
      });
      tasks.forEach(function (t) { if (t.code && !seen[key(t.code)] && t.type !== 'Đề xuất' && !S.isDone(t)) pl.orphans.push(t); });
      return pl;
    },

    async readFile(file) {
      var rows = await readRows(await file.arrayBuffer());
      var hdr = (rows[0] || []).map(function (h) { return key(h); });
      var col = function (name) { return hdr.indexOf(key(name)); };
      var ix = { nv: col('Mã NV'), name: col('Họ tên'), week: col('Tuần'), date: col('Ngày'), code: col('Mã việc'), did: col('Việc đã làm'),
        res: col('Mô tả kết quả'), rate: col('Đánh giá'), next: col('Công việc tuần tới'), opin: col('Ý kiến đề xuất'),
        tmp: col('Mã tạm'), prop: col('Việc đề xuất') };
      if (ix.code < 0 || ix.nv < 0) throw new Error('Bảng báo cáo thiếu cột Mã NV hoặc Mã việc.');
      var g = function (r, k) { return ix[k] >= 0 ? r[ix[k]] : ''; };
      var out = { file: file.name, modified: file.lastModified || 0, nv: '', name: '', week: '', entries: [], proposals: [], opinions: [] };
      for (var i = 1; i < rows.length; i++) {
        var r = rows[i] || [];
        if (!out.nv && clean(g(r, 'nv'))) { out.nv = clean(g(r, 'nv')); out.name = clean(g(r, 'name')); out.week = clean(g(r, 'week')); }
        var code = clean(g(r, 'code'));
        if (code) out.entries.push({ row: i + 1, date: asDate(g(r, 'date')), code: code, did: clean(g(r, 'did')), result: clean(g(r, 'res')), rating: clean(g(r, 'rate')) });
        var tmp = clean(g(r, 'tmp')), prop = clean(g(r, 'prop'));
        if (tmp && prop && !/^(không có|khong co)$/i.test(prop)) out.proposals.push({ code: tmp, text: prop });
        var op = clean(g(r, 'opin')); if (op && !/^(không có|khong co)$/i.test(op)) out.opinions.push(op);
      }
      if (!out.nv) throw new Error('Không đọc được mã nhân viên trong file.');
      return out;
    },

    // Quy đổi "Đánh giá" của nhân viên thành trạng thái trong Sổ giao việc
    ratingToState: function (rating) {
      switch (key(rating)) {
        case 'hoàn thành': return { status: 'Chờ nghiệm thu', stage: 'Nghiệm thu', progress: 100, label: 'Hoàn thành' };
        case 'chờ quyết định': return { status: 'Đang chờ', stage: 'Chờ đối tác', label: 'Chờ quyết định' };
        case 'chưa hoàn thành': return { status: 'Đang làm', stage: 'Thực hiện', label: 'Chưa hoàn thành' };
        case 'đang thực hiện': return { status: 'Đang làm', stage: 'Thực hiện', label: 'Đang thực hiện' };
        default: return null;
      }
    },

    personOf: function (parsed, users) {
      var last = key(parsed.name).split(/\s+/).pop();
      var hit = users.filter(function (u) { return key(u.name) === last; })[0];
      return hit || null;
    },

    /* parsedFiles: kết quả readFile (hoặc {file, error}); tasks: danh sách việc hiện có */
    weekRank: function (w) {
      var m = /(\d+)(?:\D+(\d{4}))?/.exec(String(w || '')); if (!m) return 0;
      return (m[2] ? +m[2] : 0) * 100 + +m[1];
    },
    plan: function (allFiles, tasks, users) {
      // Cùng một người, cùng một tuần mà có nhiều file (gửi lại, sửa lại): chỉ lấy file sửa sau cùng
      var best = {}, dropped = [];
      allFiles.forEach(function (p) {
        if (p.error) return;
        var k = p.nv + '|' + p.week;
        if (!best[k] || (p.modified || 0) > (best[k].modified || 0)) { if (best[k]) dropped.push(best[k]); best[k] = p; } else dropped.push(p);
      });
      var parsedFiles = allFiles.filter(function (p) { return p.error || best[p.nv + '|' + p.week] === p; });
      var byCode = {}; tasks.forEach(function (t) { if (t.code) byCode[key(t.code)] = t; });
      var plan = { files: [], updates: [], unmatched: [], proposals: [], opinions: [], weeks: {}, ignored: dropped.map(function (p) { return p.file; }) };
      var seen = {};
      parsedFiles.forEach(function (p) {
        if (p.error) { plan.files.push({ name: p.file, error: p.error }); return; }
        var person = S.Bct.personOf(p, users);
        plan.files.push({ name: p.file, nv: p.nv, who: p.name, week: p.week, person: person, entries: p.entries.length, proposals: p.proposals.length, matchedUser: !!person });
        plan.weeks[p.week] = 1;
        var tag = '[BCT ' + p.week + ' ' + p.nv + ']';
        // gộp theo mã việc: dòng mới nhất quyết định trạng thái, mọi dòng đều vào ghi chú
        var groups = {}, order = [];
        p.entries.forEach(function (e) { var k = key(e.code); if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(e); });
        order.forEach(function (k) {
          var es = groups[k].slice().sort(function (a, b) { return (a.date || '').localeCompare(b.date || '') || a.row - b.row; });
          var last = es[es.length - 1], t = byCode[k];
          if (!t) { plan.unmatched.push({ code: es[0].code, who: p.name, did: es[0].did || es[0].result }); return; }
          var lines = es.map(function (e) {
            var d = e.date ? e.date.slice(8, 10) + '/' + e.date.slice(5, 7) : '';
            var txt = (e.result || e.did || '').slice(0, 280);
            return d + (e.rating ? ' ' + e.rating : '') + (txt ? ': ' + txt : '');
          });
          var noteAdd = tag + '\n' + lines.join('\n');
          var drives = !!(person && t.owner === person.id);
          var st = drives ? S.Bct.ratingToState(last.rating) : null;
          var already = (t.note || '').indexOf(tag) >= 0;
          var patch = {};
          if (st && S.isDone(t)) st = null;                      // đã nghiệm thu thì không đổi lại
          // báo cáo của tuần cũ hơn tuần đã nhập gần nhất cho việc này thì chỉ ghi chú, không đổi trạng thái
          var rank = S.Bct.weekRank(p.week), lastRank = 0, mt, re = /\[BCT (\S+) [^\]\s]+\]/g;
          while ((mt = re.exec(t.note || ''))) lastRank = Math.max(lastRank, S.Bct.weekRank(mt[1]));
          var stale = rank < lastRank;
          if (st && stale) st = null;
          if (st) {
            if (t.status !== st.status) patch.status = st.status;
            if (t.stage !== st.stage) patch.stage = st.stage;
            if (st.progress != null && t.progress !== st.progress) patch.progress = st.progress;
          }
          patch.note = (t.note ? t.note + '\n' : '') + noteAdd;
          var uk = key(t.code) + '|' + p.nv;
          if (seen[uk]) return; seen[uk] = 1;
          plan.updates.push({
            id: t.id, code: t.code, title: t.title, who: p.name, nv: p.nv, driver: drives, role: drives ? 'phụ trách' : (person && (t.collab || []).indexOf(person.id) >= 0 ? 'phối hợp' : 'khác'),
            rank: rank, last: last.date || '', stale: stale, from: { status: t.status, stage: t.stage }, to: st, rating: last.rating, lines: lines, noteAdd: noteAdd, patch: patch, already: already, include: !already
          });
        });
        p.proposals.forEach(function (pr) {
          var dup = !!byCode[key(pr.code)] || !!seen['P|' + key(pr.code)];
          seen['P|' + key(pr.code)] = 1;
          plan.proposals.push({ code: pr.code, text: pr.text, who: p.name, owner: person ? person.id : null, dup: dup, include: !dup && !!person });
        });
        p.opinions.forEach(function (o) { plan.opinions.push({ who: p.name, text: o }); });
      });
      // Một việc có báo cáo ở nhiều tuần trong cùng đợt đồng bộ: chỉ tuần mới nhất được đổi trạng thái
      var top = {};
      plan.updates.forEach(function (u) {
        var c = top[u.id]; if (!c || u.rank > c.rank || (u.rank === c.rank && u.last > c.last)) top[u.id] = u;
      });
      plan.updates.forEach(function (u) {
        if (top[u.id] !== u && u.to) { u.to = null; u.superseded = true; u.patch = { note: u.patch.note }; }
      });
      return plan;
    }
  };
})(window.SGV);
