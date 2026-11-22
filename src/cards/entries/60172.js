// 60172 加长枪管（Extended Barrel）
// 卡面：快速。只能在你回合期间打出。附属到你控制的[[枪械]]支援。你用所附属支援攻击时得到技能值 +1。
// 读点：keepOnPlay + api.attachPlayerCardToAsset；reaction trigger weaponFightInitiated（windows.js 已注册窗口）
// + api.addTestValue？改为在 weaponFightInitiated 追加本卡为检定加值：api.addPendingTestBonus(1)（近似）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownTurn } from '../../engine/matcher.js'

const CODE = '60172'

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
      kind: 'reaction',
      trigger: 'weaponFightInitiated',
      label: '用所附属支援攻击时：本次攻击 +1 技能值',
      criteria: [({ inv, context, source }) => context?.seat === inv.seat
        && Boolean(source?.hostAssetId)
        && String(context?.assetId ?? '') === String(source.hostAssetId)],
      resolve: ({ inv, api }) => api.addPendingTestBonus(inv.seat, 1),
    },
  ],
  note: 'approximation: weaponFightInitiated 发生在检定发起前，用 addPendingTestBonus 代替「本次检定 +1」；资源/武器来源匹配按 context.assetId 与 hostAssetId 判定。',
  modifiers: [],
}
