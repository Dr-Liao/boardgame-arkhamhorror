// 验收单元 07-a-7：07-a 印斯茅斯暗潮分片 7（The Lair of Dagon）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-07-a-印斯茅斯暗潮-分片-7.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-07-a-印斯茅斯暗潮-分片-7.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const code of verdict.pendingCodes || []) if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: 'pending', reason: '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' })
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 42 条记录（lod）。
const codes = ["07261", "07262", "07263", "07264", "07265", "07266", "07267", "07268", "07269", "07270", "07271", "07272", "07273", "07274", "07275", "07276", "07277", "07278", "07279", "07280", "07281", "07282", "07283", "07284", "07285", "07286", "07287", "07288", "07289", "07290", "07291", "07292a", "07292b", "07293", "07294", "07295", "07296", "07297", "07298", "07299", "07300", "07300b"]
const codeSet = new Set(codes)

export default {
  id: "07-a-7",
  acceptanceId: "tic-lair-of-dagon-2026-11",
  exportPrefix: "TIC_SHARD7",
  verifiedFn: "ticShard7CardVerified",
  profile: {
    id: "tic-lair-of-dagon-2026-11",
    scope: "印斯茅斯暗潮 07 段 The Lair of Dagon（lod，07261–07300b）42 条目录记录。37 条通过五维验收；5 条因同句模板三份手写或展示契约未接线暂不切换。",
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
    "games/arkhamhorror/tests/acceptance-07-a-shard7.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-theLairOfDagon.test.mjs",
    "games/arkhamhorror/tests/tic-late-b-cards.test.mjs",
    "games/arkhamhorror/tests/tic-scenarios-late.test.mjs",
    "games/arkhamhorror/tests/tic-player-guardian-seeker.test.mjs",
    "games/arkhamhorror/tests/tic-player-rogue-mystic.test.mjs",
    "games/arkhamhorror/tests/tic-player-survivor-neutral.test.mjs",
    "games/arkhamhorror/tests/tic-scenario-reference-printed.test.mjs",
    "games/arkhamhorror/tests/tic-slumbering-bosses.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/07-a-7-acceptance.json",
    module: "src/cards/07-a-7-acceptance.js",
  },
}
