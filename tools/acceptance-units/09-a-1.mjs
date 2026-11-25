// 验收单元 09-a-1：09-a 绯红密钥分片 1（tskp 调查员与玩家卡 A）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-09-a-绯红密钥-分片-1.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-09-a-绯红密钥-分片-1.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const entry of verdict.pendingCodes || []) { const code = typeof entry === 'string' ? entry : entry.code; if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: entry.dimension || 'pending', reason: entry.reason || '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' }) }
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 43 条记录（tskp）。
const codes = ["09001", "09002", "09003", "09004", "09005", "09006", "09007", "09008", "09009", "09010", "09011", "09012", "09013", "09014", "09015", "09016", "09017", "09018", "09019", "09020", "09021", "09022", "09023", "09024", "09025", "09026", "09027", "09028", "09029", "09030", "09031", "09032", "09033", "09034", "09035", "09036", "09037", "09038", "09039", "09040", "09041", "09042", "09043"]
const codeSet = new Set(codes)

export default {
  id: "09-a-1",
  acceptanceId: "tsk-player-a-2026-11",
  exportPrefix: "TSK_SHARD1",
  verifiedFn: "tskShard1CardVerified",
  profile: {
    id: "tsk-player-a-2026-11",
    scope: "绯红密钥 09 段 tskp 调查员与玩家卡（09001–09043）43 条目录记录。42 条通过五维验收；1 条近似/缺口暂不切换。",
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
    "games/arkhamhorror/tests/acceptance-09-a-shard1.test.mjs",
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
    "games/arkhamhorror/tests/tsk-p0-regressions.test.mjs",
    "games/arkhamhorror/tests/tsk-p1-regressions.test.mjs",
    "games/arkhamhorror/tests/tsk-p8-customization.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/09-a-1-acceptance.json",
    module: "src/cards/09-a-1-acceptance.js",
  },
}
