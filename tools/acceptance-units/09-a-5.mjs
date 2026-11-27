// 验收单元 09-a-5：09-a 绯红密钥分片 5（tskc 战役卡 B）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-09-a-绯红密钥-分片-5.md / .json（2026-11）。
const failed = []

// 范围锁定为审计时未验收的 45 条记录（tskc）。
const codes = ["09543", "09544a", "09544b", "09545", "09546", "09547", "09548", "09549", "09550", "09551", "09552", "09553", "09554", "09555", "09556", "09557", "09557b", "09558", "09559", "09560", "09561", "09562", "09563", "09564", "09565a", "09565b", "09566", "09567", "09568", "09569", "09570", "09571", "09571b", "09572", "09573", "09574", "09575", "09576", "09577", "09578", "09579", "09580", "09581", "09582", "09583"]
const codeSet = new Set(codes)

export default {
  id: "09-a-5",
  acceptanceId: "tsk-campaign-b-2026-11",
  exportPrefix: "TSK_SHARD5",
  verifiedFn: "tskShard5CardVerified",
  profile: {
    id: "tsk-campaign-b-2026-11",
    scope: "绯红密钥 09 段 tskc 战役卡（09543–09583）45 条目录记录。45 条通过五维验收。",
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
  expectedCount: 45,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-09-a-shard5.test.mjs",
    "games/arkhamhorror/tests/tsk-scenario-sanguineShadows.test.mjs",
    "games/arkhamhorror/tests/tsk-scenario-dealingsInTheDark.test.mjs",
    "games/arkhamhorror/tests/tsk-primitives-customizable.test.mjs",
    "games/arkhamhorror/tests/tsk-primitives-keys-hollow.test.mjs",
    "games/arkhamhorror/tests/tsk-primitives-state.test.mjs",
    "games/arkhamhorror/tests/tsk-primitives-map.test.mjs",
    "games/arkhamhorror/tests/tsk-interactions.test.mjs",
    "games/arkhamhorror/tests/tsk-p0-regressions.test.mjs",
    "games/arkhamhorror/tests/tsk-p1-regressions.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /缺陷复现|纯接线|仅接线|存在性/ },
  outputs: {
    ledger: "audit/09-a-5-acceptance.json",
    module: "src/cards/09-a-5-acceptance.js",
  },
}
