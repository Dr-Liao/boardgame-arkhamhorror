// 08111 身形虚化（Blur，4 级）
// 卡面：使用(4充能)。
// [action] 如果身形虚化还有剩余充能：躲避。你在本次躲避尝试中可以不使用[agility]，改为使用[willpower]，
//        并且得到 +2 技能值。如果你成功，花费 1 或 2 充能，且本回合可以执行对应数量的额外行动。
//        如果你成功且等于难度，受到 2 点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：api.evade（skill/bonus/assetId 与返回值）、api.spendUses、api.gainAction、api.damage。
const code = '08111'

export default {
  code,
  uses: 4,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      label: '躲避：可改用意志、+2 技能；成功花 1–2 充能获得等量额外行动',
      countsAs: 'evade',
      cost: { action: true },
      criteria: [({ source }) => (source?.uses || 0) > 0],
      target: { kind: 'enemy', query: ({ inv, entity }) => entity.engagedSeat === inv.seat },
      resolve: ({ inv, source, target, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        const skill = inv.willpower === inv.agility
          ? 'agility'
          : api.choice({
            kind: 'effect', source: code, seat: inv.seat,
            prompt: '身形虚化：本次躲避尝试使用哪个技能？',
            options: [{ id: 'agility', label: '使用敏捷' }, { id: 'willpower', label: '改用意志' }],
          })
        const result = api.evade(inv.seat, {
          enemyId: enemy.id,
          skill: skill === 'willpower' ? 'willpower' : 'agility',
          bonus: 2,
          assetId: source?.id,
          sourceCode: code,
        })
        if (!result?.success) return
        const maximum = Math.min(2, source?.uses || 0)
        if (maximum < 1) return
        const spend = maximum === 1 ? 1 : Number(api.choice({
          kind: 'effect', source: code, seat: inv.seat,
          prompt: '身形虚化：成功。花费几点充能（获得等量额外行动）？',
          options: Array.from({ length: maximum }, (_, index) => ({
            id: String(index + 1), label: `花费 ${index + 1} 充能，获得 ${index + 1} 个额外行动`,
          })),
        }))
        const amount = Math.max(1, Math.min(maximum, Number.isSafeInteger(spend) ? spend : 1))
        api.spendUses(source, amount)
        api.gainAction(inv.seat, amount)
        api.info(`🌀 「身形虚化」：${inv.name} 躲避成功，花费 ${amount} 充能并获得 ${amount} 个额外行动。`)
        if (result.value - result.difficulty === 0) {
          api.damage(inv.seat, 2)
          api.info(`🌀 「身形虚化」：成功且等于难度，${inv.name} 受到 2 点伤害。`)
        }
      },
    },
  ],
  modifiers: [],
}
