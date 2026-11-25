// 验收单元 08-a-6：08-a 地球边缘分片 6（eoec 战役卡 C）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-08-a-地球边缘-分片-6.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-08-a-地球边缘-分片-6.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const entry of verdict.pendingCodes || []) { const code = typeof entry === 'string' ? entry : entry.code; if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: entry.dimension || 'pending', reason: entry.reason || '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' }) }
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 45 条记录（eoec）。
const codes = ["08573b", "08574", "08574b", "08575", "08575b", "08576", "08576b", "08577", "08577b", "08578", "08578b", "08579", "08579b", "08580", "08580b", "08581", "08581b", "08582", "08582b", "08583", "08583b", "08584", "08585", "08586", "08587", "08588", "08589", "08590", "08591", "08592", "08593", "08594", "08595", "08596", "08597", "08598", "08599", "08600", "08601", "08602", "08603", "08604", "08605", "08606", "08607"]
const codeSet = new Set(codes)

export default {
  id: "08-a-6",
  acceptanceId: "eote-campaign-c-2026-11",
  exportPrefix: "EOTE_SHARD6",
  verifiedFn: "eoteShard6CardVerified",
  profile: {
    id: "eote-campaign-c-2026-11",
    scope: "地球边缘 08 段 eoec 战役卡（08573b–08607）45 条目录记录。21 条通过五维验收；24 条 fatalMirage 逐卡规则声明无读点/结构条件缺陷暂不切换。",
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
    "games/arkhamhorror/tests/acceptance-08-a-shard6.test.mjs",
    "games/arkhamhorror/tests/eote-scenario-fatalMirage.test.mjs",
    "games/arkhamhorror/tests/eote-scenario-shared.test.mjs",
    "games/arkhamhorror/tests/eote-all-cards.test.mjs",
    "games/arkhamhorror/tests/eote-rules.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-frost.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-travel.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-geo.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-campaign.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/08-a-6-acceptance.json",
    module: "src/cards/08-a-6-acceptance.js",
  },
}
