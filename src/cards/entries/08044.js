// 08044 通路档案
// 卡面：研究完成。使用(4 灵脉)。每套牌库仅限 1 张。
//       [free]：从本支援上移动 1 灵脉到一位调查员上。
//       [action]：选择一位带有灵脉的调查员。该调查员抽取 1 张卡牌并治愈 1 点伤害或恐惧。
//       你可以移除该灵脉来使该调查员改为抽取 2 张卡牌并治愈 2 点伤害或恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// approximation：灵脉不落在调查员实例上（请求 m2-1-08033.json）；移动灵脉只扣 uses，动作的
// 「带有灵脉的调查员」退化为任意存活调查员（由玩家选择）；「治愈 1 点伤害或恐惧」按玩家选择分支。
export default {
  code: '08044',
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
      label: '从本支援移动 1 灵脉到一位调查员',
      cost: { action: false },
      resolve: ({ state, inv, source, api }) => {
        if (!source || (source.uses || 0) <= 0) return api.info('通路档案：本支援上没有灵脉。')
        const candidates = (state.investigators || []).filter(person => !person.defeated && !person.resigned)
        if (!candidates.length) return api.info('通路档案：没有调查员。')
        const chosen = candidates.length === 1 ? String(candidates[0].seat) : api.choice({
          kind: 'investigator', source: '08044', seat: inv.seat,
          prompt: '通路档案：选择要放置灵脉的调查员。',
          options: candidates.map(person => ({ id: String(person.seat), label: person.name })),
        })
        const person = candidates.find(item => String(item.seat) === String(chosen)) || candidates[0]
        api.setAssetUses(source, (source.uses || 0) - 1)
        api.info(`通路档案：把 1 灵脉放到 ${person.name} 上（近似：仅扣减灵脉数）。`)
      },
    },
    {
      kind: 'action',
      label: '选择一位调查员：抽 1 并治愈 1 点伤害/恐惧；可移除灵脉改为抽 2 治愈 2',
      cost: { action: true },
      resolve: ({ state, inv, source, api }) => {
        const candidates = (state.investigators || []).filter(person => !person.defeated && !person.resigned)
        if (!candidates.length) return api.info('通路档案：没有调查员。')
        const chosen = candidates.length === 1 ? String(candidates[0].seat) : api.choice({
          kind: 'investigator', source: '08044', seat: inv.seat,
          prompt: '通路档案：选择带有灵脉的调查员。',
          options: candidates.map(person => ({ id: String(person.seat), label: person.name })),
        })
        const person = candidates.find(item => String(item.seat) === String(chosen)) || candidates[0]
        let amount = 1
        if ((source.uses || 0) > 0) {
          const remove = api.choice({
            kind: 'effect', source: '08044', seat: inv.seat, canSkip: true,
            prompt: '通路档案：是否移除 1 灵脉，改为抽 2 张并治愈 2 点？',
            options: [{ id: 'skip', label: '不移除' }, { id: 'remove', label: '移除灵脉（抽 2 治愈 2）' }],
          })
          if (remove === 'remove') {
            api.setAssetUses(source, (source.uses || 0) - 1)
            amount = 2
          }
        }
        api.drawCards(person.seat, amount)
        const kind = api.choice({
          kind: 'effect', source: '08044', seat: person.seat,
          prompt: '通路档案：治愈伤害还是恐惧？',
          options: [{ id: 'damage', label: '治愈伤害' }, { id: 'horror', label: '治愈恐惧' }],
        })
        if (kind === 'horror') api.healHorror(person.seat, amount)
        else api.healDamage(person.seat, amount)
        api.info(`通路档案：${person.name} 抽 ${amount} 张并治愈 ${amount} 点${kind === 'horror' ? '恐惧' : '伤害'}。`)
      },
    },
  ],
  modifiers: [],
}
