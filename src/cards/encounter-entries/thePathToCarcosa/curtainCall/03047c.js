// 03047c 陌生人
// 归属：关卡专用 · curtainCall（卡尔克萨之路 · 谢幕）
// 遭遇组：curtain_call
// 卡面：目标 - 在苍白面具下的男子将要从场上弃掉时，推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { applyStrangerBack } from '../../_shared.js'

export default {
  code: '03047c', scope: 'act',
  actRule: {
    onEmissaryDefeated(state, enemy, api) {
      applyStrangerBack(state, '03047c', enemy, api)
      return true
    },
    onEmissaryDiscarded(state, enemy, api) {
      applyStrangerBack(state, '03047c', enemy, api)
      api.advanceAct()
      return true
    },
  },
}
