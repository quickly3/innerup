import { PDFParse } from 'pdf-parse';

/**
 * PDF **文本层**抽取（《项目规划》第 8.2 / 13.9 节）。
 *
 * - 只在后端内存里解析，默认**不落原始文件**；
 * - 只承诺带文本层的 PDF；扫描件抽不出字，由调用方提示「请粘贴文字」（MVP 不做 OCR）。
 */

/** 只解析前 N 页：一份几十页的书稿对「讲清自己」没有边际价值，只会拖慢解析与推高成本。 */
const MAX_PAGES = 60;

export async function extractPdfText(data: Buffer): Promise<string> {
  const parser = new PDFParse({ data });

  try {
    const result = await parser.getText({ first: MAX_PAGES, pageJoiner: '\n' });
    return result.text ?? '';
  } finally {
    await parser.destroy();
  }
}
