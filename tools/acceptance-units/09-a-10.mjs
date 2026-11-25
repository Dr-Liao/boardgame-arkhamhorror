// 验收单元 09-a-10：09-a 绯红密钥分片 10（tskc 战役卡 G）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-09-a-绯红密钥-分片-10.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-09-a-绯红密钥-分片-10.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const entry of verdict.pendingCodes || []) { const code = typeof entry === 'string' ? entry : entry.code; if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: entry.dimension || 'pending', reason: entry.reason || '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' }) }
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 41 条记录（tskc）。
const codes = ["09737", "09738", "09739", "09740", "09741", "09742", "09743", "09744", "09745", "09746", "09747a", "09747b", "09747c", "09748a", "09748b", "09749a", "09749b", "09750", "09751", "09752", "09753", "09754", "09755", "09756", "09757", "09758", "09759", "09760", "09761", "09762", "09763", "09764", "09765", "09766", "09767", "09768a", "09768b", "09769a", "09769b", "09770a", "09770b"]
const codeSet = new Set(codes)

export default {
  id: "09-a-10",
  acceptanceId: "tsk-campaign-g-2026-11",
  exportPrefix: "TSK_SHARD10",
  verifiedFn: "tskShard10CardVerified",
  profile: {
    id: "tsk-campaign-g-2026-11",
    scope: "绯红密钥 09 段 tskc 战役卡（09737–09770b）41 条目录记录。23 条通过五维验收；17 条实现缺口、1 条待稳定探针暂不切换。",
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
  expectedCount: 41,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-09-a-shard10.test.mjs",
    "games/arkhamhorror/tests/tsk-shared-encounters-a.test.mjs",
    "games/arkhamhorror/tests/tsk-shared-encounters-b.test.mjs",
    "games/arkhamhorror/tests/tsk-scenario-shadesOfSuffering.test.mjs",
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
    ledger: "audit/09-a-10-acceptance.json",
    module: "src/cards/09-a-10-acceptance.js",
  },
}
