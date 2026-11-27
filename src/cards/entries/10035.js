// 10035 瓦卢西亚之瞳（Eyes of Valusia · 万蛇之母的狡黠）· 守护者支援 · 4 经验 · 3 资源 · 手部/法术
// 卡面：[action]：谈判。选择你所在地点的一个敌人。直到本轮结束，每位调查员对所选敌人攻击、躲避
//       或谈判时得到技能值 +1。在瓦卢西亚之瞳上放置 1 资源，作为充能。
//       [fast]：查找你的绑定卡牌，找出幽嘶之刃，与瓦卢西亚之瞳交换，将瓦卢西亚之瞳的所有充能
//       移动到幽嘶之刃。
//
// 读点（卡面 → 引擎）：
//   · 「谈判」= kind:'action' + actionKind:'parley' + countsAs:'parley' + target:{kind:'enemy'} + cost.action；
//     行为读点以 actionKind 为准（actionKind() 优先），countsAs 同值声明供借机攻击豁免守卫
//     （tests/card-entries.test.mjs 只读 countsAs / noOpportunityAttack / fast）与 parley 口径共用。
// 指定敌人的攻击、躲避和谈判检定接受直到轮末的技能值修正。
// 绑定卡交换直接在原支援槽位完成。
const CODE = '10035'
const BLADE = '10036'

function parleyEnemy({ inv, source, target, api }) {
  const enemy = target?.entity
  if (!enemy) return
  api.addEffect({
    duration: 'endOfRound',
    label: `瓦卢西亚之瞳：调查员对该敌人的攻击、躲避和谈判检定 +1（所选敌人「${api.cardName(enemy.code)}」）`,
    sourceCode: CODE,
    sourceInstanceId: source?.id ?? null,
    controllerSeat: inv.seat,
    modifiers: [{ target: 'testValue', amount: 1, audience: 'all',
      condition: { testEnemyId: enemy.id, testActionKinds: ['fight', 'evade', 'parley'] } }],
  }, inv.seat)
  api.addUses(source, 1)
  api.info(`👁 瓦卢西亚之瞳：谈判「${api.cardName(enemy.code)}」；直到本轮结束调查员对该敌人的攻击、躲避和谈判检定 +1，并放置 1 点充能。`)
}

function swapToBlade({ inv, source, api }) {
  if (!api.bonded.swapAsset(inv.seat, source, BLADE, { transferUses: true })) return
  api.info('瓦卢西亚之瞳与幽嘶之刃交换，充能移到幽嘶之刃。')
}

export default {
  code: CODE,
  name: 'Eyes of Valusia',
  uses: 0,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      actionKind: 'parley',
      countsAs: 'parley',
      target: { kind: 'enemy' },
      cost: { action: true },
      label: '谈判：所选敌人本轮被攻击/躲避/谈判时调查员 +1 技能值；放置 1 充能',
      resolve: parleyEnemy,
    },
    {
      kind: 'free',
      cost: { action: false },
      label: '快速：检索绑定卡，与幽嘶之刃交换并移动所有充能',
      resolve: swapToBlade,
    },
  ],
  modifiers: [],
}
