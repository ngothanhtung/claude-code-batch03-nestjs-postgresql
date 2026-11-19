/nestjs-best-practices  
Tôi tiếp tục triển khai RBAC:

- Database, tạo bảng roles (id, name), bảng user_roles để ghi nhận user có role nào?
  Trong hệ thống, tôi quy định 03 roles cố định như sau:

* Administrators
* Managers
* Members (JWT)

Hãy triển khai GUARD RBAC cho các controller có endpoint là
Create (Administrators, Managers) còn lại Update / Delete (Administrators)
