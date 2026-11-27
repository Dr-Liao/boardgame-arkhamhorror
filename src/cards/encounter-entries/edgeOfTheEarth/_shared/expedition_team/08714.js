// 08714 威廉·戴尔教授（Professor William Dyer） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(3秘密)。[action]花费 1 秘密并横置：治愈你所在地点的一位调查员或另一个[[盟友]]支援 2 点恐惧。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

import { partnerHealingAbility } from './_shared.js'

const CODE = '08714'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { action: 'heal2Horror' } },
  uses: 3, usesType: 'secrets',
  abilities: [partnerHealingAbility('action', 'horror', '秘密')],
}


