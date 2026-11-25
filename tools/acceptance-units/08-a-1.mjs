// 验收单元 08-a-1：08-a 地球边缘分片 1（eoep 调查员与玩家卡 A）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-08-a-地球边缘-分片-1.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-08-a-地球边缘-分片-1.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const code of verdict.pendingCodes || []) if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: 'pending', reason: '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' })
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 46 条记录（eoep）。
const codes = ["08001", "08002", "08003", "08004", "08005", "08006", "08007", "08008", "08009", "08010", "08011a", "08011b", "08012a", "08012b", "08013a", "08013b", "08014a", "08014b", "08015", "08016", "08017", "08018", "08019", "08020", "08021", "08022", "08023", "08024", "08025", "08026", "08027", "08028", "08029", "08030", "08031", "08032", "08033", "08034", "08035", "08036", "08037", "08038", "08039", "08040", "08041", "08042"]
const codeSet = new Set(codes)

export default {
  id: "08-a-1",
  acceptanceId: "eote-player-a-2026-11",
  exportPrefix: "EOTE_SHARD1",
  verifiedFn: "eoteShard1CardVerified",
  profile: {
    id: "eote-player-a-2026-11",
    scope: "地球边缘 08 段 eoep 调查员与玩家卡（08001–08042）46 条目录记录。45 条通过五维验收；08008 因 R1 直写暂不切换。",
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
  expectedCount: 46,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-08-a-shard1.test.mjs",
    "games/arkhamhorror/tests/eote-player-m2-1.test.mjs",
    "games/arkhamhorror/tests/eote-player-m2-2.test.mjs",
    "games/arkhamhorror/tests/eote-player-m2-3.test.mjs",
    "games/arkhamhorror/tests/eote-player-m2-4.test.mjs",
    "games/arkhamhorror/tests/eote-investigator-daniela.test.mjs",
    "games/arkhamhorror/tests/eote-investigator-norman.test.mjs",
    "games/arkhamhorror/tests/eote-investigator-lily.test.mjs",
    "games/arkhamhorror/tests/eote-investigator-monterey.test.mjs",
    "games/arkhamhorror/tests/eote-investigator-bob.test.mjs",
    "games/arkhamhorror/tests/eote-rules.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-frost.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-travel.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-geo.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-investigator.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-campaign.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-flow.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/08-a-1-acceptance.json",
    module: "src/cards/08-a-1-acceptance.js",
  },
}
