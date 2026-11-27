// 验收单元 05-a-4：05-a 万象无终分片 4（The Wages of Sin）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 2026-11-26 复验通过，逐卡证据保存在生成的验收账本。

// 范围锁定为审计时未验收的 57 条记录（wos）。
const codes = ["05151", "05152", "05153", "05154", "05155", "05156", "05157", "05158", "05159", "05160", "05161", "05162", "05163", "05164", "05165", "05166", "05166b", "05167", "05167b", "05168", "05168b", "05169", "05169b", "05170", "05170b", "05171", "05171b", "05172", "05172b", "05173", "05173b", "05174", "05174b", "05175", "05175b", "05176", "05176b", "05177", "05178a", "05178b", "05178c", "05178d", "05178e", "05178f", "05178g", "05178h", "05178i", "05178j", "05178k", "05178l", "05179", "05180", "05181", "05182", "05183", "05184", "05185"]
const codeSet = new Set(codes)

export default {
  id: "05-a-4",
  acceptanceId: "tcu-wages-of-sin-2026-11",
  exportPrefix: "TCU_SHARD4",
  verifiedFn: "tcuShard4CardVerified",
  profile: {
    id: "tcu-wages-of-sin-2026-11",
    scope: "万象无终 05 段 The Wages of Sin（wos，05151–05185）57 条目录记录。全部通过五维验收。",
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
  expectedCount: 57,
  failed: [],
  serial: true,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-05-a-shard4.test.mjs",
    "games/arkhamhorror/tests/tcu-wages-of-sin.test.mjs",
    "games/arkhamhorror/tests/tcu-p0-regressions.test.mjs",
    "games/arkhamhorror/tests/tcu-player-m2-2.test.mjs",
    "games/arkhamhorror/tests/tcu-interactions.test.mjs",
    "games/arkhamhorror/tests/tcu-completion.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/05-a-4-acceptance.json",
    module: "src/cards/05-a-4-acceptance.js",
  },
}
