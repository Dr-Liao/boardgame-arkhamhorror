// 07090 深潜者来袭 · 深海生物
//
// 印刷（中文）：
//   显现 - 与你所在地点的每个[[深潜者]]敌人解除交战。你所在地点和连接地点的每个[[深潜者]]
//          敌人与你交战。如果没有敌人因此效果与你交战，查找遭遇牌库和遭遇弃牌堆，
//          找出一个[[深潜者]]敌人，将其生成，与你交战，并混洗遭遇牌库。
//
// 引擎读点：
//   · 「与你交战」分两种物理情形：同一地点的敌人直接重新交战（reengageEnemy），连接地点
//     的敌人由 engageAtInvestigator 带过来再交战——两者都是剧本运行时的既有写入口。
//   · 搜索生成走 _shared 的 searchEncounterEnemyAndSpawn：候选过滤用**权威只读**的
//     `canEnemyEnterLocation`（不肯进入当前地点的敌人不算合法候选），取出/洗牌都在原语里。
//   · 特性判定用 matcher 的 hasTrait（大小写不敏感），不按卡号写死。

import { hasTrait, searchEncounterEnemyAndSpawn } from '../../../_shared.js'

const active = enemy => enemy && !enemy.defeated && !enemy.removedFromGame

// 遭遇牌堆里的候选按「关卡遭遇定义优先、卡面数据兜底」读特性：set-aside 的敌人
// 也可能没有本关定义，但印刷卡面一定有。
const traitsOf = (state, code) => state.scenario?.enemies?.[code]?.traits
  || state.scenario?.enemies?.[state.scenario?.enemies?.[code]?.originalCode]?.traits
  || []
const isDeepOneCode = (state, code) => traitsOf(state, code).some(trait => String(trait).toLowerCase() === 'deep one')

export default {
  code: '07090', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const here = inv.location
    const location = (state.locations || []).find(entry => entry.id === here)
    // ① 本地点的深潜者先解除交战（不论原本与谁交战）。
    for (const enemy of (state.enemies || []).filter(item => active(item) && item.location === here && hasTrait(item, 'Deep One'))) {
      api.disengage(enemy)
    }
    // ② 本地与连接地点的深潜者与你交战。
    const inReach = new Set([here, ...(location?.connections || [])])
    const engaged = []
    for (const enemy of (state.enemies || []).filter(item => active(item) && inReach.has(item.location) && hasTrait(item, 'Deep One'))) {
      const ok = enemy.location === here
        ? api.reengageEnemy(enemy, inv.seat)
        : api.engageAtInvestigator(enemy, inv.seat)
      if (ok) engaged.push(enemy.code)
    }
    // ③ 没有任何敌人因本效果与你交战：搜索两个遭遇牌堆。
    if (engaged.length) return false
    searchEncounterEnemyAndSpawn(state, api, {
      seat: inv.seat, locationId: here, source: '07090',
      prompt: '深潜者来袭：选择要从遭遇牌库或弃牌堆生成的[[深潜者]]敌人。',
      matches: code => isDeepOneCode(state, code) && api.canEnemyEnterLocation(code, here),
    })
    return false
  },
}
