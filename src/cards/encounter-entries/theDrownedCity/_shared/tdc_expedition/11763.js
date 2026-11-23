import { ALL_CARDS } from '../../../_shared.js'

// 11763 外星石板 · 远征剧情资产 · 共享遭遇组 tdc_expedition
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tdc_expedition（CONTRACT §6，印刷 1–4 张）。
// 卡面（cards-data 11763，原文见该卡 textZh）：
//   使用(4秘密)。
//   [fast]在一张[[符文]]或[[拉莱耶]]卡牌上进行技能检定期间，横置外星石板并花费1个秘密：进行本次检定的调查员技能值+2。
//
// 读点（声明即接线）：
//   · 「使用(4 秘密)」= 条目 uses/usesType；
//   · 「在一张符文/拉莱耶卡牌上进行技能检定期间」= reaction + trigger 'test.beforeCommit'
//     （检定开始、投入前）+ duringOwnSkillTest（只能在自己的检定里用），成本 { exhaust: true, uses: 1 }；
//     测试来源卡按 state.skillTest.source.code 取特性（Glyph / R'lyeh）；
//   · 「本次检定的调查员技能值 +2」= api.addPendingTestBonus(2)（检定值待决加值的唯一读点）。
//
// 归属与发放：Setup「每名玩家选择 1 项已获得的文物或远征物品入场」由章节 setup 用
//   api.giveAsset / scenarioRuntime.giveAsset 放到调查员控制下（sepulchreOfTheSleeper/definition.js
//   的 EXPEDITION_ITEM_CODES / EXPEDITION_ALLY_CODES）；giveAsset 走 newCardInstance，不复制条目
//   uses，因此「使用(N)」的初始化由章节/战役侧照抄条目 uses（EotE 08714–08722 同一口径）。

// 卡面特性判定：[[Glyph]]（= 卡文「符文」）/ [[R'lyeh]]（cards-data 的 traits）。
const hasTraits = (code, wanted) => {
  if (!code) return false
  const traits = ALL_CARDS[code]?.traits || []
  return wanted.some(trait => traits.some(value => String(value).toLowerCase() === trait.toLowerCase()))
}

const CODE = '11763'

export default {
  code: CODE,
  name: '外星石板',
  scope: 'storyAsset',
  implemented: true,
  uses: 4,
  usesType: 'secrets',
  flags: { expedition: true, traits: ['Item', 'Relic', "R'lyeh"] },
  abilities: [{
    kind: 'reaction',
    trigger: 'test.beforeCommit',
    duringOwnSkillTest: true,
    label: '[fast] 横置并花费 1 个秘密：本次检定技能值 +2',
    criteria: ({ state }) => hasTraits(state?.skillTest?.source?.code, ['Glyph', "R'lyeh"]),
    cost: { exhaust: true, uses: 1 },
    resolve: ({ inv, api }) => {
      api.addPendingTestBonus(2)
      api.info('🗿 「外星石板」：' + inv.name + ' 在符文/拉莱耶卡牌上的本次检定 +2 技能值。')
    },
  }],
  note: '①「检定期间」用 reaction + trigger test.beforeCommit（检定开始、投入前）+ duringOwnSkillTest；'
    + '②「横置并花费 1 个秘密」= cost { exhaust: true, uses: 1 }；③「技能值 +2」= api.addPendingTestBonus(2)；'
    + '符文/拉莱耶按 cards-data 特性判定（Glyph / R\'lyeh），测试来源卡取 state.skillTest.source。'
    + '发放时「使用(4 秘密)」的初始化仍需章节侧照抄条目 uses（giveAsset 不复制 uses）。',
}
