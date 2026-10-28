window.SGV = window.SGV || {};
(function (S) {
  'use strict';

  S.STAGES = ['Chuẩn bị', 'Thực hiện', 'Chờ đối tác', 'Nghiệm thu'];
  S.STATUSES = ['Chưa làm', 'Đang làm', 'Đang chờ', 'Chờ nghiệm thu', 'Hoàn thành'];
  S.PRIORITIES = ['Cao', 'Trung bình', 'Thấp'];
  S.APPROVALS = ['Chờ duyệt', 'Đã duyệt', 'Cần sửa', 'Từ chối'];
  S.TYPES = ['Giao việc', 'Đề xuất'];
  S.REPEATS = ['Không', 'Hằng tuần', 'Hằng tháng'];
  S.DEFAULT_PROJECTS = ['Inteco 13-466', 'PAT Z127', 'APEC G3080-5L', 'PKG', 'VTX', 'GFM', 'Ooksan', 'Darting', 'Gửi thư', 'Khác'];

  S.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var pad = function (n) { return String(n).padStart(2, '0'); };
  S.ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  S.today = function () { return S.fakeToday || S.ymd(new Date()); };
  S.parse = function (s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  S.addDays = function (s, n) { var d = S.parse(s); d.setDate(d.getDate() + n); return S.ymd(d); };
  S.addMonths = function (s, n) {
    var d = S.parse(s), day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return S.ymd(d);
  };
  S.diffDays = function (a, b) { return Math.round((S.parse(a) - S.parse(b)) / 864e5); };
  S.fmt = function (s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) : ''; };
  S.fmtFull = function (s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : ''; };
  S.isoWeek = function (s) {
    var d = S.parse(s || S.today());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    var w1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  };

  // Quy ước nghiệp vụ
  S.isDone = function (t) { return t.status === 'Hoàn thành'; };
  S.isLate = function (t) { return !!t.due && t.due < S.today() && !S.isDone(t); };
  S.lateDays = function (t) { return S.isLate(t) ? S.diffDays(S.today(), t.due) : 0; };
  // Việc đề xuất chưa được duyệt hoặc đã bị từ chối không tính vào số liệu tổng quan
  S.counted = function (t) { return t.approval !== 'Chờ duyệt' && t.approval !== 'Từ chối'; };
  S.stageOf = function (t) { return t.stage || 'Chuẩn bị'; };
  S.stageToStatus = function (stage, cur) {
    if (cur === 'Hoàn thành') return cur;
    return { 'Chuẩn bị': 'Chưa làm', 'Thực hiện': 'Đang làm', 'Chờ đối tác': 'Đang chờ', 'Nghiệm thu': 'Chờ nghiệm thu' }[stage] || cur;
  };
  S.statusToStage = function (status, cur) {
    return { 'Chưa làm': 'Chuẩn bị', 'Đang làm': 'Thực hiện', 'Đang chờ': 'Chờ đối tác', 'Chờ nghiệm thu': 'Nghiệm thu', 'Hoàn thành': 'Nghiệm thu' }[status] || cur;
  };

  S.initials = function (name) {
    if (!name) return '?';
    var p = name.trim().split(/\s+/);
    return p[p.length - 1].slice(0, 1).toUpperCase();
  };
  S.hue = function (key) {
    var h = 0, s = String(key);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  };

  S.toast = function (msg, kind) {
    var host = document.getElementById('toasts');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, kind === 'err' ? 6000 : 2800);
    setTimeout(function () { el.remove(); }, kind === 'err' ? 6500 : 3300);
  };

  S.csv = function (rows) {
    return '﻿' + rows.map(function (r) {
      return r.map(function (v) {
        v = v == null ? '' : String(v);
        return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\r\n');
  };
})(window.SGV);
