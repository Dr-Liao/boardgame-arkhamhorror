// 10007 以太电流（Aetheric Current）· 幽嘶 · 事件 · 绑定（磁通量稳定器）
// 卡面：
//   绑定（磁通量稳定器）。只有磁通量稳定器（开启）面朝上才能打出。
//   躲避。将你控制的支援卡上所有的线索移动到凯特·温斯罗普身上。你本次躲避尝试可以不使用[agility]，
//   改为使用[intellect]。如果你检定成功，且躲避的目标非[[精英]]，将其混洗入遭遇牌库。
//   抽取 1 张卡牌。将磁通量稳定器翻面（保留所有的标记和附属）。
//
// 读点（卡面 → 引擎读点）：
//   · 绑定关系来自卡面数据（bondedCards / bondedTo），条目不需要额外字段；
//     playCondition 读「受控支援里是否有 10005b 朝上的磁通量稳定器」。
//   · 「躲避。」= played 描述子 `countsAs: 'evade'`，且打出不引发借机攻击。
//   · 可躲避目标：与你交战的敌人，或与你同地点的庞大敌人（与 combat.js#doEvade 的 canEvade 同口径）。
//   · 属性替代：api.evade(seat, { enemyId, skill })（combat.js#actionTestSkill；04232/05113 同一读点；
//     api.evade 自身以 noSpend 结算，打牌的行动已经付过）。
//   · 线索搬移：逐张 api.transferControlledClues(asset → investigator)。
//   · 成功且非精英 → 洗回遭遇牌库：api.removeEnemy + api.shuffleIntoEncounterDeck（04105「劝服」
//     的同一组合；原语会把卡号洗进遭遇牌库并消耗一次洗牌随机）。
//   · 抽 1：api.drawCards；翻面：api.flipAsset(flux, '10005')（保留标记/附属）。
//
// 近似：若躲避把目标以其它方式移出场上（例如剧本替换），则不再洗回遭遇牌库；目标仍存活时按卡面
// 强制洗回（此处没有「可以」）。
const activeFlux = inv => (inv.assets || []).find(asset => asset.code === '10005b')

function evadableEnemies(state, inv) {
  return (state.enemies || []).filter(enemy => enemy.engagedSeat === inv.seat
    || (enemy.massive === true && enemy.location === inv.location))
}

function moveAllAssetClues(inv, api) {
  let moved = 0
  for (const asset of [...(inv.assets || [])]) {
    const clues = Number(asset.clues) || 0
    if (!clues) continue
    moved += api.transferControlledClues(inv.seat, asset.id, 'investigator', clues) || 0
  }
  return moved
}

function flipFluxBack(inv, api) {
  const flux = activeFlux(inv)
  if (!flux) return false
  api.flipAsset(flux, '10005')
  api.info('🧲 磁通量稳定器翻回（关闭）面（保留所有标记与附属）。')
  return true
}

export default {
  code: '10007',
  name: '以太电流（幽嘶）',
  note: '躲避成功后目标仍存活时强制洗回遭遇牌库；若目标已被其它效果移出场上则跳过洗回。',
  playCondition: [
    {
      when: ({ inv }) => Boolean(activeFlux(inv)),
      message: '只有磁通量稳定器（开启）面朝上才能打出「以太电流」',
    },
    {
      when: ({ state, inv }) => evadableEnemies(state, inv).length > 0,
      message: '没有可躲避的敌人（须与你交战或为同地点的庞大敌人）',
    },
  ],
  abilities: [
    {
      kind: 'played',
      label: '躲避（可用智识代替敏捷）：搬回支援线索，成功后把非精英敌人洗回遭遇牌库，抽 1 张，翻回稳定器',
      countsAs: 'evade',
      noOpportunityAttack: true,
      resolve: ({ state, inv, api }) => {
        const moved = moveAllAssetClues(inv, api)
        if (moved) api.info(`🧲 凯特把支援上的 ${moved} 个线索移回自己身上。`)
        const targets = evadableEnemies(state, inv)
        if (!targets.length) {
          api.info('没有可躲避的敌人。')
        } else {
          const useIntellect = api.choice({
            kind: 'skill', source: '10007', seat: inv.seat,
            prompt: '本次躲避尝试使用哪项技能？',
            options: [
              { id: 'intellect', label: '[intellect] 代替 [agility]' },
              { id: 'agility', label: '[agility]' },
            ],
          }) !== 'agility'
          const enemy = targets.length === 1 ? targets[0] : targets.find(card => card.id === api.choice({
            kind: 'target', source: '10007', seat: inv.seat,
            prompt: '选择要躲避的敌人。',
            options: targets.map(card => ({ id: card.id, label: card.name })),
          })) || targets[0]
          const result = api.evade(inv.seat, {
            enemyId: enemy.id,
            skill: useIntellect ? 'intellect' : 'agility',
            sourceCode: '10007',
          })
          if (result?.success && !enemy.elite && state.enemies.includes(enemy)) {
            const name = enemy.name
            api.removeEnemy(enemy)
            api.shuffleIntoEncounterDeck(enemy.code)
            api.info(`🌀 「${name}」被混洗入遭遇牌库。`)
          }
        }
        api.drawCards(inv.seat, 1)
        flipFluxBack(inv, api)
      },
    },
  ],
  modifiers: [],
}
