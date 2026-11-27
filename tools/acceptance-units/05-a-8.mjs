// 验收单元 05-a-8：05-a 万象无终分片 8（Before the Black Throne）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 2026-11-26 复验通过，逐卡证据保存在生成的验收账本。

// 范围锁定为审计时未验收的 34 条记录（bbt）。
const codes = ["05313", "05314", "05315", "05316", "05317", "05318", "05319", "05320", "05321", "05322", "05323", "05324", "05325", "05326", "05327", "05328", "05329", "05330", "05331", "05332", "05333", "05334", "05335", "05336", "05337", "05338", "05339", "05340", "05341", "05342", "05343", "05344", "05345", "05346"]
const codeSet = new Set(codes)

export default {
  id: "05-a-8",
  acceptanceId: "tcu-before-the-black-throne-2026-11",
  exportPrefix: "TCU_SHARD8",
  verifiedFn: "tcuShard8CardVerified",
  profile: {
    id: "tcu-before-the-black-throne-2026-11",
    scope: "万象无终 05 段 Before the Black Throne（bbt，05313–05346）34 条目录记录。全部通过五维验收。",
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
  expectedCount: 34,
  failed: [],
  testFiles: [
    "games/arkhamhorror/tests/acceptance-05-a-shard8.test.mjs",
    "games/arkhamhorror/tests/tcu-black-throne.test.mjs",
    "games/arkhamhorror/tests/tcu-player-m2-4.test.mjs",
    "games/arkhamhorror/tests/tcu-campaign-card-acceptance.test.mjs",
    "games/arkhamhorror/tests/tcu-p1-regressions.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/05-a-8-acceptance.json",
    module: "src/cards/05-a-8-acceptance.js",
  },
}
