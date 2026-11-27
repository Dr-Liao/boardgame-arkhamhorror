// 验收单元 12-a-4：12-a 2026 核心盒分片 4（战役侧 A）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-12-a-2026核心盒-分片-4.md / .json（2026-11）。
// 范围锁定为审计时未验收的 40 条记录（core_2026）。
const codes = ["12121", "12122", "12123", "12124", "12125", "12126", "12127", "12128", "12129", "12130", "12131", "12132", "12133", "12134", "12135", "12136", "12137", "12138", "12139", "12140", "12141", "12142", "12143", "12144", "12145", "12146", "12147", "12148", "12149", "12150", "12151", "12152", "12153", "12154", "12155", "12156", "12157", "12158", "12159", "12160"]
const codeSet = new Set(codes)
const failed = codes.map(code => ({
  code,
  dimension: '实现完整性',
  reason: 'Brethren of Ash 对应关卡缺少本地实现，目前缺少可执行的章节结算证据。',
}))

export default {
  id: "12-a-4",
  acceptanceId: "core2026-campaign-a-2026-11",
  exportPrefix: "CORE2026_SHARD4",
  verifiedFn: "core2026Shard4CardVerified",
  profile: {
    id: "core2026-campaign-a-2026-11",
    scope: "2026 核心盒 12 段战役侧（12121–12160）40 条目录记录。40 张 Brethren of Ash 战役卡缺少本地关卡实现。",
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
  failed,
  testFiles: [
    "games/arkhamhorror/tests/starter-batch-3.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/12-a-4-acceptance.json",
    module: "src/cards/12-a-4-acceptance.js",
  },
}
