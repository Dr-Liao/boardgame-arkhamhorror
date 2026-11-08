// 08702 身陷疯狂（Lost in Madness）· 诡计 · left_behind
// 卡面：显现 - 附属到最近的[[附身]]敌人，并在该敌人上放置 1 个毁灭标记。如果场上没有[[附身]]敌人，
//   查找遭遇牌库及弃牌堆，找出并抽取一个[[附身]]敌人，并将身陷疯狂附属到该敌人（混洗遭遇牌库）。
//   与该敌人进行的攻击、躲避或谈判的难度增加 1。
// 读点：附属走 api.attachEncounterToEnemy；毁灭走 api.doomOn；难度 +1 需要引擎的「附属敌人难度修正」
//   读点（primitive-requests/p7-08702.json）。
import { ALL_CARDS, entryDistance } from '../../../_shared.js'

const CODE = '08702'
const isPossessed = code => (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'possessed')

function possessedEnemies(state) {
  return (state.enemies || []).filter(enemy => isPossessed(enemy.originalCode || enemy.code) && !enemy.defeated)
}
function takePossessedFromPiles(state, api) {
  for (const pile of ['encounterDeck', 'encounterDiscard']) {
    const list = pile === 'encounterDeck' ? state.encounterDeck : state.encounterDiscard
    if (!Array.isArray(list)) continue
    for (let offset = 1; offset <= list.length; offset++) {
      const code = list[list.length - offset]
      if (!isPossessed(code)) continue
      const taken = pile === 'encounterDeck' ? api.takeEncounterDeckCard(code) : api.takeEncounterDiscard(code)
      if (taken) { api.shuffleEncounterDeck(); return code }
    }
  }
  return null
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { attachToPossessedEnemy: true, difficultyBonus: 1 },
  encounterResolve(state, inv, card, api) {
    const inPlay = possessedEnemies(state)
    let enemy = null
    if (inPlay.length) {
      const nearestDistance = Math.min(...inPlay.map(item => entryDistance(state, inv.location, item.location)))
      const nearest = inPlay.filter(item => entryDistance(state, inv.location, item.location) === nearestDistance)
      enemy = nearest.length === 1 ? nearest[0] : nearest.find(item => item.id === api.choice({
        kind: 'enemy', source: CODE, seat: inv.seat, prompt: '选择最近的[[附身]]敌人，将「身陷疯狂」附属到它。',
        options: nearest.map(item => ({ id: item.id, label: item.name || item.id })),
      })) || nearest[0]
    } else {
      const code = takePossessedFromPiles(state, api)
      if (code) enemy = api.spawn(code, inv.location)
      if (!enemy) {
        api.info('「身陷疯狂」：遭遇牌库与弃牌堆里没有[[附身]]敌人。')
        return false
      }
    }
    api.attachEncounterToEnemy(CODE, enemy.id)
    api.doomOn(enemy, 1)
    api.info('😵 「身陷疯狂」附属到「' + (enemy.name || enemy.id) + '」并放置 1 个毁灭标记。')
    return true
  },
  note: '「与该敌人进行的攻击、躲避或谈判难度 +1」需要引擎的附属敌人难度修正读点（primitive-requests/p7-08702.json）。',
}

