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
//   · 「直到本轮结束，每位调查员 +1 技能值」= api.addEffect({ duration:'endOfRound', modifiers:
//     [{ target:'skill:*', amount:1, audience:'here' }] })（A1 效果实体；audience:'here' 让同地点
//     其他调查员同样受益；到期由 expireEffects('endOfRound') 统一清理）。
//   · 「放置 1 资源作为充能」= api.addUses(source, 1)（支援充能只经 api 写）。
//   · [fast] 交换：见下方 approximation。
//
// approximation（逐条披露，缺读点见 artifacts/migration/fhv/primitive-requests/10035.json）：
//   ① 引擎没有「绑定卡就地交换」原语（bonded.js 只有 retrieve/shuffleIn/returnToSet，
//      没有 swapBondedInPlace；api.flipAsset 只支持 cards-data 里配对的 linkedCardCode 物理面）。
//      这里改为「检索绑定卡加入手牌 → 幽嘶之刃放置入场 → 充能转移 → 瓦卢西亚之瞳返回手牌」，
//      行为上等价于换面，但瓦卢西亚之瞳会回到手牌（可以再打出），而不是留在场外绑定集合。
//   ② 「每位调查员对所选敌人」的限定无法用声明式修正表达（effect modifier 只能是纯 JSON 条件，
//      没有「本次检定的敌人」条件键），因此本轮 +1 作用于同地点调查员的所有技能检定。
const CODE = '10035'
const BLADE = '10036'

function parleyEnemy({ inv, source, target, api }) {
  const enemy = target?.entity
  if (!enemy) return
  api.addEffect({
    duration: 'endOfRound',
    label: `瓦卢西亚之瞳：同地点调查员技能检定 +1（所选敌人「${api.cardName(enemy.code)}」）`,
    sourceCode: CODE,
    sourceInstanceId: source?.id ?? null,
    controllerSeat: inv.seat,
    modifiers: [{ target: 'skill:*', amount: 1, audience: 'here' }],
  }, inv.seat)
  api.addUses(source, 1)
  api.info(`👁 瓦卢西亚之瞳：谈判「${api.cardName(enemy.code)}」；直到本轮结束同地点调查员技能检定 +1，并放置 1 点充能。`)
}

function swapToBlade({ inv, source, api }) {
  const charges = Math.max(0, Number(source?.uses) || 0)
  const retrieved = api.bonded.retrieve(inv.seat, CODE, { handCount: 1 })
  if (!retrieved?.length) {
    api.info('瓦卢西亚之瞳：绑定卡牌不在场外集合内，无法交换。')
    return
  }
  if (!api.putAssetIntoPlay(inv.seat, BLADE)) {
    api.info('瓦卢西亚之瞳：幽嘶之刃无法放置入场（手牌或槽位不满足）。')
    return
  }
  const blade = (inv.assets || []).find(asset => asset.code === BLADE)
  if (blade && charges) api.addUses(blade, charges)
  if (charges) api.spendUses(source, charges)
  if (source) api.returnAssetToHand(inv.seat, source)
  api.info(`👁 瓦卢西亚之瞳：与幽嘶之刃交换，${charges} 点充能已移动到刀上；瓦卢西亚之瞳返回手牌。`)
}

export default {
  code: CODE,
  name: 'Eyes of Valusia',
  simplified: true,
  note: 'approximation: ① 缺「绑定卡就地交换」原语，用检索绑定卡入场 + 原卡返回手牌近似（原卡可再次打出）；② 本轮 +1 技能值用 audience:here 的 skill:* 修正近似，无法限定「对所选敌人」。',
  abilities: [
    {
      kind: 'action',
      actionKind: 'parley',
      countsAs: 'parley',
      target: { kind: 'enemy' },
      cost: { action: true },
      label: '谈判：所选敌人本轮被攻击/躲避/谈判时同地点调查员 +1 技能值；放置 1 充能',
      resolve: parleyEnemy,
    },
    {
      kind: 'action',
      cost: { action: false },
      label: '快速：检索绑定卡，与幽嘶之刃交换并移动所有充能',
      resolve: swapToBlade,
    },
  ],
  modifiers: [],
}
