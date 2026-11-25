// 验收单元 11-a-4：11-a 沉没之城分片 4（tdcc 战役卡 A）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-11-a-沉没之城-分片-4.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-11-a-沉没之城-分片-4.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const entry of verdict.pendingCodes || []) { const code = typeof entry === 'string' ? entry : entry.code; if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: entry.dimension || 'pending', reason: entry.reason || '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' }) }
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 43 条记录（tdcc）。
const codes = ["11501", "11502", "11503", "11504", "11504b", "11505", "11505b", "11506", "11507", "11508", "11509", "11510", "11511", "11512", "11513", "11514", "11515", "11516", "11517", "11518", "11519", "11520", "11521", "11522", "11523", "11524", "11525", "11526", "11527", "11528", "11529", "11530", "11531", "11531b", "11532", "11532b", "11533", "11534", "11535", "11536", "11537", "11537b", "11538"]
const codeSet = new Set(codes)

export default {
  id: "11-a-4",
  acceptanceId: "tdc-campaign-a-2026-11",
  exportPrefix: "TDC_SHARD4",
  verifiedFn: "tdcShard4CardVerified",
  profile: {
    id: "tdc-campaign-a-2026-11",
    scope: "沉没之城 11 段 tdcc 战役卡（11501–11538）43 条目录记录。36 条通过五维验收；7 条声明字段无读点（声明即接线债务）暂不切换。",
    basis: '独立复核（不采信既有账本）：卡面 → 本地读点 → 原语 → 交互 → 真实执行测试逐卡核对；证据为验收测试与既有回归的真实用例标题。近似与缺口逐条披露，未声称等价。',
    houseRules: [
      '保留项目既有的自动奖励反应与协作请求规则',
      '结构卡以印刷正反面、确定性布置、区域守恒及对应章节行为共同验收',
      '存档与重放沿用引擎统一事务模型',
    ],
    sources: [
      '参考资源/ArkhamHorror-main/frontend/public/cards_en.json',
      '参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham',
    ],
  },
  select: card => codeSet.has(card.code),
  exclude: [],
  expectedCount: 43,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-11-a-shard4.test.mjs",
    "games/arkhamhorror/tests/tdc-scenario-oneLastJob.test.mjs",
    "games/arkhamhorror/tests/tdc-scenario-theWesternWall.test.mjs",
    "games/arkhamhorror/tests/tdc-scenario-theDrownedQuarter.test.mjs",
    "games/arkhamhorror/tests/tdc-p7-scenario-integrity.test.mjs",
    "games/arkhamhorror/tests/tdc-p7-scenario-lifecycle.test.mjs",
    "games/arkhamhorror/tests/tdc-p7-campaign-registration.test.mjs",
    "games/arkhamhorror/tests/tdc-rules.test.mjs",
    "games/arkhamhorror/tests/tdc-primitives.test.mjs",
    "games/arkhamhorror/tests/tdc-round2-primitives.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/11-a-4-acceptance.json",
    module: "src/cards/11-a-4-acceptance.js",
  },
}
