import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

export const OPENAPI_JSON_PATH = '/openapi.json';
export const API_DOCS_PATH = '/docs';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Task Management API')
    .setDescription(
      'REST API for users, projects, project members, labels, tasks, ' +
        'comments and attachments. List endpoints are paginated with ' +
        '`?page=&limit=` and return a `{ data, meta }` envelope.',
    )
    .setVersion(process.env.npm_package_version ?? '0.0.1')
    .addServer(`http://localhost:${process.env.PORT ?? 3000}`, 'Local')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    // `UsersController.findAll` -> `Users_findAll`
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
  return numbersToIntegers(document);
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
