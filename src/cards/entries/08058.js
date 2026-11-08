// 08058 红色闹钟（The Red Clock）· 游荡者资产 · 饰品 · 5 经验 · 卓越。
//
// 卡面：卓越。使用(0 充能)。
//       强制 - 在你的回合开始后：你可以拿取此处所有充能，作为资源。在此放置 1 充能。如果它恰好拥有……
//       - 1 充能，下次技能检定中你得到技能值 +4。
//       - 2 充能，你可以移动最多 3 次。
//       - 3 充能，你本回合可以进行 2 次额外行动。
//
// 一卡一文件：这张卡的行为只在这里维护。
// approximation（与 08053 同口径）：「下次技能检定 +4」用 api.addEffect({duration:'endOfTest'})；
// 移动用 api.moveInvestigator 近似（每次移动前按当前位置重算连接，P0-9 修复非法移动）；
// 额外行动用 api.gainAction。注意升级版是「先可以拿取，再放置」。
export default {
  code: '08058',
  uses: 0,
  usesType: 'charges',
  abilities: [
    {
      kind: 'forced',
      trigger: 'turnBegins',
      label: '回合开始：可先拿取全部充能作为资源，再放置 1 充能；按充能数触发 1/2/3 效果',
      criteria: [({ inv, context, source }) => Boolean(source) && context?.seat === inv.seat],
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        const charges = Number(source.uses) || 0
        if (charges > 0) {
          const answer = api.choice({ kind: 'effect', source: '08058', seat: inv.seat, canSkip: true,
            prompt: `「红色闹钟」：是否拿取此处 ${charges} 充能作为资源？`,
            options: [{ id: 'take', label: `拿取 ${charges} 资源` }, { id: 'skip', label: '不拿取' }] })
          if (answer === 'take') {
            api.addUses(source, -charges)
            api.gainResources(inv.seat, charges)
            api.info(`⏰ 「红色闹钟」：拿取 ${charges} 充能作为资源。`)
          }
        }
        api.addUses(source, 1)
        const total = Number(source.uses) || 0
        if (total === 1) {
          api.addEffect({ duration: 'endOfTest', sourceCode: '08058', sourceInstanceId: source.id,
            label: '红色闹钟：下一次技能检定 +4 技能值', modifiers: [{ target: 'skill:*', amount: 4 }] })
          api.info('⏰ 「红色闹钟」：下一次技能检定 +4 技能值。')
        } else if (total === 2) {
          for (let moved = 0; moved < 3; moved++) {
            // 每次移动前按当前位置重算连接（同 08053：固定起点会漏合法目的地并产生非法移动）。
            const here = state.locations.find(location => location.id === inv.location)
            const destinations = (here?.connections || []).filter(id => state.locations.some(location => location.id === id))
            const answers = [{ id: 'skip', label: '不移动' }, ...destinations.map(id => ({ id, label: api.locationName(id) }))]
            if (answers.length === 1) break
            const target = api.choice({ kind: 'move', source: '08058', seat: inv.seat, canSkip: true,
              prompt: `「红色闹钟」：是否移动一次（还可移动 ${3 - moved} 次）？`, options: answers })
            if (target === 'skip') break
            if (!destinations.includes(target)) break
            api.moveInvestigator(inv.seat, target)
            api.info(`⏰ 「红色闹钟」：移动到「${api.locationName(target)}」。`)
          }
        } else if (total === 3) {
          api.gainAction(inv.seat, 2)
          api.info('⏰ 「红色闹钟」：本回合额外 2 次行动。')
        }
      },
    },
  ],
  modifiers: [],
}
