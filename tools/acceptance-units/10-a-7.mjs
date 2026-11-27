// 验收单元 10-a-7：10-a 铁杉谷盛宴分片 7（fhvc 战役卡 D）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-10-a-铁杉谷盛宴-分片-7.md / .json（2026-11）。
const failed = []

// 范围锁定为审计时未验收的 43 条记录（fhvc）。
const codes = ["10572", "10573", "10574", "10575", "10576", "10577", "10578", "10579", "10580", "10581", "10582", "10583a", "10583b", "10584a", "10584b", "10585", "10586", "10587", "10588", "10589", "10590", "10591", "10592", "10593a", "10593b", "10594a", "10594b", "10595a", "10595b", "10596a", "10596b", "10597a", "10597b", "10598a", "10598b", "10599a", "10599b", "10600", "10601", "10602", "10603", "10604", "10605"]
const codeSet = new Set(codes)

export default {
  id: "10-a-7",
  acceptanceId: "fhv-campaign-d-2026-11",
  exportPrefix: "FHV_SHARD7",
  verifiedFn: "fhvShard7CardVerified",
  profile: {
    id: "fhv-campaign-d-2026-11",
    scope: "铁杉谷盛宴 10 段 fhvc 战役卡（10572–10605）43 条目录记录。43 条通过五维验收。",
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
    "games/arkhamhorror/tests/acceptance-10-a-shard7.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-theLostSister.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-theThingInTheDepths.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-theTwistedHollow.test.mjs",
    "games/arkhamhorror/tests/fhv-rules.test.mjs",
    "games/arkhamhorror/tests/fhv-primitives.test.mjs",
    "games/arkhamhorror/tests/fhv-interactions.test.mjs",
    "games/arkhamhorror/tests/fhv-campaign-flow.test.mjs",
    "games/arkhamhorror/tests/fhv-campaign-engine.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-blockers.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /缺陷复现|纯接线|仅接线|存在性/ },
  outputs: {
    ledger: "audit/10-a-7-acceptance.json",
    module: "src/cards/10-a-7-acceptance.js",
  },
}
