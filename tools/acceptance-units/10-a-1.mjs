// 验收单元 10-a-1：10-a 铁杉谷盛宴分片 1（fhvp 调查员与玩家卡 A）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-10-a-铁杉谷盛宴-分片-1.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-10-a-铁杉谷盛宴-分片-1.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const entry of verdict.pendingCodes || []) { const code = typeof entry === 'string' ? entry : entry.code; if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: entry.dimension || 'pending', reason: entry.reason || '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' }) }
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 35 条记录（fhvp）。
const codes = ["10001", "10002", "10003", "10004", "10005", "10005b", "10006", "10007", "10008", "10009", "10010", "10011", "10012", "10013", "10014", "10015", "10016a", "10016b", "10017", "10018", "10019", "10020", "10021", "10022", "10023", "10024", "10025", "10026", "10027", "10028", "10029", "10030", "10031", "10032", "10033"]
const codeSet = new Set(codes)

export default {
  id: "10-a-1",
  acceptanceId: "fhv-player-a-2026-11",
  exportPrefix: "FHV_SHARD1",
  verifiedFn: "fhvShard1CardVerified",
  profile: {
    id: "fhv-player-a-2026-11",
    scope: "铁杉谷盛宴 10 段 fhvp 调查员与玩家卡（10001–10033）35 条目录记录。33 条通过五维验收；10016a/b 反应缺 per-window limit（P1-12）暂不切换。",
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
    "games/arkhamhorror/tests/acceptance-10-a-shard1.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-1.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-2.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-3.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-4.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-5.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-6.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-7.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-8.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-9.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-10.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-11.test.mjs",
    "games/arkhamhorror/tests/fhv-player-m2-12.test.mjs",
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
    ledger: "audit/10-a-1-acceptance.json",
    module: "src/cards/10-a-1-acceptance.js",
  },
}
