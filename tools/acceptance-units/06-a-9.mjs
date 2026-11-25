// 验收单元 06-a-9：06-a 食梦者分片 9（Weaver of the Cosmos）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-06-a-食梦者-分片-9.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-06-a-食梦者-分片-9.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const code of verdict.pendingCodes || []) if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: 'pending', reason: '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' })
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 32 条记录（woc）。
const codes = ["06323", "06324", "06325", "06326", "06327", "06328", "06329", "06330", "06331", "06332", "06333", "06334", "06335", "06336", "06337", "06338", "06339", "06340", "06341", "06342", "06343", "06344", "06345", "06346", "06347", "06348", "06349", "06350", "06351", "06352", "06353", "06354"]
const codeSet = new Set(codes)

export default {
  id: "06-a-9",
  acceptanceId: "tde-weaver-of-the-cosmos-2026-11",
  exportPrefix: "TDE_SHARD9",
  verifiedFn: "tdeShard9CardVerified",
  profile: {
    id: "tde-weaver-of-the-cosmos-2026-11",
    scope: "食梦者 06 段 Weaver of the Cosmos（woc，06323–06354）32 条目录记录。25 条通过五维验收；7 条因冗余/未接线死声明或 actRule 被行为卡号分支绕过暂不切换。",
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
  expectedCount: 32,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-06-a-shard9.test.mjs",
    "games/arkhamhorror/tests/tde-scenario-weaverOfTheCosmos.test.mjs",
    "games/arkhamhorror/tests/tde-player-m2-4.test.mjs",
    "games/arkhamhorror/tests/tde-rules.test.mjs",
    "games/arkhamhorror/tests/tde-campaign-card-acceptance.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/06-a-9-acceptance.json",
    module: "src/cards/06-a-9-acceptance.js",
  },
}
