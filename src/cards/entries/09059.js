// 09059 关键证言（Damning Testimony）· 游荡者（Rogue）资产 · 0 经验 · 道具 · 违法 · 手部 · 定制。
//
// 卡面：定制。使用(3 证据)。
//       [action] 横置关键证言并选择任意地点的一个敌人：调查(你所在地点)。如果你检定成功，你可以
//       花费 1 证据，以额外发现所选敌人地点的 1 个线索。
// 定制栏（勾选格数见 customizationOptions，逐项实现在本文件底部）：
//       1 格 Search Warrant / 2 格 Fabricated Evidence / 2 格 Blackmail / 3 格 Extort /
//       3 格 Surveil / 4 格 Expose。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 证据 = 条目级 uses/usesType（实例在 newPlayerAssetInstance 里初始化）；花费走 cost.uses / api.spendUses。
//   · 「选择任意地点的一个敌人」→ api.cardsInPlayTreacheries 同级的 state.enemies 只读枚举 + api.locationName。
//   · 调查 → api.investigate（mayIgnoreLocationEffects / locationId / bonus / onInvestigateSuccess 都是
//     actions.js#runInvestigate 的既有选项，因此六项定制都能落到真实读点上）。
//   · 勾选状态 → api.tsk.customizable.checked(seat, code)（只读；不新造状态字段）。
const CODE = '09059'

const OPTIONS = [
  { name: 'Search Warrant', checks: 1, text: 'While investigating using Damning Testimony, you may ignore any effect or keyword on the investigated location that would trigger.' },
  { name: 'Fabricated Evidence', checks: 2, text: 'Damning Testimony enters play with 2 additional evidence on it.' },
  { name: 'Blackmail', checks: 2, text: 'You get +2 [intellect] while investigating using Damning Testimony.' },
  { name: 'Extort', checks: 3, text: 'When you successfully investigate using Damning Testimony, you may spend 1 evidence to automatically evade the chosen enemy.' },
  { name: 'Surveil', checks: 3, text: "You may use Damning Testimony's ability to investigate the chosen enemy's location instead of your location." },
  { name: 'Expose', checks: 4, text: 'When you successfully investigate using Damning Testimony, you may spend X evidence to discard the chosen enemy if it is non-[[Elite]]. X is that enemy\'s remaining health.' },
]

const checkedFully = (api, seat, index) => {
  const checked = api.tsk.customizable.checked(seat, CODE)
  return checked.filter(item => item === index).length >= OPTIONS[index].checks
}

export default {
  code: CODE,
  uses: 3,
  usesType: 'evidence',
  customizationOptions: OPTIONS,
  abilities: [
    {
      // Fabricated Evidence（2 格）：入场时额外带 2 个证据（读点：assetEnteredPlay 的入场钩子）。
      kind: 'entersPlay',
      label: '定制 Fabricated Evidence：入场时额外放置 2 个证据',
      entersPlay: {},
      resolve: ({ inv, source, api }) => {
        if (!source) return
        if (!checkedFully(api, inv.seat, 1)) return
        api.addUses(source, 2)
        api.info(`🗂️ 「关键证言」：Fabricated Evidence 生效，入场时额外放置 2 个证据（当前 ${source.uses || 0}）。`)
      },
    },
    {
      kind: 'action',
      cost: { action: true, exhaust: true },
      label: '横置并选择任意地点的一个敌人：调查（你所在地点）；成功后花 1 证据发现其地点的 1 个线索',
      criteria: [({ state }) => (state.enemies || []).length > 0],
      resolve: ({ state, inv, source, api }) => {
        const enemies = state.enemies || []
        if (!enemies.length) {
          api.info('「关键证言」：场上没有敌人可以指证。')
          return
        }
        const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「关键证言」：选择任意地点的一个敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: `${enemy.name}（${api.locationName(enemy.location)}）` })),
        })
        const enemy = enemies.find(item => item.id === enemyId)
        if (!enemy) return
        // 定制选项（每项都要勾满全部格数才生效）。
        const ignoreLocation = checkedFully(api, inv.seat, 0)
        const blackmail = checkedFully(api, inv.seat, 2)
        const extort = checkedFully(api, inv.seat, 3)
        const surveil = checkedFully(api, inv.seat, 4)
        const expose = checkedFully(api, inv.seat, 5)
        const locationId = surveil ? enemy.location : inv.location
        api.investigate(inv.seat, {
          ...(locationId !== inv.location ? { locationId } : {}),
          ...(ignoreLocation ? { mayIgnoreLocationEffects: true } : {}),
          ...(blackmail ? { bonus: 2 } : {}),
          onInvestigateSuccess: () => {
            if (surveil) api.info(`🗂️ 「关键证言」：改为调查「${api.locationName(locationId)}」。`)
            if (extort) {
              const answer = api.choice({
                kind: 'effect', source: CODE, seat: inv.seat, canSkip: true,
                prompt: '「关键证言」：花费 1 证据自动躲避所选敌人？',
                options: [{ id: 'spend', label: '花费 1 证据自动躲避' }, { id: 'skip', label: '不花费' }],
              })
              if (answer === 'spend' && api.spendUses(source, 1)) {
                api.autoEvadeEnemy(enemy)
                api.info(`🗂️ 「关键证言」：花费 1 证据自动躲避「${enemy.name}」。`)
              }
            }
            if (expose && !enemy.elite) {
              const health = Math.max(0, (enemy.health || 0) - (enemy.damageTaken || 0))
              if (health > 0 && (source?.uses || 0) >= health) {
                const answer = api.choice({
                  kind: 'effect', source: CODE, seat: inv.seat, canSkip: true,
                  prompt: `「关键证言」：花费 ${health} 证据弃掉「${enemy.name}」？`,
                  options: [{ id: 'spend', label: `花费 ${health} 证据弃掉它` }, { id: 'skip', label: '不花费' }],
                })
                if (answer === 'spend' && api.spendUses(source, health)) {
                  api.discardEnemy(enemy)
                  api.info(`🗂️ 「关键证言」：花费 ${health} 证据弃掉「${enemy.name}」。`)
                }
              }
            }
            const answer = api.choice({
              kind: 'effect', source: CODE, seat: inv.seat, canSkip: true,
              prompt: `「关键证言」：花费 1 证据，在「${api.locationName(enemy.location)}」额外发现 1 个线索？`,
              options: [{ id: 'spend', label: '花费 1 证据发现 1 个线索' }, { id: 'skip', label: '不花费' }],
            })
            if (answer === 'spend' && api.spendUses(source, 1)) {
              const got = api.discoverClue(inv.seat, 1, enemy.location)
              api.info(`🗂️ 「关键证言」：在「${api.locationName(enemy.location)}」额外发现 ${got} 个线索。`)
            }
          },
        })
      },
    },
  ],
  modifiers: [],
}
