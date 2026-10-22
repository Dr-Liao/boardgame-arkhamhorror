// 02200 野兽的牢笼
// 归属：关卡专用 · bloodOnTheAltar（血色祭坛）
// 遭遇组：blood_on_the_altar
// 卡面：目标 - 如果塞拉斯·毕晓普被击败：(→结局1)
// 卡面：目标 - 如果隐藏密室没有线索，推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../_shared.js'

export default {
  code: '02200', scope: 'act',
  actRule: {
    objective(state, { empty }) { return empty('02214') },
    finish: {
      when(state) { return state.victoryDisplay.some(card => originalOf(card) === '02216') },
      resolution: 'r1',
    },
    onReveal(state, act, api) {
      api.finish(state.investigators.some(inv => inv.assets.some(asset => asset.code === '02140')) ? 'r2' : 'r3')
    },
  },
}
