import { readFileSync } from 'node:fs'

const verdict = JSON.parse(readFileSync(new URL('../../docs/test/验收-90-a-调查员挑战.json', import.meta.url), 'utf8'))
const acceptanceId = 'investigator-challenges-2026-11'

export default {
  id: '90-a',
  acceptanceId,
  exportPrefix: 'INVESTIGATOR_CHALLENGES',
  verifiedFn: 'investigatorChallengeCardVerified',
  profile: {
    id: acceptanceId,
    scope: '103 个调查员挑战目录卡号，包含独立编号的关联面。',
    basis: '按实际印刷号复核卡文、引擎行为及交互。逐卡依据见验收报告。',
    sources: ['src/cards/cards-data.js', 'src/deck/alternate-investigator-build.js', 'docs/test/验收-90-a-调查员挑战.json'],
  },
  select: card => /^90\d{3}[a-z]?$/.test(card.code),
  expectedCount: 103,
  exclude: [],
  failed: verdict.failedCodes.map(({ code, dimension, reason }) => ({ code, dimension, reason })),
  testFiles: ['games/arkhamhorror/tests/acceptance-90-a.test.mjs'],
  evidence: { forbidTitles: /条目存在|目录收录/ },
  outputs: { ledger: 'audit/90-a-acceptance.json', module: 'src/cards/90-a-acceptance.js' },
}
