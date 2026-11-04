// 07299 石障（Stone Barrier）· 诡计 · 达贡密教巢穴 第七章
//
// 印刷（中文）：
//   显现 - 附属到最近且没有附属石障的地点。如果附属地点已淹没，石障获得涌动。
//   石障为重整状态时，调查员不能移动离开附属地点。
//   [action]：检定[agility](1)、[combat](2)，或[intellect](3)。如果你检定成功，横置石障。
//
// 印刷（English）：
//   Revelation - Attach to the nearest location without a Stone Barrier attached. If attached
//   location is flooded, Stone Barrier gains surge.
//   While Stone Barrier is ready, investigators cannot move out of attached location.
//   [action]: Test [agility] (1), [combat] (2), or [intellect] (3). If you succeed, exhaust
//   Stone Barrier.
//
// 模板位置（一卡一文件）：
//   src/cards/encounter-entries/theInnsmouthConspiracy/theLairOfDagon/07299.js
//
// 引擎读点：
//   · 显现 = content entry-rules → treachery-tokens.js#resolveTreachery 的条目通道
//     `entryRevelation` + `encounterResolve`；返回 `{ placed:true, gainSurge }` 阻止进遭遇弃牌堆
//     （encounter.js#drawEncounter 的 `resolution.placed` 分支），涌动由同一返回值的
//     `gainSurge` 追加抽取。
//   · 附属 = api.scenario.attachToLocation（location-attachments.js#attachLocationCard 唯一写入口）；
//     唯一 id 用 `07299:<locationId>` 保证同地点第二张不会撞 id（每地点限 1 张由「最近且无石障」筛选保证）。
//   · 「最近且没有石障的地点」= _shared.js#entryDistance 的连接图 BFS；同距由领队选择。
//   · [action] = `treacheryRule.attachmentAbilities`（ability.js 注册期 normalizeDescriptor 校验）；
//     枚举/执行与地点/敌人实体能力同一条管线：parley.js#parleyMovesFor（locationAttachment）→
//     ability-exec.js#doEntityAbility → reveal.js#executeDescriptor；宿主地点由
//     parley.js#locationOfAttachment 反查。
//   · 横置 = api.scenario.exhaustLocationAttachment（scenario-runtime.js 的地点附属唯一写入口）；
//     失败不横置由卡内检定回调决定。
//   · 「重整状态时不能离开」= `treacheryRule.blocksMovementWhileReady`，读点
//     hidden-rules.js#movementError（legalMoves / validateMove / 效果位移共用）；
//     补给阶段由 phases.js#upkeepPhase 重整声明了 attachmentAbilities 的地点附属。
//
// implemented: true

import { entryDistance, originalOf } from '../../_shared.js'

const STONE_BARRIER = '07299'
const TEST_DIFFICULTY = Object.freeze({ agility: 1, combat: 2, intellect: 3 })
const SKILL_LABELS = Object.freeze({ agility: '敏捷(1)', combat: '战力(2)', intellect: '智力(3)' })

const hasStoneBarrier = location =>
  (location.attachments || []).some(attachment => String(originalOf(attachment)) === STONE_BARRIER)

// 「最近且没有附属石障的地点」；不可达地点不参与（Infinity）。
function nearestEligibleLocations(state, fromId) {
  const eligible = state.locations.filter(location => !hasStoneBarrier(location))
  const scored = eligible.map(location => ({ location, distance: entryDistance(state, fromId, location.id) }))
    .filter(item => Number.isFinite(item.distance))
  if (!scored.length) return []
  const nearest = Math.min(...scored.map(item => item.distance))
  return scored.filter(item => item.distance === nearest).map(item => item.location)
}

export default {
  code: '07299', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const candidates = nearestEligibleLocations(state, inv.location)
    if (!candidates.length) {
      api.info?.('「石障」：没有可附属的地点，弃掉。')
      return false
    }
    const chosen = candidates.length === 1 ? candidates[0] : candidates.find(location => location.id === api.choice({
      kind: 'location', source: STONE_BARRIER, seat: inv.seat,
      prompt: '选择最近且没有石障的地点，将「石障」附属到该地点。',
      options: candidates.map(location => ({ id: location.id, label: location.name || location.id })),
    })) || candidates[0]
    // 显现通道的 api 是 scenarioRuntime 面：附属入口在顶层（描述子 resolve 的 api 才有 .scenario 子对象）。
    // attachLocationCard 的地点附属只读取 fields.extra 作为附属对象附加字段，因此重整状态放在 extra 里。
    api.attachToLocation(chosen.id, {
      code: STONE_BARRIER, originalCode: STONE_BARRIER, id: `${STONE_BARRIER}:${chosen.id}`,
      extra: { exhausted: false },
    })
    const flooded = api.mechanics.water.level(chosen.id) > 0
    api.info?.(`🪨 「石障」附属到「${chosen.name || chosen.id}」${flooded ? '（地点已淹没：获得涌动）' : ''}。`)
    return { placed: true, ...(flooded ? { gainSurge: true } : {}) }
  },
  treacheryRule: {
    blocksMovementWhileReady: true,
    attachmentAbilities: [{
      actionKind: 'activate',
      label: '检定敏捷(1)/战力(2)/智力(3)：成功横置石障',
      resolve: ({ inv, source, api }) => {
        const skill = api.choice({
          kind: 'skill', source: STONE_BARRIER, seat: inv.seat,
          prompt: '选择本次检定使用的技能。',
          options: Object.keys(TEST_DIFFICULTY).map(id => ({ id, label: SKILL_LABELS[id] })),
        })
        const difficulty = TEST_DIFFICULTY[skill]
        if (!difficulty) return
        // 描述子 resolve 的 api 是能力面：test 的第 4 参是 options 对象（performTest），不是回调函数。
        api.test(inv.seat, skill, difficulty, {
          source: { type: 'treachery', code: STONE_BARRIER, name: source?.name, ability: true },
          resolve: result => {
            if (result.success) api.scenario.exhaustLocationAttachment(source)
          },
        })
      },
    }],
  },
}
