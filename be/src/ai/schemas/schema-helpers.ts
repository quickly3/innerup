import { z } from 'zod';

/**
 * AI 结构化输出的**宽容解析**公共件（《项目规划》第 8.2 节）。
 *
 * 模型返回的 JSON 常常「大意对、细节歪」：枚举写成大写、数值写成字符串、可选字段给空串。
 * 整条链路（归类、生成任务线）不能因为一个字段写错就整体失败，所以统一在这里做归一化与兜底；
 * 真正的严格校验交给「落库前的 class-validator DTO」。
 */

/** 必填短文本：去掉首尾空白，空串 / 超长都算不合格（不合格的条目由调用方丢掉）。 */
export function requiredText(max: number) {
  return z.string().trim().min(1).max(max);
}

/** 可选短文本：`null` / 空串 / 超长一律收敛成 `null`，不报错。 */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null))
    .catch(null);
}

/** 整数：字符串数字也接受，超界或非数字落回默认值。 */
export function looseInt(min: number, max: number, fallback: number) {
  return z.coerce.number().int().min(min).max(max).catch(fallback);
}

/** 模型常把枚举写成大写或带空格；归一化后仍不认识就退回默认值。 */
export function looseEnum<const T extends readonly [string, ...string[]]>(
  values: T,
  fallback: T[number],
) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    z.enum(values).catch(fallback),
  );
}
