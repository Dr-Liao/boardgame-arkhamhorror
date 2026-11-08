// 08042 通路档案
// 卡面：研究完成。使用(4 灵脉)。每套牌库仅限 1 张。
//       [free]：从本支援上移动 1 灵脉到一个已揭示地点。
//       [action]：选择一位调查员和一个带有灵脉的已揭示地点。该调查员移动到该地点。
//       你可以移除该灵脉来让该调查员执行一次调查行动。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// approximation：同 08041——地点上的灵脉用地点特性原语记录（不持久化到敌人/调查员）；此处移动灵脉
// 退化为扣减 uses 并给地点加 [[LeyLine]] 授予；动作的「带灵脉的已揭示地点」按该特性过滤。
const LEY_TRAIT = 'LeyLine'
const SOURCE = '08042'

export default {
  code: '08042',
  abilities: [
    {
      kind: 'entersPlay',
      label: '入场：获得 4 个灵脉（使用次数）',
      resolve: ({ source, api }) => {
        if (source) api.setAssetUses(source, 4)
      },
    },
    {
      kind: 'free',
      label: '从本支援移动 1 灵脉到一个已揭示地点',
      cost: { action: false },
      resolve: ({ state, inv, source, api }) => {
        if (!source || (source.uses || 0) <= 0) return api.info('通路档案：本支援上没有灵脉。')
        const candidates = (state.locations || []).filter(location => location.revealed === true)
        if (!candidates.length) return api.info('通路档案：没有已揭示地点。')
        const chosen = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'location', source: SOURCE, seat: inv.seat,
          prompt: '通路档案：选择要放置灵脉的已揭示地点。',
          options: candidates.map(location => ({ id: location.id, label: api.locName(location.id) })),
        })
        const target = candidates.find(location => location.id === chosen) || candidates[0]
        api.setAssetUses(source, (source.uses || 0) - 1)
        api.addLocationTrait(target, LEY_TRAIT, { source: SOURCE })
        api.info(`通路档案：在「${api.locName(target.id)}」放置 1 灵脉。`)
      },
    },
    {
      kind: 'action',
      label: '选择调查员与带灵脉的已揭示地点：移动该调查员；可移除灵脉令其调查一次',
      cost: { action: true },
      resolve: ({ state, inv, source, api }) => {
        const investigators = (state.investigators || []).filter(person => !person.defeated && !person.resigned)
        const locations = (state.locations || []).filter(location => location.revealed === true)
        if (!investigators.length || !locations.length) return api.info('通路档案：没有合法的调查员/地点。')
        const chosenInvestigator = investigators.length === 1 ? String(investigators[0].seat) : api.choice({
          kind: 'investigator', source: SOURCE, seat: inv.seat,
          prompt: '通路档案：选择要移动的调查员。',
          options: investigators.map(person => ({ id: String(person.seat), label: person.name })),
        })
        const person = investigators.find(item => String(item.seat) === String(chosenInvestigator)) || investigators[0]
        const chosenLocation = locations.length === 1 ? locations[0].id : api.choice({
          kind: 'location', source: SOURCE, seat: inv.seat,
          prompt: '通路档案：选择带灵脉的已揭示地点。',
          options: locations.map(location => ({ id: location.id, label: api.locName(location.id) })),
        })
        const location = locations.find(item => item.id === chosenLocation) || locations[0]
        api.moveInvestigator(person.seat, location.id)
        api.info(`通路档案：将 ${person.name} 移动到「${api.locName(location.id)}」。`)
        const marked = (location.traitGrants?.[LEY_TRAIT] || []).includes(SOURCE)
        if (marked) {
          const remove = api.choice({
            kind: 'effect', source: SOURCE, seat: inv.seat, canSkip: true,
            prompt: '通路档案：是否移除灵脉，让该调查员执行一次调查行动？',
            options: [{ id: 'skip', label: '不移除' }, { id: 'remove', label: '移除灵脉并调查一次' }],
          })
          if (remove === 'remove') {
            api.removeLocationTrait(location, LEY_TRAIT, { source: SOURCE })
            api.investigate(person.seat, { locationId: location.id })
          }
        }
      },
    },
  ],
  modifiers: [],
}
