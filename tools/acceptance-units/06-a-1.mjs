// 验收单元 06-a-1：06-a 食梦者分片 1（tde 豪华包前半）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-06-a-食梦者-分片-1.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-06-a-食梦者-分片-1.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const code of verdict.pendingCodes || []) if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: 'pending', reason: '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' })
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 57 条记录（tde）。
const codes = ["06001", "06002", "06003", "06004", "06005", "06006", "06007", "06008", "06009", "06010", "06011", "06012", "06013", "06014", "06015a", "06015b", "06016", "06017", "06018", "06019", "06020", "06021", "06022", "06023", "06024", "06025", "06026", "06027", "06028", "06029", "06030", "06031", "06032", "06033", "06034", "06035", "06036", "06037", "06038", "06039", "06040", "06041", "06042", "06043", "06044", "06045", "06046", "06047", "06048", "06049", "06050", "06051", "06052", "06053", "06054", "06055", "06056"]
const codeSet = new Set(codes)

export default {
  id: "06-a-1",
  acceptanceId: "tde-beyond-gates-a-2026-11",
  exportPrefix: "TDE_SHARD1",
  verifiedFn: "tdeShard1CardVerified",
  profile: {
    id: "tde-beyond-gates-a-2026-11",
    scope: "食梦者 06 段 tde 豪华包前半（06001–06056）57 条目录记录。53 条通过五维验收；4 条因进入限制/动态帷幕规则键未接线暂不切换。",
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
  expectedCount: 57,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-06-a-shard1.test.mjs",
    "games/arkhamhorror/tests/tde-investigators.test.mjs",
    "games/arkhamhorror/tests/tde-player-m2-1.test.mjs",
    "games/arkhamhorror/tests/tde-player-m2-2.test.mjs",
    "games/arkhamhorror/tests/tde-player-m2-3.test.mjs",
    "games/arkhamhorror/tests/tde-player-m2-4.test.mjs",
    "games/arkhamhorror/tests/tde-campaign-card-acceptance.test.mjs",
    "games/arkhamhorror/tests/tde-rules.test.mjs",
    "games/arkhamhorror/tests/tde-scenario-beyondTheGatesOfSleep.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/06-a-1-acceptance.json",
    module: "src/cards/06-a-1-acceptance.js",
  },
}
