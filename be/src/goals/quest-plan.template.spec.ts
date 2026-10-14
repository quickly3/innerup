import { describe, expect, it } from 'vitest';

import { MAX_PLANNED_QUESTS } from './goals.constants.js';
import { buildFallbackQuests } from './quest-plan.template.js';

describe('buildFallbackQuests', () => {
  const quests = buildFallbackQuests('学会弹吉他');

  it('条数在上限内，且目标是「一条能立刻开始的任务线」', () => {
    expect(quests.length).toBeGreaterThanOrEqual(3);
    expect(quests.length).toBeLessThanOrEqual(MAX_PLANNED_QUESTS);
  });

  it('输入与产出交替（第 13.1 节硬规则）', () => {
    const kinds = quests.map((quest) => quest.kind);

    for (let index = 1; index < kinds.length; index += 1) {
      expect(kinds[index]).not.toBe(kinds[index - 1]);
    }
    expect(new Set(kinds)).toEqual(new Set(['input', 'practice', 'output']));
  });

  it('难度与 XP 递增，时长在合理区间（与 AI 生成的任务字段口径一致）', () => {
    quests.forEach((quest, index) => {
      expect(quest.difficulty).toBeGreaterThanOrEqual(1);
      expect(quest.difficulty).toBeLessThanOrEqual(5);
      if (index > 0) {
        expect(quest.difficulty).toBeGreaterThanOrEqual(
          quests[index - 1].difficulty,
        );
        expect(quest.xpReward).toBeGreaterThan(quests[index - 1].xpReward);
      }
      expect(quest.estMinutes).toBeGreaterThanOrEqual(5);
      expect(quest.estMinutes).toBeLessThanOrEqual(600);
      expect(quest.acceptance).toBeTruthy();
    });
  });

  it('不臆造素材名，只把目标标题带进第一条（第 13.2 节）', () => {
    expect(quests[0].title).toContain('学会弹吉他');

    for (const quest of quests.slice(1)) {
      expect(quest.title).not.toContain('学会弹吉他');
    }
    // 兜底模板不能编造具体书名 / 课程名，只说「找一份入门素材」
    expect(quests.some((quest) => quest.title.includes('找一份入门素材'))).toBe(
      true,
    );
  });
});
