// 08103 占卜（4 级）
// 卡面：使用(6充能)。
//       [action]：调查。你在本次调查中得到+2技能值，并且可以不使用[intellect]，改为使用[willpower]。
//       如果你成功，花费1、2或3充能。不发现你所在地点的1个线索，改为你每花费1充能，发现你所在地点的1个线索。
//       如果你成功且等于难度，选择你2张手牌并将其弃掉。
//
// 读点同 08101。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08103',
  uses: 6,
  usesType: 'charges',
  abilities: [
    { kind: 'action', label: '占卜调查（+2 技能值，可改用意志，按充能发现线索）', cost: { action: true },
      resolve: ({ inv, source, api }) => {
        const skill = api.choice({ kind: 'effect', source: '08103', seat: inv.seat,
          prompt: '本次调查使用哪项技能？', options: [
            { id: 'intellect', label: '智力' }, { id: 'willpower', label: '意志' },
          ] }) === 'willpower' ? 'willpower' : 'intellect'
        api.investigate(inv.seat, { skill, bonus: 2, noClueDiscovery: true })
        const result = api.testResult()
        if (!result?.success) return
        const max = Math.min(3, source?.uses || 0)
        if (max >= 1) {
          const spend = api.choice({ kind: 'effect', source: '08103', seat: inv.seat,
            prompt: '花费充能：每花费 1 充能发现 1 个线索。',
            options: Array.from({ length: max }, (_, offset) => ({ id: String(offset + 1), label: `花费 ${offset + 1} 充能` })) })
          const spent = Math.max(1, Math.min(max, Number(spend) || 1))
          api.spendUses(source, spent)
          api.discoverClue(inv.seat, spent)
        }
        if (result.value - result.difficulty === 0) api.discardChosen(inv.seat, 2, '08103')
      } },
  ],
  modifiers: [],
}
