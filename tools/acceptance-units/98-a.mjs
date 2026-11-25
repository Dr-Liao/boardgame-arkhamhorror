import { readFileSync } from 'node:fs'

const verdict = JSON.parse(readFileSync(new URL('../../docs/test/验收-98-a-书籍替换签名.json', import.meta.url), 'utf8'))
const acceptanceId = 'book-signatures-2026-11'

export default {
  id: '98-a',
  acceptanceId,
  exportPrefix: 'BOOK_SIGNATURES',
  verifiedFn: 'bookSignatureCardVerified',
  profile: {
    id: acceptanceId,
    scope: '21 个书籍替换签名目录卡号，包含独立编号的关联面。',
    basis: '按实际印刷号复核卡文、引擎行为及交互。逐卡依据见验收报告。',
    sources: ['src/cards/cards-data.js', 'src/deck/alternate-investigator-build.js', 'docs/test/验收-98-a-书籍替换签名.json'],
  },
  select: card => /^98\d{3}[a-z]?$/.test(card.code),
  expectedCount: 21,
  exclude: [],
  failed: verdict.failedCodes.map(({ code, dimension, reason }) => ({ code, dimension, reason })),
  testFiles: ['games/arkhamhorror/tests/acceptance-98-a.test.mjs'],
  evidence: { forbidTitles: /条目存在|目录收录/ },
  outputs: { ledger: 'audit/98-a-acceptance.json', module: 'src/cards/98-a-acceptance.js' },
}
