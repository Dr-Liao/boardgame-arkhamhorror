// 验收单元 10-a-10：10-a 铁杉谷盛宴分片 10（fhvc 战役卡 F2）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-10-a-铁杉谷盛宴-分片-10.md / .json（2026-11）。
const failed = []

// 范围锁定为审计时未验收的 43 条记录（fhvc）。
const codes = ["10677", "10678", "10679", "10680", "10681", "10682", "10683", "10684", "10685", "10686", "10687", "10688", "10689", "10690a", "10690b", "10691a", "10691b", "10692", "10693", "10693b", "10694", "10694b", "10695", "10695b", "10696", "10696b", "10697", "10697b", "10698", "10698b", "10699", "10699b", "10700", "10700b", "10701", "10701b", "10702", "10703", "10704", "10705a", "10705b", "10706a", "10706b"]
const codeSet = new Set(codes)

export default {
  id: "10-a-10",
  acceptanceId: "fhv-campaign-f2-2026-11",
  exportPrefix: "FHV_SHARD10",
  verifiedFn: "fhvShard10CardVerified",
  profile: {
    id: "fhv-campaign-f2-2026-11",
    scope: "铁杉谷盛宴 10 段 fhvc 战役卡（10677–10706b）43 条目录记录。43 条通过五维验收。",
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
    "games/arkhamhorror/tests/acceptance-10-a-shard10.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-dawnOfTheFinalDay.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-fateOfTheVale.test.mjs",
    "games/arkhamhorror/tests/fhv-rules.test.mjs",
    "games/arkhamhorror/tests/fhv-primitives.test.mjs",
    "games/arkhamhorror/tests/fhv-interactions.test.mjs",
    "games/arkhamhorror/tests/fhv-campaign-flow.test.mjs",
    "games/arkhamhorror/tests/fhv-campaign-engine.test.mjs",
    "games/arkhamhorror/tests/fhv-campaign-records.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /缺陷复现|纯接线|仅接线|存在性/ },
  outputs: {
    ledger: "audit/10-a-10-acceptance.json",
    module: "src/cards/10-a-10-acceptance.js",
  },
}
