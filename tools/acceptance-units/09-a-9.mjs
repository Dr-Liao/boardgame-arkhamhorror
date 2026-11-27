// 验收单元 09-a-9：09-a 绯红密钥分片 9（tskc 战役卡 F）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-09-a-绯红密钥-分片-9.md / .json（2026-11）。
const failed = []

// 范围锁定为审计时未验收的 45 条记录（tskc）。
const codes = ["09696", "09697", "09698", "09699", "09700", "09701", "09702", "09703", "09704", "09705", "09706", "09707", "09708", "09709", "09710", "09711", "09712", "09713", "09714", "09715", "09716a", "09716b", "09716c", "09717", "09718", "09719", "09720", "09721", "09722", "09723", "09724", "09725", "09726a", "09726b", "09727a", "09727b", "09728", "09729", "09730", "09731", "09732", "09733", "09734", "09735", "09736"]
const codeSet = new Set(codes)

export default {
  id: "09-a-9",
  acceptanceId: "tsk-campaign-f-2026-11",
  exportPrefix: "TSK_SHARD9",
  verifiedFn: "tskShard9CardVerified",
  profile: {
    id: "tsk-campaign-f-2026-11",
    scope: "绯红密钥 09 段 tskc 战役卡（09696–09736）45 条目录记录。45 条通过五维验收。",
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
    "games/arkhamhorror/tests/acceptance-09-a-shard9.test.mjs",
    "games/arkhamhorror/tests/tsk-scenario-congressOfTheKeys.test.mjs",
    "games/arkhamhorror/tests/tsk-shared-encounters-a.test.mjs",
    "games/arkhamhorror/tests/tsk-shared-encounters-b.test.mjs",
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
    ledger: "audit/09-a-9-acceptance.json",
    module: "src/cards/09-a-9-acceptance.js",
  },
}
