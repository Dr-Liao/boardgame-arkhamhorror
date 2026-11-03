// 06354 无休织作（诡计，3 张）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：Revelation - 选择场上的一个[[蜘蛛]]敌人。如果它与调查员交战，它立即进行一次攻击，
//       其每张蜂拥/头领卡牌也一同攻击。否则，在其所在地点放置 1 个毁灭标记。
//       如果场上没有[[蜘蛛]]敌人，查找遭遇牌库和弃牌堆中的一张[[蜘蛛]]敌人并抽取它，洗回遭遇牌库。
// 接线：encounterResolve 用 api.choose 选蜘蛛敌人；交战则 api.attackWithSwarm
//   逐张结算头领和蜂拥卡的攻击；否则 api.locationDoom；
//   场上无蜘蛛时从遭遇牌库/弃牌堆查找并按普通遭遇抽牌流程结算。
import { hasTrait } from '../../_shared.js'

export default {
  code: '06354',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const spiders = (state.enemies || []).filter(enemy => hasTrait(enemy, 'Spider'))
    if (!spiders.length) {
      const found = api.findAndDrawEncounterCard(inv.seat, {
        from: ['encounterDeck', 'encounterDiscard'], type: 'enemy', trait: 'Spider',
        shuffleEncounterDeck: true, source: card?.code || '06354',
      })
      if (!found) {
        api.info?.('场上与遭遇牌库/弃牌堆里都没有[[蜘蛛]]敌人。')
      }
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
    const holder = (state.investigators || []).find(one => one.seat === target.engagedSeat)
      || (target.massive ? (state.investigators || []).find(one =>
        !one.defeated && !one.resigned && one.location === target.location) : null)
    if (holder) {
      api.info?.(`🕷️ 「无休织作」：${target.name} 立即发动一次攻击。`)
      api.attackWithSwarm(target, holder)
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
