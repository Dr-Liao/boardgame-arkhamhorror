// 82035 催眠术 · 诡计（恐怖狂欢节）
// 卡面：显现 - 若你所在地点没有戴面具的狂欢节行人，本卡获得涌动。
//       若你所在地点有戴面具的狂欢节行人，把它翻面。若它是无辜的狂欢者，放到议程牌库下方。
// 读点：条目 encounterResolve + 引擎 resolveScenarioEvent（behavior.flipMaskedGoer）；
//       本实现用场景计数近似实体双面资产（见 behavior 文件头注释）。
export default {
  code: '82035',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const current = state.scenarioFlags?.carnevale || {}
    const masked = Number(current.maskedGoers || 0)
    const hereHasMasked = masked > 0 && Array.isArray(current.ring)
      && current.ring.filter(id => id !== 'sanMarcoBasilica').length > 0
    if (!hereHasMasked) {
      api.info?.('🌀 催眠术：场上没有面具行人，本卡获得涌动（再抽一张遭遇牌）。')
      api.drawEncounter?.(inv.seat, { surgeDraw: true })
      return true
    }
    api.resolveScenarioEvent?.('carnevaleFlipMaskedGoer', { choose: false })
    api.info?.('🌀 催眠术：一名戴面具的狂欢节行人被翻面（本实现按场景计数近似）。')
    return true
  },
  note: '由 encounterResolve 结算：无面具行人→涌动加抽；否则翻 1 名面具行人（场景计数近似）。',
}
