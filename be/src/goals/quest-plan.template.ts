import { MAX_PLANNED_QUESTS } from './goals.constants.js';
import type { PlannedQuest } from '../ai/schemas/generate-quests.schema.js';

/**
 * AI 不可用时的**兜底任务模板**（《项目规划》第 8.2 节「结果缓存 / 降级」）。
 *
 * 目的不是「生成得好」，而是**不让核心闭环卡死**：没有 Key、上游抖动、输出跑偏时，
 * 仍然给出一条能立刻开始的任务线，用户可改可删，恢复后再重新生成。
 *
 * 三条刻意的取舍：
 * - **不臆造素材**（第 13.2 节）：只说「找一份入门素材」，不编书名 / 课程名；
 * - **输入与产出交替**（第 13.1 节硬规则）：`input → practice → output` 铺两轮；
 * - 难度 / XP / 时长按同一套递增，与 AI 生成的任务字段完全一致（前端无需区分处理）。
 */
export function buildFallbackQuests(goalTitle: string): PlannedQuest[] {
  const subject = goalTitle.trim();
  const steps: Array<
    Omit<PlannedQuest, 'difficulty' | 'xpReward' | 'estMinutes'>
  > = [
    {
      title: `围绕「${subject}」找一份入门素材，先看完前三章`,
      description:
        '挑一份最基础的教程（视频 / 书 / 网课都行），只看开头能上手的那部分，不追求看完。',
      acceptance: '能用自己的话说出这份素材主要在解决什么问题、下一步该练什么',
      kind: 'input',
    },
    {
      title: '照着素材做一次最小练习',
      description:
        '把刚看到的东西立刻做一遍，哪怕只做最小的那一步；卡住的地方记下来。',
      acceptance: '不看原文也能把核心步骤复述并做出一次',
      kind: 'practice',
    },
    {
      title: '做一个最小产出并留档',
      description:
        '用它解决一个自己的小问题，把结果留下来（文档 / 代码 / 录音 / 照片都行）。',
      acceptance: '产出一个能拿给别人看的结果，并能说清它解决了什么问题',
      kind: 'output',
    },
    {
      title: '针对卡住的点补一份素材',
      description: '只针对上次没搞懂的那一步找资料，不重新从头学。',
      acceptance: '能指出上次卡住的原因，并说出这次找到的答案',
      kind: 'input',
    },
    {
      title: '把最容易出错的那一步反复练',
      description: '集中练一个动作 / 一个环节，练到不用想就能做对。',
      acceptance: '连续 3 次都能一次做对，不用回头查资料',
      kind: 'practice',
    },
    {
      title: '做一个真实场景的产出',
      description: '找一个真实需求（自己的或别人的），完整做一遍，留下产出物。',
      acceptance: '产出物有真实用途，并留下了一句别人的反馈或自己的复盘',
      kind: 'output',
    },
    {
      title: '回头复述整条线的结论，并定下一个目标',
      description: '把这段时间学到的写成三句话，判断下一步该补输入还是补产出。',
      acceptance: '能用三句话讲清「我现在会什么、还缺什么、下一步做什么」',
      kind: 'practice',
    },
  ];

  return steps.slice(0, MAX_PLANNED_QUESTS).map((step, index) => ({
    ...step,
    difficulty: Math.min(1 + Math.floor(index / 2), 5),
    xpReward: 10 * (index + 1),
    estMinutes: index % 2 === 0 ? 45 : 60,
  }));
}
