// 验收单元 07-a-6：07-a 印斯茅斯暗潮分片 6（A Light in the Fog）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-07-a-印斯茅斯暗潮-分片-6.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-07-a-印斯茅斯暗潮-分片-6.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const code of verdict.pendingCodes || []) if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: 'pending', reason: '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' })
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 42 条记录（lif）。
const codes = ["07220", "07221", "07222", "07223", "07224", "07225", "07226", "07227", "07228", "07229", "07230", "07231", "07232", "07233", "07234", "07235", "07236", "07237", "07238", "07239", "07240", "07241", "07242", "07243", "07244", "07245", "07246", "07247", "07248", "07249", "07250", "07251", "07252", "07252b", "07253", "07254", "07255", "07256", "07257", "07258", "07259", "07260"]
const codeSet = new Set(codes)

export default {
  id: "07-a-6",
  acceptanceId: "tic-light-in-the-fog-2026-11",
  exportPrefix: "TIC_SHARD6",
  verifiedFn: "ticShard6CardVerified",
  profile: {
    id: "tic-light-in-the-fog-2026-11",
    scope: "印斯茅斯暗潮 07 段 A Light in the Fog（lif，07220–07260）42 条目录记录。42 条全部通过五维验收（两处显式披露近似）。",
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
    "games/arkhamhorror/tests/acceptance-07-a-shard6.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-aLightInTheFog.test.mjs",
    "games/arkhamhorror/tests/tic-scenarios-light-in-the-fog.test.mjs",
    "games/arkhamhorror/tests/tic-late-b-cards.test.mjs",
    "games/arkhamhorror/tests/tic-scenarios-late.test.mjs",
    "games/arkhamhorror/tests/tic-capture.test.mjs",
    "games/arkhamhorror/tests/tic-w2-new-cards.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-shared-encounters.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-reference-moving.test.mjs",
    "games/arkhamhorror/tests/tic-scenarios-a1.test.mjs",
    "games/arkhamhorror/tests/tic-flashbacks.test.mjs",
    "games/arkhamhorror/tests/tic-alight-cards.test.mjs",
    "games/arkhamhorror/tests/tic-player-guardian-seeker.test.mjs",
    "games/arkhamhorror/tests/tic-player-rogue-mystic.test.mjs",
    "games/arkhamhorror/tests/tic-player-survivor-neutral.test.mjs",
    "games/arkhamhorror/tests/tic-player-primitives.test.mjs",
    "games/arkhamhorror/tests/tic-interactions.test.mjs",
    "games/arkhamhorror/tests/tic-rules.test.mjs",
    "games/arkhamhorror/tests/tic-primitives.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/07-a-6-acceptance.json",
    module: "src/cards/07-a-6-acceptance.js",
  },
}
