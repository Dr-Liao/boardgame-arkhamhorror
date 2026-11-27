// 验收单元 06-a-5：06-a 食梦者分片 5（A Thousand Shapes of Horror）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 2026-11-26 复验通过，逐卡证据保存在生成的验收账本。

// 范围锁定为审计时未验收的 41 条记录（tsh）。
const codes = ["06155", "06156", "06157", "06158", "06159", "06160", "06161", "06162", "06163", "06164", "06165", "06166", "06167", "06168", "06169a", "06169b", "06170", "06171", "06172", "06173", "06174", "06175", "06176", "06177", "06178", "06179", "06180", "06181", "06182", "06183", "06184", "06185", "06186", "06187", "06188", "06189", "06190", "06191", "06192", "06193", "06194"]
const codeSet = new Set(codes)

export default {
  id: "06-a-5",
  acceptanceId: "tde-thousand-shapes-2026-11",
  exportPrefix: "TDE_SHARD5",
  verifiedFn: "tdeShard5CardVerified",
  profile: {
    id: "tde-thousand-shapes-2026-11",
    scope: "食梦者 06 段 A Thousand Shapes of Horror（tsh，06155–06194）41 条目录记录。全部通过五维验收。",
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
  failed: [],
  testFiles: [
    "games/arkhamhorror/tests/acceptance-06-a-shard5.test.mjs",
    "games/arkhamhorror/tests/tde-scenario-aThousandShapesOfHorror.test.mjs",
    "games/arkhamhorror/tests/tde-investigators.test.mjs",
    "games/arkhamhorror/tests/tde-player-m2-1.test.mjs",
    "games/arkhamhorror/tests/tde-player-m2-2.test.mjs",
    "games/arkhamhorror/tests/tde-player-m2-3.test.mjs",
    "games/arkhamhorror/tests/tde-player-m2-4.test.mjs",
    "games/arkhamhorror/tests/tde-campaign-card-acceptance.test.mjs",
    "games/arkhamhorror/tests/tde-rules.test.mjs",
    "games/arkhamhorror/tests/tde-dual-flow.test.mjs",
    "games/arkhamhorror/tests/tde-campaign-layer.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/06-a-5-acceptance.json",
    module: "src/cards/06-a-5-acceptance.js",
  },
}
