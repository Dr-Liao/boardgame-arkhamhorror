// 08720 艾米·肯斯勒博士（Dr. Amy Kensler） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(3秘密)。[action]花费 1 秘密并横置：调查。以基础值为 5 的[intellect]调查。成功后可查看任意调查员牌库顶或遭遇牌库顶 1 张，并可弃掉它。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

import { ALL_CARDS } from '../../../_shared.js'

const CODE = '08720'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { action: 'investigateBase5LookTopCard' } },
  uses: 3, usesType: 'secrets',
  abilities: [{
    kind: 'action', actionKind: 'investigate', label: '花费 1 秘密并横置：以基础值 5 的智力调查；成功后看 1 张顶牌并可弃掉',
    cost: { action: 1, exhaust: true, uses: 1 },
    resolve: ({ state, inv, api }) => {
      const location = state.locations.find(loc => loc.id === inv.location)
      if (!location || (location.clues || 0) <= 0) {
        api.info('「艾米·肯斯勒博士」：所在地点没有线索可发现。')
        return
      }
      api.test(inv.seat, 'intellect', Number(location.shroud ?? 0), {
        baseValue: 5,
        source: { type: 'asset', code: CODE, name: ALL_CARDS[CODE]?.nameZh || CODE, ability: true },
        resolve: result => {
          if (!result.success) return
          api.discoverClue(inv.seat, 1, location.id)
          const choice = api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
            prompt: '查看哪位调查员的牌库顶，或遭遇牌库顶？',
            options: [
              ...state.investigators.filter(other => (other.deck || []).length).map(other => ({ id: 'deck:' + other.seat, label: (other.name || '调查员') + ' 的牌库顶' })),
              ...((state.encounterDeck || []).length ? [{ id: 'encounter', label: '遭遇牌库顶' }] : []),
            ] })
          if (choice === 'encounter') {
            const top = api.scenario.lookEncounterTop(inv.seat, 1)
            const code = top?.[0]
            if (!code) return
            if (api.choice({ kind: 'effect', source: CODE, seat: inv.seat, prompt: '是否弃掉「' + (ALL_CARDS[code]?.nameZh || code) + '」？',
              options: [{ id: 'keep', label: '保留' }, { id: 'discard', label: '弃掉' }] }) === 'discard') {
              api.scenario.discardEncounterCard(code)
            }
            return
          }
          if (String(choice).startsWith('deck:')) {
            const seat = Number(String(choice).slice(5))
            const top = state.investigators[seat]?.deck?.at(-1)
            if (!top) return
            api.lookAt(inv.seat, { zone: 'deck', count: 1, targetSeat: seat })
            if (api.choice({ kind: 'effect', source: CODE, seat: inv.seat, prompt: '是否弃掉「' + (ALL_CARDS[top]?.nameZh || top) + '」？',
              options: [{ id: 'keep', label: '保留' }, { id: 'discard', label: '弃掉' }] }) === 'discard') {
              api.moveCard({ code: top, from: 'deck', to: 'discard', ownerSeat: seat })
            }
          }
        },
      })
    },
  }],
}


