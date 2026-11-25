// 验收单元 05-a-3：05-a 万象无终分片 3（The Secret Name）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-05-a-万象无终-分片-3.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-05-a-万象无终-分片-3.json', import.meta.url), 'utf8'))
const failed = verdict.failedCodes.map(({ code, dimension, reason }) => ({ code, dimension, reason }))

// 范围锁定为审计时未验收的 42 条记录（tsn）。
const codes = ["05109", "05110", "05111", "05112", "05113", "05114", "05115", "05116", "05117", "05118", "05119", "05120", "05121", "05122", "05123", "05124", "05125", "05126", "05127", "05128", "05129", "05130", "05131", "05132", "05133", "05134", "05135", "05136", "05137", "05138", "05139", "05140", "05141", "05142", "05143", "05144", "05145", "05146", "05147", "05148", "05149", "05150"]
const codeSet = new Set(codes)

export default {
  id: "05-a-3",
  acceptanceId: "tcu-secret-name-2026-11",
  exportPrefix: "TCU_SHARD3",
  verifiedFn: "tcuShard3CardVerified",
  profile: {
    id: "tcu-secret-name-2026-11",
    scope: "万象无终 05 段 The Secret Name（tsn，05109–05150）42 条目录记录。39 条通过五维验收；3 条因同句检索规则重复手写暂不切换。",
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
  expectedCount: 42,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-05-a-shard3.test.mjs",
    "games/arkhamhorror/tests/tcu-secret-name.test.mjs",
    "games/arkhamhorror/tests/tcu-player-m2-2.test.mjs",
    "games/arkhamhorror/tests/tcu-p0-regressions.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/05-a-3-acceptance.json",
    module: "src/cards/05-a-3-acceptance.js",
  },
}
