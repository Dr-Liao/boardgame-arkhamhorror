// 09022 符文斧（Runic Axe）· 守卫者资产 · 0 经验 · 定制 · 独特。
// 卡面：定制。使用(4 充能)。当每轮开始时重新补满这些充能中的 1 点。
//       [action]：攻击。你本次攻击得到 +1[combat]。这次攻击前，你可以花费任意数量的充能，
//       以此为斧子灌注对应数量的不同铭文 ——
//       - 精准：你本次攻击得到额外 +2[combat]。
//       - 力量：本次攻击造成 +1 伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 充能 = 条目 uses/usesType，读写走 api.addUses（-1 花充能 / 每轮 +1 补满至 4）；
//   · 铭文在攻击前逐枚选择（api.choice），不同铭文按勾选解锁：基础「精准/力量」+
//     荣耀/长者/追猎/狂怒（定制项 1–4）；Ancient Power（5）允许同一铭文灌注至多 3 次；
//     Scriptweaver（7）让每 1 充能灌注最多 2 个不同铭文；
//   · Spellweaver/Saga 的补满数：Saga（6）→ 每轮补 2；Saga 的「改为 2」由 checked 判定；
//   · Heirloom（0）的 -1 费用：customizationEffects.playCost（面板契约）+ 条目
//     playCostModifier（turn-flow.js#playCost 的真实读点）；[[Relic]] 特性用 add:trait 修正。
// approximation：Glory 的「治愈 1 点伤害/恐惧」由 api.healDamage/healHorror 结算（目标限定自己，
//   与卡面一致）；Elders 的「超过难度值 ≥ 隐藏值」用 api.locationShroud 读当前地点隐藏值。
import { customizationChecked } from '../../engine/tsk-customizable.js'

const SOURCE = '09022'
const checked = (state, inv) => customizationChecked(state, inv?.seat ?? state.currentSeat, SOURCE)
const isChecked = (state, inv, index) => checked(state, inv).includes(index)
const MAX_CHARGES = 4
const INSCRIPTIONS = [
  { id: 'accuracy', label: '精准：本次攻击额外 +2[combat]' },
  { id: 'power', label: '力量：本次攻击 +1 伤害' },
]
const CUSTOM_INSCRIPTIONS = [
  { id: 'glory', index: 1, label: '荣耀：若本次攻击击败敌人，抽 1 张牌 / 治愈 1 点伤害 / 治愈 1 点恐惧' },
  { id: 'elders', index: 2, label: '长者：若成功值 ≥ 地点隐藏值，发现 1 个线索' },
  { id: 'hunt', index: 3, label: '追猎：立刻移动到连接地点或与同地点敌人交战' },
  { id: 'fury', index: 4, label: '狂怒：若攻击成功，对与你交战的其他每个敌人各造成 1 点伤害' },
]

const inscriptionChoices = (state, inv) => [
  ...INSCRIPTIONS,
  ...CUSTOM_INSCRIPTIONS.filter(item => isChecked(state, inv, item.index)).map(({ id, label }) => ({ id, label })),
]

export default {
  code: '09022',
  uses: MAX_CHARGES,
  usesType: 'charges',
  playCostModifier: ({ state, inv }) => (isChecked(state, inv, 0) ? -1 : 0),
  customizationEffects: {
    playCost: checkedCounts => ((checkedCounts || []).filter(index => index === 0).length ? -1 : 0),
  },
  customizationOptions: [
    { name: 'Heirloom', checks: 1, text: 'This asset gets -1 cost and gains the [[Relic]] trait.' },
    { name: 'Inscription of Glory', checks: 1, text: 'Add this inscription: "- Glory - If this attack defeats an enemy, choose one: draw 1 card, heal 1 damage, or heal 1 horror."' },
    { name: 'Inscription of the Elders', checks: 1, text: 'Add this inscription: "- Elders - If this attack succeeds by an amount equal to or greater than your location\'s shroud, discover 1 clue at your location."' },
    { name: 'Inscription of the Hunt', checks: 1, text: 'Add this inscription: "- Hunt - Immediately move to a connecting location or engage an enemy at your location."' },
    { name: 'Inscription of Fury', checks: 1, text: 'Add this inscription: "- Fury - If this attack is successful, in addition to its standard damage, deal 1 damage to each other enemy engaged with you."' },
    { name: 'Ancient Power', checks: 3, text: 'You may imbue the same inscription up to three times.' },
    { name: 'Saga', checks: 3, text: 'Replenish 2 of Runic Axe\'s charges at the start of each round, instead of only 1.' },
    { name: 'Scriptweaver', checks: 4, text: 'For every charge spent, you may imbue the axe with up to two different inscriptions.' },
  ],
  modifiers: [
    { target: 'add:trait', value: 'Relic', condition: { when: ({ state, inv }) => isChecked(state, inv, 0) } },
  ],
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      label: '攻击：+1[combat]；攻击前可花费充能灌注铭文（精准 +2[combat] / 力量 +1 伤害等）',
      cost: { action: true },
      resolve: ({ state, inv, source, api }) => {
        const enemies = api.enemiesAt(inv.location)
        if (!enemies.length) {
          api.info('符文斧：这里没有可攻击的敌人。')
          return
        }
        const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: source?.id ?? SOURCE, seat: inv.seat,
          prompt: '符文斧：选择要攻击的敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const target = state.enemies.find(enemy => enemy.id === enemyId) || enemies[0]
        // 攻击前：花费任意数量充能（use 上限受当前充能与「每充能最多 2 个铭文」约束）。
        const available = source?.uses || 0
        const perCharge = isChecked(state, inv, 7) ? 2 : 1
        let spend = 0
        if (available > 0) {
          const answer = api.choice({
            kind: 'effect', source: source?.id ?? SOURCE, seat: inv.seat,
            prompt: `符文斧：花费多少充能灌注铭文？（现有 ${available}，每 1 充能最多 ${perCharge} 个铭文）`,
            options: Array.from({ length: available + 1 }, (_, count) => ({ id: String(count), label: `${count} 充能` })),
          })
          spend = Math.max(0, Math.min(available, Number(answer) || 0))
        }
        const picks = []
        const maxRepeats = isChecked(state, inv, 5) ? 3 : 1
        for (let index = 0; index < spend * perCharge; index++) {
          const usable = inscriptionChoices(state, inv).filter(item => picks.filter(id => id === item.id).length < maxRepeats)
          if (!usable.length) break
          const pick = api.choice({
            kind: 'effect', source: source?.id ?? SOURCE, seat: inv.seat,
            prompt: `符文斧：选择第 ${index + 1} 个铭文。`,
            options: usable.map(item => ({ id: item.id, label: item.label })),
          })
          picks.push(usable.some(item => item.id === pick) ? pick : usable[0].id)
        }
        if (spend > 0) api.addUses(source, -spend)
        const accuracy = picks.filter(id => id === 'accuracy').length
        const power = picks.filter(id => id === 'power').length
        const combatBonus = 1 + accuracy * 2
        api.info(`符文斧：灌注 ${picks.length} 个铭文（精准 ${accuracy}、力量 ${power}），本次攻击 +${combatBonus}[combat]${power ? ` +${power} 伤害` : ''}。`)
        api.fight(inv.seat, target.id, { combatBonus, damageBonus: power, noSpend: true })
        const result = api.testResult()
        if (!result?.success) return
        // 长者：成功值 ≥ 地点隐藏值 → 发现 1 个线索。
        if (picks.includes('elders')) {
          const shroud = api.locationShroud(inv.location) ?? 0
          if ((result.value - result.difficulty) >= shroud) api.discoverClue(inv.seat, 1)
        }
        // 狂怒：攻击成功后对与你交战的其他每个敌人各 1 点伤害。
        if (picks.includes('fury')) {
          for (const other of api.engagedEnemies(inv.seat)) {
            if (other.id !== target.id) api.damageEnemy(other, 1, inv.seat, { code: SOURCE })
          }
        }
        // 荣耀：本次攻击击败敌人后三选一。
        if (picks.includes('glory') && !api.isEnemyInPlay(target)) {
          const answer = api.choice({
            kind: 'effect', source: source?.id ?? SOURCE, seat: inv.seat,
            prompt: '荣耀：选择一项奖励。',
            options: [{ id: 'draw', label: '抽 1 张牌' }, { id: 'damage', label: '治愈 1 点伤害' }, { id: 'horror', label: '治愈 1 点恐惧' }],
          })
          if (answer === 'damage') api.healDamage(inv.seat, 1)
          else if (answer === 'horror') api.healHorror(inv.seat, 1)
          else api.drawCards(inv.seat, 1)
        }
        // 追猎：攻击后立刻移动到连接地点或与同地点敌人交战。
        if (picks.includes('hunt')) {
          const here = state.locations.find(location => location.id === inv.location)
          const options = [{ id: 'skip', label: '不移动、也不交战' }]
          for (const id of here?.connections || []) options.push({ id, label: `移动到「${api.locName(id)}」` })
          for (const enemy of api.enemiesAt(inv.location)) {
            if (enemy.engagedSeat == null) options.push({ id: `engage:${enemy.id}`, label: `与「${enemy.name}」交战` })
          }
          const answer = options.length > 1 ? api.choice({
            kind: 'effect', source: source?.id ?? SOURCE, seat: inv.seat, prompt: '追猎：立刻移动或交战。', options,
          }) : 'skip'
          if (answer !== 'skip' && answer != null) {
            if (String(answer).startsWith('engage:')) api.engage(state.enemies.find(enemy => enemy.id === String(answer).slice(7)), inv.seat)
            else api.moveInvestigator(inv.seat, answer)
          }
        }
      },
    },
    {
      kind: 'forced',
      trigger: 'roundStarts',
      label: '每轮开始：补满 1 点充能（萨迦：2 点）',
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        const amount = isChecked(state, inv, 6) ? 2 : 1
        const missing = Math.max(0, MAX_CHARGES - (source.uses || 0))
        const gain = Math.min(missing, amount)
        if (gain > 0) {
          api.addUses(source, gain)
          api.info(`符文斧：补满 ${gain} 点充能（${source.uses}/${MAX_CHARGES}）。`)
        }
      },
    },
  ],
}
