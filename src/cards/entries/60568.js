// 60568 铤而走险 · 技能（0 经验，敏捷/智识/意志图标，幸运）
// 卡面：如果本次技能检定成功，选择你弃牌堆中一张[survivor]支援或事件，将其加入你的手牌。
const CODE = '60568'

export default {
  code: CODE,
  abilities: [{
    kind: 'commit',
    label: '检定成功：把弃牌堆中一张生存者支援或事件加入手牌',
    skill: {
      afterTest: ({ inv, result, api }) => {
        if (!result?.success || !inv) return
        const candidates = [...new Set(inv.discard || [])].filter(code => {
          const type = api.cardType(code)
          if (type !== 'asset' && type !== 'event') return false
          return api.cardTraits(code).some(trait => String(trait).toLowerCase() === 'survivor')
            || api.cardDef?.(code)?.klass === 'survivor'
        })
        if (!candidates.length) return
        const options = candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) }))
        const picked = options.length === 1 ? options[0].id : api.choice({
          kind: 'card', source: CODE, seat: inv.seat, canSkip: true,
          prompt: '铤而走险：选择弃牌堆中一张生存者支援或事件加入手牌。',
          options: [{ id: 'skip', label: '不加入' }, ...options],
        })
        if (picked && picked !== 'skip' && api.moveCard({ code: picked, from: 'discard', to: 'hand' })) {
          api.info(`铤而走险：${inv.name} 将「${api.cardName(picked)}」加入手牌。`)
        }
      },
    },
  }],
  modifiers: [],
  note: '近似：卡面「[survivor]支援或事件」按卡牌职业字段/特性过滤；引擎若无 cardClass 读点时退回特性判断。',
}
