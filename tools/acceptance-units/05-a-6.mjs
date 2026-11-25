// 验收单元 05-a-6：05-a 万象无终分片 6（Union and Disillusion）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-05-a-万象无终-分片-6.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-05-a-万象无终-分片-6.json', import.meta.url), 'utf8'))
const failed = [
  ...verdict.failedCodes.map(({ code, dimension, reason }) => ({ code, dimension, reason })),
  ...(verdict.pendingCodes || []).map(code => ({ code, dimension: 'pending', reason: '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' })),
]

// 范围锁定为审计时未验收的 48 条记录（uad）。
const codes = ["05229", "05230", "05231", "05232", "05233", "05234", "05235", "05236", "05237", "05238", "05239", "05240", "05241", "05242", "05243", "05244", "05245", "05246", "05247", "05248", "05249", "05250", "05251", "05252", "05253", "05254", "05255", "05256", "05257", "05258", "05259", "05260", "05261", "05262", "05262b", "05263", "05263b", "05264", "05264b", "05265", "05265b", "05266", "05267", "05268", "05269", "05270", "05271", "05272"]
const codeSet = new Set(codes)

export default {
  id: "05-a-6",
  acceptanceId: "tcu-union-disillusion-2026-11",
  exportPrefix: "TCU_SHARD6",
  verifiedFn: "tcuShard6CardVerified",
  profile: {
    id: "tcu-union-disillusion-2026-11",
    scope: "万象无终 05 段 Union and Disillusion（uad，05229–05272）48 条目录记录。42 条通过五维验收；6 条因重印未登记/双实现、R1 与触发条件越界暂不切换。",
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
  expectedCount: 48,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-05-a-shard6.test.mjs",
    "games/arkhamhorror/tests/tcu-union-disillusion.test.mjs",
    "games/arkhamhorror/tests/tcu-player-m2-3.test.mjs",
    "games/arkhamhorror/tests/tcu-scenario-hooks.test.mjs",
    "games/arkhamhorror/tests/tcu-chapters-smoke.test.mjs",
    "games/arkhamhorror/tests/tcu-p1-regressions.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/05-a-6-acceptance.json",
    module: "src/cards/05-a-6-acceptance.js",
  },
}
