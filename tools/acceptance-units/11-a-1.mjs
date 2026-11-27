// 验收单元 11-a-1：11-a 沉没之城分片 1（tdcp 调查员与玩家卡 A）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 复验通过后以生成的逐卡账本记录结论；配置可脱离原报告独立复算。

// 范围锁定为审计时未验收的 44 条记录（tdcp）。
const codes = ["11001", "11002", "11003", "11004", "11005", "11006", "11007", "11008", "11009", "11010", "11011", "11012", "11013", "11014", "11015", "11016", "11017", "11018", "11019", "11020", "11021", "11022", "11023", "11024", "11025", "11026", "11027", "11028", "11029", "11030", "11031", "11032", "11033", "11034", "11035", "11036", "11037", "11038", "11039", "11040", "11041", "11042", "11043", "11044"]
const codeSet = new Set(codes)

export default {
  id: "11-a-1",
  acceptanceId: "tdc-player-a-2026-11",
  exportPrefix: "TDC_SHARD1",
  verifiedFn: "tdcShard1CardVerified",
  profile: {
    id: "tdc-player-a-2026-11",
    scope: "沉没之城 11 段 tdcp 调查员与玩家卡（11001–11044）44 条目录记录。44 条全部通过五维验收。",
    basis: '独立复核（不采信既有账本）：卡面 → 本地读点 → 原语 → 交互 → 真实执行测试逐卡核对；证据为验收测试与既有回归的真实用例标题。复验原报告未通过项并记录实际规则与状态变化。',
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
    "games/arkhamhorror/tests/acceptance-11-a-shard1.test.mjs",
    "games/arkhamhorror/tests/tdc-investigators.test.mjs",
    "games/arkhamhorror/tests/tdc-player.test.mjs",
    "games/arkhamhorror/tests/tdc-player-guardian.test.mjs",
    "games/arkhamhorror/tests/tdc-player-seeker.test.mjs",
    "games/arkhamhorror/tests/tdc-player-survivor.test.mjs",
    "games/arkhamhorror/tests/tdc-rules.test.mjs",
    "games/arkhamhorror/tests/tdc-primitives.test.mjs",
    "games/arkhamhorror/tests/tdc-round2-primitives.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/11-a-1-acceptance.json",
    module: "src/cards/11-a-1-acceptance.js",
  },
}
