// 验收单元 07-a-4：07-a 印斯茅斯暗潮分片 4（Devil Reef）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-07-a-印斯茅斯暗潮-分片-4.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-07-a-印斯茅斯暗潮-分片-4.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const code of verdict.pendingCodes || []) if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: 'pending', reason: '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' })
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 43 条记录（def）。
const codes = ["07152", "07153", "07154", "07155", "07156", "07157", "07158", "07159", "07160", "07161", "07162", "07163", "07164", "07164b", "07165", "07165b", "07166", "07167", "07168", "07169", "07170", "07171", "07172", "07173", "07174a", "07174b", "07175a", "07175b", "07176a", "07176b", "07177a", "07177b", "07178", "07179", "07180", "07181", "07182", "07183", "07184", "07185", "07186", "07187", "07188"]
const codeSet = new Set(codes)

export default {
  id: "07-a-4",
  acceptanceId: "tic-devil-reef-2026-11",
  exportPrefix: "TIC_SHARD4",
  verifiedFn: "ticShard4CardVerified",
  profile: {
    id: "tic-devil-reef-2026-11",
    scope: "印斯茅斯暗潮 07 段 Devil Reef（def，07152–07188）43 条目录记录。41 条通过五维验收；07165b 数值过度实现、07185 触发条件过宽暂不切换。",
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
    "games/arkhamhorror/tests/tic-scenario-devilReef.test.mjs",
    "games/arkhamhorror/tests/tic-middle-remaining.test.mjs",
    "games/arkhamhorror/tests/tic-fishing-vessel.test.mjs",
    "games/arkhamhorror/tests/tic-vehicle-restrictions.test.mjs",
    "games/arkhamhorror/tests/tic-vortex-resign.test.mjs",
    "games/arkhamhorror/tests/tic-walking-surcharge.test.mjs",
    "games/arkhamhorror/tests/tic-player-guardian-seeker.test.mjs",
    "games/arkhamhorror/tests/tic-player-rogue-mystic.test.mjs",
    "games/arkhamhorror/tests/tic-player-survivor-neutral.test.mjs",
    "games/arkhamhorror/tests/tic-flashbacks.test.mjs",
    "games/arkhamhorror/tests/tic-scenarios-middle.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-shared-encounters.test.mjs",
    "games/arkhamhorror/tests/tic-rules.test.mjs",
    "games/arkhamhorror/tests/tic-primitives.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/07-a-4-acceptance.json",
    module: "src/cards/07-a-4-acceptance.js",
  },
}
