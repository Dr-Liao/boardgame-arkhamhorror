// 06101 冷原蜘蛛（Spider of Leng，敌人，1 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：spiders（WOC）。
// 卡面：强制 - 在敌军阶段结束时：增加 1 张蜂拥卡牌到场上的每张蛛群（Swarm of Spiders）敌人。
//       如果场上没有蛛群敌人，查找遭遇牌库和弃牌堆中的一张蛛群敌人，将其（不带蜂拥卡牌）
//       生成在冷原蜘蛛所在地点。
// 实现：enemyScript.onEnemyPhaseEnd（共享层派发）。蜂拥卡放置走 api.swarm.place（从遭遇牌库顶抽）；
//   检索生成用 api.discardEncounterCard/takeEncounterDiscard 移出牌堆后 api.spawn，生成后
//   用 api.swarm.clear 清掉共享层自动放置的蜂拥卡（卡面写明「不带蜂拥卡牌」）。
import { originalOf } from '../../../_shared.js'

const SWARM_CODE = '06102'

export default {
  code: '06101',
  scope: 'enemy',
  implemented: true,
  enemyScript: {
    onEnemyPhaseEnd(state, enemy, api) {
      if (originalOf(enemy) !== '06101' || !state.enemies.includes(enemy)) return
      const swarms = (state.enemies || []).filter(other =>
        other !== enemy && originalOf(other) === SWARM_CODE && (api.swarm?.countOf ? true : true))
      if (swarms.length) {
        for (const swarm of swarms) {
          try { api.swarm?.place?.(swarm, 1, { source: '06101' }) }
          catch { api.info?.('遭遇牌库没有牌可以成为蜂拥卡。') }
        }
        api.info?.(`🕷️ 敌军阶段结束：${swarms.length} 张「蛛群」各增加 1 张蜂拥卡。`)
        return
      }
      const inDeck = (state.encounterDeck || []).includes(SWARM_CODE)
      const inDiscard = (state.encounterDiscard || []).includes(SWARM_CODE)
      if (!inDeck && !inDiscard) {
        api.info?.('遭遇牌库/弃牌堆里没有「蛛群」。')
        return
      }
      if (inDeck) {
        api.discardEncounterCard?.(SWARM_CODE)
        api.spawn?.(SWARM_CODE, enemy.location)
        try { api.takeEncounterDiscard?.(SWARM_CODE) } catch {}
      } else {
        api.takeEncounterDiscard?.(SWARM_CODE)
        api.spawn?.(SWARM_CODE, enemy.location)
      }
      const spawned = (state.enemies || []).find(other => originalOf(other) === SWARM_CODE
        && other.location === enemy.location)
      if (spawned) {
        api.swarm?.clear?.(spawned)
        api.info?.('🕷️ 敌军阶段结束：「蛛群」在冷原蜘蛛所在地点生成（不带蜂拥卡牌）。')
      }
    },
  },
}
