// 60163 机械瞄具（Iron Sights）
// 卡面：快速。只能在你回合期间打出。附属到你控制的[[枪械]]支援。
// [action] 横置机械瞄具：你本回合下一次使用所附属支援的攻击得到技能值 +3。本行动不引起趁乱攻击。
//
// 读点：keepOnPlay + api.attachPlayerCardToAsset（附属实例带 hostAssetId，供能力 criteria 读取）；
//   · [action] 描述子声明 `noOpportunityAttack: true` —— dispatch.js#已读
//     `usedAbility.descriptor.noOpportunityAttack`（ability.js 描述子字段已有读点），本行动不引发借机攻击；
//   · 技能值 +3 走 api.playerTools.addNextTestBonus（「下一次技能检定 +N」的既有入口；本卡在检定外使用）。
//     「必须是所附属支援的攻击」仍为近似：现有 nextTestBonus 不携带来源过滤，见 primitive 请求。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownTurn } from '../../engine/matcher.js'

const CODE = '60163'

export default {
  code: CODE,
  keepOnPlay: true,
  playCondition: [ownTurn()],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '附属到你控制的[[枪械]]支援',
      resolve: ({ inv, api }) => {
        const candidates = (inv.assets || []).filter(asset => !asset.attachedToAsset
          && (api.cardTraits(asset.code) || []).some(trait => String(trait).toLowerCase() === 'firearm'))
        if (!candidates.length) {
          api.info('你没有可以附属的[[枪械]]支援。')
          return
        }
        const id = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat, prompt: '选择要附属的[[枪械]]支援。',
          options: candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const host = candidates.find(asset => asset.id === id)
        if (host) api.attachPlayerCardToAsset(CODE, host, { ownerSeat: inv.seat })
      },
    },
    {
      kind: 'action',
      noOpportunityAttack: true,
      label: '横置：本回合下一次使用所附属支援的攻击 +3 技能值（不引起趁机攻击）',
      cost: { action: true, exhaust: true },
      resolve: ({ inv, api }) => api.playerTools.addNextTestBonus(inv.seat, 3),
    },
  ],
  modifiers: [],
}
