// 10050 原型惊变（Transmogrify）· 探求者事件 · 0 经验 · 费用 1 · 策略/科学。
//
// 卡面：躲避。你本次躲避尝试可以不使用[敏捷]，改为使用[智力]。如果你检定成功，且该敌人非[[精英]]，
//       将原型惊变附属到该敌人。
//       所附属敌人获得：“庞大。不能移动。
//       [reaction] 你躲避本敌人后：发现其所在地点的 1 个线索。（每轮仅限一次。）”
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点（卡面 → 引擎）：
//   · 「躲避。」= played 描述子 `countsAs: 'evade'`；躲避走 api.evade({ skill })（combat.js#doEvade，
//     与 10007/04232 同一份规则：目标须与你交战，或为同地点的庞大敌人）。
//   · 「可以不使用[敏捷]，改为使用[智力]」→ api.evade 的 `skill: 'intellect'` 替换读点
//     （combat.js#actionTestSkill）；是否替换由玩家在 resolve 里选择。
//   · 成功后附属到非精英敌人 → api.attachPlayerCardToAsset（actions-extra.js#attachCardTo 的唯一写点，
//     写 enemy.attachments；与 10010/09025 同一形状）+ 条目 `keepOnPlay`（actions.js 事件收尾段：
//     事件不按普通结算进弃牌堆）。
//   · 缺口：所附属敌人获得「庞大。不能移动。」与「你躲避本敌人后发现其地点 1 线索（每轮一次）」两条
//     都没有引擎读点：玩家卡附属在敌人身上不是能力窗口来源（ability-rules.js#nonPlayerAbilitySources
//     只收非玩家 scope 条目，descriptorSources 只枚举 inv.assets 的 attachments），也没有给敌人授予
//     关键词/不可移动的 api（enemy-keyword-movement.js 只允许 alert/aloof/elusive/retaliate）。
//     已登记 primitive-requests/10050.json；当前实现只落地「智力替代的躲避检定 + 成功后附属」。
const CODE = '10050'

// 与 combat.js#doEvade 的可躲避门槛一致：与你交战，或与你同地点的庞大敌人。
const evadableEnemies = (state, inv) => (state?.enemies || []).filter(enemy => enemy.engagedSeat === inv?.seat
  || (enemy.massive === true && enemy.location === inv?.location))

export default {
  code: CODE,
  // 事件结算后留在敌人身上（读点 actions.js 的事件收尾段）。
  keepOnPlay: true,
  simplified: true,
  note: 'approximation: 只实现「智力替代的躲避 + 成功后附属到非精英敌人」；所附属敌人的「庞大/不能移动」与「躲避本敌人后发现 1 线索（每轮一次）」缺引擎读点（primitive-requests/10050.json）。',
  playCondition: [
    {
      when: ({ state, inv }) => evadableEnemies(state, inv).length > 0,
      message: '没有可躲避的敌人（须与你交战或为同地点的庞大敌人）',
    },
  ],
  abilities: [
    {
      kind: 'played',
      countsAs: 'evade',
      label: '躲避（可用[智力]代替[敏捷]）：成功后把原型惊变附属到非精英敌人',
      resolve: ({ state, inv, api }) => {
        const targets = evadableEnemies(state, inv)
        if (!targets.length) {
          api.info('「原型惊变」：没有可躲避的敌人。')
          api.putIntoDiscard(inv.seat, CODE)
          return
        }
        const enemyId = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '选择要躲避的敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = targets.find(item => item.id === enemyId) || targets[0]
        // keepOnPlay 让事件结算时默认不进弃牌堆；没有附属成功（失败/精英/目标已离场）时
        // 由这里显式送回弃牌堆，否则物理牌会从各区域消失。
        const toDiscard = () => api.putIntoDiscard(inv.seat, CODE)
        if (!enemy) {
          toDiscard()
          return
        }
        const useIntellect = api.choice({
          kind: 'skill', source: CODE, seat: inv.seat,
          prompt: '本次躲避尝试使用哪项技能？',
          options: [
            { id: 'intellect', label: '[智力] 代替 [敏捷]' },
            { id: 'agility', label: '[敏捷]' },
          ],
        }) !== 'agility'
        const result = api.evade(inv.seat, {
          enemyId: enemy.id,
          skill: useIntellect ? 'intellect' : 'agility',
          sourceCode: CODE,
        })
        if (!result?.success) {
          toDiscard()
          return
        }
        const survivor = state.enemies.find(item => item.id === enemy.id)
        if (!survivor) {
          toDiscard()
          return
        }
        if (survivor.elite) {
          api.info(`「原型惊变」：「${survivor.name}」是[[精英]]敌人，不能附属。`)
          toDiscard()
          return
        }
        const attachment = api.attachPlayerCardToAsset(CODE, survivor, { ownerSeat: inv.seat })
        if (attachment) api.info(`🧬 「原型惊变」附属到「${survivor.name}」。`)
        else toDiscard()
      },
    },
  ],
  modifiers: [],
}
