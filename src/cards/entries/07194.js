import { SKILL_NAMES_ZH } from './_shared.js'
export default { code: '07194', abilities: [
  { kind: 'reaction', trigger: 'turnBegins', label: '选择两项不同技能，直到下回合开始各 +1',
    limit: { scope: 'perWindow', owner: 'instance' }, criteria: ({ inv, context }) => context.seat === inv.seat,
    resolve: ({ inv, source, api }) => {
      const skills = ['willpower', 'intellect', 'combat', 'agility'], chosen = []
      for (let n = 0; n < 2; n++) chosen.push(api.choice({ kind: 'effect', source: '07194', seat: inv.seat,
        prompt: `选择第 ${n + 1} 项技能。`, options: skills.filter(skill => !chosen.includes(skill)).map(id => ({ id, label: SKILL_NAMES_ZH[id] })) }))
      api.addEffect({ duration: 'startOfNextTurn', sourceCode: '07194',
        controllerSeat: inv.seat, label: '特里斯坦·博特利：两项技能 +1', modifiers: chosen.map(skill => ({ target: `skill:${skill}`, amount: 1 })) })
    } },
  { kind: 'reaction', trigger: 'testEnds', fromHand: true, noPlayCost: true, label: '揭示过至少 3 枚祝福或诅咒：免费打出特里斯坦',
    criteria: ({ context }) => (context.result?.drawn || []).filter(token => ['bless', 'curse'].includes(token)).length >= 3,
    resolve: ({ inv, api }) => api.playCardFromHandFree(inv.seat, '07194', { noAction: true }) },
] }
