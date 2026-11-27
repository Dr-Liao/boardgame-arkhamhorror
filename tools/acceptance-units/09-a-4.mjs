// 验收单元 09-a-4：09-a 绯红密钥分片 4（tskc 战役卡 A）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-09-a-绯红密钥-分片-4.md / .json（2026-11）。
const failed = []

// 范围锁定为审计时未验收的 45 条记录（tskc）。
const codes = ["09501", "09502", "09503", "09504", "09505", "09506", "09507", "09508", "09509", "09510", "09511", "09512", "09513", "09514", "09515", "09516", "09517", "09518", "09519a", "09519b", "09520", "09521", "09522", "09523", "09524", "09525", "09526", "09527", "09528", "09529", "09530", "09531", "09532", "09533", "09534", "09535", "09536", "09536b", "09537", "09537b", "09538", "09539", "09540", "09541", "09542"]
const codeSet = new Set(codes)

export default {
  id: "09-a-4",
  acceptanceId: "tsk-campaign-a-2026-11",
  exportPrefix: "TSK_SHARD4",
  verifiedFn: "tskShard4CardVerified",
  profile: {
    id: "tsk-campaign-a-2026-11",
    scope: "绯红密钥 09 段 tskc 战役卡（09501–09542）45 条目录记录。45 条通过五维验收。",
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
    "games/arkhamhorror/tests/acceptance-09-a-shard4.test.mjs",
    "games/arkhamhorror/tests/tsk-scenario-riddlesAndRain.test.mjs",
    "games/arkhamhorror/tests/tsk-scenario-deadHeat.test.mjs",
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
    ledger: "audit/09-a-4-acceptance.json",
    module: "src/cards/09-a-4-acceptance.js",
  },
}
