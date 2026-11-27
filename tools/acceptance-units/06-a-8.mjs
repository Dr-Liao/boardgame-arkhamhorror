// 验收单元 06-a-8：06-a 食梦者分片 8（Where the Gods Dwell）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 2026-11-26 复验通过，逐卡证据保存在生成的验收账本。

// 范围锁定为审计时未验收的 47 条记录（wgd）。
const codes = ["06276", "06277", "06278", "06279", "06280", "06281", "06282", "06283", "06284", "06285", "06286", "06287", "06288", "06289", "06290", "06291", "06292", "06293", "06294", "06295", "06296", "06297", "06298", "06299", "06300", "06301", "06302", "06303", "06304", "06305", "06306", "06307", "06308", "06309", "06310", "06311", "06312", "06313", "06314", "06315", "06316", "06317", "06318", "06319", "06320", "06321", "06322"]
const codeSet = new Set(codes)

export default {
  id: "06-a-8",
  acceptanceId: "tde-where-the-gods-dwell-2026-11",
  exportPrefix: "TDE_SHARD8",
  verifiedFn: "tdeShard8CardVerified",
  profile: {
    id: "tde-where-the-gods-dwell-2026-11",
    scope: "食梦者 06 段 Where the Gods Dwell（wgd，06276–06322）47 条目录记录。全部通过五维验收。",
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
  expectedCount: 47,
  failed: [],
  testFiles: [
    "games/arkhamhorror/tests/acceptance-06-a-shard8.test.mjs",
    "games/arkhamhorror/tests/tde-scenario-whereTheGodsDwell.test.mjs",
    "games/arkhamhorror/tests/tde-player-m2-4.test.mjs",
    "games/arkhamhorror/tests/tde-rules.test.mjs",
    "games/arkhamhorror/tests/tde-campaign-card-acceptance.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/06-a-8-acceptance.json",
    module: "src/cards/06-a-8-acceptance.js",
  },
}
