// 08053 红色闹钟（The Red Clock）· 游荡者资产 · 饰品 · 2 经验 · 卓越。
//
// 卡面：卓越。使用(0 充能)。
//       强制 - 在你的回合开始后：在此放置 1 充能，或拿取此处所有充能作为资源。然后，如果它恰好拥有……
//       - 1 充能，下次技能检定中你得到技能值 +3。
//       - 2 充能，你可以移动最多 2 次。
//       - 3 充能，你本回合可以进行 1 次额外行动。
//
// 一卡一文件：这张卡的行为只在这里维护。
// approximation:
//   · 「下次技能检定 +3」用 api.addEffect({duration:'endOfTest', modifiers:[{target:'skill:*',amount:3}]})
//     （Lead 指定的 08013a 已验证模式；效果在下一次技能检定结束时过期）。
//   · 「移动最多 2 次」用 api.moveInvestigator 近似（不经过移动行动/借机攻击结算）；
//     每次移动前按当前位置的 connections 重算目的地（P0-9 修复：不再固定回合开始地点枚举，
//     不会出现与当前位置不相连的非法目的地，也不会漏掉当前位置的合法连接）。
//   · 「额外行动」用 api.gainAction。
export default {
  code: '08053',
  uses: 0,
  usesType: 'charges',
  abilities: [
    {
      kind: 'forced',
      trigger: 'turnBegins',
      label: '回合开始：放置 1 充能或拿取全部充能作为资源；按充能数触发 1/2/3 效果',
      criteria: [({ inv, context, source }) => Boolean(source) && context?.seat === inv.seat],
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        const charges = Number(source.uses) || 0
        const options = [{ id: 'place', label: '在此放置 1 充能' }]
        if (charges > 0) options.push({ id: 'take', label: `拿取此处 ${charges} 充能作为资源` })
        const choice = options.length === 1 ? 'place'
          : api.choice({ kind: 'effect', source: '08053', seat: inv.seat,
            prompt: '红色闹钟：放置充能，还是拿取充能作为资源？', options })
        if (choice === 'take') {
          api.addUses(source, -charges)
          api.gainResources(inv.seat, charges)
          api.info(`⏰ 「红色闹钟」：拿取 ${charges} 充能作为资源。`)
        } else {
          api.addUses(source, 1)
          api.info(`⏰ 「红色闹钟」：放置 1 充能（当前 ${source.uses || 0}）。`)
        }
        const total = Number(source.uses) || 0
        if (total === 1) {
          api.addEffect({ duration: 'endOfTest', sourceCode: '08053', sourceInstanceId: source.id,
            label: '红色闹钟：下一次技能检定 +3 技能值', modifiers: [{ target: 'skill:*', amount: 3 }] })
          api.info('⏰ 「红色闹钟」：下一次技能检定 +3 技能值。')
        } else if (total === 2) {
          for (let moved = 0; moved < 2; moved++) {
            // 每次移动前按当前位置重算连接：固定用回合开始地点会把「当前位置的邻居」
            // 漏掉、并把第一次移动后的非法目的地列出来（可移到不相连地点）。
            const here = state.locations.find(location => location.id === inv.location)
            const destinations = (here?.connections || []).filter(id => state.locations.some(location => location.id === id))
            const answers = [{ id: 'skip', label: '不移动' }, ...destinations.map(id => ({ id, label: api.locationName(id) }))]
            if (answers.length === 1) break
            const target = api.choice({ kind: 'move', source: '08053', seat: inv.seat, canSkip: true,
              prompt: `红色闹钟：是否移动一次（还可移动 ${2 - moved} 次）？`, options: answers })
            if (target === 'skip') break
            if (!destinations.includes(target)) break
            api.moveInvestigator(inv.seat, target)
            api.info(`⏰ 「红色闹钟」：移动到「${api.locationName(target)}」。`)
          }
        } else if (total === 3) {
          api.gainAction(inv.seat, 1)
          api.info('⏰ 「红色闹钟」：本回合额外 1 次行动。')
        }
      },
    },
  ],
  modifiers: [],
}
