// 验收单元 09-a-3：09-a 绯红密钥分片 3（tskp 玩家卡 C）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-09-a-绯红密钥-分片-3.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-09-a-绯红密钥-分片-3.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const entry of verdict.pendingCodes || []) { const code = typeof entry === 'string' ? entry : entry.code; if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: entry.dimension || 'pending', reason: entry.reason || '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' }) }
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 42 条记录（tskp）。
const codes = ["09087", "09088", "09089", "09090", "09091", "09092", "09093", "09094", "09095", "09096", "09097", "09098", "09099", "09100", "09101", "09102", "09103", "09104", "09105", "09106", "09107", "09108", "09109", "09110", "09111", "09112", "09113", "09114", "09115", "09116", "09117", "09118", "09119", "09120", "09121", "09122", "09123", "09124", "09125", "09126", "09127", "09128"]
const codeSet = new Set(codes)

export default {
  id: "09-a-3",
  acceptanceId: "tsk-player-c-2026-11",
  exportPrefix: "TSK_SHARD3",
  verifiedFn: "tskShard3CardVerified",
  profile: {
    id: "tsk-player-c-2026-11",
    scope: "绯红密钥 09 段 tskp 玩家卡（09087–09128）42 条目录记录。19 条通过五维验收；23 条近似未替换/证据缺口暂不切换。",
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
    "games/arkhamhorror/tests/tsk-player-m2-1.test.mjs",
    "games/arkhamhorror/tests/tsk-player-m2-2.test.mjs",
    "games/arkhamhorror/tests/tsk-player-m2-3.test.mjs",
    "games/arkhamhorror/tests/tsk-player-m2-4.test.mjs",
    "games/arkhamhorror/tests/tsk-investigator-09001.test.mjs",
    "games/arkhamhorror/tests/tsk-investigator-09004.test.mjs",
    "games/arkhamhorror/tests/tsk-investigator-09008.test.mjs",
    "games/arkhamhorror/tests/tsk-investigator-09011.test.mjs",
    "games/arkhamhorror/tests/tsk-investigator-09015.test.mjs",
    "games/arkhamhorror/tests/tsk-investigator-09018.test.mjs",
    "games/arkhamhorror/tests/tsk-investigator-signatures.test.mjs",
    "games/arkhamhorror/tests/tsk-rules.test.mjs",
    "games/arkhamhorror/tests/tsk-primitives-customizable.test.mjs",
    "games/arkhamhorror/tests/tsk-primitives-keys-hollow.test.mjs",
    "games/arkhamhorror/tests/tsk-interactions.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/09-a-3-acceptance.json",
    module: "src/cards/09-a-3-acceptance.js",
  },
}
