// 08119 尘世宁静（Earthly Serenity，4 级）
// 卡面：使用(6充能)。
// [action]：检定[willpower](0)。你每成功且超过难度 1 点，你可以花费 1 充能来治愈你所在地点
//        一位调查员 1 点伤害或 1 点恐惧。如果你成功且等于难度，失去 2 资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 与 08117 同模板，难度 0 / 充能 6 / 等难度时失去 2 资源（来源：EarthlySerenity4.hs）。
const code = '08119'
const DIFFICULTY = 0

export default {
  code,
  uses: 6,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      label: '意志(0)：每超过难度 1 点，可花 1 充能治愈同地点调查员 1 伤害/恐惧',
      cost: { action: true },
      resolve: ({ state, inv, source, api }) => {
        const result = api.test(inv.seat, 'willpower', DIFFICULTY, {
          source: { label: '意志检定', name: api.cardName(code), code },
        })
        if (!result?.success) return
        const successBy = Math.max(0, result.value - result.difficulty)
        if (successBy === 0) {
          api.loseResources(inv.seat, 2)
          api.info(`🌿 「尘世宁静」：成功且等于难度，${inv.name} 失去 2 资源。`)
          return
        }
        for (let point = 0; point < successBy; point++) {
          if ((source?.uses || 0) <= 0) break
          const targets = state.investigators.filter(other => !other.defeated && !other.resigned
            && other.location === inv.location)
          const options = [{ id: 'skip', label: '不花费充能' }]
          for (const target of targets) {
            if ((target.damage || 0) > 0) options.push({ id: `damage:${target.seat}`, label: `治愈 ${target.name} 1 点伤害` })
            if ((target.horror || 0) > 0) options.push({ id: `horror:${target.seat}`, label: `治愈 ${target.name} 1 点恐惧` })
          }
          if (options.length === 1) break
          const answer = options.length === 2 && options[0].id === 'skip' ? options[1].id : api.choice({
            kind: 'effect', source: code, seat: inv.seat,
            prompt: `「尘世宁静」：可花费 1 充能治愈同地点调查员 1 点伤害或恐惧（剩余可结算 ${successBy - point} 次）。`,
            options,
          })
          if (!answer || answer === 'skip') break
          const [kind, seatText] = String(answer).split(':')
          const target = state.investigators[Number(seatText)]
          if (!target) break
          api.spendUses(source, 1)
          if (kind === 'damage') api.healDamage(target.seat, 1)
          else api.healHorror(target.seat, 1)
          api.info(`🌿 「尘世宁静」：治愈 ${target.name} 1 点${kind === 'damage' ? '伤害' : '恐惧'}。`)
        }
      },
    },
  ],
  modifiers: [],
}
