// 06354 无休织作（诡计，3 张）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：Revelation - 选择场上的一个[[蜘蛛]]敌人。如果它与调查员交战，它立即进行一次攻击，
//       其每张蜂拥/头领卡牌也一同攻击。否则，在其所在地点放置 1 个毁灭标记。
//       如果场上没有[[蜘蛛]]敌人，查找遭遇牌库和弃牌堆中的一张[[蜘蛛]]敌人并抽取它，洗回遭遇牌库。
// 接线：encounterResolve 用 api.choose 选蜘蛛敌人；交战则 api.attack（蜂拥卡在本引擎是附属卡，
//   不是独立敌人，只由头领攻击一次 —— simplified）；否则 api.locationDoom；
//   场上无蜘蛛时从遭遇牌库/弃牌堆找出并生成（api.spawn 用该敌人的生成规则）。
import { hasTrait } from '../../_shared.js'

function findSpiderInPiles(state) {
  const isSpiderEnemy = code => {
    const card = state.scenario?.enemies?.[code]
    return Boolean(card?.traits?.some(trait => String(trait).toLowerCase() === 'spider'))
  }
  const deck = (state.encounterDeck || []).slice().reverse().find(isSpiderEnemy)
  if (deck) return { code: deck, pile: 'deck' }
  const discard = (state.encounterDiscard || []).slice().reverse().find(isSpiderEnemy)
  return discard ? { code: discard, pile: 'discard' } : null
}

export default {
  code: '06354',
  scope: 'treachery',
  implemented: true,
  simplified: true,
  note: '蜂拥/头领卡在引擎里是头领敌人的附属卡（不是独立敌人实体），只由头领发起一次攻击；「每张蜂拥卡各攻击一次」未逐卡重演。',
  encounterResolve(state, inv, card, api) {
    const spiders = (state.enemies || []).filter(enemy => hasTrait(enemy, 'Spider'))
    if (!spiders.length) {
      const found = findSpiderInPiles(state)
      if (!found) {
        api.info?.('场上与遭遇牌库/弃牌堆里都没有[[蜘蛛]]敌人。')
        api.shuffleEncounterDeck?.()
        return false
      }
      if (found.pile === 'deck') api.discardEncounterCard?.(found.code)
      else api.takeEncounterDiscard?.(found.code)
      api.spawn?.(found.code)
      api.shuffleEncounterDeck?.()
      api.info?.('🕷️ 「无休织作」：从遭遇牌库/弃牌堆找出并抽取了一张[[蜘蛛]]敌人。')
      return false
    }
    const answer = spiders.length === 1 || typeof api.choose !== 'function'
      ? spiders[0].id
      : api.choose({
        kind: 'enemy', source: '06354', seat: inv.seat,
        prompt: '选择「无休织作」要结算的[[蜘蛛]]敌人。',
        options: spiders.map(enemy => ({ id: String(enemy.id), label: enemy.name })),
      })
    const target = spiders.find(enemy => String(enemy.id) === String(answer)) || spiders[0]
    if (target.engagedSeat != null) {
      const holder = (state.investigators || []).find(one => one.seat === target.engagedSeat)
      api.info?.(`🕷️ 「无休织作」：${target.name} 立即发动一次攻击。`)
      if (holder) api.attack?.(target, holder)
      return false
    }
    const location = (state.locations || []).find(item => item.id === target.location)
    if (location) {
      api.locationDoom?.add(location, 1)
      api.info?.(`🕷️ 「无休织作」：${target.name} 未交战，在「${location.name}」上放置 1 个毁灭标记。`)
    }
    return false
  },
}
