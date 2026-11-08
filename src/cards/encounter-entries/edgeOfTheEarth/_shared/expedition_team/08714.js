// 08714 威廉·戴尔教授（Professor William Dyer） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(3秘密)。[action]花费 1 秘密并横置：治愈你所在地点的一位调查员或另一个[[盟友]]支援 2 点恐惧。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

import { ALL_CARDS } from '../../../_shared.js'

const CODE = '08714'
const isAlly = card => (ALL_CARDS[card?.code]?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { action: 'heal2Horror' } },
  uses: 3, usesType: 'secrets',
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '花费 1 秘密并横置：治愈同地点调查员或另一个盟友支援 2 点恐惧',
    cost: { action: 1, exhaust: true, uses: 1 },
    resolve: ({ state, inv, source, api }) => {
      const mates = state.investigators.filter(other => !other.defeated && !other.resigned && other.location === inv.location)
      const allies = mates.flatMap(owner => (owner.assets || []).filter(asset => asset !== source && isAlly(asset))
        .map(asset => ({ owner, asset })))
      const options = [
        ...mates.map(other => ({ id: 'inv:' + other.seat, label: (other.name || '调查员') + '（恐惧）' })),
        ...allies.map(item => ({ id: 'asset:' + item.asset.id, label: (ALL_CARDS[item.asset.code]?.nameZh || item.asset.code) + '（恐惧）' })),
      ]
      if (!options.length) return
      const pick = options.length === 1 ? options[0].id : api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '选择治愈 2 点恐惧的目标（同地点调查员或盟友支援）。', options })
      if (String(pick).startsWith('inv:')) return api.healHorror(Number(String(pick).slice(4)), 2)
      const found = allies.find(item => item.asset.id === String(pick).slice(6))
      if (found) api.healAsset(found.asset, { horror: 2, ownerSeat: found.owner.seat })
    },
  }],
}


