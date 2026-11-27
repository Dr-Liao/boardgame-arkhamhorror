// 验收单元 06-a-7：06-a 食梦者分片 7（Point of No Return）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 2026-11-26 复验通过，逐卡证据保存在生成的验收账本。

// 范围锁定为审计时未验收的 54 条记录（pnr）。
const codes = ["06234", "06235", "06236", "06237", "06238", "06239", "06240", "06241", "06242", "06243", "06244", "06245", "06246", "06247", "06248", "06249", "06250", "06251", "06252", "06253", "06254", "06254b", "06255", "06255b", "06256", "06256b", "06257", "06257b", "06258", "06258b", "06259", "06259b", "06260", "06260b", "06261", "06261b", "06262", "06262b", "06263", "06263b", "06264", "06264b", "06265", "06265b", "06266", "06267", "06268", "06269", "06270", "06271", "06272", "06273", "06274", "06275"]
const codeSet = new Set(codes)

export default {
  id: "06-a-7",
  acceptanceId: "tde-point-of-no-return-2026-11",
  exportPrefix: "TDE_SHARD7",
  verifiedFn: "tdeShard7CardVerified",
  profile: {
    id: "tde-point-of-no-return-2026-11",
    scope: "食梦者 06 段 Point of No Return（pnr，06234–06275）54 条目录记录。全部通过五维验收。",
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
  expectedCount: 54,
  failed: [],
  testFiles: [
    "games/arkhamhorror/tests/acceptance-06-a-shard7.test.mjs",
    "games/arkhamhorror/tests/tde-scenario-pointOfNoReturn.test.mjs",
    "games/arkhamhorror/tests/tde-player-m2-3.test.mjs",
    "games/arkhamhorror/tests/tde-player-m2-4.test.mjs",
    "games/arkhamhorror/tests/tde-campaign-card-acceptance.test.mjs",
    "games/arkhamhorror/tests/tde-rules.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/06-a-7-acceptance.json",
    module: "src/cards/06-a-7-acceptance.js",
  },
}
