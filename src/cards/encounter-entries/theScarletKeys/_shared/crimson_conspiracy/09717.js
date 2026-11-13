// 09717 红色阴谋（Conspiracy in Red）· 诡计 · crimson_conspiracy
// 卡面：显现 - 在阴影中的一个敌人上放置 1 个毁灭标记。如果阴影中没有敌人，查找遭遇牌库和
//   遭遇弃牌堆，找出一个带有隐匿关键词的敌人，将其抽取。混洗遭遇牌库。
// 读点：encounterResolve（各战役 encounter-rules 的统一诡计结算入口）；毁灭走场景运行时真实导出
//   的 `api.doomOn(card, n)`（= act-agenda.js#placeDoomOnCard，带 doomPlaced 钩子/放置拦截）；
//   检索走 _shared.js#searchEncounterEnemyAndSpawn（takeEncounterCard + spawn + shuffleEncounterDeck）。
//
// P1-5（2026-11-13）：scenarioRuntime 没有能力面的 `api.placeDoomOnCard`（该键只存在于 ctx.api /
//   api-clue），这里用真实导出 `api.doomOn`；能力面（或旧测试夹具）只有 placeDoomOnCard 时回退。
// 近似：① 「阴影中的敌人」按引擎约定 `enemy.location == null` 判定（阴影不是地点）；
//   ② 阴影里没有敌人时按卡面检索并「抽取」→ 生成到抽牌者地点，不额外结算显现（见 note）。
import { ALL_CARDS, searchEncounterEnemyAndSpawn } from '../../../_shared.js'

const CODE = '09717'

const enemiesInShadows = state => (state.enemies || []).filter(enemy => !enemy.defeated
  && enemy.removedFromGame !== true && (enemy.location == null || enemy.location === ''))

const hasConcealed = code => {
  const card = ALL_CARDS[code]
  return card?.type === 'enemy' && /Concealed/i.test(String(card.text || ''))
}

// 兼容 helper：遭遇结算面（scenarioRuntime）的毁灭入口是 `doomOn`；能力面/旧夹具是
// `placeDoomOnCard`。两者最终都落到 act-agenda.js#placeDoomOnCard 的唯一写点。
const placeDoom = (api, card, amount = 1) => {
  if (typeof api?.doomOn === 'function') return api.doomOn(card, amount)
  if (typeof api?.placeDoomOnCard === 'function') return api.placeDoomOnCard(card, amount)
  return 0
}

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const shadows = enemiesInShadows(state)
    if (shadows.length) {
      const target = shadows.length === 1 ? shadows[0] : shadows.find(enemy => String(enemy.id) === String(api.choice({
        kind: 'enemy', source: CODE, seat: inv.seat,
        prompt: '选择阴影中要放置 1 个毁灭标记的敌人。',
        options: shadows.map(enemy => ({ id: enemy.id, label: api.cardName?.(enemy.code) || enemy.name || enemy.code })),
      }))) || shadows[0]
      placeDoom(api, target, 1)
      api.info?.('「红色阴谋」：在阴影中的「' + (api.cardName?.(target.code) || target.name) + '」上放置 1 个毁灭标记。')
      return { placed: true, enemyId: target.id }
    }
    const spawned = searchEncounterEnemyAndSpawn(state, api, {
      seat: inv.seat,
      locationId: inv.location,
      matches: hasConcealed,
      prompt: '查找一个带隐匿关键词的敌人并抽取。',
      source: CODE,
      engageSeat: inv.seat,
    })
    if (spawned) return { spawned: spawned.id }
    api.shuffleEncounterDeck?.()
    api.info?.('「红色阴谋」：遭遇牌库与弃牌堆里没有带隐匿的敌人，混洗遭遇牌库。')
    return { placed: false }
  },
  note: 'approximation: 阴影用 `enemy.location == null` 表示；检索到的敌人直接生成到抽牌者地点并交战，'
    + '不再额外结算一次「显现」（生成已包含交战的入场流程）。',
}
