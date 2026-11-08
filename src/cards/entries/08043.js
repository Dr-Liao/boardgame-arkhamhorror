// 08043 通路档案
// 卡面：研究完成。使用(4 灵脉)。每套牌库仅限 1 张。
//       [free]：从本支援上移动 1 灵脉到一个非[[精英]]敌人。
//       [action]：选择一位与带有灵脉的敌人交战的调查员。该调查员与带有灵脉的一个敌人解除交战，
//       并移动至一个连接地点。你可以移除该灵脉来自动躲避该敌人。本行动不会触发趁乱攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// approximation：灵脉不落在敌人实例上（请求 m2-1-08033.json），敌人标记只扣 uses；「与带灵脉敌人
// 交战」退化为任意交战敌人。解除交战用 api.autoEvadeEnemy（会同时横置敌人：卡面只解除交战），
// 之后再移动到所选连接地点；noOpportunityAttack 由描述子声明。
export default {
  code: '08043',
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
      label: '从本支援移动 1 灵脉到一个非精英敌人',
      cost: { action: false },
      resolve: ({ state, inv, source, api }) => {
        if (!source || (source.uses || 0) <= 0) return api.info('通路档案：本支援上没有灵脉。')
        const candidates = (state.enemies || []).filter(enemy => !enemy.elite)
        if (!candidates.length) return api.info('通路档案：没有非精英敌人。')
        const chosen = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: '08043', seat: inv.seat,
          prompt: '通路档案：选择要放置灵脉的非精英敌人。',
          options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = candidates.find(item => item.id === chosen) || candidates[0]
        api.setAssetUses(source, (source.uses || 0) - 1)
        api.info(`通路档案：把 1 灵脉移到「${enemy.name}」上（近似：仅扣减灵脉数）。`)
      },
    },
    {
      kind: 'action',
      label: '选择与带灵脉敌人交战的调查员：解除交战并移动到连接地点；可移除灵脉自动躲避',
      cost: { action: true },
      noOpportunityAttack: true,
      resolve: ({ state, inv, source, api }) => {
        const investigators = (state.investigators || []).filter(person => !person.defeated && !person.resigned
          && (person.engaged || []).length > 0)
        if (!investigators.length) return api.info('通路档案：没有与敌人交战的调查员。')
        const chosenInvestigator = investigators.length === 1 ? String(investigators[0].seat) : api.choice({
          kind: 'investigator', source: '08043', seat: inv.seat,
          prompt: '通路档案：选择与敌人交战的调查员。',
          options: investigators.map(person => ({ id: String(person.seat), label: person.name })),
        })
        const person = investigators.find(item => String(item.seat) === String(chosenInvestigator)) || investigators[0]
        const enemy = (state.enemies || []).find(item => (person.engaged || []).includes(item.id))
        if (!enemy) return api.info('通路档案：该调查员没有交战的敌人。')
        api.autoEvadeEnemy(enemy)
        const here = (state.locations || []).find(location => location.id === person.location)
        const destinations = (here?.connections || [])
          .map(id => (state.locations || []).find(location => location.id === id))
          .filter(Boolean)
        if (!destinations.length) {
          api.info('通路档案：没有连接地点。')
        } else {
          const chosenLocation = destinations.length === 1 ? destinations[0].id : api.choice({
            kind: 'location', source: '08043', seat: inv.seat,
            prompt: '通路档案：选择要移动到的连接地点。',
            options: destinations.map(location => ({ id: location.id, label: api.locName(location.id) })),
          })
          const target = destinations.find(location => location.id === chosenLocation) || destinations[0]
          api.moveInvestigator(person.seat, target.id)
          api.info(`通路档案：${person.name} 解除与「${enemy.name}」的交战并移动到「${api.locName(target.id)}」。`)
        }
        if ((source.uses || 0) > 0) {
          const remove = api.choice({
            kind: 'effect', source: '08043', seat: inv.seat, canSkip: true,
            prompt: '通路档案：是否移除 1 灵脉来自动躲避该敌人？',
            options: [{ id: 'skip', label: '不移除' }, { id: 'remove', label: '移除灵脉自动躲避' }],
          })
          if (remove === 'remove') {
            api.setAssetUses(source, (source.uses || 0) - 1)
            api.autoEvadeEnemy(enemy)
          }
        }
      },
    },
  ],
  modifiers: [],
}
