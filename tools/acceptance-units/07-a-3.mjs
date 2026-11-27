// 验收单元 07-a-3：07-a 印斯茅斯暗潮分片 3（In Too Deep）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 2026-11-26 复验通过，逐卡证据保存在生成的验收账本。

// 范围锁定为审计时未验收的 44 条记录（）。
const codes = ["07108", "07109", "07110", "07111", "07112", "07113", "07114", "07115", "07116", "07117", "07118", "07119", "07120", "07121", "07122", "07123", "07124", "07125", "07126", "07127", "07128", "07129", "07130", "07131", "07132", "07133", "07134", "07135", "07136", "07137", "07138", "07139", "07140", "07141", "07142", "07143", "07144", "07145", "07146", "07147", "07148", "07149", "07150", "07151"]
const codeSet = new Set(codes)

export default {
  id: "07-a-3",
  acceptanceId: "tic-in-too-deep-2026-11",
  exportPrefix: "TIC_SHARD3",
  verifiedFn: "ticShard3CardVerified",
  profile: {
    id: "tic-in-too-deep-2026-11",
    scope: "印斯茅斯暗潮 07 段 In Too Deep（itd，07108–07151）44 条目录记录。全部通过五维验收。",
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
  expectedCount: 44,
  failed: [],
  testFiles: [
    "games/arkhamhorror/tests/acceptance-07-a-shard3.test.mjs",
    "games/arkhamhorror/tests/tic-scenarios-early.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-inTooDeep.test.mjs",
    "games/arkhamhorror/tests/tic-capture.test.mjs",
    "games/arkhamhorror/tests/tic-flooded-agendas.test.mjs",
    "games/arkhamhorror/tests/tic-flashbacks.test.mjs",
    "games/arkhamhorror/tests/tic-rules.test.mjs",
    "games/arkhamhorror/tests/tic-primitives.test.mjs",
    "games/arkhamhorror/tests/tic-interactions.test.mjs",
    "games/arkhamhorror/tests/tic-scenarios-middle.test.mjs",
    "games/arkhamhorror/tests/tic-scenarios-middle-setup.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-reference.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-reference-final.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-reference-moving.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-reference-printed.test.mjs",
    "games/arkhamhorror/tests/tic-enemy-outcomes.test.mjs",
    "games/arkhamhorror/tests/tic-player-guardian-seeker.test.mjs",
    "games/arkhamhorror/tests/tic-player-rogue-mystic.test.mjs",
    "games/arkhamhorror/tests/tic-player-survivor-neutral.test.mjs",
    "games/arkhamhorror/tests/tic-player-primitives.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/07-a-3-acceptance.json",
    module: "src/cards/07-a-3-acceptance.js",
  },
}
