// 验收单元 06-a-3：06-a 食梦者分片 3（The Search for Kadath 前半）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-06-a-食梦者-分片-3.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-06-a-食梦者-分片-3.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const code of verdict.pendingCodes || []) if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: 'pending', reason: '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' })
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 29 条记录（）。
const codes = ["06110", "06111", "06112", "06113", "06114", "06115", "06116", "06117", "06118", "06119", "06120", "06121", "06122", "06123", "06124", "06125", "06126", "06127", "06127b", "06128", "06128b", "06129", "06129b", "06130", "06130b", "06131", "06131b", "06132", "06132b"]
const codeSet = new Set(codes)

export default {
  id: "06-a-3",
  acceptanceId: "tde-search-for-kadath-a-2026-11",
  exportPrefix: "TDE_SHARD3",
  verifiedFn: "tdeShard3CardVerified",
  profile: {
    id: "tde-search-for-kadath-a-2026-11",
    scope: "食梦者 06 段 The Search for Kadath（sfk，06110–06132）29 条目录记录。15 条通过五维验收；14 条因声明未接线、背面模板重复手写或字段误判暂不切换。",
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
  expectedCount: 29,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-06-a-shard3.test.mjs",
    "games/arkhamhorror/tests/tde-player-m2-1.test.mjs",
    "games/arkhamhorror/tests/tde-player-m2-2.test.mjs",
    "games/arkhamhorror/tests/tde-scenario-theSearchForKadath.test.mjs",
    "games/arkhamhorror/tests/tde-campaign-card-acceptance.test.mjs",
    "games/arkhamhorror/tests/tde-rules.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/06-a-3-acceptance.json",
    module: "src/cards/06-a-3-acceptance.js",
  },
}
