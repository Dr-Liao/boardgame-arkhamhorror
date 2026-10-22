// 03317 疯狂漩涡
// 归属：关卡专用 · dimCarcosa（卡尔克萨之路 · 卡城幽影）
// 遭遇组：dim_carcosa
// 卡面：哈斯塔不能被击败。
// 卡面：强制 -如果哈斯塔上有至少3[per_investigator]伤害：推进本密谋。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03317', scope: 'agenda',
  agendaRule: {
    // 背面：四选一。1/2 检定失败后必须改选尚未选过的选项；3/4 直接推进。
    onReveal(state, agenda, api) {
      const chosen = new Set()
      const investigators = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
      for (let guard = 0; guard < 4; guard++) {
        const options = []
        if (!chosen.has('willpower')) options.push({ id: 'willpower', label: '任意调查员检定[意志](4)，成功则推进' })
        if (!chosen.has('intellect')) options.push({ id: 'intellect', label: '任意调查员检定[智识](4)，成功则推进' })
        options.push({ id: 'horror', label: '这不可能是真的：每位调查员受到 2 点恐惧并推进' })
        options.push({ id: 'faint', label: '调查员们昏倒：推进并在新密谋上放置 1 个毁灭' })
        const answer = options.length === 1 ? options[0].id : api.choose({
          kind: 'story', source: '03317', seat: state.campaign.leadSeat ?? 0,
          prompt: '疯狂漩涡：选择挣脱幻觉的方式。', options,
        })
        if (answer === 'horror') {
          for (const inv of investigators) api.horror(inv.seat, 2)
          return
        }
        if (answer === 'faint') {
          api.info?.('调查员们昏倒，过了一会儿才清醒过来。')
          api.addDoom(1)
          return
        }
        const skill = answer === 'intellect' ? 'intellect' : 'willpower'
        const seat = investigators.length === 1 ? investigators[0].seat : Number(api.choose({
          kind: 'investigator', source: '03317', seat: state.campaign.leadSeat ?? 0,
          prompt: `选择进行[${skill === 'willpower' ? '意志' : '智识'}](4)检定的调查员。`,
          options: investigators.map(inv => ({ id: String(inv.seat), label: inv.name })),
        }))
        const tester = state.investigators[seat] || investigators[0]
        let success = false
        api.test(tester.seat, skill, 4, result => { success = result?.success === true })
        if (success) {
          api.info?.(`${tester.name} 检定成功，挣脱了幻觉。`)
          return
        }
        chosen.add(skill)
        api.info?.(`${tester.name} 检定失败，必须选择另一个尚未选择过的选项。`)
      }
    },
  },
}
