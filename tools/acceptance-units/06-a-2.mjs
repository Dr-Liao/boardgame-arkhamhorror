// 验收单元 06-a-2：06-a 食梦者分片 2（tde 豪华包后半）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 2026-11-26 复验通过，逐卡证据保存在生成的验收账本。

// 范围锁定为审计时未验收的 55 条记录（tde）。
const codes = ["06057", "06057b", "06058", "06058b", "06059", "06060", "06061", "06062", "06063", "06064", "06065", "06066", "06067", "06068", "06069", "06070", "06071", "06072", "06073", "06074", "06075", "06076", "06077", "06078", "06079", "06080", "06081", "06082", "06083", "06084", "06085", "06086", "06087", "06088", "06089", "06090", "06091", "06092", "06093", "06094", "06095", "06096", "06097", "06098", "06099", "06100", "06101", "06102", "06103", "06104", "06105", "06106", "06107", "06108", "06109"]
const codeSet = new Set(codes)

export default {
  id: "06-a-2",
  acceptanceId: "tde-beyond-gates-b-2026-11",
  exportPrefix: "TDE_SHARD2",
  verifiedFn: "tdeShard2CardVerified",
  profile: {
    id: "tde-beyond-gates-b-2026-11",
    scope: "食梦者 06 段 tde 豪华包后半（06057–06109）55 条目录记录。全部通过五维验收。",
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
  expectedCount: 55,
  failed: [],
  testFiles: [
    "games/arkhamhorror/tests/acceptance-06-a-shard2.test.mjs",
    "games/arkhamhorror/tests/tde-scenario-beyondTheGatesOfSleep.test.mjs",
    "games/arkhamhorror/tests/tde-scenario-wakingNightmare.test.mjs",
    "games/arkhamhorror/tests/tde-scenario-runtime-api.test.mjs",
    "games/arkhamhorror/tests/tde-scenario-weaverOfTheCosmos.test.mjs",
    "games/arkhamhorror/tests/tde-rules.test.mjs",
    "games/arkhamhorror/tests/tde-dual-flow.test.mjs",
    "games/arkhamhorror/tests/tde-dual-runtime.test.mjs",
    "games/arkhamhorror/tests/tde-lane-runtime.test.mjs",
    "games/arkhamhorror/tests/tde-modes.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/06-a-2-acceptance.json",
    module: "src/cards/06-a-2-acceptance.js",
  },
}
