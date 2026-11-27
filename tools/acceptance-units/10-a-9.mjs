// 验收单元 10-a-9：10-a 铁杉谷盛宴分片 9（fhvc 战役卡 F）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-10-a-铁杉谷盛宴-分片-9.md / .json（2026-11）。

// 范围锁定为审计时未验收的 43 条记录（fhvc）。
const codes = ["10644c", "10645a", "10645b", "10645c", "10646", "10647a", "10647b", "10647c", "10648", "10649", "10650", "10651", "10652", "10653", "10654", "10655", "10656", "10657", "10658", "10659", "10660", "10661", "10661b", "10662a", "10662b", "10663a", "10663b", "10664a", "10664b", "10665a", "10665b", "10666", "10667", "10668", "10669", "10670", "10670b", "10671", "10672", "10673", "10674", "10675", "10676"]
const codeSet = new Set(codes)

export default {
  id: "10-a-9",
  acceptanceId: "fhv-campaign-f-2026-11",
  exportPrefix: "FHV_SHARD9",
  verifiedFn: "fhvShard9CardVerified",
  profile: {
    id: "fhv-campaign-f-2026-11",
    scope: "铁杉谷盛宴 10 段 fhvc 战役卡（10644c–10676）43 条目录记录，全部通过五维验收。",
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
  expectedCount: 43,
  failed: [],
  testFiles: [
    "games/arkhamhorror/tests/acceptance-10-a-shard9.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-fateOfTheVale.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-dawnOfTheFinalDay.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-dawnOfTheSecondDay.test.mjs",
    "games/arkhamhorror/tests/fhv-rules.test.mjs",
    "games/arkhamhorror/tests/fhv-primitives.test.mjs",
    "games/arkhamhorror/tests/fhv-interactions.test.mjs",
    "games/arkhamhorror/tests/fhv-campaign-flow.test.mjs",
    "games/arkhamhorror/tests/fhv-campaign-engine.test.mjs",
    "games/arkhamhorror/tests/fhv-campaign-records.test.mjs",
    "tests/hall/card-views.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /缺陷复现|纯接线|仅接线|存在性/ },
  outputs: {
    ledger: "audit/10-a-9-acceptance.json",
    module: "src/cards/10-a-9-acceptance.js",
  },
}
