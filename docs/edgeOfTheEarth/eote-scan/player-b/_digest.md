# Player-auditor-b digest (08079-08133)



## 08079 Blood Will Have Blood / 血债血偿
type=event klass=survivor subtype=- xp=2 cost=1 slot=- traits=Pact,Cursed
entry: src/cards/entries/08079.js
```text
text: Fast. Play after an enemy attacks you. Max 1 per attack.
Damage/horror from this attack cannot be assigned to [[Ally]] assets. For each point of damage and/or horror you took from this attack, draw 1 card.
```
```text
textZh: 快速。在一个敌人攻击你后打出。每次攻击最多1张。
该攻击造成的伤害/恐惧不能分配给[[盟友]]支援。你从本次攻击中每受到1点伤害和/或恐惧，抽取1张卡牌。
```
```js
   1| // 08079 血债血偿
   2| // 卡面：快速。在一个敌人攻击你后打出。每次攻击最多1张。该攻击造成的伤害/恐惧不能分配给[[盟友]]支援。
   3| //       你从本次攻击中每受到1点伤害和/或恐惧，抽取1张卡牌。
   4| //
   5| // 读点：快速事件窗口 harmAssigned（enemies.js 在敌人攻击实际造成伤害/恐惧后开，context 带 damage/horror/attack）。
   6| // approximation: 「该攻击的伤害/恐惧不能分配给盟友支援」没有回溯改写分配策略的引擎读点，
   7| //   已提交 primitive request m2-3-08079；本实现只结算「每受到 1 点伤害/恐惧抽 1 张牌」的主效果。
   8| //
   9| // 一张卡一个文件：这张卡的行为只在这里维护。
  10| 
  11| export default {
  12|   code: '08079',
  13|   abilities: [
  14|     { kind: 'played', fast: true, trigger: 'harmAssigned',
  15|       label: '敌人攻击你造成伤害/恐惧后：每受到 1 点伤害/恐惧抽 1 张牌',
  16|       criteria: ({ inv, context }) => Boolean(context) && context.seat === inv.seat
  17|         && Boolean(context.attack) && ((context.damage || 0) + (context.horror || 0) > 0),
  18|       resolve: ({ inv, context, api }) => {
  19|         const amount = (context.damage || 0) + (context.horror || 0)
  20|         if (!amount) return
  21|         api.drawCards(inv.seat, amount)
  22|       } },
  23|   ],
  24|   modifiers: [],
  25| }
  26| 
```


## 08080 Fire Extinguisher / 灭火器
type=asset klass=survivor subtype=- xp=3 cost=2 slot=Hand traits=Item,Tool,Melee
entry: src/cards/entries/08080.js
```text
text: [action]: Fight. You get +1 [combat] and deal +1 damage for this attack.
[action] Discard Fire Extinguisher: Evade. Automatically evade all enemies engaged with you. You may exile Fire Extinguisher instead of discarding it to discard each non-[[Elite]] enemy evaded by this effect.
```
```text
textZh: [action]：攻击。你本次攻击得到+1[combat]并造成+1伤害。
[action]弃掉灭火器：躲避。自动躲避所有与你交战的敌人。你可以将弃掉灭火器改为放逐，来弃掉每一张被此效果躲避的非[[精英]]敌人。
```
```js
   1| // 08080 灭火器
   2| // 卡面：[action]：攻击。你本次攻击得到+1[combat]并造成+1伤害。
   3| // 卡面：[action]弃掉灭火器：躲避。自动躲避所有与你交战的敌人。你可以将弃掉灭火器改为放逐，
   4| //       来弃掉每一张被此效果躲避的非[[精英]]敌人。
   5| //
   6| // 一张卡一个文件：这张卡的行为只在这里维护。
   7| 
   8| export default {
   9|   code: '08080',
  10|   abilities: [
  11|     { kind: 'action', label: '攻击（战斗 +1，伤害 +1）', cost: { action: true },
  12|       effect: { type: 'fight', combatBonus: 1, damageBonus: 1 } },
  13|     { kind: 'action', label: '弃掉灭火器：自动躲避所有交战敌人', cost: { action: true, discardSelf: true },
  14|       countsAs: 'evade', noOpportunityAttack: true,
  15|       resolve: ({ inv, state, api }) => {
  16|         for (const enemyId of [...inv.engaged]) {
  17|           const enemy = state.enemies.find(item => item.id === enemyId)
  18|           if (enemy && !enemy.defeated) api.autoEvadeEnemy(enemy)
  19|         }
  20|       } },
  21|     // 放逐版（印刷：可以把「弃掉」改为「放逐」，额外击败被躲避的非精英敌人）。
  22|     { kind: 'action', label: '放逐灭火器：自动躲避并击败被躲避的非精英敌人', cost: { action: true, exileSelf: true },
  23|       countsAs: 'evade', noOpportunityAttack: true,
  24|       resolve: ({ inv, state, api }) => {
  25|         const evaded = []
  26|         for (const enemyId of [...inv.engaged]) {
  27|           const enemy = state.enemies.find(item => item.id === enemyId)
  28|           if (!enemy || enemy.defeated) continue
  29|           if (api.autoEvadeEnemy(enemy)) evaded.push(enemy)
  30|         }
  31|         for (const enemy of evaded) if (!enemy.elite) api.defeatEnemy(enemy, inv.seat)
  32|       } },
  33|   ],
  34|   modifiers: [],
  35| }
  36| 
```


## 08081 Plucky / 有胆有识
type=asset klass=survivor subtype=- xp=3 cost=0 slot=- traits=Talent,Composure
entry: src/cards/entries/08081.js
```text
text: Fast. Limit 1 [[Composure]] in play.
You get +1 [willpower] and +1 [intellect].
Non-direct damage/horror must be assigned to Plucky before it can be assigned to your investigator card.
[fast] Spend 1 resource: You get +1 [willpower] or +1 [intellect] for this skill test.
```
```text
textZh: 快速。[[沉稳]]卡牌场上仅限1张。
你得到+1[willpower]和+1[intellect]。
非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给有胆有识。
[free]花费1资源：你本次技能检定得到+1[willpower]或+1[intellect]。
```
```js
   1| // 08081 有胆有识（3 级）
   2| // 卡面：快速。[[沉稳]]卡牌场上仅限1张。
   3| //       你得到+1[willpower]和+1[intellect]。
   4| //       非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给有胆有识。
   5| //       [free]花费1资源：你本次技能检定得到+1[willpower]或+1[intellect]。
   6| //
   7| // 读点：
   8| //   · 沉稳（composure）由引擎 harm-threat.js#assignHarm 读「非直接恐惧先分配给本卡」；
   9| //     伤害侧的强制分配暂无引擎读点 → 已提交 primitive request m2-3-08081（见 artifacts/）。
  10| //     approximation: 目前只有恐惧侧生效；伤害仍按普通分配（印刷要求伤害也先分配给本卡）。
  11| //   · 两组 +1 修正走 entry.modifiers（skill:willpower / skill:intellect）。
  12| //   · 资源换 +1 检定走 freeTriggers（与 03115 同构，引擎自动询问档位）。
  13| //
  14| // 一张卡一个文件：这张卡的行为只在这里维护。
  15| 
  16| export default {
  17|   code: '08081',
  18|   fast: true,
  19|   composure: true,
  20|   freeTriggers: [
  21|     { skill: 'willpower', cost: { resources: 1 }, bonus: 1 },
  22|     { skill: 'intellect', cost: { resources: 1 }, bonus: 1 },
  23|   ],
  24|   abilities: [],
  25|   modifiers: [
  26|     { target: 'skill:willpower', amount: 1 },
  27|     { target: 'skill:intellect', amount: 1 },
  28|   ],
  29| }
  30| 
```


## 08082 Fend Off / 抵挡
type=event klass=survivor subtype=- xp=3 cost=2 slot=- traits=Gambit,Trick
entry: src/cards/entries/08082.js
```text
text: Fast. Play when a non-[[Elite]] enemy spawns at your location.
That enemy attacks you. Then, automatically evade that enemy and attach Fend Off to it.
Attached enemy cannot ready.
```
```text
textZh: 快速。在你所在地点生成一个非[[精英]]敌人时打出。
该敌人攻击你。然后，自动躲避该敌人并将抵挡附属到该敌人。
被附属的敌人不能重整。
```
```js
   1| // 08082 抵挡
   2| // 卡面：快速。在你所在地点生成一个非[[精英]]敌人时打出。该敌人攻击你。然后，自动躲避该敌人并将抵挡
   3| //       附属到该敌人。被附属的敌人不能重整。
   4| //
   5| // 读点：enemySpawn 窗口（敌人生成时，enemies.js 在生成后开，context 带 enemy/location/seat）；
   6| // 攻击走 api.enemyAttackByCard，躲避 api.autoEvadeEnemy，附属用 eventPlayed 窗口 +
   7| // api.moveCard({from:'discard',to:'attached',attachTo})；「不能重整」由条目 restrainsReady:true
   8| // （phases.js 对敌人附属的 restrainsReady 读点）。
   9| //
  10| // approximation: 打出的瞬间事件卡尚未进弃牌堆，附属改在 eventPlayed 窗口结算，并用
  11| //   「本地点刚被自动躲避（横置、未附属 08082）的非精英敌人」定位目标；正常单目标生成时等价。
  12| //
  13| // 一张卡一个文件：这张卡的行为只在这里维护。
  14| 
  15| export default {
  16|   code: '08082',
  17|   restrainsReady: true,
  18|   abilities: [
  19|     { kind: 'played', fast: true, trigger: 'enemySpawn',
  20|       label: '非精英敌人生成时：该敌人攻击你，然后自动躲避它',
  21|       criteria: ({ inv, context, state }) => {
  22|         const enemy = context?.enemyId ? state.enemies.find(item => item.id === context.enemyId) : context?.enemy
  23|         return Boolean(enemy) && context.location === inv.location && enemy.elite !== true && enemy.defeated !== true
  24|       },
  25|       resolve: ({ inv, context, state, api }) => {
  26|         const enemy = context.enemyId ? state.enemies.find(item => item.id === context.enemyId) : context.enemy
  27|         if (!enemy) return
  28|         api.enemyAttackByCard(enemy, '抵挡：该敌人的攻击', inv.seat)
  29|         api.autoEvadeEnemy(enemy)
  30|       } },
  31|     { kind: 'reaction', trigger: 'eventPlayed',
  32|       label: '抵挡打出后：附属到刚被自动躲避的非精英敌人',
  33|       criteria: ({ inv, context, state }) => context?.cardCode === '08082' && Boolean(state.enemies.some(enemy =>
  34|         !enemy.elite && !enemy.defeated && enemy.location === inv.location && enemy.exhausted
  35|         && !(enemy.attachments || []).some(card => card.code === '08082'))),
  36|       resolve: ({ inv, state, api }) => {
  37|         const enemy = state.enemies.find(item => !item.elite && !item.defeated
  38|           && item.location === inv.location && item.exhausted
  39|           && !(item.attachments || []).some(card => card.code === '08082'))
  40|         if (!enemy) return
  41|         api.moveCard({ code: '08082', from: 'discard', to: 'attached', attachTo: enemy.id })
  42|       } },
  43|   ],
  44|   modifiers: [],
  45| }
  46| 
```


## 08083 Medical Student / 医学生
type=asset klass=guardian subtype=- xp=0 cost=2 slot=Ally traits=Ally,Miskatonic,Science
entry: src/cards/entries/08083.js
```text
text: [reaction] After Medical Student enters play: Heal 1 damage and 1 horror from an investigator or [[Ally]] asset at your location.
```
```text
textZh: [reaction]在医学生入场后：治愈你所在地点的一位调查员或一个[[盟友]]支援1点伤害和1点恐惧。
```
```js
   1| // 08083 医学生
   2| // 卡面：[reaction]在医学生入场后：治愈你所在地点的一位调查员或一个[[盟友]]支援1点伤害和1点恐惧。
   3| //
   4| // 读点：能力层 entersPlay 描述子（actions.js#doPlay 的入场唯一读点），地点内调查员候选 +
   5| // 支援候选（api.healDamage / api.healAsset / api.healHorror）。
   6| //
   7| // 一张卡一个文件：这张卡的行为只在这里维护。
   8| 
   9| export default {
  10|   code: '08083',
  11|   abilities: [
  12|     { kind: 'entersPlay', label: '入场：治愈同地点一位调查员或一个盟友支援 1 伤害与 1 恐惧',
  13|       resolve: ({ inv, source, state, api }) => {
  14|         if (!source) return
  15|         const candidates = []
  16|         for (const other of state.investigators) {
  17|           if (other.defeated || other.resigned || other.location !== inv.location) continue
  18|           candidates.push({ id: `inv:${other.seat}`, label: `${other.name}（调查员）` })
  19|           for (const ally of other.assets) {
  20|             if (api.cardTraits(ally.code).some(trait => String(trait).toLowerCase() === 'ally')) {
  21|               candidates.push({ id: `asset:${ally.id}`, label: api.cardName(ally.code) })
  22|             }
  23|           }
  24|         }
  25|         if (!candidates.length) return
  26|         const chosen = candidates.length === 1 ? candidates[0].id : api.choice({
  27|           kind: 'effect', source: '08083', seat: inv.seat,
  28|           prompt: '选择要治愈 1 点伤害和 1 点恐惧的调查员或盟友支援。',
  29|           options: candidates,
  30|         })
  31|         if (String(chosen).startsWith('inv:')) {
  32|           const seat = Number(String(chosen).slice(4))
  33|           api.healDamage(seat, 1)
  34|           api.healHorror(seat, 1)
  35|         } else if (String(chosen).startsWith('asset:')) {
  36|           const id = String(chosen).slice(6)
  37|           const target = state.investigators.flatMap(owner => owner.assets).find(asset => asset.id === id)
  38|           if (target) { api.healAsset(target, 1); api.addAssetHorror(target, -1) }
  39|         }
  40|       } },
  41|   ],
  42|   modifiers: [],
  43| }
  44| 
```


## 08084 On the Trail / 追踪
type=event klass=guardian subtype=- xp=1 cost=1 slot=- traits=Insight,Tactic
entry: src/cards/entries/08084.js
```text
text: Choose an enemy at any location other than yours. Either move twice toward that enemy, or discover 1 clue at any empty location between you and the chosen enemy, along the shortest path to reach that enemy.
```
```text
textZh: 选择你所在地点以外任意地点的一个敌人。沿着最短路径，朝着该敌人移动2次，或在你与选定敌人间最短路径上的任意无人地点发现1个线索。
```
```js
   1| // 08084 追踪（1 级）
   2| // 卡面：选择你所在地点以外任意地点的一个敌人。沿着最短路径，朝着该敌人移动2次，
   3| //       或在你与选定敌人间最短路径上的任意无人地点发现1个线索。
   4| //
   5| // 读点：地图连接由 state.locations[].connections 只读计算（BFS）；移动走 api.moveInvestigator，
   6| // 线索走 api.discoverClue(seat,1,locationId)。
   7| //
   8| // 一张卡一个文件：这张卡的行为只在这里维护。
   9| 
  10| const pathTo = (state, from, to) => {
  11|   if (!from || !to) return []
  12|   const queue = [[from]]
  13|   const seen = new Set([from])
  14|   while (queue.length) {
  15|     const path = queue.shift()
  16|     const current = path.at(-1)
  17|     if (current === to) return path
  18|     const location = state.locations.find(item => item.id === current)
  19|     for (const next of location?.connections || []) {
  20|       if (seen.has(next) || !state.locations.some(item => item.id === next)) continue
  21|       seen.add(next)
  22|       queue.push([...path, next])
  23|     }
  24|   }
  25|   return []
  26| }
  27| 
  28| export default {
  29|   code: '08084',
  30|   abilities: [
  31|     { kind: 'played', label: '追踪：朝目标敌人移动 2 次，或在最短路径的无人地点发现线索',
  32|       resolve: ({ inv, state, api }) => {
  33|         const targets = state.enemies.filter(enemy => enemy.location &&
  34|           enemy.location !== inv.location && !enemy.defeated && !enemy.elite)
  35|         if (!targets.length) { api.info('没有可选的其他地点敌人。'); return }
  36|         const targetId = targets.length === 1 ? targets[0].id : api.choice({ kind: 'target', source: '08084', seat: inv.seat,
  37|           prompt: '选择要追踪的敌人。', options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
  38|         const target = targets.find(enemy => enemy.id === targetId) || targets[0]
  39|         const path = pathTo(state, inv.location, target.location)
  40|         if (path.length < 2) { api.info('没有通往该敌人所在地点的路径。'); return }
  41|         const mode = api.choice({ kind: 'effect', source: '08084', seat: inv.seat,
  42|           prompt: '选择追踪方式。', options: [
  43|             { id: 'move', label: '沿最短路径朝该敌人移动 2 次' },
  44|             { id: 'clue', label: '在最短路径的无人地点发现 1 个线索' },
  45|           ] })
  46|         if (mode === 'move') {
  47|           for (const destination of path.slice(1, 3)) {
  48|             if (!api.canMoveTo(inv.seat, destination)) break
  49|             api.moveInvestigator(inv.seat, destination)
  50|           }
  51|           return
  52|         }
  53|         const candidates = path.slice(1, -1).filter(id => !state.investigators.some(other => other.location === id)
  54|           && !state.enemies.some(enemy => enemy.location === id))
  55|         if (!candidates.length) { api.info('最短路径上没有无人地点。'); return }
  56|         const where = candidates.length === 1 ? candidates[0] : api.choice({ kind: 'location', source: '08084', seat: inv.seat,
  57|           prompt: '选择要发现线索的无人地点。', options: candidates.map(id => ({ id, label: api.locName(id) })) })
  58|         api.discoverClue(inv.seat, 1, where)
  59|       } },
  60|   ],
  61|   modifiers: [],
  62| }
  63| 
```


## 08085 On the Trail / 追踪
type=event klass=guardian subtype=- xp=3 cost=1 slot=- traits=Insight,Tactic
entry: src/cards/entries/08085.js
```text
text: Choose an enemy at any location other than yours. Move twice toward that enemy. Discover 1 clue at each location you entered by this effect.
```
```text
textZh: 选择你所在地点以外任意地点的一个敌人。朝着该敌人移动2次，发现你以此效果进入的每个地点的1个线索。
```
```js
   1| // 08085 追踪（3 级）
   2| // 卡面：选择你所在地点以外任意地点的一个敌人。朝着该敌人移动2次，
   3| //       发现你以此效果进入的每个地点的1个线索。
   4| //
   5| // 读点：BFS 只读连接表；移动 api.moveInvestigator，进入后 api.discoverClue(seat,1,locationId)。
   6| //
   7| // 一张卡一个文件：这张卡的行为只在这里维护。
   8| 
   9| const pathTo = (state, from, to) => {
  10|   if (!from || !to) return []
  11|   const queue = [[from]]
  12|   const seen = new Set([from])
  13|   while (queue.length) {
  14|     const path = queue.shift()
  15|     const current = path.at(-1)
  16|     if (current === to) return path
  17|     const location = state.locations.find(item => item.id === current)
  18|     for (const next of location?.connections || []) {
  19|       if (seen.has(next) || !state.locations.some(item => item.id === next)) continue
  20|       seen.add(next)
  21|       queue.push([...path, next])
  22|     }
  23|   }
  24|   return []
  25| }
  26| 
  27| export default {
  28|   code: '08085',
  29|   abilities: [
  30|     { kind: 'played', label: '追踪：朝目标敌人移动 2 次，并在进入的每个地点发现 1 个线索',
  31|       resolve: ({ inv, state, api }) => {
  32|         const targets = state.enemies.filter(enemy => enemy.location &&
  33|           enemy.location !== inv.location && !enemy.defeated && !enemy.elite)
  34|         if (!targets.length) { api.info('没有可选的其他地点敌人。'); return }
  35|         const targetId = targets.length === 1 ? targets[0].id : api.choice({ kind: 'target', source: '08085', seat: inv.seat,
  36|           prompt: '选择要追踪的敌人。', options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
  37|         const target = targets.find(enemy => enemy.id === targetId) || targets[0]
  38|         const path = pathTo(state, inv.location, target.location)
  39|         if (path.length < 2) { api.info('没有通往该敌人所在地点的路径。'); return }
  40|         for (const destination of path.slice(1, 3)) {
  41|           if (!api.canMoveTo(inv.seat, destination)) break
  42|           api.moveInvestigator(inv.seat, destination)
  43|           api.discoverClue(inv.seat, 1, destination)
  44|         }
  45|       } },
  46|   ],
  47|   modifiers: [],
  48| }
  49| 
```


## 08086 Michael Leigh / 迈克尔·利
type=asset klass=guardian subtype=- xp=5 cost=4 slot=Ally traits=Ally,Detective
entry: src/cards/entries/08086.js
```text
text: You get +1 [intellect] and +1 [combat].
[reaction] After you successfully investigate: Place 1 resource (from the token pool) on Michael Leigh, as evidence (to a maximum of 3 evidence).
[reaction] When you initiate an attack, exhaust Michael Leigh and spend 1 evidence: You deal +1 damage for this attack.
```
```text
textZh: 你得到+1[intellect]和+1[combat]。
[reaction]在你成功调查后：在迈克尔·利上放置1资源(从供应堆拿取)作为证据(最多3个证据)。
[reaction]在你发动一次攻击时，横置迈克尔·利并花费1证据：你在本次攻击中造成+1伤害。
```
```js
   1| // 08086 迈克尔·李
   2| // 卡面：你得到+1[intellect]和+1[combat]。
   3| //       [reaction]在你成功调查后：在迈克尔·李上放置1资源(从供应堆拿取)作为证据(最多3个证据)。
   4| //       [reaction]在你发动一次攻击时，横置迈克尔·李并花费1证据：你在本次攻击中造成+1伤害。
   5| //
   6| // 读点：
   7| //   · 属性修正走 modifiers（skill:intellect / skill:combat）。
   8| //   · 证据用支援的 uses 表示（引擎卡牌计数器只登记了 bounty，没有通用的「证据」计数器读点；
   9| //     uses 与费用支付/上限语义一致，不新造状态字段）。
  10| //   · 「发动攻击时横置并花 1 证据：本次攻击 +1 伤害」用 testInitiated 窗口（发起检定时）+
  11| //     api.addExtraOnSuccess({type:'dealDamage',target:'engaged'}) 近似。
  12| //
  13| // approximation: 攻击加成以「成功后对交战敌人追加 1 点伤害」结算，而不是并入本次攻击伤害
  14| //   （引擎没有在攻击发起窗口写本次攻击 damageBonus 的通用读点；已提交请求 m2-3-08086）。
  15| //
  16| // 一张卡一个文件：这张卡的行为只在这里维护。
  17| 
  18| export default {
  19|   code: '08086',
  20|   uses: 0,
  21|   usesType: 'evidence',
  22|   abilities: [
  23|     { kind: 'reaction', trigger: 'investigateSuccess', label: '调查成功：放置 1 证据（最多 3）',
  24|       criteria: ({ inv, source, context }) => Boolean(source) && context?.seat === inv.seat,
  25|       resolve: ({ source, api }) => {
  26|         if (source && (source.uses || 0) < 3) api.addUses(source, 1)
  27|       } },
  28|     { kind: 'reaction', trigger: 'testInitiated', label: '发起攻击检定：横置并花 1 证据，本次攻击 +1 伤害',
  29|       cost: { exhaust: true, uses: 1 },
  30|       criteria: ({ inv, state, source, context }) => Boolean(source) && (context?.seat == null || context.seat === inv.seat)
  31|         && (context?.actionKind === 'fight' || context?.kind === 'fight' || state.skillTest?.actionKind === 'fight'),
  32|       resolve: ({ api }) => api.addExtraOnSuccess({ type: 'dealDamage', amount: 1, target: 'engaged' }) },
  33|   ],
  34|   modifiers: [
  35|     { target: 'skill:intellect', amount: 1 },
  36|     { target: 'skill:combat', amount: 1 },
  37|   ],
  38| }
  39| 
```


## 08087 Snipe / 狙击
type=event klass=guardian subtype=- xp=1 cost=0 slot=- traits=Tactic
entry: src/cards/entries/08087.js
```text
text: During the next fight action you perform this turn using a [[Ranged]] or [[Firearm]] asset, treat each [skull], [cultist], [tablet], [elder_thing], or [auto_fail] token you reveal as a "0" token. This action does not provoke attacks of opportunity.
```
```text
textZh: 你本回合下一个使用了[[远程]]或[[枪械]]支援的攻击行动期间，将你揭示的每个[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]标记视为“0”标记。本行动不会触发趁乱攻击。
```
```js
   1| // 08087 狙击
   2| // 卡面：你本回合下一个使用了[[远程]]或[[枪械]]支援的攻击行动期间，将你揭示的每个
   3| //       [skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]标记视为「0」标记。本行动不会触发趁乱攻击。
   4| //
   5| // 读点：api.addEffect 的延迟效果 + 效果 abilities 参与窗口枚举（effect-state.js 的
   6| // effectAbilitySources → ability-rules.js）；forced 在 tokenEffectWouldResolve 窗口用
   7| // effect 数据体 cancelSymbolToken 取消符号标记效果。
   8| //
   9| // approximation:
  10| //   1) 作用域是「本回合余下的检定」，而非精确限定「下一个使用远程/枪械支援的攻击行动」；
  11| //   2) cancelSymbolToken 是既有最接近「符号标记视为 0」的读点（取消该标记的符号效果）；
  12| //   3) 「本行动不会触发趁乱攻击」暂无延迟 noOpportunityAttack 读点，已提交请求 m2-3-08087。
  13| //
  14| // 一张卡一个文件：这张卡的行为只在这里维护。
  15| 
  16| export default {
  17|   code: '08087',
  18|   abilities: [
  19|     { kind: 'played', label: '本回合攻击检定：符号标记视为 0',
  20|       resolve: ({ inv, api }) => {
  21|         api.addEffect({
  22|           duration: 'endOfTurn',
  23|           label: '狙击：攻击检定中符号标记视为 0',
  24|           sourceCode: '08087',
  25|           controllerSeat: inv.seat,
  26|           abilities: [{ kind: 'forced', label: '攻击检定中符号标记视为 0', trigger: 'tokenEffectWouldResolve',
  27|             effect: { type: 'cancelSymbolToken' } }],
  28|           modifiers: [],
  29|         })
  30|       } },
  31|   ],
  32|   modifiers: [],
  33| }
  34| 
```


## 08088 Old Shotgun / 老旧的霰弹枪
type=asset klass=guardian subtype=- xp=2 cost=0 slot=Hand x2 traits=Item,Weapon,Firearm
entry: src/cards/entries/08088.js
```text
text: Uses (0 ammo). While playing an event, treat Old Shotgun's uses value as 2.
[action] Spend 1 ammo: Fight. You get +3 [combat] for this attack. Instead of its standard damage, this attack's damage is equal to the amount you succeed by, or fail by if you fail and would damage another investigator (to a minimum of 1, to a maximum of 3).
```
```text
textZh: 使用(0子弹)。打出一张事件卡牌时，将老旧的霰弹枪的使用值视为2。
[action]花费1子弹：攻击。你本次攻击得到+3[combat]。本次攻击不造成标准伤害，改为：攻击成功时造成的伤害数量等于你超过难度的值；攻击失败且将对另一位调查员造成伤害时，对该调查员造成的伤害数量等于你低于难度的值。(伤害最小为1，最大为3)。
```
```js
   1| // 08088 老旧的霰弹枪
   2| // 卡面：使用(0子弹)。打出一张事件卡牌时，将老旧的霰弹枪的使用值视为2。
   3| //       [action]花费1子弹：攻击。你本次攻击得到+3[combat]。本次攻击不造成标准伤害，
   4| //       改为：攻击成功时造成的伤害数量等于你超过难度的值；攻击失败且将对另一位调查员造成伤害时，
   5| //       对该调查员造成的伤害数量等于你低于难度的值。(伤害最小为1，最大为3)。
   6| //
   7| // 读点：
   8| //   · 攻击走 effect.type=fight 的既有字段：successDamage:'overDifficulty'、minDamage/maxDamage、
   9| //     failByAmountToEngaged（失败转嫁交战队友，与 01029 霰弹枪同一读点）。
  10| //   · 「打出一张事件卡牌时使用值视为 2」：eventPlayed 窗口 + api.setAssetUses。
  11| //
  12| // 一张卡一个文件：这张卡的行为只在这里维护。
  13| 
  14| export default {
  15|   code: '08088',
  16|   uses: 0,
  17|   usesType: 'ammo',
  18|   abilities: [
  19|     { kind: 'action', label: '开火（战斗 +3，按超过难度造成 1~3 伤害）', cost: { action: true, uses: 1 },
  20|       effect: { type: 'fight', combatBonus: 3, successDamage: 'overDifficulty',
  21|         minDamage: 1, maxDamage: 3, failByAmountToEngaged: true } },
  22|     { kind: 'reaction', trigger: 'eventPlayed', label: '打出一张事件后：使用值视为 2',
  23|       criteria: ({ source, context }) => Boolean(source) && Boolean(context?.cardCode || context?.cardId),
  24|       resolve: ({ source, api }) => { if (source) api.setAssetUses(source, 2) } },
  25|   ],
  26|   modifiers: [],
  27| }
  28| 
```


## 08089 Quickdraw Holster / 快拔枪套
type=asset klass=guardian subtype=- xp=4 cost=4 slot=Body traits=Item,Tool,Illicit
entry: src/cards/entries/08089.js
```text
text: [fast]: Choose a [[Firearm]] asset taking up only 1 hand slot in your play area. Attach it to Quickdraw Holster, or switch it with the attached asset. The attached asset takes up no hand slots. (Limit 1 attached asset.)
[fast] Exhaust Quickdraw Holster: Perform a fight action on the attached asset without paying its [action] cost.
```
```text
textZh: [free]：选择一张在你游戏区域，只占据1个手部槽位的[[枪械]]支援，将其附属到快拔枪套，或与已附属的支援交换。附属的支援不占用手部槽位。(附属的支援仅限1张。)
[free]横置快拔枪套：执行一次已附属支援的攻击行动且无需支付其[action]费用。
```
```js
   1| // 08089 快拔枪套
   2| // 卡面：[free]：选择一张在你游戏区域，只占据1个手部槽位的[[枪械]]支援，将其附属到快拔枪套，
   3| //       或与已附属的支援交换。附属的支援不占用手部槽位。(附属的支援仅限1张。)
   4| //       [free]横置快拔枪套：执行一次已附属支援的攻击行动且无需支付其[action]费用。
   5| //
   6| // 读点：api.attachOrSwapControlledAsset（附属/交换，唯一读点；挂到 host.attachedToAsset）；
   7| // api.cardAbilityOptions + api.resolveCardAbility(...,{ignoreCosts:true}) 执行附属支援的攻击能力。
   8| //
   9| // approximation:
  10| //   1) 「只占 1 个手部槽位」用 trait=firearm 过滤，未再校验槽位数量（引擎无槽位查询 API）；
  11| //   2) 附属后槽位豁免依赖引擎既有的「attachedToAsset 支援不再占用槽位」口径；
  12| //   3) 第二能力固定取附属支援第一条含「攻击/开火/射击」的 action 能力。
  13| //
  14| // 一张卡一个文件：这张卡的行为只在这里维护。
  15| 
  16| export default {
  17|   code: '08089',
  18|   abilities: [
  19|     { kind: 'free', label: '选择一张[[枪械]]支援附属到快拔枪套（或交换）', cost: { action: false },
  20|       resolve: ({ inv, source, api }) => {
  21|         if (!source) return
  22|         const candidates = inv.assets.filter(asset => asset !== source && asset.attachedToAsset == null
  23|           && api.cardType(asset.code) === 'asset'
  24|           && api.cardTraits(asset.code).some(trait => String(trait).toLowerCase() === 'firearm'))
  25|           .map(asset => ({ id: asset.id, label: api.cardName(asset.code) }))
  26|         if (!candidates.length) { api.info('没有可附属的[[枪械]]支援。'); return }
  27|         const picked = candidates.length === 1 ? candidates[0].id : api.choice({
  28|           kind: 'target', source: '08089', seat: inv.seat, prompt: '选择要附属（或交换）的[[枪械]]支援。', options: candidates,
  29|         })
  30|         api.attachOrSwapControlledAsset(inv.seat, source.id, picked)
  31|       } },
  32|     { kind: 'free', label: '横置：免费执行附属[[枪械]]的攻击行动', cost: { action: false, exhaust: true },
  33|       resolve: ({ inv, source, api }) => {
  34|         if (!source) return
  35|         const attached = inv.assets.find(asset => asset.attachedToAsset === source.id)
  36|         if (!attached) { api.info('快拔枪套上没有附属的[[枪械]]支援。'); return }
  37|         const options = api.cardAbilityOptions(inv.seat, attached, { ignoreCosts: true })
  38|         const attack = options.find(option => option.index != null && /攻击|开火|射击/.test(option.label)) || options[0]
  39|         if (!attack) { api.info('附属支援没有可执行的攻击能力。'); return }
  40|         api.resolveCardAbility(inv.seat, attached, { abilityIndex: attack.index, ignoreCosts: true })
  41|       } },
  42|   ],
  43|   modifiers: [],
  44| }
  45| 
```


## 08090 Brand of Cthugha / 克图格亚的烙印
type=asset klass=guardian subtype=- xp=1 cost=2 slot=Arcane traits=Spell
entry: src/cards/entries/08090.js
```text
text: Uses (6 charges).
[action]: Fight. For this attack, you may use [willpower] instead of [combat], and you get +1 skill value. If you succeed, spend 1 or 2 charges. Instead of its standard damage, this attack deals 1 damage for each charge spent. If you succeed by 0, lose 1 action.
```
```text
textZh: 使用(6充能)。
[action]：攻击。你在本次攻击中得到+1技能值，并且可以不使用[combat]，改为使用[willpower]。如果你成功，花费1或2充能。本次攻击不造成标准伤害，改为每花费1充能，造成1点伤害。如果你成功且等于难度，失去1行动。
```
```js
   1| // 08090 克图格亚的烙印（1 级）
   2| // 卡面：使用(6充能)。
   3| //       [action]：攻击。你在本次攻击中得到+1技能值，并且可以不使用[combat]，改为使用[willpower]。
   4| //       如果你成功，花费1或2充能。本次攻击不造成标准伤害，改为每花费1充能，造成1点伤害。
   5| //       如果你成功且等于难度，失去1行动。
   6| //
   7| // 读点：api.fight 的 skill/combatBonus/damageOverride；攻击成功回调（combat.js#doFight 的
   8| // opts.onSuccess，在伤害结算前）花费充能并改写 opts.damageOverride；「成功且等于难度」= 成功点 0，
   9| // 用 api.loseActions 扣行动。
  10| //
  11| // 一张卡一个文件：这张卡的行为只在这里维护。
  12| 
  13| export default {
  14|   code: '08090',
  15|   uses: 6,
  16|   usesType: 'charges',
  17|   abilities: [
  18|     { kind: 'action', label: '烙印攻击（+1 技能值，可改用意志，按充能造成伤害）', cost: { action: true },
  19|       target: { kind: 'enemy' }, countsAs: 'fight',
  20|       resolve: ({ inv, source, target, api }) => {
  21|         if (!target) return
  22|         const skill = api.choice({ kind: 'effect', source: '08090', seat: inv.seat,
  23|           prompt: '本次攻击使用哪项技能？', options: [
  24|             { id: 'combat', label: '战斗' }, { id: 'willpower', label: '意志' },
  25|           ] }) === 'willpower' ? 'willpower' : 'combat'
  26|         api.fight(inv.seat, target.id, { skill, combatBonus: 1, assetId: source?.id, damageOverride: 0,
  27|           onSuccess: ({ result, opts }) => {
  28|             const max = Math.min(2, source?.uses || 0)
  29|             if (max < 1) return
  30|             const spend = api.choice({ kind: 'effect', source: '08090', seat: inv.seat,
  31|               prompt: '花费充能：每花费 1 充能造成 1 点伤害。',
  32|               options: Array.from({ length: max }, (_, offset) => ({ id: String(offset + 1), label: `花费 ${offset + 1} 充能` })) })
  33|             const spent = Math.max(1, Math.min(max, Number(spend) || 1))
  34|             api.spendUses(source, spent)
  35|             opts.damageOverride = spent
  36|             if (result && result.value - result.difficulty === 0) api.loseActions(inv.seat, 1)
  37|           } })
  38|       } },
  39|   ],
  40|   modifiers: [],
  41| }
  42| 
```


## 08091 Nkosi Mabati / 恩科西·马巴蒂
type=asset klass=guardian subtype=- xp=3 cost=4 slot=Ally traits=Ally,Sorcerer
entry: src/cards/entries/08091.js
```text
text: [reaction] After Nkosi Mabati enters play: Name a non-[elder_sign] chaos token with a symbol. Until this card leaves play, the named symbol is your "sigil."
[reaction] When an investigator at your location reveals a [cultist], [tablet], or [elder_thing] symbol, exhaust Nkosi Mabati: Search the chaos bag for your sigil and reveal it, instead (returning the other token to the chaos bag).
```
```text
textZh: [reaction]在恩科西·马巴蒂入场后：指定一个非[elder_sign]的符号混乱标记。在本卡牌离场前，指定的标记为你的“咒印”。
[reaction]在你所在地点的一位调查员揭示了一个[cultist]、[tablet]或[elder_thing]符号时，横置恩科西·马巴蒂：改为从混乱袋中查找你的咒印并揭示它(将其他标记放回混乱袋)
```
```js
   1| // 08091 恩科西·马巴蒂
   2| // 卡面：[reaction]在恩科西·马巴蒂入场后：指定一个非[elder_sign]的符号混乱标记。在本卡牌离场前，
   3| //       指定的标记为你的「咒印」。
   4| //       [reaction]在你所在地点的一位调查员揭示了一个[cultist]、[tablet]或[elder_thing]符号时，
   5| //       横置恩科西·马巴蒂：改为从混乱袋中查找你的咒印并揭示它(将其他标记放回混乱袋)。
   6| //
   7| // 读点：入场用 entersPlay 描述子；「咒印」用 api.addEffect（duration:'untilLeavesPlay'，
   8| // sourceInstanceId=本卡）记录指定符号，供后续读点/UI 使用。
   9| //
  10| // approximation:
  11| //   1) 引擎没有「从混乱袋指定一个标记并封印、且不需要玩家在面板二次选标记」的无 UI 原语；
  12| //      interactions.seal 是 mechanic 面板流程（事务内重放会重置选择），因此在条目里用
  13| //      api.addEffect 记录咒印类型（本卡离场时随来源过期），不乱动混乱袋。
  14| //   2) 「符号揭示后改为查找并揭示咒印」无法在 performTest 内替换已揭示标记（引擎只有
  15| //      beforeChaosTokenReveal 的 revealSealedInstead，需要先有封印实例），故省略该子句，
  16| //      已提交 primitive request m2-3-08091。
  17| //
  18| // 一张卡一个文件：这张卡的行为只在这里维护。
  19| 
  20| const SYMBOL_TOKENS = ['skull', 'cultist', 'tablet', 'elderthing']
  21| 
  22| export default {
  23|   code: '08091',
  24|   abilities: [
  25|     { kind: 'entersPlay', label: '入场：指定一个非旧印符号标记作为咒印',
  26|       resolve: ({ inv, source, state, api }) => {
  27|         if (!source) return
  28|         const bag = state.chaosBag || []
  29|         const available = SYMBOL_TOKENS.filter(token => bag.includes(token))
  30|         if (!available.length) { api.info('混乱袋中没有可指定的符号标记。'); return }
  31|         const token = available.length === 1 ? available[0] : api.choice({
  32|           kind: 'effect', source: '08091', seat: inv.seat, prompt: '选择要指定为咒印的符号标记。',
  33|           options: available.map(value => ({ id: value, label: api.tokenLabel?.(value) || value })),
  34|         })
  35|         if (!available.includes(token)) return
  36|         api.addEffect({
  37|           duration: 'untilLeavesPlay',
  38|           label: `咒印：${token}`,
  39|           sourceCode: '08091',
  40|           sourceInstanceId: source.id,
  41|           controllerSeat: inv.seat,
  42|           modifiers: [],
  43|         })
  44|         api.info(`「恩科西·马巴蒂」：指定 ${api.tokenLabel?.(token) || token} 为你的咒印。`)
  45|       } },
  46|   ],
  47|   modifiers: [],
  48| }
  49| 
```


## 08092 Brand of Cthugha / 克图格亚的烙印
type=asset klass=guardian subtype=- xp=4 cost=2 slot=Arcane traits=Spell
entry: src/cards/entries/08092.js
```text
text: Uses (9 charges).
[action]: Fight. For this attack, you may use [willpower] instead of [combat], and you get +2 skill value. If you succeed, spend 1, 2, or 3 charges. Instead of its standard damage, this attack deals 1 damage for each charge spent. If you succeed by 0, lose 2 actions.
```
```text
textZh: 使用(9充能)。
[action]：攻击。你在本次攻击中得到+2技能值，并且可以不使用[combat]，改为使用[willpower]。如果你成功，花费1、2或3充能。本次攻击不造成标准伤害，改为每花费1充能，造成1点伤害。如果你成功且等于难度，失去2行动。
```
```js
   1| // 08092 克图格亚的烙印（4 级）
   2| // 卡面：使用(9充能)。
   3| //       [action]：攻击。你在本次攻击中得到+2技能值，并且可以不使用[combat]，改为使用[willpower]。
   4| //       如果你成功，花费1、2或3充能。本次攻击不造成标准伤害，改为每花费1充能，造成1点伤害。
   5| //       如果你成功且等于难度，失去2行动。
   6| //
   7| // 读点同 08090（api.fight + 成功回调改写 damageOverride）。
   8| //
   9| // 一张卡一个文件：这张卡的行为只在这里维护。
  10| 
  11| export default {
  12|   code: '08092',
  13|   uses: 9,
  14|   usesType: 'charges',
  15|   abilities: [
  16|     { kind: 'action', label: '烙印攻击（+2 技能值，可改用意志，按充能造成伤害）', cost: { action: true },
  17|       target: { kind: 'enemy' }, countsAs: 'fight',
  18|       resolve: ({ inv, source, target, api }) => {
  19|         if (!target) return
  20|         const skill = api.choice({ kind: 'effect', source: '08092', seat: inv.seat,
  21|           prompt: '本次攻击使用哪项技能？', options: [
  22|             { id: 'combat', label: '战斗' }, { id: 'willpower', label: '意志' },
  23|           ] }) === 'willpower' ? 'willpower' : 'combat'
  24|         api.fight(inv.seat, target.id, { skill, combatBonus: 2, assetId: source?.id, damageOverride: 0,
  25|           onSuccess: ({ result, opts }) => {
  26|             const max = Math.min(3, source?.uses || 0)
  27|             if (max < 1) return
  28|             const spend = api.choice({ kind: 'effect', source: '08092', seat: inv.seat,
  29|               prompt: '花费充能：每花费 1 充能造成 1 点伤害。',
  30|               options: Array.from({ length: max }, (_, offset) => ({ id: String(offset + 1), label: `花费 ${offset + 1} 充能` })) })
  31|             const spent = Math.max(1, Math.min(max, Number(spend) || 1))
  32|             api.spendUses(source, spent)
  33|             opts.damageOverride = spent
  34|             if (result && result.value - result.difficulty === 0) api.loseActions(inv.seat, 2)
  35|           } })
  36|       } },
  37|   ],
  38|   modifiers: [],
  39| }
  40| 
```


## 08093 Cyclopean Hammer / 巨石锤
type=asset klass=guardian subtype=- xp=5 cost=5 slot=Hand x2 traits=Item,Relic,Weapon,Melee
entry: src/cards/entries/08093.js
```text
text: [action]: Fight. Add your [willpower] to your skill value for this attack. You deal +1 damage for this attack. If you succeed and the enemy is non-[[Elite]], you may move it one location away from you. (If you succeed by 3 or more, you instead deal +2 damage and may move the enemy up to two locations away from you.)
```
```text
textZh: [action]：攻击。本次攻击将你的[willpower]加入你的技能值。你在本次攻击中造成+1伤害。如果你成功并且该敌人为非[[精英]]，你可以将其朝着远离你的方向移动一个地点。(如果你成功且超过难度3点或更多，改为造成+2伤害并可以将其朝着远离你的方向移动最多2个地点。)
```
```js
   1| // 08093 巨石锤
   2| // 卡面：[action]：攻击。本次攻击将你的[willpower]加入你的技能值。你在本次攻击中造成+1伤害。
   3| //       如果你成功并且该敌人为非[[精英]]，你可以将其朝着远离你的方向移动一个地点。
   4| //       （如果你成功且超过难度3点或更多，改为造成+2伤害并可以将其朝着远离你的方向移动最多2个地点。）
   5| //
   6| // 读点：api.fight 的 addSkill:'willpower' + onSuccess 回调（伤害结算前可改 damageBonus），
   7| // 敌人位移走 api.moveEnemy（目标为非精英且远离你＝不回到你所在地点）。
   8| //
   9| // 一张卡一个文件：这张卡的行为只在这里维护。
  10| 
  11| const awayLocations = (state, inv, enemy) => (state.locations.find(location => location.id === enemy.location)?.connections || [])
  12|   .filter(id => id !== inv.location && state.locations.some(location => location.id === id))
  13| 
  14| export default {
  15|   code: '08093',
  16|   abilities: [
  17|     { kind: 'action', label: '攻击（加入意志，伤害 +1；成功可击退非精英敌人）', cost: { action: true },
  18|       target: { kind: 'enemy' }, countsAs: 'fight',
  19|       resolve: ({ inv, source, target, state, api }) => {
  20|         const enemy = target?.entity || (target ? state.enemies.find(item => item.id === target.id) : null)
  21|         if (!enemy) return
  22|         api.fight(inv.seat, enemy.id, { addSkill: 'willpower', damageBonus: 1, assetId: source?.id,
  23|           onSuccess: ({ result, opts }) => {
  24|             const successBy = result ? result.value - result.difficulty : 0
  25|             if (successBy >= 3) opts.damageBonus = (opts.damageBonus || 0) + 1
  26|             if (enemy.elite || !state.enemies.includes(enemy)) return
  27|             const steps = successBy >= 3 ? 2 : 1
  28|             for (let i = 0; i < steps; i++) {
  29|               const destinations = awayLocations(state, inv, enemy)
  30|               if (!destinations.length) break
  31|               const destination = destinations.length === 1 ? destinations[0] : api.choice({
  32|                 kind: 'location', source: '08093', seat: inv.seat,
  33|                 prompt: `选择将「${enemy.name}」击退到的地点。`,
  34|                 options: destinations.map(id => ({ id, label: api.locName(id) })),
  35|               })
  36|               api.moveEnemy(enemy, destination)
  37|             }
  38|           } })
  39|       } },
  40|   ],
  41|   modifiers: [],
  42| }
  43| 
```


## 08094 Sledgehammer / 长柄大锤
type=asset klass=guardian subtype=- xp=0 cost=3 slot=Hand x2 traits=Item,Tool,Weapon,Melee
entry: src/cards/entries/08094.js
```text
text: [action]: Fight. You get -1 [combat] and deal +1 damage for this attack.
[action] [action]: Fight. You get +2 [combat] and deal +2 damage for this attack.
```
```text
textZh: [action]：攻击。你本次攻击得到-1[combat]并造成+1伤害。
[action][action]：攻击。你本次攻击得到+2[combat]并造成+2伤害。
```
```js
   1| // 08094 长柄大锤（0 级）
   2| // 卡面：[action]：攻击。你本次攻击得到-1[combat]并造成+1伤害。
   3| //       [action][action]：攻击。你本次攻击得到+2[combat]并造成+2伤害。
   4| //
   5| // 一张卡一个文件：这张卡的行为只在这里维护。
   6| 
   7| export default {
   8|   code: '08094',
   9|   abilities: [
  10|     { kind: 'action', label: '挥砸（战斗 -1，伤害 +1）', cost: { action: true }, countsAs: 'fight',
  11|       effect: { type: 'fight', combatBonus: -1, damageBonus: 1 } },
  12|     { kind: 'action', label: '全力挥砸（战斗 +2，伤害 +2）', cost: { action: 2 }, countsAs: 'fight',
  13|       effect: { type: 'fight', combatBonus: 2, damageBonus: 2 } },
  14|   ],
  15|   modifiers: [],
  16| }
  17| 
```


## 08095 Protective Gear / 防护服
type=asset klass=guardian subtype=- xp=2 cost=4 slot=Body traits=Item,Armor
entry: src/cards/entries/08095.js
```text
text: [reaction] When you draw a [[Hazard]] treachery, deal 1 damage and 1 horror to Protective Gear: Cancel that card's revelation effect.
```
```text
textZh: [reaction]在你抽取一张[[危险]]诡计时，对防护服造成1点伤害和1点恐惧：取消该卡牌的显现效果。
```
```js
   1| // 08095 防护服
   2| // 卡面：[reaction]在你抽取一张[[危险]]诡计时，对防护服造成1点伤害和1点恐惧：取消该卡牌的显现效果。
   3| //
   4| // 读点：treachery 窗口（显现前 interrupt）；自身 1 伤害走费用 cost.assetDamage（能力费用入口），
   5| // 1 恐惧用 api.addAssetHorror；取消显现走 api.playerTools.cancelRevelation(context)。
   6| //
   7| // 一张卡一个文件：这张卡的行为只在这里维护。
   8| 
   9| export default {
  10|   code: '08095',
  11|   abilities: [
  12|     { kind: 'reaction', trigger: 'treachery', label: '危险诡计显现前：自身受 1 伤害 1 恐惧，取消显现',
  13|       cost: { assetDamage: 1 },
  14|       criteria: ({ inv, source, context }) => Boolean(source) && context?.seat === inv.seat,
  15|       resolve: ({ source, context, api }) => {
  16|         if (!source || !context) return
  17|         if (api.cardType(context.cardCode) !== 'treachery') return
  18|         if (!api.cardTraits(context.cardCode).some(trait => String(trait).toLowerCase() === 'hazard')) return
  19|         api.addAssetHorror(source, 1)
  20|         api.playerTools.cancelRevelation(context)
  21|       } },
  22|   ],
  23|   modifiers: [],
  24| }
  25| 
```


## 08096 Sledgehammer / 长柄大锤
type=asset klass=guardian subtype=- xp=4 cost=3 slot=Hand x2 traits=Item,Tool,Weapon,Melee
entry: src/cards/entries/08096.js
```text
text: [action]: Fight. You get +1 [combat] and deal +1 damage for this attack.
[action] [action] [action]: Fight. You get +5 [combat] and deal +5 damage for this attack.
```
```text
textZh: [action]：攻击。你本次攻击得到+1[combat]并造成+1伤害。
[action][action][action]：攻击。你本次攻击得到+5[combat]并造成+5伤害。
```
```js
   1| // 08096 长柄大锤（4 级）
   2| // 卡面：[action]：攻击。你本次攻击得到+1[combat]并造成+1伤害。
   3| //       [action][action][action]：攻击。你本次攻击得到+5[combat]并造成+5伤害。
   4| //
   5| // 一张卡一个文件：这张卡的行为只在这里维护。
   6| 
   7| export default {
   8|   code: '08096',
   9|   abilities: [
  10|     { kind: 'action', label: '挥砸（战斗 +1，伤害 +1）', cost: { action: true }, countsAs: 'fight',
  11|       effect: { type: 'fight', combatBonus: 1, damageBonus: 1 } },
  12|     { kind: 'action', label: '全力挥砸（战斗 +5，伤害 +5）', cost: { action: 3 }, countsAs: 'fight',
  13|       effect: { type: 'fight', combatBonus: 5, damageBonus: 5 } },
  14|   ],
  15|   modifiers: [],
  16| }
  17| 
```


## 08097 Pocket Telescope / 袖珍望远镜
type=asset klass=seeker subtype=- xp=0 cost=2 slot=Hand traits=Item,Tool
entry: src/cards/entries/08097.js
```text
text: [fast] Exhaust Pocket Telescope: Look at the revealed side of a connecting unrevealed location.
[action]: Investigate. Investigate a revealed connecting location as if you were there.
```
```text
textZh: [free]横置袖珍望远镜：查看一个连接的未揭示地点的揭示面。
[action]：调查。调查一个连接的已揭示地点，如同你在该地点。
```
```js
   1| // 08097 袖珍望远镜
   2| // 卡面：[free]横置袖珍望远镜：查看一个连接的未揭示地点的揭示面。
   3| //       [action]：调查。调查一个连接的已揭示地点，如同你在该地点。
   4| //
   5| // 读点：
   6| //   · 调查走 api.investigate(seat,{ locationId, noClueDiscovery })，成功后 api.discoverClue(seat,1,locationId)
   7| //     在目标地点发现线索（doInvestigate 的 locationId 只改调查口径，线索默认按所在地点发现）。
   8| //   · 「查看未揭示地点的揭示面」用条目 resolve 读取地点实例并 api.info 输出；look.js 的 lookAt
   9| //     只支持牌库区，没有地点揭示面的只读原语。
  10| //
  11| // approximation: 横置查看以「日志展示该未揭示地点的揭示面信息」实现，不改变地点揭示状态
  12| //   （与印刷一致：查看不等于揭示）；已提交 primitive request m2-3-08097。
  13| //
  14| // 一张卡一个文件：这张卡的行为只在这里维护。
  15| 
  16| export default {
  17|   code: '08097',
  18|   abilities: [
  19|     { kind: 'free', label: '横置：查看一个相连未揭示地点的揭示面', cost: { action: false, exhaust: true },
  20|       resolve: ({ inv, state, api }) => {
  21|         const here = state.locations.find(location => location.id === inv.location)
  22|         const candidates = (here?.connections || []).map(id => state.locations.find(location => location.id === id))
  23|           .filter(location => location && location.revealed !== true)
  24|         if (!candidates.length) { api.info('没有相连的未揭示地点。'); return }
  25|         const chosen = candidates.length === 1 ? candidates[0].id : api.choice({ kind: 'location', source: '08097', seat: inv.seat,
  26|           prompt: '选择要查看的连接地点。', options: candidates.map(location => ({ id: location.id, label: location.name })) })
  27|         const location = candidates.find(item => item.id === chosen) || candidates[0]
  28|         api.info(`🔭 查看「${location.name}」的揭示面：帷幕 ${location.shroud ?? '?'}，线索 ${location.clues ?? 0}。`)
  29|       } },
  30|     { kind: 'action', label: '调查一个相连的已揭示地点（如同你在该地点）', cost: { action: true },
  31|       resolve: ({ inv, state, api }) => {
  32|         const here = state.locations.find(location => location.id === inv.location)
  33|         const candidates = (here?.connections || []).map(id => state.locations.find(location => location.id === id))
  34|           .filter(location => location && location.revealed)
  35|         if (!candidates.length) { api.info('没有相连的已揭示地点。'); return }
  36|         const chosen = candidates.length === 1 ? candidates[0].id : api.choice({ kind: 'location', source: '08097', seat: inv.seat,
  37|           prompt: '选择要调查的相连地点。', options: candidates.map(location => ({ id: location.id, label: location.name })) })
  38|         // doInvestigate 的 locationId 只改调查地点口径，线索仍按调查员所在地点发现；
  39|         // 卡面要求「如同你在该地点」，因此抑制标准发现，成功后在该地点手动发现 1 个线索。
  40|         api.investigate(inv.seat, { locationId: chosen, noClueDiscovery: true })
  41|         const result = api.testResult()
  42|         if (result?.success) api.discoverClue(inv.seat, 1, chosen)
  43|       } },
  44|   ],
  45|   modifiers: [],
  46| }
  47| 
```


## 08098 Eon Chart / 远古海图
type=asset klass=seeker subtype=- xp=1 cost=2 slot=Accessory traits=Item,Relic
entry: src/cards/entries/08098.js
```text
text: Uses (3 secrets).
[fast] During your turn, exhaust Eon Chart and spend 1 secret: Choose and take one of the following actions (move, evade, or investigate).
```
```text
textZh: 使用(3秘密)。
[free]在你回合期间，横置远古海图并花费1秘密：选择并执行以下一个行动(移动、躲避或调查)。
```
```js
   1| // 08098 远古海图（1 级）
   2| // 卡面：使用(3秘密)。
   3| //       [free]在你回合期间，横置远古海图并花费1秘密：选择并执行以下一个行动(移动、躲避或调查)。
   4| //
   5| // 读点：api.moveDestinations/api.moveInvestigator（移动）、api.evade（躲避）、api.investigate（调查）
   6| // 都是不消耗行动的免费执行入口；费用走 cost { action:false, exhaust:true, uses:1 }。
   7| //
   8| // 一张卡一个文件：这张卡的行为只在这里维护。
   9| 
  10| const chooseAction = (inv, state, api) => {
  11|   const engaged = state.enemies.filter(enemy => inv.engaged.includes(enemy.id) && !enemy.exhausted && !enemy.defeated)
  12|   const options = [{ id: 'move', label: '移动' }, { id: 'investigate', label: '调查' }]
  13|   if (engaged.length) options.push({ id: 'evade', label: '躲避' })
  14|   const picked = api.choice({ kind: 'effect', source: '08098', seat: inv.seat, prompt: '选择要执行的行动。', options })
  15|   if (picked === 'move') {
  16|     const destinations = api.moveDestinations(inv.seat)
  17|     if (!destinations.length) return false
  18|     const destination = destinations.length === 1 ? destinations[0] : api.choice({ kind: 'location', source: '08098', seat: inv.seat,
  19|       prompt: '选择移动目的地。', options: destinations.map(id => ({ id, label: api.locName(id) })) })
  20|     api.moveInvestigator(inv.seat, destination)
  21|     return true
  22|   }
  23|   if (picked === 'evade') {
  24|     const enemyId = engaged.length === 1 ? engaged[0].id : api.choice({ kind: 'target', source: '08098', seat: inv.seat,
  25|       prompt: '选择要躲避的敌人。', options: engaged.map(enemy => ({ id: enemy.id, label: enemy.name })) })
  26|     api.evade(inv.seat, { enemyId })
  27|     return true
  28|   }
  29|   api.investigate(inv.seat)
  30|   return true
  31| }
  32| 
  33| export default {
  34|   code: '08098',
  35|   uses: 3,
  36|   usesType: 'secrets',
  37|   abilities: [
  38|     { kind: 'free', label: '横置并花费 1 秘密：执行一个移动/躲避/调查行动', cost: { action: false, exhaust: true, uses: 1 },
  39|       resolve: ({ inv, state, api }) => { chooseAction(inv, state, api) } },
  40|   ],
  41|   modifiers: [],
  42| }
  43| 
```


## 08099 Gené Beauregard / 吉恩·波尔格
type=asset klass=seeker subtype=- xp=3 cost=5 slot=Ally traits=Ally,Wayfarer
entry: src/cards/entries/08099.js
```text
text: You get +1 [intellect] and +1 [agility].
[reaction] During your turn, after you move to a location, exhaust Gené Beauregard: Move a clue or a non-[[Elite]] enemy from a connecting location to your location, or vice versa.
```
```text
textZh: 你得到+1[intellect]和+1[agility]。
[reaction]在你回合期间，你移动到一个地点后，横置吉恩·波尔格：将1个线索或一个非[[精英]]敌人从一个连接地点移动到你的地点，或从你的地点移动到一个连接地点。
```
```js
   1| // 08099 吉恩·波尔格
   2| // 卡面：你得到+1[intellect]和+1[agility]。
   3| //       [reaction]在你回合期间，你移动到一个地点后，横置吉恩·波尔格：将1个线索或一个非[[精英]]敌人
   4| //       从一个连接地点移动到你的地点，或从你的地点移动到一个连接地点。
   5| //
   6| // 读点：move 窗口（移动后反应）；线索 api.moveClueToLocation(fromId,toId,count)；
   7| // 敌人 api.moveEnemy(enemy, locationId)。
   8| //
   9| // 一张卡一个文件：这张卡的行为只在这里维护。
  10| 
  11| export default {
  12|   code: '08099',
  13|   abilities: [
  14|     { kind: 'reaction', trigger: 'move', label: '移动后横置：在连接地点之间搬运 1 线索或 1 非精英敌人',
  15|       cost: { exhaust: true },
  16|       criteria: ({ inv, context }) => context?.seat === inv.seat && state_has_connection(inv, context),
  17|       resolve: ({ inv, state, source, api }) => {
  18|         if (!source) return
  19|         const here = state.locations.find(location => location.id === inv.location)
  20|         const connected = (here?.connections || []).map(id => state.locations.find(location => location.id === id))
  21|           .filter(Boolean)
  22|         const options = []
  23|         for (const location of connected) {
  24|           if ((location.clues || 0) > 0) options.push({ id: `clueIn:${location.id}`, label: `把「${location.name}」的 1 个线索拿到这里` })
  25|         }
  26|         if ((here?.clues || 0) > 0) {
  27|           for (const location of connected) options.push({ id: `clueOut:${location.id}`, label: `把这里的 1 个线索移到「${location.name}」` })
  28|         }
  29|         for (const enemy of state.enemies) {
  30|           if (enemy.defeated || enemy.elite) continue
  31|           if (connected.some(location => location.id === enemy.location)) {
  32|             options.push({ id: `enemyIn:${enemy.id}`, label: `把「${enemy.name}」移到你的地点` })
  33|           }
  34|           if (enemy.location === inv.location) {
  35|             options.push({ id: `enemyOut:${enemy.id}`, label: `把「${enemy.name}」移到一个连接地点` })
  36|           }
  37|         }
  38|         if (!options.length) return
  39|         const picked = options.length === 1 ? options[0].id : api.choice({ kind: 'effect', source: '08099', seat: inv.seat,
  40|           prompt: '选择要搬运的线索或敌人。', options })
  41|         const [mode, id] = String(picked).split(':')
  42|         if (mode === 'clueIn') api.moveClueToLocation(id, inv.location, 1)
  43|         else if (mode === 'clueOut') api.moveClueToLocation(inv.location, id, 1)
  44|         else if (mode === 'enemyIn') api.moveEnemy(state.enemies.find(enemy => enemy.id === id), inv.location)
  45|         else if (mode === 'enemyOut') {
  46|           const enemy = state.enemies.find(item => item.id === id)
  47|           const destination = api.choice({ kind: 'location', source: '08099', seat: inv.seat,
  48|             prompt: '选择该敌人的目的地。', options: connected.map(location => ({ id: location.id, label: location.name })) })
  49|           api.moveEnemy(enemy, destination)
  50|         }
  51|       } },
  52|   ],
  53|   modifiers: [
  54|     { target: 'skill:intellect', amount: 1 },
  55|     { target: 'skill:agility', amount: 1 },
  56|   ],
  57| }
  58| 
  59| // 移动后窗口上下文只带 seat/location；只要本卡控制者仍在场内即可尝试搬运。
  60| function state_has_connection(inv) {
  61|   return Boolean(inv) && !inv.defeated && !inv.resigned
  62| }
  63| 
```


## 08100 Eon Chart / 远古海图
type=asset klass=seeker subtype=- xp=4 cost=2 slot=Accessory traits=Item,Relic
entry: src/cards/entries/08100.js
```text
text: Uses (3 secrets).
[fast] During your turn, exhaust Eon Chart and spend 1 secret: Choose and take two different actions of the following, in any order (move, evade, or investigate).
```
```text
textZh: 使用(3秘密)。
[free]在你回合期间，横置远古海图并花费1秘密：以任意顺序选择并执行以下两个行动(移动、躲避或调查)。
```
```js
   1| // 08100 远古海图（4 级）
   2| // 卡面：使用(3秘密)。
   3| //       [free]在你回合期间，横置远古海图并花费1秘密：以任意顺序选择并执行以下两个行动(移动、躲避或调查)。
   4| //
   5| // 读点同 08098：移动/躲避/调查都走不消耗行动的免费执行入口；本卡执行两轮选择。
   6| //
   7| // 一张卡一个文件：这张卡的行为只在这里维护。
   8| 
   9| const performAction = (inv, state, api) => {
  10|   const engaged = state.enemies.filter(enemy => inv.engaged.includes(enemy.id) && !enemy.exhausted && !enemy.defeated)
  11|   const options = [{ id: 'move', label: '移动' }, { id: 'investigate', label: '调查' }]
  12|   if (engaged.length) options.push({ id: 'evade', label: '躲避' })
  13|   const picked = api.choice({ kind: 'effect', source: '08100', seat: inv.seat, prompt: '选择要执行的行动。', options })
  14|   if (picked === 'move') {
  15|     const destinations = api.moveDestinations(inv.seat)
  16|     if (!destinations.length) return
  17|     const destination = destinations.length === 1 ? destinations[0] : api.choice({ kind: 'location', source: '08100', seat: inv.seat,
  18|       prompt: '选择移动目的地。', options: destinations.map(id => ({ id, label: api.locName(id) })) })
  19|     api.moveInvestigator(inv.seat, destination)
  20|     return
  21|   }
  22|   if (picked === 'evade') {
  23|     const enemyId = engaged.length === 1 ? engaged[0].id : api.choice({ kind: 'target', source: '08100', seat: inv.seat,
  24|       prompt: '选择要躲避的敌人。', options: engaged.map(enemy => ({ id: enemy.id, label: enemy.name })) })
  25|     api.evade(inv.seat, { enemyId })
  26|     return
  27|   }
  28|   api.investigate(inv.seat)
  29| }
  30| 
  31| export default {
  32|   code: '08100',
  33|   uses: 3,
  34|   usesType: 'secrets',
  35|   abilities: [
  36|     { kind: 'free', label: '横置并花费 1 秘密：执行两个移动/躲避/调查行动', cost: { action: false, exhaust: true, uses: 1 },
  37|       resolve: ({ inv, state, api }) => {
  38|         performAction(inv, state, api)
  39|         performAction(inv, state, api)
  40|       } },
  41|   ],
  42|   modifiers: [],
  43| }
  44| 
```


## 08101 Divination / 占卜
type=asset klass=seeker subtype=- xp=1 cost=3 slot=Arcane traits=Spell,Augury
entry: src/cards/entries/08101.js
```text
text: Uses (4 charges).
[action]: Investigate. For this investigation, you may use [willpower] instead of [intellect], and you get +1 skill value. If you succeed, spend 1 or 2 charges. Instead of discovering a clue at your location, discover 1 clue at your location for each charge spent. If you succeed by 0, choose and discard a card from your hand.
```
```text
textZh: 使用(4充能)。
[action]：调查。你在本次调查中得到+1技能值，并且可以不使用[intellect]，改为使用[willpower]。如果你成功，花费1或2充能。不发现你所在地点的1个线索，改为你每花费1充能，发现你所在地点的1个线索。如果你成功且等于难度，选择你一张手牌并将其弃掉。
```
```js
   1| // 08101 占卜（1 级）
   2| // 卡面：使用(4充能)。
   3| //       [action]：调查。你在本次调查中得到+1技能值，并且可以不使用[intellect]，改为使用[willpower]。
   4| //       如果你成功，花费1或2充能。不发现你所在地点的1个线索，改为你每花费1充能，发现你所在地点的1个线索。
   5| //       如果你成功且等于难度，选择你一张手牌并将其弃掉。
   6| //
   7| // 读点：api.investigate 的 skill/bonus/noClueDiscovery 选项（不发现标准线索，改为按充能手动发现）；
   8| // api.spendUses、api.discoverClue；等难度弃手牌 api.discardChosen。
   9| //
  10| // 一张卡一个文件：这张卡的行为只在这里维护。
  11| 
  12| export default {
  13|   code: '08101',
  14|   uses: 4,
  15|   usesType: 'charges',
  16|   abilities: [
  17|     { kind: 'action', label: '占卜调查（+1 技能值，可改用意志，按充能发现线索）', cost: { action: true },
  18|       resolve: ({ inv, source, api }) => {
  19|         const skill = api.choice({ kind: 'effect', source: '08101', seat: inv.seat,
  20|           prompt: '本次调查使用哪项技能？', options: [
  21|             { id: 'intellect', label: '智力' }, { id: 'willpower', label: '意志' },
  22|           ] }) === 'willpower' ? 'willpower' : 'intellect'
  23|         api.investigate(inv.seat, { skill, bonus: 1, noClueDiscovery: true })
  24|         const result = api.testResult()
  25|         if (!result?.success) return
  26|         const max = Math.min(2, source?.uses || 0)
  27|         if (max >= 1) {
  28|           const spend = api.choice({ kind: 'effect', source: '08101', seat: inv.seat,
  29|             prompt: '花费充能：每花费 1 充能发现 1 个线索。',
  30|             options: Array.from({ length: max }, (_, offset) => ({ id: String(offset + 1), label: `花费 ${offset + 1} 充能` })) })
  31|           const spent = Math.max(1, Math.min(max, Number(spend) || 1))
  32|           api.spendUses(source, spent)
  33|           api.discoverClue(inv.seat, spent)
  34|         }
  35|         if (result.value - result.difficulty === 0) api.discardChosen(inv.seat, 1, '08101')
  36|       } },
  37|   ],
  38|   modifiers: [],
  39| }
  40| 
```


## 08102 Protecting the Anirniq / 保护魂灵
type=event klass=seeker subtype=- xp=2 cost=1 slot=- traits=Ritual
entry: src/cards/entries/08102.js
```text
text: Fast. Play after an [[Ally]] asset at your location is discarded by a card effect or is defeated.
Either return that asset to its owner's hand, or its owner draws 3 cards.
```
```text
textZh: 快速。你所在地点的一个[[盟友]]支援被击败或因卡牌效果弃掉后打出。
将该支援返回其拥有者手中，或其拥有者抽取3张卡牌。
```
```js
   1| // 08102 保护魂灵
   2| // 卡面：快速。你所在地点的一个[[盟友]]支援被击败或因卡牌效果弃掉后打出。
   3| //       将该支援返回其拥有者手中，或其拥有者抽取3张卡牌。
   4| //
   5| // 读点：assetLeavesPlay 窗口（含 reason）；返回手牌 api.moveCard({from:'discard',to:'hand',ownerSeat})，
   6| // 或 api.drawCards(ownerSeat,3)。
   7| //
   8| // 一张卡一个文件：这张卡的行为只在这里维护。
   9| 
  10| export default {
  11|   code: '08102',
  12|   abilities: [
  13|     { kind: 'played', fast: true, trigger: 'assetLeavesPlay', label: '盟友支援离场后：返回其拥有者手中，或让拥有者抽 3 张',
  14|       criteria: ({ inv, context }) => Boolean(context?.asset) && context?.seat === inv.seat
  15|         && context?.asset?.location === inv.location
  16|         && ((context?.asset?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')),
  17|       resolve: ({ inv, source, context, api }) => {
  18|         const asset = context?.asset
  19|         if (!asset) return
  20|         const owner = Number.isSafeInteger(asset.ownerSeat) ? asset.ownerSeat : inv.seat
  21|         const picked = api.choice({ kind: 'effect', source: '08102', seat: inv.seat,
  22|           prompt: '选择保护魂灵的效果。', options: [
  23|             { id: 'return', label: '将该支援返回其拥有者手中' },
  24|             { id: 'draw', label: `让拥有者抽取 3 张卡牌` },
  25|           ] })
  26|         if (picked === 'return') api.moveCard({ code: asset.code, from: 'discard', to: 'hand', ownerSeat: owner })
  27|         else api.drawCards(owner, 3)
  28|       } },
  29|   ],
  30|   modifiers: [],
  31| }
  32| 
```


## 08103 Divination / 占卜
type=asset klass=seeker subtype=- xp=4 cost=3 slot=Arcane traits=Spell,Augury
entry: src/cards/entries/08103.js
```text
text: Uses (6 charges).
[action]: Investigate. For this investigation, you may use [willpower] instead of [intellect], and you get +2 skill value. If you succeed, spend 1, 2, or 3 charges. Instead of discovering a clue at your location, discover 1 clue at your location for each charge spent. If you succeed by 0, choose and discard 2 cards from your hand.
```
```text
textZh: 使用(6充能)。
[action]：调查。你在本次调查中得到+2技能值，并且可以不使用[intellect]，改为使用[willpower]。如果你成功，花费1、2或3充能。不发现你所在地点的1个线索，改为你每花费1充能，发现你所在地点的1个线索。如果你成功且等于难度，选择你2张手牌并将其弃掉。
```
```js
   1| // 08103 占卜（4 级）
   2| // 卡面：使用(6充能)。
   3| //       [action]：调查。你在本次调查中得到+2技能值，并且可以不使用[intellect]，改为使用[willpower]。
   4| //       如果你成功，花费1、2或3充能。不发现你所在地点的1个线索，改为你每花费1充能，发现你所在地点的1个线索。
   5| //       如果你成功且等于难度，选择你2张手牌并将其弃掉。
   6| //
   7| // 读点同 08101。
   8| //
   9| // 一张卡一个文件：这张卡的行为只在这里维护。
  10| 
  11| export default {
  12|   code: '08103',
  13|   uses: 6,
  14|   usesType: 'charges',
  15|   abilities: [
  16|     { kind: 'action', label: '占卜调查（+2 技能值，可改用意志，按充能发现线索）', cost: { action: true },
  17|       resolve: ({ inv, source, api }) => {
  18|         const skill = api.choice({ kind: 'effect', source: '08103', seat: inv.seat,
  19|           prompt: '本次调查使用哪项技能？', options: [
  20|             { id: 'intellect', label: '智力' }, { id: 'willpower', label: '意志' },
  21|           ] }) === 'willpower' ? 'willpower' : 'intellect'
  22|         api.investigate(inv.seat, { skill, bonus: 2, noClueDiscovery: true })
  23|         const result = api.testResult()
  24|         if (!result?.success) return
  25|         const max = Math.min(3, source?.uses || 0)
  26|         if (max >= 1) {
  27|           const spend = api.choice({ kind: 'effect', source: '08103', seat: inv.seat,
  28|             prompt: '花费充能：每花费 1 充能发现 1 个线索。',
  29|             options: Array.from({ length: max }, (_, offset) => ({ id: String(offset + 1), label: `花费 ${offset + 1} 充能` })) })
  30|           const spent = Math.max(1, Math.min(max, Number(spend) || 1))
  31|           api.spendUses(source, spent)
  32|           api.discoverClue(inv.seat, spent)
  33|         }
  34|         if (result.value - result.difficulty === 0) api.discardChosen(inv.seat, 2, '08103')
  35|       } },
  36|   ],
  37|   modifiers: [],
  38| }
  39| 
```


## 08104 Professor William Webb / 威廉·韦伯教授
type=asset klass=seeker subtype=- xp=0 cost=3 slot=Ally traits=Ally,Miskatonic
entry: src/cards/entries/08104.js
```text
text: Uses (3 secrets).
[reaction] When you successfully investigate, exhaust Professor William Webb and spend 1 secret: Instead of discovering a clue at your location, either choose an [[Item]] card in your discard pile and add it to your hand, or discover a clue at a connecting location.
```
```text
textZh: 使用(3秘密)。
[reaction]在你调查成功时，横置威廉·韦伯教授并花费1秘密：不发现你所在地点的1个线索，改为在你的弃牌堆中选择一张[[道具]]卡牌，将其加入你的手中，或在一个连接地点发现1个线索。
```
```js
   1| // 08104 威廉·韦伯教授（1 级）
   2| // 卡面：使用(3秘密)。
   3| //       [reaction]在你调查成功时，横置威廉·韦伯教授并花费1秘密：不发现你所在地点的1个线索，
   4| //       改为在你的弃牌堆中选择一张[[道具]]卡牌，将其加入你的手中，或在一个连接地点发现1个线索。
   5| //
   6| // 读点：investigateSuccess 窗口（调查成功后、发现线索前）+ 支援费用 {exhaust, uses}；
   7| // 弃牌堆取道具 api.moveCard({from:'discard',to:'hand'})；连接地点线索 api.discoverClue(seat,1,locationId)。
   8| //
   9| // approximation: 「不发现你所在地点的 1 个线索」的替换没有可写入口（investigateSuccess 上下文不可改
  10| // 调查结算），因此本实现按追加效果处理（标准线索仍会发现）；已提交请求 m2-3-08104。
  11| //
  12| // 一张卡一个文件：这张卡的行为只在这里维护。
  13| 
  14| export default {
  15|   code: '08104',
  16|   uses: 3,
  17|   usesType: 'secrets',
  18|   abilities: [
  19|     { kind: 'reaction', trigger: 'investigateSuccess', label: '调查成功：横置并花 1 秘密，取回道具或在连接地点发现线索',
  20|       cost: { exhaust: true, uses: 1 },
  21|       criteria: ({ inv, source, context }) => Boolean(source) && context?.seat === inv.seat,
  22|       resolve: ({ inv, source, api }) => {
  23|         if (!source) return
  24|         const items = [...new Set(inv.discard.filter(code => api.cardType(code) === 'asset'
  25|           && api.cardTraits(code).some(trait => String(trait).toLowerCase() === 'item')))]
  26|         const here = api.locName(inv.location) || inv.location
  27|         const connected = (api.moveDestinations?.(inv.seat) || [])
  28|         const options = []
  29|         if (items.length) options.push({ id: 'item', label: '从弃牌堆取回一张[[道具]]卡牌' })
  30|         if (connected.length) options.push({ id: 'clue', label: '在一个连接地点发现 1 个线索' })
  31|         if (!options.length) { api.info('弃牌堆没有道具，也没有可发现线索的连接地点。'); return }
  32|         const picked = options.length === 1 ? options[0].id : api.choice({
  33|           kind: 'effect', source: '08104', seat: inv.seat, prompt: `选择「${here}」调查成功后的收益。`, options,
  34|         })
  35|         if (picked === 'item') {
  36|           const code = items.length === 1 ? items[0] : api.choice({
  37|             kind: 'card', source: '08104', seat: inv.seat, prompt: '选择要取回的[[道具]]卡牌。',
  38|             options: items.map(value => ({ id: value, label: api.cardName(value) })),
  39|           })
  40|           api.moveCard({ code, from: 'discard', to: 'hand' })
  41|         } else {
  42|           const locationId = connected.length === 1 ? connected[0] : api.choice({
  43|             kind: 'location', source: '08104', seat: inv.seat, prompt: '选择要发现线索的连接地点。',
  44|             options: connected.map(id => ({ id, label: api.locName(id) })),
  45|           })
  46|           if (api.canDiscoverClueAt(inv.seat, locationId)) api.discoverClue(inv.seat, 1, locationId)
  47|         }
  48|       } },
  49|   ],
  50|   modifiers: [],
  51| }
  52| 
```


## 08105 Ice Pick / 破冰锥
type=asset klass=seeker subtype=- xp=1 cost=1 slot=Hand traits=Item,Tool,Melee
entry: src/cards/entries/08105.js
```text
text: Fast.
[fast] During a skill test while fighting or investigating, exhaust Ice Pick: You get +1 skill value for this test.
```
```text
textZh: 快速。
[free]攻击或调查时的技能检定期间，横置破冰锥：你本次检定得到技能值+1。
```
```js
   1| // 08105 破冰锥（1 级）
   2| // 卡面：快速。
   3| //       [free]攻击或调查时的技能检定期间，横置破冰锥：你本次检定得到技能值+1。
   4| //
   5| // 读点：技能检定内的玩家窗口（test.beforeCommit / test.afterCommit）+ duringOwnSkillTest；
   6| // 用 api.addTestPendingBonus(1) 加技能值；criteria 读 state.skillTest.actionKind 限定攻击/调查检定。
   7| //
   8| // 一张卡一个文件：这张卡的行为只在这里维护。
   9| 
  10| export default {
  11|   code: '08105',
  12|   fast: true,
  13|   abilities: [
  14|     { kind: 'free', trigger: ['test.beforeCommit', 'test.afterCommit'], duringOwnSkillTest: true,
  15|       label: '横置：本次攻击/调查检定 +1 技能值', cost: { action: false, exhaust: true },
  16|       criteria: ({ state }) => ['fight', 'investigate'].includes(state.skillTest?.actionKind),
  17|       resolve: ({ api }) => api.addTestPendingBonus(1) },
  18|   ],
  19|   modifiers: [],
  20| }
  21| 
```


## 08106 Professor William Webb / 威廉·韦伯教授
type=asset klass=seeker subtype=- xp=2 cost=3 slot=Ally traits=Ally,Miskatonic
entry: src/cards/entries/08106.js
```text
text: Uses (3 secrets).
[reaction] When you successfully investigate, exhaust Professor William Webb and spend 1 secret: Choose an [[Item]] card in your discard pile and add it to your hand. Instead of discovering a clue at your location, you may discover a clue at a connecting location.
```
```text
textZh: 使用(3秘密)。
[reaction]在你调查成功时，横置威廉·韦伯教授并花费1秘密：在你的弃牌堆中选择一张[[道具]]卡牌，将其加入你的手中。你可以不发现你所在地点的1个线索，改为在一个连接地点发现1个线索。
```
```js
   1| // 08106 威廉·韦伯教授（2 级）
   2| // 卡面：使用(3秘密)。
   3| //       [reaction]在你调查成功时，横置威廉·韦伯教授并花费1秘密：在你的弃牌堆中选择一张[[道具]]卡牌，
   4| //       将其加入你的手中。你可以不发现你所在地点的1个线索，改为在一个连接地点发现1个线索。
   5| //
   6| // 读点同 08104：investigateSuccess 窗口 + {exhaust, uses} 费用 + api.moveCard / api.discoverClue。
   7| //
   8| // approximation: 与 08104 相同——「不发现所在地点线索改为连接地点线索」是追加而非替换，
   9| //   已提交请求 m2-3-08106 / m2-3-08104。
  10| //
  11| // 一张卡一个文件：这张卡的行为只在这里维护。
  12| 
  13| export default {
  14|   code: '08106',
  15|   uses: 3,
  16|   usesType: 'secrets',
  17|   abilities: [
  18|     { kind: 'reaction', trigger: 'investigateSuccess', label: '调查成功：横置并花 1 秘密，取回道具（可改为连接地点发现线索）',
  19|       cost: { exhaust: true, uses: 1 },
  20|       criteria: ({ inv, source, context }) => Boolean(source) && context?.seat === inv.seat,
  21|       resolve: ({ inv, source, api }) => {
  22|         if (!source) return
  23|         const items = [...new Set(inv.discard.filter(code => api.cardType(code) === 'asset'
  24|           && api.cardTraits(code).some(trait => String(trait).toLowerCase() === 'item')))]
  25|         if (items.length) {
  26|           const code = items.length === 1 ? items[0] : api.choice({
  27|             kind: 'card', source: '08106', seat: inv.seat, prompt: '选择要取回的[[道具]]卡牌。',
  28|             options: items.map(value => ({ id: value, label: api.cardName(value) })),
  29|           })
  30|           api.moveCard({ code, from: 'discard', to: 'hand' })
  31|         }
  32|         const connected = api.moveDestinations(inv.seat) || []
  33|         if (!connected.length) return
  34|         const picked = api.choice({
  35|           kind: 'effect', source: '08106', seat: inv.seat, canSkip: true,
  36|           prompt: '是否改为在一个连接地点发现 1 个线索？',
  37|           options: [{ id: 'skip', label: '不额外发现' },
  38|             ...connected.map(id => ({ id, label: `在「${api.locName(id)}」发现 1 个线索` }))],
  39|         })
  40|         if (picked && picked !== 'skip' && api.canDiscoverClueAt(inv.seat, picked)) api.discoverClue(inv.seat, 1, picked)
  41|       } },
  42|   ],
  43|   modifiers: [],
  44| }
  45| 
```


## 08107 Ice Pick / 破冰锥
type=asset klass=seeker subtype=- xp=3 cost=1 slot=Hand traits=Item,Tool,Melee
entry: src/cards/entries/08107.js
```text
text: Fast.
[fast] During a skill test while fighting or investigating, exhaust Ice Pick: You get +1 skill value for this test. If you succeed, you may discard Ice Pick to have this attack deal +1 damage (if you are fighting), or to discover 1 additional clue at your location (if you are investigating).
```
```text
textZh: 快速。
[free]攻击或调查时的技能检定期间，横置破冰锥：你本次检定得到技能值+1。如果你成功，你可以弃掉破冰锥来使得本次攻击造成+1伤害(如果你攻击)，或发现你所在地点的额外1个线索(如果你调查)。
```
```js
   1| // 08107 破冰锥（3 级）
   2| // 卡面：快速。
   3| //       [free]攻击或调查时的技能检定期间，横置破冰锥：你本次检定得到技能值+1。
   4| //       如果你成功，你可以弃掉破冰锥来使得本次攻击造成+1伤害(如果你攻击)，或发现你所在地点的额外1个线索(如果你调查)。
   5| //
   6| // 读点：+1 技能值走技能检定内的玩家窗口 + api.addTestPendingBonus(1)；
   7| // 「成功后弃掉本卡换取收益」用第二条 free 能力（弃掉自身费用）+ api.addExtraOnSuccess 近似：
   8| //   调查 → 额外 discoverClue；攻击 → 额外 dealDamage(engaged)。
   9| //
  10| // approximation: 弃置时机是检定窗口（印刷为成功后可选），且攻击收益按「成功后对交战敌人追加 1 伤害」
  11| //   结算而非并入本次攻击伤害；已提交请求 m2-3-08107。
  12| //
  13| // 一张卡一个文件：这张卡的行为只在这里维护。
  14| 
  15| export default {
  16|   code: '08107',
  17|   fast: true,
  18|   abilities: [
  19|     { kind: 'free', trigger: ['test.beforeCommit', 'test.afterCommit'], duringOwnSkillTest: true,
  20|       label: '横置：本次攻击/调查检定 +1 技能值', cost: { action: false, exhaust: true },
  21|       criteria: ({ state }) => ['fight', 'investigate'].includes(state.skillTest?.actionKind),
  22|       resolve: ({ api }) => api.addTestPendingBonus(1) },
  23|     { kind: 'free', trigger: ['test.beforeCommit', 'test.afterCommit'], duringOwnSkillTest: true,
  24|       label: '弃掉破冰锥：成功时额外 +1 伤害/线索', cost: { action: false, discardSelf: true },
  25|       criteria: ({ state }) => ['fight', 'investigate'].includes(state.skillTest?.actionKind),
  26|       resolve: ({ state, api }) => {
  27|         if (state.skillTest?.actionKind === 'investigate') api.addExtraOnSuccess({ type: 'discoverClue', amount: 1 })
  28|         else api.addExtraOnSuccess({ type: 'dealDamage', amount: 1, target: 'engaged' })
  29|       } },
  30|   ],
  31|   modifiers: [],
  32| }
  33| 
```


## 08108 Ethereal Slip / 虚影易位
type=event klass=rogue subtype=- xp=0 cost=2 slot=- traits=Spell,Trick
entry: src/cards/entries/08108.js
```text
text: Choose a non-[[Elite]] enemy at a revealed location up to 2 connections away. Swap places with that enemy.
```
```text
textZh: 选择一个位于已揭示地点的非[[精英]]敌人，且其所在地点与你的连接次数不超过2。与该敌人交换位置。
```
```js
   1| // 08108 虚影易位
   2| // 卡面：选择一个位于已揭示地点的非[[精英]]敌人，且其所在地点与你的连接次数不超过2。与该敌人交换位置。
   3| //
   4| // 读点：连接次数用 state.locations[].connections 只读 BFS（<=2 跳）；交换位置走
   5| // api.moveInvestigator（你到敌人地点）与 api.moveEnemy（敌人到你原地点）。
   6| //
   7| // 一张卡一个文件：这张卡的行为只在这里维护。
   8| 
   9| const distance = (state, from, to, max = 2) => {
  10|   if (!from || !to) return Infinity
  11|   const queue = [[from, 0]]
  12|   const seen = new Set([from])
  13|   while (queue.length) {
  14|     const [current, steps] = queue.shift()
  15|     if (current === to) return steps
  16|     if (steps >= max) continue
  17|     for (const next of state.locations.find(item => item.id === current)?.connections || []) {
  18|       if (seen.has(next)) continue
  19|       seen.add(next)
  20|       queue.push([next, steps + 1])
  21|     }
  22|   }
  23|   return Infinity
  24| }
  25| 
  26| export default {
  27|   code: '08108',
  28|   abilities: [
  29|     { kind: 'played', label: '选择 2 连接内已揭示地点的非精英敌人，与其交换位置',
  30|       resolve: ({ inv, state, api }) => {
  31|         const origin = inv.location
  32|         const candidates = state.enemies.filter(enemy => !enemy.defeated && !enemy.elite
  33|           && state.locations.find(location => location.id === enemy.location)?.revealed
  34|           && distance(state, origin, enemy.location) <= 2)
  35|         if (!candidates.length) { api.info('2 个连接内没有可交换位置的非精英敌人。'); return }
  36|         const enemyId = candidates.length === 1 ? candidates[0].id : api.choice({ kind: 'target', source: '08108', seat: inv.seat,
  37|           prompt: '选择要交换位置的敌人。', options: candidates.map(enemy => ({
  38|             id: enemy.id, label: `${enemy.name}（${api.locName(enemy.location)}）`,
  39|           })) })
  40|         const enemy = candidates.find(item => item.id === enemyId) || candidates[0]
  41|         const destination = enemy.location
  42|         // 先移动调查员到敌人地点，再把敌人移回原地点：relocateEnemy 会解除交战并带走敌人，
  43|         // 避免「先移敌人后移调查员」时被交战敌人跟随。
  44|         api.moveInvestigator(inv.seat, destination)
  45|         api.moveEnemy(enemy, origin)
  46|       } },
  47|   ],
  48|   modifiers: [],
  49| }
  50| 
```


## 08109 Blur / 身形虚化
type=asset klass=rogue subtype=- xp=1 cost=2 slot=Arcane traits=Spell
entry: src/cards/entries/08109.js
```text
text: Uses (3 charges).
[action] If Blur has charges remaining: Evade. For this evasion attempt, you may use [willpower] instead of [agility], and you get +1 skill value. If you succeed, spend 1 charge and you may take an additional action this turn. If you succeed by 0, take 1 damage.
```
```text
textZh: 使用(3充能)。
[action]如果身形虚化还有剩余充能：躲避。你在本次躲避尝试中得到+1技能值，并且可以不使用[agility]，改为使用[willpower]。如果你成功，花费1充能且本回合可以执行1次额外行动。如果你成功且等于难度，受到1点伤害。
```
```js
   1| // 08109 身形虚化（Blur，0–1 级）
   2| // 卡面：使用(3充能)。
   3| // [action] 如果身形虚化还有剩余充能：躲避。你在本次躲避尝试中可以不使用[agility]，改为使用[willpower]，
   4| //        并且得到 +1 技能值。如果你成功，花费 1 充能且本回合可以执行 1 次额外行动。
   5| //        如果你成功且等于难度，受到 1 点伤害。
   6| //
   7| // 一张卡一个文件：这张卡的行为只在这里维护。
   8| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   9| //
  10| // 读点：
  11| //   · 躲避走 api.evade（支持 skill/bonus/assetId，返回真实检定结果）；
  12| //   · 花充能走 api.spendUses，额外行动走 api.gainAction（P0–P5 既有原语）；
  13| //   · 「成功且等于难度」读检定结果的 value/difficulty，不写私有回合字段。
  14| const code = '08109'
  15| 
  16| export default {
  17|   code,
  18|   uses: 3,
  19|   usesType: 'charges',
  20|   abilities: [
  21|     {
  22|       kind: 'action',
  23|       label: '躲避：可改用意志、+1 技能；成功花 1 充能获得额外行动',
  24|       countsAs: 'evade',
  25|       cost: { action: true },
  26|       // 「如果身形虚化还有剩余充能」：没有充能时能力不可用。
  27|       criteria: [({ source }) => (source?.uses || 0) > 0],
  28|       target: { kind: 'enemy', query: ({ inv, entity }) => entity.engagedSeat === inv.seat },
  29|       resolve: ({ inv, source, target, api }) => {
  30|         const enemy = target?.entity
  31|         if (!enemy) return
  32|         const skill = inv.willpower === inv.agility
  33|           ? 'agility'
  34|           : api.choice({
  35|             kind: 'effect', source: code, seat: inv.seat,
  36|             prompt: '身形虚化：本次躲避尝试使用哪个技能？',
  37|             options: [{ id: 'agility', label: '使用敏捷' }, { id: 'willpower', label: '改用意志' }],
  38|           })
  39|         const result = api.evade(inv.seat, {
  40|           enemyId: enemy.id,
  41|           skill: skill === 'willpower' ? 'willpower' : 'agility',
  42|           bonus: 1,
  43|           assetId: source?.id,
  44|           sourceCode: code,
  45|         })
  46|         if (!result?.success) return
  47|         api.spendUses(source, 1)
  48|         api.gainAction(inv.seat, 1)
  49|         api.info(`🌀 「身形虚化」：${inv.name} 躲避成功，花费 1 充能并获得 1 个额外行动。`)
  50|         if (result.value - result.difficulty === 0) {
  51|           api.damage(inv.seat, 1)
  52|           api.info(`🌀 「身形虚化」：成功且等于难度，${inv.name} 受到 1 点伤害。`)
  53|         }
  54|       },
  55|     },
  56|   ],
  57|   modifiers: [],
  58| }
  59| 
```


## 08110 Ethereal Slip / 虚影易位
type=event klass=rogue subtype=- xp=2 cost=1 slot=- traits=Spell,Trick
entry: src/cards/entries/08110.js
```text
text: Choose a non-[[Elite]] enemy at any revealed location. Swap places with that enemy.
```
```text
textZh: 选择位于任意一个已揭示地点的非[[精英]]敌人。与该敌人交换位置。
```
```js
   1| // 08110 虚影易位（Ethereal Slip）
   2| // 卡面：选择位于任意一个已揭示地点的非[[精英]]敌人。与该敌人交换位置。
   3| //
   4| // 一张卡一个文件：这张卡的行为只在这里维护。
   5| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   6| //
   7| // 读点：
   8| //   · 调查员位移走 api.moveInvestigator（权威效果位移入口，自动揭示/交战）；
   9| //   · 敌人位移走 api.moveEnemy（relocateEnemy 统一处理交战解除/入场与自动交战）；
  10| //   · 先移动调查员、再移动敌人：若先移敌人，敌人会先与我交战，随后调查员移动时会把交战敌人一起带走。
  11| const code = '08110'
  12| 
  13| export default {
  14|   code,
  15|   // 「选择位于任意一个已揭示地点的非精英敌人」：没有合法目标时事件不能打出。
  16|   playCondition: [{
  17|     when: ({ state }) => (state.enemies || []).some(enemy => !enemy.defeated && !enemy.elite
  18|       && state.locations.some(location => location.id === enemy.location && location.revealed)),
  19|     message: '已揭示地点没有非精英敌人，不能打出「虚影易位」',
  20|   }],
  21|   abilities: [
  22|     {
  23|       kind: 'played',
  24|       label: '与任意已揭示地点的非精英敌人交换位置',
  25|       resolve: ({ state, inv, api }) => {
  26|         const revealed = new Set(state.locations.filter(location => location.revealed).map(location => location.id))
  27|         const candidates = state.enemies.filter(enemy => !enemy.defeated && !enemy.elite && revealed.has(enemy.location))
  28|         if (!candidates.length) {
  29|           api.info('「虚影易位」：已揭示地点没有非精英敌人。')
  30|           return
  31|         }
  32|         const label = enemy => `${enemy.name}（${api.locationName(enemy.location)}）`
  33|         const chosenId = candidates.length === 1 ? candidates[0].id : api.choice({
  34|           kind: 'target', source: code, seat: inv.seat,
  35|           prompt: '选择任意已揭示地点的非精英敌人，与它交换位置。',
  36|           options: candidates.map(enemy => ({ id: enemy.id, label: label(enemy) })),
  37|         })
  38|         const enemy = candidates.find(item => item.id === chosenId)
  39|         if (!enemy) return
  40|         const origin = inv.location
  41|         const destination = enemy.location
  42|         if (!destination) return
  43|         if (destination === origin) {
  44|           api.info(`「虚影易位」：「${enemy.name}」与 ${inv.name} 已经在同一地点，没有交换。`)
  45|           return
  46|         }
  47|         api.moveInvestigator(inv.seat, destination)
  48|         api.moveEnemy(enemy, origin)
  49|         api.info(`🌀 「虚影易位」：${inv.name} 与「${enemy.name}」交换了位置。`)
  50|       },
  51|     },
  52|   ],
  53|   modifiers: [],
  54| }
  55| 
```


## 08111 Blur / 身形虚化
type=asset klass=rogue subtype=- xp=4 cost=2 slot=Arcane traits=Spell
entry: src/cards/entries/08111.js
```text
text: Uses (4 charges).
[action] If Blur has charges remaining: Evade. For this evasion attempt, you may use [willpower] instead of [agility] and get +2 skill value. If you succeed, spend 1 or 2 charges and you may take that many additional actions this turn. If you succeed by 0, take 2 damage.
```
```text
textZh: 使用(4充能)。
[action]如果身形虚化还有剩余充能：躲避。你在本次躲避尝试中得到+2技能值，并且可以不使用[agility]，改为使用[willpower]。如果你成功，花费1或2充能且本回合可以执行对应数量次数的额外行动。如果你成功且等于难度，受到2点伤害。
```
```js
   1| // 08111 身形虚化（Blur，4 级）
   2| // 卡面：使用(4充能)。
   3| // [action] 如果身形虚化还有剩余充能：躲避。你在本次躲避尝试中可以不使用[agility]，改为使用[willpower]，
   4| //        并且得到 +2 技能值。如果你成功，花费 1 或 2 充能，且本回合可以执行对应数量的额外行动。
   5| //        如果你成功且等于难度，受到 2 点伤害。
   6| //
   7| // 一张卡一个文件：这张卡的行为只在这里维护。
   8| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   9| //
  10| // 读点：api.evade（skill/bonus/assetId 与返回值）、api.spendUses、api.gainAction、api.damage。
  11| const code = '08111'
  12| 
  13| export default {
  14|   code,
  15|   uses: 4,
  16|   usesType: 'charges',
  17|   abilities: [
  18|     {
  19|       kind: 'action',
  20|       label: '躲避：可改用意志、+2 技能；成功花 1–2 充能获得等量额外行动',
  21|       countsAs: 'evade',
  22|       cost: { action: true },
  23|       criteria: [({ source }) => (source?.uses || 0) > 0],
  24|       target: { kind: 'enemy', query: ({ inv, entity }) => entity.engagedSeat === inv.seat },
  25|       resolve: ({ inv, source, target, api }) => {
  26|         const enemy = target?.entity
  27|         if (!enemy) return
  28|         const skill = inv.willpower === inv.agility
  29|           ? 'agility'
  30|           : api.choice({
  31|             kind: 'effect', source: code, seat: inv.seat,
  32|             prompt: '身形虚化：本次躲避尝试使用哪个技能？',
  33|             options: [{ id: 'agility', label: '使用敏捷' }, { id: 'willpower', label: '改用意志' }],
  34|           })
  35|         const result = api.evade(inv.seat, {
  36|           enemyId: enemy.id,
  37|           skill: skill === 'willpower' ? 'willpower' : 'agility',
  38|           bonus: 2,
  39|           assetId: source?.id,
  40|           sourceCode: code,
  41|         })
  42|         if (!result?.success) return
  43|         const maximum = Math.min(2, source?.uses || 0)
  44|         if (maximum < 1) return
  45|         const spend = maximum === 1 ? 1 : Number(api.choice({
  46|           kind: 'effect', source: code, seat: inv.seat,
  47|           prompt: '身形虚化：成功。花费几点充能（获得等量额外行动）？',
  48|           options: Array.from({ length: maximum }, (_, index) => ({
  49|             id: String(index + 1), label: `花费 ${index + 1} 充能，获得 ${index + 1} 个额外行动`,
  50|           })),
  51|         }))
  52|         const amount = Math.max(1, Math.min(maximum, Number.isSafeInteger(spend) ? spend : 1))
  53|         api.spendUses(source, amount)
  54|         api.gainAction(inv.seat, amount)
  55|         api.info(`🌀 「身形虚化」：${inv.name} 躲避成功，花费 ${amount} 充能并获得 ${amount} 个额外行动。`)
  56|         if (result.value - result.difficulty === 0) {
  57|           api.damage(inv.seat, 2)
  58|           api.info(`🌀 「身形虚化」：成功且等于难度，${inv.name} 受到 2 点伤害。`)
  59|         }
  60|       },
  61|     },
  62|   ],
  63|   modifiers: [],
  64| }
  65| 
```


## 08112 "Hit me!" / "再来一张！"
type=event klass=rogue subtype=- xp=0 cost=1 slot=- traits=Fortune,Gambit
entry: src/cards/entries/08112.js
```text
text: Fast. Play after you reveal a chaos token during a skill test.
Reveal an additional chaos token, switching its "-" to a "+". If that chaos token is a [skull] token, you automatically fail.
```
```text
textZh: 快速。你在技能检定期间揭示混乱标记后打出。
额外揭示一个混乱标记，并经其“-”变为“+”。如果该标记是[skull]，你自动失败。
```
```js
   1| // 08112 「再来一张！」（"Hit me!"）
   2| // 卡面：快速。你在技能检定期间揭示混乱标记后打出。
   3| //        额外揭示一个混乱标记，并将其「-」变为「+」。如果该标记是[skull]，你自动失败。
   4| //
   5| // 一张卡一个文件：这张卡的行为只在这里维护。
   6| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   7| //
   8| // approximation: 引擎没有「在本次检定里追加第二枚标记并把它计入」的读点（existing 只有
   9| //   替换当前标记 tokenReveal / 额外揭示后二选一 extraChaosChoices）。本实现用 tokenReveal 窗口
  10| //   的替代标记通道近似：额外揭示 1 枚标记，把负值取正后作为替代标记结算（骷髅 → 自动失败）。
  11| //   与印刷的差异：原标记被替代而不是「两枚都计入」。主效果（额外揭示、负转正、骷髅自动失败）保留。
  12| const code = '08112'
  13| 
  14| export default {
  15|   code,
  16|   abilities: [
  17|     {
  18|       kind: 'played',
  19|       fast: true,
  20|       trigger: 'tokenReveal',
  21|       label: '额外揭示 1 枚标记（负转正；骷髅则自动失败）',
  22|       criteria: [({ state, inv }) => state.skillTest?.seat === inv.seat],
  23|       resolve: ({ state, inv, context, api }) => {
  24|         if (!state.skillTest || context?.when !== 'tokenReveal') return
  25|         const extra = api.revealChaosTokens(1)[0]
  26|         if (extra == null) {
  27|           api.info('「再来一张！」：混乱袋里没有可额外揭示的标记。')
  28|           return
  29|         }
  30|         // 「-」变「+」：负数标记取正；骷髅直接改为自动失败。
  31|         const flipped = /^-\d+$/.test(extra) ? `+${extra.slice(1)}` : extra === 'skull' ? 'autofail' : extra
  32|         context.replacementToken = flipped
  33|         api.info(`💥 「再来一张！」：额外揭示 ${api.tokenLabel(extra)}，`
  34|           + (flipped === 'autofail' ? '骷髅标记 → 本次检定自动失败。' : `改为 ${api.tokenLabel(flipped)}。`))
  35|       },
  36|     },
  37|   ],
  38|   modifiers: [],
  39| }
  40| 
```


## 08113 Unscrupulous Loan / 大肆借贷
type=asset klass=rogue subtype=- xp=3 cost=0 slot=- traits=Pact
entry: src/cards/entries/08113.js
```text
text: Limit 1 per investigator. Cannot leave play.
[reaction] After you play Unscrupulous Loan: Gain 10 resources.
Forced - When the game ends or you are eliminated, if you have fewer than 10 resources in your resource pool: Exile Unscrupulous Loan.
```
```text
textZh: 每位调查员仅限1张。不能离场。
[reaction]在你打出大肆借贷后：获得10资源。
强制 - 在游戏结束或你退场时，如果你资源池中的资源数量小于10：放逐大肆借贷。
```
```js
   1| // 08113 大肆借贷（Unscrupulous Loan）
   2| // 卡面：每位调查员仅限 1 张。不能离场。
   3| //        [reaction] 在你打出大肆借贷后：获得 10 资源。
   4| //        强制 - 在游戏结束或你退场时，如果你资源池中的资源数量小于 10：放逐大肆借贷。
   5| //
   6| // 一张卡一个文件：这张卡的行为只在这里维护。
   7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   8| //
   9| // 读点：入场窗口 assetEnteredPlay、不能离场 cannotLeavePlay、赚资源 api.gainResources、
  10| //       移出游戏 api.playerTools.removeAssetFromGame（流放近似：进入 removedFromGame 而非战役 exiled）。
  11| // approximation: 引擎没有「游戏结束/退场时」的通用条目强制窗口。这里近似为每轮结束时检查
  12| //   「资源池 < 10 → 移出游戏」，其余主行为（不能离场、打出获得 10 资源）完整实现。
  13| const code = '08113'
  14| 
  15| export default {
  16|   code,
  17|   cannotLeavePlay: true,
  18|   note: 'approximation: 印刷触发为「游戏结束或你退场时」；引擎无该窗口，近似为每轮结束时检查资源 < 10 → 流放自身。',
  19|   abilities: [
  20|     {
  21|       kind: 'reaction',
  22|       trigger: 'assetEnteredPlay',
  23|       label: '打出后：获得 10 资源',
  24|       criteria: [({ source, context }) => context?.assetCode === code && context?.assetId === source?.id
  25|         && !context?.unscrupulousLoanGained],
  26|       resolve: ({ inv, context, api }) => {
  27|         if (context) context.unscrupulousLoanGained = true
  28|         api.gainResources(inv.seat, 10)
  29|         api.info(`💰 「大肆借贷」：${inv.name} 获得 10 资源。`)
  30|       },
  31|     },
  32|     {
  33|       kind: 'forced',
  34|       trigger: 'roundEnds',
  35|       label: '近似-轮末：资源池 < 10 时流放自身',
  36|       criteria: [({ inv }) => (inv?.resources || 0) < 10],
  37|       resolve: ({ inv, source, api }) => {
  38|         if (!source) return
  39|         const removed = api.playerTools.removeAssetFromGame(inv.seat, source.id)
  40|         api.info(removed
  41|           ? `🪦 「大肆借贷」：${inv.name} 的资源少于 10，该卡被流放。`
  42|           : '🪦 「大肆借贷」：资源不足，但该卡无法离场。')
  43|       },
  44|     },
  45|   ],
  46|   modifiers: [],
  47| }
  48| 
```


## 08114 Precious Memento / 珍贵记忆
type=asset klass=rogue subtype=- xp=4 cost=3 slot=Accessory traits=Item,Charm,Blessed
entry: src/cards/entries/08114.js
```text
text: Limit 1 Precious Memento (From a Former Life) per deck.
[reaction] After you fail a skill test by 2 or more, exhaust Precious Memento: Heal 1 damage from it.
[reaction] After you succeed at a skill test by 2 or more, exhaust Precious Memento: Heal 1 horror from it.
```
```text
textZh: 每个牌库仅限1张珍贵记忆(来自前世)。
[reaction]你在一次技能检定中失败且低于难度2点或更多后，横置珍贵记忆：治愈其1点伤害。
[reaction]你在一次技能检定中成功且超过难度2点或更多后，横置珍贵记忆：治愈其1点恐惧。
```
```js
   1| // 08114 珍贵记忆（来自前世，Precious Memento · From a Former Life）
   2| // 卡面：每个牌库仅限 1 张珍贵记忆(来自前世)。
   3| // [reaction] 你在一次技能检定中失败且低于难度 2 点或更多后，横置珍贵记忆：治愈其 1 点伤害。
   4| // [reaction] 你在一次技能检定中成功且超过难度 2 点或更多后，横置珍贵记忆：治愈其 1 点恐惧。
   5| //
   6| // 一张卡一个文件：这张卡的行为只在这里维护。
   7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   8| //
   9| // 读点：
  10| //   · 检定结束时机用既有窗口 `testEnds`，context.result 带 success/successBy/failedBy；
  11| //   · 支援自身承受的伤害/恐惧用 api.healAsset（治愈恐惧走统一入口）。
  12| const code = '08114'
  13| 
  14| export default {
  15|   code,
  16|   abilities: [
  17|     {
  18|       kind: 'reaction',
  19|       trigger: 'testEnds',
  20|       label: '失败且低于难度 2+ 后横置：治愈自身 1 点伤害',
  21|       cost: { exhaust: true },
  22|       criteria: [({ inv, source, context }) => {
  23|         const result = context?.result
  24|         return context?.seat === inv.seat
  25|           && result?.success === false
  26|           && (result.difficulty - result.value) >= 2
  27|           && (source?.damage || 0) > 0
  28|       }],
  29|       resolve: ({ inv, source, api }) => {
  30|         api.healAsset(source, { damage: 1, ownerSeat: inv.seat })
  31|         api.info(`💗 「珍贵记忆（来自前世）」：${inv.name} 治愈其 1 点伤害。`)
  32|       },
  33|     },
  34|     {
  35|       kind: 'reaction',
  36|       trigger: 'testEnds',
  37|       label: '成功且超过难度 2+ 后横置：治愈自身 1 点恐惧',
  38|       cost: { exhaust: true },
  39|       criteria: [({ inv, source, context }) => {
  40|         const result = context?.result
  41|         return context?.seat === inv.seat
  42|           && result?.success === true
  43|           && (result.value - result.difficulty) >= 2
  44|           && (source?.horror || 0) > 0
  45|       }],
  46|       resolve: ({ inv, source, api }) => {
  47|         api.healAsset(source, { horror: 1, owner: inv })
  48|         api.info(`💗 「珍贵记忆（来自前世）」：${inv.name} 治愈其 1 点恐惧。`)
  49|       },
  50|     },
  51|   ],
  52|   modifiers: [],
  53| }
  54| 
```


## 08115 Precious Memento / 珍贵记忆
type=asset klass=rogue subtype=- xp=4 cost=3 slot=Accessory traits=Item,Charm,Cursed
entry: src/cards/entries/08115.js
```text
text: Limit 1 Precious Memento (From a Future Life) per deck.
[reaction] After you fail a skill test by 2 or more, exhaust Precious Memento: Heal 1 horror from it.
[reaction] After you succeed at a skill test by 2 or more, exhaust Precious Memento: Heal 1 damage from it.
```
```text
textZh: 每个牌库仅限1张珍贵记忆(来自后世)。
[reaction]你在一次技能检定中失败且低于难度2点或更多后，横置珍贵记忆：治愈其1点恐惧。
[reaction]你在一次技能检定中成功且超过难度2点或更多后，横置珍贵记忆：治愈其1点伤害。
```
```js
   1| // 08115 珍贵记忆（来自后世，Precious Memento · From a Future Life）
   2| // 卡面：每个牌库仅限 1 张珍贵记忆(来自后世)。
   3| // [reaction] 你在一次技能检定中失败且低于难度 2 点或更多后，横置珍贵记忆：治愈其 1 点恐惧。
   4| // [reaction] 你在一次技能检定中成功且超过难度 2 点或更多后，横置珍贵记忆：治愈其 1 点伤害。
   5| //
   6| // 一张卡一个文件：这张卡的行为只在这里维护。
   7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   8| //
   9| // 与 08114 同模板、治愈类型互换（来源：EotE 参考实现 PreciousMementoFromAFutureLife4.hs）。
  10| const code = '08115'
  11| 
  12| export default {
  13|   code,
  14|   abilities: [
  15|     {
  16|       kind: 'reaction',
  17|       trigger: 'testEnds',
  18|       label: '失败且低于难度 2+ 后横置：治愈自身 1 点恐惧',
  19|       cost: { exhaust: true },
  20|       criteria: [({ inv, source, context }) => {
  21|         const result = context?.result
  22|         return context?.seat === inv.seat
  23|           && result?.success === false
  24|           && (result.difficulty - result.value) >= 2
  25|           && (source?.horror || 0) > 0
  26|       }],
  27|       resolve: ({ inv, source, api }) => {
  28|         api.healAsset(source, { horror: 1, owner: inv })
  29|         api.info(`💗 「珍贵记忆（来自后世）」：${inv.name} 治愈其 1 点恐惧。`)
  30|       },
  31|     },
  32|     {
  33|       kind: 'reaction',
  34|       trigger: 'testEnds',
  35|       label: '成功且超过难度 2+ 后横置：治愈自身 1 点伤害',
  36|       cost: { exhaust: true },
  37|       criteria: [({ inv, source, context }) => {
  38|         const result = context?.result
  39|         return context?.seat === inv.seat
  40|           && result?.success === true
  41|           && (result.value - result.difficulty) >= 2
  42|           && (source?.damage || 0) > 0
  43|       }],
  44|       resolve: ({ inv, source, api }) => {
  45|         api.healAsset(source, { damage: 1, ownerSeat: inv.seat })
  46|         api.info(`💗 「珍贵记忆（来自后世）」：${inv.name} 治愈其 1 点伤害。`)
  47|       },
  48|     },
  49|   ],
  50|   modifiers: [],
  51| }
  52| 
```


## 08116 Talisman of Protection / 护身法宝
type=asset klass=mystic subtype=- xp=0 cost=2 slot=Arcane traits=Item,Charm
entry: src/cards/entries/08116.js
```text
text: Fast. Play only during your turn.
Play Talisman of Protection under the control of any investigator at your location.
[reaction] When you assign damage and/or horror that would defeat you, discard Talisman of Protection: Cancel up to 2 of that damage and/or horror.
```
```text
textZh: 快速。只可在你的回合期间打出。
打出护身法宝，置于你所在地点任意一位调查员控制之下。
[reaction]在你被分配伤害和/或恐惧，且其数量足够击败你时，弃掉护身法宝：取消该伤害和/或恐惧中的最多2点。
```
```js
   1| // 08116 护身法宝（Talisman of Protection）
   2| // 卡面：快速。只可在你的回合期间打出。
   3| // 打出护身法宝，置于你所在地点任意一位调查员控制之下。
   4| // [reaction] 在你被分配伤害和/或恐惧，且其数量足够击败你时，弃掉护身法宝：
   5| //        取消该伤害和/或恐惧中的最多 2 点。
   6| //
   7| // 一张卡一个文件：这张卡的行为只在这里维护。
   8| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   9| //
  10| // 读点：
  11| //   · 控制权转移：entersPlay 里 api.giveAsset（与 06020 庄严立誓同一原语）；
  12| //   · 「将受到的伤害/恐惧足以击败你」：既有窗口 `harmDealt`（04111 坚韧不拔同一时机），
  13| //     取消走 api.cancelHarm（maximum 2，弃掉自身是描述子 cost.discardSelf）。
  14| import { ownTurn } from '../../engine/matcher.js'
  15| 
  16| const code = '08116'
  17| 
  18| export default {
  19|   code,
  20|   fast: true,
  21|   playCondition: [{ when: ownTurn(), message: '「护身法宝」只能在你的回合期间打出' }],
  22|   abilities: [
  23|     {
  24|       kind: 'entersPlay',
  25|       label: '置于你所在地点任意一位调查员控制之下',
  26|       resolve: ({ state, inv, source, api }) => {
  27|         if (!source) return
  28|         const candidates = state.investigators.filter(other => !other.defeated && !other.resigned
  29|           && other.location === inv.location)
  30|         if (!candidates.length) return
  31|         const chosen = candidates.length === 1 ? candidates[0].seat : Number(api.choice({
  32|           kind: 'investigator', source: code, seat: inv.seat,
  33|           prompt: '选择「护身法宝」的控制者（你所在地点的任意一位调查员）。',
  34|           options: candidates.map(other => ({ id: String(other.seat), label: other.name })),
  35|         }))
  36|         const target = state.investigators[chosen]
  37|         if (!target || chosen === inv.seat) return
  38|         if (!api.giveAsset(source, chosen)) return
  39|         api.info(`🛡️ 「护身法宝」置于 ${target.name} 的控制之下。`)
  40|       },
  41|     },
  42|     {
  43|       kind: 'reaction',
  44|       trigger: 'harmDealt',
  45|       label: '将被击败时弃掉：取消本次伤害/恐惧中的最多 2 点',
  46|       cost: { discardSelf: true },
  47|       criteria: [({ state, inv, context }) => {
  48|         if (context?.seat !== inv.seat) return false
  49|         const damage = Number(context?.damage) || 0
  50|         const horror = Number(context?.horror) || 0
  51|         if (!damage && !horror) return false
  52|         const maxHealth = inv.maxHealth ?? inv.health ?? 0
  53|         const maxSanity = inv.maxSanity ?? inv.sanity ?? 0
  54|         const lethalDamage = damage > 0 && maxHealth > 0 && (inv.damage || 0) + damage >= maxHealth
  55|         const lethalHorror = horror > 0 && maxSanity > 0 && (inv.horror || 0) + horror >= maxSanity
  56|         return lethalDamage || lethalHorror
  57|       }],
  58|       resolve: ({ inv, source, context, api }) => {
  59|         const damage = Math.max(0, Number(context?.damage) || 0)
  60|         const horror = Math.max(0, Number(context?.horror) || 0)
  61|         const options = []
  62|         for (let amountDamage = 0; amountDamage <= Math.min(damage, 2); amountDamage++) {
  63|           for (let amountHorror = 0; amountHorror <= Math.min(horror, 2 - amountDamage); amountHorror++) {
  64|             if (amountDamage + amountHorror === 0) continue
  65|             options.push({ id: `${amountDamage}:${amountHorror}`,
  66|               label: `取消 ${amountDamage} 伤害、${amountHorror} 恐惧` })
  67|           }
  68|         }
  69|         if (!options.length) return
  70|         const answer = options.length === 1 ? options[0].id : api.choice({
  71|           kind: 'harm', source: code, seat: inv.seat,
  72|           prompt: '「护身法宝」：选择要取消的伤害与恐惧（最多 2 点）。', options,
  73|         })
  74|         const [cancelledDamage, cancelledHorror] = String(answer).split(':').map(Number)
  75|         if (!Number.isFinite(cancelledDamage) || !Number.isFinite(cancelledHorror)) return
  76|         context.damage = Math.max(0, damage - cancelledDamage)
  77|         context.horror = Math.max(0, horror - cancelledHorror)
  78|         api.info(`🛡️ 「护身法宝」：${inv.name} 取消 ${cancelledDamage} 点伤害、${cancelledHorror} 点恐惧。`)
  79|       },
  80|     },
  81|   ],
  82|   modifiers: [],
  83| }
  84| 
```


## 08117 Earthly Serenity / 尘世宁静
type=asset klass=mystic subtype=- xp=1 cost=2 slot=Arcane traits=Spell
entry: src/cards/entries/08117.js
```text
text: Uses (4 charges).
[action]: Test [willpower] (1). For each point you succeed by, you may spend 1 charge to heal 1 damage or 1 horror from an investigator at your location. If you succeed by 0, lose 1 resource.
```
```text
textZh: 使用(4充能)。
[action]：检定[willpower](1)。你每成功且超过难度1点，你可以花费1充能来治愈你所在地点一位调查员1点伤害或1点恐惧。如果你成功且等于难度，失去1资源。
```
```js
   1| // 08117 尘世宁静（Earthly Serenity，1 级）
   2| // 卡面：使用(4充能)。
   3| // [action]：检定[willpower](1)。你每成功且超过难度 1 点，你可以花费 1 充能来治愈你所在地点
   4| //        一位调查员 1 点伤害或 1 点恐惧。如果你成功且等于难度，失去 1 资源。
   5| //
   6| // 一张卡一个文件：这张卡的行为只在这里维护。
   7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   8| //
   9| // 读点：api.test 返回真实检定结果（successBy 决定治疗次数）、api.spendUses、api.healDamage/api.healHorror、
  10| // api.loseResources；治疗恐惧走统一入口（治疗支援时由 owner 指定，这里是调查员本人）。
  11| const code = '08117'
  12| const DIFFICULTY = 1
  13| 
  14| export default {
  15|   code,
  16|   uses: 4,
  17|   usesType: 'charges',
  18|   abilities: [
  19|     {
  20|       kind: 'action',
  21|       label: '意志(1)：每超过难度 1 点，可花 1 充能治愈同地点调查员 1 伤害/恐惧',
  22|       cost: { action: true },
  23|       resolve: ({ state, inv, source, api }) => {
  24|         const result = api.test(inv.seat, 'willpower', DIFFICULTY, {
  25|           source: { label: '意志检定', name: api.cardName(code), code },
  26|         })
  27|         if (!result?.success) return
  28|         const successBy = Math.max(0, result.value - result.difficulty)
  29|         if (successBy === 0) {
  30|           api.loseResources(inv.seat, 1)
  31|           api.info(`🌿 「尘世宁静」：成功且等于难度，${inv.name} 失去 1 资源。`)
  32|           return
  33|         }
  34|         for (let point = 0; point < successBy; point++) {
  35|           if ((source?.uses || 0) <= 0) break
  36|           const targets = state.investigators.filter(other => !other.defeated && !other.resigned
  37|             && other.location === inv.location)
  38|           const options = [{ id: 'skip', label: '不花费充能' }]
  39|           for (const target of targets) {
  40|             if ((target.damage || 0) > 0) options.push({ id: `damage:${target.seat}`, label: `治愈 ${target.name} 1 点伤害` })
  41|             if ((target.horror || 0) > 0) options.push({ id: `horror:${target.seat}`, label: `治愈 ${target.name} 1 点恐惧` })
  42|           }
  43|           if (options.length === 1) break
  44|           const answer = options.length === 2 && options[0].id === 'skip' ? options[1].id : api.choice({
  45|             kind: 'effect', source: code, seat: inv.seat,
  46|             prompt: `「尘世宁静」：可花费 1 充能治愈同地点调查员 1 点伤害或恐惧（剩余可结算 ${successBy - point} 次）。`,
  47|             options,
  48|           })
  49|           if (!answer || answer === 'skip') break
  50|           const [kind, seatText] = String(answer).split(':')
  51|           const target = state.investigators[Number(seatText)]
  52|           if (!target) break
  53|           api.spendUses(source, 1)
  54|           if (kind === 'damage') api.healDamage(target.seat, 1)
  55|           else api.healHorror(target.seat, 1)
  56|           api.info(`🌿 「尘世宁静」：治愈 ${target.name} 1 点${kind === 'damage' ? '伤害' : '恐惧'}。`)
  57|         }
  58|       },
  59|     },
  60|   ],
  61|   modifiers: [],
  62| }
  63| 
```


## 08118 Enchanted Bow / 附魔弓
type=asset klass=mystic subtype=- xp=2 cost=3 slot=Hand x2. Arcane traits=Spell,Blessed,Weapon,Ranged
entry: src/cards/entries/08118.js
```text
text: Uses (3 charges).
[action] Exhaust Enchanted Bow: Fight. You must use either [willpower] or [agility] instead of [combat] and get +1 skill value for this attack. This attack deals +1 damage. As an additional cost to initiate this ability, you may spend 1 charge to have this attack target a non-[[Elite]] enemy at a connecting location; if you do, ignore the aloof and retaliate keywords for this attack.
```
```text
textZh: 使用(3充能)。
[action]横置附魔弓：攻击。你本次攻击得到+1技能值，并且必须改为使用[willpower]或[agility]，而不使用[combat]。本次攻击造成+1伤害。作为发动此能力的额外费用，你可以花费1充能来使本次攻击以一个连接地点的非[[精英]]敌人为目标；如果你这样做，在本次攻击中，忽略冷漠和反击关键词。
```
```js
   1| // 08118 附魔弓（Enchanted Bow）
   2| // 卡面：使用(3充能)。
   3| // [action] 横置附魔弓：攻击。你本次攻击得到 +1 技能值，并且必须改为使用[willpower]或[agility]，
   4| //        而不使用[combat]。本次攻击造成 +1 伤害。
   5| //        作为发动此能力的额外费用，你可以花费 1 充能来使本次攻击以一个连接地点的非[[精英]]敌人
   6| //        为目标；如果你这样做，在本次攻击中，忽略冷漠和反击关键词。
   7| //
   8| // 一张卡一个文件：这张卡的行为只在这里维护。
   9| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  10| //
  11| // 读点：api.fight 支持 skill / combatBonus / damageBonus / atConnectingLocation / ignoreAloof /
  12| // ignoreRetaliate（与「枪法如神」同一 doFight 管线）；额外费用用 api.spendUses。
  13| // 目标集合含连接地点的非精英敌人（target 描述子只收窄默认「同地点」候选，无法扩大，
  14| // 因此这里用 resolve 内的 api.choice 从「同地点全部 + 连接地点非精英」里选，同 05282 的写法）。
  15| const code = '08118'
  16| 
  17| function bowUses(inv) {
  18|   return (inv.assets || []).find(item => item.code === code)?.uses || 0
  19| }
  20| 
  21| export default {
  22|   code,
  23|   uses: 3,
  24|   usesType: 'charges',
  25|   abilities: [
  26|     {
  27|       kind: 'action',
  28|       label: '攻击：意志/敏捷替代战斗，+1 技能 +1 伤害（可花 1 充能打连接地点非精英）',
  29|       countsAs: 'fight',
  30|       cost: { action: true, exhaust: true },
  31|       resolve: ({ state, inv, source, api }) => {
  32|         const here = state.locations.find(location => location.id === inv.location)
  33|         const connections = here?.connections || []
  34|         const targets = state.enemies.filter(enemyCard => {
  35|           if (enemyCard.defeated) return false
  36|           if (enemyCard.location === inv.location) return true
  37|           return connections.includes(enemyCard.location) && !enemyCard.elite && bowUses(inv) > 0
  38|         })
  39|         if (!targets.length) {
  40|           api.info('「附魔弓」：没有可攻击的敌人。')
  41|           return
  42|         }
  43|         const label = enemyCard => `${enemyCard.name}（${api.locationName(enemyCard.location)}）`
  44|         const chosenId = targets.length === 1 ? targets[0].id : api.choice({
  45|           kind: 'target', source: code, seat: inv.seat,
  46|           prompt: '附魔弓：选择攻击目标（连接地点的非精英敌人需花费 1 充能）。',
  47|           options: targets.map(enemyCard => ({ id: enemyCard.id, label: label(enemyCard) })),
  48|         })
  49|         const enemy = targets.find(item => item.id === chosenId)
  50|         if (!enemy) return
  51|         const skill = api.choice({
  52|           kind: 'effect', source: code, seat: inv.seat,
  53|           prompt: '附魔弓：本次攻击使用意志还是敏捷（替代战斗）？',
  54|           options: [{ id: 'willpower', label: '使用意志' }, { id: 'agility', label: '使用敏捷' }],
  55|         })
  56|         const fromConnecting = enemy.location !== inv.location
  57|         if (fromConnecting) api.spendUses(source, 1)
  58|         api.info(`🏹 「附魔弓」：${inv.name} 使用${skill === 'agility' ? '敏捷' : '意志'}攻击「${enemy.name}」`
  59|           + (fromConnecting ? '（花费 1 充能，忽略冷漠与反击）' : '') + '。')
  60|         api.fight(inv.seat, enemy.id, {
  61|           assetId: source?.id,
  62|           skill: skill === 'agility' ? 'agility' : 'willpower',
  63|           combatBonus: 1,
  64|           damageBonus: 1,
  65|           atConnectingLocation: fromConnecting,
  66|           ignoreAloof: fromConnecting,
  67|           ignoreRetaliate: fromConnecting,
  68|           sourceCode: code,
  69|           noSpend: true,
  70|         })
  71|       },
  72|     },
  73|   ],
  74|   modifiers: [],
  75| }
  76| 
```


## 08119 Earthly Serenity / 尘世宁静
type=asset klass=mystic subtype=- xp=4 cost=2 slot=Arcane traits=Spell
entry: src/cards/entries/08119.js
```text
text: Uses (6 charges).
[action]: Test [willpower] (0). For each point you succeed by, you may spend 1 charge to heal 1 damage or 1 horror from an investigator at your location. If you succeed by 0, lose 2 resources.
```
```text
textZh: 使用(6充能)。
[action]：检定[willpower](0)。你每成功且超过难度1点，你可以花费1充能来治愈你所在地点一位调查员1点伤害或1点恐惧。如果你成功且等于难度，失去2资源。
```
```js
   1| // 08119 尘世宁静（Earthly Serenity，4 级）
   2| // 卡面：使用(6充能)。
   3| // [action]：检定[willpower](0)。你每成功且超过难度 1 点，你可以花费 1 充能来治愈你所在地点
   4| //        一位调查员 1 点伤害或 1 点恐惧。如果你成功且等于难度，失去 2 资源。
   5| //
   6| // 一张卡一个文件：这张卡的行为只在这里维护。
   7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   8| //
   9| // 与 08117 同模板，难度 0 / 充能 6 / 等难度时失去 2 资源（来源：EarthlySerenity4.hs）。
  10| const code = '08119'
  11| const DIFFICULTY = 0
  12| 
  13| export default {
  14|   code,
  15|   uses: 6,
  16|   usesType: 'charges',
  17|   abilities: [
  18|     {
  19|       kind: 'action',
  20|       label: '意志(0)：每超过难度 1 点，可花 1 充能治愈同地点调查员 1 伤害/恐惧',
  21|       cost: { action: true },
  22|       resolve: ({ state, inv, source, api }) => {
  23|         const result = api.test(inv.seat, 'willpower', DIFFICULTY, {
  24|           source: { label: '意志检定', name: api.cardName(code), code },
  25|         })
  26|         if (!result?.success) return
  27|         const successBy = Math.max(0, result.value - result.difficulty)
  28|         if (successBy === 0) {
  29|           api.loseResources(inv.seat, 2)
  30|           api.info(`🌿 「尘世宁静」：成功且等于难度，${inv.name} 失去 2 资源。`)
  31|           return
  32|         }
  33|         for (let point = 0; point < successBy; point++) {
  34|           if ((source?.uses || 0) <= 0) break
  35|           const targets = state.investigators.filter(other => !other.defeated && !other.resigned
  36|             && other.location === inv.location)
  37|           const options = [{ id: 'skip', label: '不花费充能' }]
  38|           for (const target of targets) {
  39|             if ((target.damage || 0) > 0) options.push({ id: `damage:${target.seat}`, label: `治愈 ${target.name} 1 点伤害` })
  40|             if ((target.horror || 0) > 0) options.push({ id: `horror:${target.seat}`, label: `治愈 ${target.name} 1 点恐惧` })
  41|           }
  42|           if (options.length === 1) break
  43|           const answer = options.length === 2 && options[0].id === 'skip' ? options[1].id : api.choice({
  44|             kind: 'effect', source: code, seat: inv.seat,
  45|             prompt: `「尘世宁静」：可花费 1 充能治愈同地点调查员 1 点伤害或恐惧（剩余可结算 ${successBy - point} 次）。`,
  46|             options,
  47|           })
  48|           if (!answer || answer === 'skip') break
  49|           const [kind, seatText] = String(answer).split(':')
  50|           const target = state.investigators[Number(seatText)]
  51|           if (!target) break
  52|           api.spendUses(source, 1)
  53|           if (kind === 'damage') api.healDamage(target.seat, 1)
  54|           else api.healHorror(target.seat, 1)
  55|           api.info(`🌿 「尘世宁静」：治愈 ${target.name} 1 点${kind === 'damage' ? '伤害' : '恐惧'}。`)
  56|         }
  57|       },
  58|     },
  59|   ],
  60|   modifiers: [],
  61| }
  62| 
```


## 08120 Prophetic / 先知先觉
type=asset klass=guardian subtype=- xp=3 cost=3 slot=- traits=Talent
entry: src/cards/entries/08120.js
```text
text: Uses (2 resources). Replenish these resources at the start of each round.
Resources on Prophetic may be spent to pay for [[Fortune]], [[Spell]], or [[Spirit]] cards.
[fast] During a skill test on a [[Fortune]], [[Spell]], or [[Spirit]] card, spend 1 resource from Prophetic: You get +1 skill value for this test.
```
```text
textZh: 使用(2资源)。每轮开始时重新补满资源。
先知先觉上的资源可以被花费来支付[[幸运]]、[[法术]]或[[勇气]]卡牌。
[free]在[[幸运]]、[[法术]]或[[勇气]]卡牌上的技能检定期间，从先知先觉花费1资源：你本次检定得到技能值+1。
```
```js
   1| // 08120 先知先觉（Prophetic，守卫者 3 级天赋）
   2| // 卡面：使用(2资源)。每轮开始时补满这些资源。
   3| //        先知先觉上的资源可以花费来支付 [[Fortune]]、[[Spell]] 或 [[Spirit]] 卡牌。
   4| //        [fast] 在一次 [[Fortune]]、[[Spell]] 或 [[Spirit]] 卡的技能检定期间：从先知先觉上花费 1 资源：
   5| //        你本次检定得到 +1 技能值。
   6| //
   7| // 一张卡一个文件：这张卡的行为只在这里维护。
   8| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   9| //
  10| // 读点：轮初补满 api.playerTools.replenishResources；[fast] +1 用 api.spendUses + api.addPendingTestBonus
  11| //       （与 07264 同模板）；「资源可支付指定特性卡」用 beforePlayCost 窗口减费近似。
  12| // approximation: 引擎费用管线没有「支援资源作为支付来源」的读点（费用枚举仍按资源池判定）。
  13| //   本卡在 beforePlayCost 窗口用「从本卡花费资源 → context.costReduction」近似：
  14| //   资源池本身足以支付时，可少用池内资源，等价于用本卡资源支付；池不足时仍无法打出。
  15| const code = '08120'
  16| const TRAITS = ['fortune', 'spell', 'spirit']
  17| 
  18| function onTraits(state, helpers, cardCode) {
  19|   const target = cardCode ?? state?.skillTest?.source?.code
  20|   if (!target || typeof helpers?.cardTraits !== 'function') return false
  21|   const traits = helpers.cardTraits(target).map(trait => String(trait).toLowerCase())
  22|   return TRAITS.some(trait => traits.includes(trait))
  23| }
  24| 
  25| export default {
  26|   code,
  27|   uses: 2,
  28|   usesType: 'resources',
  29|   note: 'approximation: 「本卡资源可支付指定特性卡」用 beforePlayCost 窗口减费近似（费用枚举仍要求资源池可支付）。',
  30|   abilities: [
  31|     {
  32|       kind: 'forced',
  33|       trigger: 'roundStarts',
  34|       label: '轮初补满至 2 资源',
  35|       resolve: ({ source, api }) => api.playerTools.replenishResources(source.id, 2),
  36|     },
  37|     {
  38|       kind: 'free',
  39|       label: '本卡上的资源：指定特性检定 +1 技能值',
  40|       cost: { action: false },
  41|       duringOwnSkillTest: true,
  42|       criteria: [({ state, source, helpers }) => (source?.uses || 0) > 0 && onTraits(state, helpers)],
  43|       resolve: ({ inv, source, api }) => {
  44|         api.spendUses(source, 1)
  45|         api.addPendingTestBonus(1)
  46|         api.info(`🎯 「先知先觉」：${inv.name} 花费 1 资源，本次检定 +1 技能值。`)
  47|       },
  48|     },
  49|     {
  50|       kind: 'reaction',
  51|       trigger: 'beforePlayCost',
  52|       label: '近似-支付：从本卡花费资源降低费用',
  53|       criteria: [({ state, inv, source, context, helpers }) => context?.seat === inv.seat
  54|         && (source?.uses || 0) > 0 && onTraits(state, helpers, context?.cardCode)
  55|         && (context?.costReduction || 0) < (context?.cost || 0)],
  56|       resolve: ({ inv, source, context, api }) => {
  57|         const maximum = Math.min(2, source?.uses || 0, Math.max(0, context?.cost || 0))
  58|         if (maximum < 1) return
  59|         const spend = maximum === 1 ? 1 : Number(api.choice({
  60|           kind: 'effect', source: code, seat: inv.seat,
  61|           prompt: `「先知先觉」：从本卡花费几点资源来支付此卡费用？（最多 ${maximum}）`,
  62|           options: Array.from({ length: maximum + 1 }, (_, index) => ({
  63|             id: String(index), label: index === 0 ? '不花费' : `花费 ${index} 资源`,
  64|           })),
  65|         }))
  66|         if (!spend) return
  67|         api.spendUses(source, spend)
  68|         context.costReduction = (context.costReduction || 0) + spend
  69|         api.info(`💰 「先知先觉」：从卡上花费 ${spend} 资源，降低此卡费用。`)
  70|       },
  71|     },
  72|   ],
  73|   modifiers: [],
  74| }
  75| 
```


## 08121 Sleuth / 一探究竟
type=asset klass=guardian subtype=- xp=3 cost=3 slot=- traits=Talent
entry: src/cards/entries/08121.js
```text
text: Uses (2 resources). Replenish these resources at the start of each round.
Resources on Sleuth may be spent to pay for [[Charm]], [[Tactic]], or [[Tome]] cards.
[fast] During a skill test on a [[Charm]], [[Tactic]], or [[Tome]] card, spend 1 resource from Sleuth: You get +1 skill value for this test.
```
```text
textZh: 使用(2资源)。每轮开始时重新补满资源。
一探究竟上的资源可以被花费来支付[[守护]]、[[策略]]或[[书籍]]卡牌。
[free]在[[守护]]、[[策略]]或[[书籍]]卡牌上的技能检定期间，从一探究竟花费1资源：你本次检定得到技能值+1。
```
```js
   1| // 08121 一探究竟（Sleuth，探求者 3 级天赋）
   2| // 卡面：使用(2资源)。每轮开始时补满这些资源。
   3| //        一探究竟上的资源可以花费来支付 [[Charm]]、[[Tactic]] 或 [[Tome]] 卡牌。
   4| //        [fast] 在一次 [[Charm]]、[[Tactic]] 或 [[Tome]] 卡的技能检定期间：从一探究竟上花费 1 资源：
   5| //        你本次检定得到 +1 技能值。
   6| //
   7| // 一张卡一个文件：这张卡的行为只在这里维护。
   8| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   9| //
  10| // 读点：轮初补满 api.playerTools.replenishResources；[fast] +1 用 api.spendUses + api.addPendingTestBonus；
  11| //       「资源可支付指定特性卡」用 beforePlayCost 窗口减费近似。
  12| // approximation: 引擎费用管线没有「支援资源作为支付来源」的读点；本卡用 beforePlayCost 减费近似
  13| //   （资源池本身足以支付时可少用池内资源；池不足时仍无法打出）。
  14| const code = '08121'
  15| const TRAITS = ['charm', 'tactic', 'tome']
  16| 
  17| function onTraits(state, helpers, cardCode) {
  18|   const target = cardCode ?? state?.skillTest?.source?.code
  19|   if (!target || typeof helpers?.cardTraits !== 'function') return false
  20|   const traits = helpers.cardTraits(target).map(trait => String(trait).toLowerCase())
  21|   return TRAITS.some(trait => traits.includes(trait))
  22| }
  23| 
  24| export default {
  25|   code,
  26|   uses: 2,
  27|   usesType: 'resources',
  28|   note: 'approximation: 「本卡资源可支付指定特性卡」用 beforePlayCost 窗口减费近似（费用枚举仍要求资源池可支付）。',
  29|   abilities: [
  30|     {
  31|       kind: 'forced',
  32|       trigger: 'roundStarts',
  33|       label: '轮初补满至 2 资源',
  34|       resolve: ({ source, api }) => api.playerTools.replenishResources(source.id, 2),
  35|     },
  36|     {
  37|       kind: 'free',
  38|       label: '本卡上的资源：指定特性检定 +1 技能值',
  39|       cost: { action: false },
  40|       duringOwnSkillTest: true,
  41|       criteria: [({ state, source, helpers }) => (source?.uses || 0) > 0 && onTraits(state, helpers)],
  42|       resolve: ({ inv, source, api }) => {
  43|         api.spendUses(source, 1)
  44|         api.addPendingTestBonus(1)
  45|         api.info(`🔍 「一探究竟」：${inv.name} 花费 1 资源，本次检定 +1 技能值。`)
  46|       },
  47|     },
  48|     {
  49|       kind: 'reaction',
  50|       trigger: 'beforePlayCost',
  51|       label: '近似-支付：从本卡花费资源降低费用',
  52|       criteria: [({ state, inv, source, context, helpers }) => context?.seat === inv.seat
  53|         && (source?.uses || 0) > 0 && onTraits(state, helpers, context?.cardCode)
  54|         && (context?.costReduction || 0) < (context?.cost || 0)],
  55|       resolve: ({ inv, source, context, api }) => {
  56|         const maximum = Math.min(2, source?.uses || 0, Math.max(0, context?.cost || 0))
  57|         if (maximum < 1) return
  58|         const spend = maximum === 1 ? 1 : Number(api.choice({
  59|           kind: 'effect', source: code, seat: inv.seat,
  60|           prompt: `「一探究竟」：从本卡花费几点资源来支付此卡费用？（最多 ${maximum}）`,
  61|           options: Array.from({ length: maximum + 1 }, (_, index) => ({
  62|             id: String(index), label: index === 0 ? '不花费' : `花费 ${index} 资源`,
  63|           })),
  64|         }))
  65|         if (!spend) return
  66|         api.spendUses(source, spend)
  67|         context.costReduction = (context.costReduction || 0) + spend
  68|         api.info(`💰 「一探究竟」：从卡上花费 ${spend} 资源，降低此卡费用。`)
  69|       },
  70|     },
  71|   ],
  72|   modifiers: [],
  73| }
  74| 
```


## 08122 Bruiser / 好勇斗狠
type=asset klass=guardian subtype=- xp=3 cost=3 slot=- traits=Talent
entry: src/cards/entries/08122.js
```text
text: Uses (2 resources). Replenish these resources at the start of each round.
Resources on Bruiser may be spent to pay for [[Armor]], [[Firearm]], or [[Melee]] cards.
[fast] During a skill test on a [[Armor]], [[Firearm]], or [[Melee]] card, spend 1 resource from Bruiser: You get +1 skill value for this test.
```
```text
textZh: 使用(2资源)。每轮开始时重新补满资源。
好勇斗狠上的资源可以被花费来支付[[护甲]]、[[枪械]]或[[近战]]卡牌。
[free]在[[护甲]]、[[枪械]]或[[近战]]卡牌上的技能检定期间，从好勇斗狠花费1资源：你本次检定得到技能值+1。
```
```js
   1| // 08122 好勇斗狠（Bruiser，潜行者 3 级天赋）
   2| // 卡面：使用(2资源)。每轮开始时补满这些资源。
   3| //        好勇斗狠上的资源可以花费来支付 [[Armor]]、[[Firearm]] 或 [[Melee]] 卡牌。
   4| //        [fast] 在一次 [[Armor]]、[[Firearm]] 或 [[Melee]] 卡的技能检定期间：从好勇斗狠上花费 1 资源：
   5| //        你本次检定得到 +1 技能值。
   6| //
   7| // 一张卡一个文件：这张卡的行为只在这里维护。
   8| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   9| //
  10| // 读点：轮初补满 api.playerTools.replenishResources；[fast] +1 用 api.spendUses + api.addPendingTestBonus；
  11| //       「资源可支付指定特性卡」用 beforePlayCost 窗口减费近似。
  12| // approximation: 引擎费用管线没有「支援资源作为支付来源」的读点；本卡用 beforePlayCost 减费近似
  13| //   （资源池本身足以支付时可少用池内资源；池不足时仍无法打出）。
  14| const code = '08122'
  15| const TRAITS = ['armor', 'firearm', 'melee']
  16| 
  17| function onTraits(state, helpers, cardCode) {
  18|   const target = cardCode ?? state?.skillTest?.source?.code
  19|   if (!target || typeof helpers?.cardTraits !== 'function') return false
  20|   const traits = helpers.cardTraits(target).map(trait => String(trait).toLowerCase())
  21|   return TRAITS.some(trait => traits.includes(trait))
  22| }
  23| 
  24| export default {
  25|   code,
  26|   uses: 2,
  27|   usesType: 'resources',
  28|   note: 'approximation: 「本卡资源可支付指定特性卡」用 beforePlayCost 窗口减费近似（费用枚举仍要求资源池可支付）。',
  29|   abilities: [
  30|     {
  31|       kind: 'forced',
  32|       trigger: 'roundStarts',
  33|       label: '轮初补满至 2 资源',
  34|       resolve: ({ source, api }) => api.playerTools.replenishResources(source.id, 2),
  35|     },
  36|     {
  37|       kind: 'free',
  38|       label: '本卡上的资源：指定特性检定 +1 技能值',
  39|       cost: { action: false },
  40|       duringOwnSkillTest: true,
  41|       criteria: [({ state, source, helpers }) => (source?.uses || 0) > 0 && onTraits(state, helpers)],
  42|       resolve: ({ inv, source, api }) => {
  43|         api.spendUses(source, 1)
  44|         api.addPendingTestBonus(1)
  45|         api.info(`🥊 「好勇斗狠」：${inv.name} 花费 1 资源，本次检定 +1 技能值。`)
  46|       },
  47|     },
  48|     {
  49|       kind: 'reaction',
  50|       trigger: 'beforePlayCost',
  51|       label: '近似-支付：从本卡花费资源降低费用',
  52|       criteria: [({ state, inv, source, context, helpers }) => context?.seat === inv.seat
  53|         && (source?.uses || 0) > 0 && onTraits(state, helpers, context?.cardCode)
  54|         && (context?.costReduction || 0) < (context?.cost || 0)],
  55|       resolve: ({ inv, source, context, api }) => {
  56|         const maximum = Math.min(2, source?.uses || 0, Math.max(0, context?.cost || 0))
  57|         if (maximum < 1) return
  58|         const spend = maximum === 1 ? 1 : Number(api.choice({
  59|           kind: 'effect', source: code, seat: inv.seat,
  60|           prompt: `「好勇斗狠」：从本卡花费几点资源来支付此卡费用？（最多 ${maximum}）`,
  61|           options: Array.from({ length: maximum + 1 }, (_, index) => ({
  62|             id: String(index), label: index === 0 ? '不花费' : `花费 ${index} 资源`,
  63|           })),
  64|         }))
  65|         if (!spend) return
  66|         api.spendUses(source, spend)
  67|         context.costReduction = (context.costReduction || 0) + spend
  68|         api.info(`💰 「好勇斗狠」：从卡上花费 ${spend} 资源，降低此卡费用。`)
  69|       },
  70|     },
  71|   ],
  72|   modifiers: [],
  73| }
  74| 
```


## 08123 Crafty / 技艺精湛
type=asset klass=seeker subtype=- xp=3 cost=3 slot=- traits=Talent
entry: src/cards/entries/08123.js
```text
text: Uses (2 resources). Replenish these resources at the start of each round.
Resources on Crafty may be spent to pay for [[Insight]], [[Tool]], or [[Trick]] cards.
[fast] During a skill test on a [[Insight]], [[Tool]], or [[Trick]] card, spend 1 resource from Crafty: You get +1 skill value for this test.
```
```text
textZh: 使用(2资源)。每轮开始时重新补满资源。
技艺精湛上的资源可以被花费来支付[[洞察]]、[[工具]]或[[技巧]]卡牌。
[free]在[[洞察]]、[[工具]]或[[技巧]]卡牌上的技能检定期间，从技艺精湛花费1资源：你本次检定得到技能值+1。
```
```js
   1| // 08123 技艺精湛（Crafty，生存者 3 级天赋）
   2| // 卡面：使用(2资源)。每轮开始时补满这些资源。
   3| //        技艺精湛上的资源可以花费来支付 [[Insight]]、[[Tool]] 或 [[Trick]] 卡牌。
   4| //        [fast] 在一次 [[Insight]]、[[Tool]] 或 [[Trick]] 卡的技能检定期间：从技艺精湛上花费 1 资源：
   5| //        你本次检定得到 +1 技能值。
   6| //
   7| // 一张卡一个文件：这张卡的行为只在这里维护。
   8| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   9| //
  10| // 读点：轮初补满 api.playerTools.replenishResources；[fast] +1 用 api.spendUses + api.addPendingTestBonus；
  11| //       「资源可支付指定特性卡」用 beforePlayCost 窗口减费近似。
  12| // approximation: 引擎费用管线没有「支援资源作为支付来源」的读点；本卡用 beforePlayCost 减费近似
  13| //   （资源池本身足以支付时可少用池内资源；池不足时仍无法打出）。
  14| const code = '08123'
  15| const TRAITS = ['insight', 'tool', 'trick']
  16| 
  17| function onTraits(state, helpers, cardCode) {
  18|   const target = cardCode ?? state?.skillTest?.source?.code
  19|   if (!target || typeof helpers?.cardTraits !== 'function') return false
  20|   const traits = helpers.cardTraits(target).map(trait => String(trait).toLowerCase())
  21|   return TRAITS.some(trait => traits.includes(trait))
  22| }
  23| 
  24| export default {
  25|   code,
  26|   uses: 2,
  27|   usesType: 'resources',
  28|   note: 'approximation: 「本卡资源可支付指定特性卡」用 beforePlayCost 窗口减费近似（费用枚举仍要求资源池可支付）。',
  29|   abilities: [
  30|     {
  31|       kind: 'forced',
  32|       trigger: 'roundStarts',
  33|       label: '轮初补满至 2 资源',
  34|       resolve: ({ source, api }) => api.playerTools.replenishResources(source.id, 2),
  35|     },
  36|     {
  37|       kind: 'free',
  38|       label: '本卡上的资源：指定特性检定 +1 技能值',
  39|       cost: { action: false },
  40|       duringOwnSkillTest: true,
  41|       criteria: [({ state, source, helpers }) => (source?.uses || 0) > 0 && onTraits(state, helpers)],
  42|       resolve: ({ inv, source, api }) => {
  43|         api.spendUses(source, 1)
  44|         api.addPendingTestBonus(1)
  45|         api.info(`🛠️ 「技艺精湛」：${inv.name} 花费 1 资源，本次检定 +1 技能值。`)
  46|       },
  47|     },
  48|     {
  49|       kind: 'reaction',
  50|       trigger: 'beforePlayCost',
  51|       label: '近似-支付：从本卡花费资源降低费用',
  52|       criteria: [({ state, inv, source, context, helpers }) => context?.seat === inv.seat
  53|         && (source?.uses || 0) > 0 && onTraits(state, helpers, context?.cardCode)
  54|         && (context?.costReduction || 0) < (context?.cost || 0)],
  55|       resolve: ({ inv, source, context, api }) => {
  56|         const maximum = Math.min(2, source?.uses || 0, Math.max(0, context?.cost || 0))
  57|         if (maximum < 1) return
  58|         const spend = maximum === 1 ? 1 : Number(api.choice({
  59|           kind: 'effect', source: code, seat: inv.seat,
  60|           prompt: `「技艺精湛」：从本卡花费几点资源来支付此卡费用？（最多 ${maximum}）`,
  61|           options: Array.from({ length: maximum + 1 }, (_, index) => ({
  62|             id: String(index), label: index === 0 ? '不花费' : `花费 ${index} 资源`,
  63|           })),
  64|         }))
  65|         if (!spend) return
  66|         api.spendUses(source, spend)
  67|         context.costReduction = (context.costReduction || 0) + spend
  68|         api.info(`💰 「技艺精湛」：从卡上花费 ${spend} 资源，降低此卡费用。`)
  69|       },
  70|     },
  71|   ],
  72|   modifiers: [],
  73| }
  74| 
```


## 08124 Antiquary / 古物藏家
type=asset klass=seeker subtype=- xp=3 cost=3 slot=- traits=Talent
entry: src/cards/entries/08124.js
```text
text: Uses (2 resources). Replenish these resources at the start of each round.
Resources on Antiquary may be spent to pay for [[Favor]], [[Relic]] or [[Ritual]] cards.
[fast] During a skill test on a [[Favor]], [[Relic]] or [[Ritual]] card, spend 1 resource from Antiquary: You get +1 skill value for this test.
```
```text
textZh: 使用(2资源)。每轮开始时重新补满资源。
古物藏家上的资源可以被花费来支付[[恩惠]]、[[遗物]]或[[仪式]]卡牌。
[free]在[[恩惠]]、[[遗物]]或[[仪式]]卡牌上的技能检定期间，从古物藏家花费1资源：你本次检定得到技能值+1。
```
```js
   1| // 08124 古物藏家（Antiquary，守卫者 3 级天赋）
   2| // 卡面：使用(2资源)。每轮开始时补满这些资源。
   3| //        古物藏家上的资源可以花费来支付 [[Favor]]、[[Relic]] 或 [[Ritual]] 卡牌。
   4| //        [fast] 在一次 [[Favor]]、[[Relic]] 或 [[Ritual]] 卡的技能检定期间：从古物藏家上花费 1 资源：
   5| //        你本次检定得到 +1 技能值。
   6| //
   7| // 一张卡一个文件：这张卡的行为只在这里维护。
   8| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   9| //
  10| // 读点：轮初补满 api.playerTools.replenishResources；[fast] +1 用 api.spendUses + api.addPendingTestBonus；
  11| //       「资源可支付指定特性卡」用 beforePlayCost 窗口减费近似。
  12| // approximation: 引擎费用管线没有「支援资源作为支付来源」的读点；本卡用 beforePlayCost 减费近似
  13| //   （资源池本身足以支付时可少用池内资源；池不足时仍无法打出）。
  14| const code = '08124'
  15| const TRAITS = ['favor', 'relic', 'ritual']
  16| 
  17| function onTraits(state, helpers, cardCode) {
  18|   const target = cardCode ?? state?.skillTest?.source?.code
  19|   if (!target || typeof helpers?.cardTraits !== 'function') return false
  20|   const traits = helpers.cardTraits(target).map(trait => String(trait).toLowerCase())
  21|   return TRAITS.some(trait => traits.includes(trait))
  22| }
  23| 
  24| export default {
  25|   code,
  26|   uses: 2,
  27|   usesType: 'resources',
  28|   note: 'approximation: 「本卡资源可支付指定特性卡」用 beforePlayCost 窗口减费近似（费用枚举仍要求资源池可支付）。',
  29|   abilities: [
  30|     {
  31|       kind: 'forced',
  32|       trigger: 'roundStarts',
  33|       label: '轮初补满至 2 资源',
  34|       resolve: ({ source, api }) => api.playerTools.replenishResources(source.id, 2),
  35|     },
  36|     {
  37|       kind: 'free',
  38|       label: '本卡上的资源：指定特性检定 +1 技能值',
  39|       cost: { action: false },
  40|       duringOwnSkillTest: true,
  41|       criteria: [({ state, source, helpers }) => (source?.uses || 0) > 0 && onTraits(state, helpers)],
  42|       resolve: ({ inv, source, api }) => {
  43|         api.spendUses(source, 1)
  44|         api.addPendingTestBonus(1)
  45|         api.info(`🏺 「古物藏家」：${inv.name} 花费 1 资源，本次检定 +1 技能值。`)
  46|       },
  47|     },
  48|     {
  49|       kind: 'reaction',
  50|       trigger: 'beforePlayCost',
  51|       label: '近似-支付：从本卡花费资源降低费用',
  52|       criteria: [({ state, inv, source, context, helpers }) => context?.seat === inv.seat
  53|         && (source?.uses || 0) > 0 && onTraits(state, helpers, context?.cardCode)
  54|         && (context?.costReduction || 0) < (context?.cost || 0)],
  55|       resolve: ({ inv, source, context, api }) => {
  56|         const maximum = Math.min(2, source?.uses || 0, Math.max(0, context?.cost || 0))
  57|         if (maximum < 1) return
  58|         const spend = maximum === 1 ? 1 : Number(api.choice({
  59|           kind: 'effect', source: code, seat: inv.seat,
  60|           prompt: `「古物藏家」：从本卡花费几点资源来支付此卡费用？（最多 ${maximum}）`,
  61|           options: Array.from({ length: maximum + 1 }, (_, index) => ({
  62|             id: String(index), label: index === 0 ? '不花费' : `花费 ${index} 资源`,
  63|           })),
  64|         }))
  65|         if (!spend) return
  66|         api.spendUses(source, spend)
  67|         context.costReduction = (context.costReduction || 0) + spend
  68|         api.info(`💰 「古物藏家」：从卡上花费 ${spend} 资源，降低此卡费用。`)
  69|       },
  70|     },
  71|   ],
  72|   modifiers: [],
  73| }
  74| 
```


## 08125 In the Thick of It / 危险处境
type=asset klass=neutral subtype=- xp=0 cost=undefined slot=- traits=Curse
entry: src/cards/entries/08125.js
```text
text: Permanent. Limit 1 per deck. Purchase at deck creation.
When you purchase In the Thick of It, suffer 2 total physical and/or mental trauma. Then, earn 3 experience.
```
```text
textZh: 永久。每套牌库仅限1张。当构建牌库时购买。
在你购买危险处境时，承受总共2点肉体和/或精神创伤。然后，取得3经验值。
```
```js
   1| // 08125 危险处境（In the Thick of It）
   2| // 卡面：永久。每套牌库仅限 1 张。当构建牌库时购买。
   3| //        当你购买危险处境时，承受总共 2 点肉体和/或精神创伤。然后，取得 3 经验。
   4| //
   5| // 一张卡一个文件：这张卡的行为只在这里维护。
   6| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   7| //
   8| // 读点：永久卡在 setup.js 的开局循环里入场并执行 kind:'setup' 描述子；创伤走 api.addTrauma、
   9| //       经验走 api.addScenarioXpBonus（结算到本场冒险）、一次性记录走 api.recordSets（战役记录集合）。
  10| // approximation: 构筑/购买层（选卡时结算创伤与经验）留 P7；本条目在每场冒险 setup 时一次性结算：
  11| //   承受 2 点创伤（可选分配）+ 3 点额外经验；用战役记录 inTheThickOfItPurchased 防跨场景重复。
  12| const code = '08125'
  13| 
  14| export default {
  15|   code,
  16|   note: 'approximation: 购买层（构筑时选卡）留 P7；开局 setup 一次性结算 2 点创伤 + 3 点额外经验，并用战役记录防重复。',
  17|   abilities: [
  18|     {
  19|       kind: 'setup',
  20|       label: '购买时：承受 2 点创伤并取得 3 经验（一次性）',
  21|       resolve: ({ inv, api }) => {
  22|         const claimed = api.recordSets.values('inTheThickOfItPurchased')
  23|         if (claimed.includes(inv.code)) return
  24|         const split = api.choice({
  25|           kind: 'effect', source: code, seat: inv.seat,
  26|           prompt: '「危险处境」：购买时分配 2 点创伤。',
  27|           options: [
  28|             { id: 'physical', label: '2 点肉体创伤' },
  29|             { id: 'mental', label: '2 点精神创伤' },
  30|             { id: 'split', label: '1 点肉体创伤 + 1 点精神创伤' },
  31|           ],
  32|         })
  33|         const physical = split === 'physical' ? 2 : split === 'split' ? 1 : 0
  34|         const mental = split === 'mental' ? 2 : split === 'split' ? 1 : 0
  35|         if (physical) api.addTrauma(inv.seat, 'physical', physical)
  36|         if (mental) api.addTrauma(inv.seat, 'mental', mental)
  37|         api.addScenarioXpBonus(inv.seat, 3)
  38|         api.recordSets.add('inTheThickOfItPurchased', inv.code)
  39|         api.info(`⚖️ 「危险处境」：${inv.name} 承受 ${physical} 点肉体创伤、${mental} 点精神创伤，并取得 3 经验。`)
  40|       },
  41|     },
  42|   ],
  43|   modifiers: [],
  44| }
  45| 
```


## 08126 Heavy Furs / 厚重皮衣
type=asset klass=neutral subtype=- xp=0 cost=2 slot=Body traits=Item,Armor
entry: src/cards/entries/08126.js
```text
text: [reaction] After you reveal a non-[auto_fail] symbol on a chaos token during a skill test you are perfoming, deal 1 damage to Heavy Furs: Cancel that chaos token and return it to the bag. Reveal a new chaos token.
```
```text
textZh: [reaction]在你执行的一次技能检定中你揭示一个非[auto_fail]的符号混乱标记后，对厚重皮衣造成1伤害：取消该混乱标记并将其返回混乱袋。揭示一个新的混乱标记。
```
```js
   1| // 08126 厚重皮衣（Heavy Furs）
   2| // 卡面：[reaction] 在你执行的一次技能检定中你揭示一个非[auto_fail]的符号混乱标记后，
   3| //        对厚重皮衣造成 1 伤害：取消该混乱标记并将其返回混乱袋。揭示一个新的混乱标记。
   4| //
   5| // 一张卡一个文件：这张卡的行为只在这里维护。
   6| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   7| //
   8| // 读点：
   9| //   · 揭示时机用既有窗口 `tokenEffectWouldResolve`（07307 幸运骰同一时机）；
  10| //   · 取消并重抽走 api.playerTools.rerollToken（引擎揭示循环会归还旧标记并揭示新标记）；
  11| //   · 对支援自身造成伤害走 api.placeAssetHarm（含被击败判定）。
  12| const code = '08126'
  13| // 印刷「符号标记」= 除数字与 [auto_fail] 之外的标记；旧印同属符号。
  14| const SYMBOL_TOKENS = ['skull', 'cultist', 'tablet', 'elderthing', 'eldersign']
  15| 
  16| export default {
  17|   code,
  18|   abilities: [
  19|     {
  20|       kind: 'reaction',
  21|       trigger: 'tokenEffectWouldResolve',
  22|       label: '揭示非自动失败符号时：对厚重皮衣造成 1 伤害，取消并重抽',
  23|       criteria: [({ inv, source, context }) => context?.seat === inv.seat
  24|         && SYMBOL_TOKENS.includes(context?.token)
  25|         && !context.rerollToken
  26|         // 厚重皮衣印刷生命 2：已满伤害后不能再发动（避免弃置前重复触发）。
  27|         && (source?.damage || 0) < 2],
  28|       resolve: ({ source, context, api }) => {
  29|         api.placeAssetHarm(source, { damage: 1 })
  30|         api.playerTools.rerollToken(context, source.id)
  31|         api.info('🧥 「厚重皮衣」：受到 1 点伤害，取消该混乱标记并重新揭示。')
  32|       },
  33|     },
  34|   ],
  35|   modifiers: [],
  36| }
  37| 
```


## 08127 Sled Dog / 雪橇犬
type=asset klass=neutral subtype=- xp=0 cost=3 slot=Ally traits=Ally,Creature
entry: src/cards/entries/08127.js
```text
text: You may include up to 4 copies of Sled Dog in your deck. Up to 2 Sled Dog cards take up a single ally slot.
[action] Exhaust X Sled Dogs: Move. Move X times.
[action] Exhaust X Sled Dogs: Fight. You get +X [combat] for this attack. Instead of its standard damage, this attack deals X damage.
```
```text
textZh: 你的牌库中可以有至多4张雪橇犬。1个盟友槽位可以有至多2张雪橇犬。
[action]横置X张雪橇犬：移动。移动X次。
[action]横置X张雪橇犬：攻击。你本次攻击得到+X[combat]。本次攻击不造成基础伤害，改为造成X点伤害。
```
```js
   1| // 08127 雪橇犬（Sled Dog）
   2| // 卡面：你的牌库中可以有至多 4 张雪橇犬。1 个盟友槽位可以有至多 2 张雪橇犬。
   3| // [action] 横置 X 张雪橇犬：移动。移动 X 次。
   4| // [action] 横置 X 张雪橇犬：攻击。你本次攻击得到 +X[combat]。本次攻击不造成基础伤害，改为造成 X 点伤害。
   5| //
   6| // 一张卡一个文件：这张卡的行为只在这里维护。
   7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   8| //
   9| // 读点：
  10| //   · 「2 张共占 1 个盟友槽」= 引擎既有 sharedSlotGroup（06241–06243 同一原语）；
  11| //   · 横置任意数量同名狗：api.exhaust；移动走 api.moveInvestigator；攻击走 api.fight（combatBonus/damageBonus）。
  12| const code = '08127'
  13| 
  14| function readySledDogs(inv) {
  15|   return (inv.assets || []).filter(item => item.code === code && !item.exhausted)
  16| }
  17| 
  18| // 横置 X 张雪橇犬（消耗来源自身 + 其它已就绪的同名狗；同名卡无差别，交给引擎记账）。
  19| function exhaustDogs(inv, source, count, api) {
  20|   const dogs = [source, ...readySledDogs(inv).filter(item => item !== source)].slice(0, Math.max(1, count))
  21|   for (const dog of dogs) api.exhaust(dog)
  22|   return dogs.length
  23| }
  24| 
  25| // X 只能取 1..已就绪数量；只有 1 张时不再询问。
  26| function chooseDogCount(inv, api) {
  27|   const ready = readySledDogs(inv).length
  28|   if (ready <= 1) return Math.max(0, Math.min(1, ready))
  29|   const answer = Number(api.choice({
  30|     kind: 'amount', source: code, seat: inv.seat,
  31|     prompt: `雪橇犬：横置几张（1–${ready}）？`,
  32|     options: Array.from({ length: ready }, (_, index) => ({
  33|       id: String(index + 1), label: `横置 ${index + 1} 张雪橇犬`,
  34|     })),
  35|   }))
  36|   return Math.max(1, Math.min(ready, Number.isSafeInteger(answer) ? answer : 1))
  37| }
  38| 
  39| export default {
  40|   code,
  41|   sharedSlotGroup: { id: 'sledDog', slot: 'ally', upTo: 2 },
  42|   abilities: [
  43|     {
  44|       kind: 'action',
  45|       label: '横置 X 张雪橇犬：移动 X 次',
  46|       countsAs: 'move',
  47|       cost: { action: true },
  48|       criteria: [({ inv, source }) => !source?.exhausted && readySledDogs(inv).length > 0],
  49|       resolve: ({ state, inv, source, api }) => {
  50|         const count = chooseDogCount(inv, api)
  51|         if (!count) return
  52|         exhaustDogs(inv, source, count, api)
  53|         for (let step = 0; step < count; step++) {
  54|           const here = state.locations.find(location => location.id === inv.location)
  55|           const destinations = (here?.connections || [])
  56|             .map(id => state.locations.find(location => location.id === id))
  57|             .filter(Boolean)
  58|           if (!destinations.length) break
  59|           const destination = destinations.length === 1 ? destinations[0].id : api.choice({
  60|             kind: 'move', source: code, seat: inv.seat,
  61|             prompt: `雪橇犬：第 ${step + 1} 次移动，选择目的地。`,
  62|             options: destinations.map(location => ({ id: location.id, label: location.name || location.id })),
  63|           })
  64|           if (!destination) break
  65|           api.moveInvestigator(inv.seat, destination)
  66|         }
  67|         api.info(`🛷 「雪橇犬」：${inv.name} 横置 ${count} 张雪橇犬并移动了 ${count} 次。`)
  68|       },
  69|     },
  70|     {
  71|       kind: 'action',
  72|       label: '横置 X 张雪橇犬：攻击，+X 战斗并造成 X 点伤害',
  73|       countsAs: 'fight',
  74|       cost: { action: true },
  75|       criteria: [({ inv, source }) => !source?.exhausted && readySledDogs(inv).length > 0],
  76|       target: { kind: 'enemy' },
  77|       resolve: ({ inv, source, target, api }) => {
  78|         const enemy = target?.entity
  79|         if (!enemy) return
  80|         const count = chooseDogCount(inv, api)
  81|         if (!count) return
  82|         exhaustDogs(inv, source, count, api)
  83|         api.fight(inv.seat, enemy.id, {
  84|           combatBonus: count,
  85|           damageBonus: count - 1,
  86|           sourceCode: code,
  87|           noSpend: true,
  88|         })
  89|       },
  90|     },
  91|   ],
  92|   modifiers: [],
  93| }
  94| 
```


## 08128 Rod of Animalism / 驯兽之杖
type=asset klass=neutral subtype=- xp=1 cost=2 slot=Accessory traits=Item,Relic
entry: src/cards/entries/08128.js
```text
text: You have 2 additional ally slots, which can only be used to hold [[Creature]] assets.
[reaction] When you play a [[Creature]] asset during your turn: Reduce that asset's cost by 1.
```
```text
textZh: 你拥有额外2个盟友槽位，只可以用来携带[[生物]]支援。
[reaction]你在自己回合期间打出[[生物]]支援时：该支援的费用减1。
```
```js
   1| // 08128 驯兽之杖（Rod of Animalism）
   2| // 卡面：你拥有额外 2 个盟友槽位，只可以用来携带[[生物]]支援。
   3| // [reaction] 你在自己回合期间打出[[生物]]支援时：该支援的费用减 1。
   4| //
   5| // 一张卡一个文件：这张卡的行为只在这里维护。
   6| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   7| //
   8| // 读点：
   9| //   · 受限额外槽 = 引擎既有 restrictedSlots（01008 书位 / 02147 武器位同一原语），
  10| //     只给带 [[Creature]] 特性的候选；
  11| //   · 费用 -1 = modifiers 的 playCost 目标（唯一读点 modifiers.js#playCostDelta），
  12| //     只对「生物」支援、且只在该卡控制者自己的回合生效（卡面「你在自己回合期间打出」）。
  13| import { ALL_CARDS } from '../../cards/cards-data.js'
  14| 
  15| const code = '08128'
  16| 
  17| function isCreatureAsset(cardCode) {
  18|   const def = ALL_CARDS[cardCode]
  19|   return Boolean(def) && def.type === 'asset'
  20|     && (def.traits || []).some(trait => String(trait).toLowerCase() === 'creature')
  21| }
  22| 
  23| export default {
  24|   code,
  25|   restrictedSlots: [
  26|     { slot: 'ally', traitsAny: ['Creature'], count: 2 },
  27|   ],
  28|   modifiers: [
  29|     {
  30|       target: 'playCost',
  31|       amount: ({ state, inv, cardCode }) => (state?.currentSeat === inv?.seat && isCreatureAsset(cardCode) ? -1 : 0),
  32|     },
  33|   ],
  34|   abilities: [],
  35| }
  36| 
```


## 08129 Call for Backup / 请求支援
type=event klass=neutral subtype=- xp=2 cost=1 slot=- traits=Favor,Synergy
entry: src/cards/entries/08129.js
```text
text: One at a time, in any order, if you control a...
- [rogue] card, you may move to a connecting location.
- [guardian] card, deal 1 damage to an enemy at your location.
- [seeker] card, discover 1 clue at your location.
- [mystic] card, heal 1 horror from any card.
- [survivor] card, heal 1 damage from any card.
```
```text
textZh: 以任意顺序依次结算，如果你控制……
- [rogue]卡牌，你可以移动到一个连接地点。
- [guardian]卡牌，对你所在地点的一个敌人造成1点伤害。
- [seeker]卡牌，发现你所在地点的1个线索。
- [mystic]卡牌，治愈任意卡牌的1点恐惧。
- [survivor]卡牌，治愈任意卡牌的1点伤害。
```
```js
   1| // 08129 请求支援（Call for Backup）
   2| // 卡面：以任意顺序依次结算，如果你控制……
   3| // - [rogue] 卡牌，你可以移动到一个连接地点。
   4| // - [guardian] 卡牌，对你所在地点的一个敌人造成 1 点伤害。
   5| // - [seeker] 卡牌，发现你所在地点的 1 个线索。
   6| // - [mystic] 卡牌，治愈任意卡牌的 1 点恐惧。
   7| // - [survivor] 卡牌，治愈任意卡牌的 1 点伤害。
   8| //
   9| // 一张卡一个文件：这张卡的行为只在这里维护。
  10| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
  11| //
  12| // 读点：
  13| //   · 职阶判定用 api.cardFactions（在场支援卡面数据；不按卡号分支）；
  14| //   · 位移 api.moveInvestigator、伤害 api.damageEnemy、线索 api.discoverClue、
  15| //     治疗 api.healDamage / api.healHorror / api.healAsset（支援恐惧走统一入口）。
  16| const code = '08129'
  17| const BULLETS = [
  18|   { id: 'rogue', faction: 'rogue', label: '[rogue] 卡牌：移动到一个连接地点' },
  19|   { id: 'guardian', faction: 'guardian', label: '[guardian] 卡牌：对所在地点一个敌人造成 1 点伤害' },
  20|   { id: 'seeker', faction: 'seeker', label: '[seeker] 卡牌：发现所在地点的 1 个线索' },
  21|   { id: 'mystic', faction: 'mystic', label: '[mystic] 卡牌：治愈任意卡牌的 1 点恐惧' },
  22|   { id: 'survivor', faction: 'survivor', label: '[survivor] 卡牌：治愈任意卡牌的 1 点伤害' },
  23| ]
  24| 
  25| function healTargets(state, inv, kind) {
  26|   const field = kind === 'damage' ? 'damage' : 'horror'
  27|   const targets = []
  28|   for (const owner of state.investigators) {
  29|     if (owner.defeated || owner.resigned) continue
  30|     if ((owner[field] || 0) > 0) {
  31|       targets.push({ id: `investigator:${owner.seat}`, label: `${owner.name}（调查员）`, owner, asset: null })
  32|     }
  33|     for (const assetCard of owner.assets || []) {
  34|       if ((assetCard[field] || 0) > 0) {
  35|         targets.push({ id: `asset:${assetCard.id}`, label: `${assetCard.name || assetCard.code}（支援）`, owner, asset: assetCard })
  36|       }
  37|     }
  38|   }
  39|   return targets
  40| }
  41| 
  42| export default {
  43|   code,
  44|   abilities: [
  45|     {
  46|       kind: 'played',
  47|       label: '按任意顺序结算你控制职阶对应的援助效果',
  48|       resolve: ({ state, inv, api }) => {
  49|         const controlled = new Set((inv.assets || []).flatMap(card => api.cardFactions(card.code)))
  50|         const remaining = BULLETS.filter(bullet => controlled.has(bullet.faction))
  51|         if (!remaining.length) {
  52|           api.info('「请求支援」：你没有控制任何对应职阶的卡牌，无事发生。')
  53|           return
  54|         }
  55|         while (remaining.length) {
  56|           const answer = api.choice({
  57|             kind: 'effect', source: code, seat: inv.seat,
  58|             prompt: '「请求支援」：按任意顺序结算一项（或结束）。',
  59|             options: [{ id: 'done', label: '结束结算' },
  60|               ...remaining.map(bullet => ({ id: bullet.id, label: bullet.label }))],
  61|           })
  62|           if (!answer || answer === 'done') break
  63|           const index = remaining.findIndex(bullet => bullet.id === answer)
  64|           if (index < 0) break
  65|           const [bullet] = remaining.splice(index, 1)
  66|           if (bullet.id === 'rogue') {
  67|             const here = state.locations.find(location => location.id === inv.location)
  68|             const destinations = (here?.connections || [])
  69|               .map(id => state.locations.find(location => location.id === id))
  70|               .filter(Boolean)
  71|             if (!destinations.length) continue
  72|             const destination = destinations.length === 1 ? destinations[0].id : api.choice({
  73|               kind: 'move', source: code, seat: inv.seat,
  74|               prompt: '「请求支援」：选择连接地点。',
  75|               options: destinations.map(location => ({ id: location.id, label: location.name || location.id })),
  76|             })
  77|             if (destination) api.moveInvestigator(inv.seat, destination)
  78|           } else if (bullet.id === 'guardian') {
  79|             const enemies = state.enemies.filter(enemy => !enemy.defeated && enemy.location === inv.location)
  80|             if (!enemies.length) continue
  81|             const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
  82|               kind: 'target', source: code, seat: inv.seat,
  83|               prompt: '「请求支援」：选择要造成 1 点伤害的敌人。',
  84|               options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
  85|             })
  86|             const enemy = enemies.find(item => item.id === enemyId)
  87|             if (enemy) api.damageEnemy(enemy, 1, inv.seat, { code })
  88|           } else if (bullet.id === 'seeker') {
  89|             const location = state.locations.find(item => item.id === inv.location)
  90|             if ((location?.clues || 0) > 0) api.discoverClue(inv.seat, 1)
  91|           } else {
  92|             const kind = bullet.id === 'mystic' ? 'horror' : 'damage'
  93|             const targets = healTargets(state, inv, kind)
  94|             if (!targets.length) continue
  95|             const chosen = targets.length === 1 ? targets[0].id : api.choice({
  96|               kind: 'target', source: code, seat: inv.seat,
  97|               prompt: `「请求支援」：选择要治愈 1 点${kind === 'horror' ? '恐惧' : '伤害'}的卡牌。`,
  98|               options: targets.map(target => ({ id: target.id, label: target.label })),
  99|             })
 100|             const target = targets.find(item => item.id === chosen)
 101|             if (!target) continue
 102|             if (target.asset) api.healAsset(target.asset, { [kind]: 1, owner: target.owner })
 103|             else if (kind === 'horror') api.healHorror(target.owner.seat, 1)
 104|             else api.healDamage(target.owner.seat, 1)
 105|           }
 106|         }
 107|       },
 108|     },
 109|   ],
 110|   modifiers: [],
 111| }
 112| 
```


## 08130 Arm Injury / 臂伤
type=treachery klass=neutral subtype=basicweakness xp=undefined cost=undefined slot=- traits=Injury
entry: src/cards/entries/08130.js
```text
text: Revelation - Put Arm Injury into play in your threat area.
Arm Injury can be healed as if it were a single point of damage on you (if it is healed, discard it).
Forced - After you take a fight or activate action: You cannot take any of those types of actions for the remainder of the turn.
```
```text
textZh: 显现 - 将臂伤放置入场，放到你的威胁区域。
臂伤可被治愈，如同是你身上的1点伤害(如果它被治愈，将其弃掉)。
强制 - 在你执行攻击或启动行动后：本回合剩余时间内，你不能再进行任何这些类型的行动。
```
```js
   1| // 08130 臂伤（Arm Injury）
   2| // 卡面：显现 - 将臂伤放置入场，放到你的威胁区域。
   3| //        臂伤可被治愈，如同是你身上的 1 点伤害（如果它被治愈，将其弃掉）。
   4| //        强制 - 在你执行攻击或启动行动后：本回合剩余时间内，你不能再进行任何这些类型的行动。
   5| //
   6| // 一张卡一个文件：这张卡的行为只在这里维护。
   7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   8| //
   9| // 读点：弱点模板 kind:'weakness'（type:'threat' + clues:1 作为「1 点伤害」计数器）、
  10| //       actionResolvedAtLocation 窗口、api.addEffect（capability:fight / capability:triggerAbilities，
  11| //       duration:'endOfTurn'，由引擎回合末统一过期）。
  12| // approximation:
  13| //   ① 「如同 1 点伤害被治愈」：引擎没有 threatDamageSink（只有 threatHorrorSink），用 free + discardSelf
  14| //     近似「本卡可被治愈移除」（不消耗实际治疗量）。
  15| //   ② 「执行攻击或启动行动后」：actionResolvedAtLocation 窗口不带行动类型，近似为任意行动后立即锁住
  16| //     印刷的两类行动，直到回合结束（略偏严）。
  17| const code = '08130'
  18| 
  19| export default {
  20|   code,
  21|   note: 'approximation: 伤害侧治愈用「弃掉自身」近似（无 threatDamageSink）；动作后锁近似为任意行动后锁住印刷行动类型至回合结束。',
  22|   abilities: [
  23|     {
  24|       kind: 'weakness',
  25|       label: '显现：放入威胁区域（1 点「伤害」计数器）',
  26|       weakness: { type: 'threat', clues: 1 },
  27|     },
  28|     {
  29|       kind: 'free',
  30|       label: '近似-可治愈：弃掉臂伤（视为其 1 点伤害被治愈）',
  31|       cost: { action: false, discardSelf: true },
  32|     },
  33|     {
  34|       kind: 'forced',
  35|       trigger: 'actionResolvedAtLocation',
  36|       label: '执行行动后：本回合不能攻击或启动能力',
  37|       criteria: [({ state, inv }) => !(state.effects || []).some(effect => effect.sourceCode === code
  38|         && effect.duration === 'endOfTurn' && effect.controllerSeat === inv.seat)],
  39|       resolve: ({ inv, api }) => {
  40|         api.addEffect({
  41|           sourceCode: code,
  42|           controllerSeat: inv.seat,
  43|           duration: 'endOfTurn',
  44|           label: '臂伤：本回合不能攻击或启动能力',
  45|           modifiers: [{ target: 'capability:fight' }, { target: 'capability:triggerAbilities' }],
  46|         })
  47|         api.info(`🩹 「臂伤」：${inv.name} 本回合不能再攻击或启动能力。`)
  48|       },
  49|     },
  50|   ],
  51|   modifiers: [],
  52| }
  53| 
```


## 08131 Leg Injury / 腿伤
type=treachery klass=neutral subtype=basicweakness xp=undefined cost=undefined slot=- traits=Injury
entry: src/cards/entries/08131.js
```text
text: Revelation - Put Leg Injury into play in your threat area.
Leg Injury can be healed as if it were a single point of damage on you (if it is healed, discard it).
Forced - After you take a move, resign, or evade action: You cannot take any of those types of actions for the remainder of the turn.
```
```text
textZh: 显现 - 将腿伤放置入场，放到你的威胁区域。
腿伤可被治愈，如同是你身上的1点伤害(如果它被治愈，将其弃掉)。
强制 - 在你执行移动、撤退或躲避行动后：本回合剩余时间内，你不能再进行任何这些类型的行动。
```
```js
   1| // 08131 腿伤（Leg Injury）
   2| // 卡面：显现 - 将腿伤放置入场，放到你的威胁区域。
   3| //        腿伤可被治愈，如同是你身上的 1 点伤害（如果它被治愈，将其弃掉）。
   4| //        强制 - 在你执行移动、撤退或躲避行动后：本回合剩余时间内，你不能再进行任何这些类型的行动。
   5| //
   6| // 一张卡一个文件：这张卡的行为只在这里维护。
   7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   8| //
   9| // 读点：弱点模板 kind:'weakness'（type:'threat' + clues:1）、actionResolvedAtLocation 窗口、
  10| //       api.addEffect（capability:move / resign / evade，duration:'endOfTurn'）。
  11| // approximation:
  12| //   ① 「如同 1 点伤害被治愈」：无 threatDamageSink，用 free + discardSelf 近似。
  13| //   ② 「执行移动/撤退/躲避行动后」：窗口不带行动类型，近似为任意行动后锁住印刷三类行动至回合结束。
  14| const code = '08131'
  15| 
  16| export default {
  17|   code,
  18|   note: 'approximation: 伤害侧治愈用「弃掉自身」近似（无 threatDamageSink）；动作后锁近似为任意行动后锁住印刷行动类型至回合结束。',
  19|   abilities: [
  20|     {
  21|       kind: 'weakness',
  22|       label: '显现：放入威胁区域（1 点「伤害」计数器）',
  23|       weakness: { type: 'threat', clues: 1 },
  24|     },
  25|     {
  26|       kind: 'free',
  27|       label: '近似-可治愈：弃掉腿伤（视为其 1 点伤害被治愈）',
  28|       cost: { action: false, discardSelf: true },
  29|     },
  30|     {
  31|       kind: 'forced',
  32|       trigger: 'actionResolvedAtLocation',
  33|       label: '执行行动后：本回合不能移动、撤退或躲避',
  34|       criteria: [({ state, inv }) => !(state.effects || []).some(effect => effect.sourceCode === code
  35|         && effect.duration === 'endOfTurn' && effect.controllerSeat === inv.seat)],
  36|       resolve: ({ inv, api }) => {
  37|         api.addEffect({
  38|           sourceCode: code,
  39|           controllerSeat: inv.seat,
  40|           duration: 'endOfTurn',
  41|           label: '腿伤：本回合不能移动、撤退或躲避',
  42|           modifiers: [
  43|             { target: 'capability:move' },
  44|             { target: 'capability:resign' },
  45|             { target: 'capability:evade' },
  46|           ],
  47|         })
  48|         api.info(`🩹 「腿伤」：${inv.name} 本回合不能再移动、撤退或躲避。`)
  49|       },
  50|     },
  51|   ],
  52|   modifiers: [],
  53| }
  54| 
```


## 08132 Panic / 惊慌
type=treachery klass=neutral subtype=basicweakness xp=undefined cost=undefined slot=- traits=Madness
entry: src/cards/entries/08132.js
```text
text: Revelation - Put Panic into play in your threat area.
Panic can be healed as if it were a single point of horror on you (if it is healed, discard it).
Forced - After you take a play, engage, or resource action: You cannot take any of those types of actions for the remainder of the turn.
```
```text
textZh: 显现 - 将惊慌放置入场，放到你的威胁区域。
惊慌可被治愈，如同是你身上的1点恐惧(如果它被治愈，将其弃掉)。
强制 - 在你执行打出、资源或交战行动后：本回合剩余时间内，你不能再进行任何这些类型的行动。
```
```js
   1| // 08132 惊慌（Panic）
   2| // 卡面：显现 - 将惊慌放置入场，放到你的威胁区域。
   3| //        惊慌可被治愈，如同是你身上的 1 点恐惧（如果它被治愈，将其弃掉）。
   4| //        强制 - 在你执行打出、资源或交战行动后：本回合剩余时间内，你不能再进行任何这些类型的行动。
   5| //
   6| // 一张卡一个文件：这张卡的行为只在这里维护。
   7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   8| //
   9| // 读点：弱点模板 kind:'weakness'（type:'threat' + horror:1）；「可如同 1 点恐惧被治愈」复用引擎
  10| //       threatHorrorSink + redirectHeal（05008「理性思考」同一原语：治疗自己恐惧时可改为治愈本卡，
  11| //       治满后移除并弃掉）；actionResolvedAtLocation 窗口 + api.addEffect
  12| //       （capability:play / engage / gainResources，duration:'endOfTurn'）。
  13| // approximation: 「资源行动」用 capability:gainResources 近似（会同时禁止卡牌效果获得资源，略偏严）；
  14| //       动作后锁近似为任意行动后锁住印刷类型至回合结束。
  15| const code = '08132'
  16| 
  17| export default {
  18|   code,
  19|   threatHorrorSink: true,
  20|   redirectHeal: { optional: true },
  21|   note: 'approximation: 资源行动用 capability:gainResources 近似；动作后锁近似为任意行动后锁住印刷行动类型至回合结束。',
  22|   abilities: [
  23|     {
  24|       kind: 'weakness',
  25|       label: '显现：放入威胁区域（1 点「恐惧」计数器）',
  26|       weakness: { type: 'threat', horror: 1 },
  27|     },
  28|     {
  29|       kind: 'forced',
  30|       trigger: 'actionResolvedAtLocation',
  31|       label: '执行行动后：本回合不能打出、获得资源或交战',
  32|       criteria: [({ state, inv }) => !(state.effects || []).some(effect => effect.sourceCode === code
  33|         && effect.duration === 'endOfTurn' && effect.controllerSeat === inv.seat)],
  34|       resolve: ({ inv, api }) => {
  35|         api.addEffect({
  36|           sourceCode: code,
  37|           controllerSeat: inv.seat,
  38|           duration: 'endOfTurn',
  39|           label: '惊慌：本回合不能打出、获得资源或交战',
  40|           modifiers: [
  41|             { target: 'capability:play' },
  42|             { target: 'capability:gainResources' },
  43|             { target: 'capability:engage' },
  44|           ],
  45|         })
  46|         api.info(`😱 「惊慌」：${inv.name} 本回合不能再打出、获得资源或交战。`)
  47|       },
  48|     },
  49|   ],
  50|   modifiers: [],
  51| }
  52| 
```


## 08133 Stupor / 麻木
type=treachery klass=neutral subtype=basicweakness xp=undefined cost=undefined slot=- traits=Madness
entry: src/cards/entries/08133.js
```text
text: Revelation - Put Stupor into play in your threat area.
Stupor can be healed as if it were a single point of horror on you (if it is healed, discard it).
Forced - After you take a parley, draw, or investigate action: You cannot take any of those types of actions for the remainder of the turn.
```
```text
textZh: 显现 - 将麻木放置入场，放到你的威胁区域。
麻木可被治愈，如同是你身上的1点恐惧(如果它被治愈，将其弃掉)。
强制 - 在你执行谈判、抽取或调查行动后：本回合剩余时间内，你不能再进行任何这些类型的行动。
```
```js
   1| // 08133 麻木（Stupor）
   2| // 卡面：显现 - 将麻木放置入场，放到你的威胁区域。
   3| //        麻木可被治愈，如同是你身上的 1 点恐惧（如果它被治愈，将其弃掉）。
   4| //        强制 - 在你执行谈判、抽取或调查行动后：本回合剩余时间内，你不能再进行任何这些类型的行动。
   5| //
   6| // 一张卡一个文件：这张卡的行为只在这里维护。
   7| // 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
   8| //
   9| // 读点：弱点模板 kind:'weakness'（type:'threat' + horror:1）；「可如同 1 点恐惧被治愈」复用引擎
  10| //       threatHorrorSink + redirectHeal；actionResolvedAtLocation 窗口 + api.addEffect
  11| //       （capability:parley / draw / investigate，duration:'endOfTurn'）。
  12| // approximation: 动作后锁近似为任意行动后锁住印刷三类行动至回合结束。
  13| const code = '08133'
  14| 
  15| export default {
  16|   code,
  17|   threatHorrorSink: true,
  18|   redirectHeal: { optional: true },
  19|   note: 'approximation: 动作后锁近似为任意行动后锁住印刷行动类型至回合结束。',
  20|   abilities: [
  21|     {
  22|       kind: 'weakness',
  23|       label: '显现：放入威胁区域（1 点「恐惧」计数器）',
  24|       weakness: { type: 'threat', horror: 1 },
  25|     },
  26|     {
  27|       kind: 'forced',
  28|       trigger: 'actionResolvedAtLocation',
  29|       label: '执行行动后：本回合不能谈判、抽取或调查',
  30|       criteria: [({ state, inv }) => !(state.effects || []).some(effect => effect.sourceCode === code
  31|         && effect.duration === 'endOfTurn' && effect.controllerSeat === inv.seat)],
  32|       resolve: ({ inv, api }) => {
  33|         api.addEffect({
  34|           sourceCode: code,
  35|           controllerSeat: inv.seat,
  36|           duration: 'endOfTurn',
  37|           label: '麻木：本回合不能谈判、抽取或调查',
  38|           modifiers: [
  39|             { target: 'capability:parley' },
  40|             { target: 'capability:draw' },
  41|             { target: 'capability:investigate' },
  42|           ],
  43|         })
  44|         api.info(`😵 「麻木」：${inv.name} 本回合不能再谈判、抽取或调查。`)
  45|       },
  46|     },
  47|   ],
  48|   modifiers: [],
  49| }
  50| 
```
