// 08067 天文地图集（Astronomical Atlas）· 秘术师（Mystic）资产 · 手部 · 3 经验。
//
// 卡面：[fast] 横置天文地图集：查看你牌库顶 1 张卡牌。如果它不是弱点，将它正面朝下附属到
//       天文地图集上(最多附属 5 张)。
//       [fast]：将一张附属在天文地图集上的卡牌投入到一个符合条件的技能检定中。如果该检定成功，
//       不弃掉该卡牌，改为将其加入你的手牌。(每次检定仅限一次。)
//
// 一卡一文件：这张卡的行为只在这里维护。
// approximation: 能力 2 没有「from attached 投入 + 成功后回手」的原语。这里用最接近的等价实现：
//   ① free 描述子把一张附属牌标记为「已投入」（api.addUses(attachment, 1) 当标记）并按该牌的
//      技能图标数 api.addPendingTestBonus（每次检定一次）；
//   ② reaction testEnds 读点：本次检定成功后把标记过的附属牌加入手牌，失败则弃掉。
//   与「真正进入投入区」的差别记录在 P6 报告 approximation 清单。
import { ALL_CARDS } from '../../cards/cards-data.js'

const iconCountFor = (code, skill) => {
  const icons = ALL_CARDS[code]?.icons || {}
  const skills = Array.isArray(skill) ? skill : [skill]
  let total = 0
  for (const [name, amount] of Object.entries(icons)) {
    if (name === 'wild' || skills.includes(name)) total += Number(amount) || 0
  }
  return total
}

export default {
  code: '08067',
  abilities: [
    {
      kind: 'free',
      cost: { exhaust: true },
      label: '横置：查看牌库顶 1 张，非弱点则正面朝下附属到天文地图集',
      criteria: [({ state, inv, source }) => Boolean(source)
        && (source.attachments || []).length < 5
        && Array.isArray(inv.deck) && inv.deck.length > 0],
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        if ((source.attachments || []).length >= 5) {
          api.info('「天文地图集」：已附属 5 张卡牌。')
          return
        }
        const code = inv.deck[inv.deck.length - 1]
        if (!code) {
          api.info('「天文地图集」：你的牌库是空的。')
          return
        }
        if (!api.isNonWeakness(code)) {
          api.info(`「天文地图集」：牌库顶是弱点「${api.cardName(code)}」，不能附属。`)
          return
        }
        api.moveCard({ code, from: 'deck', to: 'attached', attachTo: source.id, facedown: true })
        api.info(`🗺️ 「天文地图集」：将牌库顶一张卡牌正面朝下附属到其上（共 ${(source.attachments || []).length} 张）。`)
      },
    },
    {
      kind: 'free',
      limit: { scope: 'perTest', owner: 'player' },
      label: '把一张附属牌投入当前技能检定（成功后加入手牌）',
      criteria: [({ state, source }) => Boolean(state.skillTest) && Boolean(source)
        && (source.attachments || []).length > 0],
      resolve: ({ state, inv, source, api }) => {
        if (!source || !state.skillTest) return
        const candidates = (source.attachments || []).filter(attachment => !attachment.uses)
        if (!candidates.length) {
          api.info('「天文地图集」：没有可投入的附属牌。')
          return
        }
        const chosen = candidates.length === 1 ? candidates[0].id
          : api.choice({ kind: 'target', source: '08067', seat: inv.seat,
            prompt: '选择要投入技能检定的附属牌。',
            options: candidates.map(attachment => ({ id: attachment.id, label: api.cardName(attachment.code) })) })
        const attachment = candidates.find(item => item.id === chosen) || candidates[0]
        if (!attachment) return
        const icons = iconCountFor(attachment.code, state.skillTest.skill)
        api.addUses(attachment, 1)
        if (icons > 0) api.addPendingTestBonus(icons)
        api.info(`🗺️ 「天文地图集」：将「${api.cardName(attachment.code)}」投入本次检定（+${icons} 图标）。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'testEnds',
      label: '投入的附属牌：检定成功则加入手牌，失败则弃掉',
      criteria: [({ source }) => Boolean(source)
        && (source.attachments || []).some(attachment => attachment.uses)],
      resolve: ({ state, inv, source, context, api }) => {
        if (!source) return
        const success = context?.success === true
        for (const attachment of (source.attachments || []).filter(item => item.uses)) {
          if (success) {
            api.moveCard({ id: attachment.id, from: 'attached', to: 'hand' })
            api.info(`🗺️ 「天文地图集」：「${api.cardName(attachment.code)}」检定成功，加入手牌。`)
          } else {
            api.moveCard({ id: attachment.id, from: 'attached', to: 'discard' })
            api.info(`🗺️ 「天文地图集」：「${api.cardName(attachment.code)}」检定失败，弃掉。`)
          }
        }
      },
    },
  ],
  modifiers: [],
}
