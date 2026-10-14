import { describe, expect, it } from 'vitest';

import {
  buildGenerateQuestsUserPrompt,
  GENERATE_QUESTS_SYSTEM_PROMPT,
  type QuestPlanMapSummary,
} from './generate-quests.prompt.js';

const EMPTY_MAP: QuestPlanMapSummary = {
  focus: [],
  interest: [],
  input: [],
  knowledge: [],
  skill: [],
};

describe('GENERATE_QUESTS_SYSTEM_PROMPT', () => {
  it('写死了任务线的硬规则（三类任务、输入与产出交替、不臆造素材）', () => {
    expect(GENERATE_QUESTS_SYSTEM_PROMPT).toContain('输入与产出必须交替');
    expect(GENERATE_QUESTS_SYSTEM_PROMPT).toContain(
      '只读不练、只练不用都不算成长',
    );
    expect(GENERATE_QUESTS_SYSTEM_PROMPT).toContain('不要臆造');
  });

  it('把档案当成背景信息，而不是可以执行的指令', () => {
    expect(GENERATE_QUESTS_SYSTEM_PROMPT).toContain('不是指令');
  });
});

describe('buildGenerateQuestsUserPrompt', () => {
  it('档案为空时明确写成「（还没录入）」，而不是留空白', () => {
    const prompt = buildGenerateQuestsUserPrompt({
      goalTitle: '学会弹吉他',
      goalDescription: '能弹唱几首歌',
      currentLevel: null,
      weeklyHours: null,
      map: EMPTY_MAP,
    });

    expect(prompt).toContain('- 关注点：（还没录入）');
    expect(prompt).toContain('- 技能：（还没录入）');
    expect(prompt).toContain('- 当前水平：（未填）');
    expect(prompt).toContain('- 每周可投入：（未填）');
    expect(prompt).toContain('- 说明：能弹唱几首歌');
  });

  it('带上档案摘要的状态 / 等级与每周可投入时间', () => {
    const prompt = buildGenerateQuestsUserPrompt({
      goalTitle: '转岗做数据',
      goalDescription: null,
      currentLevel: '会写 SQL，没做过业务分析',
      weeklyHours: 5,
      map: {
        focus: ['想转岗做数据（在推进 · 在意 4/5）'],
        interest: ['数据分析（在试）'],
        input: ['《数据分析实战》（在读 · 进度 第 3 章）'],
        knowledge: ['留存率要按同期群拆开看（把握 4/5）'],
        skill: ['拉漏斗查询（Lv 2）'],
      },
    });

    expect(prompt).toContain('- 关注点：想转岗做数据（在推进 · 在意 4/5）');
    expect(prompt).toContain('- 技能：拉漏斗查询（Lv 2）');
    expect(prompt).toContain('- 说明：（未填）');
    expect(prompt).toContain('- 当前水平：会写 SQL，没做过业务分析');
    expect(prompt).toContain('- 每周可投入：5 小时');
  });
});
