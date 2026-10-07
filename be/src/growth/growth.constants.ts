/** 成长地图的五个资源段（`/api/map/:kind/:id` 里的 `kind`）。 */
export enum MapKind {
  Focus = 'focus',
  Interest = 'interest',
  Input = 'input',
  Knowledge = 'knowledge',
  Skill = 'skill',
}

export const FOCUS_STATUSES = ['active', 'cooling', 'archived'] as const;
export const INTEREST_STATUSES = [
  'curious',
  'trying',
  'ongoing',
  'cool',
  'dropped',
] as const;
export const INPUT_KINDS = [
  'book',
  'course',
  'article',
  'podcast',
  'video',
] as const;
export const INPUT_STATUSES = [
  'queued',
  'consuming',
  'finished',
  'dropped',
] as const;

export const MAX_INGEST_CHARS = 20_000;
export const MIN_INGEST_CHARS = 15;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const PDF_MIME_TYPE = 'application/pdf';

/** 把名字归一化后用作「同批次内互相挂靠」的匹配键。 */
export function matchKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}
