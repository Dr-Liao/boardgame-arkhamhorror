// 验收单元 10-a-11：10-a 铁杉谷盛宴分片 11（fhvc 战役卡 G）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-10-a-铁杉谷盛宴-分片-11.md / .json（2026-11）。
const failed = []

// 范围锁定为审计时未验收的 43 条记录（fhvc）。
const codes = ["10707a", "10707b", "10708a", "10708b", "10709a", "10709b", "10710a", "10710b", "10711a", "10711b", "10712a", "10712b", "10713", "10714", "10715", "10716", "10717", "10718", "10719", "10720", "10721", "10722", "10723", "10724", "10725", "10726", "10727", "10728", "10729", "10730", "10731", "10732", "10733", "10734", "10735", "10736", "10737", "10738", "10739", "10740", "10741", "10742", "10743"]
const codeSet = new Set(codes)

export default {
  id: "10-a-11",
  acceptanceId: "fhv-campaign-g-2026-11",
  exportPrefix: "FHV_SHARD11",
  verifiedFn: "fhvShard11CardVerified",
  profile: {
    id: "fhv-campaign-g-2026-11",
    scope: "铁杉谷盛宴 10 段 fhvc 战役卡（10707a–10743）43 条目录记录。43 条通过五维验收。",
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
    "games/arkhamhorror/tests/acceptance-10-a-shard11.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-fateOfTheVale.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-dawnOfTheFinalDay.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-dawnOfTheSecondDay.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-theLongestNight.test.mjs",
    "games/arkhamhorror/tests/fhv-campaign-flow.test.mjs",
    "games/arkhamhorror/tests/fhv-campaign-engine.test.mjs",
    "games/arkhamhorror/tests/fhv-campaign-records.test.mjs",
    "games/arkhamhorror/tests/fhv-rules.test.mjs",
    "games/arkhamhorror/tests/fhv-primitives.test.mjs",
    "games/arkhamhorror/tests/fhv-interactions.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-blockers.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /缺陷复现|纯接线|仅接线|存在性/ },
  outputs: {
    ledger: "audit/10-a-11-acceptance.json",
    module: "src/cards/10-a-11-acceptance.js",
  },
}
