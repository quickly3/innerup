import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { parseGithubTarget } from './github-url.js';

describe('parseGithubTarget', () => {
  it('解析账号主页地址', () => {
    expect(parseGithubTarget('https://github.com/yourname')).toEqual({
      owner: 'yourname',
      repo: null,
      display: 'yourname',
    });
  });

  it.each([
    ['https://github.com/yourname/innerup', 'innerup'],
    ['https://github.com/yourname/innerup/', 'innerup'],
    ['https://github.com/yourname/innerup.git', 'innerup'],
    ['https://www.github.com/yourname/innerup', 'innerup'],
    ['github.com/yourname/innerup', 'innerup'],
    ['git@github.com:yourname/innerup.git', 'innerup'],
    ['yourname/innerup', 'innerup'],
    ['  @yourname/innerup  ', 'innerup'],
  ])('解析仓库地址 %s', (input, repo) => {
    expect(parseGithubTarget(input)).toEqual({
      owner: 'yourname',
      repo,
      display: `yourname/${repo}`,
    });
  });

  it('忽略查询串与多余路径', () => {
    expect(parseGithubTarget('https://github.com/yourname?tab=repositories').display).toBe(
      'yourname',
    );
  });

  it.each([
    ['', '空输入'],
    ['   ', '全空格'],
    ['https://gitlab.com/yourname', '非 github 域名'],
    ['https://github.com/', '没有用户名'],
    ['https://github.com/topics/typescript', '功能页路径'],
    ['yourname/innerup/extra', '裸写法路径过多'],
    ['not a valid name!', '不是合法用户名'],
  ])('拒绝 %s（%s）', (input) => {
    expect(() => parseGithubTarget(input)).toThrow(BadRequestException);
  });
});
