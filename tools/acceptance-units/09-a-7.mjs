// 验收单元 09-a-7：09-a 绯红密钥分片 7（tskc 战役卡 D）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-09-a-绯红密钥-分片-7.md / .json（2026-11）。
const failed = []

// 范围锁定为审计时未验收的 45 条记录（tskc）。
const codes = ["09623", "09624", "09625a", "09625b", "09626", "09627", "09628", "09629", "09630", "09631", "09632", "09633", "09634a", "09634b", "09635", "09636", "09637", "09638", "09639", "09640", "09641", "09642", "09643", "09644", "09645", "09646", "09647", "09648", "09649", "09650", "09651", "09652", "09653a", "09653b", "09654a", "09654b", "09655a", "09655b", "09656", "09657", "09658", "09659a", "09659b", "09660", "09661"]
const codeSet = new Set(codes)

export default {
  id: "09-a-7",
  acceptanceId: "tsk-campaign-d-2026-11",
  exportPrefix: "TSK_SHARD7",
  verifiedFn: "tskShard7CardVerified",
  profile: {
    id: "tsk-campaign-d-2026-11",
    scope: "绯红密钥 09 段 tskc 战役卡（09623–09661）45 条目录记录。45 条通过五维验收。",
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
    "games/arkhamhorror/tests/acceptance-09-a-shard7.test.mjs",
    "games/arkhamhorror/tests/tsk-scenario-onThinIce.test.mjs",
    "games/arkhamhorror/tests/tsk-scenario-dogsOfWar.test.mjs",
    "games/arkhamhorror/tests/tsk-scenario-shadesOfSuffering.test.mjs",
    "games/arkhamhorror/tests/tsk-p0-regressions.test.mjs",
    "games/arkhamhorror/tests/tsk-p1-regressions.test.mjs",
    "games/arkhamhorror/tests/tsk-primitives-customizable.test.mjs",
    "games/arkhamhorror/tests/tsk-primitives-keys-hollow.test.mjs",
    "games/arkhamhorror/tests/tsk-primitives-state.test.mjs",
    "games/arkhamhorror/tests/tsk-primitives-map.test.mjs",
    "games/arkhamhorror/tests/tsk-interactions.test.mjs",
    "games/arkhamhorror/tests/tsk-campaign-flow.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /缺陷复现|纯接线|仅接线|存在性/ },
  outputs: {
    ledger: "audit/09-a-7-acceptance.json",
    module: "src/cards/09-a-7-acceptance.js",
  },
}
