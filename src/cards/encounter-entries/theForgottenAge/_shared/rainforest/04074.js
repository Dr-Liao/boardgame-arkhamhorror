// 04074 毒牙神庙
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：rainforest
// 卡面：胜利区每有一点复仇点数，毒牙神庙隐藏值+1。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 毒牙神庙（04074）：胜利区每有 1 点复仇点数，此处帷幕 +1。
// 迁移自 theUntamedWilds / heartOfTheEldersPart1 的 locationShroudModifier 分支。

import { victoryVengeance } from '../../../_shared.js'

export default {
  code: '04074',
  name: '毒牙神庙',
  scope: 'location',
  text: '胜利区每有 1 点复仇点数，此处帷幕 +1。',
  modifiers: [{
    target: 'locationShroud',
    amount: ({ state }) => victoryVengeance(state),
  }],
}
