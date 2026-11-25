// 验收单元 12-a-5：12-a 2026 核心盒分片 5（战役侧 B）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-12-a-2026核心盒-分片-5.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-12-a-2026核心盒-分片-5.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const entry of verdict.pendingCodes || []) { const code = typeof entry === 'string' ? entry : entry.code; if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: entry.dimension || 'pending', reason: entry.reason || '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' }) }
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 36 条记录（core_2026）。
const codes = ["12161", "12162", "12163", "12164", "12165", "12166", "12167", "12168", "12169", "12170", "12171", "12172", "12173", "12174", "12175", "12176", "12177", "12178", "12179", "12179b", "12180", "12181", "12182", "12183", "12184", "12185", "12186", "12187", "12188", "12189", "12190", "12191", "12192", "12193", "12194", "12195"]
const codeSet = new Set(codes)

export default {
  id: "12-a-5",
  acceptanceId: "core2026-campaign-b-2026-11",
  exportPrefix: "CORE2026_SHARD5",
  verifiedFn: "core2026Shard5CardVerified",
  profile: {
    id: "core2026-campaign-b-2026-11",
    scope: "2026 核心盒 12 段战役侧（12161–12195）36 条目录记录。36 条全部因批次 4 未迁移判实现完整性失败。",
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
  expectedCount: 36,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/starter-batch-3.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/12-a-5-acceptance.json",
    module: "src/cards/12-a-5-acceptance.js",
  },
}
