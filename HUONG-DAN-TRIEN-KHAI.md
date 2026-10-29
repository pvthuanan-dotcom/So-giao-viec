# Sổ giao việc CNH: hướng dẫn triển khai (cho quản trị viên)

Ứng dụng là một trang web tĩnh. Người dùng đăng nhập bằng tài khoản Microsoft 365 của công ty. Dữ liệu nằm trong hai danh sách SharePoint của site SERVICE: "Sổ giao việc" và "Tiêu chí việc". Ứng dụng không lưu dữ liệu ở đâu khác.

Tổng thời gian khoảng 30 phút. Làm theo thứ tự A, B, C, D.

## A. Đăng ký ứng dụng trong Microsoft Entra (làm một lần)

1. Mở https://entra.microsoft.com, đăng nhập bằng tài khoản quản trị.
2. Identity → Applications → App registrations → **New registration**.
3. Name: `Sổ giao việc CNH`. Supported account types: **Accounts in this organizational directory only (Single tenant)**. Chưa điền Redirect URI, bấm Register.
4. Ở trang vừa tạo, ghi lại hai giá trị: **Application (client) ID** và **Directory (tenant) ID**.
5. Authentication → Add a platform → **Single-page application**. Redirect URI sẽ điền ở bước C.
6. API permissions → Add a permission → Microsoft Graph → **Delegated permissions**, chọn: `User.Read`, `User.ReadBasic.All`, `Sites.ReadWrite.All`. Sau đó bấm **Grant admin consent for <tên công ty>**.

Lưu ý: `Sites.ReadWrite.All` kiểu Delegated chỉ cho ứng dụng làm những gì chính người đăng nhập được phép làm trên SharePoint. Ứng dụng chỉ đọc và ghi hai danh sách nói trên.

## B. Đặt ứng dụng lên GitHub Pages

1. Tạo kho mã (repository) mới trên GitHub, tên gợi ý `so-giao-viec`. Kho này chỉ chứa mã giao diện, không chứa dữ liệu công việc.
2. Giải nén gói `so-giao-viec-app.zip`, vào kho bấm **Add file → Upload files**, kéo cả thư mục `css`, `js`, `vendor` và file `index.html` vào, rồi Commit.
3. Settings → Pages → Source: **Deploy from a branch**, Branch: `main`, thư mục `/ (root)`, bấm Save.
4. Sau một đến hai phút, địa chỉ ứng dụng hiện ra, dạng `https://<tài khoản>.github.io/so-giao-viec/`.

## C. Khai báo địa chỉ ứng dụng trong Entra

Quay lại ứng dụng đã đăng ký → Authentication → Single-page application → Add URI. Thêm **cả hai** địa chỉ sau (có dấu `/` cuối):

- `https://<tài khoản>.github.io/so-giao-viec/`
- `https://<tài khoản>.github.io/so-giao-viec/index.html`

## D. Điền cấu hình

Mở file `js/config.js` trong kho (biểu tượng bút chì để sửa). Điền:

- `clientId`: Application (client) ID ở bước A4.
- `tenantId`: Directory (tenant) ID ở bước A4.
- `redirectUri`: địa chỉ ở bước B4 (có dấu `/` cuối).

Commit lại. Gửi cho anh Thành địa chỉ ứng dụng.

## E. Việc cần làm cùng lúc với người dùng

1. Mọi người dùng ứng dụng phải là **thành viên site SERVICE** với quyền Chỉnh sửa (nhóm Members). Nếu không, ứng dụng báo lỗi 403.
2. Hai kỹ sư Thắng và Dũng hiện dùng Gmail. Muốn đăng nhập được, cần cấp tài khoản công ty (@cnh.com.vn) hoặc mời làm khách (Guest) trong Entra. Sau đó cần ghép lại mã người dùng trong `js/config.js` (mục `users`) nếu email đổi.
3. Danh sách "Sổ giao việc" đã có sẵn các cột và 61 việc đã chuyển. Không sửa tên cột (ứng dụng tìm cột theo tên hiển thị).

## Kiểm tra nhanh sau khi triển khai

- Mở địa chỉ ứng dụng, đăng nhập, thấy trang Tổng quan với số việc đúng.
- Anh Thành bấm "Giao việc", tạo một việc thử, vào danh sách SharePoint thấy việc đó xuất hiện.
- Một kỹ sư đăng nhập, thấy "Việc của tôi", bấm "Bắt đầu" rồi "Gửi nghiệm thu".
- Anh Thành vào "Chờ duyệt", nghiệm thu việc đó.

## F. Báo cáo tuần trên web (mục mới)
1. Đăng nhập bằng tài khoản quản trị, mở mục **Báo cáo tuần**, bấm **Tạo danh sách Báo cáo tuần**. Ứng dụng tự tạo danh sách trong site SERVICE.
2. Nếu báo chưa tự tạo được, tạo tay trong site SERVICE một danh sách trống tên đúng **Báo cáo tuần** với các cột: Tuần (một dòng chữ), Người báo (người), Mã việc (một dòng chữ), Việc (ID) (số), Kết quả (nhiều dòng), Đánh giá (lựa chọn: Hoàn thành, Đang thực hiện, Chờ quyết định, Chưa hoàn thành), Giờ làm thêm (số), Tuần tới (nhiều dòng), Ý kiến (nhiều dòng), Loại (lựa chọn: Việc, Tổng kết), Ngày nộp (ngày).
3. Nhân viên là thành viên site SERVICE (quyền sửa) thì tự có quyền ghi vào danh sách này.
4. Tên miền: nếu dùng service-cnh.com.vn thì đó là một miền riêng cần có người đứng tên đăng ký. Các bước trỏ DNS và Entra giống phần C và D, chỉ đổi địa chỉ.
