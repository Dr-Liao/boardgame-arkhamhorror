// 验收单元 11-a-3：11-a 沉没之城分片 3（tdcp 玩家卡 C）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 复验通过后以生成的逐卡账本记录结论；配置可脱离原报告独立复算。

// 范围锁定为审计时未验收的 42 条记录（tdcp）。
const codes = ["11088", "11089", "11090", "11091", "11092", "11093", "11094", "11095", "11096", "11097", "11098", "11099", "11100", "11101", "11102", "11103", "11104", "11105", "11106", "11107", "11108", "11109", "11110", "11111", "11112", "11113", "11114", "11115", "11116", "11117", "11118", "11119", "11120", "11121", "11122", "11123", "11124", "11125", "11126", "11127", "11128", "11129"]
const codeSet = new Set(codes)

export default {
  id: "11-a-3",
  acceptanceId: "tdc-player-c-2026-11",
  exportPrefix: "TDC_SHARD3",
  verifiedFn: "tdcShard3CardVerified",
  profile: {
    id: "tdc-player-c-2026-11",
    scope: "沉没之城 11 段 tdcp 玩家卡（11088–11129）42 条目录记录。42 条全部通过五维验收。",
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
  expectedCount: 42,
  failed: [],
  testFiles: [
    "games/arkhamhorror/tests/acceptance-11-a-shard3.test.mjs",
    "games/arkhamhorror/tests/tdc-player.test.mjs",
    "games/arkhamhorror/tests/tdc-player-guardian.test.mjs",
    "games/arkhamhorror/tests/tdc-player-seeker.test.mjs",
    "games/arkhamhorror/tests/tdc-player-survivor.test.mjs",
    "games/arkhamhorror/tests/tdc-investigators.test.mjs",
    "games/arkhamhorror/tests/tdc-rules.test.mjs",
    "games/arkhamhorror/tests/tdc-primitives.test.mjs",
    "games/arkhamhorror/tests/tdc-round2-primitives.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/11-a-3-acceptance.json",
    module: "src/cards/11-a-3-acceptance.js",
  },
}
