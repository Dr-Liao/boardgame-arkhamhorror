// 验收单元 09-a-2：09-a 绯红密钥分片 2（tskp 玩家卡 B）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-09-a-绯红密钥-分片-2.md / .json（2026-11）。
const failed = []

// 范围锁定为审计时未验收的 43 条记录（tskp）。
const codes = ["09044", "09045", "09046", "09047", "09048", "09049", "09050", "09051", "09052", "09053", "09054", "09055", "09056", "09057", "09058", "09059", "09060", "09061", "09062", "09063", "09064", "09065", "09066", "09067", "09068", "09069", "09070", "09071", "09072", "09073", "09074", "09075", "09076", "09077", "09078", "09079", "09080", "09081", "09082", "09083", "09084", "09085", "09086"]
const codeSet = new Set(codes)

export default {
  id: "09-a-2",
  acceptanceId: "tsk-player-b-2026-11",
  exportPrefix: "TSK_SHARD2",
  verifiedFn: "tskShard2CardVerified",
  profile: {
    id: "tsk-player-b-2026-11",
    scope: "绯红密钥 09 段 tskp 玩家卡（09044–09086）43 条目录记录。43 条通过五维验收。",
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
  expectedCount: 43,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/tsk-p8-customization.test.mjs",
    'games/arkhamhorror/tests/acceptance-09-a-shard2.test.mjs',
    "games/arkhamhorror/tests/tsk-player-m2-1.test.mjs",
    "games/arkhamhorror/tests/tsk-player-m2-2.test.mjs",
    "games/arkhamhorror/tests/tsk-player-m2-3.test.mjs",
    "games/arkhamhorror/tests/tsk-player-m2-4.test.mjs",
    "games/arkhamhorror/tests/tsk-investigator-09001.test.mjs",
    "games/arkhamhorror/tests/tsk-investigator-09004.test.mjs",
    "games/arkhamhorror/tests/tsk-investigator-09008.test.mjs",
    "games/arkhamhorror/tests/tsk-investigator-09011.test.mjs",
    "games/arkhamhorror/tests/tsk-investigator-09015.test.mjs",
    "games/arkhamhorror/tests/tsk-investigator-09018.test.mjs",
    "games/arkhamhorror/tests/tsk-investigator-signatures.test.mjs",
    "games/arkhamhorror/tests/tsk-primitives-customizable.test.mjs",
    "games/arkhamhorror/tests/tsk-primitives-keys-hollow.test.mjs",
    "games/arkhamhorror/tests/tsk-interactions.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /缺陷复现|纯接线|仅接线|存在性/ },
  outputs: {
    ledger: "audit/09-a-2-acceptance.json",
    module: "src/cards/09-a-2-acceptance.js",
  },
}
