import { describe, expect, it } from 'vitest';

import { generateQuestsResultSchema } from './generate-quests.schema.js';

describe('generateQuestsResultSchema', () => {
  it('归一化枚举与数值：大小写、字符串数字都能收敛', () => {
    const result = generateQuestsResultSchema.parse({
      goalTitle: '能弹唱 3 首民谣',
      quests: [
        {
          title: '认识持琴姿势',
          description: '看一段入门视频',
          acceptance: '能摆出 C / G / Am 三个指型',
          kind: ' OUTPUT ',
          difficulty: '3',
          xpReward: '40',
          estMinutes: '45',
        },
      ],
    });

    expect(result.goalTitle).toBe('能弹唱 3 首民谣');
    expect(result.quests).toEqual([
      {
        title: '认识持琴姿势',
        description: '看一段入门视频',
        acceptance: '能摆出 C / G / Am 三个指型',
        kind: 'output',
        difficulty: 3,
        xpReward: 40,
        estMinutes: 45,
      },
    ]);
  });

  it('缺字段 / 数值越界时给安全默认值，不因一个字段写错整条失败', () => {
    const [quest] = generateQuestsResultSchema.parse({
      quests: [
        { title: '练熟 C / G / Am 的转换', difficulty: 9, estMinutes: 'abc' },
      ],
    }).quests;

    expect(quest).toEqual({
      title: '练熟 C / G / Am 的转换',
      description: null,
      acceptance: null,
      kind: 'practice',
      difficulty: 1,
      xpReward: 10,
      estMinutes: null,
    });
  });

  it('只丢掉写坏的那一条，不拖垮整批', () => {
    const result = generateQuestsResultSchema.parse({
      quests: [
        { title: '' },
        { title: '练熟 C / G / Am 的转换', kind: 'practice' },
        'not-an-object',
        { title: '录一段 30 秒弹唱', kind: 'output' },
      ],
    });

    expect(result.quests.map((quest) => quest.title)).toEqual([
      '练熟 C / G / Am 的转换',
      '录一段 30 秒弹唱',
    ]);
  });

  it('整批都不可用（或结构跑偏）时报错，交给上层重试 / 降级而不是落库空任务线', () => {
    expect(() =>
      generateQuestsResultSchema.parse({ quests: 'oops' }),
    ).toThrow();
    expect(() => generateQuestsResultSchema.parse({})).toThrow();
    expect(() =>
      generateQuestsResultSchema.parse({ quests: [{ title: '' }] }),
    ).toThrow();
  });
});
