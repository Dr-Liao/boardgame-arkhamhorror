// 验收单元 07-a-8：07-a 印斯茅斯暗潮分片 8（Into the Maelstrom）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 2026-11-26 复验通过，逐卡证据保存在生成的验收账本。

// 范围锁定为审计时未验收的 40 条记录（itm）。
const codes = ["07301", "07302", "07303", "07304", "07305", "07306", "07307", "07308", "07309", "07310", "07311", "07312", "07313", "07314", "07315", "07316", "07317", "07318", "07319", "07320", "07321", "07322", "07323", "07324", "07325", "07326", "07327", "07328", "07329", "07330a", "07330b", "07331a", "07331b", "07332", "07333", "07334", "07335", "07336", "07337", "07338"]
const codeSet = new Set(codes)

export default {
  id: "07-a-8",
  acceptanceId: "tic-into-the-maelstrom-2026-11",
  exportPrefix: "TIC_SHARD8",
  verifiedFn: "ticShard8CardVerified",
  profile: {
    id: "tic-into-the-maelstrom-2026-11",
    scope: "印斯茅斯暗潮 07 段 Into the Maelstrom（itm，07301–07338）40 条目录记录。全部通过五维验收。",
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
  expectedCount: 40,
  failed: [],
  testFiles: [
    "games/arkhamhorror/tests/acceptance-07-a-shard8.test.mjs",
    "games/arkhamhorror/tests/tic-parallel-acts.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-intoTheMaelstrom.test.mjs",
    "games/arkhamhorror/tests/tic-scenarios-late.test.mjs",
    "games/arkhamhorror/tests/tic-scenarios-late-registered.test.mjs",
    "games/arkhamhorror/tests/tic-maelstrom-act.test.mjs",
    "games/arkhamhorror/tests/tic-maelstrom-agendas.test.mjs",
    "games/arkhamhorror/tests/tic-maelstrom-treacheries.test.mjs",
    "games/arkhamhorror/tests/tic-late-b-cards.test.mjs",
    "games/arkhamhorror/tests/tic-slumbering-bosses.test.mjs",
    "games/arkhamhorror/tests/tic-flooded-agendas.test.mjs",
    "games/arkhamhorror/tests/tic-interludes.test.mjs",
    "games/arkhamhorror/tests/tic-player-guardian-seeker.test.mjs",
    "games/arkhamhorror/tests/tic-player-rogue-mystic.test.mjs",
    "games/arkhamhorror/tests/tic-player-survivor-neutral.test.mjs",
    "games/arkhamhorror/tests/tic-player-primitives.test.mjs",
    "games/arkhamhorror/tests/tic-rules.test.mjs",
    "games/arkhamhorror/tests/tic-primitives.test.mjs",
    "games/arkhamhorror/tests/tic-interactions.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-reference-final.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/07-a-8-acceptance.json",
    module: "src/cards/07-a-8-acceptance.js",
  },
}
