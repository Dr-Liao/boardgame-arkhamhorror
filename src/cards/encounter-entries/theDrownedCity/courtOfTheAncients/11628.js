// 11628 荧光档案库（历史档案库）· 地点（每张其上/附属的[[符文]] +1 隐藏值；
//       [fast] 花 X 行动搜弃牌堆符文；[action] 移动到[[通道]]地点）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 读点：
//   · behavior.locationShroudModifier（附属符文 +1 隐藏值）、behavior.movePassagewayAction（[[通道]]移动）；
//   · [fast] = 条目 free + actionKind:'activate'（地点条目行动经 entityAction 管线进入合法行动）：
//     criteria 读 actionsLeft ≥1 且遭遇弃牌堆有[[符文]]卡；resolve 用 api.choose 选 X（≤ actionsLeft），
//     api.loseActions(seat, X) 支付 X 次行动，再从弃牌堆搜索至多 X 张[[符文]]卡依次抽取
//     （api.scenario.takeEncounterDiscard + putOnEncounterDeck + api.drawEncounter）。
export default {
  code: '11628',
  scope: 'location',
  implemented: true,
  flags: {"passageway":true,"shroudPerAttachedGlyph":1},
  note: "[fast] 的 X 次行动由条目 free 能力的 resolve 用 api.loseActions 真实支付（X 由玩家选择、不超过剩余行动）；隐藏值修正与[[通道]]移动在 behavior。",
  abilities: [{
    kind: 'free',
    actionKind: 'activate',
    label: '花费 X 次行动（至少 1 次）：查找遭遇弃牌堆，找出至多 X 张[[符文]]卡牌并依次抽取',
    criteria: ({ state, inv, helpers }) => (Number(inv?.actionsLeft) || 0) >= 1
      && (state.encounterDiscard || []).some(code => (helpers.cardTraits(code) || [])
        .some(trait => String(trait).toLowerCase() === 'glyph')),
    resolve: ({ inv, api }) => {
      const cardDef = code => api.cardDef?.(code) || null
      const glyphInDiscard = () => (api.scenario?.encounterDiscardCards?.() || [])
        .filter(code => (cardDef(code)?.traits || []).some(trait => String(trait).toLowerCase() === 'glyph'))
      const actionsLeft = Math.max(0, Number(inv.actionsLeft) || 0)
      if (!actionsLeft || !glyphInDiscard().length) return
      const x = actionsLeft === 1 ? 1 : Number(api.choose?.({
        kind: 'number', source: '11628', seat: inv.seat, canSkip: false,
        prompt: '荧光档案库：选择花费的行动数 X。',
        options: Array.from({ length: actionsLeft }, (_, index) => ({ id: String(index + 1), label: `${index + 1} 次行动` })),
      })) || 1
      const spent = Math.min(actionsLeft, Math.max(1, Number(x) || 1))
      if (typeof api.loseActions !== 'function') return
      api.loseActions(inv.seat, spent)
      for (let drawn = 0; drawn < spent; drawn += 1) {
        const candidates = glyphInDiscard()
        if (!candidates.length) break
        let code = candidates[0]
        if (candidates.length > 1 && typeof api.choose === 'function') {
          const picked = api.choose({
            kind: 'card', source: '11628', seat: inv.seat, canSkip: false,
            prompt: '从遭遇弃牌堆选择一张[[符文]]卡抽取。',
            options: candidates.map((item, index) => ({ id: String(index), cardCode: item, label: cardDef(item)?.nameZh || item })),
          })
          const found = Number(picked)
          if (Number.isInteger(found) && found >= 0 && found < candidates.length) code = candidates[found]
        }
        api.scenario?.takeEncounterDiscard?.(code)
        api.scenario?.putOnEncounterDeck?.([code], { shuffle: false })
        api.drawEncounter?.(inv.seat)
      }
    },
  }],
}
