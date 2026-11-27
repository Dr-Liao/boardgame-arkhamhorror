// 验收单元 08-a-9：08-a 地球边缘分片 9（eoec 战役共享卡 F）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
const failed = []

// 范围锁定为审计时未验收的 41 条记录（eoec）。
const codes = ["08698", "08699", "08700", "08701", "08702", "08703", "08704", "08705", "08706", "08707", "08708", "08709", "08710", "08711", "08712", "08713", "08714", "08715", "08716", "08717", "08718", "08719", "08720", "08721", "08722", "08723", "08724", "08725", "08726", "08727", "08728", "08729", "08730", "08731", "08732", "08733", "08734", "08735", "08736", "08737", "08738"]
const codeSet = new Set(codes)

export default {
  id: "08-a-9",
  acceptanceId: "eote-campaign-f-2026-11",
  exportPrefix: "EOTE_SHARD9",
  verifiedFn: "eoteShard9CardVerified",
  profile: {
    id: "eote-campaign-f-2026-11",
    scope: "地球边缘 08 段 eoec 战役共享卡（08698–08738）41 条目录记录。41 条通过五维验收。",
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
  expectedCount: 41,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-08-a-shard9.test.mjs",
    "games/arkhamhorror/tests/eote-scenario-shared.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-frost.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-travel.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-geo.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-campaign.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-flow.test.mjs",
    "games/arkhamhorror/tests/eote-rules.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/08-a-9-acceptance.json",
    module: "src/cards/08-a-9-acceptance.js",
  },
}
