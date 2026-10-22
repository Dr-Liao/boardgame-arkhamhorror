// 04328 拉莱耶海岸
// 归属：关卡专用 · shatteredAeons（失落的时代 · 破碎永世）
// 遭遇组：shattered_aeons
// 卡面：拉莱耶海岸的每张卡牌(包括本卡牌)上每有一个毁灭标记，隐藏值+1。
// 卡面：强制 - 在拉莱耶海岸入场后：在其上放置1个毁灭标记。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 拉莱耶海岸（04328）：其上每张卡牌（含自身）的每个毁灭标记使隐藏值 +1。

import { locationDoomTotalInEntry } from '../../_shared.js'

export default {
  code: '04328', scope: 'location',
  modifiers: [{
    target: 'locationShroud',
    amount: ({ state, entity }) => locationDoomTotalInEntry(state, entity),
  }],
}
