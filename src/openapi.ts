import { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  getSchemaPath,
  OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { OPENAPI_PUBLIC_EXTENSION } from './auth/decorators/public.decorator';
import { ErrorResponseDto } from './task-management/common/dto/error-response.dto';
import { apiReference } from '@scalar/nestjs-api-reference';

export const OPENAPI_JSON_PATH = '/openapi.json';
export const API_DOCS_PATH = '/docs';

const API_DESCRIPTION = `
REST API quản lý công việc: người dùng, dự án, thành viên dự án, nhãn, task,
bình luận và tệp đính kèm.

## Quy ước chung

- **Phân trang:** các endpoint danh sách hỗ trợ \`?page=\` (mặc định 1) và
  \`?limit=\` (mặc định 20, tối đa 100), trả về \`{ data, meta }\` với
  \`meta = { page, limit, total, totalPages }\`.
- **Cập nhật một phần:** \`PATCH\` chỉ thay đổi các trường được gửi lên; với
  trường cho phép rỗng, gửi \`null\` để xoá giá trị.
- **Ngày tháng:** các trường ngày (\`startDate\`, \`endDate\`, \`dueDate\`…) có
  định dạng \`YYYY-MM-DD\`; các mốc thời gian (\`createdAt\`…) là ISO 8601.
- **Validate nghiêm ngặt:** trường không được khai báo trong body/query sẽ bị
  từ chối với lỗi \`400\`.
- **Định dạng lỗi:** \`{ statusCode, message, error }\`; với lỗi validate,
  \`message\` là mảng các thông điệp.
- **Xoá thành công** trả về \`204 No Content\`.
- **Xác thực:** JWT. Lấy token qua \`POST /auth/login\` hoặc
  \`POST /auth/register\`, gửi kèm header \`Authorization: Bearer <accessToken>\`
  với **mọi** endpoint, trừ \`register\`, \`login\`, \`refresh\`. Access token hết hạn sau 15 phút — dùng
  \`POST /auth/refresh\` để lấy token mới.
- **Phân quyền (RBAC):** mọi người dùng đã đăng nhập (\`Members\`) được **xem**;
  tạo mới (\`POST\`) cần \`Administrators\` hoặc \`Managers\`; cập nhật / xoá
  (\`PATCH\`, \`PUT\`, \`DELETE\`) chỉ dành cho \`Administrators\`. Thiếu quyền
  trả về \`403\`.
`.trim();

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Task Management API')
    .setDescription(API_DESCRIPTION)
    .setVersion(process.env.npm_package_version ?? '0.0.1')
    .addServer(`http://localhost:${process.env.PORT ?? 3000}`, 'Local')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Access token từ `POST /auth/login`.',
    })
    // Every operation requires a JWT unless marked @Public() (security: []).
    .addSecurityRequirements('bearer')
    .addTag(
      'Auth',
      'Đăng ký, đăng nhập, làm mới token và thông tin người dùng hiện tại.',
    )
    .addTag('Users', 'Quản lý tài khoản người dùng và vai trò của họ.')
    .addTag(
      'Roles',
      'Ba vai trò hệ thống cố định: `Administrators`, `Managers`, `Members`.',
    )
    .addTag('Projects', 'Quản lý dự án và chủ sở hữu dự án.')
    .addTag(
      'Project members',
      'Quản lý thành viên của dự án và vai trò (`owner`, `manager`, `member`, `viewer`).',
    )
    .addTag('Labels', 'Nhãn phân loại task, được quản lý riêng cho từng dự án.')
    .addTag(
      'Tasks',
      'Quản lý task, task con, việc gắn / gỡ nhãn cho task, tra cứu task sắp hết hạn của dự án và task của tôi trên mọi dự án.',
    )
    .addTag('Comments', 'Bình luận trên task.')
    .addTag(
      'Attachments',
      'Metadata của tệp đính kèm trên task (tệp được lưu ở dịch vụ bên ngoài).',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    // `UsersController.findAll` -> `Users_findAll`
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
  return applySecurity(numbersToIntegers(document));
}

/**
 * `@Public()` operations get `security: []` (swagger drops empty security
 * metadata, hence the extension marker); every other operation inherits the
 * global bearer requirement and gets a documented 401.
 */
function applySecurity(document: OpenAPIObject): OpenAPIObject {
  for (const pathItem of Object.values(document.paths)) {
    for (const method of ['get', 'put', 'post', 'delete', 'patch'] as const) {
      const operation = pathItem[method];
      if (!operation) continue;
      const extensions = operation as unknown as Record<string, unknown>;
      if (extensions[OPENAPI_PUBLIC_EXTENSION]) {
        delete extensions[OPENAPI_PUBLIC_EXTENSION];
        operation.security = [];
        continue;
      }
      if (operation.responses['401']) continue;
      operation.responses['401'] = {
        description:
          'Thiếu access token, token không hợp lệ/hết hạn, hoặc tài khoản đã bị khoá.',
        content: {
          'application/json': {
            schema: { $ref: getSchemaPath(ErrorResponseDto) },
          },
        },
      };
    }
  }
  return document;
}

/**
 * The swagger plugin emits `type: number` for every TS `number`, but every
 * numeric column in this schema is a PostgreSQL INTEGER (ids, position,
 * fileSize, pagination). If a decimal field is ever added, give it an explicit
 * `@ApiProperty({ type: 'number', format: 'double' })` and exclude it here.
 */
function numbersToIntegers<T>(node: T): T {
  if (Array.isArray(node)) {
    node.forEach(numbersToIntegers);
  } else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (obj.type === 'number' && obj.format === undefined) {
      obj.type = 'integer';
    }
    Object.values(obj).forEach(numbersToIntegers);
  }
  return node;
}

/** Serves the raw spec at /openapi.json and the Scalar UI at /docs. */
export function setupOpenApi(app: INestApplication): OpenAPIObject {
  const document = buildOpenApiDocument(app);
  const http = app.getHttpAdapter();

  http.get(OPENAPI_JSON_PATH, (_req, res) => {
    http.reply(res, document, 200);
  });
  app.use(
    API_DOCS_PATH,
    apiReference({ url: OPENAPI_JSON_PATH, theme: 'purple' }),
  );

  return document;
}
