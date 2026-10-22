// 04209 研究图案
// 归属：关卡专用 · heartOfTheEldersPart1（久远腹地（上）· 昆扬之口）
// 遭遇组：pillars_of_judgment
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：失落时代「久远腹地（上）」的简单幕/密谋分支。

import { originalOf } from '../../_shared.js'

export default {
  code: '04209', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      if (!state.enemies.some(enemy => originalOf(enemy) === '04209b')) {
        api.spawn('04209b', 'mouthOfKnyan')
        api.info?.('羽翼蛇族出现在昆扬之口，但它不能被击败。')
      }
    },
  },
}
