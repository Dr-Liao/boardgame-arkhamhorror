// 06161 快速装填
// 卡面：快速。只能在你回合期间中打出。
// 卡面：选择你控制的一个[[枪械]]支援(其子弹标记数量少于其“使用(X)”中的X的支援卡)。
//       在该支援上放置子弹，直到子弹数量等于其“使用(X)”中的X。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：快速事件 = played + fast（从手牌在窗口/行动打出）；打出条件 ownTurn；
// 目标 = target.kind='asset' + query（[[枪械]]特性、有使用次数、当前次数小于 X）；
// X 取目标条目声明的 printed uses（entryData(code,'uses')，武器条目都声明了 uses）；
// 补满走 api.setAssetUses。

import { ownTurn } from '../../engine/matcher.js'
import { entryData } from './_shared.js'

const printedUses = code => {
  const uses = entryData(code, 'uses')
  return Number.isInteger(uses) && uses > 0 ? uses : null
}

export default {
  code: '06161',
  playCondition: [ownTurn()],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '快速装填：把一张[[枪械]]支援的子弹补到其使用(X)值',
      resolve: ({ state, inv, api }) => {
        const owns = (state.investigators?.[inv.seat]?.assets) || inv.assets || []
        const candidates = owns.filter(asset => {
          if (!(api.cardTraits(asset.code) || []).some(trait => String(trait).toLowerCase() === 'firearm')) return false
          const max = printedUses(asset.code)
          return max != null && (Number(asset.uses) || 0) < max
        })
        if (!candidates.length) { api.info('没有可装填的[[枪械]]支援。'); return }
        const chosenId = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'asset', source: '06161', seat: inv.seat,
          prompt: '选择要装填的[[枪械]]支援。',
          options: candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const weapon = candidates.find(asset => asset.id === chosenId) || candidates[0]
        const max = printedUses(weapon.code)
        if (max == null) return
        const before = Number(weapon.uses) || 0
        api.setAssetUses(weapon, max)
        api.info(`🔫 ${inv.name} 快速装填「${api.cardName(weapon.code)}」：${before} → ${max} 子弹。`)
      },
    },
  ],
  modifiers: [],
}
