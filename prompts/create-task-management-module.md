/nestjs-best-practices Tạo cho tôi 1 module: task-management (dùng để xây dựng các api phục vụ phần mềm quản lý công việc)

+ Database: postgres cấu hình trong .env

+ Tôi dùng typeorm
Tạo cho tôi 1 bộ:
entity, service, controller

chỉ tạo trước 1 entity user:
có thiết kế như sau:
id: SERIAL PK
full_name string có 100 ký tự, bắt buộc nhập
email string 255 ký tự, bắt buộc nhập, ràng buộc không trùng
password_hash VARCHAR(255), NOT NULL
created_at TIMESTAMPTZ, DEFAULT NOW()
updated_at TIMESTAMPTZ, DEFAULT NOW()