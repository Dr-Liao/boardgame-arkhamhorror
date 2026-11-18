// 10098 卡纳玛戈斯之杖（Rod of Carnamagos · 疯先知的权杖）· 潜修者支援 · 2 资源 · 2 经验 · 手部
//   [[道具]]/[[遗物]]/[[秘教]]/[[诅咒萦绕]]
// 卡面：
//   [fast] 选择任意地点的一个非[[精英]]敌人并横置卡纳玛戈斯之杖：从混乱袋中随机揭示 5 个混乱标记。
//   每揭示 1 个[curse]标记，你可以查找你的绑定卡牌，找出一张[[腐烂]]事件，并将其附属到该敌人。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 与 10085（等级 0 的同名杖）的关系：两张杖共用同一份绑定[[腐烂]]集合（bonded.js#bondedPoolMain 把
// bondedCards 相同的卡归到同一个场外集合），因此[[腐烂]]的被动/强制效果必须两张杖都实现——10085
// 已经写了一版（treacheryRule.rotRule 读点 + zoneReplacement 回场外），本条目按同一套数据约定复刻，
// 差别只有「每揭示 1 个诅咒都可以查找 1 张」＝逐次由玩家选择（印刷非随机）。
//
// 读点（卡面 → 引擎）：
//   · 「快速」＝ kind:'free' + cost:{ action:false, exhaust:true }（legalMoves 的免费能力读点）。
//   · 「任意地点的一个非精英敌人」：target 只枚举同地点敌人，候选在 resolve 里用 api.choice 列出。
//   · 「随机揭示 5 个混乱标记」：非检定揭示不消耗 bless/curse（那是 chaos-bag#endChaosTest 的检定专用
//     规则），因此按 10085 的同口径逐个随机取出再放回（api.random + api.removeChaosToken/addChaosToken）。
//   · 「查找绑定卡牌中的[[腐烂]]事件」：api.bonded.group('10098') 的副本表 + api.cardTraits 过滤 Rot，
//     并排除已经附在敌人身上的副本；取出副本走 api.bonded.shuffleCopyIntoDeck（把该副本从场外集合
//     挪进牌库）→ api.moveCard({ from:'deck', to:'attached', attachTo })。
//   · 「附属到该敌人」：api.moveCard 的 attached 通道 / 兜底 api.attachPlayerCardToAsset
//     （actions-extra.js#attachCardTo 的唯一写点，写 enemy.attachments）。
//   · [[腐烂]]的被动/强制（数据在各自条目的 treacheryRule.rotRule，读点只在本文件的四个 forced/free 上）：
//       - 10086 深渊腐烂 enemyCannotAttack → forced trigger 'enemyAttack' 取消攻击（context.cancelled）；
//       - 10087 琥珀腐烂 gainResourcesOnDefeatMax → forced 'defeatEnemy' 获得资源；
//       - 10088 流脓腐烂 enemyStatModifiers → 附属时 api.addEnemyStatModifier；
//       - 10089 猩红腐烂 roundEndDamage → forced 'roundEnds' 对所附属敌人造成伤害；
//       - 所有腐烂「离场时放到一边」→ 条目声明 zoneReplacement.discard='bonded'，'defeatEnemy' 窗口
//         用 api.putIntoDiscard 走 player-zones.js 的区域替换（直接回到场外绑定集合）。
//
// 近似披露（simplified）：[[腐烂]]的三个被动力与 10089 的轮末伤害挂在「杖」上而不是腐烂卡上
// （玩家卡附在敌人身上不是窗口来源，见 primitive-requests/10089.json / 10090.json / 10098.json）；
// 杖离场后这些效果失效（印刷上腐烂仍留在敌人身上）；「放到一边」只覆盖被击败这一条离场路径；
// 从场外集合取副本会洗一次牌库（api.bonded.shuffleCopyIntoDeck 的既有代价）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10098'
const REVEAL_COUNT = 5
const ROT_TRAIT = 'rot'

// 五个 Rot 事件的条目规则是同分片文件的固定数据；卡文件不 import 引擎装配点。
const ROT_RULES = Object.freeze({
  '10086': Object.freeze({ rot: 'abyssal' }),
  '10087': Object.freeze({ rot: 'amber' }),
  '10088': Object.freeze({ rot: 'putrescent' }),
  '10089': Object.freeze({ rot: 'scarlet', roundEndDamage: 1 }),
  '10090': Object.freeze({ rot: 'virescent' }),
})
const rotRuleOf = code => ROT_RULES[code] || null
const cardNameOf = code => ALL_CARDS[code]?.name || code
const rotCodesOf = enemy => (enemy?.attachments || []).map(card => String(card.originalCode || card.code))
const attachedAnywhere = state => new Set((state.enemies || [])
  .flatMap(enemy => (enemy.attachments || []).map(card => String(card.originalCode || card.code))))

// 「查找你的绑定卡牌，找出一张[[腐烂]]事件」：卡面数据的 bondedCards 是唯一事实源，
// 已附属在敌人身上的副本不再是可查找的场外卡。
const rotPool = (state, api) => {
  const group = api.bonded.group(CODE)
  const copies = [...new Set((group?.copies || []).map(item => (typeof item === 'string' ? item : item?.code)))]
    .filter(Boolean)
  const used = attachedAnywhere(state)
  return copies.filter(code => !used.has(code) && api.cardTraits(code).includes(ROT_TRAIT))
}

// 非检定揭示：逐个随机取出再放回（不消耗 curse/bless，与 10085 同口径）。
function revealRandomTokens(state, api, count) {
  const revealed = []
  for (let index = 0; index < count && (state.chaosBag || []).length; index++) {
    const bag = state.chaosBag
    const token = bag[Math.floor(api.random() * bag.length)]
    if (token == null) break
    api.removeChaosToken(token)
    revealed.push(token)
  }
  for (const token of revealed) api.addChaosToken(token)
  return revealed
}

// 把场外绑定集合里的一张副本取出来附属到敌人（集合账目与附属共用同一份副本身份）。
function attachRotCopy(state, inv, enemy, code, api) {
  if (api.bonded.shuffleCopyIntoDeck(inv.seat, CODE, code)) {
    const moved = api.moveCard({ code, from: 'deck', to: 'attached', attachTo: enemy.id, ownerSeat: inv.seat })
    if (moved) return (enemy.attachments || []).find(card => card.code === code) || null
  }
  return api.attachPlayerCardToAsset(code, enemy, { ownerSeat: inv.seat })
}

const nonEliteEnemies = state => (state.enemies || []).filter(enemy => !enemy.elite && !enemy.defeated
  && !enemy.removedFromGame && !enemy.global)

export default {
  code: CODE,
  name: '卡纳玛戈斯之杖',
  simplified: true,
  note: 'simplified: [[腐烂]]的被动/强制效果挂在「杖」条目上（玩家卡附敌不是窗口来源，见 '
    + 'primitive-requests/10089.json / 10090.json / 10098.json）；杖离场后这些效果失效；'
    + '「离场放到一边」只覆盖被击败路径；从场外绑定集合取副本会洗一次牌库。',
  abilities: [
    {
      kind: 'free',
      cost: { action: false, exhaust: true },
      label: '快速：选择任意地点的非精英敌人并横置；揭示 5 个混乱标记，每个诅咒可附属 1 张[[腐烂]]',
      criteria: [({ state }) => nonEliteEnemies(state).length > 0],
      resolve: ({ state, inv, api }) => {
        const enemies = nonEliteEnemies(state)
        if (!enemies.length) {
          api.info('「卡纳玛戈斯之杖」：场上没有非[[精英]]敌人。')
          return
        }
        const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「卡纳玛戈斯之杖」：选择任意地点的一个非[[精英]]敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: `${enemy.name}（${api.locName(enemy.location)}）` })),
        })
        const enemy = enemies.find(item => item.id === enemyId) || enemies[0]
        if (!enemy) return
        const revealed = revealRandomTokens(state, api, REVEAL_COUNT)
        const curses = revealed.filter(token => token === 'curse').length
        api.info(`🦴 「卡纳玛戈斯之杖」：揭示 ${revealed.map(token => api.tokenLabel(token)).join('、') || '（空袋）'}——${curses} 个[诅咒]标记。`)
        if (!curses) return
        let left = curses
        while (left > 0) {
          const pool = rotPool(state, api)
          if (!pool.length) {
            api.info('🦴 「卡纳玛戈斯之杖」：没有可查找的[[腐烂]]事件（全部已附属）。')
            break
          }
          const pick = api.choice({
            kind: 'target', source: CODE, seat: inv.seat,
            prompt: `🦴 「卡纳玛戈斯之杖」：第 ${curses - left + 1} 个[诅咒]标记——查找一张[[腐烂]]事件附属到「${enemy.name}」？`,
            options: [
              ...pool.map(code => ({ id: code, label: `查找「${cardNameOf(code)}」并附属`, cardCode: code })),
              { id: 'done', label: '不再附属' },
            ],
          })
          if (pick === 'done' || !pool.includes(pick)) break
          const attachment = attachRotCopy(state, inv, enemy, pick, api)
          if (!attachment) {
            api.info(`🦴 「卡纳玛戈斯之杖」：无法把「${cardNameOf(pick)}」附属到「${enemy.name}」。`)
            break
          }
          // 10088 流脓腐烂：附属敌人 -1 战斗 / -1 躲避（运行期数值修正，无 until = 持续）。
          const statMods = rotRuleOf(pick)?.enemyStatModifiers
          if (statMods) api.addEnemyStatModifier(enemy, statMods)
          api.info(`🦴 「卡纳玛戈斯之杖」：找出「${cardNameOf(pick)}」并附属到「${enemy.name}」。`)
          left -= 1
        }
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
      label: '腐烂：所附属敌人被击败时按其印刷生命值获得资源（最多 5）；腐烂离场时放到一边',
      criteria: [({ context }) => rotCodesOf(context?.enemy).length > 0],
      resolve: ({ inv, context, api }) => {
        const enemy = context?.enemy
        if (!enemy) return
        for (const code of rotCodesOf(enemy)) {
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
          // 「强制 - 在所附属敌人离场时：放到一边，位于场外」：条目声明 zoneReplacement.discard='bonded'，
          // 弃置通道（player-zones.js#replacePlayerZoneCards）把这张牌直接收回场外绑定集合。
          if (['10086', '10087', '10088', '10089', '10090'].includes(code)) {
            const ownerSeat = (enemy.attachments || []).find(card => card.code === code)?.ownerSeat
            api.putIntoDiscard(Number.isInteger(ownerSeat) ? ownerSeat : inv.seat, code)
          }
        }
      },
    },
    {
      kind: 'forced',
      trigger: 'roundEnds',
      label: '猩红腐烂：每轮结束时对所附属敌人造成 1 点伤害',
      criteria: [({ state }) => (state.enemies || []).some(enemy => rotCodesOf(enemy)
        .some(code => (Number(rotRuleOf(code)?.roundEndDamage) || 0) > 0))],
      resolve: ({ state, api }) => {
        for (const enemy of [...state.enemies]) {
          for (const card of [...(enemy.attachments || [])]) {
            const damage = Number(rotRuleOf(card.originalCode || card.code)?.roundEndDamage) || 0
            if (damage <= 0 || !state.enemies.includes(enemy)) continue
            api.damageEnemy(enemy, damage, Number.isInteger(card.ownerSeat) ? card.ownerSeat : 0, card.code)
            api.info(`🩸 「${cardNameOf(card.code)}」：轮末对「${enemy.name}」造成 ${damage} 点伤害。`)
          }
        }
      },
    },
  ],
  modifiers: [],
}
