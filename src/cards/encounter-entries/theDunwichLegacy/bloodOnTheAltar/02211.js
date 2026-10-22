// 02211 芦苇屋
// 归属：关卡专用 · bloodOnTheAltar（血色祭坛）
// 遭遇组：blood_on_the_altar
// 卡面：强制 - 在芦苇屋揭示后：查找遭遇牌库，找出一张[[夜魇]]敌人并将其生成在公共空地。混洗遭遇牌库。
// 卡面：[free]如果此处没有线索：抽取芦苇屋底下的遭遇卡牌。(团队每场游戏仅限一次)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { spawnTraitEnemyAtVillage } from '../../_shared.js'

export default {
  code: '02211', scope: 'location',
  locationRule: {
    onReveal(state, loc, api) { spawnTraitEnemyAtVillage(state, loc, api, 'Nightgaunt') },
  },
}
