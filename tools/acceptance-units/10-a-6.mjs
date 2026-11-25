// 验收单元 10-a-6：10-a 铁杉谷盛宴分片 6（fhvc 战役卡 B）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-10-a-铁杉谷盛宴-分片-6.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-10-a-铁杉谷盛宴-分片-6.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const entry of verdict.pendingCodes || []) { const code = typeof entry === 'string' ? entry : entry.code; if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: entry.dimension || 'pending', reason: entry.reason || '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' }) }
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 43 条记录（fhvc）。
const codes = ["10536b", "10537", "10537b", "10538", "10538b", "10539", "10539b", "10540", "10540b", "10541", "10541b", "10542", "10542b", "10543", "10543b", "10544", "10545", "10546", "10547", "10548", "10549", "10550", "10551", "10552", "10553", "10554", "10555", "10556", "10557", "10558", "10559", "10560", "10561", "10562", "10563", "10564", "10565", "10566", "10567", "10568", "10569", "10570", "10571"]
const codeSet = new Set(codes)

export default {
  id: "10-a-6",
  acceptanceId: "fhv-campaign-b-2026-11",
  exportPrefix: "FHV_SHARD6",
  verifiedFn: "fhvShard6CardVerified",
  profile: {
    id: "fhv-campaign-b-2026-11",
    scope: "铁杉谷盛宴 10 段 fhvc 战役卡（10536b–10571）43 条目录记录。28 条通过五维验收；15 条敌人地点每人生/参考卡结构缺口暂不切换。",
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
    "games/arkhamhorror/tests/acceptance-10-a-shard6.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-writtenInRock.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-hemlockHouse.test.mjs",
    "games/arkhamhorror/tests/fhv-rules.test.mjs",
    "games/arkhamhorror/tests/fhv-primitives.test.mjs",
    "games/arkhamhorror/tests/fhv-interactions.test.mjs",
    "games/arkhamhorror/tests/fhv-campaign-flow.test.mjs",
    "games/arkhamhorror/tests/fhv-campaign-engine.test.mjs",
    "games/arkhamhorror/tests/fhv-scenario-blockers.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/10-a-6-acceptance.json",
    module: "src/cards/10-a-6-acceptance.js",
  },
}
