// 11629 荧光档案库（记忆档案库）· 地点（调查阶段结束若仍有线索：附属的[[符文]]诡计洗回遭遇牌库；
//       [action][action] 搜索遭遇弃牌堆找出一张[[符文]]卡并抽取）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 读点：
//   · forced ability trigger:'investigationPhaseEnds'（引擎窗口既有；地点实例作为来源）：
//     criteria = 本地点有线索 + 附属中有[[符文]]诡计；resolve = 逐张 api.scenario.detachEncounterAttachment
//     （离场进遭遇弃牌堆）→ api.scenario.takeEncounterDiscard 清掉弃牌堆副本 → api.scenario.putOnEncounterDeck
//     ({ shuffle: true }) 洗入遭遇牌库。
//   · [action][action] 搜索弃牌堆符文在 behavior.searchDiscardGlyphAction（flags.searchDiscardGlyphActions=2）。
export default {
  code: '11629',
  scope: 'location',
  implemented: true,
  flags: {"searchDiscardGlyphActions":2},
  note: "[action][action] 搜索弃牌堆符文在 behavior.searchDiscardGlyphAction；调查阶段结束洗回附属[[符文]]诡计由条目 forced（investigationPhaseEnds 窗口）结算。",
  abilities: [{
    kind: 'forced',
    trigger: 'investigationPhaseEnds',
    label: '调查阶段结束时，如果荧光档案库上有线索：将附属到本地点的每张[[符文]]诡计混洗入遭遇牌库',
    criteria: ({ source, helpers }) => {
      if (!source || (Number(source.clues) || 0) <= 0) return false
      return (source.attachments || []).some(card => {
        const code = card.originalCode || card.code
        return helpers.cardType(code) === 'treachery'
          && (helpers.cardTraits(code) || []).some(trait => String(trait).toLowerCase() === 'glyph')
      })
    },
    resolve: ({ source, api }) => {
      const cardDef = code => api.cardDef?.(code) || null
      const glyphTreacheries = (source.attachments || []).filter(card => {
        const code = card.originalCode || card.code
        return cardDef(code)?.type === 'treachery'
          && (cardDef(code)?.traits || []).some(trait => String(trait).toLowerCase() === 'glyph')
      })
      if (!glyphTreacheries.length) return
      const codes = glyphTreacheries.map(card => card.originalCode || card.code)
      for (const attachment of [...glyphTreacheries]) api.scenario?.detachEncounterAttachment?.(attachment)
      for (const code of codes) api.scenario?.takeEncounterDiscard?.(code)
      api.scenario?.putOnEncounterDeck?.(codes, { shuffle: true })
      api.info?.(`调查阶段结束：${codes.length} 张[[符文]]诡计混洗入遭遇牌库。`)
    },
  }],
}
