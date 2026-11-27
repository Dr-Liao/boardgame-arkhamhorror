// 验收单元 10-a-3：10-a 铁杉谷盛宴分片 3（fhvp 玩家卡 C）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-10-a-铁杉谷盛宴-分片-3.md / .json（2026-11）。
const failed = []

// 范围锁定为审计时未验收的 35 条记录（fhvp）。
const codes = ["10069", "10070", "10071", "10072", "10073", "10074", "10075", "10076", "10077", "10078", "10079", "10080", "10081", "10082", "10083", "10084", "10085", "10086", "10087", "10088", "10089", "10090", "10091", "10092", "10093", "10094", "10095", "10096", "10097", "10098", "10099", "10100", "10101", "10102", "10103"]
const codeSet = new Set(codes)

export default {
  id: "10-a-3",
  acceptanceId: "fhv-player-c-2026-11",
  exportPrefix: "FHV_SHARD3",
  verifiedFn: "fhvShard3CardVerified",
  profile: {
    id: "fhv-player-c-2026-11",
    scope: "铁杉谷盛宴 10 段 fhvp 玩家卡（10069–10103）35 条目录记录。35 条通过五维验收。",
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
  expectedCount: 35,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-10-a-shard3.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-1.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-2.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-3.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-4.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-5.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-6.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-7.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-8.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-9.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-10.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-11.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-12.test.mjs",
    "games/arkhamhorror/tests/fhv-rules.test.mjs",
    "games/arkhamhorror/tests/fhv-player-primitives.test.mjs",
    "games/arkhamhorror/tests/fhv-investigator-10001.test.mjs",
    "games/arkhamhorror/tests/fhv-investigator-10004.test.mjs",
    "games/arkhamhorror/tests/fhv-investigator-10009.test.mjs",
    "games/arkhamhorror/tests/fhv-investigator-10012.test.mjs",
    "games/arkhamhorror/tests/fhv-investigator-10015.test.mjs",
    "games/arkhamhorror/tests/fhv-investigator-signatures.test.mjs",
    "games/arkhamhorror/tests/fhv-interactions.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-preludeTheFinalEvening.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /缺陷复现|纯接线|仅接线|存在性/ },
  outputs: {
    ledger: "audit/10-a-3-acceptance.json",
    module: "src/cards/10-a-3-acceptance.js",
  },
}
