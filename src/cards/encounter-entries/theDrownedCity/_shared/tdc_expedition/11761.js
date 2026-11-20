// 11761 远征装备 · 远征剧情资产 · 共享遭遇组 tdc_expedition
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tdc_expedition（CONTRACT §6，印刷 1–4 张）。
// 卡面（cards-data 11761，原文见该卡 textZh）：
//   使用(3补给)。
//   [action]花费1个补给：治愈你所在地点一位调查员的1点伤害。
//   [fast]将远征装备从游戏中移除：将你所在地点或一处连接地点一名非[[精英]]敌人向任意方向移动一次。
//
// 读点（声明即接线）：
//   · 「[action] 花费 1 补给：治愈你所在地点一位调查员的 1 点伤害」= kind action + cost { action: 1, uses: 1 } + api.healDamage（同地点多位时 api.choice 选人）；
//   · 「[fast] 移出游戏：将你所在地点或一处连接地点一名非精英敌人向任意方向移动一次」= 0 行动能力（cost.action:false）+ cost { exileSelf: true }（payAbilityCost 的移出游戏费用）+ api.moveEnemy；方向 = 该敌人所在地点的任一连接。
//
// 归属与发放：Setup「每名玩家选择 1 项已获得的文物或远征物品入场」由章节 setup 用
//   api.giveAsset / scenarioRuntime.giveAsset 放到调查员控制下（sepulchreOfTheSleeper/definition.js
//   的 EXPEDITION_ITEM_CODES / EXPEDITION_ALLY_CODES）；giveAsset 走 newCardInstance，不复制条目
//   uses，因此「使用(N)」的初始化由章节/战役侧照抄条目 uses（EotE 08714–08722 同一口径）。

// 「你所在地点一位调查员」：只有一位时直接返回，多位时由卡牌控制者选。
function healAtLocation (state, inv, api, kind) {
  const here = (state.investigators || []).filter(other => !other.defeated && !other.resigned
    && other.location === inv.location)
  if (!here.length) return 0
  const seat = here.length === 1 ? here[0].seat : Number(api.choice({
    kind: 'investigator', source: CODE, seat: inv.seat,
    prompt: '选择同地点受到治疗的调查员。',
    options: here.map(other => ({ id: String(other.seat), label: other.name })),
  }))
  const target = here.find(other => other.seat === seat) || here[0]
  if (kind === 'damage') api.healDamage(target.seat, 1)
  else api.healHorror(target.seat, 1)
  return target.seat
}

// 「你所在地点或一处连接地点的非精英敌人」：先收窄候选，再交给卡牌控制者选。
function movableEnemies (state, inv) {
  const connections = (state.locations || []).find(item => item.id === inv.location)?.connections || []
  const zones = new Set([inv.location, ...connections])
  return (state.enemies || []).filter(enemy => !enemy.elite && !enemy.defeated
    && zones.has(enemy.location))
}

const CODE = '11761'

export default {
  code: CODE,
  name: '远征装备',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'supplies',
  flags: { expedition: true, traits: ['Item', 'Supply'], slotless: true },
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    label: '花费 1 补给：治愈同地点一位调查员 1 点伤害',
    cost: { action: 1, uses: 1 },
    resolve: ({ state, inv, api }) => healAtLocation(state, inv, api, 'damage'),
  },
  {
    kind: 'action',
    actionKind: 'activate',
    label: '[fast] 移出游戏：移动一名非精英敌人一次',
    cost: { action: false, exileSelf: true },
    criteria: ({ state, inv }) => movableEnemies(state, inv).length > 0,
    resolve: ({ state, inv, api }) => {
      const enemies = movableEnemies(state, inv)
      if (!enemies.length) return
      const enemy = enemies.length === 1 ? enemies[0] : enemies.find(item => String(item.id) === String(api.choice({
        kind: 'enemy', source: CODE, seat: inv.seat,
        prompt: '选择要移动的非精英敌人。',
        options: enemies.map(item => ({ id: String(item.id), label: item.name || item.code })),
      }))) || enemies[0]
      const here = (state.locations || []).find(item => item.id === enemy.location)
      const destinations = (here?.connections || []).filter(id => (state.locations || []).some(item => item.id === id))
      if (!destinations.length) {
        api.info('「远征装备」：该敌人所在地点没有可移动的连接地点。')
        return
      }
      const destination = destinations.length === 1 ? destinations[0] : api.choice({
        kind: 'location', source: CODE, seat: inv.seat,
        prompt: '选择敌人移动到的连接地点。',
        options: destinations.map(id => ({ id, label: api.locName(id) })),
      })
      api.moveEnemy(enemy, destination)
      api.info('🎒 「远征装备」移出游戏：' + (enemy.name || enemy.code) + ' 移动到 ' + api.locName(destination) + '。')
    },
  }],
  note: '① 补给计数走条目 uses/usesType（giveAsset 不复制 uses，发放时需章节侧照抄条目 uses，属内容侧集成项）；'
    + '②「向任意方向移动一次」= 沿该敌人所在地点的一条连接移动一步（引擎无方向概念，等价于任意方向移动一次）；'
    + '③「移出游戏」走 cost.exileSelf（exilePlayerCard + leaveAsset），与印刷一致。',
}
