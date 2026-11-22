// 60475 仪式匕首（Ritual Dagger，Marie Lambeau，3 XP）
// 卡面：[action]：攻击（[combat]）。本次攻击将你的[willpower]加入你的[combat]。
//       [reaction] 你打出一张[[法术]]事件后，受到 1 点伤害并横置仪式匕首：不弃掉该事件，改为将其洗回你的牌库。
import { ownSeat } from '../../engine/matcher.js'
import { ALL_CARDS } from '../cards-data.js'
import { attackableEnemies } from './_shared.js'

export default {
  code: '60475',
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      label: '攻击：战斗 + 意志',
      cost: { action: true },
      resolve: ({ state, inv, source, api }) => {
        const targets = attackableEnemies(state, inv)
        if (!targets.length) {
          api.info('没有可攻击的敌人。')
          return
        }
        const chosen = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: '60475', seat: inv.seat,
          prompt: '选择攻击目标。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        api.fight(inv.seat, enemy.id, {
          assetId: source.id, addSkill: 'willpower', noSpend: true, sourceCode: '60475',
        })
      },
    },
    {
      kind: 'reaction',
      trigger: 'eventPlayed',
      label: '打出法术事件后：受到 1 伤害并横置，把该事件洗回牌库',
      cost: { exhaust: true },
      criteria: [ownSeat(), ({ context }) => {
        const code = context?.cardCode || context?.code
        const card = code ? ALL_CARDS[code] : null
        return Boolean(card) && card.type === 'event'
          && (card.traits || []).some(trait => String(trait).toLowerCase() === 'spell')
      }],
      resolve: ({ inv, api }) => {
        api.damage(inv.seat, 1)
        api.shufflePlayedCardBack()
      },
    },
  ],
}
