import { readFileSync } from 'node:fs'

const verdict = JSON.parse(readFileSync(new URL('../../docs/test/验收-70-a-独立支线.json', import.meta.url), 'utf8'))
const acceptanceId = 'side-stories-2026-11'

export default {
  id: '70-a',
  acceptanceId,
  exportPrefix: 'SIDE_STORIES',
  verifiedFn: 'sideStoryCardVerified',
  profile: {
    id: acceptanceId,
    scope: '70–89 段 12 个独立支线产品的 704 条目录记录。',
    basis: '按印刷文字检验本地引擎行为和相关界面。逐卡依据和待复测项见 70-a 报告。',
    houseRules: ['按实际印刷号区分单桌和跨桌变体。'],
    sources: ['src/cards/cards-data.js', 'content/registered.js', 'docs/test/验收-70-a-独立支线.json'],
  },
  select: card => /^[78][0-9]{4}[a-z]?$/.test(card.code),
  expectedCount: 704,
  exclude: [],
  failed: verdict.failedCodes.map(({ code, dimension, reason }) => ({ code, dimension, reason })),
  testFiles: ['games/arkhamhorror/tests/acceptance-70-a.test.mjs'],
  evidence: { forbidTitles: /条目存在|目录收录/ },
  outputs: { ledger: 'audit/70-a-acceptance.json', module: 'src/cards/70-a-acceptance.js' },
}
