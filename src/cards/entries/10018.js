// 10018 “爹爹在哪儿？”（"Where's Pa?"）· 中立诡计 · 弱点 · 缺陷 · 汉克·萨姆森牌库专用
// 卡面：
//   显现 - 从遭遇牌库顶弃牌，直到弃掉一个敌人。将“爹爹在哪儿？”附属到该敌人，
//          并将其生成在一个连接地点（如可能）。
//   所附属敌人获得逃逸。
//   强制 - 当一轮结束时：汉克·萨姆森受到 1 点直接恐惧。
//
// 读点（卡面 → 引擎）：
//   · 显现结算接管 → 弱点描述子 `weakness` + resolve（weakness.js#resolveWeaknessBody 优先走
//     描述子 resolve）；档案 type:'attachedEnemy' 让 deck-ops 不把附属中的弱点再弃进弃牌堆。
//   · 「从遭遇牌库顶弃牌直到敌人」→ api.scenario.discardEncounterTop（scenario-runtime.js 的唯一
//     遭遇牌库写点：非敌人进遭遇弃牌堆；牌库耗尽时把弃牌堆洗回，与遭遇牌库通用规则一致），
//     找到敌人后用 api.scenario.takeEncounterDiscard 从弃牌堆取回待生成。
//   · 「生成在一个连接地点（如可能）」→ 当前地点的连接地点；没有连接地点时退回当前地点
//     （参考实现同口径）；多个连接地点由玩家选择。生成走 api.scenario.spawn（不自动交战）。
//   · 「附属到该敌人」→ api.attachPlayerCardToAsset（attachCardTo 唯一写点，写 enemy.attachments）。
//   · 「所附属敌人获得逃逸」→ 条目 treacheryRule.enemyKeywordAura（读点
//     enemy-keyword-movement.js#enemyHasAttackKeyword：敌人附属上的 aura 关键词随附属动态生效，
//     附属离场即失效，持久且不需要 round 过期字段）。
//   · 「轮末直接恐惧」→ 见 note：玩家卡附属在敌人身上不是能力窗口来源，phases.js 只在
//     hasWindowListener('roundEnds') 为真时开窗，因此本卡自己无法作为 roundEnds 监听者；
//     该强制能力按汉克当前面写在 10015/10016a/10016b 三个条目上（criteria 读 enemy.attachments
//     里的 10018），效果与印刷一致（汉克受到 1 点直接恐惧）。
// 缺口：引擎的 player-mechanics.js#hasWindowListener / window-listeners.js#hasWindowListener 都不扫描
//   enemy.attachments，也不扫描 state.effects；玩家卡附属到敌人时没有「窗口监听者」读点。
//   若引擎将来把 enemy.attachments 纳入监听来源，可把轮末 forced 搬回本条目。
const CODE = '10018'

export default {
  code: CODE,
  name: '"Where\'s Pa?"',
  note: 'approximation: 轮末「汉克受到 1 点直接恐惧」的 forced 能力写在汉克三张调查员面（10015/10016a/10016b）上——玩家卡附属到敌人不是窗口监听来源（window-listeners.js#hasWindowListener 不扫 enemy.attachments），本条目无法收到 roundEnds 窗口；criteria 仍按本卡是否附属在在场敌人身上判断。',
  abilities: [
    {
      kind: 'weakness',
      label: '“爹爹在哪儿？”',
      weakness: { type: 'attachedEnemy' },
      resolve: ({ state, inv, api }) => {
        // 「从遭遇牌库顶弃牌，直到弃掉一个敌人」：弃牌走 scenarioRuntime 的唯一遭遇牌库写点。
        // 牌库耗尽时先把弃牌堆洗回（遭遇牌库通用规则）；若整副遭遇牌都没有敌人，则一轮扫描后
        // 结束（避免空转），本卡进弃牌堆。
        const scanned = new Set()
        let enemyCode = null
        for (let guard = 0; guard < 500; guard++) {
          if (!api.scenario.encounterDeckCards().length) {
            const unseen = api.scenario.encounterDiscardCards().some(code => !scanned.has(code))
            if (!unseen) break
            api.scenario.rebuildEncounterDeckFromDiscard()
          }
          const [code] = api.scenario.discardEncounterTop(1, { reshuffle: false })
          if (!code) break
          if (api.cardType(code) === 'enemy') {
            enemyCode = code
            api.scenario.takeEncounterDiscard(code)
            break
          }
          scanned.add(code)
        }
        if (!enemyCode) {
          api.putIntoDiscard(inv.seat, CODE)
          return
        }
        const here = (state.locations || []).find(location => location.id === inv.location)
        const connected = [...new Set(here?.connections || [])]
          .filter(id => (state.locations || []).some(location => location.id === id))
        // 「生成在一个连接地点，如可能」：没有连接地点时按参考实现退回当前地点。
        const pool = connected.length ? connected : [inv.location]
        const locationId = pool.length === 1 ? pool[0] : api.choice({
          kind: 'location', source: CODE, seat: inv.seat,
          prompt: '选择“爹爹在哪儿？”的敌人生成位置（连接地点）。',
          options: pool.map(id => ({ id, label: api.locName(id) })),
        })
        if (!locationId) {
          api.putIntoDiscard(inv.seat, CODE)
          return
        }
        const enemy = api.scenario.spawn(enemyCode, locationId)
        if (!enemy) {
          api.putIntoDiscard(inv.seat, CODE)
          return
        }
        const attachment = api.attachPlayerCardToAsset(CODE, enemy, { ownerSeat: inv.seat })
        if (!attachment) {
          api.putIntoDiscard(inv.seat, CODE)
          api.info('“爹爹在哪儿？”：无法附属到该敌人，弃掉这张卡。')
          return
        }
        api.info(`😱 “爹爹在哪儿？”：${enemy.name} 在「${api.locName(locationId)}」生成，本卡附属其上；它获得逃逸。`)
      },
    },
  ],
  // 「所附属敌人获得逃逸」：敌人附属上的动态关键词光环（enemyHasAttackKeyword 的敌人附属分支）。
  // trait 省略＝对该敌人无条件生效。
  treacheryRule: { enemyKeywordAura: { keywords: ['elusive'] } },
  modifiers: [],
}
