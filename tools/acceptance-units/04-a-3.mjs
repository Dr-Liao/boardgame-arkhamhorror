// 验收单元 04-a-3：失落时代分片 3（The Depths of Yoth + Heart of the Elders）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-04-a-失落时代战役卡-分片-3.md / .json（2026-11-24）。
const failed = [
  ['04215', 'primitives', '同一张印刷卡被上下两章各写一份实现（heartOfTheEldersPart1/behavior.js#resolveEncounter vs Part2#resolvePitfall），且失败差值口径不一致（Math.max(0,…) vs Math.max(1,…)），违反「同句规则只写一次」与「口径冲突先裁决」。'],
  ['04216', 'primitives', '同一轮末规则被 Part1 behavior.js#roundEnded 与 Part2#resolvePoisonousSporesEnd 各写一份，条目 04216.js 只有 flags.spores，没有唯一实现。'],
  ['04220', 'implementation', '近似未披露：实现额外要求「场上有蛇怪」，卡面没有该前置条件，且 audit/tfa-migration.json 的 remaining 未登记。'],
  ['04222', 'primitives', 'R1 直写运行时状态：locationRule.beforeExplore 内 `inv.actionsLeft -= 1`（存量基线）。'],
  ['04225', 'primitives', 'R1 直写运行时状态：locationRule.afterTest 内写 `location.doom`（存量基线）。'],
  ['04279', 'primitives', 'R1 直写运行时状态：agendaRule.onReveal 写 `state.scenarioFlags.collectedAStrangeLiquid`（存量基线）。'],
  ['04281', 'primitives', 'R1 直写运行时状态：agendaRule.onReveal 写 `zones.pursuit` / 删除 `zones.harbingerAside`（存量基线）。'],
  ['04282', 'primitives', 'R1 直写运行时状态：agendaRule 写 `zones.setAside` 与 `flags.furyDoom*`（存量基线）。'],
  ['04283', 'primitives', 'R1 直写运行时状态：agendaRule.onReveal 写 `state.scenarioFlags.redDepthsOngoing` 与 `state.scenarioZones.pursuitReminders`（存量基线）。'],
  ['04293', 'primitives', 'R1 直写运行时状态：locationRule.beforeExplore 写 `location.doom`（存量基线）。'],
  ['04299', 'primitives', '未使用已登记原语：应在密谋牌库旁使用 `state.agendaAside` / api.putNextToAgenda，实现自造 `state.scenarioZones.childrenOfValusia` 卡号数组，卡牌无实体实例、无法进入既有密谋旁卡堆 UI。'],
  ['04302', 'primitives', 'R1 直写运行时状态：encounterResolve 写 `zones` / `enemy.damageTaken` / `enemy.engagedSeat` / `inv.engaged`（存量基线）。'],
  ['04303', 'primitives', 'R1 直写运行时状态：free 能力 resolve 写 `state.scenarioFlags.relicOfAgesDoomSucceeded`，并以单卡私有键代替「每场游戏最多一次成功」原语（存量基线）。'],
]

// 本单元范围锁定为审计时的 53 张未验收记录（tdoy 27 + hote 26）；已由 tfaPlayer 账本验收的
// 25 张玩家卡不重复纳入，避免与历史账本重复声明。
const codes = [
  '04205', '04206', '04206b', '04207', '04208', '04209', '04209b', '04210', '04211', '04212',
  '04213', '04214', '04215', '04216', '04217', '04218', '04219', '04220', '04221', '04222',
  '04223', '04224', '04225', '04226', '04227', '04228', '04277', '04278', '04279', '04280',
  '04281', '04282', '04283', '04284', '04285', '04286', '04287', '04288', '04289', '04290',
  '04291', '04292', '04293', '04294', '04295', '04296', '04297', '04298', '04299', '04300',
  '04301', '04302', '04303',
]
const codeSet = new Set(codes)

export default {
  id: '04-a-3',
  acceptanceId: 'tfa-depth-of-yoth-heart-of-the-elders-2026-11',
  exportPrefix: 'TFA_SHARD3',
  verifiedFn: 'tfaShard3CardVerified',
  profile: {
    id: 'tfa-depth-of-yoth-heart-of-the-elders-2026-11',
    scope: '失落时代 04 段 The Depths of Yoth（tdoy，27 条）+ Heart of the Elders（hote，26 条）共 53 条目录记录。40 条通过逐卡实现/原语/交互/证据/合规五维验收；13 条因存量 R1 直写、同句双实现、近似未披露或未用登记原语暂不切换 verified。',
    basis: '独立复核（不采信既有账本）：卡面 → 本地读点 → 原语 → 交互 → 真实执行测试逐卡核对；证据为 tests/acceptance-04-a-shard3.test.mjs 及 tfa-*.test.mjs 的真实用例标题。近似与缺口逐条披露，未声称等价。',
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
  expectedCount: 53,
  failed: failed.map(([code, dimension, reason]) => ({ code, dimension, reason })),
  testFiles: [
    'games/arkhamhorror/tests/acceptance-04-a-shard3.test.mjs',
    'games/arkhamhorror/tests/tfa-depths-of-yoth.test.mjs',
    'games/arkhamhorror/tests/tfa-depths-of-yoth-ending.test.mjs',
    'games/arkhamhorror/tests/tfa-heart-of-the-elders-part1.test.mjs',
    'games/arkhamhorror/tests/tfa-heart-of-the-elders-part2.test.mjs',
  ],
  evidence: {
    forbidTitles: /目录|存在性|可构筑/,
    // 关联面：04209（act 研究图案）的验收证据以背面 04209b 的布置/分区用例承载。
    aliases: { '04209': ['04209b'] },
  },
  outputs: {
    ledger: 'audit/tfa-shard3-acceptance.json',
    module: 'src/cards/tfa-shard3-acceptance.js',
  },
}
