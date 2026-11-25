import { readFileSync } from 'node:fs'

const verdict = JSON.parse(readFileSync(new URL('../../docs/test/验收-99-a-宣传卡.json', import.meta.url), 'utf8'))
const acceptanceId = 'promotional-cards-2026-11'

export default {
  id: '99-a',
  acceptanceId,
  exportPrefix: 'PROMOTIONAL_CARDS',
  verifiedFn: 'promotionalCardVerified',
  profile: {
    id: acceptanceId,
    scope: '3 个宣传卡目录卡号，包含独立编号的关联面。',
    basis: '按实际印刷号复核卡文、引擎行为及交互。逐卡依据见验收报告。',
    sources: ['src/cards/cards-data.js', 'src/deck/alternate-investigator-build.js', 'docs/test/验收-99-a-宣传卡.json'],
  },
  select: card => /^99\d{3}[a-z]?$/.test(card.code),
  expectedCount: 3,
  exclude: [],
  failed: verdict.failedCodes.map(({ code, dimension, reason }) => ({ code, dimension, reason })),
  testFiles: ['games/arkhamhorror/tests/acceptance-99-a.test.mjs'],
  evidence: { forbidTitles: /条目存在|目录收录/ },
  outputs: { ledger: 'audit/99-a-acceptance.json', module: 'src/cards/99-a-acceptance.js' },
}
