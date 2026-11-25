// 验收单元 10-a-8：10-a 铁杉谷盛宴分片 8（fhvc 战役卡 E）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-10-a-铁杉谷盛宴-分片-8.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-10-a-铁杉谷盛宴-分片-8.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const entry of verdict.pendingCodes || []) { const code = typeof entry === 'string' ? entry : entry.code; if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: entry.dimension || 'pending', reason: entry.reason || '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' }) }
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 44 条记录（）。
const codes = ["10606","10607a","10607b","10608","10609","10610a","10610b","10611a","10611b","10612","10613","10614","10615","10616","10617","10618","10619","10620","10621","10622","10623","10624","10625","10626","10627","10628","10629","10630","10631","10632","10633","10634","10635","10636","10637","10638","10639","10640","10641","10642","10643","10644a","10644b"]
const codeSet = new Set(codes)

export default {
  id: "10-a-8",
  acceptanceId: "fhv-campaign-e-2026-11",
  exportPrefix: "FHV_SHARD8",
  verifiedFn: "fhvShard8CardVerified",
  profile: {
    id: "fhv-campaign-e-2026-11",
    scope: "铁杉谷盛宴 10 段 fhvc 战役卡（10606–10644b）44 条目录记录。37 条通过五维验收；7 条剧情资产/内容引擎读点缺失暂不切换。",
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
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-10-a-shard8.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-theTwistedHollow.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-theLongestNight.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-blockers.test.mjs",
    "games/arkhamhorror/tests/fhv-rules.test.mjs",
    "games/arkhamhorror/tests/fhv-primitives.test.mjs",
    "games/arkhamhorror/tests/fhv-interactions.test.mjs",
    "games/arkhamhorror/tests/fhv-campaign-flow.test.mjs",
    "games/arkhamhorror/tests/fhv-campaign-engine.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/10-a-8-acceptance.json",
    module: "src/cards/10-a-8-acceptance.js",
  },
}
