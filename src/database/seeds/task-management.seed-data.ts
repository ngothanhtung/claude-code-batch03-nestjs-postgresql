import { MemberRole, ProjectStatus, TaskPriority } from '../enums';

/** Every seeded user has this e-mail domain; re-running the seed replaces them. */
export const SEED_EMAIL_DOMAIN = 'seed.taskflow.vn';
export const SEED_PASSWORD = 'Password123!';

export interface SeedUser {
  key: string;
  fullName: string;
  admin?: boolean;
  inactive?: boolean;
}

export const USERS: SeedUser[] = [
  { key: 'an', fullName: 'Nguyễn Văn An', admin: true },
  { key: 'binh', fullName: 'Trần Thị Bình' },
  { key: 'cuong', fullName: 'Lê Minh Cường' },
  { key: 'dung', fullName: 'Phạm Thu Dung' },
  { key: 'em', fullName: 'Hoàng Gia Em' },
  { key: 'giang', fullName: 'Vũ Hương Giang' },
  { key: 'hai', fullName: 'Đặng Quốc Hải' },
  { key: 'khanh', fullName: 'Bùi Ngọc Khánh' },
  { key: 'linh', fullName: 'Đỗ Mỹ Linh' },
  { key: 'minh', fullName: 'Ngô Đức Minh' },
  { key: 'nga', fullName: 'Dương Thanh Nga' },
  { key: 'phuc', fullName: 'Lý Hoàng Phúc', inactive: true },
];

export interface SeedTask {
  title: string;
  description?: string;
  priority: TaskPriority;
  subtasks?: string[];
  /** Label names (must exist in the project's `labels`). */
  labels?: string[];
}

export interface SeedProject {
  name: string;
  description: string;
  owner: string;
  status: ProjectStatus;
  /** Offsets in days from today. */
  startOffset: number;
  endOffset: number | null;
  members: [user: string, role: MemberRole][];
  labels: [name: string, color: string][];
  tasks: SeedTask[];
}

const { LOW, MEDIUM, HIGH, URGENT } = TaskPriority;
const { MANAGER, MEMBER, VIEWER } = MemberRole;

export const PROJECTS: SeedProject[] = [
  {
    name: 'Website thương mại điện tử TechMart',
    description:
      'Xây dựng lại website bán lẻ đồ công nghệ: catalog sản phẩm, giỏ hàng, thanh toán online và trang quản trị.',
    owner: 'an',
    status: ProjectStatus.ACTIVE,
    startOffset: -75,
    endOffset: 45,
    members: [
      ['binh', MANAGER],
      ['cuong', MEMBER],
      ['dung', MEMBER],
      ['em', MEMBER],
      ['khanh', VIEWER],
    ],
    labels: [
      ['Frontend', '#3B82F6'],
      ['Backend', '#10B981'],
      ['Bug', '#EF4444'],
      ['UI/UX', '#A855F7'],
      ['Thanh toán', '#F59E0B'],
      ['SEO', '#14B8A6'],
    ],
    tasks: [
      {
        title: 'Thiết kế trang chủ responsive',
        description:
          'Banner khuyến mãi, danh mục nổi bật, sản phẩm bán chạy. Hỗ trợ mobile/tablet/desktop.',
        priority: HIGH,
        labels: ['Frontend', 'UI/UX'],
        subtasks: [
          'Wireframe trang chủ trên Figma',
          'Cắt HTML/CSS khối banner',
          'Tối ưu ảnh banner (WebP, lazy-load)',
        ],
      },
      {
        title: 'API danh sách sản phẩm có phân trang & bộ lọc',
        description:
          'Lọc theo danh mục, khoảng giá, thương hiệu; sắp xếp theo giá / mới nhất / bán chạy.',
        priority: HIGH,
        labels: ['Backend'],
        subtasks: ['Thiết kế index cho bảng products', 'Viết e2e test bộ lọc'],
      },
      {
        title: 'Tích hợp cổng thanh toán VNPay',
        description:
          'Tạo URL thanh toán, xử lý IPN callback, đối soát giao dịch thất bại.',
        priority: URGENT,
        labels: ['Backend', 'Thanh toán'],
        subtasks: [
          'Đăng ký tài khoản sandbox VNPay',
          'Xử lý IPN và cập nhật trạng thái đơn',
          'Trang kết quả thanh toán',
        ],
      },
      {
        title: 'Tích hợp ví MoMo',
        priority: MEDIUM,
        labels: ['Backend', 'Thanh toán'],
      },
      {
        title: 'Giỏ hàng lưu theo phiên và tài khoản',
        description:
          'Khách vãng lai lưu localStorage; đăng nhập thì gộp vào giỏ hàng trên server.',
        priority: HIGH,
        labels: ['Frontend', 'Backend'],
      },
      {
        title: 'Lỗi: giá khuyến mãi không hiển thị trên Safari iOS',
        description:
          'Bước tái hiện: mở trang sản phẩm có flash sale trên iPhone 13, iOS 17. Giá gốc hiển thị thay vì giá giảm.',
        priority: URGENT,
        labels: ['Bug', 'Frontend'],
      },
      {
        title: 'Lỗi: tổng tiền sai khi áp nhiều mã giảm giá',
        priority: HIGH,
        labels: ['Bug', 'Backend'],
      },
      {
        title: 'Trang chi tiết sản phẩm',
        description:
          'Gallery ảnh, thông số kỹ thuật, đánh giá khách hàng, sản phẩm liên quan.',
        priority: MEDIUM,
        labels: ['Frontend', 'UI/UX'],
        subtasks: [
          'Component gallery ảnh có zoom',
          'Khối đánh giá & xếp hạng sao',
        ],
      },
      {
        title: 'Tối ưu SEO on-page',
        description:
          'Meta title/description động, sitemap.xml, structured data Product.',
        priority: MEDIUM,
        labels: ['SEO'],
      },
      {
        title: 'Trang quản trị đơn hàng',
        priority: MEDIUM,
        labels: ['Frontend', 'Backend'],
        subtasks: ['Bảng danh sách đơn có bộ lọc', 'Xuất đơn hàng ra Excel'],
      },
      {
        title: 'Gửi email xác nhận đơn hàng',
        priority: LOW,
        labels: ['Backend'],
      },
      {
        title: 'Đo Core Web Vitals và tối ưu LCP',
        priority: LOW,
        labels: ['Frontend', 'SEO'],
      },
    ],
  },
  {
    name: 'Ứng dụng di động SmartPay',
    description:
      'Ứng dụng ví điện tử cho iOS/Android: nạp tiền, chuyển khoản, thanh toán hoá đơn, QR code.',
    owner: 'binh',
    status: ProjectStatus.ACTIVE,
    startOffset: -40,
    endOffset: 120,
    members: [
      ['an', MANAGER],
      ['giang', MEMBER],
      ['hai', MEMBER],
      ['linh', MEMBER],
      ['phuc', MEMBER],
      ['nga', VIEWER],
    ],
    labels: [
      ['iOS', '#0EA5E9'],
      ['Android', '#22C55E'],
      ['Bảo mật', '#DC2626'],
      ['API', '#6366F1'],
      ['Bug', '#EF4444'],
      ['Thiết kế', '#EC4899'],
    ],
    tasks: [
      {
        title: 'Đăng nhập bằng sinh trắc học (Face ID / vân tay)',
        priority: HIGH,
        labels: ['iOS', 'Android', 'Bảo mật'],
        subtasks: [
          'Tích hợp LocalAuthentication (iOS)',
          'Tích hợp BiometricPrompt (Android)',
        ],
      },
      {
        title: 'Xác thực OTP khi chuyển khoản trên 10 triệu',
        description:
          'Gửi OTP qua SMS, hết hạn sau 2 phút, tối đa 3 lần nhập sai.',
        priority: URGENT,
        labels: ['Bảo mật', 'API'],
      },
      {
        title: 'Quét mã QR VietQR để thanh toán',
        priority: HIGH,
        labels: ['iOS', 'Android'],
        subtasks: ['Parse chuẩn EMVCo', 'Màn hình xác nhận thanh toán'],
      },
      {
        title: 'Thiết kế bộ icon và màn hình onboarding',
        priority: MEDIUM,
        labels: ['Thiết kế'],
      },
      {
        title: 'API lịch sử giao dịch',
        description:
          'Phân trang dạng cursor, lọc theo loại giao dịch và khoảng thời gian.',
        priority: MEDIUM,
        labels: ['API'],
      },
      {
        title: 'Lỗi: app crash khi xoay màn hình ở màn nạp tiền (Android 12)',
        priority: URGENT,
        labels: ['Bug', 'Android'],
      },
      {
        title: 'Lỗi: thông báo đẩy không hiển thị khi app ở background (iOS)',
        priority: HIGH,
        labels: ['Bug', 'iOS'],
      },
      {
        title: 'Thanh toán hoá đơn điện, nước, internet',
        priority: MEDIUM,
        labels: ['API', 'iOS', 'Android'],
        subtasks: [
          'Kết nối API nhà cung cấp EVN',
          'Lưu hoá đơn định kỳ',
          'Nhắc thanh toán trước hạn 3 ngày',
        ],
      },
      {
        title: 'Pentest trước khi phát hành',
        priority: HIGH,
        labels: ['Bảo mật'],
      },
      {
        title: 'Chế độ tối (dark mode)',
        priority: LOW,
        labels: ['Thiết kế', 'iOS', 'Android'],
      },
      {
        title: 'Chuẩn bị hồ sơ phát hành App Store / Google Play',
        priority: MEDIUM,
      },
    ],
  },
  {
    name: 'Hệ thống CRM nội bộ',
    description:
      'Quản lý khách hàng, cơ hội bán hàng, lịch hẹn và báo cáo doanh số cho đội kinh doanh.',
    owner: 'cuong',
    status: ProjectStatus.ACTIVE,
    startOffset: -20,
    endOffset: 90,
    members: [
      ['an', MEMBER],
      ['dung', MANAGER],
      ['hai', MEMBER],
      ['minh', MEMBER],
      ['nga', MEMBER],
    ],
    labels: [
      ['Tính năng', '#3B82F6'],
      ['Báo cáo', '#F97316'],
      ['Tích hợp', '#8B5CF6'],
      ['Bug', '#EF4444'],
      ['Tài liệu', '#64748B'],
    ],
    tasks: [
      {
        title: 'Quản lý danh bạ khách hàng',
        description:
          'CRUD khách hàng, gắn thẻ, lịch sử tương tác, import từ file CSV.',
        priority: HIGH,
        labels: ['Tính năng'],
        subtasks: [
          'Import CSV có kiểm tra trùng email',
          'Gộp hai hồ sơ khách hàng trùng',
        ],
      },
      {
        title: 'Pipeline cơ hội bán hàng dạng Kanban',
        priority: HIGH,
        labels: ['Tính năng'],
      },
      {
        title: 'Báo cáo doanh số theo nhân viên / tháng',
        priority: MEDIUM,
        labels: ['Báo cáo'],
        subtasks: ['Biểu đồ cột doanh số', 'Xuất báo cáo PDF'],
      },
      {
        title: 'Đồng bộ lịch hẹn với Google Calendar',
        priority: MEDIUM,
        labels: ['Tích hợp'],
      },
      {
        title: 'Gửi email hàng loạt qua SendGrid',
        priority: LOW,
        labels: ['Tích hợp'],
      },
      {
        title: 'Lỗi: tìm kiếm khách hàng không có dấu tiếng Việt',
        description:
          'Tìm "nguyen" không ra "Nguyễn". Cân nhắc unaccent + index trigram.',
        priority: HIGH,
        labels: ['Bug'],
      },
      {
        title: 'Phân quyền theo phòng ban',
        priority: URGENT,
        labels: ['Tính năng'],
      },
      {
        title: 'Viết tài liệu hướng dẫn sử dụng cho đội Sales',
        priority: LOW,
        labels: ['Tài liệu'],
      },
      {
        title: 'Dashboard KPI tuần',
        priority: MEDIUM,
        labels: ['Báo cáo'],
      },
    ],
  },
  {
    name: 'Chiến dịch Marketing Tết 2027',
    description:
      'Chuỗi hoạt động truyền thông dịp Tết Đinh Mùi: landing page, quảng cáo mạng xã hội, minigame lì xì.',
    owner: 'giang',
    status: ProjectStatus.ACTIVE,
    startOffset: -10,
    endOffset: 75,
    members: [
      ['an', MEMBER],
      ['khanh', MANAGER],
      ['linh', MEMBER],
      ['nga', MEMBER],
      ['binh', VIEWER],
    ],
    labels: [
      ['Nội dung', '#F43F5E'],
      ['Quảng cáo', '#F59E0B'],
      ['Thiết kế', '#EC4899'],
      ['Sự kiện', '#84CC16'],
    ],
    tasks: [
      {
        title: 'Lên kế hoạch tổng thể và ngân sách chiến dịch',
        priority: URGENT,
        subtasks: [
          'Phân bổ ngân sách theo kênh',
          'Duyệt kế hoạch với Ban giám đốc',
        ],
      },
      {
        title: 'Thiết kế key visual Tết',
        priority: HIGH,
        labels: ['Thiết kế'],
        subtasks: [
          '3 phương án concept',
          'Bộ banner cho Facebook / TikTok / Zalo',
        ],
      },
      {
        title: 'Landing page minigame "Hái lộc đầu xuân"',
        priority: HIGH,
        labels: ['Sự kiện', 'Thiết kế'],
      },
      {
        title: 'Viết 20 bài đăng fanpage tháng 12–1',
        priority: MEDIUM,
        labels: ['Nội dung'],
      },
      {
        title: 'Chạy quảng cáo Facebook Ads giai đoạn 1',
        priority: MEDIUM,
        labels: ['Quảng cáo'],
      },
      {
        title: 'Booking KOL / KOC review sản phẩm',
        priority: MEDIUM,
        labels: ['Quảng cáo', 'Nội dung'],
      },
      {
        title: 'Quay TVC 30 giây',
        priority: HIGH,
        labels: ['Nội dung'],
        subtasks: [
          'Duyệt kịch bản',
          'Chọn địa điểm quay',
          'Hậu kỳ & lồng tiếng',
        ],
      },
      {
        title: 'Báo cáo hiệu quả chiến dịch tuần đầu',
        priority: LOW,
      },
    ],
  },
  {
    name: 'Cổng thông tin nhân sự HRM v1',
    description:
      'Phiên bản đầu tiên của cổng nhân sự: chấm công, nghỉ phép, phiếu lương. Đã bàn giao.',
    owner: 'dung',
    status: ProjectStatus.ARCHIVED,
    startOffset: -240,
    endOffset: -60,
    members: [
      ['cuong', MANAGER],
      ['em', MEMBER],
      ['minh', MEMBER],
    ],
    labels: [
      ['Tính năng', '#3B82F6'],
      ['Bug', '#EF4444'],
      ['Triển khai', '#0D9488'],
    ],
    tasks: [
      {
        title: 'Module chấm công bằng QR',
        priority: HIGH,
        labels: ['Tính năng'],
      },
      {
        title: 'Quy trình xin nghỉ phép nhiều cấp duyệt',
        priority: HIGH,
        labels: ['Tính năng'],
      },
      { title: 'Phiếu lương điện tử', priority: MEDIUM, labels: ['Tính năng'] },
      {
        title: 'Lỗi: tính sai ngày phép tồn năm trước',
        priority: URGENT,
        labels: ['Bug'],
      },
      {
        title: 'Triển khai production và đào tạo người dùng',
        priority: MEDIUM,
        labels: ['Triển khai'],
      },
    ],
  },
];

export const COMMENTS: string[] = [
  'Mình đã nhận task này, dự kiến xong trong tuần.',
  'Đã push code lên nhánh feature, nhờ mọi người review giúp.',
  'Phần này còn vướng chỗ xử lý timeout, mình đang tìm hiểu thêm.',
  'Đã test trên môi trường staging, chạy ổn.',
  'Cần thêm thông tin từ phía khách hàng trước khi làm tiếp.',
  'Mình đề xuất tách task này làm hai phần cho dễ review.',
  'Đã fix theo góp ý, mọi người xem lại giúp mình nhé.',
  'Deadline này hơi gấp, có thể lùi thêm 2 ngày không?',
  'Đã cập nhật tài liệu liên quan trên Confluence.',
  'Lỗi tái hiện được trên máy mình, đang debug.',
  'Ok, approve! 👍',
  'Nhớ viết thêm test cho trường hợp dữ liệu rỗng nhé.',
  'Đã họp với team thiết kế, chốt phương án 2.',
  'Task này phụ thuộc vào API bên backend, chờ bên đó xong.',
  'Mình đã đính kèm ảnh chụp màn hình lỗi.',
];

export const ATTACHMENTS: [fileName: string, mimeType: string][] = [
  ['dac-ta-yeu-cau.pdf', 'application/pdf'],
  ['wireframe-v2.png', 'image/png'],
  ['anh-chup-loi.jpg', 'image/jpeg'],
  [
    'ke-hoach-chi-tiet.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  [
    'bien-ban-hop.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  ['log-server.txt', 'text/plain'],
  ['thiet-ke-final.fig', 'application/octet-stream'],
  ['demo-tinh-nang.mp4', 'video/mp4'],
];
