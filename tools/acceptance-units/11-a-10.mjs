// 验收单元 11-a-10：11-a 沉没之城分片 10（tdcc 战役卡 G）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-11-a-沉没之城-分片-10.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-11-a-沉没之城-分片-10.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const entry of verdict.pendingCodes || []) { const code = typeof entry === 'string' ? entry : entry.code; if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: entry.dimension || 'pending', reason: entry.reason || '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' }) }
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 37 条记录（tdcc）。
const codes = ["11738", "11739", "11740", "11741", "11742", "11743", "11744", "11745", "11746", "11747", "11748", "11749", "11750", "11751", "11752", "11753a", "11753b", "11754a", "11754b", "11755a", "11755b", "11756a", "11756b", "11757a", "11757b", "11758a", "11758b", "11759a", "11759b", "11760a", "11760b", "11761", "11762", "11763", "11764", "11765", "11766"]
const codeSet = new Set(codes)

export default {
  id: "11-a-10",
  acceptanceId: "tdc-campaign-g-2026-11",
  exportPrefix: "TDC_SHARD10",
  verifiedFn: "tdcShard10CardVerified",
  profile: {
    id: "tdc-campaign-g-2026-11",
    scope: "沉没之城 11 段 tdcc 战役卡（11738–11766）37 条目录记录。36 条通过五维验收；11751 猎物规则无读点暂不切换。",
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
  expectedCount: 37,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-11-a-shard10.test.mjs",
    "games/arkhamhorror/tests/tdc-scenario-theDoomOfArkhamPartII.test.mjs",
    "games/arkhamhorror/tests/tdc-p7-shared-encounters.test.mjs",
    "games/arkhamhorror/tests/tdc-p7-shared-assets.test.mjs",
    "games/arkhamhorror/tests/tdc-p7-scenario-integrity.test.mjs",
    "games/arkhamhorror/tests/tdc-rules.test.mjs",
    "games/arkhamhorror/tests/tdc-primitives.test.mjs",
    "games/arkhamhorror/tests/tdc-round2-primitives.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/11-a-10-acceptance.json",
    module: "src/cards/11-a-10-acceptance.js",
  },
}
