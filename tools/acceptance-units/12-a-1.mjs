// 验收单元 12-a-1：12-a 2026 核心盒分片 1（调查员与玩家卡 A）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-12-a-2026核心盒-分片-1.md / .json（2026-11）。
// 范围锁定为审计时未验收的 40 条记录（core_2026）。
const codes = ["12001", "12002", "12003", "12004", "12005", "12006", "12007", "12008", "12009", "12010", "12011", "12012", "12013", "12014", "12015", "12016", "12017", "12018", "12019", "12020", "12021", "12022", "12023", "12024", "12025", "12026", "12027", "12028", "12029", "12030", "12031", "12032", "12033", "12034", "12035", "12036", "12037", "12038", "12039", "12040"]
const codeSet = new Set(codes)
const failed = []

export default {
  id: "12-a-1",
  acceptanceId: "core2026-player-a-2026-11",
  exportPrefix: "CORE2026_SHARD1",
  verifiedFn: "core2026Shard1CardVerified",
  profile: {
    id: "core2026-player-a-2026-11",
    scope: "2026 核心盒 12 段（12001–12040）40 条目录记录。40 条全部通过五维验收（含 8 张跨包重印别名由 canonical 承载）。",
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
    "games/arkhamhorror/tests/acceptance-12-a-shard1.test.mjs",
    "games/arkhamhorror/tests/starter-batch-3.test.mjs",
    "games/arkhamhorror/tests/reprint-aliases.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/12-a-1-acceptance.json",
    module: "src/cards/12-a-1-acceptance.js",
  },
}
