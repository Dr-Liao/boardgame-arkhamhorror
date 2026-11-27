// 验收单元 08-a-2：08-a 地球边缘分片 2（eoep 玩家卡 B）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
const failed = []

// 范围锁定为审计时未验收的 46 条记录（eoep）。
const codes = ["08043", "08044", "08045", "08046", "08047", "08048", "08049", "08050", "08051", "08052", "08053", "08054", "08055", "08056", "08057", "08058", "08059", "08060", "08061", "08062", "08063", "08064", "08065", "08066", "08067", "08068", "08069", "08070", "08071", "08072", "08073", "08074", "08075", "08076", "08077", "08078", "08079", "08080", "08081", "08082", "08083", "08084", "08085", "08086", "08087", "08088"]
const codeSet = new Set(codes)

export default {
  id: "08-a-2",
  acceptanceId: "eote-player-b-2026-11",
  exportPrefix: "EOTE_SHARD2",
  verifiedFn: "eoteShard2CardVerified",
  profile: {
    id: "eote-player-b-2026-11",
    scope: "地球边缘 08 段 eoep 玩家卡（08043–08088）46 条目录记录。46 条通过五维验收。",
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
  expectedCount: 46,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-08-a-shard2.test.mjs",
    "games/arkhamhorror/tests/eote-player-m2-1.test.mjs",
    "games/arkhamhorror/tests/eote-player-m2-2.test.mjs",
    "games/arkhamhorror/tests/eote-player-m2-3.test.mjs",
    "games/arkhamhorror/tests/eote-player-m2-4.test.mjs",
    "games/arkhamhorror/tests/eote-rules.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-frost.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-geo.test.mjs",
    "games/arkhamhorror/tests/eote-interactions.test.mjs",
    "games/arkhamhorror/tests/eote-migration.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/08-a-2-acceptance.json",
    module: "src/cards/08-a-2-acceptance.js",
  },
}
