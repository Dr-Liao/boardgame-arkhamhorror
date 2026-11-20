// 11672b · storyAsset · obsidianCanyons
//
// 黑曜石之爪（力量面；不能离场）。[action] 横置：攻击；可用[敏捷]代替[战斗]且技能值 +1；
// 若被攻击的敌人已横置，本次攻击伤害 +1。[fast]：翻回（速度）面（每轮一次）。
// 受控剧情资产：controlledAsset + abilities；攻击走 api.fight({skill:'agility', bonus:1, damageBonus})。
export default {
  code: '11672b',
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  cannotLeavePlay: true,
  flags: { obsidianClaw: true, face: 'power' },
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    label: '[action] 横置黑曜石之爪：攻击（可用[敏捷]代替[战斗]，技能值 +1；目标横置时伤害 +1）',
    cost: { exhaust: true },
    criteria: ({ state, inv }) => state.currentSeat === inv.seat,
    target: {
      kind: 'enemy',
      query: ({ state, inv }) => (state.enemies || [])
        .filter(enemy => enemy.location === inv.location && !enemy.defeated)
        .map(enemy => ({ id: enemy.id, label: enemy.name || enemy.code })),
    },
    resolve: ({ state, inv, source, target, api }) => {
      const enemy = (state.enemies || []).find(item => item.id === target?.entity?.id || item.id === target?.id)
        || (state.enemies || []).find(item => item.location === inv.location && !item.defeated)
      if (!enemy) return false
      api.fight(inv.seat, enemy.id, {
        skill: 'agility', bonus: 1, assetId: source.id, sourceCode: '11672b',
        damageBonus: enemy.exhausted ? 1 : 0,
      })
      api.info?.(`黑曜石之爪：攻击「${enemy.name || enemy.code}」（敏捷 +1${enemy.exhausted ? '，目标横置伤害 +1' : ''}）。`)
      return true
    },
  }, {
    kind: 'free',
    actionKind: 'activate',
    label: '[fast]：翻回黑曜石之爪（速度）面（每轮一次）',
    limit: 'oncePerRound',
    criteria: ({ inv, source }) => !source.exhausted && inv.assets.includes(source),
    resolve: ({ inv, source, api }) => {
      const asset = inv.assets.find(item => item.id === source.id)
      if (!asset) return false
      api.flipAsset(asset, '11672a')
      api.info?.('黑曜石之爪翻回（速度）面。')
      return true
    },
  }],
  note: "黑曜石之爪（力量面）。不能离场（cannotLeavePlay，引擎 assetCannotLeavePlay 读点）；[action] 横置攻击（controlledAsset action + cost exhaust + target enemy；resolve api.fight({skill:'agility',bonus:1,damageBonus:目标横置?1:0})）；[fast] 翻回速度面（limit oncePerRound + api.flipAsset → 11672a）。",
}
