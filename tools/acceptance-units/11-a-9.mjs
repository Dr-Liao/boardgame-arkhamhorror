// 验收单元 11-a-9：11-a 沉没之城分片 9（tdcc 战役卡 F）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 复验通过后以生成的逐卡账本记录结论；配置可脱离原报告独立复算。

// 范围锁定为审计时未验收的 43 条记录（tdcc）。
const codes = ["11697", "11698", "11699", "11700", "11701", "11702", "11702b", "11703", "11703b", "11704", "11704b", "11705", "11706", "11707", "11708", "11709", "11710", "11711", "11712", "11713", "11714", "11715", "11716", "11717", "11719", "11720", "11721", "11722", "11723", "11724", "11725", "11726", "11727", "11728", "11729", "11730", "11731", "11732", "11733", "11734", "11735", "11736", "11737"]
const codeSet = new Set(codes)

export default {
  id: "11-a-9",
  acceptanceId: "tdc-campaign-f-2026-11",
  exportPrefix: "TDC_SHARD9",
  verifiedFn: "tdcShard9CardVerified",
  profile: {
    id: "tdc-campaign-f-2026-11",
    scope: "沉没之城 11 段 tdcc 战役卡（11697–11737）43 条目录记录。43 条全部通过五维验收。",
    basis: '独立复核（不采信既有账本）：卡面 → 本地读点 → 原语 → 交互 → 真实执行测试逐卡核对；证据为验收测试与既有回归的真实用例标题。复验原报告未通过项并记录实际规则与状态变化。',
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
  failed: [],
  testFiles: [
    "games/arkhamhorror/tests/acceptance-11-a-shard9.test.mjs",
    "games/arkhamhorror/tests/tdc-scenario-theDoomOfArkhamPartI.test.mjs",
    "games/arkhamhorror/tests/tdc-scenario-theDoomOfArkhamPartII.test.mjs",
    "games/arkhamhorror/tests/tdc-scenario-sepulchreOfTheSleeper.test.mjs",
    "games/arkhamhorror/tests/tdc-p7-scenario-integrity.test.mjs",
    "games/arkhamhorror/tests/tdc-p7-scenario-lifecycle.test.mjs",
    "games/arkhamhorror/tests/tdc-p7-story.test.mjs",
    "games/arkhamhorror/tests/tdc-rules.test.mjs",
    "games/arkhamhorror/tests/tdc-primitives.test.mjs",
    "games/arkhamhorror/tests/tdc-round2-primitives.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/11-a-9-acceptance.json",
    module: "src/cards/11-a-9-acceptance.js",
  },
}
