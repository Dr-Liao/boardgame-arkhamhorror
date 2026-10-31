// 06109 祖格鼠的地穴（Zoog Burrow，诡计，1 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：zoogs（TSK）。
// 卡面：Revelation - 检定[agility](3)。你检定失败每低于难度 1 点，增加 1 张蜂拥卡牌到最近的
//       带蜂拥关键词的[[祖格鼠]]敌人。如果你失败且场上没有这类敌人，查找遭遇牌库和弃牌堆中的
//       一张[[祖格鼠]]敌人，抽取它，并混洗遭遇牌库。
// 实现：api.test + 失败差值；api.swarm.place 从遭遇牌库顶抽蜂拥卡加到最近的蜂拥祖格鼠；
//   场上没有时用 api.discardEncounterCard/takeEncounterDiscard 移出检索到的祖格鼠并 api.spawn。
import { hasTrait, originalOf } from '../../../_shared.js'

const ZOOG = 'zoog'

function distanceMap(state, from) {
  const distance = new Map([[from, 0]])
  const queue = [from]
  for (const current of queue) {
    const location = (state.locations || []).find(item => item.id === current)
    for (const next of location?.connections || []) {
      if (distance.has(next) || !(state.locations || []).some(item => item.id === next)) continue
      distance.set(next, distance.get(current) + 1)
      queue.push(next)
    }
  }
  return distance
}

function findZoogInPiles(state) {
  const isZoog = code => {
    const card = state.scenario?.enemies?.[code]
    return Boolean(card?.type === 'enemy' && card?.traits?.some(trait => String(trait).toLowerCase() === ZOOG))
  }
  const deck = (state.encounterDeck || []).slice().reverse().find(isZoog)
  if (deck) return { code: deck, pile: 'deck' }
  const discard = (state.encounterDiscard || []).slice().reverse().find(isZoog)
  return discard ? { code: discard, pile: 'discard' } : null
}

export default {
  code: '06109',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test?.(inv.seat, 'agility', 3, result => {
      if (result.success) return
      const failedBy = Math.max(1, 3 - Number(result.value || 0))
      const distance = distanceMap(state, inv.location)
      const swarmingZoogs = (state.enemies || [])
        .filter(enemy => hasTrait(enemy, ZOOG) && (api.swarm?.countOf?.(enemy) || 0) > 0)
        .map(enemy => ({ enemy, steps: distance.get(enemy.location) ?? Infinity }))
        .sort((left, right) => left.steps - right.steps)
      if (swarmingZoogs.length) {
        const target = swarmingZoogs[0].enemy
        try { api.swarm?.place?.(target, failedBy, { source: '06109' }) }
        catch { api.info?.('遭遇牌库没有牌可以成为蜂拥卡。') }
        api.info?.(`🐀 「祖格鼠的地穴」：最近的蜂拥祖格鼠增加 ${failedBy} 张蜂拥卡。`)
        return
      }
      const found = findZoogInPiles(state)
      if (!found) {
        api.info?.('场上与遭遇牌库/弃牌堆里都没有祖格鼠敌人。')
        api.shuffleEncounterDeck?.()
        return
      }
      if (found.pile === 'deck') {
        api.discardEncounterCard?.(found.code)
        api.spawn?.(found.code)
        try { api.takeEncounterDiscard?.(found.code) } catch {}
      } else {
        api.takeEncounterDiscard?.(found.code)
        api.spawn?.(found.code)
      }
      api.shuffleEncounterDeck?.()
      api.info?.('🐀 「祖格鼠的地穴」：从遭遇牌库/弃牌堆找出并抽取了一张祖格鼠敌人。')
    })
    return false
  },
}
