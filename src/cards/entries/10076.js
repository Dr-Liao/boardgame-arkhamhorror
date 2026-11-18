// 10076 脚步轻盈（Lightfooted）· 潜袭者（Rogue）技能 · 0 费 · [[熟练]]/[[诡计]]。
// 卡面：如果躲避尝试期间本次技能检定成功，你可以自动躲避所在地点的另一个敌人。
//
// 一卡一个文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 投入 → commit 描述子（印刷 1 个[敏捷]图标由 cards-data 提供）。
//   · 「躲避检定成功后」→ reaction + trigger:'evadeSuccess'（combat.js 的躲避成功窗口；
//     已投入的技能卡由 ability-rules#descriptorSources 的 committed 分支枚举为能力来源）。
//   · 「自动躲避另一个敌人」→ api.canAutoEvade 过滤 + api.autoEvadeEnemy（与自动躲避同一声明读点）。
const CODE = '10076'

const committedThisTest = state => (state.skillTest?.committed || [])
  .some(item => (typeof item === 'string' ? item : item?.code) === CODE)

export default {
  code: CODE,
  abilities: [
    {
      kind: 'commit',
      label: '脚步轻盈：投入本次技能检定（1 个[敏捷]图标）',
      skill: {},
    },
    {
      kind: 'reaction',
      trigger: 'evadeSuccess',
      label: '躲避检定成功后：你可以自动躲避所在地点的另一个敌人',
      criteria: [({ state, inv, context, helpers }) => {
        if (!committedThisTest(state)) return false
        if (!context?.enemy || state.skillTest?.seat !== inv.seat) return false
        return (state.enemies || []).some(other => other.id !== context.enemy.id
          && other.location === inv.location && helpers.canAutoEvade(other, inv.seat))
      }],
      resolve: ({ state, inv, context, api }) => {
        const others = (state.enemies || []).filter(other => other.id !== context?.enemy?.id
          && other.location === inv.location && api.canAutoEvade(other, inv.seat))
        if (!others.length) return
        const enemyId = others.length === 1 ? others[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「脚步轻盈」：选择要自动躲避的另一个敌人。',
          options: others.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = others.find(item => item.id === enemyId) || others[0]
        if (!enemy) return
        api.autoEvadeEnemy(enemy)
        api.info(`👣 「脚步轻盈」：自动躲避「${enemy.name}」。`)
      },
    },
  ],
  modifiers: [],
}
