// 验收单元 07-a-2：07-a 印斯茅斯暗潮分片 2（tic 豪华包后半）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 2026-11-26 复验通过，逐卡证据保存在生成的验收账本。

// 范围锁定为审计时未验收的 54 条记录（tic）。
const codes = ["07055", "07056", "07057", "07058", "07059", "07060", "07061", "07062a", "07062b", "07063", "07064", "07065", "07066", "07067", "07068", "07069", "07070", "07071", "07072", "07073", "07074", "07075", "07076", "07077", "07078", "07079", "07080", "07081", "07082", "07083", "07084", "07085", "07086", "07087", "07088", "07089", "07090", "07091", "07092", "07093", "07094", "07095", "07096", "07097", "07098", "07099", "07100", "07101", "07102", "07103", "07104", "07105", "07106", "07107"]
const codeSet = new Set(codes)

export default {
  id: "07-a-2",
  acceptanceId: "tic-deluxe-b-2026-11",
  exportPrefix: "TIC_SHARD2",
  verifiedFn: "ticShard2CardVerified",
  profile: {
    id: "tic-deluxe-b-2026-11",
    scope: "印斯茅斯暗潮 07 段 tic 豪华包后半（07055–07107）54 条目录记录。全部通过五维验收。",
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
    "games/arkhamhorror/tests/acceptance-07-a-shard2.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-theVanishingOfElinaHarper.test.mjs",
    "games/arkhamhorror/tests/tic-scenarios-early.test.mjs",
    "games/arkhamhorror/tests/tic-harper-acts.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-shared-encounters.test.mjs",
    "games/arkhamhorror/tests/tic-fog-and-locals.test.mjs",
    "games/arkhamhorror/tests/tic-aside-hazards.test.mjs",
    "games/arkhamhorror/tests/tic-dynamic-aloof.test.mjs",
    "games/arkhamhorror/tests/tic-encounter-search.test.mjs",
    "games/arkhamhorror/tests/tic-innsmouth-look.test.mjs",
    "games/arkhamhorror/tests/tic-enemy-outcomes.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-inTooDeep.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-devilReef.test.mjs",
    "games/arkhamhorror/tests/tic-interactions.test.mjs",
    "games/arkhamhorror/tests/tic-primitives.test.mjs",
    "games/arkhamhorror/tests/tic-rules.test.mjs",
    "games/arkhamhorror/tests/tic-flashbacks.test.mjs",
    "games/arkhamhorror/tests/tic-road-hazards.test.mjs",
    "games/arkhamhorror/tests/tic-chase-vehicles.test.mjs",
    "games/arkhamhorror/tests/tic-fishing-vessel.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/07-a-2-acceptance.json",
    module: "src/cards/07-a-2-acceptance.js",
  },
}
