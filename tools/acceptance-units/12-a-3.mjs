// 验收单元 12-a-3：12-a 2026 核心盒分片 3（玩家侧尾部 + 战役侧开头）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-12-a-2026核心盒-分片-3.md / .json（2026-11）。
// 范围锁定为审计时未验收的 40 条记录（core_2026）。
const codes = ["12081", "12082", "12083", "12084", "12085", "12086", "12087", "12088", "12089", "12090", "12091", "12092", "12093", "12094", "12095", "12096", "12097", "12098", "12099", "12100", "12101", "12102", "12103", "12104", "12105", "12106", "12107", "12108", "12109", "12110", "12111", "12112", "12113", "12114", "12115", "12116", "12117", "12118", "12119", "12120"]
const codeSet = new Set(codes)
const failed = codes.filter(code => code >= '12105').map(code => ({
  code,
  dimension: '实现完整性',
  reason: 'Brethren of Ash 对应关卡缺少本地实现，目前缺少可执行的章节结算证据。',
}))

export default {
  id: "12-a-3",
  acceptanceId: "core2026-player-c-2026-11",
  exportPrefix: "CORE2026_SHARD3",
  verifiedFn: "core2026Shard3CardVerified",
  profile: {
    id: "core2026-player-c-2026-11",
    scope: "2026 核心盒 12 段（12081–12120）40 条目录记录。24 张玩家卡通过，16 张 Brethren of Ash 战役卡缺少本地关卡实现。",
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
    "games/arkhamhorror/tests/acceptance-12-a-shard3.test.mjs",
    "games/arkhamhorror/tests/starter-batch-3.test.mjs",
    "games/arkhamhorror/tests/reprint-aliases.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/12-a-3-acceptance.json",
    module: "src/cards/12-a-3-acceptance.js",
  },
}
