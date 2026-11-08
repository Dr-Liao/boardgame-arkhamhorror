// 08118 附魔弓（Enchanted Bow）
// 卡面：使用(3充能)。
// [action] 横置附魔弓：攻击。你本次攻击得到 +1 技能值，并且必须改为使用[willpower]或[agility]，
//        而不使用[combat]。本次攻击造成 +1 伤害。
//        作为发动此能力的额外费用，你可以花费 1 充能来使本次攻击以一个连接地点的非[[精英]]敌人
//        为目标；如果你这样做，在本次攻击中，忽略冷漠和反击关键词。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：api.fight 支持 skill / combatBonus / damageBonus / atConnectingLocation / ignoreAloof /
// ignoreRetaliate（与「枪法如神」同一 doFight 管线）；额外费用用 api.spendUses。
// 目标集合含连接地点的非精英敌人（target 描述子只收窄默认「同地点」候选，无法扩大，
// 因此这里用 resolve 内的 api.choice 从「同地点全部 + 连接地点非精英」里选，同 05282 的写法）。
const code = '08118'

function bowUses(inv) {
  return (inv.assets || []).find(item => item.code === code)?.uses || 0
}

export default {
  code,
  uses: 3,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      label: '攻击：意志/敏捷替代战斗，+1 技能 +1 伤害（可花 1 充能打连接地点非精英）',
      countsAs: 'fight',
      cost: { action: true, exhaust: true },
      resolve: ({ state, inv, source, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        const connections = here?.connections || []
        const targets = state.enemies.filter(enemyCard => {
          if (enemyCard.defeated) return false
          if (enemyCard.location === inv.location) return true
          return connections.includes(enemyCard.location) && !enemyCard.elite && bowUses(inv) > 0
        })
        if (!targets.length) {
          api.info('「附魔弓」：没有可攻击的敌人。')
          return
        }
        const label = enemyCard => `${enemyCard.name}（${api.locationName(enemyCard.location)}）`
        const chosenId = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: code, seat: inv.seat,
          prompt: '附魔弓：选择攻击目标（连接地点的非精英敌人需花费 1 充能）。',
          options: targets.map(enemyCard => ({ id: enemyCard.id, label: label(enemyCard) })),
        })
        const enemy = targets.find(item => item.id === chosenId)
        if (!enemy) return
        const skill = api.choice({
          kind: 'effect', source: code, seat: inv.seat,
          prompt: '附魔弓：本次攻击使用意志还是敏捷（替代战斗）？',
          options: [{ id: 'willpower', label: '使用意志' }, { id: 'agility', label: '使用敏捷' }],
        })
        const fromConnecting = enemy.location !== inv.location
        if (fromConnecting) api.spendUses(source, 1)
        api.info(`🏹 「附魔弓」：${inv.name} 使用${skill === 'agility' ? '敏捷' : '意志'}攻击「${enemy.name}」`
          + (fromConnecting ? '（花费 1 充能，忽略冷漠与反击）' : '') + '。')
        api.fight(inv.seat, enemy.id, {
          assetId: source?.id,
          skill: skill === 'agility' ? 'agility' : 'willpower',
          combatBonus: 1,
          damageBonus: 1,
          atConnectingLocation: fromConnecting,
          ignoreAloof: fromConnecting,
          ignoreRetaliate: fromConnecting,
          sourceCode: code,
          noSpend: true,
        })
      },
    },
  ],
  modifiers: [],
}
