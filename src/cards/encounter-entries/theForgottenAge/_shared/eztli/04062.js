// 04062 瓦卢西亚的预示者
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：eztli
// 卡面：警戒。猎手。反击。
// 卡面：瓦卢西亚的预示者处于横置状态时能反击。
// 卡面：强制 - 成功攻击或躲避瓦卢西亚的预示者后：在该卡牌上放置1资源。然后，如果该卡牌上有2[per_investigator]资源，瓦卢西亚的预示者发出奸险的嘶嘶声并遁去身影。(将该卡牌放在一边，位于场外。该卡牌保留所有伤害标记。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { harbingerSpawn, harbingerAfterSuccessfulTest } from '../../../_shared.js'

export default {
  code: '04062', scope: 'enemy', enemyRule: { healthPerInvestigator: 10, vengeance: 5, retaliateWhileExhausted: true },
  enemyScript: {
    onSpawn(state, enemy) { harbingerSpawn(state, enemy) },
    onAttackSuccess(state, inv, enemy, api) { harbingerAfterSuccessfulTest(state, enemy, api) },
    onEvade(state, inv, enemy, result, api) {
      if (result?.success !== false) harbingerAfterSuccessfulTest(state, enemy, api)
    },
  },
}
