// 验收单元 11-a-2：11-a 沉没之城分片 2（tdcp 玩家卡 B）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-11-a-沉没之城-分片-2.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-11-a-沉没之城-分片-2.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const entry of verdict.pendingCodes || []) { const code = typeof entry === 'string' ? entry : entry.code; if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: entry.dimension || 'pending', reason: entry.reason || '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' }) }
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 44 条记录（tdcp）。
const codes = ["11045", "11046", "11047", "11048", "11049", "11050", "11051", "11052", "11053", "11054", "11055", "11056", "11057", "11058", "11059", "11060", "11061", "11062", "11063", "11064", "11065", "11066", "11067", "11068a", "11068b", "11069", "11070", "11071", "11072", "11073", "11074", "11075", "11076", "11077", "11078", "11079", "11080", "11081", "11082", "11083", "11084", "11085", "11086", "11087"]
const codeSet = new Set(codes)

export default {
  id: "11-a-2",
  acceptanceId: "tdc-player-b-2026-11",
  exportPrefix: "TDC_SHARD2",
  verifiedFn: "tdcShard2CardVerified",
  profile: {
    id: "tdc-player-b-2026-11",
    scope: "沉没之城 11 段 tdcp 玩家卡（11045–11087）44 条目录记录。44 条全部通过五维验收。",
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
  expectedCount: 44,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/tdc-player.test.mjs",
    "games/arkhamhorror/tests/tdc-player-guardian.test.mjs",
    "games/arkhamhorror/tests/tdc-player-seeker.test.mjs",
    "games/arkhamhorror/tests/tdc-player-survivor.test.mjs",
    "games/arkhamhorror/tests/tdc-investigators.test.mjs",
    "games/arkhamhorror/tests/tdc-rules.test.mjs",
    "games/arkhamhorror/tests/tdc-primitives.test.mjs",
    "games/arkhamhorror/tests/tdc-round2-primitives.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/11-a-2-acceptance.json",
    module: "src/cards/11-a-2-acceptance.js",
  },
}
