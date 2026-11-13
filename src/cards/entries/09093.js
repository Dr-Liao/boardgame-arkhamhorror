// 09093 月光仪式（Moonlight Ritual）· 秘术师事件 · 2 经验。
// 卡面：快速。只能在你回合期间打出。移除你所在地点一张非[[精英]]卡牌上所有的毁灭标记。
//
// 读点：api.clearDoomOnCard（任意卡牌上的毁灭唯一移除写点）；候选包括同地点非精英敌人、
// 同地点调查员控制的支援/威胁区卡、所在地点本身。
import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '09093',
  playCondition: [{ when: ownTurn(), message: '「月光仪式」只能在你回合期间打出' }],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '移除你所在地点一张非精英卡牌上所有毁灭标记',
      resolve: ({ state, inv, api }) => {
        const candidates = []
        for (const enemy of state.enemies) {
          if (enemy.location === inv.location && !enemy.elite && (enemy.doom || 0) > 0) {
            candidates.push({ id: `enemy:${enemy.id}`, label: `敌人「${enemy.name || enemy.code}」（毁灭 ${enemy.doom}）`, card: enemy })
          }
        }
        for (const owner of state.investigators.filter(other => other.location === inv.location && !other.defeated && !other.resigned)) {
          for (const card of [...(owner.assets || []), ...(owner.threat || [])]) {
            if ((card.doom || 0) > 0) candidates.push({ id: `card:${card.id}`, label: `「${api.cardName(card.code)}」（毁灭 ${card.doom}）`, card })
          }
        }
        const location = state.locations.find(item => item.id === inv.location)
        if ((location?.doom || 0) > 0) candidates.push({ id: `location:${location.id}`, label: `地点「${location.name}」`, card: location })
        if (!candidates.length) {
          api.info('「月光仪式」：你所在地点没有带毁灭标记的非精英卡牌。')
          return
        }
        const picked = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: '09093', seat: inv.seat,
          prompt: '选择要移除所有毁灭标记的卡牌。',
          options: candidates.map(item => ({ id: item.id, label: item.label })),
        })
        const target = candidates.find(item => item.id === picked) || candidates[0]
        const removed = api.clearDoomOnCard(target.card)
        api.info(`🌙 「月光仪式」：移除「${target.label}」上的 ${removed} 个毁灭标记。`)
      },
    },
  ],
  modifiers: [],
}
