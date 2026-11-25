// 验收单元 09-a-8：09-a 绯红密钥分片 8（tskc 战役卡 E）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-09-a-绯红密钥-分片-8.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-09-a-绯红密钥-分片-8.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const entry of verdict.pendingCodes || []) { const code = typeof entry === 'string' ? entry : entry.code; if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: entry.dimension || 'pending', reason: entry.reason || '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' }) }
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 45 条记录（tskc）。
const codes = ["09662", "09663", "09664", "09665", "09666", "09667", "09668", "09669", "09670", "09671", "09672", "09673", "09674a", "09674b", "09674c", "09674d", "09675a", "09675b", "09675c", "09675d", "09676a", "09676b", "09676c", "09676d", "09677", "09678", "09679a", "09679b", "09680a", "09680b", "09681", "09682", "09683", "09684", "09685", "09686", "09687", "09688", "09689", "09690", "09691", "09692", "09693", "09694", "09695"]
const codeSet = new Set(codes)

export default {
  id: "09-a-8",
  acceptanceId: "tsk-campaign-e-2026-11",
  exportPrefix: "TSK_SHARD8",
  verifiedFn: "tskShard8CardVerified",
  profile: {
    id: "tsk-campaign-e-2026-11",
    scope: "绯红密钥 09 段 tskc 战役卡（09662–09695）45 条目录记录。39 条通过五维验收；6 条缺读点/结算时机错误暂不切换。",
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
    "games/arkhamhorror/tests/acceptance-09-a-shard8.test.mjs",
    "games/arkhamhorror/tests/tsk-scenario-shadesOfSuffering.test.mjs",
    "games/arkhamhorror/tests/tsk-scenario-congressOfTheKeys.test.mjs",
    "games/arkhamhorror/tests/tsk-shared-encounters-a.test.mjs",
    "games/arkhamhorror/tests/tsk-shared-encounters-b.test.mjs",
    "games/arkhamhorror/tests/tsk-rules.test.mjs",
    "games/arkhamhorror/tests/tsk-primitives-customizable.test.mjs",
    "games/arkhamhorror/tests/tsk-primitives-keys-hollow.test.mjs",
    "games/arkhamhorror/tests/tsk-primitives-state.test.mjs",
    "games/arkhamhorror/tests/tsk-primitives-map.test.mjs",
    "games/arkhamhorror/tests/tsk-interactions.test.mjs",
    "games/arkhamhorror/tests/tsk-p0-regressions.test.mjs",
    "games/arkhamhorror/tests/tsk-p1-regressions.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/09-a-8-acceptance.json",
    module: "src/cards/09-a-8-acceptance.js",
  },
}
