// 验收单元 08-a-7：08-a 地球边缘分片 7（eoec 战役卡 D）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-08-a-地球边缘-分片-7.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-08-a-地球边缘-分片-7.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const code of verdict.pendingCodes || []) if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: 'pending', reason: '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' })
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 45 条记录（eoec）。
const codes = ["08608", "08609", "08610", "08611", "08612", "08613", "08614", "08615", "08616", "08617", "08618", "08619", "08620", "08621", "08622", "08623", "08624", "08625", "08626", "08627", "08628", "08629", "08630", "08631", "08632", "08633", "08634", "08635", "08636", "08637", "08638", "08639", "08640", "08641", "08642", "08643", "08644", "08645", "08646", "08647", "08648", "08649", "08650", "08651", "08652"]
const codeSet = new Set(codes)

export default {
  id: "08-a-7",
  acceptanceId: "eote-campaign-d-2026-11",
  exportPrefix: "EOTE_SHARD7",
  verifiedFn: "eoteShard7CardVerified",
  profile: {
    id: "eote-campaign-d-2026-11",
    scope: "地球边缘 08 段 eoec 战役卡（08608–08652）45 条目录记录。30 条通过五维验收；15 条声明键无读点/效果未分派暂不切换。",
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
  expectedCount: 45,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-08-a-shard7.test.mjs",
    "games/arkhamhorror/tests/eote-scenario-toTheForbiddenPeaks.test.mjs",
    "games/arkhamhorror/tests/eote-scenario-cityOfTheElderThings.test.mjs",
    "games/arkhamhorror/tests/eote-scenario-theHeartOfMadnessPart2.test.mjs",
    "games/arkhamhorror/tests/eote-scenario-shared.test.mjs",
    "games/arkhamhorror/tests/eote-campaign-flow.test.mjs",
    "games/arkhamhorror/tests/eote-rules.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-frost.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-travel.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-geo.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/08-a-7-acceptance.json",
    module: "src/cards/08-a-7-acceptance.js",
  },
}
