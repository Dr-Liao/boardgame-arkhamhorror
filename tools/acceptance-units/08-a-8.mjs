// 验收单元 08-a-8：08-a 地球边缘分片 8（eoec 战役卡 E）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
const failed = []

// 范围锁定为审计时未验收的 45 条记录（eoec）。
const codes = ["08653", "08654", "08655", "08656", "08657", "08658", "08659", "08660", "08661", "08662", "08663", "08664", "08665", "08666", "08667", "08668", "08669", "08670", "08671", "08672", "08673", "08674", "08675", "08676", "08677", "08678", "08679", "08680", "08681", "08682", "08683", "08684", "08685", "08686", "08687", "08688", "08689", "08690", "08691", "08692", "08693", "08694", "08695", "08696", "08697"]
const codeSet = new Set(codes)

export default {
  id: "08-a-8",
  acceptanceId: "eote-campaign-e-2026-11",
  exportPrefix: "EOTE_SHARD8",
  verifiedFn: "eoteShard8CardVerified",
  profile: {
    id: "eote-campaign-e-2026-11",
    scope: "地球边缘 08 段 eoec 战役卡（08653–08697）45 条目录记录。45 条通过五维验收。",
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
  expectedCount: 45,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-08-a-shard8.test.mjs",
    "games/arkhamhorror/tests/eote-scenario-iceAndDeathPart1.test.mjs",
    "games/arkhamhorror/tests/eote-scenario-iceAndDeathPart2.test.mjs",
    "games/arkhamhorror/tests/eote-scenario-shared.test.mjs",
    "games/arkhamhorror/tests/eote-rules.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-frost.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-travel.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-geo.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-campaign.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/08-a-8-acceptance.json",
    module: "src/cards/08-a-8-acceptance.js",
  },
}
