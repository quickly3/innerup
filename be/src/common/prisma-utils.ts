import { BadRequestException } from '@nestjs/common';

/**
 * Prisma 写入路径上反复用到的小工具。
 *
 * 注意：成长地图（`growth/growth.service.ts`）里有等价的私有实现，那是 M2.5 的历史代码，
 * 本次不动它；新模块统一用这里的一份，避免再复制。
 */

/** 去掉首尾空白；空串按「没填」处理（可空字段统一存 null）。 */
export function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

/** 解析 ISO 时间字符串；`null` 表示清空，非法值直接 400，不静默丢字段。 */
export function parseDateOrNull(
  value: string | null | undefined,
  field: string,
): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} 需要是合法的 ISO 时间字符串`);
  }

  return date;
}

/** 空 body 的 `PATCH` 是调用方写错了，明确报错而不是静默什么都不改。 */
export function assertNotEmpty<T extends object>(data: T): T {
  if (Object.keys(data).length === 0) {
    throw new BadRequestException('没有需要更新的字段');
  }

  return data;
}

/** Prisma 用 `P2025` 表示「要改的记录不存在」，这里翻译成 404。 */
export function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2025'
  );
}
