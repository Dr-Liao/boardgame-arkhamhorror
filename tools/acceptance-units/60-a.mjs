import { readFileSync } from 'node:fs'

const verdict = JSON.parse(readFileSync(new URL('../../docs/test/验收-60-a-调查员入门包.json', import.meta.url), 'utf8'))
const acceptanceId = 'starter-investigators-2026-11'

export default {
  id: '60-a',
  acceptanceId,
  exportPrefix: 'STARTER_INVESTIGATORS',
  verifiedFn: 'starterInvestigatorPackCardVerified',
  profile: {
    id: acceptanceId,
    scope: '60 段 10 个调查员入门包的 324 条目录记录。',
    basis: '按印刷文字检验本地引擎行为和相关界面。逐卡依据和待复测项见 60-a 报告。',
    houseRules: ['重印共用一份原版行为，按实际印刷号检验运行时入口。'],
    sources: ['src/cards/cards-data.js', 'src/deck/starter-packs.js', 'docs/test/验收-60-a-调查员入门包.json'],
  },
  select: card => /^60[1-5][0-9]{2}$/.test(card.code),
  expectedCount: 324,
  exclude: [],
  failed: verdict.failedCodes.map(({ code, dimension, reason }) => ({ code, dimension, reason })),
  testFiles: ['games/arkhamhorror/tests/acceptance-60-a.test.mjs'],
  evidence: { forbidTitles: /条目存在|目录收录/ },
  outputs: { ledger: 'audit/60-a-acceptance.json', module: 'src/cards/60-a-acceptance.js' },
}
