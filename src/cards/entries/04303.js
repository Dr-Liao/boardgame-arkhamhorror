// 04303 古代遗物（升级版）
// 卡面：[free]横置古代遗物：检定[意志]或[智识](4)。如果你检定成功，移除场上任一卡牌上的 1 个毁灭标记。
// （每场游戏最多一次成功。）
//
// 一张卡一个文件：这张卡的行为只在这里维护。

import { limitUsed, markLimitUsed } from '../../engine/limits.js'

const successfulUse = { id: '04303:remove-doom', limit: { scope: 'perGame', owner: 'group', count: 1 } }

function used(state, inv) {
  return state.scenarioFlags?.relicOfAgesDoomSucceeded || limitUsed(state, inv, successfulUse)
}

function targetsWithDoom(state) {
  const investigatorCards = state.investigators.flatMap(inv => [...(inv.assets || []), ...(inv.threat || [])])
  const cards = [...state.enemies, ...state.locations, ...(state.agendaAside || []), ...investigatorCards,
    state.agendas?.[state.agendaIndex], state.acts?.[state.actIndex], ...(state.storyAssets || [])]
  return [...new Set(cards)].filter(card => (card?.doom || 0) > 0)
}

export default {
  code: '04303',
  scenarioPlayable: true,
  abilities: [
    {
      kind: 'free', label: '横置：意志/智识(4)，成功移除任一卡牌上的 1 毁灭',
      cost: { action: false, exhaust: true },
      criteria: ({ state, inv }) => !used(state, inv) && ((state.doom || 0) > 0 || targetsWithDoom(state).length > 0),
      resolve: ({ state, inv, api }) => {
        if (used(state, inv)) return
        const picked = api.choice({
          kind: 'skill', source: '04303', seat: inv.seat,
          prompt: '选择意志还是智识检定。',
          options: [{ id: 'willpower', label: '意志(4)' }, { id: 'intellect', label: '智识(4)' }],
        })
        const skill = picked === 'intellect' ? 'intellect' : 'willpower'
        api.startTest({
          seat: inv.seat, skill, difficulty: 4,
          resolve: result => {
            if (!result.success) return
            markLimitUsed(state, inv, successfulUse)
            const cards = targetsWithDoom(state)
            const options = cards.map(card => ({
              id: String(card.id),
              label: `${card.name || api.cardName(card.originalCode || card.code)}（${card.doom}）`,
            }))
            if ((state.doom || 0) > 0) options.unshift({ id: 'agenda', label: `当前密谋（${state.doom}）` })
            if (!options.length) return
            const chosen = options.length === 1 ? options[0].id : api.choice({
              kind: 'target', source: '04303', seat: inv.seat,
              prompt: '选择要移除 1 个毁灭标记的卡牌。', options,
            })
            if (chosen === 'agenda') api.removeDoom(1)
            else api.removeDoomFromCard(cards.find(card => String(card.id) === String(chosen)), 1)
            api.info('🏺 古代遗物：移除了 1 个毁灭标记。')
          },
        })
      },
    },
  ],
  modifiers: [],
}
