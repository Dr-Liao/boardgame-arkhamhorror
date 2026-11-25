// 验收单元 10-a-2：10-a 铁杉谷盛宴分片 2（fhvp 玩家卡 B）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-10-a-铁杉谷盛宴-分片-2.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-10-a-铁杉谷盛宴-分片-2.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const entry of verdict.pendingCodes || []) { const code = typeof entry === 'string' ? entry : entry.code; if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: entry.dimension || 'pending', reason: entry.reason || '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' }) }
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 35 条记录（fhvp）。
const codes = ["10034", "10035", "10036", "10037", "10038", "10039", "10040", "10041", "10042", "10043", "10044", "10045", "10046", "10047", "10048", "10049", "10050", "10051", "10052", "10053", "10054", "10055", "10056", "10057", "10058", "10059", "10060", "10061", "10062", "10063", "10064", "10065", "10066", "10067", "10068"]
const codeSet = new Set(codes)

export default {
  id: "10-a-2",
  acceptanceId: "fhv-player-b-2026-11",
  exportPrefix: "FHV_SHARD2",
  verifiedFn: "fhvShard2CardVerified",
  profile: {
    id: "fhv-player-b-2026-11",
    scope: "铁杉谷盛宴 10 段 fhvp 玩家卡（10034–10068）35 条目录记录。26 条通过五维验收；9 条近似/缺口暂不切换。",
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
  expectedCount: 35,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/fhv-player-m2-1.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-2.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-3.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-4.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-5.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-6.test.mjs",
    "games/arkhamhorror/tests/fhv-rules.test.mjs",
    "games/arkhamhorror/tests/fhv-player-primitives.test.mjs",
    "games/arkhamhorror/tests/fhv-investigator-10001.test.mjs",
    "games/arkhamhorror/tests/fhv-investigator-10004.test.mjs",
    "games/arkhamhorror/tests/fhv-investigator-10009.test.mjs",
    "games/arkhamhorror/tests/fhv-investigator-10012.test.mjs",
    "games/arkhamhorror/tests/fhv-investigator-10015.test.mjs",
    "games/arkhamhorror/tests/fhv-investigator-signatures.test.mjs",
    "games/arkhamhorror/tests/fhv-interactions.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/10-a-2-acceptance.json",
    module: "src/cards/10-a-2-acceptance.js",
  },
}
