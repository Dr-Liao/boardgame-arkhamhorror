// 验收单元 11-a-7：11-a 沉没之城分片 7（tdcc 战役卡 D）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 复验通过后以生成的逐卡账本记录结论；配置可脱离原报告独立复算。

// 范围锁定为审计时未验收的 43 条记录（tdcc）。
const codes = ["11619", "11620", "11621", "11622", "11622b", "11623", "11624", "11625", "11626", "11627", "11628", "11629", "11630", "11631", "11632", "11633", "11634", "11635", "11636", "11637", "11638", "11639", "11640", "11640b", "11641", "11642", "11643", "11644", "11645", "11646", "11647", "11648", "11649", "11650", "11651", "11652", "11653", "11654", "11655", "11656", "11657", "11658", "11659"]
const codeSet = new Set(codes)

export default {
  id: "11-a-7",
  acceptanceId: "tdc-campaign-d-2026-11",
  exportPrefix: "TDC_SHARD7",
  verifiedFn: "tdcShard7CardVerified",
  profile: {
    id: "tdc-campaign-d-2026-11",
    scope: "沉没之城 11 段 tdcc 战役卡（11619–11659）43 条目录记录。43 条全部通过五维验收。",
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
    "games/arkhamhorror/tests/acceptance-11-a-shard7.test.mjs",
    "games/arkhamhorror/tests/tdc-scenario-courtOfTheAncients.test.mjs",
    "games/arkhamhorror/tests/tdc-scenario-obsidianCanyons.test.mjs",
    "games/arkhamhorror/tests/tdc-p7-scenario-integrity.test.mjs",
    "games/arkhamhorror/tests/tdc-p7-scenario-lifecycle.test.mjs",
    "games/arkhamhorror/tests/tdc-p7-campaign-layer.test.mjs",
    "games/arkhamhorror/tests/tdc-rules.test.mjs",
    "games/arkhamhorror/tests/tdc-primitives.test.mjs",
    "games/arkhamhorror/tests/tdc-round2-primitives.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/11-a-7-acceptance.json",
    module: "src/cards/11-a-7-acceptance.js",
  },
}
