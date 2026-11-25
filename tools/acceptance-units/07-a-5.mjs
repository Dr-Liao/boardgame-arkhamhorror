// 验收单元 07-a-5：07-a 印斯茅斯暗潮分片 5（Horror in High Gear）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-07-a-印斯茅斯暗潮-分片-5.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-07-a-印斯茅斯暗潮-分片-5.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const code of verdict.pendingCodes || []) if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: 'pending', reason: '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' })
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 42 条记录（hhg）。
const codes = ["07189", "07190", "07191", "07192", "07193", "07194", "07195", "07196", "07197", "07198", "07199", "07199b", "07200", "07201", "07202", "07203", "07204a", "07204b", "07204c", "07205a", "07205b", "07206a", "07206b", "07207a", "07207b", "07208a", "07208b", "07208c", "07209a", "07209b", "07210", "07211a", "07211b", "07212a", "07212b", "07213", "07214", "07215", "07216", "07217", "07218", "07219"]
const codeSet = new Set(codes)

export default {
  id: "07-a-5",
  acceptanceId: "tic-horror-in-high-gear-2026-11",
  exportPrefix: "TIC_SHARD5",
  verifiedFn: "ticShard5CardVerified",
  profile: {
    id: "tic-horror-in-high-gear-2026-11",
    scope: "印斯茅斯暗潮 07 段 Horror in High Gear（hhg，07189–07219）42 条目录记录。41 条通过五维验收；07189 附魔护甲伤害分配被写死为护甲所有者暂不切换。",
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
    "games/arkhamhorror/tests/acceptance-07-a-shard5.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-horrorInHighGear.test.mjs",
    "games/arkhamhorror/tests/tic-middle-remaining.test.mjs",
    "games/arkhamhorror/tests/tic-hybrid-assassin.test.mjs",
    "games/arkhamhorror/tests/tic-catching-up.test.mjs",
    "games/arkhamhorror/tests/tic-chase-vehicles.test.mjs",
    "games/arkhamhorror/tests/tic-car-faces.test.mjs",
    "games/arkhamhorror/tests/tic-vehicle-restrictions.test.mjs",
    "games/arkhamhorror/tests/tic-capture.test.mjs",
    "games/arkhamhorror/tests/tic-enemy-flow.test.mjs",
    "games/arkhamhorror/tests/tic-enemy-movement.test.mjs",
    "games/arkhamhorror/tests/tic-enemy-outcomes.test.mjs",
    "games/arkhamhorror/tests/tic-interactions.test.mjs",
    "games/arkhamhorror/tests/tic-rules.test.mjs",
    "games/arkhamhorror/tests/tic-primitives.test.mjs",
    "games/arkhamhorror/tests/tic-scenarios-middle.test.mjs",
    "games/arkhamhorror/tests/tic-player-guardian-seeker.test.mjs",
    "games/arkhamhorror/tests/tic-player-rogue-mystic.test.mjs",
    "games/arkhamhorror/tests/tic-player-survivor-neutral.test.mjs",
    "games/arkhamhorror/tests/tic-player-primitives.test.mjs",
    "games/arkhamhorror/tests/tic-walking-surcharge.test.mjs",
    "games/arkhamhorror/tests/tic-road-hazards.test.mjs",
    "games/arkhamhorror/tests/tic-physical-faces.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/07-a-5-acceptance.json",
    module: "src/cards/07-a-5-acceptance.js",
  },
}
