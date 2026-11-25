// 验收单元 11-a-5：11-a 沉没之城分片 5（tdcc 战役卡 B）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-11-a-沉没之城-分片-5.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-11-a-沉没之城-分片-5.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const entry of verdict.pendingCodes || []) { const code = typeof entry === 'string' ? entry : entry.code; if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: entry.dimension || 'pending', reason: entry.reason || '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' }) }
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 43 条记录（tdcc）。
const codes = ["11539", "11540", "11540b", "11541", "11542", "11543", "11544", "11545", "11546", "11547", "11548", "11549", "11549b", "11550", "11550b", "11551", "11552", "11553", "11554", "11555", "11556", "11557", "11558", "11559", "11559b", "11560", "11561", "11562", "11563", "11564", "11565", "11566", "11567", "11568", "11569", "11570", "11571", "11572", "11573", "11574", "11575", "11576", "11577"]
const codeSet = new Set(codes)

export default {
  id: "11-a-5",
  acceptanceId: "tdc-campaign-b-2026-11",
  exportPrefix: "TDC_SHARD5",
  verifiedFn: "tdcShard5CardVerified",
  profile: {
    id: "tdc-campaign-b-2026-11",
    scope: "沉没之城 11 段 tdcc 战役卡（11539–11577）43 条目录记录。39 条通过五维验收；4 条声明未接线/翻面替代暂不切换。",
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
    "games/arkhamhorror/tests/acceptance-11-a-shard5.test.mjs",
    "games/arkhamhorror/tests/tdc-scenario-theApiary.test.mjs",
    "games/arkhamhorror/tests/tdc-scenario-theDrownedQuarter.test.mjs",
    "games/arkhamhorror/tests/tdc-scenario-oneLastJob.test.mjs",
    "games/arkhamhorror/tests/tdc-p7-scenario-integrity.test.mjs",
    "games/arkhamhorror/tests/tdc-p7-scenario-lifecycle.test.mjs",
    "games/arkhamhorror/tests/tdc-p7-shared-assets.test.mjs",
    "games/arkhamhorror/tests/tdc-p7-shared-encounters.test.mjs",
    "games/arkhamhorror/tests/tdc-rules.test.mjs",
    "games/arkhamhorror/tests/tdc-primitives.test.mjs",
    "games/arkhamhorror/tests/tdc-round2-primitives.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/11-a-5-acceptance.json",
    module: "src/cards/11-a-5-acceptance.js",
  },
}
