// 验收单元 06-a-4：06-a 食梦者分片 4（The Search for Kadath 后半）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 2026-11-26 复验通过，逐卡证据保存在生成的验收账本。

// 范围锁定为审计时未验收的 33 条记录（sfk）。
const codes = ["06133", "06133b", "06134", "06134b", "06135", "06135b", "06136", "06136b", "06137", "06137b", "06138", "06138b", "06139", "06139b", "06140", "06140b", "06141", "06141b", "06142", "06142b", "06143", "06143b", "06144", "06145", "06146", "06147", "06148", "06149", "06150", "06151", "06152", "06153", "06154"]
const codeSet = new Set(codes)

export default {
  id: "06-a-4",
  acceptanceId: "tde-search-for-kadath-b-2026-11",
  exportPrefix: "TDE_SHARD4",
  verifiedFn: "tdeShard4CardVerified",
  profile: {
    id: "tde-search-for-kadath-b-2026-11",
    scope: "食梦者 06 段 The Search for Kadath（sfk，06133–06154）33 条目录记录。全部通过五维验收。",
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
  expectedCount: 33,
  failed: [],
  testFiles: [
    "games/arkhamhorror/tests/acceptance-06-a-shard4.test.mjs",
    "games/arkhamhorror/tests/tde-scenario-theSearchForKadath.test.mjs",
    "games/arkhamhorror/tests/tde-campaign-card-acceptance.test.mjs",
    "games/arkhamhorror/tests/tde-rules.test.mjs",
    "games/arkhamhorror/tests/tde-player-m2-2.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/06-a-4-acceptance.json",
    module: "src/cards/06-a-4-acceptance.js",
  },
}
