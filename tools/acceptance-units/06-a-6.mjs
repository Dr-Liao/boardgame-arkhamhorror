// 验收单元 06-a-6：06-a 食梦者分片 6（Dark Side of the Moon）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 2026-11-26 复验通过，逐卡证据保存在生成的验收账本。

// 范围锁定为审计时未验收的 40 条记录（dsm）。
const codes = ["06195", "06196", "06197", "06198", "06199", "06200", "06201", "06202", "06203", "06204", "06205", "06206", "06207", "06208", "06209", "06210", "06211", "06212", "06213", "06214", "06214b", "06215", "06216", "06217", "06218", "06219", "06220", "06221", "06222", "06223", "06224", "06225", "06226", "06227", "06228", "06229", "06230", "06231", "06232", "06233"]
const codeSet = new Set(codes)

export default {
  id: "06-a-6",
  acceptanceId: "tde-dark-side-of-the-moon-2026-11",
  exportPrefix: "TDE_SHARD6",
  verifiedFn: "tdeShard6CardVerified",
  profile: {
    id: "tde-dark-side-of-the-moon-2026-11",
    scope: "食梦者 06 段 Dark Side of the Moon（dsm，06195–06233）40 条目录记录。全部通过五维验收。",
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
  failed: [],
  testFiles: [
    "games/arkhamhorror/tests/acceptance-06-a-shard6.test.mjs",
    "games/arkhamhorror/tests/tde-scenario-darkSideOfTheMoon.test.mjs",
    "games/arkhamhorror/tests/tde-player-m2-2.test.mjs",
    "games/arkhamhorror/tests/tde-player-m2-3.test.mjs",
    "games/arkhamhorror/tests/tde-campaign-card-acceptance.test.mjs",
    "games/arkhamhorror/tests/tde-rules.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/06-a-6-acceptance.json",
    module: "src/cards/06-a-6-acceptance.js",
  },
}
