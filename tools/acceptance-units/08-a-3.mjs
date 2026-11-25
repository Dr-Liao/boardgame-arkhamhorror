// 验收单元 08-a-3：08-a 地球边缘分片 3（eoep 玩家卡 C）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-08-a-地球边缘-分片-3.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-08-a-地球边缘-分片-3.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const code of verdict.pendingCodes || []) if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: 'pending', reason: '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' })
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 45 条记录（eoep）。
const codes = ["08089", "08090", "08091", "08092", "08093", "08094", "08095", "08096", "08097", "08098", "08099", "08100", "08101", "08102", "08103", "08104", "08105", "08106", "08107", "08108", "08109", "08110", "08111", "08112", "08113", "08114", "08115", "08116", "08117", "08118", "08119", "08120", "08121", "08122", "08123", "08124", "08125", "08126", "08127", "08128", "08129", "08130", "08131", "08132", "08133"]
const codeSet = new Set(codes)

export default {
  id: "08-a-3",
  acceptanceId: "eote-player-c-2026-11",
  exportPrefix: "EOTE_SHARD3",
  verifiedFn: "eoteShard3CardVerified",
  profile: {
    id: "eote-player-c-2026-11",
    scope: "地球边缘 08 段 eoep 玩家卡（08089–08133）45 条目录记录。29 条通过五维验收；16 条已披露近似（槽位/替换/窗口近似）暂不切换。",
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
    "games/arkhamhorror/tests/eote-player-m2-3.test.mjs",
    "games/arkhamhorror/tests/eote-player-m2-4.test.mjs",
    "games/arkhamhorror/tests/eote-rules.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-geo.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-frost.test.mjs",
    "games/arkhamhorror/tests/eote-interactions.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/08-a-3-acceptance.json",
    module: "src/cards/08-a-3-acceptance.js",
  },
}
