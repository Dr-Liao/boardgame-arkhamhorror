// 10715 珀尔日记 · 剧情资产（传家宝 · 悲怆记录）（theFeastOfHemlockVale/_shared/heirlooms）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   (Day [day]) You get +1 [intellect]. (Night [night]) You get +1 [willpower].
//   [reaction] After an investigator at your location draws a [[Blight]] or [[Power]] card from the
//     encounter deck, exhaust The Pearl Diary: That investigator draws 1 card.
// 归属：战役共用 · theFeastOfHemlockVale/_shared/heirlooms（Heirlooms 遭遇组）。
// 获得条件：序曲 2 结局 2（「Any one investigator may choose to add The Pearl Diary story asset to their
//   deck.」）→ 由战役写进战役牌组记录后才能在牌组里打出，因此声明 scenarioPlayable
//   （引擎读点 src/engine/stats.js#runtimeCardAvailable）。费用 1 / 手槽 / 特性 [[道具]][[书籍]] / 独特 来自 cards-data。
//
// 读点（声明即接线）：
//   · (Day)/(Night) 修正 = duringPeriod 条件修正（src/engine/matcher.js；时段唯一来源
//     src/engine/scenario-calendar.js，modifierTotal 统一叠加）；
//   · 「此地的调查员抽取遭遇牌库卡牌后」= encounterDrawn 窗口（encounter.js 的唯一派发点，
//     context 带 seat / location / cardCode）；
//   · 「[[枯疫]]或[[力量]]」= 章节 definition 里已展开的 encounterDefinitions.traits（只读，不抄第二份卡表）；
//   · 「横置」= cost.exhaust；「该调查员抽 1 张」= api.drawCards(context.seat, 1)。
import { duringPeriod } from '../../../../../engine/matcher.js'

const CODE = '10715'
const NAME = '珀尔日记'
const MATCH_TRAITS = Object.freeze(['blight', 'power'])

/** 抽到的那张遭遇卡的印刷特性（章节 definition 的 encounterDefinitions 已带 traits）。 */
function traitsOf(state, code) {
  if (!code) return []
  const declared = state?.scenario?.treacheries?.[code]?.traits
    || state?.scenario?.enemies?.[code]?.traits
  return (declared || []).map(trait => String(trait).toLowerCase())
}

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  scenarioPlayable: true,
  flags: {
    heirloom: true,
    cost: 1,
    slot: 'hand',
    traits: ['Item', 'Tome'],
    unique: true,
    daySkillBonus: { intellect: 1 },
    nightSkillBonus: { willpower: 1 },
    reactionTraits: [...MATCH_TRAITS],
  },
  modifiers: [
    { target: 'skill:intellect', amount: 1, condition: { when: duringPeriod('day') } },
    { target: 'skill:willpower', amount: 1, condition: { when: duringPeriod('night') } },
  ],
  abilities: [{
    kind: 'reaction',
    trigger: 'encounterDrawn',
    label: '你所在地点的调查员抽到[[枯疫]]或[[力量]]卡牌后，横置珀尔日记：该调查员抽 1 张卡牌',
    cost: { exhaust: true },
    criteria: [({ state, inv, context }) => {
      if (context?.seat == null) return false
      const owner = state.investigators?.[context.seat]
      if (!owner || owner.location !== inv.location) return false
      return traitsOf(state, context.cardCode).some(trait => MATCH_TRAITS.includes(trait))
    }],
    resolve: ({ context, api }) => {
      api.drawCards(context.seat, 1)
      api.info?.(`📓 「珀尔日记」：${context.cardCode} 带有[[枯疫]]/[[力量]]，${context.seat + 1} 号调查员抽 1 张。`)
      return true
    },
  }],
  note: '特性判定只读章节已声明的 encounterDefinitions.traits（不抄第二份卡表）：若某章节没有把该遭遇卡写进 '
    + 'scenario.treacheries / scenario.enemies，本条目对该卡不触发（fail-closed）。横置费由费用管线支付，付不起时不出现该反应。',
}
