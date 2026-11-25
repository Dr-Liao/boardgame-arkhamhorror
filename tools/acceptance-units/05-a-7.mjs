// 验收单元 05-a-7：05-a 万象无终分片 7（In the Clutches of Chaos）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-05-a-万象无终-分片-7.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-05-a-万象无终-分片-7.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const code of verdict.pendingCodes || []) if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: 'pending', reason: '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' })
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 42 条记录（icc）。
const codes = ["05273", "05274", "05275", "05276", "05277", "05278", "05279", "05280", "05281", "05282", "05283", "05284", "05285", "05286a", "05286b", "05287", "05288a", "05288b", "05289", "05290", "05291", "05292", "05293", "05294", "05295", "05296", "05297", "05298", "05299", "05300", "05301", "05302", "05303", "05304", "05305", "05306", "05307", "05308", "05309", "05310", "05311", "05312"]
const codeSet = new Set(codes)

export default {
  id: "05-a-7",
  acceptanceId: "tcu-clutches-of-chaos-2026-11",
  exportPrefix: "TCU_SHARD7",
  verifiedFn: "tcuShard7CardVerified",
  profile: {
    id: "tcu-clutches-of-chaos-2026-11",
    scope: "万象无终 05 段 In the Clutches of Chaos（icc，05273–05312）42 条目录记录。33 条通过五维验收；2 条 R1、7 条 [fast] 时机近似未披露暂不切换。",
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
    "games/arkhamhorror/tests/acceptance-05-a-shard7.test.mjs",
    "games/arkhamhorror/tests/tcu-clutches-chaos.test.mjs",
    "games/arkhamhorror/tests/tcu-p1-regressions.test.mjs",
    "games/arkhamhorror/tests/tcu-location-api.test.mjs",
    "games/arkhamhorror/tests/tcu-player-m2-3.test.mjs",
    "games/arkhamhorror/tests/tcu-player-m2-4.test.mjs",
    "games/arkhamhorror/tests/play-channels.test.mjs",
    "games/arkhamhorror/tests/card-entries.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/05-a-7-acceptance.json",
    module: "src/cards/05-a-7-acceptance.js",
  },
}
