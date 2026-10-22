// 02141 追猎恐魔
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
// 卡面：猎手。反击。
// 卡面：强制 - 当敌军阶段开始时：从混乱袋中随机揭示1个标记。如果揭示的标记有[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号，重整追猎恐魔。
// 卡面：强制 - 在追猎恐魔离场时，将其放入混沌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { attachShadowSpawned } from '../../_shared.js'

export default {
  code: '02141', scope: 'enemy',
  enemyRule: { huntingHorror: true },
  enemyScript: {
    onSpawn(state, enemy, api) {
      // 02141 在任何章节生成时都附属暗影之子；helper 本身幂等。
      attachShadowSpawned(state, enemy, api)
    },
    onDefeated(state, enemy) {
      state.scenarioZones.void = { code: enemy.code, resources: enemy.shadowResources || 0 }
      return true
    },
  },
}
