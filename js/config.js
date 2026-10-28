/* Cấu hình ứng dụng Sổ giao việc CNH.
   Sau khi quản trị viên đăng ký ứng dụng trong Microsoft Entra, điền clientId và tenantId vào đây. */
window.APP_CONFIG = {
  orgName: 'CNH · Kỹ thuật',
  clientId: 'a5d300ca-66ed-4914-bdb1-f53dde904461',
  tenantId: '702a8705-6ea7-4d2c-9ec4-159c1853e8fe',
  // Đường dẫn ứng dụng sau khi đặt lên GitHub Pages, ví dụ 'https://tenban.github.io/so-giao-viec/'. Để trống thì tự lấy theo địa chỉ đang mở.
  redirectUri: 'https://github.com/pvthuanan-dotcom/So-giao-viec/',
  siteHost: 'ngohoangvn.sharepoint.com',
  sitePath: '/sites/SERVICE',
  listTasks: 'Sổ giao việc',
  listChecklist: 'Tiêu chí việc',
  // Người có quyền giao việc, duyệt và nghiệm thu (email đăng nhập, chữ thường)
  admins: ['trungthanh@cnh.com.vn'],
  // Bảng tra cứu người dùng của site SERVICE (id trong danh sách người dùng SharePoint).
  // Ứng dụng tự đọc thêm từ SharePoint; bảng này dùng để đặt tên ngắn gọn và làm dự phòng.
  users: [
    { id: 9,  name: 'Thành', email: 'trungthanh@cnh.com.vn' },
    { id: 12, name: 'Hiếu',  email: 'leehieu@cnh.com.vn' },
    { id: 13, name: 'Thắng', email: 'congtonthang2006@gmail.com' },
    { id: 14, name: 'Đồng',  email: 'phamdong@cnh.com.vn' },
    { id: 15, name: 'Đoàn',  email: 'congdoan@cnh.com.vn' },
    { id: 16, name: 'Lương', email: 'donaldhoang@cnh.com.vn' },
    { id: 17, name: 'Dương', email: 'patricknguyen@cnh.com.vn' },
    { id: 18, name: 'Dũng',  email: 'dung16062003@gmail.com' }
  ],
  refreshSeconds: 120
};
