// 10010 哄骗（Beguile）· 中立（Neutral）事件 · 2 资源 · 技巧 · 亚历山德拉·佐兹牌库专用
//
// 卡面：
//   亚历山德拉·佐兹牌库专用。快速。只能在你回合期间打出。
//   将哄骗附属到你所在地点的非[[精英]]敌人。
//   [action]：谈判。将所附属的敌人移动到一个已揭示的连接地点，或在其地点执行一次基础调查或躲避行动。
//   如果你结算本能力时技能检定失败，弃掉哄骗。你可以从任意地点激活本能力。
//
// 一条行为的读点（卡面 → 引擎）：
//   · 快速 / 只能在你回合期间打出 → played 描述子的 `fast: true` + 条目 playCondition[自回合]；
//     打出候选与校验共用 moves.js / play-condition.js（fast 的 0 行动由 cardPlayFlag 读点给）。
//   · 附属到同地点非精英敌人 → api.attachPlayerCardToAsset（attachCardTo 的唯一写点，
//     写 enemy.attachments；与 09027/09025 同一形状）+ keepOnPlay（事件不按普通结算进弃牌堆）。
//   · 「[action] 谈判 … 你可以从任意地点激活」→ `treacheryRule.attachmentAbilities`
//     （parley.js#entityActionDescriptors 是「附属卡自身行动」的唯一读点，07099/07299 同款；
//     parleyMovesFor 的 enemy attachments 分支把它枚举进合法行动，entityId = 附属实例）。
//     `range: 'anywhere'` 由 parley.js#entityAbilityInRange 直接放行 → 与「任意地点」同义。
//     谈判不引发借机攻击由 dispatch.js 的 isParleyDescriptor 读点统一给。
//   · 移动附属敌人 → api.moveEnemy（movement.js#relocateEnemy 唯一写点；会解除与远处调查员的交战）。
//   · 「在其地点执行一次基础调查/躲避行动」→ api.investigate({ locationId }) / api.evade(...)
//     （actions.js#doInvestigate / combat.js#doEvade，与基础行动同一份规则与日志；basicAction 标记
//     让「基础行动」相关读点（如 06204/06246）与本卡一致）。
//   · 「技能检定失败则弃掉哄骗」→ 上面两次 api 调用的返回值是 performTest 的标准结果
//     （`summary.success`）；失败时用 api.scenario.detachEnemyAttachment（敌附属的移除写点）
//     + api.putIntoDiscard（玩家弃牌堆写点）把这张牌放进其所有者弃牌堆。
//     （只覆盖本能力自己发起的那次基础行动检定；本能力结算期间由其它窗口额外发起的检定
//       不在这份返回值里——缺「结算本能力期间的失败」窗口，属于引擎缺口。）
//
// 缺口（已列给主进程）：
//   1. 玩家卡附属在敌人身上时**不是能力窗口来源**（ability-rules.js#nonPlayerAbilitySources 只收
//      非玩家 scope 条目），因此「附属敌人离场时弃掉哄骗」没有读点：敌人被击败/离场后这张牌会
//      随宿主一起消失，不会进入所有者弃牌堆。需要在引擎把 `enemy.attachments` 里的玩家卡纳入
//      离场清理（或给 `discardHostedAssets` 增加非 hostedPlayerAsset 分支）。
//   2. 基础躲避行动（doEvade）保留「目标必须与你交战 / 与你同地点的庞大敌人 / 连接地点
//      （allowConnecting）」的门槛：从更远的地点激活时只能选「移动」或「调查」两种模式。
//      印刷的「在其地点执行基础躲避」缺少 `doEvade` 的远程目标读点。
import { ownTurn } from '../../engine/matcher.js'

const CODE = '10010'

// 附属卡现在挂在哪个敌人身上（只读）。
const hostOf = (state, source) => (state.enemies || [])
  .find(enemy => (enemy.attachments || []).includes(source)) || null

const ownerSeatOf = (attachment, inv) =>
  Number.isInteger(attachment?.ownerSeat) ? attachment.ownerSeat : inv.seat

// 已揭示的连接地点（移动模式的合法目标）。
const revealedConnections = (state, locationId) => {
  const here = (state.locations || []).find(location => location.id === locationId)
  return [...new Set(here?.connections || [])]
    .filter(id => (state.locations || []).find(location => location.id === id)?.revealed === true)
}

// 与 combat.js#doEvade 的同一门槛：同地点交战 / 同地点的庞大敌人 / 连接地点上的敌人。
// 这里只用于「哪些模式出现在选项里」，真正的规则仍由 api.evade 结算。
const canBasicEvade = (state, inv, enemy) => enemy.engagedSeat === inv.seat
  || (enemy.massive && enemy.location === inv.location)
  || (state.locations || []).find(location => location.id === inv.location)?.connections?.includes(enemy.location) === true

// performTest 的标准结果（同步结算时就有 summary；没有检定 / 被拦下时为 undefined）。
const testFailed = result => result?.summary?.success === false

// 技能检定失败：把附属卡从敌人身上摘除并放进其所有者弃牌堆（两个写点都是引擎原语）。
const discardBeguile = (api, enemy, attachment, seat) => {
  api.scenario.detachEnemyAttachment(enemy.id, attachment.id)
  api.putIntoDiscard(seat, CODE)
  api.info('🃏 「哄骗」：结算本能力时技能检定失败，弃掉这张卡。')
}

export default {
  code: CODE,
  keepOnPlay: true,
  playCondition: [
    // 只能在你回合期间打出（matcher.ownTurn）。
    ownTurn(),
    { when: ({ state, inv }) => (state?.enemies || []).some(enemy => enemy.location === inv?.location && !enemy.elite),
      message: '你所在地点没有非精英敌人' },
  ],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '快速：附属到你所在地点的一个非精英敌人',
      resolve: ({ state, inv, api }) => {
        const enemies = api.enemiesAt(inv.location).filter(enemy => !enemy.elite && !enemy.defeated)
        if (!enemies.length) {
          api.info('「哄骗」：你所在地点没有非精英敌人。')
          return
        }
        const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「哄骗」：选择要附属的非精英敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = (state.enemies || []).find(item => item.id === enemyId) || enemies[0]
        const attachment = api.attachPlayerCardToAsset(CODE, enemy, { ownerSeat: inv.seat })
        if (!attachment) {
          api.info('「哄骗」：无法附属到这个敌人。')
          return
        }
        api.info(`🃏 「哄骗」附属到「${enemy.name}」：你可以从任意地点以 [action] 谈判激活本卡的三个模式。`)
      },
    },
  ],
  treacheryRule: {
    // 附属在敌人身上的「自身 [action]」：读点 parley.js#entityActionDescriptors（见文件头）。
    attachmentAbilities: [{
      kind: 'action',
      actionKind: 'parley',
      range: 'anywhere',
      cost: { action: 1 },
      label: '谈判：移动所附属的敌人，或在其地点执行一次基础调查/躲避行动',
      // 只有附属者本人可以激活（印刷「该行动属于打出这张卡的调查员」）。
      criteria: [({ inv, source }) => !Number.isInteger(source?.ownerSeat) || source.ownerSeat === inv.seat],
      resolve: ({ state, inv, source, api }) => {
        const enemy = hostOf(state, source)
        if (!enemy) {
          api.info('「哄骗」：这张卡已不在敌人身上。')
          return
        }
        const seat = ownerSeatOf(source, inv)
        const destinations = revealedConnections(state, enemy.location)
        const where = api.scenario.locationName(enemy.location)
        const options = []
        if (destinations.length) options.push({ id: 'move', label: `将「${enemy.name}」移动到一个已揭示的连接地点` })
        options.push({ id: 'investigate', label: `在「${where}」执行一次基础调查行动` })
        if (canBasicEvade(state, inv, enemy)) options.push({ id: 'evade', label: `对「${enemy.name}」执行一次基础躲避行动` })
        const mode = options.length === 1 ? options[0].id : api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: `「哄骗」：选择要执行的行动（${api.cardName(enemy.code)}在「${where}」）。`,
          options,
        })
        if (mode === 'move') {
          const destination = destinations.length === 1 ? destinations[0] : api.choice({
            kind: 'location', source: CODE, seat: inv.seat,
            prompt: `「哄骗」：选择「${enemy.name}」移动到的已揭示连接地点。`,
            options: destinations.map(id => ({ id, label: api.scenario.locationName(id) })),
          })
          if (!destinations.includes(destination)) return
          const outcome = api.moveEnemy(enemy, destination)
          api.info(outcome?.moved === false
            ? `🚶 「哄骗」：「${enemy.name}」无法移动到「${api.scenario.locationName(destination)}」。`
            : `🚶 「哄骗」：将「${enemy.name}」移动到「${api.scenario.locationName(destination)}」。`)
          return
        }
        if (mode === 'evade') {
          const result = api.evade(inv.seat, { enemyId: enemy.id, allowConnecting: true, basicAction: 'evade' })
          if (testFailed(result)) discardBeguile(api, enemy, source, seat)
          return
        }
        const result = api.investigate(inv.seat, { locationId: enemy.location, basicAction: 'investigate' })
        if (testFailed(result)) discardBeguile(api, enemy, source, seat)
      },
    }],
  },
  modifiers: [],
}
