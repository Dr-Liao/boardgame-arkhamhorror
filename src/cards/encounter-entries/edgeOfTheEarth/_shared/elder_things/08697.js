// 08697 古老者崛起（Rise of the Elder Things）· 诡计 · elder_things
// 卡面：显现 - 找出遭遇弃牌堆最顶部的一张[[古老者]]敌人，并将其生成，与你交战。当前与你交战的
//   每个[[古老者]]敌人得到 +1 攻击和 +1 躲避，直到一轮结束。如果古老者崛起没有放置敌人入场，其获得涌动。
// 读点：encounterResolve（entryRevelation 通道）；检索生成走 api.takeEncounterDiscard / api.spawn /
//   api.engageAtInvestigator；临时攻击/躲避修正需要引擎的「敌人临时属性修正」读点，见
//   artifacts/migration/eote/primitive-requests/p7-08697.json。
import { ALL_CARDS } from '../../../_shared.js'

const isElderThing = code => (ALL_CARDS[code]?.traits || [])
  .some(trait => String(trait).toLowerCase() === 'elder thing')

export default {
  code: '08697', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const pool = [...(state.encounterDiscard || [])]
    let code = null
    for (let index = pool.length - 1; index >= 0; index--) {
      if (isElderThing(pool[index])) { code = pool[index]; break }
    }
    if (!code) code = Object.keys(ALL_CARDS).find(candidate => ALL_CARDS[candidate].type === 'enemy'
      && (ALL_CARDS[candidate].encounterCode === 'elder_things') && isElderThing(candidate)) || null
    const taken = code ? api.takeEncounterDiscard(code) : null
    if (!taken) {
      api.info('「古老者崛起」：遭遇弃牌堆没有古老者敌人，获得涌动。')
      return { gainSurge: true }
    }
    const enemy = api.spawn(code, inv.location)
    if (!enemy) {
      api.info('「古老者崛起」：古老者敌人未能生成，获得涌动。')
      return { gainSurge: true }
    }
    api.engageAtInvestigator(enemy, inv.seat)
    api.info('👹 「古老者崛起」：' + (enemy.name || code) + ' 在「' + (state.locations.find(loc => loc.id === inv.location)?.name || inv.location) + '」生成并交战。')
    return true
  },
  note: '「当前与你交战的每个古老者敌人 +1 攻击/+1 躲避直到一轮结束」需要引擎的临时敌人属性修正读点（primitive-requests/p7-08697.json）；生成与交战已接线。',
}

