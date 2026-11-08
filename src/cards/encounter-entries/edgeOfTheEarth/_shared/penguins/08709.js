// 08709 呜啊！呜啊！呜啊！（Awk! Awk! Awk!）· 诡计 · penguins
// 卡面：显现 - 找到离你最远的巨型白化企鹅敌人。你必须将其移动到你所在地点，或在其上放置 1 个毁灭标记。
//   如果场上没有巨型白化企鹅敌人，查找遭遇牌库及弃牌堆，找出并抽取一个巨型白化企鹅，并混洗遭遇牌库。
// 读点：距离 entryDistance；移动 api.scenario.moveEnemy；毁灭 api.doomOn；
//   检索生成走 takeEncounterDeckCard/takeEncounterDiscard/spawn/shuffleEncounterDeck。
import { ALL_CARDS, entryDistance } from '../../../_shared.js'

const CODE = '08709'
const PENGUIN = '08708'
const isPenguin = code => {
  const card = ALL_CARDS[code]
  return card?.type === 'enemy' && card.encounterCode === 'penguins'
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    let penguins = state.enemies.filter(enemy => isPenguin(enemy.originalCode || enemy.code) && !enemy.defeated)
    if (!penguins.length) {
      let spawned = null
      if ((state.encounterDeck || []).includes(PENGUIN)) {
        const taken = api.takeEncounterDeckCard(PENGUIN)
        if (taken) spawned = api.spawn(PENGUIN, inv.location)
      } else if ((state.encounterDiscard || []).includes(PENGUIN)) {
        const taken = api.takeEncounterDiscard(PENGUIN)
        if (taken) spawned = api.spawn(PENGUIN, inv.location)
      }
      api.shuffleEncounterDeck()
      if (!spawned) {
        api.info('「呜啊！呜啊！呜啊！」：场上与遭遇牌堆都没有巨型白化企鹅。')
        return false
      }
      api.info('🐧 「呜啊！呜啊！呜啊！」：巨型白化企鹅被找出来并生成。')
      return false
    }
    const scored = penguins.map(enemy => ({ enemy, distance: entryDistance(state, inv.location, enemy.location) }))
      .filter(item => Number.isFinite(item.distance))
    if (!scored.length) return false
    const farthest = Math.max(...scored.map(item => item.distance))
    const candidates = scored.filter(item => item.distance === farthest).map(item => item.enemy)
    const enemy = candidates.length === 1 ? candidates[0] : candidates.find(item => item.id === api.choice({
      kind: 'enemy', source: CODE, seat: inv.seat, prompt: '选择离你最远的巨型白化企鹅。',
      options: candidates.map(item => ({ id: item.id, label: item.name || item.id })),
    })) || candidates[0]
    const pick = api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
      prompt: '「呜啊！呜啊！呜啊！」：移动企鹅到你所在地点，或在其上放 1 个毁灭标记。',
      options: [{ id: 'move', label: '把它移动到你的地点' }, { id: 'doom', label: '在其上放置 1 个毁灭标记' }] })
    if (pick === 'doom') {
      api.doomOn(enemy, 1)
      api.info('🌑 「呜啊！呜啊！呜啊！」：企鹅上放置 1 个毁灭标记。')
    } else {
      api.scenario.moveEnemy(enemy, inv.location, { ignoreAloof: true })
      api.info('🐧 「呜啊！呜啊！呜啊！」：企鹅移动到你的地点。')
    }
    return false
  },
}

