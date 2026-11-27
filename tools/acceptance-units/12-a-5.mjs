// 验收单元 12-a-5：12-a 2026 核心盒分片 5（战役侧 B）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-12-a-2026核心盒-分片-5.md / .json（2026-11）。
// 范围锁定为审计时未验收的 36 条记录（core_2026）。
const codes = ["12161", "12162", "12163", "12164", "12165", "12166", "12167", "12168", "12169", "12170", "12171", "12172", "12173", "12174", "12175", "12176", "12177", "12178", "12179", "12179b", "12180", "12181", "12182", "12183", "12184", "12185", "12186", "12187", "12188", "12189", "12190", "12191", "12192", "12193", "12194", "12195"]
const codeSet = new Set(codes)
const failed = codes.filter(code => !['12166', '12167'].includes(code)).map(code => ({
  code,
  dimension: '实现完整性',
  reason: 'Brethren of Ash 对应关卡缺少本地实现，目前缺少可执行的章节结算证据。',
}))

export default {
  id: "12-a-5",
  acceptanceId: "core2026-campaign-b-2026-11",
  exportPrefix: "CORE2026_SHARD5",
  verifiedFn: "core2026Shard5CardVerified",
  profile: {
    id: "core2026-campaign-b-2026-11",
    scope: "2026 核心盒 12 段战役侧（12161–12195，含 12179b）36 条目录记录。两张跨战役重印通过，34 张 Brethren of Ash 战役卡缺少本地关卡实现。",
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
  expectedCount: 36,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/reprint-aliases.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/12-a-5-acceptance.json",
    module: "src/cards/12-a-5-acceptance.js",
  },
}
