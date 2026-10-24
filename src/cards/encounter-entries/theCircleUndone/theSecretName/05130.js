// 05130 乔·马祖尔维奇的房间（Joe Mazurewicz’s Room）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：[action] 团队每场游戏一次：查找牌组找一张祝福/道具支援加入手牌；闹鬼：1 恐惧或弃一个支援。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05130', scope: 'location', implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if (state.scenarioFlags?.joeSearchUsed) return
      moves.push({ action: 'scenarioAction', rule: 'joeSearchBlessed', label: '📖 乔的房间：检索一张[[祝福]]或[[道具]]支援（团队每场一次）' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'joeSearchBlessed') return false
      const candidates = (inv.deck || []).filter(code => {
        const card = ALL_CARDS[code]
        return card?.type === 'asset'
          && (card.traits || []).some(trait => ['Blessed', 'Item'].includes(trait))
      })
      if (!candidates.length) {
        api.info?.('📖 乔的房间：牌组里没有祝福/道具支援。')
        return true
      }
      const picked = candidates.length === 1 ? candidates[0] : candidates.find(code =>
        String(api.choose?.({
          kind: 'card', source: '05130', seat: inv.seat,
          prompt: '选择一张祝福/道具支援加入手牌。',
          options: candidates.map(code => ({ id: code, label: ALL_CARDS[code]?.nameZh || code })),
        })) === code) || candidates[0]
      inv.deck.splice(inv.deck.indexOf(picked), 1)
      inv.hand.push(picked)
      state.scenarioFlags ||= {}
      state.scenarioFlags.joeSearchUsed = true
      api.info?.(`📖 乔的房间：${inv.name} 找到「${ALL_CARDS[picked]?.nameZh || picked}」。`)
      return true
    },
  },
}
