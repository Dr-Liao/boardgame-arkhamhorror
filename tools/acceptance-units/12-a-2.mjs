// 验收单元 12-a-2：12-a 2026 核心盒分片 2（玩家卡 B）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-12-a-2026核心盒-分片-2.md / .json（2026-11）。
// 范围锁定为审计时未验收的 40 条记录（core_2026）。
const codes = ["12041", "12042", "12043", "12044", "12045", "12046", "12047", "12048", "12049", "12050", "12051", "12052", "12053", "12054", "12055", "12056", "12057", "12058", "12059", "12060", "12061", "12062", "12063", "12064", "12065", "12066", "12067", "12068", "12069", "12070", "12071", "12072", "12073", "12074", "12075", "12076", "12077", "12078", "12079", "12080"]
const codeSet = new Set(codes)
const failed = []

export default {
  id: "12-a-2",
  acceptanceId: "core2026-player-b-2026-11",
  exportPrefix: "CORE2026_SHARD2",
  verifiedFn: "core2026Shard2CardVerified",
  profile: {
    id: "core2026-player-b-2026-11",
    scope: "2026 核心盒 12 段玩家卡（12041–12080）40 条目录记录。40 条全部通过五维验收。",
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
    "games/arkhamhorror/tests/acceptance-12-a-shard2.test.mjs",
    "games/arkhamhorror/tests/starter-batch-3.test.mjs",
    "games/arkhamhorror/tests/reprint-aliases.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/12-a-2-acceptance.json",
    module: "src/cards/12-a-2-acceptance.js",
  },
}
