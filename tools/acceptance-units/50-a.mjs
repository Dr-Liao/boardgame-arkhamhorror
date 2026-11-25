import { readFileSync } from 'node:fs'

const report = JSON.parse(readFileSync(new URL('../../docs/test/验收-50-a-重返系列.json', import.meta.url), 'utf8'))
const acceptanceId = 'return-series-2026-11'

export default {
  id: '50-a',
  acceptanceId,
  exportPrefix: 'RETURN_SERIES',
  verifiedFn: 'returnSeriesCardVerified',
  profile: {
    id: acceptanceId,
    scope: '重返系列 50–54 段（rtnotz、rtdwl、rtptc、rttfa、rttcu）的 368 条目录记录，含独立关联面。',
    basis: '按印刷卡面核对本地引擎读点、原语、交互和可执行证据。未通过项保留未验收并记录在 50-a 报告。',
    houseRules: [
      '结构卡按真实开局、区域入场和运行时行为判定。',
      '关联面分别核对，复用同一实体行为。',
    ],
    sources: ['src/cards/cards-data.js', 'content/registered.js', 'docs/test/验收-50-a-重返系列.json'],
  },
  select: card => /^5[0-4][0-9]{3}[a-z]?$/.test(card.code),
  expectedCount: 368,
  exclude: [],
  failed: report.failedCodes.map(({ code, dimension, reason }) => ({ code, dimension, reason })),
  testFiles: ['games/arkhamhorror/tests/acceptance-50-a.test.mjs'],
  evidence: { forbidTitles: /条目存在|目录收录/ },
  outputs: { ledger: 'audit/50-a-acceptance.json', module: 'src/cards/50-a-acceptance.js' },
}
