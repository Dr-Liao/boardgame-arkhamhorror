// 验收单元 08-a-4：08-a 地球边缘分片 4（eoec 战役卡 A）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-08-a-地球边缘-分片-4.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-08-a-地球边缘-分片-4.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const entry of verdict.pendingCodes || []) { const code = typeof entry === 'string' ? entry : entry.code; if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: entry.dimension || 'pending', reason: entry.reason || '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' }) }
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 45 条记录（eoec）。
const codes = ["08501", "08502", "08503", "08504", "08505", "08506", "08507", "08508", "08509", "08510", "08511", "08512", "08513", "08514", "08515", "08516", "08517", "08518", "08519", "08520", "08521", "08522", "08523", "08524", "08525", "08526", "08527", "08528", "08529", "08530", "08531", "08532", "08533", "08534", "08535", "08536", "08537", "08538", "08539", "08540", "08541", "08542", "08543", "08544", "08545"]
const codeSet = new Set(codes)

export default {
  id: "08-a-4",
  acceptanceId: "eote-campaign-a-2026-11",
  exportPrefix: "EOTE_SHARD4",
  verifiedFn: "eoteShard4CardVerified",
  profile: {
    id: "eote-campaign-a-2026-11",
    scope: "地球边缘 08 段 eoec 战役卡（08501–08545）45 条目录记录。15 条通过五维验收；19 条失败（含 12 张 api.test 签名错误）+11 条 pending 暂不切换。",
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
    "games/arkhamhorror/tests/acceptance-08-a-shard4.test.mjs",
    "games/arkhamhorror/tests/eote-scenario-iceAndDeathPart1.test.mjs",
    "games/arkhamhorror/tests/eote-scenario-iceAndDeathPart2.test.mjs",
    "games/arkhamhorror/tests/eote-scenario-iceAndDeathPart3.test.mjs",
    "games/arkhamhorror/tests/eote-scenario-shared.test.mjs",
    "games/arkhamhorror/tests/eote-all-cards.test.mjs",
    "games/arkhamhorror/tests/eote-rules.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-frost.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-travel.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-geo.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-campaign.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-flow.test.mjs",
    "games/arkhamhorror/tests/eote-campaign-flow.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/08-a-4-acceptance.json",
    module: "src/cards/08-a-4-acceptance.js",
  },
}
