/**
 * 由 Swagger/OpenAPI 生成 Postman Collection。
 *
 * 本项目接入前提（详见同目录 SKILL.md）：
 * - 依赖 `openapi-to-postmanv2` 与一个 TS 运行器（推荐 `tsx`），二者均未安装，
 *   使用前需先征得用户同意；
 * - 本文件需复制到 `be/script/sync-postman.ts`，并在 `be/` 目录下执行
 *   （输出路径按 cwd 解析）；
 * - 本项目是 ESM，且没有 `src/` 路径别名，故用带 `.js` 后缀的相对导入。
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import Converter from 'openapi-to-postmanv2';
import { AppModule } from '../src/app.module.js';

type HttpMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'patch'
  | 'delete'
  | 'options'
  | 'head';

type OpenApiOperation = {
  requestBody?: {
    content?: {
      'application/json'?: {
        example?: unknown;
        schema?: {
          example?: unknown;
        };
      };
    };
  };
};

type OpenApiDocument = {
  paths?: Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>;
};

type PostmanItem = {
  name?: string;
  item?: PostmanItem[];
  request?: {
    name?: string;
    method?: string;
    url?: {
      path?: string[];
    };
    body?: {
      mode?: string;
      raw?: string;
      options?: {
        raw?: {
          language?: string;
        };
      };
    };
  };
};

function getOperationKey(method: string, routePath: string): string {
  return `${method.toUpperCase()} ${routePath}`;
}

function extractJsonRequestBodyExamples(openApi: OpenApiDocument) {
  const exampleBodies = new Map<string, string>();

  for (const [routePath, pathItem] of Object.entries(openApi.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {}) as Array<
      [HttpMethod, OpenApiOperation]
    >) {
      const jsonContent = operation.requestBody?.content?.['application/json'];
      const example = jsonContent?.example ?? jsonContent?.schema?.example;

      if (example === undefined) {
        continue;
      }

      exampleBodies.set(
        getOperationKey(method, routePath.replace(/^\//, '')),
        JSON.stringify(example, null, 2),
      );
    }
  }

  return exampleBodies;
}

function getRoutePathFromItem(item: PostmanItem): string | null {
  const pathSegments = item.request?.url?.path;

  if (!Array.isArray(pathSegments) || pathSegments.length === 0) {
    return null;
  }

  return pathSegments.join('/');
}

function fillRequestBodiesFromExamples(
  items: PostmanItem[],
  exampleBodies: Map<string, string>,
) {
  for (const item of items) {
    if (Array.isArray(item.item) && item.item.length > 0) {
      fillRequestBodiesFromExamples(item.item, exampleBodies);
      continue;
    }

    const request = item.request;
    const routePath = getRoutePathFromItem(item);
    const method = request?.method;

    if (!request || !routePath || !method) {
      continue;
    }

    const exampleBody = exampleBodies.get(getOperationKey(method, routePath));
    if (!exampleBody) {
      continue;
    }

    request.body = {
      mode: 'raw',
      raw: exampleBody,
      options: {
        raw: {
          language: 'json',
        },
      },
    };
  }
}

function renameApiItemsByRoutePath(items: PostmanItem[]) {
  for (const item of items) {
    if (Array.isArray(item.item) && item.item.length > 0) {
      renameApiItemsByRoutePath(item.item);
      continue;
    }

    const routePath = getRoutePathFromItem(item);
    if (!routePath) {
      continue;
    }

    item.name = routePath;
    if (item.request) {
      item.request.name = routePath;
    }
  }
}

async function convertOpenApiToPostman(openApi: unknown) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    Converter.convert(
      {
        type: 'json',
        data: JSON.stringify(openApi),
      },
      {
        folderStrategy: 'Paths',
      },
      (error, result: any) => {
        if (error) {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          reject(error);
          return;
        }

        if (!result.result || !result.output?.[0]?.data) {
          reject(new Error('Failed to convert OpenAPI to Postman collection'));
          return;
        }

        resolve(result.output[0].data as Record<string, unknown>);
      },
    );
  });
}

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  // 与 main.ts 保持一致：全局前缀 /api，否则导出的路径会缺前缀
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('InnerUp API')
    .setDescription('以 AI 为教练的自我提升游戏化系统')
    .setVersion('1.0')
    .build();

  const openApiDocument = SwaggerModule.createDocument(app, swaggerConfig);
  const postmanCollection = await convertOpenApiToPostman(openApiDocument);
  const collectionItems = postmanCollection.item as PostmanItem[] | undefined;

  if (Array.isArray(collectionItems)) {
    fillRequestBodiesFromExamples(
      collectionItems,
      extractJsonRequestBodyExamples(openApiDocument as OpenApiDocument),
    );
    renameApiItemsByRoutePath(collectionItems);
  }

  const outputPath = path.resolve(
    process.cwd(),
    'output',
    'innerup.postman.collection.json',
  );
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    outputPath,
    JSON.stringify(postmanCollection, null, 2),
    'utf-8',
  );

  await app.close();
  console.log(`Postman collection updated: ${outputPath}`);
}

main().catch((error) => {
  console.error('Sync Postman collection failed:', error);
  process.exit(1);
});
