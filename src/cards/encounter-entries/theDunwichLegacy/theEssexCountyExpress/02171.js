// 02171 客车
// 归属：关卡专用 · theEssexCountyExpress（疯狂列车）
// 遭遇组：essex_county_express
// 卡面：客车与其左边和右边的地点连接。
// 卡面：强制 -  你进入客车后：你必须弃掉一张带有至少1个[wild]图标的手牌，或受到1点伤害和1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { essexPassengerCompartment } from '../../_shared.js'

export default {
  code: '02171', scope: 'location',
  locationRule: {
    onEnter: { effect(state, loc, api, inv) { essexPassengerCompartment(state, inv, api, '02171', { skill: 'wild', needed: 1, damage: 1, horror: 1, harmLabel: '受到 1 伤害与 1 恐惧' }) } },
  },
}
