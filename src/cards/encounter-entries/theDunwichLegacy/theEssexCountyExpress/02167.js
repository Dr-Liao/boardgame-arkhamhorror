// 02167 客车
// 归属：关卡专用 · theEssexCountyExpress（疯狂列车）
// 遭遇组：essex_county_express
// 卡面：客车与其左边和右边的地点连接。
// 卡面：强制 -  你进入客车后：你必须弃掉总计至少2个[agility]图标的手牌，或受到2点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 68 轮：Essex County Express 的五节旅客车厢。

import { essexPassengerCompartment } from '../../_shared.js'

export default {
  code: '02167', scope: 'location',
  locationRule: {
    onEnter: { effect(state, loc, api, inv) { essexPassengerCompartment(state, inv, api, '02167', { skill: 'agility', needed: 2, damage: 2, harmLabel: '受到 2 伤害' }) } },
  },
}
