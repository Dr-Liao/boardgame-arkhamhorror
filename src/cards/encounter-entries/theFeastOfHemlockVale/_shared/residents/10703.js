// 10703 海伦·彼得斯 · 剧情资产（居民 · 长女）（theFeastOfHemlockVale/_shared/residents）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   (Day [day]) you get +1 [combat]. (Night [night]) you get +1 [agility].
//   [reaction] After you enter a location, exhaust Helen Peters and deal 1 damage to her: Choose a
//     non-[[Elite]] enemy at your location and automatically evade it.
// 归属：战役共用 · theFeastOfHemlockVale/_shared/residents（Residents 遭遇组）。本卡是「战役发放的牌组资产」：
//   序曲 1「把海伦·彼得斯加入你的牌组，不计入牌组张数」，因此声明 scenarioPlayable（引擎读点
//   src/engine/stats.js#runtimeCardAvailable；费用 3 / 盟友槽 / 技能图标取自 cards-data）。
//
// 读点（声明即接线）：
//   · (Day)/(Night) 修正 = modifiers 的 condition: duringPeriod（src/engine/matcher.js；时段来自
//     scenario-calendar.js，唯一时段读点），同一份印刷事实另存 flags；
//   · 「你进入一个地点后」= moveBeforeEngage 窗口（movement.js：进入地点后、自动交战前开窗，
//     context 带 seat/location/enemies，唯一读点）；
//   · 「横置 + 对她造成 1 点伤害」= cost.exhaust + cost.assetDamage（引擎既有费用键，付不起或被弃置时不出现）；
//   · 「自动躲避一个非[[精英]]敌人」= api.autoEvadeEnemy（enemies.js 的 autoEvadeEnemy 读点）。
import { duringPeriod } from '../../../../../engine/matcher.js'

const CODE = '10703'
const NAME = '海伦·彼得斯'

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  scenarioPlayable: true,
  flags: {
    deckPlayable: true,
    cost: 3,
    slot: 'ally',
    traits: ['Ally', 'Hunter'],
    daySkillBonus: { combat: 1 },
    nightSkillBonus: { agility: 1 },
  },
  modifiers: [
    { target: 'skill:combat', amount: 1, condition: { when: duringPeriod('day') } },
    { target: 'skill:agility', amount: 1, condition: { when: duringPeriod('night') } },
  ],
  abilities: [{
    kind: 'reaction',
    trigger: 'moveBeforeEngage',
    label: '你进入地点后，横置海伦并对她造成 1 点伤害：自动躲避此地一个非[[精英]]敌人',
    cost: { exhaust: true, assetDamage: 1 },
    criteria: [({ inv, context }) => context?.seat === inv.seat && (context.enemies || []).length > 0],
    resolve: ({ state, inv, context, api }) => {
      const candidates = (context.enemies || [])
        .map(id => (state.enemies || []).find(enemy => enemy.id === id))
        .filter(enemy => enemy && !enemy.elite)
      if (!candidates.length) return false
      const picked = candidates.length === 1 ? candidates[0] : candidates.find(enemy => String(enemy.id) === String(api.choice({
        kind: 'enemy', source: CODE, seat: inv.seat,
        prompt: '「海伦·彼得斯」：选择要自动躲避的非精英敌人。',
        options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.code })),
      }))) || candidates[0]
      api.autoEvadeEnemy(picked)
      api.info?.(`🛡️ 「海伦·彼得斯」：自动躲避「${picked.name || picked.code}」。`)
      return true
    },
  }],
  note: '近似：「进入地点后」用 moveBeforeEngage 窗口（进入地点后、自动交战前；只有该地有敌人时才有实际效果），'
    + '因此没有敌人时不会提问。「对她造成 1 点伤害」用能力的 assetDamage 费用（引擎既有费用键）。',
}
