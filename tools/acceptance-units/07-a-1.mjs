// 验收单元 07-a-1：07-a 印斯茅斯暗潮分片 1（tic 豪华包前半）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 2026-11-26 复验通过，逐卡证据保存在生成的验收账本。

// 范围锁定为审计时未验收的 54 条记录（tic）。
const codes = ["07001", "07002", "07003", "07004", "07005", "07006", "07007", "07008", "07009", "07010", "07011", "07012", "07013", "07014", "07015", "07016", "07017", "07018", "07019", "07020", "07021", "07022", "07023", "07024", "07025", "07026", "07027", "07028", "07029", "07030", "07031", "07032", "07033", "07034", "07035", "07036", "07037", "07038", "07039", "07040", "07041", "07042", "07043", "07044", "07045", "07046", "07047", "07048", "07049", "07050", "07051", "07052", "07053", "07054"]
const codeSet = new Set(codes)

export default {
  id: "07-a-1",
  acceptanceId: "tic-deluxe-a-2026-11",
  exportPrefix: "TIC_SHARD1",
  verifiedFn: "ticShard1CardVerified",
  profile: {
    id: "tic-deluxe-a-2026-11",
    scope: "印斯茅斯暗潮 07 段 tic 豪华包前半（07001–07054）54 条目录记录。全部通过五维验收。",
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
  expectedCount: 54,
  failed: [],
  testFiles: [
    "games/arkhamhorror/tests/acceptance-07-a-shard1.test.mjs",
    "games/arkhamhorror/tests/tic-investigators.test.mjs",
    "games/arkhamhorror/tests/tic-player-guardian-seeker.test.mjs",
    "games/arkhamhorror/tests/tic-player-rogue-mystic.test.mjs",
    "games/arkhamhorror/tests/tic-player-survivor-neutral.test.mjs",
    "games/arkhamhorror/tests/tic-player-primitives.test.mjs",
    "games/arkhamhorror/tests/tic-rules.test.mjs",
    "games/arkhamhorror/tests/tic-scenarios-early.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-reference.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-reference-final.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-reference-moving.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-reference-printed.test.mjs",
    "games/arkhamhorror/tests/tic-enemy-outcomes.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-thePitOfDespair.test.mjs",
    "games/arkhamhorror/tests/tic-primitives.test.mjs",
    "games/arkhamhorror/tests/tic-interactions.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/07-a-1-acceptance.json",
    module: "src/cards/07-a-1-acceptance.js",
  },
}
