// 08033 通路档案
// 卡面：每套牌库仅限 1 张。作为打出本支援的额外费用，在 4 个不同地点放置 1 个资源，作为灵脉。
//       [reaction] 在你成功调查了一个带有灵脉的地点后，横置本支援：将该灵脉移动至本支援上。
//       然后，如果本卡牌上有 4 个灵脉，将其弃掉，拿取本卡牌的灵脉作为资源，并在剧本日志里记录
//       “你已经确认了前行道路”。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// approximation：没有通用「灵脉」标记原语（请求 m2-1-08033.json）。这里用已登记的地点特性原语
// api.addLocationTrait(location,'LeyLine',{source:'08033'}) 记地点上的灵脉、用 api.addUses(asset,1)
// 记本卡上的灵脉数；「本卡牌上有 4 个灵脉 → 弃掉并拿取 4 资源」按使用次数阈值实现；剧本日志记录用
// api.setScenarioFlag('eoteConfirmedPath',true) 近似（替代剧本日志文本）。
const LEY_TRAIT = 'LeyLine'
const SOURCE = '08033'
const hasLeyLine = location => (location?.traitGrants?.[LEY_TRAIT] || []).includes(SOURCE)

export default {
  code: '08033',
  abilities: [
    {
      kind: 'entersPlay',
      label: '额外费用：在 4 个不同地点各放置 1 个资源作为灵脉',
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        if ((inv.resources || 0) < 4) {
          api.info('通路档案：资源不足 4，无法在 4 个地点放置灵脉。')
          return
        }
        const chosenLocations = []
        for (let i = 0; i < 4; i++) {
          const candidates = (state.locations || []).filter(location => !chosenLocations.includes(location.id))
          if (!candidates.length) break
          const answer = candidates.length === 1 ? candidates[0].id : api.choice({
            kind: 'location', source: SOURCE, seat: inv.seat,
            prompt: `通路档案：选择放置灵脉的地点（${i + 1}/4）。`,
            options: candidates.map(location => ({ id: location.id, label: api.locName(location.id) })),
          })
          const target = candidates.find(location => location.id === answer) || candidates[0]
          if (api.spendResources(inv.seat, 1)) {
            api.addLocationTrait(target, LEY_TRAIT, { source: SOURCE })
            chosenLocations.push(target.id)
            api.info(`通路档案：在「${api.locName(target.id)}」放置 1 个灵脉。`)
          }
        }
        if (chosenLocations.length < 4) api.info('通路档案：地点不足以放置 4 个灵脉。')
      },
    },
    {
      kind: 'reaction',
      trigger: 'investigateSuccess',
      label: '横置：把已调查地点上的灵脉移到本卡；集齐 4 个则弃卡并获得 4 资源',
      criteria: ({ state, context }) => {
        const location = (state.locations || []).find(item => item.id === context?.location)
        return Boolean(location && hasLeyLine(location))
      },
      cost: { exhaust: true },
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        const location = (state.locations || []).find(item => item.id === inv.location)
          || (state.locations || []).find(item => hasLeyLine(item))
        if (location && hasLeyLine(location)) {
          api.removeLocationTrait(location, LEY_TRAIT, { source: SOURCE })
          api.addUses(source, 1)
          api.info(`通路档案：把「${api.locName(location.id)}」的灵脉移到本卡（${source.uses || 0}/4）。`)
        }
        if ((source.uses || 0) >= 4) {
          const resources = source.uses || 4
          api.discardAsset(inv.seat, source)
          api.gainResources(inv.seat, resources)
          api.setScenarioFlag('eoteConfirmedPath', true)
          api.info(`通路档案：集齐 ${resources} 个灵脉，弃掉本卡并获得 ${resources} 资源；记录“你已经确认了前行道路”。`)
        }
      },
    },
  ],
  modifiers: [],
}
