// 08717 玛拉·辛哈医生（Dr. Mala Sinha） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(3补给)。[action]花费 1 补给并横置：治愈你所在地点的一位调查员或另一个[[盟友]]支援 2 点伤害。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

import { partnerHealingAbility } from './_shared.js'

const CODE = '08717'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { action: 'heal2Damage' } },
  uses: 3, usesType: 'supplies',
  abilities: [partnerHealingAbility('action', 'damage', '补给')],
}


