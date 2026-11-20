// 11516 谈判破裂 · 诡计 ×2（金盆洗手）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面：显现 - 将谈判破裂附属到最近的一名[[罪犯]]敌人。每名敌人限附属 1 张。
//       如果不能如此做，谈判破裂获得涌动。
//       强制 - 一位调查员在本地点谈判后：附属敌人攻击该调查员。
//       [action]：检定[willpower](3)。如果你成功，弃掉本卡牌。
// 印刷：特性 [[Blunder]]。
// 读点（引擎既有/本轮已落地）：
//   · 附属 = api.attachToEnemy(enemy, '11516')（scenario-runtime；写入 enemy.attachments）；
//   · 最近 = api.mechanics.map.nearest（P7 图距离原语，按敌人所在地点求最近）；
//   · 无目标涌动 = 返回 { placed:false, gainSurge:true }，走 encounter.js#finishDraw 的涌动通道；
//   · 谈判后攻击 = 章节 behavior.afterParley（dispatch.js#dispatchParleyHooks 既有钩子）；
//   · [action] = treacheryRule.attachmentAbilities（引擎枚举敌人附属卡行动）+ api.test 意志(3) +
//     api.scenario.detachEncounterAttachment（唯一离场写入口）。
const CODE = '11516'

const traitIsCriminal = enemy => ((enemy?.traits || []).length
  ? enemy.traits
  : []).some(trait => String(trait).toLowerCase() === 'criminal')

const hasThisAttachment = enemy => (enemy?.attachments || [])
  .some(item => String(item.originalCode || item.code) === CODE)

function nearestCriminalEnemy(state, inv, api) {
  const enemies = (state.enemies || []).filter(enemy => !enemy.defeated && traitIsCriminal(enemy)
    && !hasThisAttachment(enemy))
  if (!enemies.length) return null
  if (typeof api?.mechanics?.map?.nearest === 'function') {
    const [nearestLocation] = api.mechanics.map.nearest(inv.location,
      location => enemies.some(enemy => enemy.location === location.id)) || []
    const chosen = nearestLocation && enemies.find(enemy => enemy.location === nearestLocation)
    if (chosen) return chosen
  }
  return enemies[0]
}

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  flags: { attachToNearestCriminal: true },
  treacheryRule: {
    attachmentAbilities: [{
      actionKind: 'activate',
      label: '[action] 检定意志(3)：成功弃掉谈判破裂',
      resolve: ({ inv, source, api }) => {
        api.test(inv.seat, 'willpower', 3, {
          source: { type: 'treachery', code: CODE },
          resolve: result => {
            if (!result?.success) return
            if (typeof api.scenario?.detachEncounterAttachment === 'function') {
              api.scenario.detachEncounterAttachment(source)
            }
            api.info?.('「谈判破裂」：意志检定成功，本卡被弃掉。')
          },
        })
      },
    }],
  },
  encounterResolve(state, inv, card, api) {
    if (!inv) return false
    const enemy = nearestCriminalEnemy(state, inv, api)
    if (!enemy) {
      api?.info?.('「谈判破裂」：没有可附属的[[罪犯]]敌人，本卡获得涌动。')
      return { placed: false, gainSurge: true }
    }
    if (typeof api?.attachToEnemy !== 'function') return false
    api.attachToEnemy(enemy, CODE, { id: `${CODE}:${enemy.id}` })
    api.info?.(`「谈判破裂」附属到最近的[[罪犯]]敌人「${enemy.name || enemy.originalCode || enemy.code}」；`
      + '其在本地点谈判后攻击该调查员。')
    return { placed: true }
  },
  note: '印刷行为已接到 engine 既有/本轮落地读点：api.attachToEnemy（附属）、api.mechanics.map.nearest（最近）、'
    + '{ placed:false, gainSurge:true }（不能附属时涌动）、behavior.afterParley（谈判后攻击）、'
    + 'treacheryRule.attachmentAbilities + api.scenario.detachEncounterAttachment（[action] 意志 3 弃卡）。',
}
