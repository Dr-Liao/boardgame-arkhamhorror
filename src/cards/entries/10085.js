// 10085 卡纳玛戈斯之杖（Rod of Carnamagos · 疯先知的权杖）· 秘术（Mystic）资产 · 2 资源 · 手部槽位
//   [[道具]]/[[遗物]]/[[秘教]]/[[诅咒萦绕]] · 每套牌库仅限 1 张
//
// 卡面：
//   每套牌库仅限 1 张。
//   [fast] 选择任意地点的一个非 [[精英]] 敌人并横置卡纳玛戈斯之杖：从混乱袋中随机揭示 5 个混乱标记。
//   如果揭示了 [curse] 标记，查找你的绑定卡牌，随机找出一张 [[腐烂]] 事件，并将其附属到该敌人。
//
// 一条行为的读点（卡面 → 引擎）：
//   · 「每套牌库仅限 1 张」：cards-data 的 deckLimit 由构筑层判定，条目不需要行为代码。
//   · 「[fast] … 横置」：kind:'free' + cost:{ exhaust: true }（free 描述子的旧式能力入口
//     abilityShim 会把行动费置 0，legalMoves 里是一颗 [fast] 按钮）。
//   · 「任意地点的一个非[[精英]]敌人」：state.enemies 全表筛选（与 04204 等「任意地点敌人」同读法），
//     选中后由玩家选择（api.choice）。
//   · 「随机揭示 5 个混乱标记」：按状态里的 state.chaosBag 逐个随机取（api.removeChaosToken 取出、
//     揭示后 api.addChaosToken 放回）——非检定的揭示**不消耗** [curse] 标记（检定管线的
//     chaos-bag#endChaosTest 会把揭示的 bless/curse 从袋中移除，那是技能检定专用规则），
//     随机来源是引擎注入的 api.random（与 05155/05156 同一处可重放随机）。
//   · 「查找你的绑定卡牌，随机找出一张[[腐烂]]事件并附属」：绑定组来自 api.bonded.group（bonded.js
//     的卡面数据读点），随机取一张尚未附属在别的敌人身上的 [[腐烂]]；「附属到该敌人」走
//     api.attachPlayerCardToAsset（attachCardTo 的唯一写点，写 enemy.attachments，与 09025/09027/10010 同源）。
//     若场外绑定集合已存在（state.bondedSets），先用 api.bonded.shuffleCopyIntoDeck 把该副本从集合里
//     取出再 api.moveCard 附属，保持集合账目一致（取牌会洗一次牌库，属于近似代价，见 note）。
//
// 三张 [[腐烂]] 事件的被动力（引擎没有「玩家卡附在敌人身上」的窗口读点，见 note 与
// primitive-requests/10086.json / 10087.json / 10088.json）：
//   · 10086 深渊腐烂「所附属的敌人不能攻击」→ 本条目 forced + trigger 'enemyAttack'：在窗口里把
//     context.cancelled 置真（enemies.js#enemyAttack 的攻击取消读点；与 05230 在窗口里改 context
//     同一写法）。与引擎 enemyCannotAttack 同口径：卡牌效果造成的攻击（attackKind 'effect'）不受此限制。
//   · 10087 琥珀腐烂「附属敌人被击败时获得等于其印刷生命值的资源（最多 5）」→ 本条目 forced +
//     trigger 'defeatEnemy'，取 min(5, context.enemy.health)（enemy.health 是印刷值）。
//   · 10088 流脓腐烂「附属敌人 -1 战斗 / -1 躲避」→ 本条目在附属时用 api.addEnemyStatModifier
//     写入（无 until = 持续；读点 enemies.js#runtimeEnemyStat，与 09025/05157 同源）。
//   · 三张的「在所附属敌人离场时放到一边（场外）」→ 本条目在 'defeatEnemy' 窗口对附属的 [[腐烂]]
//     调 api.putIntoDiscard；[[腐烂]] 条目声明 `zoneReplacement: { discard: 'bonded' }`，
//     player-zones.js#replacePlayerZoneCards 是「声明 discard→bonded 的牌不进弃牌堆、直接回到场外
//     绑定集合」的唯一读点。
//   三条被动力按 [[腐烂]] 卡号在本条目的 ROT_RULES 表里声明：条目文件之间不互相 import，
//   也不 import engine/ability.js（entries/index.js 由 card-abilities.js 聚合，entry → ability.js
//   的 import 会形成 card-abilities → index → entry → ability → … → card-rules 的循环）。
//
// 显式简化（见 note）：
//   1. 被动力挂在「杖」上而不是 [[腐烂]] 卡上：玩家卡附在敌人身上不是窗口来源
//      （ability-rules.js#nonPlayerAbilitySources 只收非玩家 scope 条目），见 primitive requests。
//      因此杖离场后这些被动力失效（印刷上 [[腐烂]] 仍留在敌人身上）。
//   2. 「所附属敌人不能攻击」只覆盖杖的控制者被攻击的窗口（enemyAttack 窗口按被攻击调查员枚举来源）。
//   3. 「离场时放到一边」只在「被击败」这一条离场路径上结算（其它离场路径没有玩家卡窗口）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10085'
const REVEAL_COUNT = 5
const ROT_TRAIT = 'Rot'

// [[腐烂]] 的五张副本（卡面 bondedCards）：被动力按卡号在此声明，与 10086–10090 的卡面一一对应。
const ROT_RULES = Object.freeze({
  '10086': Object.freeze({ name: 'Abyssal Rot', enemyCannotAttack: true }),
  '10087': Object.freeze({ name: 'Aember Rot', gainResourcesOnDefeatMax: 5 }),
  '10088': Object.freeze({ name: 'Putrescent Rot', enemyStatModifiers: Object.freeze({ fight: -1, evade: -1 }) }),
  '10089': Object.freeze({ name: 'Scarlet Rot' }),
  '10090': Object.freeze({ name: 'Virescent Rot' }),
})
const rotRuleOf = code => ROT_RULES[code] || null
const rotCodes = Object.freeze(Object.keys(ROT_RULES))
const cardNameOf = code => ALL_CARDS[code]?.name || code
const traitsOf = code => ALL_CARDS[code]?.traits || []

const rotCodesOf = enemy => (enemy?.attachments || []).map(card => card.code)
const attachedAnywhere = state => new Set((state.enemies || [])
  .flatMap(enemy => (enemy.attachments || []).map(card => card.code)))

// 「查找你的绑定卡牌，随机找出一张[[腐烂]]事件」：卡面数据里的 bondedCards 是唯一事实源，
// 已经附属在敌人身上的副本不再是可查找的场外卡。
const rotPool = (state, api) => {
  const group = api.bonded.group(CODE)
  const copies = [...new Set((group?.copies || []).map(item => item.code))]
  const used = attachedAnywhere(state)
  return copies.filter(code => !used.has(code)
    && traitsOf(code).some(trait => String(trait).toLowerCase() === ROT_TRAIT.toLowerCase()))
}

const bondedSetKeys = state => Object.keys(state.bondedSets || {})
  .filter(key => key === CODE || key.startsWith(`${CODE}@`))

// 把一张场外副本从绑定集合取出，再附属到敌人（集合账目与附属共用同一份实例身份）。
const attachRotCopy = (state, inv, enemy, code, api) => {
  const set = bondedSetKeys(state).map(key => state.bondedSets[key])
    .find(entry => (entry?.cards || []).includes(code))
  if (set) {
    if (api.bonded.shuffleCopyIntoDeck(inv.seat, CODE, code)) {
      const moved = api.moveCard({ code, from: 'deck', to: 'attached', attachTo: enemy.id, ownerSeat: inv.seat })
      if (moved) {
        return (enemy.attachments || []).find(card => card.code === code) || null
      }
    }
  }
  return api.attachPlayerCardToAsset(code, enemy, { ownerSeat: inv.seat })
}

// 「随机揭示 5 个混乱标记」：非检定揭示，取出后原样放回（不消耗 bless/curse）。
const revealRandomTokens = (state, api, count) => {
  const revealed = []
  for (let i = 0; i < count && (state.chaosBag || []).length; i++) {
    const bag = state.chaosBag
    const token = bag[Math.floor(api.random() * bag.length)]
    if (token == null) break
    api.removeChaosToken(token)
    revealed.push(token)
  }
  for (const token of revealed) api.addChaosToken(token)
  return revealed
}

export default {
  code: CODE,
  name: 'Rod of Carnamagos',
  simplified: true,
  note: 'simplified: [[腐烂]]的三条被动力挂在「杖」条目的 ROT_RULES 上（玩家卡附敌不是窗口来源；entry 不 import ability.js 以避开聚合循环）；「不能攻击」只覆盖杖控制者被攻击的窗口；「离场放一边」只结算被击败路径；绑定集合已存在时取副本会洗一次牌库。见 primitive-requests/10086.json / 10087.json / 10088.json',
  abilities: [
    {
      kind: 'free',
      label: '[fast] 选择任意地点一个非精英敌人并横置：揭示 5 个混乱标记，有[诅咒]则附属一张[[腐烂]]',
      cost: { exhaust: true },
      resolve: ({ state, inv, api }) => {
        const enemies = (state.enemies || []).filter(enemy => !enemy.elite && !enemy.defeated
          && !enemy.removedFromGame && !enemy.global)
        if (!enemies.length) {
          api.info('「卡纳玛戈斯之杖」：场上没有非[[精英]]敌人。')
          return
        }
        const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「卡纳玛戈斯之杖」：选择任意地点的一个非[[精英]]敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: `${enemy.name}（${api.scenario.locationName(enemy.location)}）` })),
        })
        const enemy = enemies.find(item => item.id === enemyId) || enemies[0]
        const revealed = revealRandomTokens(state, api, REVEAL_COUNT)
        api.info(`🦴 「卡纳玛戈斯之杖」：揭示 ${revealed.map(token => api.tokenLabel(token)).join('、')}。`)
        if (!revealed.includes('curse')) {
          api.info('🦴 「卡纳玛戈斯之杖」：没有揭示[诅咒]标记，不查找[[腐烂]]。')
          return
        }
        const pool = rotPool(state, api)
        if (!pool.length) {
          api.info('🦴 「卡纳玛戈斯之杖」：没有可查找的[[腐烂]]事件（全部已附属）。')
          return
        }
        const picked = pool[Math.floor(api.random() * pool.length)]
        const attachment = attachRotCopy(state, inv, enemy, picked, api)
        if (!attachment) {
          api.info(`🦴 「卡纳玛戈斯之杖」：无法把「${cardNameOf(picked)}」附属到「${enemy.name}」。`)
          return
        }
        const statModifiers = rotRuleOf(picked)?.enemyStatModifiers
        if (statModifiers) api.addEnemyStatModifier(enemy, statModifiers)
        api.info(`🦴 「卡纳玛戈斯之杖」：随机找出「${cardNameOf(picked)}」并附属到「${enemy.name}」。`)
      },
    },
    {
      kind: 'forced',
      trigger: 'enemyAttack',
      label: '深渊腐烂：所附属的敌人不能攻击',
      criteria: [({ context }) => context?.attackKind !== 'effect'
        && rotCodesOf(context?.enemy).some(code => rotRuleOf(code)?.enemyCannotAttack === true)],
      resolve: ({ context, api }) => {
        context.cancelled = true
        api.info(`⛔ 「${context?.enemy?.name || '所附属的敌人'}」被「深渊腐烂」缠身，不能攻击，本次攻击被取消。`)
      },
    },
    {
      kind: 'forced',
      trigger: 'defeatEnemy',
      label: '琥珀腐烂：附属敌人被击败时按其印刷生命值获得资源（最多 5）；腐烂离场时放到一边',
      criteria: [({ context }) => rotCodesOf(context?.enemy).some(code => rotCodes.includes(code))],
      resolve: ({ inv, context, api }) => {
        const enemy = context?.enemy
        if (!enemy) return
        for (const code of rotCodesOf(enemy)) {
          if (!rotCodes.includes(code)) continue
          const rule = rotRuleOf(code)
          const max = Number(rule?.gainResourcesOnDefeatMax) || 0
          if (max > 0) {
            const printed = Number(enemy.health)
            const gain = Math.min(max, Number.isFinite(printed) ? Math.max(0, printed) : 0)
            if (gain > 0) {
              api.gainResources(inv.seat, gain)
              api.info(`🦴 「${cardNameOf(code)}」：「${enemy.name}」被击败，获得 ${gain} 资源。`)
            }
          }
          // 「强制 - 在所附属敌人离场时：放到一边，位于场外」：[[腐烂]] 条目声明
          // zoneReplacement.discard='bonded'，弃置通道（player-zones.js#replacePlayerZoneCards）
          // 会把这张牌直接收回场外绑定集合，不进弃牌堆。
          const ownerSeat = (enemy.attachments || []).find(card => card.code === code)?.ownerSeat
          api.putIntoDiscard(Number.isInteger(ownerSeat) ? ownerSeat : inv.seat, code)
        }
      },
    },
  ],
  modifiers: [],
}
