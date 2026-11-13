// 09090 恐灵附身（Ghastly Possession）· 秘术师技能 · 1 经验。
// 卡面：你将恐灵附身投入到支援上的技能检定后，选择一项：
//       - 在该支援上放置 1 个毁灭标记，恐灵附身获得 [wild][wild]。
//       - 如果本次检定成功，从该支援上移除 1 个毁灭标记，或将其使用补满一半（向下取整）。
//
// 读点：commit 档案让这张技能牌可投入；投入后的选择挂 committedCard 窗口
//       （同一读点被 05119 等使用）；图标追加 api.addCommittedCardIcons；
//       毁灭/使用次数写点 placeDoomOnCard / removeDoomFromCard / addUses。
//
// approximation（已写 primitive-request/09090.json）：
//   · committedCard 窗口发生在检定结果之前，没有「成功后回调」的条目级数据字段；
//     第二个选项在这里立即结算（移除 1 毁灭或补半使用），并已在 note 披露。
//   · 「支援上的技能检定」用 state.skillTest.source.assetId / _resolvingAssetId 定位发起检定的支援。
import { ALL_CARDS } from '../../cards/cards-data.js'

const testedAsset = (state, inv) => {
  const id = state.skillTest?.source?.assetId ?? state._resolvingAssetId ?? null
  if (!id) return null
  return (inv.assets || []).find(asset => asset.id === id) || null
}

export default {
  code: '09090',
  simplified: true,
  note: 'approximation: 见 primitive-request/09090.json（第二选项在投入窗口立即结算，未等待检定成功）',
  abilities: [
    {
      kind: 'commit',
      label: '投入支援上的技能检定；可选择放毁灭换双百搭图标，或成功后移除毁灭/补半使用',
      skill: {},
    },
    {
      kind: 'reaction',
      trigger: 'committedCard',
      label: '投入到支援上的检定后：放毁灭得双百搭，或移除毁灭/补半使用',
      criteria: [({ state, inv, context }) => context?.cardCode === '09090'
        && Boolean(testedAsset(state, inv))],
      resolve: ({ state, inv, api }) => {
        const asset = testedAsset(state, inv)
        if (!asset) return
        const mode = api.choice({
          kind: 'effect', source: '09090', seat: inv.seat,
          prompt: '选择恐灵附身的效果。',
          options: [
            { id: 'doom', label: '在该支援上放置 1 个毁灭，本次检定 +2 图标' },
            { id: 'settle', label: '若本次检定成功，移除 1 个毁灭或补满一半使用' },
          ],
        })
        if (mode === 'doom') {
          api.placeDoomOnCard(asset, 1)
          api.addCommittedCardIcons(inv.seat, 2)
          api.info('😈 「恐灵附身」：在支援上放置 1 个毁灭，本次检定 +2 图标。')
          return
        }
        // 卡面第二项：成功后可「移除 1 个毁灭」**或**「将使用补满一半」——两个选项由玩家选择。
        if ((asset.doom || 0) > 0) {
          const maxUses = Number(ALL_CARDS[asset.code]?.uses ?? 0)
          const half = Math.floor(maxUses / 2)
          const options = [{ id: 'doom', label: '从该支援上移除 1 个毁灭标记' }]
          if (half > 0) options.push({ id: 'uses', label: `将该支援的使用补满 ${half} 次` })
          const pick = options.length === 1 ? options[0].id : api.choice({
            kind: 'effect', source: '09090', seat: inv.seat,
            prompt: '「恐灵附身」：选择第二项效果。', options,
          })
          if (pick === 'uses' && half > 0) {
            api.addUses(asset, half)
            api.info(`😈 「恐灵附身」：为支援补满 ${half} 次使用。`)
            return
          }
          api.removeDoomFromCard(asset, 1)
          api.info('😈 「恐灵附身」：从支援上移除 1 个毁灭标记。')
          return
        }
        const maxUses = Number(ALL_CARDS[asset.code]?.uses ?? 0)
        const half = Math.floor(maxUses / 2)
        if (half > 0) {
          api.addUses(asset, half)
          api.info(`😈 「恐灵附身」：为支援补满 ${half} 次使用。`)
        }
      },
    },
  ],
  modifiers: [],
}
