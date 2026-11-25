// 验收单元 09-a-6：09-a 绯红密钥分片 6（tskc 战役卡 C）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-09-a-绯红密钥-分片-6.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-09-a-绯红密钥-分片-6.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const entry of verdict.pendingCodes || []) { const code = typeof entry === 'string' ? entry : entry.code; if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: entry.dimension || 'pending', reason: entry.reason || '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' }) }
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 45 条记录（tskc）。
const codes = ["09584", "09585", "09586a", "09586b", "09586c", "09587", "09588", "09589", "09590a", "09590b", "09591", "09592", "09593", "09594", "09595", "09596", "09597", "09598", "09599", "09600a", "09600b", "09601", "09602", "09603", "09604", "09605", "09606a", "09607a", "09607b", "09608", "09609", "09610", "09611", "09612", "09613", "09614", "09615a", "09615b", "09616", "09617", "09618", "09619", "09620", "09621", "09622"]
const codeSet = new Set(codes)

export default {
  id: "09-a-6",
  acceptanceId: "tsk-campaign-c-2026-11",
  exportPrefix: "TSK_SHARD6",
  verifiedFn: "tskShard6CardVerified",
  profile: {
    id: "tsk-campaign-c-2026-11",
    scope: "绯红密钥 09 段 tskc 战役卡（09584–09622）45 条目录记录。38 条通过五维验收；7 条子句无读点暂不切换。",
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
    "games/arkhamhorror/tests/acceptance-09-a-shard6.test.mjs",
    "games/arkhamhorror/tests/tsk-scenario-riddlesAndRain.test.mjs",
    "games/arkhamhorror/tests/tsk-scenario-dancingMad.test.mjs",
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
    ledger: "audit/09-a-6-acceptance.json",
    module: "src/cards/09-a-6-acceptance.js",
  },
}
