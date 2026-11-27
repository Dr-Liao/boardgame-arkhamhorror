// 验收单元 05-a-5：05-a 万象无终分片 5（For the Greater Good）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 2026-11-26 复验通过，逐卡证据保存在生成的验收账本。

// 范围锁定为审计时未验收的 44 条记录（fgg）。
const codes = ["05186", "05187", "05188", "05189", "05190", "05191", "05192", "05193", "05194", "05195", "05196", "05197", "05198", "05199", "05200", "05201", "05202", "05203", "05204", "05205", "05206", "05207", "05208", "05209", "05210", "05211", "05212", "05213", "05214", "05215", "05216", "05217", "05217b", "05218", "05219", "05220", "05221", "05222", "05223", "05224", "05225", "05226", "05227", "05228"]
const codeSet = new Set(codes)

export default {
  id: "05-a-5",
  acceptanceId: "tcu-greater-good-2026-11",
  exportPrefix: "TCU_SHARD5",
  verifiedFn: "tcuShard5CardVerified",
  profile: {
    id: "tcu-greater-good-2026-11",
    scope: "万象无终 05 段 For the Greater Good（fgg，05186–05228）44 条目录记录。全部通过五维验收。",
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
  expectedCount: 44,
  failed: [],
  testFiles: [
    "games/arkhamhorror/tests/acceptance-05-a-shard5.test.mjs",
    "games/arkhamhorror/tests/tcu-player-m2-3.test.mjs",
    "games/arkhamhorror/tests/tcu-greater-good.test.mjs",
    "games/arkhamhorror/tests/tcu-p0-regressions.test.mjs",
    "games/arkhamhorror/tests/tcu-p1-regressions.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/05-a-5-acceptance.json",
    module: "src/cards/05-a-5-acceptance.js",
  },
}
