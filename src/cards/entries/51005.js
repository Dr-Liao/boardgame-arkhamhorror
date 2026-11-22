import { playerEffectCanAffect } from '../../engine/effect-recipient.js'

const code = '51005'
const suppliesAt = (state, inv) => state.investigators
  .filter(owner => !owner.defeated && !owner.resigned && owner.location === inv.location
    && playerEffectCanAffect(state, owner.seat, { sourceSeat: inv.seat, sourceCode: code }))
  .flatMap(owner => owner.assets.filter(asset => ['ammo', 'supplies'].includes(asset.usesType)))

export default {
  code,
  playCondition: [{
    when: ({ state, inv }) => suppliesAt(state, inv).length > 0,
    message: '此地没有使用弹药或补给的可选支援',
  }],
  abilities: [{
    kind: 'played', label: '补充弹药或补给：加 2 并抽牌，或使现有标记翻倍',
    resolve: ({ state, inv, api }) => {
      const targets = suppliesAt(state, inv)
      if (!targets.length) return
      const id = targets.length === 1 ? targets[0].id : api.choice({
        kind: 'asset', source: code, seat: inv.seat, prompt: '选择要补充标记的支援。',
        options: targets.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
      })
      const asset = targets.find(item => item.id === id)
      if (!asset) return
      const existing = asset.uses || 0
      const mode = existing > 0 ? api.choice({
        kind: 'effect', source: code, seat: inv.seat, prompt: '选择补充方式。',
        options: [
          { id: 'refill', label: '放置 2 个标记并抽 1 张牌' },
          { id: 'double', label: '使现有标记翻倍' },
        ],
      }) : 'refill'
      api.addUses(asset, mode === 'double' ? existing : 2)
      if (mode === 'refill') api.drawCardsLogged(inv.seat, 1)
    },
  }],
}
