// 03163 阿卡姆疯人院
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { chooseKeysInEntry } from '../../_shared.js'

export default {
  code: '03163', scope: 'act',
  actRule: { onReveal(state, act, api) { chooseKeysInEntry(state, api) } },
}
