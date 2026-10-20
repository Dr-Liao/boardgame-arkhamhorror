// 诡镇奇谈：卡牌版 · 声明式卡牌能力（能力层内容）
//
// P0-A 的落地内容。这里只写「数据 + 描述子」，不做规则判定：
//   · modifiers  被动修正（技能值、槽位、打出费用、敌人生命……）
//   · abilities  主动/免费/反应/强制能力（由引擎按窗口枚举与结算）
//   · elderSign  调查员旧印效果（从 engine.js 的 switch 迁移而来）
//
// 新增一张卡的流程（验收标准）：在 abilities 数组里加一个描述子 → 运行测试。
// 不需要修改 engine.js；描述子里用到的动机/条件由 matcher.js 组合子表达，
// 效果通过 ctx.api 的窄接口执行。
//
// 每张卡都标注 `text`（卡面原文摘要），方便与 cards-data.js 逐字核对；
// 有简化的卡必须写 `simplified: true` 与 `note`，不静默近似。

import { INVESTIGATOR_ABILITIES } from './card-effects.js'
import { MIGRATED_CARD_ENTRIES } from './ability-migration-batches.js'
import {
  atTrait, clueAtLocation, investigatorClues, noEnemiesHere, ownFirstAction, ownSeat, ownTurn,
} from '../engine/matcher.js'

const investigatorSign = code => INVESTIGATOR_ABILITIES[code]?.elderSign || {}

const skillModifier = (skill, amount, condition) => ({ target: `skill:${skill}`, amount, ...(condition ? { condition } : {}) })
const allSkillModifiers = (amount, condition) =>
  ['willpower', 'intellect', 'combat', 'agility'].map(skill => skillModifier(skill, amount, condition))

// ---------------------------------------------------------------------------
// 1. 调查员旧印（原 engine.js elderSignEffect 的 switch，21 人全部迁移）
// ---------------------------------------------------------------------------

const elderSigns = {
  // 罗兰·班克斯：旧印 +1×所在地点线索数。
  '01001': () => {
    const es = investigatorSign('01001')
    return ({ state, inv }) => ({ delta: (state.locations.find(location => location.id === inv.location)?.clues || 0) * (es.bonus || 1) })
  },
  // 黛西·沃克：旧印 +0；可以抽取等同于你控制的[[书籍]]支援数量的牌。
  '01002': () => ({ inv, api }) => ({
    delta: 0,
    optionalDraw: api.countControlled(inv.seat, { trait: 'Tome' }).length,
  }),
  // “倒霉蛋”奥图尔：旧印 +2；成功后获得 2 资源。
  '01003': () => {
    const es = investigatorSign('01003')
    return () => ({ delta: es.bonus || 0, onSuccess: es.onSuccess })
  },
  // 艾格尼丝·贝克：旧印 +1×恐惧值。
  '01004': () => {
    const es = investigatorSign('01004')
    return ({ inv }) => ({ delta: (inv.horror || 0) * (es.bonus || 1) })
  },
  // 温蒂·亚当斯：旧印 +0；若你控制温蒂的护身符，自动成功。
  '01005': () => ({ inv }) => ({ delta: 0, autoSuccess: inv.assets.some(asset => asset.code === '01014') }),
  // 佐伊·萨马拉斯：旧印 +1；攻击伤害 +1 由引擎的成功分支读取，无需在旧印里表达。
  '02001': () => {
    const es = investigatorSign('02001')
    return () => ({ delta: es.bonus || 0, onSuccess: es.onSuccess })
  },
  // 雷克斯·墨菲：旧印 +2；可以改为自动失败并抽 3 张牌。
  '02002': () => {
    const es = investigatorSign('02002')
    return ({ inv, api }) => {
      const answer = api.choice({ kind: 'reaction', source: 'rexElderSign', seat: inv.seat,
        prompt: '旧印：是否改为自动失败并抽 3 张牌？',
        options: [{ id: 'skip', label: '保留 +2' }, { id: 'draw', label: '自动失败并抽 3 张牌' }] })
      return { delta: es.bonus || 2, autoFail: answer === 'draw', draw: answer === 'draw' ? 3 : 0 }
    }
  },
  // “阿什坎·彼得斯”：旧印 +X，X 为当前资源数。
  '02003': () => ({ inv }) => ({ delta: inv.resources }),
  // 吉姆·卡尔弗：旧印 +1；可以视为骷髅（修正为 0）。
  '02004': () => {
    const es = investigatorSign('02004')
    return ({ inv, api }) => {
      const answer = api.choice({ kind: 'reaction', source: 'jimElderSign', seat: inv.seat,
        prompt: '旧印：是否视为骷髅？',
        options: [{ id: 'skip', label: '保留 +1' }, { id: 'skull', label: '视为骷髅（修正为 0）' }] })
      return { delta: answer === 'skull' ? 0 : (es.bonus || 1), asSkull: answer === 'skull' }
    }
  },
  // 皮特·西尔维斯特：旧印 +2；重整你的专属支援。
  '02005': () => {
    const es = investigatorSign('02005')
    return ({ inv, api }) => {
      const asset = inv.assets.find(item => item.code === es.code)
      if (asset && !api.assetsCannotReady(inv)) asset.exhausted = false
      return { delta: es.bonus || 2 }
    }
  },
  // 马克·哈里根：旧印 +0+伤害值。
  '03001': () => {
    const es = investigatorSign('03001')
    return ({ inv }) => ({ delta: (es.base || 0) + (inv.damage || 0) * (es.bonus || 1) })
  },
  // 明蒂·潘：旧印 +1；可以把投入的牌返回手牌。
  '03002': () => {
    const es = investigatorSign('03002')
    return () => ({ delta: es.bonus || 1, returnCommittedSkill: true })
  },
  // 塞菲娜·卢梭：旧印 +3；成功后的额外结算交给战役效果。
  '03003': () => {
    const es = investigatorSign('03003')
    return () => ({ delta: es.bonus || 0, onSuccess: es.onSuccess })
  },
  // 阿卡奇·奥涅莱：旧印 +1；可以在一个充能支援上放置 1 充能。
  '03004': () => {
    const es = investigatorSign('03004')
    return ({ inv, api }) => {
      const candidates = api.countControlled(inv.seat, { usesType: 'charge' })
      if (candidates.length) {
        const answer = api.choice({ kind: 'elderSign', source: 'akachiElderSign', seat: inv.seat,
          prompt: '旧印：是否在一个由你控制的充能支援上放置1个充能？', canSkip: true,
          options: [{ id: 'skip', label: '不放置充能' },
            ...candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) }))] })
        const asset = candidates.find(item => item.id === answer)
        if (asset) asset.uses = (asset.uses || 0) + 1
      }
      return { delta: es.bonus || 1 }
    }
  },
  // 威廉·约里克：旧印 +2；成功后的额外结算交给战役效果。
  '03005': () => {
    const es = investigatorSign('03005')
    return () => ({ delta: es.bonus || 0, onSuccess: es.onSuccess })
  },
  // 罗拉·海耶斯：旧印 +2；成功后可以切换角色。
  '03006': () => {
    const es = investigatorSign('03006')
    return () => ({ delta: es.bonus || 0, onSuccess: es.onSuccess })
  },
  // 里奥·安德森：旧印 +2；查看牌库顶 3 张，取其中一张盟友支援。
  '04001': () => {
    const es = investigatorSign('04001')
    return ({ inv, api }) => {
      api.searchTop(inv.seat, { amount: es.amount || 3, trait: 'Ally', traitZh: '盟友', source: '04001', mandatory: true })
      return { delta: es.bonus || 2 }
    }
  },
  // 厄休拉·唐斯：旧印 +1；检定结束后可以移动到连接地点。
  '04002': () => {
    const es = investigatorSign('04002')
    return () => ({ delta: es.bonus || 1, mayMoveAfterTest: true })
  },
  // 芬恩·爱德华兹：旧印 +1×横置敌人数；成功超过 2 点可以发现 1 个线索。
  '04003': () => {
    const es = investigatorSign('04003')
    return ({ state }) => ({ delta: state.enemies.filter(enemy => enemy.exhausted).length,
      clueOnSuccessBy: es.clueOnSuccessBy || 2 })
  },
  // 马泰奥神父：旧印自动成功，结束后二选一。
  '04004': () => () => ({ delta: 0, autoSuccess: true, chosenReward: true }),
  // 加尔文·怀特：旧印 +0；治疗或承受 1 点伤害/恐惧。
  '04005': () => ({ inv, api }) => {
    const options = [
      { id: 'skip', label: '不结算' },
      { id: 'healDamage', label: '治疗 1 点伤害' },
      { id: 'healHorror', label: '治疗 1 点恐惧' },
      { id: 'takeDamage', label: '受到 1 点直接伤害' },
      { id: 'takeHorror', label: '受到 1 点直接恐惧' },
    ]
    const choice = api.choice({ kind: 'reaction', source: 'calvinElderSign', seat: inv.seat, canSkip: true,
      prompt: '旧印：选择治疗或承受伤害/恐惧。', options })
    if (choice === 'healDamage' && inv.damage > 0) inv.damage -= 1
    else if (choice === 'healHorror' && inv.horror > 0) inv.horror -= 1
    else if (choice === 'takeDamage') api.directDamage(inv.seat, 1)
    else if (choice === 'takeHorror') api.directHorror(inv.seat, 1)
    return { delta: 0 }
  },
}

const elderSignEntries = Object.entries(elderSigns).map(([code, factory]) => ({
  code,
  kind: 'investigator',
  elderSign: { id: `${code}-eldersign`, resolve: factory() },
}))

// ---------------------------------------------------------------------------
// 2. 新增卡牌（20 张，全部经能力层实装，未修改 engine.js）
// ---------------------------------------------------------------------------

export const NEW_CARD_ABILITIES = [
  // 02080 佛朗西斯·摩尔根博士：+1 战斗；击败敌人后横置抽 1。
  {
    code: '02080',
    modifiers: [skillModifier('combat', 1)],
    abilities: [{
      kind: 'reaction', trigger: 'defeatEnemy', label: '横置：抽 1 张牌',
      criteria: [ownSeat()], cost: { exhaust: true },
      resolve: ({ inv, api }) => api.drawCards(inv.seat, 1),
    }],
  },
  // 02218 厄尔·索耶：+1 敏捷；躲避成功后横置抽 1。
  {
    code: '02218',
    modifiers: [skillModifier('agility', 1)],
    abilities: [{
      kind: 'reaction', trigger: 'evadeSuccess', label: '横置：抽 1 张牌',
      criteria: [ownSeat()], cost: { exhaust: true },
      resolve: ({ inv, api }) => api.drawCards(inv.seat, 1),
    }],
  },
  // 02140 死灵之书：+1 智识；[行动]获得 2 资源。
  {
    code: '02140',
    modifiers: [skillModifier('intellect', 1)],
    abilities: [{
      kind: 'action', label: '获得 2 资源',
      resolve: ({ inv, api }) => api.gainResources(inv.seat, 2),
    }],
  },
  // 04051 亚历山卓·维拉：调查[[古代]]地点 +1 技能；[行动]横置抽 2。
  // 简化：修正按「位于[[古代]]地点时全部技能 +1」处理（含非调查检定），卡面只写调查。
  {
    code: '04051',
    simplified: true,
    modifiers: allSkillModifiers(1, { atTrait: 'ancient' }),
    abilities: [{
      kind: 'action', label: '横置：抽 2 张牌（需在[[古代]]地点）',
      criteria: [atTrait('ancient')], cost: { exhaust: true },
      resolve: ({ inv, api }) => api.drawCards(inv.seat, 2),
    }],
  },
  // 05115 .45汤姆逊冲锋枪：使用(5子弹)；[行动]花 1 子弹攻击 +2 战斗 +1 伤害。
  {
    code: '05115',
    uses: 5, usesType: 'ammo',
    abilities: [{
      kind: 'action', label: '花 1 子弹攻击（战斗 +2，伤害 +1）',
      cost: { uses: 1 },
      effect: { type: 'fight', combatBonus: 2, damageBonus: 1 },
    }],
  },
  // 07025 .25自动手枪：快速；使用(4子弹)；[行动]花 1 子弹攻击，
  // 若目标横置则 +2 战斗 +1 伤害。
  // Phase 1（B1）：目标写进描述子，legalMoves 直接展开成「手枪 → 敌人」，
  // resolve 里不再自己询问（牌桌先选目标、AI 少一轮）。
  {
    code: '07025',
    uses: 4, usesType: 'ammo',
    abilities: [{
      kind: 'action', label: '花 1 子弹攻击（目标横置时战斗 +2、伤害 +1）',
      cost: { uses: 1 },
      target: { kind: 'enemy' },
      resolve: ({ inv, target, api }) => {
        const enemy = target?.entity
        if (!enemy) return api.info('这里没有可攻击的敌人。')
        const bonus = enemy.exhausted ? { combatBonus: 2, damageBonus: 1 } : {}
        api.fight(inv.seat, enemy.id, { ...bonus, assetId: '07025' })
      },
    }],
  },
  // 07017 《圣经·诗篇》：使用(4秘密)；[行动]花 1 秘密治愈同地点 1 点恐惧，并加入 2 个 [bless]。
  {
    code: '07017',
    uses: 4, usesType: 'secrets',
    abilities: [{
      kind: 'action', label: '花 1 秘密：治愈同地点 1 点恐惧并加入 2 个 [bless]',
      cost: { uses: 1 },
      resolve: ({ state, inv, api }) => {
        const candidates = api.investigatorsAt(inv.location).filter(other => other.horror > 0 || other.assets.some(asset => (asset.horror || 0) > 0))
        if (candidates.length) {
          const answer = candidates.length === 1 ? candidates[0].seat
            : api.choice({ kind: 'target', source: '07017', seat: inv.seat, prompt: '选择治愈目标。',
              options: candidates.map(other => ({ id: String(other.seat), label: other.name })) })
          const target = candidates.find(other => String(other.seat) === String(answer))
          if (target) {
            if (target.horror > 0) api.healHorror(target.seat, 1)
            else {
              const ally = target.assets.find(asset => (asset.horror || 0) > 0)
              if (ally) ally.horror -= 1
            }
            api.info(`✨ ${target.name} 的恐惧被治愈。`)
          }
        } else {
          api.info('同地点没有需要治愈的调查员或盟友。')
        }
        api.addChaosToken('bless')
        api.addChaosToken('bless')
        void state
      },
    }],
  },
  // 01518 巡警：+1 战斗；[免费]弃掉：对同地点 1 个敌人造成 1 点伤害。
  // Phase 1（B1）：目标枚举由描述子声明，没有敌人时这条能力不再出现在合法动作里。
  {
    code: '01518',
    modifiers: [skillModifier('combat', 1)],
    abilities: [{
      kind: 'free', label: '弃掉：对同地点 1 个敌人造成 1 点伤害',
      cost: { discardSelf: true },
      target: { kind: 'enemy' },
      resolve: ({ inv, target, api }) => {
        if (target) api.damageEnemy(target.entity, 1, inv.seat)
      },
    }],
  },
  // 01527 警徽：+1 意志；[免费]弃掉：本回合行动中的调查员获得 2 次额外行动。
  {
    code: '01527',
    modifiers: [skillModifier('willpower', 1)],
    abilities: [{
      kind: 'free', label: '弃掉：本回合调查员 +2 行动',
      cost: { discardSelf: true },
      resolve: ({ state, inv, api }) => {
        const candidates = api.investigatorsAt(inv.location)
        if (!candidates.length) return
        const answer = candidates.length === 1 ? String(candidates[0].seat)
          : api.choice({ kind: 'target', source: '01527', seat: inv.seat, prompt: '选择获得额外行动的研究员。',
            options: candidates.map(other => ({ id: String(other.seat), label: other.name })) })
        const target = candidates.find(other => String(other.seat) === String(answer))
        if (!target) return
        api.gainAction(target.seat, 2)
        if (state.currentSeat === target.seat) target.actionsLeft += 0
      },
    }],
  },
  // 01522 证据！：快速事件；击败敌人后发现同地点 1 个线索。
  {
    code: '01522',
    abilities: [{
      kind: 'reaction', trigger: 'defeatEnemy', label: '发现同地点 1 个线索',
      fromHand: true,
      criteria: [ownSeat()],
      resolve: ({ inv, api }) => api.discoverClue(inv.seat, 1),
    }],
  },
  // 01523 闪躲：快速事件；敌人攻击同地点调查员时取消该次攻击。
  {
    code: '01523',
    abilities: [{
      kind: 'reaction', trigger: 'enemyAttack', label: '取消该次攻击',
      fromHand: true,
      criteria: [ctx => ctx.context?.location === ctx.inv?.location],
      resolve: ({ context }) => { context.cancelled = true },
    }],
  },
  // 05028 良好人脉：每位调查员仅限 1 张；[免费]横置：每 5 资源 +1 技能值。
  {
    code: '05028',
    abilities: [{
      kind: 'free', trigger: 'test.beforeCommit', label: '横置：每 5 资源使本次检定 +1',
      cost: { exhaust: true }, duringOwnSkillTest: true,
      resolve: ({ inv, api }) => api.addTestValue(Math.floor((inv.resources || 0) / 5)),
    }],
  },
  // 05112 魔法手势：额外 1 个法术槽位（简化为不限制只能带[[法术]]/[[仪式]]）。
  {
    code: '05112',
    simplified: true,
    note: '额外槽位未限制卡牌特性；完整实现需要带特性的槽位规则。',
    modifiers: [{ target: 'slot:arcane', amount: 1 }],
  },
  // 07027 眼花缭乱：快速；使用(3充能)；[反应]趁乱攻击时花 1 充能取消该次攻击。
  {
    code: '07027',
    uses: 3, usesType: 'charges',
    abilities: [{
      kind: 'reaction', trigger: 'opportunityAttack', label: '花 1 充能：取消该次攻击',
      cost: { uses: 1 },
      resolve: ({ context }) => { context.cancelled = true },
    }],
  },
  // 02040 亨利·阿米蒂奇博士：[反应]抽到非弱点牌后，弃掉该牌并横置：获得 3 资源。
  {
    code: '02040',
    abilities: [{
      kind: 'reaction', trigger: 'cardDrawn', label: '弃掉刚抽到的牌并横置：获得 3 资源',
      criteria: [ownSeat(), ctx => Boolean(ctx.context?.cardCode)
        && ctx.context.cardCode !== '02040'
        && !ctx.helpers.isWeakness(ctx.context.cardCode)],
      cost: { exhaust: true },
      resolve: ({ inv, context, api }) => {
        if (!api.discardFromHand(inv.seat, context.cardCode)) return
        api.gainResources(inv.seat, 3)
      },
    }],
  },
  // 02061 沃伦·莱斯教授：+1 智识；[反应]发现所在地点最后 1 个线索后横置抽 1。
  {
    code: '02061',
    modifiers: [skillModifier('intellect', 1)],
    abilities: [{
      kind: 'reaction', trigger: 'clueDiscovered', label: '横置：抽 1 张牌',
      criteria: [ownSeat(), ctx => ctx.context?.location === ctx.inv?.location && ctx.context?.lastClue === true],
      cost: { exhaust: true },
      resolve: ({ inv, api }) => api.drawCards(inv.seat, 1),
    }],
  },
  // 01533 米兰·克里斯托弗博士：+1 智识；[反应]成功调查后获得 1 资源。
  {
    code: '01533',
    modifiers: [skillModifier('intellect', 1)],
    abilities: [{
      kind: 'reaction', trigger: 'investigateSuccess', label: '获得 1 资源',
      criteria: [ownSeat()],
      resolve: ({ inv, api }) => api.gainResources(inv.seat, 1),
    }],
  },
  // 03142 黑玛瑙扣环：在手牌中时，你每张其他手牌的费用 +1。
  {
    code: '03142',
    modifiers: [{ target: 'playCost', amount: 1, condition: { sourceInHand: true } }],
  },
  // 05025 串联线索：快速事件；发现所在地点最后 1 个线索后，
  // 发现另一个隐藏值更低地点的 2 个线索。
  {
    code: '05025',
    abilities: [{
      kind: 'reaction', trigger: 'clueDiscovered', label: '发现一个隐藏值更低地点的 2 个线索',
      fromHand: true,
      criteria: [ownSeat(), ctx => ctx.context?.location === ctx.inv?.location && ctx.context?.lastClue === true],
      resolve: ({ state, inv, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        const options = state.locations.filter(location => location.id !== inv.location
          && (location.shroud || 0) < (here?.shroud || 0) && (location.clues || 0) > 0)
        if (!options.length) return api.info('没有隐藏值更低且有线索的地点。')
        const answer = options.length === 1 ? options[0].id
          : api.choice({ kind: 'target', source: '05025', seat: inv.seat, prompt: '选择发现线索的地点。',
            options: options.map(location => ({ id: location.id, label: api.locationName(location.id) })) })
        const target = options.find(location => location.id === answer)
        if (target) api.discoverAt(inv.seat, target.id, 2)
      },
    }],
  },
  // 05023 宝剑王牌：+1 战斗；[反应]游戏开始时若在起始手牌，将其放置入场。
  {
    code: '05023',
    modifiers: [skillModifier('combat', 1)],
    abilities: [{
      kind: 'reaction', trigger: 'scenarioStarts', label: '游戏开始时放置入场',
      fromHand: true, noPlayCost: true,
      resolve: ({ inv, api }) => {
        if (!inv.hand.includes('05023')) return
        api.putIntoPlay(inv.seat, '05023')
      },
    }],
  },
]

// ---------------------------------------------------------------------------
// 3. 迁移到能力层的修正（原 engine.js / rules-state.js 的卡号特判）
// ---------------------------------------------------------------------------

export const MIGRATED_MODIFIER_ENTRIES = [
  // 03009 苏菲（受创版）：受到 5 点以上伤害时全部技能 -1（原 engine.getStat 的卡号特判）。
  {
    code: '03009',
    modifiers: [{ target: 'skill:*', amount: -1, condition: { damageAtLeast: 5 } }],
  },
  // 01117 丽塔·钱德勒：她所在地点的调查员战斗 +1（原 litaAuraAt）。
  {
    code: '01117',
    modifiers: [{ target: 'skill:combat', amount: 1, audience: 'here', condition: { controllerHasNoThreat: '02088' } }],
  },
  // 02255 「文本空白时生命值按调查员人数减少」（原 rules-state.enemyHealthValue 的卡号特判）。
  {
    code: '02255',
    modifiers: [{
      target: 'enemyHealth',
      amount: ctx => -((ctx.state?.numInvestigators) || 1),
      condition: { blankedThisRound: true },
    }],
  },
]

// ---------------------------------------------------------------------------
// 3. 生命周期通道试点（Phase 1）：事件打出（played）与投入技能检定（commit）
// ---------------------------------------------------------------------------
//
// 这六张卡在 card-effects.js / content/packs 里的 EFFECTS 条目已经删除——
// 「效果数据」原样搬进描述子，「读点」由 src/engine/lifecycle.js 统一提供。
// 这是"迁一张卡不改引擎"的第一个证据：删掉 EFFECTS 条目后，行为必须完全不变。

export const LIFECYCLE_ENTRIES = [
  // 01088 应急物品：获得 3 资源。
  {
    code: '01088',
    abilities: [{ kind: 'played', label: '获得 3 资源', effect: { type: 'gainResource', amount: 3 } }],
  },
  // 02008 寻找真相：你每有 1 个线索，抽 1 张牌（最多 5 张）。
  {
    code: '02008',
    abilities: [{ kind: 'played', label: '按线索数抽牌（最多 5 张）', effect: { type: 'drawPerClue', maximum: 5 } }],
  },
  // 02194 应急物品：获得 3 资源，然后抽 1 张牌。
  {
    code: '02194',
    abilities: [{
      kind: 'played', label: '获得 3 资源并抽 1 张牌',
      effect: {
        type: 'sequence',
        effects: [{ type: 'gainResource', amount: 3 }, { type: 'draw', amount: 1 }],
      },
    }],
  },
  // 02150 推理：检定成功额外发现 1 个线索；成功 2 点以上再 1 个。
  {
    code: '02150',
    abilities: [{
      kind: 'commit', label: '成功额外发现线索',
      skill: { onSuccess: { clueBonus: 1 }, successBy: { threshold: 2, clueBonus: 1 } },
    }],
  },
  // 02268 无所畏惧：检定成功治疗 1 点恐惧；成功 2 点以上再 1 点。
  {
    code: '02268',
    abilities: [{
      kind: 'commit', label: '成功治疗恐惧',
      skill: { onSuccess: { healHorror: 1 }, successBy: { threshold: 2, healHorror: 1 } },
    }],
  },
  // 02299 致命打击：检定成功 +1 伤害；成功 2 点以上再 +1。
  {
    code: '02299',
    abilities: [{
      kind: 'commit', label: '成功 +1 伤害',
      skill: { onSuccess: { damageBonus: 1 }, successBy: { threshold: 2, damageBonus: 1 } },
    }],
  },
  // 02105 紧急救援：选择同地点 1 位调查员，治愈其或其盟友的 2 点伤害。
  {
    code: '02105',
    abilities: [{
      kind: 'played', label: '治愈同地点调查员或其盟友 2 点伤害',
      effect: { type: 'healDamageAtLocation', amount: 2 },
    }],
  },
  // 02186 荒唐的素描像：所在地点有线索才能打出；抽取 3 张卡牌。
  // 「有线索才能打出」不再是顶层散字段，而是条目上的 playCondition（唯一读点）。
  {
    code: '02186',
    playCondition: [{ when: clueAtLocation(), message: '当前地点没有线索' }],
    abilities: [{ kind: 'played', label: '抽取 3 张卡牌', effect: { type: 'draw', amount: 3 } }],
  },
  // 02273 喘息时间：所在地点没有敌人才能打出；治愈 3 点恐惧并抽 1 张。
  {
    code: '02273',
    playCondition: [{ when: noEnemiesHere(), message: '当前地点有敌人' }],
    abilities: [{
      kind: 'played', label: '治愈 3 点恐惧并抽 1 张',
      effect: { type: 'sequence', effects: [{ type: 'heal', amount: 3, what: 'horror' }, { type: 'draw', amount: 1 }] },
    }],
  },
  // 02271 鸿运当头：只能投入你正在执行的技能检定（放逐换自动成功由引擎的检定流程处理）。
  {
    code: '02271',
    abilities: [{ kind: 'commit', label: '只能投入自己正在执行的检定', skill: { selfTestOnly: true } }],
  },
]

// ---------------------------------------------------------------------------
// 4. Phase 1 生命周期钩子试点：weakness / entersPlay / leavesPlay
// ---------------------------------------------------------------------------
//
// 这三个 kind 补齐了「事件打出（played）/ 投入检定（commit）」之外的三个读点：
//   弱点揭示   → lifecycle.weaknessProfile(code)   （原 EFFECTS[code].weakness）
//   进场       → lifecycle.entersPlayEffect(code)  （原 EFFECTS[code].onEnter）
//   离场       → lifecycle.leavesPlayEffect(code)  （原引擎内联的 millOnLeave 特判）
//
// 迁移纪律与 played/commit 相同：数据原样搬家、删掉旧条目、行为零变化。
// 描述子带 resolve() 时接管结算（弱点可以完全自定义），不带则走效果解释器。

export const TRANSITION_ENTRIES = [
  // 01096 失忆：显现 - 选择并弃掉你的手牌，只剩 1 张。
  {
    code: '01096',
    abilities: [{
      kind: 'weakness', label: '弃掉手牌只剩 1 张',
      weakness: { type: 'discardHandTo', keep: 1 },
    }],
  },
  // 01097 妄想症：显现 - 弃掉你全部资源。
  {
    code: '01097',
    abilities: [{
      kind: 'weakness', label: '弃掉全部资源',
      weakness: { type: 'loseResource', all: true },
    }],
  },
  // 04021 爱丽·霍洛维兹博士：入场后查找牌库顶 9 张，找出一张[[遗物]]支援并附属到自身。
  // 5c-19：不再走 tfaPlayer 逃生原语；读牌库顶/筛选/选择/附属/洗回都在 resolve 里，
  // 由 api.topDeckCodes / attachCardFromDeck / shuffleDeck 结算（读点仍是 entersPlay）。
  {
    code: '04021',
    abilities: [{
      kind: 'entersPlay', label: '入场：查找牌库顶 9 张中的[[遗物]]支援并附属',
      resolve: ({ inv, source, api }) => {
        const top = api.topDeckCodes(inv.seat, 9)
        const relics = top.filter(code => api.cardType(code) === 'asset'
          && api.cardTraits(code).includes('relic') && api.isNonWeakness(code))
        if (!relics.length) {
          api.shuffleDeck(inv.seat)
          api.info('牌库顶 9 张里没有遗物支援，洗回牌库。')
          return
        }
        const chosen = relics.length === 1 ? relics[0] : api.choice({ kind: 'search', source: '04021', seat: inv.seat,
          prompt: '从牌库顶 9 张里选择 1 张遗物支援附属到爱丽·霍洛维兹博士。',
          options: relics.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })) })
        const picked = relics.includes(chosen) ? chosen : relics[0]
        api.attachCardFromDeck(source, picked)
        api.shuffleDeck(inv.seat)
        api.info(`「${api.cardName(picked)}」被附属到「${api.cardName('04021')}」，不占用槽位。`)
      },
    }],
  },
  // 03315 伊苏之匙：离场时弃掉你牌库顶 10 张卡牌。
  // （卡面的被动修正与伤害转移仍在旧 DSL 条目里，逐项迁移时再搬。）
  {
    code: '03315',
    abilities: [{
      kind: 'leavesPlay', label: '离场：弃掉牌库顶 10 张卡牌',
      leavesPlay: { type: 'mill', amount: 10 },
    }],
  },
]

// ---------------------------------------------------------------------------
// 5. Phase 2 门禁：逃生卡批量迁移（21 张，旧原语 → 描述子）
// ---------------------------------------------------------------------------
//
// 这张表是 Phase 2 门禁的证据：`docs/phase2-primitives.md` 的对照表逐行对应这里的条目。
// 迁移纪律与 Phase 1 相同——**数据与行为原样搬家**：
//   · 旧条目（content/packs/*/effects.js 的 `custom('xxx')` / `tfa(...)`）整条删除；
//   · engine.js 里对应的 `if (effect.action === 'xxx')` 分支整段删除；
//   · 行为差别为零：随机仍走 api.random、询问仍走 api.choice、日志文案保持不变。
// 因此这 21 张卡的 escape 通道计数会从 114 下降到 93，而引擎卡号字面量不增加。

export const MIGRATED_ESCAPE_ENTRIES = [
  // ---- 卡可萨：游荡者/幸存者 ----
  // 03152 偷袭：对同地点 1 个未与你交战的敌人造成 2 点伤害（旧原语 carcosaPlayer.sneakAttack2）。
  {
    code: '03152',
    abilities: [{
      kind: 'played', label: '对未与你交战的敌人造成 2 点伤害',
      resolve: ({ state, inv, api }) => {
        const candidates = state.enemies.filter(enemy => enemy.location === inv.location && enemy.engagedSeat !== inv.seat)
        if (!candidates.length) return
        const chosen = candidates.length === 1 ? candidates[0].id
          : api.choice({ kind: 'target', source: '03152', seat: inv.seat, prompt: '选择要偷袭的敌人。',
            options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const target = candidates.find(enemy => enemy.id === chosen) || candidates[0]
        api.damageEnemy(target, 2, inv.seat)
      },
    }],
  },
  // 03155 战斗或逃跑：快速事件；本轮战斗与敏捷 +当前恐惧值（A1 效果实体）。
  {
    code: '03155',
    playCondition: [{ when: ownTurn(), message: '只能在自己的回合打出' }],
    abilities: [{
      kind: 'played', fast: true, label: '本轮战斗与敏捷 +当前恐惧值',
      resolve: ({ inv, api }) => {
        const bonus = inv.horror || 0
        api.addEffect({
          duration: 'endOfRound', controllerSeat: inv.seat, label: '战斗或逃跑：本轮战斗与敏捷加值',
          modifiers: [{ target: 'skill:combat', amount: bonus }, { target: 'skill:agility', amount: bonus }],
        })
        api.info(`${inv.name} 本轮战斗与敏捷 +${bonus}（战斗或逃跑）。`)
      },
    }],
  },
  // 03191 逻辑推理：治疗同地点调查员 2 点恐惧，或弃掉其威胁区的 1 张恐怖卡。
  {
    code: '03191',
    playCondition: [{ when: investigatorClues(1), message: '需要至少 1 个线索才能打出' }],
    abilities: [{
      kind: 'played', label: '治疗 2 点恐惧或弃掉 1 张恐怖卡',
      resolve: ({ state, inv, api }) => {
        const candidates = api.investigatorsAt(inv.location)
        if (!candidates.length) return
        const seatId = candidates.length === 1 ? String(candidates[0].seat)
          : api.choice({ kind: 'investigator', source: '03191', seat: inv.seat, prompt: '选择目标调查员。',
            options: candidates.map(other => ({ id: String(other.seat), label: other.name })) })
        const target = state.investigators[Number(seatId)] || inv
        const terrors = (target.threat || []).filter(item =>
          (api.cardTraits?.(item.code) || []).some(trait => String(trait).toLowerCase() === 'terror'))
        const answer = api.choice({ kind: 'effect', source: '03191', seat: inv.seat, prompt: '选择逻辑推理的效果。',
          options: [{ id: 'heal', label: '治疗2点恐惧' },
            ...terrors.map(item => ({ id: item.id, label: `弃置「${api.cardName(item.code)}」` }))] })
        if (answer === 'heal') api.healHorror(target.seat, 2)
        else {
          const threat = terrors.find(item => item.id === answer)
          if (threat) api.removeThreat(threat)
        }
      },
    }],
  },
  // 03198 夫人：横置时，空手抽 1 张 / 无资源获得 1 资源。
  {
    code: '03198',
    abilities: [
      {
        kind: 'free', label: '空手时抽 1 张牌', cost: { action: false, exhaust: true },
        resolve: ({ inv, api }) => { if (!inv.hand.length) api.drawCards(inv.seat, 1) },
      },
      {
        kind: 'free', label: '无资源时获得 1 资源', cost: { action: false, exhaust: true },
        resolve: ({ inv, api }) => { if (!inv.resources) api.gainResources(inv.seat, 1) },
      },
    ],
  },
  // 03236 探知：查看任一牌库顶 3 张并排列（B5 lookAt）；顶牌有恐怖/预兆特性时受 1 恐惧。
  {
    code: '03236',
    uses: 3, usesType: 'charges',
    abilities: [{
      kind: 'free', label: '探知牌库顶 3 张并重排', cost: { action: false, exhaust: true, uses: 1 },
      resolve: ({ state, inv, api }) => {
        const decks = [
          { id: 'self', label: `${inv.name} 的牌库`, targetSeat: inv.seat, pile: inv.deck },
          ...state.investigators.filter(other => other.seat !== inv.seat && !other.defeated && !other.resigned)
            .map(other => ({ id: `seat:${other.seat}`, label: `${other.name} 的牌库`, targetSeat: other.seat, pile: other.deck })),
          { id: 'encounter', label: '遭遇牌库', zone: 'encounterDeck', pile: state.encounterDeck },
        ].filter(option => option.pile && option.pile.length)
        if (!decks.length) return
        const deckId = decks.length === 1 ? decks[0].id
          : api.choice({ kind: 'deck', source: '03236', seat: inv.seat, prompt: '选择要查看牌库顶 3 张的牌库。',
            options: decks.map(option => ({ id: option.id, label: option.label })) })
        const chosenDeck = decks.find(option => option.id === deckId) || decks[0]
        const top = chosenDeck.pile.slice(-3)
        if (top.some(code => (api.cardTraits?.(code) || []).some(trait => ['terror', 'omen'].includes(String(trait).toLowerCase())))) {
          api.horror(inv.seat, 1)
        }
        api.lookAt(inv.seat, {
          zone: chosenDeck.zone || 'deck', targetSeat: chosenDeck.targetSeat ?? null,
          count: Math.min(3, chosenDeck.pile.length), arrange: true, returnStrategy: 'top',
          prompt: '选择放回牌库顶的顺序（从上到下）。', source: '03236',
        })
      },
    }],
  },
  // 03239 应急物资：分配 4 点——资源或补给。
  {
    code: '03239',
    abilities: [{
      kind: 'played', label: '分配 4 点：资源与补给',
      resolve: ({ inv, api }) => {
        const answer = api.choice({ kind: 'amount', source: '03239', seat: inv.seat,
          prompt: '选择获得的资源数，其余作为补给放置。',
          options: Array.from({ length: 5 }, (_, n) => ({ id: String(n), label: `${n}资源／${4 - n}补给` })) })
        const resources = Number(answer)
        api.gainResources(inv.seat, resources)
        const supplies = 4 - resources
        if (!supplies) return
        const targets = api.investigatorsAt(inv.location).flatMap(owner => owner.assets)
          .filter(asset => String(asset.usesType).toLowerCase().startsWith('suppl'))
        if (!targets.length) return
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '03239', seat: inv.seat, prompt: '选择要放置补给的支援。',
            options: targets.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })) })
        const asset = targets.find(item => item.id === chosen) || targets[0]
        api.addUses(asset, supplies)
      },
    }],
  },
  // 03265 指引：同地点另一位调查员获得 1 个额外行动。
  {
    code: '03265',
    abilities: [{
      kind: 'played', label: '同地点另一位调查员 +1 行动',
      resolve: ({ inv, api }) => {
        const targets = api.investigatorsAt(inv.location).filter(other => other.seat !== inv.seat && !other.turnEnded)
        if (!targets.length) return
        const seatId = targets.length === 1 ? targets[0].seat
          : Number(api.choice({ kind: 'investigator', source: '03265', seat: inv.seat,
            prompt: '选择获得额外行动的调查员。', options: targets.map(other => ({ id: String(other.seat), label: other.name })) }))
        api.gainAction(seatId, 1)
      },
    }],
  },
  // 03112 大卫·伦菲尔德：+1 意志（本卡有毁灭时）；横置：在本卡放 1 毁灭并获得等量资源。
  {
    code: '03112',
    modifiers: [skillModifier('willpower', 1, { sourceDoomAtLeast: 1 })],
    abilities: [{
      kind: 'free', label: '放置 1 毁灭并获得等量资源', cost: { action: false, exhaust: true },
      resolve: ({ source, inv, api }) => {
        if (!source) return
        api.placeDoomOnCard(source, 1)
        api.gainResources(inv.seat, source.doom || 0)
      },
    }],
  },
  // 03271 奥术学徒（卡可萨）：入场时选择放 1 毁灭或受 2 恐惧；横置检索法术。
  {
    code: '03271',
    abilities: [
      {
        kind: 'reaction', trigger: 'assetEnteredPlay', label: '入场：放 1 毁灭或受 2 恐惧',
        criteria: [ctx => ctx.context?.assetCode === '03271'],
        resolve: ({ inv, context, api }) => {
          const entered = inv.assets.find(item => item.id === context?.assetId)
            || inv.assets.find(item => item.code === '03271')
          if (!entered) return
          const answer = api.choice({ kind: 'effect', source: '03271', seat: inv.seat,
            prompt: '选择放置1毁灭或2恐惧。',
            options: [{ id: 'doom', label: '放置1毁灭' }, { id: 'horror', label: '放置2恐惧' }] })
          if (answer === 'doom') api.placeDoomOnCard(entered, 1)
          else api.addAssetHorror(entered, 2)
        },
      },
      {
        kind: 'free', label: '搜索法术牌', cost: { action: false, exhaust: true },
        resolve: ({ inv, api }) => api.searchTop(inv.seat, { amount: 3, trait: 'Spell', choose: 1 }),
      },
    ],
  },

  // ---- 失落的时代：支援 ----
  // 04018 冒险家：横置并花 1 补给，为同地点一个支援补 1 补给/子弹。
  {
    code: '04018',
    uses: 3, usesType: 'supplies',
    abilities: [{
      kind: 'free', label: '放置 1 补给或子弹', cost: { action: false, exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => {
        const targets = api.investigatorsAt(inv.location).flatMap(owner => owner.assets)
          .filter(asset => ['supplies', 'ammo'].includes(String(asset.usesType || '')))
        if (!targets.length) return api.info('这里没有可以补充补给或子弹的支援。')
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '04018', seat: inv.seat, prompt: '选择要补充补给/子弹的支援。',
            options: targets.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })) })
        const asset = targets.find(item => item.id === chosen) || targets[0]
        api.addUses(asset, 1)
        api.info(`「${api.cardName(asset.code)}」获得 1 点${asset.usesType === 'ammo' ? '子弹' : '补给'}。`)
      },
    }],
  },
  // 04026 华饰头骨：击败敌人后放 1 充能（每阶段一次）；花 1 充能抽 1 并获得 1 资源。
  {
    code: '04026',
    uses: 0, usesType: 'charges',
    abilities: [
      {
        kind: 'reaction', trigger: 'defeatEnemy', label: '击败敌人后放置 1 充能',
        criteria: [ownSeat()], limit: 'oncePerPhase',
        resolve: ({ source, api }) => {
          if (!source) return
          api.addUses(source, 1)
          api.info(`「${api.cardName('04026')}」获得 1 充能（${source.uses}）。`)
        },
      },
      {
        kind: 'action', label: '花费 1 充能：抽 1 张牌并获得 1 资源', cost: { action: true, uses: 1 },
        resolve: ({ inv, api }) => { api.drawCards(inv.seat, 1); api.gainResources(inv.seat, 1) },
      },
    ],
  },
  // 04035 雅沃托：横置按弃牌堆顶图标加值；每阶段一次弃掉牌库顶。
  {
    code: '04035',
    abilities: [
      {
        kind: 'free', label: '横置：按弃牌堆顶卡牌的匹配图标加值',
        cost: { action: false, exhaust: true }, duringOwnSkillTest: true,
        resolve: ({ state, inv, api }) => {
          const top = (inv.discard || []).at(-1)
          const skill = state.skillTest?.skill
          if (!top || !skill) return api.info('弃牌堆没有可用于加值的卡牌。')
          const icons = Number(api.cardIcons(top)[skill] || 0)
          api.addPendingTestBonus(icons)
          api.info(`「${api.cardName('04035')}」：弃牌堆顶「${api.cardName(top)}」提供 ${icons} 点加值。`)
        },
      },
      {
        kind: 'free', label: '弃掉牌库顶（每阶段一次）', cost: { action: false },
        limit: { scope: 'perPhase', owner: 'instance' },
        resolve: ({ inv, api }) => {
          if (!inv.deck.length) return api.info('牌库已空。')
          api.discardTopOfDeck(inv.seat, 1)
        },
      },
    ],
  },

  // ---- 失落的时代：事件 ----
  // 04103 犯罪现场：本回合第一个行动，不引发借机攻击；发现 1 个线索，地点有敌人时 2 个。
  {
    code: '04103',
    playCondition: [{ when: ownFirstAction(), message: '只能作为本回合的第一个行动打出' }],
    abilities: [{
      kind: 'played', noOpportunityAttack: true, label: '发现 1 个线索（有敌人时 2 个）',
      resolve: ({ state, inv, api }) => {
        const enemyHere = state.enemies.some(enemy => enemy.location === inv.location)
        api.discoverClue(inv.seat, enemyHere ? 2 : 1)
      },
    }],
  },
  // 04152 洞悉真相：在控制的一个充能/秘密支援上放 2 个秘密。
  {
    code: '04152',
    playCondition: [{ when: investigatorClues(1), message: '需要至少 1 个线索才能打出' }],
    abilities: [{
      kind: 'played', label: '放置 2 个秘密',
      resolve: ({ inv, api }) => {
        const candidates = inv.assets.filter(asset => ['secrets', 'charges'].includes(String(asset.usesType || '')))
        if (!candidates.length) return api.info('没有可放置秘密的支援。')
        const chosen = candidates.length === 1 ? candidates[0].id
          : api.choice({ kind: 'target', source: '04152', seat: inv.seat, prompt: '选择要放置 2 秘密的支援。',
            options: candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })) })
        const asset = candidates.find(item => item.id === chosen) || candidates[0]
        api.addUses(asset, 2)
        api.info(`「${api.cardName(asset.code)}」获得 2 点秘密。`)
      },
    }],
  },
  // 04154 一目十行：放回 1 个线索，本次检定 +3。
  {
    code: '04154',
    abilities: [{
      kind: 'free', label: '横置并放回 1 个线索：本次检定 +3',
      cost: { action: false, exhaust: true, clues: 1 }, duringOwnSkillTest: true,
      resolve: ({ inv, api }) => {
        api.returnClueToLocation(inv.seat, 1)
        api.addPendingTestBonus(3)
      },
    }],
  },
  // 04160 围困：弃 1 张手牌，本次检定 +2（每次检定一次）。
  {
    code: '04160',
    abilities: [{
      kind: 'free', label: '弃 1 张手牌：本次检定 +2',
      cost: { action: false, exhaust: true, discardHand: 1 },
      duringOwnSkillTest: true, limit: { scope: 'perTest', owner: 'instance' },
      resolve: ({ api }) => api.addPendingTestBonus(2),
    }],
  },
  // 04233 收获日：本回合每个行动换 1 资源，然后结束回合。
  {
    code: '04233',
    abilities: [{
      kind: 'played', noOpportunityAttack: true, label: '本回合每个行动换 1 资源并结束回合',
      resolve: ({ state, inv, api }) => {
        const amount = Math.max(1, inv.actionsTakenThisTurn || 1)
        api.gainResources(inv.seat, amount)
        api.info(`${inv.name} 获得 ${amount} 资源（本回合已执行 ${amount} 个行动）。`)
        if (state.currentSeat === inv.seat) api.endTurn(inv.seat)
      },
    }],
  },
  // 04269 最后一击：对同地点敌人造成 1 点伤害；击败则抽 1；若是自己的回合则结束回合。
  {
    code: '04269',
    abilities: [{
      kind: 'played', noOpportunityAttack: true, label: '对同地点敌人造成 1 点伤害',
      resolve: ({ state, inv, api }) => {
        const targets = state.enemies.filter(enemy => enemy.location === inv.location)
        if (targets.length) {
          const chosen = targets.length === 1 ? targets[0].id
            : api.choice({ kind: 'target', source: '04269', seat: inv.seat, prompt: '选择要射击的敌人。',
              options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
          const enemy = targets.find(item => item.id === chosen) || targets[0]
          api.damageEnemy(enemy, 1, inv.seat)
          if (!state.enemies.includes(enemy)) api.drawCards(inv.seat, 1)
        } else api.info(`${inv.name} 的射击没有目标。`)
        if (state.currentSeat === inv.seat) api.endTurn(inv.seat)
      },
    }],
  },
  // 04204 华饰弓：敏捷 +2、伤害 +2；[行动]重新搭箭（1 子弹）。
  {
    code: '04204',
    uses: 1, usesType: 'ammo',
    abilities: [
      {
        kind: 'action', label: '射箭（敏捷 +2，伤害 +2）', cost: { action: true, uses: 1 },
        effect: { type: 'fight', combatBonus: 2, damageBonus: 2, skill: 'agility' },
      },
      {
        kind: 'action', label: '重新搭箭',
        resolve: ({ source, api }) => {
          if (!source) return
          api.setAssetUses(source, 1)
          api.info('「华饰弓」重新搭上一支箭。')
        },
      },
    ],
  },
  // 04274 保温瓶：花 1 补给并横置，治疗同地点 1 点伤害/恐惧（对应创伤 2 点以上时 2 点）。
  {
    code: '04274',
    uses: 3, usesType: 'supplies',
    abilities: [
      {
        kind: 'action', label: '治疗 1 点伤害', cost: { action: true, exhaust: true, uses: 1 },
        resolve: ({ state, inv, api }) => healWithTrauma(state, inv, api, 'damage'),
      },
      {
        kind: 'action', label: '治疗 1 点恐惧', cost: { action: true, exhaust: true, uses: 1 },
        resolve: ({ state, inv, api }) => healWithTrauma(state, inv, api, 'horror'),
      },
    ],
  },
  // 04306 观景台：快速事件；本回合帷幕 -1，并把别处 1 个线索移到这里。
  {
    code: '04306',
    abilities: [{
      kind: 'played', fast: true, label: '本回合帷幕 -1，并移动 1 个线索到这里',
      resolve: ({ state, inv, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        if (here) api.tempShroudMod(here, -1)
        const sources = state.locations.filter(location => location.id !== inv.location && (location.clues || 0) > 0)
        if (!sources.length || !here) return
        const chosen = sources.length === 1 ? sources[0].id
          : api.choice({ kind: 'location', source: '04306', seat: inv.seat, prompt: '选择要移动 1 个线索的地点（可跳过）。',
            options: sources.map(location => ({ id: location.id, label: location.name })) })
        const source = sources.find(location => location.id === chosen)
        if (source) api.moveClueToLocation(source.id, here.id, 1)
      },
    }],
  },

  // ---- Phase 5（5c 首批）：卡尔克萨 6 张 ----
  // 迁移纪律与 Phase 2 相同：旧条目（content/packs/carcosaPlayer/effects.js 的 custom('…')）
  // 与 engine.js 的 `if (effect.action === '…')` 分支同时删除，日志/询问文案逐字保留。
  // 03026 殚精竭虑：选择同地点一名调查员，搜索其牌库顶 6 张（原 noStoneUnturned）。
  {
    code: '03026',
    abilities: [{
      kind: 'played', label: '搜索同地点一名调查员的牌库顶 6 张',
      resolve: ({ inv, api }) => searchInvestigatorDeck(inv, api, 6),
    }],
  },
  // 03038 藏身地点：快速事件；附属到任一已揭示的地点（敌人阶段结束时有未横置敌人则弃置）。
  {
    code: '03038',
    abilities: [{
      kind: 'played', fast: true, label: '附属到一个已揭示的地点',
      resolve: ({ state, inv, api }) => attachToChosenLocation(state, inv, api, {
        code: '03038', source: 'hidingSpot', revealedOnly: true,
      }),
    }],
  },
  // 03040 头脑发热：基础弱点，显现时再抽取并结算 2 张遭遇卡（原 overzealous）。
  {
    code: '03040',
    abilities: [{
      kind: 'weakness', label: '再抽取并结算 2 张遭遇卡',
      weakness: { type: 'drawEncounter', amount: 2 },
      resolve: ({ inv, api }) => {
        api.drawEncounter(inv.seat)
        api.drawEncounter(inv.seat)
      },
    }],
  },
  // 03148 埋伏：附属到所在地点（地点上没有调查员时弃置）。
  {
    code: '03148',
    abilities: [{
      kind: 'played', label: '附属到所在地点',
      resolve: ({ state, inv, api }) => attachToChosenLocation(state, inv, api, { code: '03148', source: 'ambush' }),
    }],
  },
  // 03199 诱捕陷阱：附属到所在地点。
  {
    code: '03199',
    abilities: [{
      kind: 'played', label: '附属到所在地点',
      resolve: ({ state, inv, api }) => attachToChosenLocation(state, inv, api, { code: '03199', source: 'snareTrap' }),
    }],
  },
  // 03232 捷径：快速事件，只能在自己回合打出；附属到所在地点（提供一次不花行动的移动）。
  {
    code: '03232',
    playCondition: [{ when: ownTurn(), message: '只能在自己的回合打出' }],
    abilities: [{
      kind: 'played', fast: true, label: '附属到所在地点',
      resolve: ({ state, inv, api }) => attachToChosenLocation(state, inv, api, { code: '03232', source: 'shortcut2' }),
    }],
  },
  // 03307 不入虎穴：快速事件；搜索同地点一名调查员的全部牌库（原 noStoneUnturned amount: 'all'）。
  {
    code: '03307',
    abilities: [{
      kind: 'played', fast: true, label: '搜索同地点一名调查员的全部牌库',
      resolve: ({ state, inv, api }) => searchInvestigatorDeck(inv, api, 'all', state),
    }],
  },

  // ---- Phase 5（5c-2）：Carcosa / TFA 调查与躲避类 8 张 ----
  // 这批的共同点：旧原语只是把「调查 / 躲避」入口换成带参数的版本，因此改写后仍走
  // 同一个 `api.investigate` / `api.evade`（行动成本、借机攻击、日志都由引擎主流程决定）。
  // 03027 洞察万物：远程调查任一已揭示地点（旧 inTheKnow，消耗 1 秘密）。
  {
    code: '03027', uses: 3, usesType: 'secrets',
    abilities: [{
      kind: 'action', label: '调查任意已揭示地点', cost: { action: true, uses: 1 },
      resolve: ({ state, inv, api }) => {
        const locations = state.locations.filter(location => location.revealed && !location.locked)
        if (!locations.length) return
        const locationId = api.choice({ kind: 'location', source: '03027', seat: inv.seat,
          prompt: '选择要远程调查的已揭示地点。',
          options: locations.map(location => ({ id: location.id, label: api.locationName(location.id) })) })
        api.investigate(inv.seat, { locationId })
      },
    }],
  },
  // 03031 撬锁工具：调查时改用敏捷，并记录来源支援（旧 lockpicks）。
  {
    code: '03031', uses: 3, usesType: 'supplies', discardWhenEmpty: true,
    abilities: [{
      kind: 'action', label: '撬锁调查', cost: { action: true, exhaust: true },
      resolve: ({ inv, source, api }) => api.investigate(inv.seat, { addSkill: 'agility', lockpicksAssetId: source?.id }),
    }],
  },
  // 03266 奥术洞察：每轮一次，把所在地点的帷幕 -2（旧 arcaneInsight，消耗 1 充能）。
  {
    code: '03266', uses: 3, usesType: 'charges',
    abilities: [{
      kind: 'action', label: '奥术洞察降低帷幕', cost: { action: false, uses: 1 },
      limit: { scope: 'perRound', owner: 'instance' },
      resolve: ({ state, inv, api }) => {
        const location = state.locations.find(item => item.id === inv.location)
        if (location) api.tempShroudMod(location, -2)
      },
    }],
  },
  // 04022 古代石头：调查时所在地点帷幕 +3。
  {
    code: '04022',
    abilities: [{
      kind: 'action', label: '调查（本地帷幕 +3）', cost: { action: true },
      resolve: ({ inv, api }) => api.investigate(inv.seat, { shroudMod: 3, ancientStone: true }),
    }],
  },
  // 04194 异界罗盘：帷幕按「已揭示的连接地点数」降低（旧 otherworldCompass）。
  {
    code: '04194',
    abilities: [{
      kind: 'action', label: '异界罗盘调查', cost: { action: true, exhaust: true },
      resolve: ({ state, inv, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        const revealed = (here?.connections || [])
          .filter(id => state.locations.some(location => location.id === id && location.revealed)).length
        api.investigate(inv.seat, { shroudMod: -revealed })
      },
    }],
  },
  // 04029 / 04271 意志闪避：用意志躲避交战敌人，成功后可以移动到连接地点（旧 lureEvade）。
  // `countsAs: 'evade'` 保证这次能力按躲避结算、不引发借机攻击（旧原语写在 effect.kind 上）。
  ...[[ '04029', 4 ], [ '04271', 5 ]].map(([code, uses]) => ({
    code, uses, usesType: 'charges',
    abilities: [{
      kind: 'action', label: '意志闪避', cost: { action: true, uses: 1 }, countsAs: 'evade',
      resolve: ({ state, inv, api }) => {
        const targets = state.enemies.filter(enemy => enemy.engagedSeat === inv.seat
          || (enemy.massive && enemy.location === inv.location))
        if (!targets.length) { api.info('没有可躲避的交战敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: code, seat: inv.seat,
            prompt: '选择要躲避的敌人。', options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        api.evade(inv.seat, { enemyId: chosen, skill: 'willpower', moveAfterEvade: true })
      },
    }],
  })),
  // 04232 悄然遁去：躲避时加入智识；成功超过 2 点且非精英时下个补给阶段不重整。
  {
    code: '04232',
    abilities: [{
      kind: 'played', label: '悄然遁去',
      resolve: ({ state, inv, api }) => {
        const targets = state.enemies.filter(enemy => enemy.engagedSeat === inv.seat)
        if (!targets.length) { api.info('没有可躲避的交战敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '04232', seat: inv.seat,
            prompt: '选择要躲避的敌人。', options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        api.evade(inv.seat, { enemyId: chosen, addSkill: 'intellect', skipReadyRounds: 1 })
      },
    }],
  },

  // ---- Phase 5（5c-3）：TFA 武器与检定加值 5 张 ----
  // 这批把「选目标」交给描述子的 target 枚举（B1），武器能力统一走 `api.fight`。
  // 04011 芬恩可靠的 .38 手枪：快速资产；花 1 子弹攻击（战斗 +2，未交战敌人额外 +1 伤害）。
  // `fast` 是**条目级**关键字（资产没有 played 钩子），读点 lifecycle.playFlag。
  {
    code: '04011', fast: true, uses: 3, usesType: 'ammo',
    abilities: [{
      kind: 'action', label: '花费 1 子弹：攻击（战斗 +2，未交战敌人额外 +1 伤害）',
      cost: { action: true, uses: 1 }, countsAs: 'fight', target: { kind: 'enemy' },
      resolve: ({ target, inv, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        api.fight(inv.seat, enemy.id, { combatBonus: 2, damageBonus: enemy.engagedSeat !== inv.seat ? 1 : 0 })
      },
    }],
  },
  // 04229 勃朗宁自动步枪：花 1–5 子弹，+X 战斗并造成 X 点伤害（旧 browning）。
  {
    code: '04229', uses: 8, usesType: 'ammo',
    abilities: [{
      kind: 'action', label: '花费 1–5 子弹射击', cost: { action: true }, countsAs: 'fight', target: { kind: 'enemy' },
      resolve: ({ target, source, inv, api }) => {
        const rifle = source
        const max = Math.min(5, rifle?.uses || 0)
        if (!max) { api.info('没有子弹。'); return }
        const spend = max === 1 ? 1 : Number(api.choice({ kind: 'resource', source: '04229', seat: inv.seat,
          prompt: '选择本次攻击花费的子弹数量。',
          options: Array.from({ length: max }, (_, index) => ({
            id: String(index + 1), label: `${index + 1} 子弹（+${index + 1} 战斗，造成 ${index + 1} 伤害）`,
          })) }))
        api.addUses(rifle, -spend)
        if (!target?.entity) return
        api.fight(inv.seat, target.entity.id, { combatBonus: spend, damageOverride: spend })
      },
    }],
  },
  // 04276 古旧锈剑：挥砍是纯数据效果；蓄力斩加入意志、伤害 3，每局一次（旧 rustedSword）。
  {
    code: '04276',
    abilities: [
      { kind: 'action', label: '挥砍（战斗 +2，伤害 +1）', cost: { action: true },
        effect: { type: 'fight', combatBonus: 2, damageBonus: 1 } },
      {
        kind: 'action', label: '蓄力斩（加入意志，伤害 +3）', cost: { action: true, exhaust: true },
        countsAs: 'fight', target: { kind: 'enemy' }, limit: 'oncePerGame',
        resolve: ({ target, state, inv, api }) => {
          const enemy = target?.entity
          if (!enemy) { api.info('没有可攻击的敌人。'); return }
          const elite = !!enemy.elite
          api.fight(inv.seat, enemy.id, { addSkill: 'willpower', damageOverride: 3 })
          if (elite && !state.enemies.includes(enemy)) api.drawCards(inv.seat, 3)
        },
      },
    ],
  },
  // 04305 火焰喷射器：攻击「战斗值最高的交战敌人」+4（旧 flamethrower）。
  {
    code: '04305', uses: 4, usesType: 'ammo',
    abilities: [{
      kind: 'action', label: '喷射火焰', cost: { action: true, uses: 1 }, countsAs: 'fight',
      resolve: ({ state, inv, api }) => {
        const engaged = state.enemies.filter(enemy => enemy.engagedSeat === inv.seat)
        if (!engaged.length) { api.info('没有与你交战的敌人。'); return }
        const highest = engaged.reduce((left, right) => (api.enemyFight(right) > api.enemyFight(left) ? right : left))
        api.fight(inv.seat, highest.id, { combatBonus: 4, flamethrowerSpread: 4 })
      },
    }],
  },
  // 04151 有备无患：横置，按所选支援的匹配图标给本次检定加值（旧 wellPrepared）。
  {
    code: '04151',
    abilities: [{
      kind: 'free', label: '横置：本次检定按所选支援的匹配图标加值',
      cost: { action: false, exhaust: true }, duringOwnSkillTest: true,
      resolve: ({ state, inv, api }) => {
        const skill = state.skillTest?.skill
        if (!skill) { api.info('只能在技能检定期间使用。'); return }
        const candidates = inv.assets.filter(card => card.code !== '04151' && Number(api.cardIcons(card.code)[skill] || 0) > 0)
        if (!candidates.length) { api.info('没有提供匹配图标的支援。'); return }
        const chosen = candidates.length === 1 ? candidates[0].id
          : api.choice({ kind: 'target', source: '04151', seat: inv.seat,
            prompt: `选择要参考${SKILL_NAMES_ZH[skill]}图标的支援。`,
            options: candidates.map(card => ({ id: card.id, label: api.cardName(card.code) })) })
        const card = candidates.find(item => item.id === chosen) || candidates[0]
        const icons = Number(api.cardIcons(card.code)[skill] || 0)
        api.addPendingTestBonus(icons)
        api.info(`「${api.cardName('04151')}」：${api.cardName(card.code)} 提供 ${icons} 点${SKILL_NAMES_ZH[skill]}加值。`)
      },
    }],
  },
]

// 与 src/engine/presentation-constants.js 的 SKILL_NAMES 一致（内容层只需要文案，不 import 引擎展示常量）。
const SKILL_NAMES_ZH = Object.freeze({ willpower: '意志', intellect: '智识', combat: '战斗', agility: '敏捷' })

// ---- Phase 5（5c-4）：TFA 事件与支援 4 张（只用到已有 ctx.api + maxHealth）----
export const MIGRATED_ESCAPE_ENTRIES_5C4 = [
  // 04266 鲜血失色：可额外受到最多 3 点伤害，换取意志攻击加成（旧 bloodletting）。
  {
    code: '04266',
    abilities: [{
      kind: 'played', label: '鲜血失色',
      resolve: ({ inv, api }) => {
        const max = Math.min(3, api.maxHealth(inv.seat) - inv.damage > 0 ? 3 : 0)
        const amount = Number(api.choice({ kind: 'resource', source: '04266', seat: inv.seat,
          prompt: '选择额外承受的伤害（每点 +1 意志与 +1 伤害）。',
          options: Array.from({ length: max + 1 }, (_, index) => ({ id: String(index), label: `${index} 点伤害` })) }))
        if (amount) {
          api.directDamage(inv.seat, amount)
          if (inv.defeated) return
        }
        const targets = api.enemiesAt(inv.location)
        if (!targets.length) { api.info('没有可攻击的敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '04266', seat: inv.seat, prompt: '选择攻击目标。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const target = targets.find(enemy => enemy.id === chosen) || targets[0]
        api.fight(inv.seat, target.id, { skill: 'willpower', combatBonus: amount, damageBonus: amount })
      },
    }],
  },
  // 04313 改变命运：快速事件；弃掉一名调查员威胁区里的一张非弱点、未附属精英的诡计。
  {
    code: '04313',
    abilities: [{
      kind: 'played', fast: true, label: '改变命运',
      resolve: ({ state, inv, api }) => {
        const threats = state.investigators.flatMap(owner => owner.threat.map(card => ({ owner, card })))
          .filter(({ card }) => api.isNonWeakness(card.code) && !card.attachedElite)
        if (!threats.length) { api.info('场上没有可弃掉的诡计。'); return }
        const chosen = threats.length === 1 ? threats[0].card.id
          : api.choice({ kind: 'target', source: '04313', seat: inv.seat, prompt: '选择要弃掉的诡计。',
            options: threats.map(({ owner, card }) => ({ id: card.id, label: `${api.cardName(card.code)}（${owner.name}）` })) })
        const entry = threats.find(({ card }) => card.id === chosen) || threats[0]
        api.removeThreat(entry.card)
        api.info(`「${api.cardName(entry.card.code)}」被「改变命运」弃掉。`)
      },
    }],
  },
  // 04149 恢复元气：本回合第一个行动；治疗 1 点伤害（本回合抽到诡计则 2 点）并抽 1 张。
  {
    code: '04149',
    playCondition: [{ when: ownFirstAction(), message: '只能作为本回合的第一个行动打出' }],
    abilities: [{
      kind: 'played', label: '恢复元气',
      resolve: ({ state, inv, api }) => {
        const amount = inv.drewTreacheryRound === state.round ? 2 : 1
        api.healDamage(inv.seat, amount)
        api.info(`${inv.name} 治疗 ${amount} 点伤害。`)
        api.drawCards(inv.seat, 1)
      },
    }],
  },
  // 04196 萝拉·桑提亚哥：+1 智识 / +1 敏捷；横置并花费「所在地点隐藏值」等量资源发现 1 个线索。
  {
    code: '04196',
    modifiers: [{ target: 'skill:intellect', amount: 1 }, { target: 'skill:agility', amount: 1 }],
    abilities: [{
      kind: 'action', label: '花费隐藏值等量资源：发现 1 个线索', cost: { action: false, exhaust: true },
      resolve: ({ state, inv, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        const cost = here?.shroud || 0
        if (inv.resources < cost) { api.info(`资源不足（需要 ${cost}）。`); return }
        api.loseResources(inv.seat, cost)
        api.discoverClue(inv.seat, 1)
      },
    }],
  },
]

// ---- Phase 5（5c-5）：Carcosa / TFA 移动、战斗与治疗 5 张 ----
// 这一批用到 `api.enemyEvade`（躲避值）与 `api.random`（混乱标记），其余都是已有包装。
const CHAOS_SYMBOLS = ['skull', 'cultist', 'tablet', 'elderthing', 'autofail']

export const MIGRATED_ESCAPE_ENTRIES_5C5 = [
  // 03034 星界旅行：移动到任一已揭示地点；揭示符号标记则弃置一件物品/盟友，否则受到 1 点伤害。
  {
    code: '03034',
    abilities: [{
      kind: 'played', label: '星界旅行',
      resolve: ({ state, inv, api }) => {
        const locations = state.locations.filter(location => location.revealed
          && location.id !== inv.location && !location.locked)
        if (!locations.length) { api.info('没有可前往的已揭示地点。'); return }
        const destination = locations.length === 1 ? locations[0].id
          : api.choice({ kind: 'location', source: '03034', seat: inv.seat, prompt: '选择星界旅行的目的地。',
            options: locations.map(location => ({ id: location.id, label: api.locationName(location.id) })) })
        api.moveInvestigator(inv.seat, destination)
        const token = state.chaosBag[Math.floor(api.random() * state.chaosBag.length)]
        if (!CHAOS_SYMBOLS.includes(token)) return
        const candidates = inv.assets.filter(card => api.cardTraits(card.code)
          .some(trait => ['item', 'ally'].includes(String(trait).toLowerCase())))
        if (!candidates.length) { api.damage(inv.seat, 1); return }
        const chosen = candidates.length === 1 ? candidates[0].id
          : api.choice({ kind: 'target', source: '03034', seat: inv.seat,
            prompt: '选择弃置一件物品或盟友；若没有则受到 1 点伤害。',
            options: candidates.map(card => ({ id: card.id, label: api.cardName(card.code) })) })
        const target = candidates.find(card => card.id === chosen) || candidates[0]
        api.discardAsset(inv.seat, target)
      },
    }],
  },
  // 03153 灵魂风暴：用意志攻击一名交战敌人（没有交战时攻击同地点的敌人）。
  {
    code: '03153',
    abilities: [{
      kind: 'played', label: '灵魂风暴',
      resolve: ({ state, inv, api }) => {
        const engaged = state.enemies.filter(enemy => enemy.engagedSeat === inv.seat)
        const target = engaged[0] || api.enemiesAt(inv.location)[0]
        if (!target) { api.info('这里没有可攻击的敌人。'); return }
        api.fight(inv.seat, target.id, { skill: 'willpower', stormOfSpirits: true })
      },
    }],
  },
  // 03197 充能：为同地点一张法术/遗物支援补 3 点充能；揭示符号标记则弃置它。
  {
    code: '03197',
    abilities: [{
      kind: 'played', label: '充能',
      resolve: ({ state, inv, api }) => {
        const candidates = api.investigatorsAt(inv.location)
          .flatMap(owner => (state.investigators[owner.seat]?.assets || []))
          .filter(card => api.cardTraits(card.code).some(trait => ['spell', 'relic'].includes(String(trait).toLowerCase())))
        if (!candidates.length) { api.info('这里没有可充能的法术或遗物支援。'); return }
        const chosen = candidates.length === 1 ? candidates[0].id
          : api.choice({ kind: 'target', source: '03197', seat: inv.seat, prompt: '选择要充能的支援。',
            options: candidates.map(card => ({ id: card.id, label: api.cardName(card.code) })) })
        const target = candidates.find(card => card.id === chosen) || candidates[0]
        const token = state.chaosBag[Math.floor(api.random() * state.chaosBag.length)]
        if (CHAOS_SYMBOLS.includes(token)) {
          const owner = state.investigators.find(other => other.assets.some(card => card.id === target.id))
          api.discardAsset(owner?.seat ?? inv.seat, target)
          api.info(`「${api.cardName(target.code)}」因符号标记被弃置。`)
          return
        }
        api.addUses(target, 3)
        api.info(`「${api.cardName(target.code)}」补充 3 点充能。`)
      },
    }],
  },
  // 03237 伏击：敏捷检定对抗一名已横置的非精英敌人的躲避值；成功则击败它。
  {
    code: '03237',
    abilities: [{
      kind: 'played', label: '伏击',
      resolve: ({ state, inv, api }) => {
        const candidates = state.enemies.filter(enemy => enemy.location === inv.location
          && enemy.exhausted && !enemy.elite)
        if (!candidates.length) { api.info('这里没有已横置的非精英敌人。'); return }
        const chosen = candidates.length === 1 ? candidates[0].id
          : api.choice({ kind: 'target', source: '03237', seat: inv.seat, prompt: '选择要伏击的敌人。',
            options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const target = candidates.find(enemy => enemy.id === chosen) || candidates[0]
        api.test(inv.seat, 'agility', api.enemyEvade(target), {
          source: { label: '事件', name: api.cardName('03237'), code: '03237' },
          resolve: result => { if (result.success) api.defeatEnemy(target, inv.seat) },
        })
      },
    }],
  },
  // 04304 煤油：本地点本轮有敌人被击败后，治疗一名调查员或一件支援最多 2 点恐惧。
  {
    code: '04304', uses: 3, usesType: 'supplies', discardWhenEmpty: true,
    abilities: [{
      kind: 'action', label: '安抚恐惧', cost: { action: true, exhaust: true, uses: 1 },
      resolve: ({ state, inv, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        if (here?.enemyDefeatedRound !== state.round) { api.info('本地点本轮没有敌人被击败。'); return }
        const targets = api.investigatorsAt(inv.location)
        const options = [
          ...targets.map(owner => ({ id: `inv:${owner.seat}`, label: owner.name })),
          ...targets.flatMap(owner => (state.investigators[owner.seat]?.assets || [])
            .filter(card => (api.cardSanity(card.code) || 0) > 0 && (card.horror || 0) > 0)
            .map(card => ({ id: `asset:${card.id}`, label: api.cardName(card.code) }))),
        ]
        if (!options.length) return
        const chosen = options.length === 1 ? options[0].id
          : api.choice({ kind: 'target', source: '04304', seat: inv.seat,
            prompt: '选择要治愈恐惧的目标（最多 2 点）。', options })
        if (String(chosen).startsWith('inv:')) {
          api.healHorror(Number(String(chosen).slice(4)), 2)
          return
        }
        const card = targets.flatMap(owner => state.investigators[owner.seat]?.assets || [])
          .find(item => item.id === String(chosen).slice(6))
        if (card) api.addAssetHorror(card, -2)
      },
    }],
  },
]

// ---- Phase 5（5b-6）：旧式 reactions 搬到反应描述子（机制批次先落地，再逐批搬卡）----
// 这一批全是**纯数据**反应：条件写成 criteria 的旧字段（selfOnly / assetCode / symbols /
// requiresAlone …），费用与效果数据体逐字保留，由引擎的旧式反应流程结算
// （`legacyReaction: true` → 同一个询问、同一份费用与效果解释器，日志与指纹不变）。
export const MIGRATED_REACTION_ENTRIES = [
  // 02006 佐伊的十字架：与敌人交战后横置并花 1 资源，对交战的敌人造成 1 点伤害。
  {
    code: '02006',
    abilities: [{
      kind: 'reaction', trigger: 'enemyEngaged', id: 'zoeysCross', legacyReaction: true,
      label: '与敌人交战后造成 1 点伤害', cost: { exhaust: true, resources: 1 },
      effect: { type: 'dealDamage', amount: 1 },
    }],
  },
  // 02012 吉姆的小号：揭示骷髅标记后横置，治愈同地点 1 点恐惧。
  {
    code: '02012',
    abilities: [{
      kind: 'reaction', trigger: 'skullRevealed', id: 'jimsTrumpet', legacyReaction: true,
      label: '揭示骷髅标记后治愈 1 点恐惧', cost: { exhaust: true },
      effect: { type: 'healHorrorNearby', amount: 1 },
    }],
  },
  // 02149 艺术生：入场后（自身入场触发）发现 1 个线索。
  {
    code: '02149',
    abilities: [{
      kind: 'reaction', trigger: 'assetEnteredPlay', id: 'artStudent', legacyReaction: true,
      criteria: { assetCode: '02149' }, label: '入场后发现 1 个线索',
      effect: { type: 'discoverClue', amount: 1 },
    }],
  },
  // 02025 先制攻击：敌人生成时快速打出，移动到连接地点（旧条目在批量删除中丢失，这里补回）。
  {
    code: '02025',
    abilities: [{
      kind: 'played', fast: true, trigger: 'enemySpawn', criteria: { selfOnly: true },
      label: '先制攻击', effect: { type: 'moveTo' },
    }],
  },
  // 02029 仪式蜡烛：揭示符号标记后，本次检定 +1。
  {
    code: '02029',
    abilities: [{
      kind: 'reaction', trigger: 'symbolRevealed', id: 'ritualCandles', legacyReaction: true,
      criteria: { symbols: ['skull', 'cultist', 'tablet', 'elderthing'] }, label: '揭示符号标记后本次检定 +1',
      effect: { type: 'addCurrentTest', amount: 1 },
    }],
  },
  // 02188 孤狼：回合开始时若独自一人，获得 1 资源。
  {
    code: '02188',
    abilities: [{
      kind: 'reaction', trigger: 'turnBegins', id: 'loneWolf', legacyReaction: true,
      criteria: { requiresAlone: true }, label: '独自一人时获得 1 资源',
      effect: { type: 'gainResource', amount: 1 },
    }],
  },
  // 02230 幸运骰子：揭示混乱标记后花 2 资源重抽。
  {
    code: '02230',
    abilities: [{
      kind: 'reaction', trigger: 'chaosTokenRevealed', id: 'luckyDice', legacyReaction: true,
      label: '花 2 资源重抽混乱标记', cost: { resources: 2 },
      effect: { type: 'redrawChaos' },
    }],
  },
  // 02302 马莱森博士：抽取遭遇卡后横置并花 1 线索，重抽遭遇卡。
  {
    code: '02302',
    abilities: [{
      kind: 'reaction', trigger: 'encounterDrawn', id: 'maleson', legacyReaction: true,
      label: '横置并花 1 线索重抽遭遇卡', cost: { exhaust: true, clues: 1, returnClue: true },
      effect: { type: 'redrawEncounter' },
    }],
  },
  // 02309 再来一次：技能检定失败后横置，取回投入的技能卡。
  {
    code: '02309',
    abilities: [{
      kind: 'reaction', trigger: 'skillTestFail', id: 'tryAgain', legacyReaction: true,
      label: '技能检定失败后取回投入的技能卡', cost: { exhaust: true },
      effect: { type: 'returnCommittedSkill' },
    }],
  },
]

// ---- Phase 5（5b-11）：耗尽自愈 + 被动与反应组合 ----
export const MIGRATED_MIXED_ENTRIES_5B11 = [
  { code: '04025', forcedUpkeepPayOrDiscard: 1, passive: {"stats":{"intellect":1}} },
  { code: '04147', exhaustOnEnemyDefeatedHealHorror: 1, passive: {"stats":{"combat":1,"agility":1}} },
  {
    code: '03313', passive: {"investigateBonusIfNoClues":2},
    abilities: [{
      kind: 'reaction', trigger: 'discoverClue', id: 'newspaperClue', legacyReaction: true,
      criteria: { requiresNoClues: true }, label: '额外发现 1 个线索',
      effect: { type: 'discoverClue', amount: 1 },
    }],
  },
  {
    code: '04008', passive: {"noOpportunityFirstAction":true},
    abilities: [{
      kind: 'reaction', trigger: 'locationRevealed', id: 'jakeDraw', legacyReaction: true,
      label: '是否横置杰克·威廉斯抽取 1 张牌？', cost: { exhaust: true }, limit: 'oncePerRound',
      effect: { type: 'draw', amount: 1 },
    }],
  },
  {
    code: '04023', passive: {"treacheryTestStats":{"willpower":1,"agility":1}},
    abilities: [{
      kind: 'reaction', trigger: 'treacheryTestSuccess', id: 'toothOfEztli', legacyReaction: true,
      criteria: { selfOnly: true }, label: '横置抽取 1 张牌', cost: { exhaust: true },
      effect: { type: 'draw', amount: 1 },
    }],
  },
]
// ---- Phase 5（5b-10）：封印 / 替换旧印 / 附属（attachTo + onAttach）----
export const MIGRATED_SEAL_ATTACH_ENTRIES = [
  { code: '04013', sealOnEnter: "eldersign", substituteSealedElderSign: true, passive: {"statsWhileSealed":{"willpower":1}} },
  { code: '04019', attachTo: {"kind":"asset","trait":"ally"}, fast: true, passive: {"hostHealth":1,"hostSanity":1} },
  { code: '04020', attachTo: {"kind":"asset","trait":"item"}, fast: true, passive: {"hostAbilitySkillBonus":1} },
  { code: '04193', attachTo: {"kind":"asset","trait":"firearm","maxPerTarget":1}, onAttach: {"ammo":2}, fast: true, passive: {"hostMonsterDamage":1} },
  { code: '04235', sealOnEnter: "eldersign", passive: {"stats":{"willpower":1,"intellect":1,"combat":1,"agility":1}} },
]
// ---- Phase 5（5b-9）：规则性字段 + 被动（自愈恐惧 / 维护付费 / 被击败反伤 / 恐惧转移 / 不可离场）----
export const MIGRATED_RULE_FIELD_ENTRIES = [
  { code: '02027', forcedUpkeepPayOrDiscard: 1, passive: {"stats":{"combat":1}} },
  { code: '02033', healSelfHorrorAfterTurn: 1, passive: {"stats":{"agility":1}} },
  { code: '02035', healSelfHorrorAfterTurn: 1, passive: {"stats":{"agility":1,"willpower":1}} },
  { code: '02106', defeatedDamage: 2, passive: {"stats":{"willpower":1},"assignHarmAtLocation":true} },
  { code: '03009b', cannotLeavePlay: true, passive: {"stats":{"willpower":-1,"intellect":-1,"combat":-1,"agility":-1}} },
  { code: '03315', redirectOneHorrorToSelf: true, passive: {"statsPerAssetHorror":1} },
]
// ---- Phase 5（5b-8b）：被动 + 主动能力（数据原样搬）----
export const MIGRATED_PASSIVE_ABILITY_ENTRIES = [
  { code: '01030', fast: true, passive: { investigateBonus: 1 } },
  {
    code: '01040', fast: true, passive: { investigateBonus: 1 },
    abilities: [{
      kind: 'action', label: '没有线索时收回手中', requiresNoClues: true, cost: { action: false },
      effect: { type: 'returnAssetToHand' },
    }],
  },
  {
    code: '01055', noOpportunityAttack: true, passive: { stats: { agility: 1 } },
    abilities: [{
      kind: 'action', label: '脱身（与全部敌人脱离交战并移到一个连接地点）',
      cost: { action: true, exhaust: true },
      effect: { type: 'sequence', effects: [{ type: 'disengageAll' }, { type: 'moveTo' }] },
    }],
  },
  {
    code: '01070', passive: { extraSlots: { arcane: 1 } },
    abilities: [{
      kind: 'action', label: '灌注（横置，为一个法术支援 +1 充能）',
      cost: { action: true, exhaust: true },
      effect: { type: 'rechargeAsset', amount: 1, trait: 'Spell' },
    }],
  },
  {
    code: '03151', passive: { conditionalStats: { resourcesAtLeast: 10, stats: { willpower: 1, intellect: 1 } } },
    abilities: [{
      kind: 'action', label: '达里奥获得2资源', cost: { action: true, exhaust: true },
      effect: { type: 'gainResource', amount: 2 },
    }],
  },
]
// ---- Phase 5（5b-8a）：纯被动卡（passive 整块搬到条目；5b-8 后续再逐键换成 modifiers）----
export const MIGRATED_PASSIVE_ENTRIES = [
  { code: '01008', passive: {"handSlotsBonus":2,"handSlotsTrait":"Tome"} },
  { code: '01048', passive: {"extraAction":1} },
  { code: '01054', passive: {"extraAction":1} },
  { code: '02147', passive: {"extraSlots":{"handWeapon":1}} },
  { code: '02155', passive: {"investigateBonusIfNoClues":2} },
  { code: '02157', passive: {"extraSlots":{"accessory":1}} },
  { code: '02158', passive: {"extraSlots":{"ally":1}} },
  { code: '02234', passive: {"darkHorse":true,"allStatsIfNoResources":1} },
  { code: '02272', passive: {"parleyDifficultyModifier":-2} },
  { code: '03021', passive: {"assignHarmAtLocation":true} },
  { code: '04006', passive: {"allySlotsForNonUnique":2} },
  { code: '04015', passive: {"assignDirectHarm":true} },
  { code: '04148', passive: {"extraActionExploreOnly":1} },
  { code: '04203', passive: {"evadeBonus":1} },
  { code: '04275', passive: {"statsByConnections":{"count":2,"stats":{"willpower":1,"intellect":1}},"extraConnections":{"count":4,"stats":{"willpower":1,"intellect":1}}} },
]
// ---- Phase 5（5b-6d）：被动 + 反应（02020 / 03269，passive 整块搬到条目）----
export const MIGRATED_REACTION_ENTRIES_5B6D = [
  // 02020 实验室助理：手牌上限 +2；入场后抽 2 张。
  {
    code: '02020', passive: { handSizeBonus: 2 },
    abilities: [{
      kind: 'reaction', trigger: 'assetEnteredPlay', id: 'laboratoryAssistant', legacyReaction: true,
      criteria: { assetCode: '02020' }, label: '入场后抽 2 张',
      effect: { type: 'draw', amount: 2 },
    }],
  },
  // 03269 圣休伯特：意志/智识 +1、理智 -2；将要因恐惧被击败时弃掉自身治愈 2 点恐惧。
  {
    code: '03269', passive: { stats: { willpower: 1, intellect: 1 }, sanityBonus: -2 },
    abilities: [{
      kind: 'reaction', trigger: 'wouldDefeatByHorror', id: 'stHubert', legacyReaction: true,
      label: '弃置自身治愈 2 点恐惧', cost: { discardSelf: true },
      effect: { type: 'heal', amount: 2, what: 'horror' },
    }],
  },
]
// ---- Phase 5（5c-10）：从弃牌堆打出 / 打出后移出游戏 ----
// 三张卡都把「来源是弃牌堆」写进描述子（`playableFromDiscard` / `shuffleBackAfterPlay` /
// `removeAfterPlay`），结算时用 `api.fromDiscardCode()` 复刻旧实现的加成。
export const MIGRATED_ESCAPE_ENTRIES_5C10 = [
  // 03196 量子通量：把弃牌堆洗回牌库，然后抽 1 张（打出后移出游戏）。
  {
    code: '03196', removeAfterPlay: true,
    abilities: [{
      kind: 'played', label: '量子通量',
      resolve: ({ inv, api }) => {
        api.shuffleDiscardIntoDeck(inv.seat)
        api.drawCards(inv.seat, 1)
      },
    }],
  },
  // 04033 临时武器：攻击同地点敌人（敌人战斗值 -1）；从弃牌堆打出时 +1 伤害，然后洗回牌库。
  {
    code: '04033', playableFromDiscard: true, shuffleBackAfterPlay: true,
    abilities: [{
      kind: 'played', label: '临时武器',
      resolve: ({ state, inv, api }) => {
        const fromDiscard = api.fromDiscardCode() === '04033'
        const targets = state.enemies.filter(enemy => enemy.location === inv.location)
        if (!targets.length) { api.info('这里没有可攻击的敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '04033', seat: inv.seat, prompt: '选择攻击目标。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        api.fight(inv.seat, chosen, { enemyFightMod: -1, damageBonus: fromDiscard ? 1 : 0 })
      },
    }],
  },
  // 04272 应急处理：调查（帷幕 -1）；从弃牌堆打出时 +1 线索，然后洗回牌库。
  {
    code: '04272', playableFromDiscard: true, shuffleBackAfterPlay: true,
    abilities: [{
      kind: 'played', label: '应急处理',
      resolve: ({ inv, api }) => {
        const fromDiscard = api.fromDiscardCode() === '04272'
        api.investigate(inv.seat, { shroudMod: -1, clueBonus: fromDiscard ? 1 : 0 })
      },
    }],
  },
]

// ---- Phase 5（5b-7）：天赋牌（`freeTriggers`）搬到条目级字段 ----
// 数据原样搬：`freeTriggers` 数组与 `minimumHandForBoost` / `composure` 都是读点（applyFreeTriggers、
// 分配恐惧时的强制沉静）直接消费的旧形状，`assetEffect` 会把它们与旧 DSL 合并成同一份。
export const MIGRATED_FREETRIGGER_ENTRIES = [
  // 01017 体能训练：花 1 资源提升意志 / 战斗。
  { code: '01017', freeTriggers: [
    { skill: 'willpower', cost: { resources: 1 }, bonus: 1 },
    { skill: 'combat', cost: { resources: 1 }, bonus: 1 },
  ] },
  // 01034 科学理论：智识 / 敏捷。
  { code: '01034', freeTriggers: [
    { skill: 'intellect', cost: { resources: 1 }, bonus: 1 },
    { skill: 'agility', cost: { resources: 1 }, bonus: 1 },
  ] },
  // 01049 交给我：战斗 / 敏捷。
  { code: '01049', freeTriggers: [
    { skill: 'combat', cost: { resources: 1 }, bonus: 1 },
    { skill: 'agility', cost: { resources: 1 }, bonus: 1 },
  ] },
  // 01062 不懈追踪：意志 / 智识。
  { code: '01062', freeTriggers: [
    { skill: 'willpower', cost: { resources: 1 }, bonus: 1 },
    { skill: 'intellect', cost: { resources: 1 }, bonus: 1 },
  ] },
  // 01077 体能训练（另一张同名不同卡）：意志 / 敏捷。
  { code: '01077', freeTriggers: [
    { skill: 'willpower', cost: { resources: 1 }, bonus: 1 },
    { skill: 'agility', cost: { resources: 1 }, bonus: 1 },
  ] },
  // 02187 练习：意志 / 智识 +2（手牌足够才可用）。
  { code: '02187', minimumHandForBoost: 5, freeTriggers: [
    { skill: 'willpower', cost: { resources: 1 }, bonus: 2 },
    { skill: 'intellect', cost: { resources: 1 }, bonus: 2 },
  ] },
  // 02189 坚持不懈：智识 / 敏捷 +3。
  { code: '02189', freeTriggers: [
    { skill: 'intellect', cost: { resources: 2 }, bonus: 3 },
    { skill: 'agility', cost: { resources: 2 }, bonus: 3 },
  ] },
  // 02193 老练探员：战斗 / 敏捷 +1。
  { code: '02193', freeTriggers: [
    { skill: 'combat', cost: { resources: 1 }, bonus: 1 },
    { skill: 'agility', cost: { resources: 1 }, bonus: 1 },
  ] },
  // 02191 苦修：意志 / 战斗 +3（放置 1 毁灭）。
  { code: '02191', freeTriggers: [
    { skill: 'willpower', cost: { doom: 1 }, bonus: 3 },
    { skill: 'combat', cost: { doom: 1 }, bonus: 3 },
  ] },
  // 03035 灵力祭祀刀：任何技能 +2（法术检定），并带主动攻击能力。
  { code: '03035', freeTriggers: [
    { skill: 'any', cost: { exhaust: true }, bonus: 2, requireTestTrait: 'Spell' },
  ], abilities: [
    { kind: 'action', label: '灵力祭祀刀攻击', cost: { action: true, exhaust: true },
      effect: { type: 'fight', combatBonus: 2 } },
  ] },
  // 03107 / 03109 / 03111 / 03113 / 03115：五张「沉静」天赋（快速 + 沉静 + 两组 +1）。
  { code: '03107', fast: true, composure: true, freeTriggers: [
    { skill: 'combat', cost: { resources: 1 }, bonus: 1 },
    { skill: 'agility', cost: { resources: 1 }, bonus: 1 },
  ] },
  { code: '03109', fast: true, composure: true, freeTriggers: [
    { skill: 'intellect', cost: { resources: 1 }, bonus: 1 },
    { skill: 'combat', cost: { resources: 1 }, bonus: 1 },
  ] },
  { code: '03111', fast: true, composure: true, freeTriggers: [
    { skill: 'willpower', cost: { resources: 1 }, bonus: 1 },
    { skill: 'agility', cost: { resources: 1 }, bonus: 1 },
  ] },
  { code: '03113', fast: true, composure: true, freeTriggers: [
    { skill: 'any', cost: { resources: 1 }, bonus: 1, requireTestTrait: 'Spell' },
  ] },
  { code: '03115', fast: true, composure: true, freeTriggers: [
    { skill: 'willpower', cost: { resources: 1 }, bonus: 1 },
    { skill: 'intellect', cost: { resources: 1 }, bonus: 1 },
  ] },
]

// ---- Phase 5（5c-9）：TFA 快速反应事件（检定计划 / 接手 / 放回遭遇牌库）----
export const MIGRATED_ESCAPE_ENTRIES_5C9 = [
  // 04028 你来处理：自己的遭遇卡改由别人接手，并获得 1 资源。
  {
    code: '04028',
    abilities: [{
      kind: 'played', fast: true, trigger: 'encounterDrawn',
      criteria: { nonPerilOnly: true, selfOnly: true },
      label: '你来处理',
      resolve: ({ state, inv, api }) => {
        const others = api.investigatorsAt(inv.location).filter(other => other.seat !== inv.seat)
        const everyone = state.investigators.filter(other => !other.defeated && !other.resigned && other.seat !== inv.seat)
        const candidates = others.length ? others : everyone
        if (!candidates.length) { api.info('没有其他调查员可以接手这张遭遇卡。'); return }
        const chosen = candidates.length === 1 ? String(candidates[0].seat)
          : api.choice({ kind: 'target', source: '04028', seat: inv.seat,
            prompt: '选择接手这张遭遇卡的调查员。',
            options: candidates.map(other => ({ id: String(other.seat), label: other.name })) })
        const target = candidates.find(other => String(other.seat) === chosen) || candidates[0]
        api.redirectEncounterTo(target.seat)
        api.gainResources(inv.seat, 1)
        api.info(`${inv.name} 打出「${api.cardName('04028')}」：改由 ${target.name} 结算这张遭遇卡，并获得 1 资源。`)
      },
    }],
  },
  // 04032 黑暗预言：本次检定改为揭示 5 个混乱标记并选 1 个。
  {
    code: '04032',
    abilities: [{
      kind: 'played', fast: true, trigger: 'tokenReveal', criteria: { anyLocation: true },
      label: '黑暗预言',
      resolve: ({ inv, api }) => {
        if (!api.planTestReveal({ count: 5, choose: 1, symbolOnly: true, source: '04032' })) {
          api.info('只能在技能检定期间使用。')
          return
        }
        api.info(`${inv.name} 打出「${api.cardName('04032')}」：改为揭示 5 个混乱标记。`)
      },
    }],
  },
  // 04034 狗屎运：刚躲避失败的非精英敌人放回遭遇牌库顶。
  {
    code: '04034',
    abilities: [{
      kind: 'played', fast: true, trigger: 'evadeFail',
      criteria: { nonElite: true, failedByAtMost: 2, selfOnly: true },
      label: '狗屎运',
      resolve: ({ api }) => {
        const context = api.reactionContext()
        const enemy = context?.enemy
        if (!enemy || !api.removeEnemy) { api.info('没有可放回遭遇牌库的敌人。'); return }
        api.shuffleEnemyToEncounterTop(enemy)
        api.info(`🍀 「${api.cardName('04034')}」把「${enemy.name}」放回遭遇牌库顶。`)
      },
    }],
  },
  // 04104 枪法如神：攻击连接地点上的敌人，忽略冷漠与反击。
  {
    code: '04104',
    abilities: [{
      kind: 'played', fast: true, label: '枪法如神',
      resolve: ({ state, inv, api }) => {
        const weapons = inv.assets.filter(card => api.cardTraits(card.code)
          .some(trait => ['firearm', 'ranged'].includes(String(trait).toLowerCase())))
        const here = state.locations.find(location => location.id === inv.location)
        const reachable = new Set([inv.location, ...(here?.connections || [])])
        const targets = state.enemies.filter(enemy => reachable.has(enemy.location))
        if (!targets.length) { api.info('连接地点上没有可攻击的敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '04104', seat: inv.seat,
            prompt: '选择要射击的敌人（可在连接地点）。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        const weaponPick = weapons.length === 1 ? weapons[0]
          : weapons.length ? weapons.find(card => card.id === api.choice({ kind: 'target', source: '04104', seat: inv.seat,
            prompt: '选择使用的枪械或远程支援。',
            options: weapons.map(card => ({ id: card.id, label: api.cardName(card.code) })) })) : null
        if (!weaponPick) { api.info('你没有可用于「枪法如神」的枪械或远程支援。'); return }
        const bonus = enemy.engagedSeat !== inv.seat ? 1 : 0
        api.info(`🎯 ${inv.name} 用「${api.cardName(weaponPick.code)}」瞄准「${enemy.name}」：忽略冷漠与反击${bonus ? '，并造成 +1 伤害' : ''}。`)
        api.fight(inv.seat, enemy.id, {
          assetId: weaponPick.id, atConnectingLocation: true, ignoreRetaliate: true, damageBonus: bonus,
        })
      },
    }],
  },
  // 04202 勇斗异劫：额外揭示与「难度-属性」同数量的标记并选 1 个。
  {
    code: '04202',
    abilities: [{
      kind: 'played', fast: true, trigger: 'testBegins',
      criteria: { requiresDifficultyAboveBase: true, selfOnly: true },
      label: '勇斗异劫',
      resolve: ({ state, inv, api }) => {
        const test = state.skillTest
        if (!test) { api.info('只能在自己的技能检定期间打出。'); return }
        const base = api.stat(inv.seat, test.skill)
        const extra = Math.max(1, test.difficulty - base)
        api.addExtraChaosChoices(extra)
        api.info(`💪 「${api.cardName('04202')}」：本次检定额外揭示 ${extra} 个混乱标记并选择 1 个结算。`)
      },
    }],
  },
]

// ---- Phase 5（5c-8）：在反应窗口打出的快速事件（描述子 + resolve）----
export const MIGRATED_ESCAPE_ENTRIES_5C8 = [
  // 03022 我来处理：另一名调查员抽到遭遇卡时，接手结算并在其检定 +2。
  {
    code: '03022',
    abilities: [{
      kind: 'played', fast: true, trigger: 'encounterDrawn',
      criteria: { otherInvestigator: true, nonPerilOnly: true },
      label: '我来处理',
      resolve: ({ inv, api }) => {
        if (!api.redirectEncounter(inv.seat)) return
        api.info(`${inv.name} 接手结算这张遭遇卡，并在其技能检定中获得 +2。`)
      },
    }],
  },
  // 03267 窄路逃生：借机攻击时快速打出，取消攻击并让下一次躲避 +2。
  {
    code: '03267',
    abilities: [{
      kind: 'played', fast: true, trigger: 'opportunityAttack',
      criteria: { selfOnly: true },
      label: '窄路逃生',
      resolve: ({ inv, api }) => {
        api.cancelCurrentAttack()
        api.prepareEvadeBonus(2, inv.seat)
      },
    }],
  },
  // 03314 内讧：本阶段非精英敌人不攻击（敌人阶段开始时快速打出）。
  {
    code: '03314',
    abilities: [{
      kind: 'played', fast: true, trigger: 'enemyPhaseBegins',
      label: '内讧',
      resolve: ({ inv, api }) => { api.preventNonEliteAttacks(inv.seat) },
    }],
  },
]

// ---- Phase 5（5c-7）：Carcosa / TFA 需要新薄包装的卡（敌人修正、阶段禁止攻击、劝服、献祭）----
export const MIGRATED_ESCAPE_ENTRIES_5C7 = [
  // 03108 解剖图：本回合该敌人的战斗与躲避 -2。
  {
    code: '03108',
    abilities: [{
      kind: 'action', label: '解剖图：敌人战斗与躲避 -2', cost: { action: true, exhaust: true },
      resolve: ({ state, inv, api }) => {
        const candidates = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.elite)
        if (!candidates.length) { api.info('这里没有可瞄准的非精英敌人。'); return }
        const chosen = candidates.length === 1 ? candidates[0].id
          : api.choice({ kind: 'enemy', source: '03108', seat: inv.seat, prompt: '选择敌人。',
            options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = candidates.find(item => item.id === chosen) || candidates[0]
        api.enemyTestModifier(enemy, { fight: -2, evade: -2 })
      },
    }],
  },
  // 04105 劝服：人形敌人；精英自动躲避，其余做智识检定，成功洗回遭遇牌库。
  {
    code: '04105',
    abilities: [{
      kind: 'played', label: '劝服',
      resolve: ({ state, inv, api }) => {
        const targets = state.enemies.filter(enemy => enemy.location === inv.location
          && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'humanoid')
          && api.isNonWeakness(enemy.code))
        if (!targets.length) { api.info('这里没有可劝服的人形敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '04105', seat: inv.seat, prompt: '选择要劝服的敌人。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        if (enemy.elite) {
          api.autoEvade(enemy)
          api.info('「' + enemy.name + '」是精英，改为自动躲避。')
          return
        }
        api.test(inv.seat, 'intellect', 3 + (enemy.horror || 0), {
          source: { label: '劝服', enemyId: enemy.id, name: enemy.name, code: '04105' },
          resolve: result => {
            if (!result.success) return
            api.removeEnemy(enemy)
            api.shuffleIntoEncounterDeck(enemy.code)
            api.info('「' + enemy.name + '」被劝服并洗回遭遇牌库。')
          },
        })
      },
    }],
  },
  // 04234 献祭：弃掉一张秘术支援，分配 3 点（抽牌 / 资源）。
  {
    code: '04234',
    abilities: [{
      kind: 'played', label: '献祭',
      resolve: ({ state, inv, api }) => {
        const spells = inv.assets.filter(card => api.cardFactions(card.code).includes('mystic'))
        if (!spells.length) { api.info('没有可献祭的秘术支援。'); return }
        const chosen = spells.length === 1 ? spells[0].id
          : api.choice({ kind: 'target', source: '04234', seat: inv.seat, prompt: '选择要献祭的秘术支援。',
            options: spells.map(card => ({ id: card.id, label: api.cardName(card.code) })) })
        const card = spells.find(item => item.id === chosen) || spells[0]
        api.discardAsset(inv.seat, card)
        const split = api.choice({ kind: 'effect', source: '04234', seat: inv.seat,
          prompt: '分配 3 点：抽牌与资源。',
          options: [
            { id: '3-0', label: '抽 3 张牌' },
            { id: '2-1', label: '抽 2 张牌、获得 1 资源' },
            { id: '1-2', label: '抽 1 张牌、获得 2 资源' },
            { id: '0-3', label: '获得 3 资源' },
          ] })
        const [drawCount, resources] = String(split || '3-0').split('-').map(Number)
        if (drawCount) api.drawCards(inv.seat, drawCount)
        if (resources) api.gainResources(inv.seat, resources)
        api.info(`${inv.name} 献祭「${api.cardName(card.code)}」：抽 ${drawCount} 张、获得 ${resources} 资源。`)
      },
    }],
  },
]

// ---- Phase 5（5c-6）：Carcosa / TFA 检定与目标选择类（handler → resolve）----
export const MIGRATED_ESCAPE_ENTRIES_5C6 = [
  // 03147 双刃短刀：攻击同地点的敌人，战斗值 + 已交战敌人数。
  {
    code: '03147',
    abilities: [{
      kind: 'action', label: '双刃短刀攻击', cost: { action: true }, countsAs: 'fight',
      resolve: ({ state, inv, api }) => {
        const targets = state.enemies.filter(enemy => enemy.location === inv.location)
        if (!targets.length) { api.info('这里没有可攻击的敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'enemy', source: '03147', seat: inv.seat, prompt: '选择敌人目标。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        const engaged = state.enemies.filter(item => item.engagedSeat === inv.seat).length
        api.fight(inv.seat, enemy.id, { combatBonus: engaged })
      },
    }],
  },
  // 03230 急救：治疗同地点一名调查员或盟友最多 1 点伤害与 1 点恐惧。
  {
    code: '03230', uses: 4, usesType: 'supplies', discardWhenEmpty: true,
    abilities: [{
      kind: 'action', label: '急救治疗伤害和恐惧', cost: { action: true, uses: 1 },
      resolve: ({ state, inv, api }) => {
        const targets = api.investigatorsAt(inv.location)
        const allies = targets.flatMap(owner => (state.investigators[owner.seat]?.assets || [])
          .filter(card => api.cardTraits(card.code).some(trait => String(trait).toLowerCase() === 'ally')))
        const options = [
          ...targets.map(owner => ({ id: 'inv:' + owner.seat, label: owner.name })),
          ...allies.map(card => ({ id: 'asset:' + card.id, label: api.cardName(card.code) })),
        ]
        if (!options.length) return
        const answer = options.length === 1 ? options[0].id
          : api.choice({ kind: 'target', source: '03230', seat: inv.seat,
            prompt: '选择治疗目标（调查员或盟友资产）。', options })
        if (String(answer).startsWith('asset:')) {
          const card = allies.find(item => 'asset:' + item.id === answer)
          if (card) api.healAsset(card, { damage: 1, horror: 1 })
          return
        }
        const seat = Number(String(answer).slice(4))
        api.healDamage(seat, 1)
        api.healHorror(seat, 1)
      },
    }],
  },
  // 03273 幸存者：至多 3 次，把弃牌堆里的天生技能牌返回手牌。
  {
    code: '03273',
    abilities: [{
      kind: 'played', label: '幸存者',
      resolve: ({ inv, api }) => {
        const candidates = inv.discard.filter(code => api.cardType(code) === 'skill'
          && api.cardTraits(code).some(trait => String(trait).toLowerCase() === 'innate'))
        for (let count = 0; count < 3 && candidates.length; count++) {
          const chosen = api.choice({ kind: 'card', source: '03273', seat: inv.seat, prompt: '选择返回手牌的天生技能。',
            options: candidates.map((item, index) => ({ id: String(index), cardCode: item, label: api.cardName(item) })) })
          const index = Number(chosen)
          const picked = candidates.splice(Number.isInteger(index) ? index : 0, 1)[0]
          if (!picked) break
          api.moveCard({ code: picked, from: 'discard', to: 'hand' })
        }
      },
    }],
  },
  // 03309 短管猎枪：攻击同地点的敌人；本回合入场的 +2/+2，否则 +1/+1。
  {
    code: '03309', uses: 2, usesType: 'ammo', noOpportunityAttack: true,
    abilities: [{
      kind: 'action', label: '短管猎枪攻击', cost: { action: true, uses: 1 }, countsAs: 'fight',
      resolve: ({ state, inv, source, api }) => {
        const targets = state.enemies.filter(enemy => enemy.location === inv.location)
        if (!targets.length) { api.info('这里没有可攻击的敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'enemy', source: '03309', seat: inv.seat, prompt: '选择敌人目标。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        const fresh = source?.enteredRound === state.round
        api.fight(inv.seat, enemy.id, { combatBonus: fresh ? 2 : 1, damageBonus: fresh ? 2 : 1 })
      },
    }],
  },
  // 04027 窃听：对抗一名未交战敌人的躲避值；成功发现 2 个线索。
  {
    code: '04027',
    abilities: [{
      kind: 'played', label: '窃听',
      resolve: ({ state, inv, api }) => {
        const targets = state.enemies.filter(enemy => enemy.location === inv.location && enemy.engagedSeat == null)
        if (!targets.length) { api.info('这里没有未交战的敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '04027', seat: inv.seat, prompt: '选择要窃听的敌人。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        api.test(inv.seat, 'intellect', api.enemyEvade(enemy), {
          source: { label: '窃听', enemyId: enemy.id, name: enemy.name, code: '04027' },
          resolve: result => { if (result.success) api.discoverClue(inv.seat, 2) },
        })
      },
    }],
  },
  // 04273 旧霰弹枪：战斗 +3 的攻击；揭示骷髅或自动失败则卡膛，成功造成 2 点伤害。
  {
    code: '04273', uses: 3, usesType: 'ammo',
    abilities: [{
      kind: 'action', label: '花费 1 子弹：攻击（战斗 +3，伤害 +2）', cost: { action: true, uses: 1 },
      countsAs: 'fight',
      resolve: ({ state, inv, api }) => {
        const targets = state.enemies.filter(enemy => enemy.location === inv.location)
        if (!targets.length) { api.info('这里没有可攻击的敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '04273', seat: inv.seat, prompt: '选择攻击目标。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        api.test(inv.seat, 'combat', api.enemyFight(enemy), {
          source: { label: '攻击', enemyId: enemy.id, name: enemy.name, code: enemy.originalCode || enemy.code },
          skillBonus: 3,
          resolve: result => {
            if ((result.drawn || []).some(token => token === 'skull' || token === 'autofail')) {
              api.info('💥 「' + api.cardName('04273') + '」卡膛，本次攻击自动失败。')
              return
            }
            if (!result.success) return
            api.damageEnemy(enemy, 2, inv.seat)
          },
        })
      },
    }],
  },
]

// ---- Phase 5（5b-6c）：core / Carcosa / TFA 剩余反应（含混合卡）----
export const MIGRATED_REACTION_ENTRIES_5B6C = [
  // 01012 传家宝：打出法术卡后抽 1 张。
  {
    code: '01012',
    abilities: [{
      kind: 'reaction', trigger: 'spellPlayed', id: 'heirloom', legacyReaction: true,
      label: '打出法术卡后抽 1 张', effect: { type: 'draw', amount: 1 },
    }],
  },
  // 01046 扒手：躲避成功后横置抽 1 张。
  {
    code: '01046',
    abilities: [{
      kind: 'reaction', trigger: 'evadeSuccess', id: 'pickpocketing', legacyReaction: true,
      label: '躲避成功后抽 1 张', cost: { exhaust: true }, effect: { type: 'draw', amount: 1 },
    }],
  },
  // 01073 拾荒：调查成功超出 2 点时横置，从弃牌堆检索 1 张物品。
  {
    code: '01073',
    abilities: [{
      kind: 'reaction', trigger: 'investigateSuccess', id: 'scavenging', legacyReaction: true,
      criteria: { successByAtLeast: 2 }, label: '调查成功超出 2 点时检索物品',
      cost: { exhaust: true }, effect: { type: 'searchDiscard', trait: 'Item', choose: 1 },
    }],
  },
  // 01075 兔脚：检定失败后横置抽 1 张。
  {
    code: '01075',
    abilities: [{
      kind: 'reaction', trigger: 'skillTestFail', id: 'rabbitsFoot', legacyReaction: true,
      label: '检定失败后抽 1 张', cost: { exhaust: true }, effect: { type: 'draw', amount: 1 },
    }],
  },
  // 03024 田野调查：移动后（本地点有线索）横置，本阶段下一次技能检定 +2。
  // 5c-18：不再走 carcosaPlayer 逃生原语，改成 api.phaseTestBonus（读点仍是 performTest 的
  // inv.fieldwork，行为与迁移前一致）。
  {
    code: '03024',
    abilities: [{
      kind: 'reaction', trigger: 'move', id: 'fieldwork', legacyReaction: true,
      criteria: { requiresClue: true }, label: '移动后本阶段下一次技能检定 +2',
      cost: { exhaust: true },
      resolve: ({ inv, api }) => { api.phaseTestBonus(inv.seat, 2) },
    }],
  },
  // 03195 扒手（Carcosa 版）：快速；躲避成功后横置，抽 1 张或获得 1 资源（超出 2 点时两者都做）。
  // 5c-18：抽屉选择、抽牌日志与资源都由 ctx.api 结算，引擎不再认识这张卡。
  {
    code: '03195', fast: true,
    abilities: [{
      kind: 'reaction', trigger: 'evadeSuccess', id: 'pickpocketing', legacyReaction: true,
      label: '躲避成功后抽 1 张或获得 1 资源', cost: { exhaust: true },
      resolve: ({ inv, api }) => {
        const successBy = api.reactionContext()?.successBy || 0
        const answer = successBy >= 2 ? 'both' : api.choice({ kind: 'effect', source: '03195', seat: inv.seat,
          prompt: '选择抽1张牌或获得1资源。',
          options: [{ id: 'draw', label: '抽1张牌' }, { id: 'resource', label: '获得1资源' }] })
        if (answer === 'draw' || answer === 'both') api.drawCardsLogged(inv.seat, 1)
        if (answer === 'resource' || answer === 'both') api.gainResources(inv.seat, 1)
      },
    }],
  },
  // 03268 暗示：主动躲避能力 + 取消非精英敌人攻击的反应（消耗充能）。
  // 5c-26：主动能力不再走 carcosaPlayer 逃生原语。**顺带修了一个既有 bug**：
  // 旧原语把空 effect 传给 chooseEnemy，而 abilityTargets({}) 恒为空 → 一用就抛
  // 「没有合法敌人目标」。现在按躲避的目标形状（交战中的敌人）选目标，并先挡掉无目标的情况。
  {
    code: '03268', uses: 3, usesType: 'charges',
    abilities: [
      {
        kind: 'action', label: '建议躲避', cost: { action: true, exhaust: true },
        resolve: ({ inv, source, api }) => {
          const engaged = api.enemiesAt(inv.location).filter(item => item.engagedSeat === inv.seat)
          if (!engaged.length) { api.info('你没有可建议躲避的交战敌人。'); return }
          const enemy = api.chooseEnemy(inv.seat, { type: 'evade' })
          if (!enemy) return
          api.evade(inv.seat, { enemyId: enemy.id, addSkill: 'willpower', suggestionAssetId: source?.id })
        },
      },
      {
        kind: 'reaction', trigger: 'enemyAttack', id: 'suggestionCancel', legacyReaction: true,
        criteria: { nonEliteOnly: true }, label: '取消非精英敌人的攻击',
        cost: { uses: 1 }, effect: { type: 'cancelEnemyAttack' },
      },
    ],
  },
  // 03305 阿登森林护甲：伤害分配到自身时横置，抵消 1 点伤害。
  // 5c-18：抵消走 api.cancelDamage（与旧原语的接线点相同：优先写 reaction.context.cancelDamage）。
  {
    code: '03305',
    abilities: [{
      kind: 'reaction', trigger: 'damageAssignedToSelf', id: 'armorArdennes', legacyReaction: true,
      label: '抵消 1 点伤害', cost: { exhaust: true },
      resolve: ({ api }) => { api.cancelDamage(1) },
    }],
  },
  // 04017 求生刀：主动攻击（战斗 +1）+ 敌人攻击造成伤害时反击。
  {
    code: '04017',
    abilities: [
      {
        kind: 'action', label: '攻击（战斗 +1）', cost: { action: true },
        effect: { type: 'fight', combatBonus: 1, damageBonus: 0 },
      },
      {
        // 5c-31：不再走 tfaPlayer 逃生原语；攻击者从反应上下文的 `enemy` 取（与旧原语同一个字段）。
        kind: 'reaction', trigger: 'enemyAttackDamage', id: 'survivalKnife', legacyReaction: true,
        criteria: { selfOnly: true }, label: '敌人攻击造成伤害时反击',
        cost: { exhaust: true },
        resolve: ({ inv, api }) => {
          const attacker = api.reactionContext()?.enemy
          if (!attacker || !api.isEnemyInPlay(attacker)) return
          api.fight(inv.seat, attacker.id, { combatBonus: 2, damageBonus: 1, noSpend: true })
        },
      },
    ],
  },
  // 04158 追忆未来：检定开始时指定一个混乱标记（命中时横置并 +2）。
  // 5c-18：指定标记走 api.nameChaosToken；「命中后横置 +2」的读点仍在引擎的标记揭示段。
  {
    code: '04158',
    abilities: [{
      kind: 'reaction', trigger: 'testBegins', id: 'recallTheFuture', legacyReaction: true,
      criteria: { selfOnly: true }, label: '检定开始时指定混乱标记',
      resolve: ({ inv, source, api }) => { api.nameChaosToken(inv.seat, { asset: source }) },
    }],
  },
  // 04159 再试一次：检定失败后横置并消耗 1 次，取回投入的技能卡。
  // 5c-18：候选与归还走 api.recallCommittedSkill（提示文案与询问来源沿用旧原语）。
  {
    code: '04159', uses: 3, usesType: 'tries', discardWhenEmpty: true,
    abilities: [{
      kind: 'reaction', trigger: 'skillTestFail', id: 'tryAndTryAgain', legacyReaction: true,
      criteria: { selfOnly: true }, label: '检定失败后取回投入的技能卡',
      cost: { exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => { api.recallCommittedSkill(inv.seat, { source: '04159' }) },
    }],
  },
  // 04200 学无止境：快速；检定失败后重试（+2）。
  {
    code: '04200', fast: true,
    abilities: [{
      kind: 'played', fast: true, trigger: 'skillTestFailed', id: 'liveAndLearn', legacyReaction: true,
      criteria: { selfOnly: true }, label: '重新尝试上一次失败的技能检定（+2）',
      resolve: ({ api }) => api.retryLastFailedTest('学无止境', 2),
    }],
  },
  // 04197 奥利芙·麦克布莱德：揭示混乱标记时横置，揭示 3 个选 2 个。
  {
    code: '04197',
    abilities: [{
      kind: 'reaction', trigger: 'tokenReveal', id: 'oliveMcBride', legacyReaction: true,
      criteria: { selfOnly: true }, label: '揭示标记时多揭示并挑选',
      cost: { exhaust: true },
      // Phase 5（5c-11）：不再走 tfaPlayer 逃生原语，改为直接声明「揭示计划」。
      resolve: ({ api }) => {
        api.planTestReveal({ count: 3, choose: 2, source: '04197' })
        api.info('「奥利芙·麦克布莱德」：改为揭示 3 个混乱标记并选择 2 个结算。')
      },
    }],
  },
  // 04312 临时屏障：快速；躲避交战敌人（-1）；从弃牌堆打出时可额外躲避第二个敌人。
  {
    code: '04312', fast: true, playableFromDiscard: true, shuffleBackAfterPlay: true,
    abilities: [{
      kind: 'played', fast: true, id: 'impromptuBarrier', label: '躲避一名交战敌人（-1）',
      resolve: ({ state, inv, api }) => {
        const fromDiscard = api.fromDiscardCode() === '04312'
        const targets = state.enemies.filter(enemy => enemy.engagedSeat === inv.seat
          || (enemy.massive && enemy.location === inv.location))
        if (!targets.length) { api.info('没有可躲避的交战敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id : api.choice({ kind: 'target', source: '04312',
          seat: inv.seat, prompt: '选择要躲避的敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        api.evade(inv.seat, { enemyId: enemy.id, evadeModifier: -1,
          evadeSecondUpTo: fromDiscard ? Number.MAX_SAFE_INTEGER : 0 })
      },
    }],
  },
  // 04265 手铐：对同地点人形敌人做战斗检定（难度 = 其躲避值），成功则横置并铐住。
  {
    code: '04265',
    abilities: [{
      kind: 'action', label: '躲向并铐住人形敌人', countsAs: 'evade', cost: { action: true },
      resolve: ({ state, inv, api }) => {
        const targets = state.enemies.filter(enemy => enemy.location === inv.location
          && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'humanoid'))
        if (!targets.length) { api.info('这里没有可铐住的人形敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id : api.choice({ kind: 'target', source: '04265',
          seat: inv.seat, prompt: '选择要铐住的敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        api.startTest({
          skill: 'combat', difficulty: Math.max(0, api.enemyEvade(enemy, inv.seat)), seat: inv.seat,
          source: { label: '手铐', enemyId: enemy.id, name: enemy.name, code: '04265' },
          resolve: result => {
            if (!result.success) return
            api.attachSelfTo('04265', enemy.id)
            api.info(`「${enemy.name}」被手铐铐住：不能重整，也不能放置毁灭。`)
          },
        })
      },
    }],
  },
  // 04024 发掘古物：智识检定（难度 = 支援费用），成功后把该探求者支援直接放置入场（遗物再抽 1 张）。
  {
    code: '04024',
    abilities: [{
      kind: 'played', id: 'unearthTheAncients', label: '发掘古物',
      resolve: ({ inv, api }) => {
        const candidates = inv.hand.filter(code => api.cardType(code) === 'asset'
          && api.cardFactions(code).includes('seeker'))
        if (!candidates.length) { api.info('手中没有可发掘的探求者支援。'); return }
        const chosen = candidates.length === 1 ? candidates[0] : api.choice({ kind: 'target', source: '04024',
          seat: inv.seat, prompt: '选择要放置入场的探求者支援。',
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })) })
        api.startTest({
          skill: 'intellect', difficulty: api.cardCost(chosen), seat: inv.seat,
          source: { label: '发掘古物', code: '04024' },
          resolve: result => {
            if (!result.success) return
            if (!api.putAssetIntoPlay(inv.seat, chosen)) return
            api.info(`「${api.cardName(chosen)}」被直接放置入场。`)
            if (api.cardTraits(chosen).includes('relic')) api.drawCards(inv.seat, 1)
          },
        })
      },
    }],
  },
  // 03238 幸运邂逅：从弃牌堆把一名盟友放进场。
  {
    code: '03238',
    abilities: [{
      kind: 'played', id: 'chanceEncounter2', label: '从弃牌堆招募一名盟友',
      resolve: ({ inv, api }) => { api.recruitAllyFromDiscard(inv.seat) },
    }],
  },
  // 04156 挥金如土：本次检定 +2；成功后返还 3 资源。
  {
    code: '04156',
    abilities: [{
      kind: 'played', id: 'extravagance', label: '本次检定 +2，成功后返还 3 资源',
      resolve: ({ api }) => {
        api.addTestPendingBonus(2)
        api.addExtraOnSuccess({ type: 'gainResource', amount: 3 })
      },
    }],
  },
  // 03023 时刻警惕：最多 3 次，每次以 -1 费打出一张支援。
  {
    code: '03023',
    abilities: [{
      kind: 'played', id: 'everVigilant', label: '连续打出最多 3 张支援（每张 -1 费）',
      resolve: ({ inv, api }) => {
        for (let count = 0; count < 3; count++) {
          const candidates = inv.hand.filter(code => api.cardType(code) === 'asset'
            && inv.resources >= Math.max(0, api.playCost(inv.seat, code) - 1))
          if (!candidates.length) break
          const answer = api.choice({ kind: 'card', source: '03023', seat: inv.seat, canSkip: true,
            prompt: `选择要打出的支援（还可打出 ${3 - count} 张；每张费用-1）。`,
            options: [{ id: 'done', label: '完成' },
              ...candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) }))] })
          if (answer === 'done') break
          api.playCard(inv.seat, answer, { discount: 1, noAction: true })
        }
      },
    }],
  },
  // 03029 障眼戏法：把一张物品支援免费放置入场（本回合它不算"打出"）。
  {
    code: '03029',
    abilities: [{
      kind: 'played', id: 'sleightOfHand', label: '免费放置一张物品支援',
      resolve: ({ inv, api }) => {
        const candidates = inv.hand.filter(code => api.cardType(code) === 'asset'
          && api.cardTraits(code).includes('item'))
        if (!candidates.length) return
        const code = api.choice({ kind: 'card', source: '03029', seat: inv.seat,
          prompt: '选择一件物品支援放置入场。',
          options: candidates.map(item => ({ id: item, cardCode: item, label: api.cardName(item) })) })
        api.playCard(inv.seat, code, { discount: api.playCost(inv.seat, code), noAction: true })
        api.markSleightOfHand(code)
      },
    }],
  },
  // 03032 炼金转化：意志检定(1)，按成功点数获得资源（最多 3）；揭示符号标记则受 1 点伤害。
  {
    code: '03032', uses: 3, usesType: 'charges',
    abilities: [{
      kind: 'action', label: '炼金转化', cost: { action: true, exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => {
        api.startTest({
          skill: 'willpower', difficulty: 1, seat: inv.seat,
          source: { label: '支援能力', code: '03032' },
          resolve: result => {
            if (result.success) api.gainResources(inv.seat, Math.min(3, result.value - result.difficulty))
            if ((result.drawn || []).some(token => ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token))) {
              api.harm(inv.seat, { damage: 1 })
            }
          },
        })
      },
    }],
  },
  // 04267 养神术：意志检定(0)，按成功点数抽牌，再按超出手牌上限受恐惧。
  {
    code: '04267', uses: 3, usesType: 'secrets', discardWhenEmpty: true,
    abilities: [{
      kind: 'action', label: '养神', cost: { action: true, exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => {
        api.startTest({
          skill: 'willpower', difficulty: 0, seat: inv.seat,
          source: { label: '养神术', code: '04267' },
          resolve: result => {
            if (!result.success) return
            api.drawCards(inv.seat, Math.max(0, result.value))
            const overflow = Math.max(0, (inv.hand || []).length - api.handSize(inv.seat))
            if (overflow) api.applyHorror(inv.seat, overflow)
          },
        })
      },
    }],
  },
  // 04307 潘诺蒂克启示录：主动能力（花 1 秘密）+ 显现检定前的强制跳过（消耗秘密）。
  {
    code: '04307', uses: 3, usesType: 'secrets',
    abilities: [
      {
        kind: 'action', label: '花费 1 秘密：本回合该调查员下次检定不揭示标记',
        cost: { action: false, uses: 1 },
        // Phase 5（5c-12）：不再走 tfaPlayer 逃生原语。
        resolve: ({ inv, api }) => { api.skipNextTestTokens(inv.seat) },
      },
      {
        kind: 'reaction', trigger: 'revelationTest', id: 'pnakoticRevelation', legacyReaction: true,
        label: '显现检定前跳过', cost: { uses: 1 },
        resolve: ({ api }) => { api.skipTestTokens() },
      },
    ],
  },
]

// ---- Phase 5（5b-6b）：core / Dunwich / TFA 纯数据反应（同一条旧式结算流程）----
export const MIGRATED_REACTION_ENTRIES_5B6B = [
  // 01021 护卫犬：与敌人交战时支援受伤，反击 1 点伤害。
  {
    code: '01021',
    abilities: [{
      kind: 'reaction', trigger: 'enemyAttackDamage', id: 'guardDog', legacyReaction: true,
      criteria: { requiresAssetDamage: true }, label: '支援受伤时反击 1 点伤害',
      effect: { type: 'dealDamage', amount: 1 },
    }],
  },
  // 01032 研究馆员：入场后从牌库顶找 1 张书籍支援。
  {
    code: '01032',
    abilities: [{
      kind: 'reaction', trigger: 'assetEnteredPlay', id: 'researchLibrarian', legacyReaction: true,
      criteria: { assetCode: '01032' }, label: '入场后检索 1 张书籍',
      effect: { type: 'searchTop', amount: 999, trait: 'Tome', choose: 1 },
    }],
  },
  // 01033 米兰·克里斯托弗博士：调查成功后获得 1 资源（被动 +1 智识）。
  {
    code: '01033',
    modifiers: [{ target: 'skill:intellect', amount: 1 }],
    abilities: [{
      kind: 'reaction', trigger: 'investigateSuccess', id: 'milan', legacyReaction: true,
      label: '调查成功后获得 1 资源', effect: { type: 'gainResource', amount: 1 },
    }],
  },
  // 01041 伊察姆纳圆盘：非精英敌人生成时弃掉自身并击败它。
  {
    code: '01041',
    abilities: [{
      kind: 'reaction', trigger: 'enemySpawn', id: 'discOfItzamna', legacyReaction: true,
      criteria: { nonElite: true }, label: '敌人生成时弃置自身并击败它', cost: { discardSelf: true },
      effect: { type: 'defeatNonEliteEnemy', target: 'here' },
    }],
  },
  // 02269 金色宝石：揭示标记后横置，二选一（抽牌 / 获得 2 资源）。
  {
    code: '02269',
    abilities: [{
      kind: 'reaction', trigger: 'symbolRevealed', id: 'jewelAureolus', legacyReaction: true,
      criteria: { symbols: ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'] },
      label: '揭示标记后横置：抽牌或获得 2 资源', cost: { exhaust: true },
      effect: { type: 'chooseOne', options: [
        { label: '抽牌', effect: { type: 'draw', amount: 1 } },
        { label: '获得资源', effect: { type: 'gainResource', amount: 2 } },
      ] },
    }],
  },
  // 02308 阿奎娜：敌人攻击时横置并受 1 点恐惧，把攻击转移给同地点的敌人。
  {
    code: '02308',
    abilities: [{
      kind: 'reaction', trigger: 'enemyAttack', id: 'aquinnah', legacyReaction: true,
      label: '敌人攻击时转移攻击', cost: { exhaust: true, horror: 1 },
      effect: { type: 'aquinnahRedirect' },
    }],
  },
  // 04107 幸运箱：调查成功且超出 2 点时横置抽 1 张（每轮一次）。
  {
    code: '04107',
    abilities: [{
      kind: 'reaction', trigger: 'investigateSuccess', id: 'luckyCase', legacyReaction: true,
      criteria: { successByAtLeast: 2 }, limit: 'oncePerRound', label: '调查成功超出 2 点时抽 1 张',
      cost: { exhaust: true }, effect: { type: 'draw', amount: 1 },
    }],
  },
]

// 03026 / 03307 共用：选择同地点一名调查员并搜索其牌库（amount 为 'all' 时搜索整个牌库）。
// 询问与检索的 source 保持旧原语的 'noStoneUnturned'，日志与存档字段因此不变。
function searchInvestigatorDeck(inv, api, amount, state = null) {
  const targets = api.investigatorsAt(inv.location)
  if (!targets.length) return
  const targetSeat = targets.length === 1 ? targets[0].seat
    : Number(api.choice({ kind: 'investigator', source: 'noStoneUnturned', seat: inv.seat,
      prompt: '选择要搜索牌库的调查员。',
      options: targets.map(other => ({ id: String(other.seat), label: other.name })) }))
  api.searchTop(targetSeat, {
    amount: amount === 'all' ? (state?.investigators?.[targetSeat]?.deck?.length ?? 0) : amount,
    source: 'noStoneUnturned',
  })
}

// 03038 / 03148 / 03199 / 03232 共用的「选择附属地点」：候选集合与旧实现一致
// （藏身地点可以是任一已揭示地点，其余只能附属到所在地点），询问文案逐字保留。
function attachToChosenLocation(state, inv, api, { code, source, revealedOnly = false }) {
  const locations = revealedOnly
    ? state.locations.filter(location => location.revealed)
    : state.locations.filter(location => location.id === inv.location)
  if (!locations.length) return null
  const locationId = locations.length === 1 ? locations[0].id
    : api.choice({ kind: 'location', source, seat: inv.seat, prompt: '选择附加地点。',
      options: locations.map(location => ({ id: location.id, label: api.locationName(location.id) })) })
  return api.attachToLocation(locationId, { code, ownerSeat: inv.seat })
}

// 04274 的「创伤 2 点以上治疗 2 点」：战役创伤在 state.campaign.trauma 上。
function healWithTrauma(state, inv, api, kind) {
  const traumaKey = kind === 'damage' ? 'physical' : 'mental'
  const targets = api.investigatorsAt(inv.location)
  if (!targets.length) return
  const chosen = targets.length === 1 ? String(targets[0].seat)
    : api.choice({ kind: 'target', source: '04274', seat: inv.seat, prompt: '选择要治疗的调查员。',
      options: targets.map(owner => ({ id: String(owner.seat), label: owner.name })) })
  const target = state.investigators[Number(chosen)] || inv
  const trauma = state.campaign?.trauma?.[target.seat]?.[traumaKey] || 0
  const amount = trauma >= 2 ? 2 : 1
  if (kind === 'damage') api.healDamage(target.seat, amount)
  else api.healHorror(target.seat, amount)
  api.info(`${target.name} 治疗 ${amount} 点${kind === 'damage' ? '伤害' : '恐惧'}。`)
}

// 04005 加尔文·怀特：每点恐惧使意志/智识 +1，每点伤害使战斗/敏捷 +1。
// （原来是 engine.getStat 里的 statsPerHarm 分支，现改为声明式修正；参数仍读数据表。）
const CALVIN_ENTRY = {
  code: '04005',
  modifiers: ['willpower', 'intellect', 'combat', 'agility'].map(skill => ({
    target: `skill:${skill}`,
    amount: ({ controller }) => {
      const per = INVESTIGATOR_ABILITIES['04005']?.statsPerHarm || {}
      return (controller?.horror || 0) * (per.horror?.[skill] || 0)
        + (controller?.damage || 0) * (per.damage?.[skill] || 0)
    },
  })),
}

// ---------------------------------------------------------------------------
// 5c-19：Carcosa 事件卡的逃生原语改写（求助盟友）
// ---------------------------------------------------------------------------
//
// 与 5c-18 同一个套路：先把 effect 数据体换成 resolve，再删引擎里那段
// `effect.action === 'callingInFavors'`（它对 `carcosaPlayer` 逃生通道的实现）。

export const MIGRATED_ESCAPE_ENTRIES_5C19 = [
  // 03158 求助盟友：把一个盟友拿回手牌，再从牌库顶 9 张找一张盟友（费用按返回那张减免）。
  {
    code: '03158',
    abilities: [{
      kind: 'played', label: '把盟友返回手牌，再从牌库顶 9 张免费打出 1 张盟友',
      resolve: ({ inv, api }) => {
        const allies = inv.assets.filter(card => api.cardTraits(card.code).includes('ally'))
        if (!allies.length) return
        const chosenId = allies.length === 1 ? allies[0].id : api.choice({ kind: 'target', source: '03158',
          seat: inv.seat, prompt: '选择返回手牌的盟友。',
          options: allies.map(card => ({ id: card.id, cardCode: card.code, label: api.cardName(card.code) })) })
        const ally = allies.find(card => card.id === chosenId)
        if (!ally) return
        const discount = api.cardCost(ally.code)
        api.returnAssetToHand(inv.seat, ally)
        const before = inv.hand.length
        api.searchTop(inv.seat, { amount: 9, trait: 'Ally', source: '03158' })
        if (inv.hand.length > before) {
          api.playCard(inv.seat, inv.hand.at(-1), { discount, noAction: true })
        }
      },
    }],
  },
]

// ---------------------------------------------------------------------------
// 5c-20：牌库顶/弃牌堆两区查找（走私货物）+ 条目级打出限制
// ---------------------------------------------------------------------------
//
// 04010 的旧条目还带 `playRestriction: 'noReadyEnemy'`——它由引擎的 cardPlayBlockedReason 读，
// **不走 playCondition**（legalMoves 不检查 playCondition，改成后者会让卡片在有敌人时也出现在
// 合法动作里）。所以先给条目加同名字段与读点回落，再迁这张卡。

export const MIGRATED_ESCAPE_ENTRIES_5C20 = [
  // 04010 走私货物：查找牌库顶 9 张或弃牌堆中的[[违法]]卡，加入手牌。
  {
    code: '04010',
    playRestriction: 'noReadyEnemy',
    abilities: [{
      kind: 'played', label: '查找牌库顶 9 张或弃牌堆中的违法卡',
      resolve: ({ inv, api }) => {
        const illicit = code => api.cardTraits(code).some(trait => ['illicit', '违法'].includes(trait))
        const options = [{ id: 'deck', label: '查看牌库顶 9 张' }]
        if (inv.discard.some(illicit)) options.push({ id: 'discard', label: '查看弃牌堆' })
        const zone = api.choice({ kind: 'effect', source: '04010', seat: inv.seat,
          prompt: '走私货物：选择查找的区域。', options })
        if (zone === 'discard') {
          const matches = [...new Set(inv.discard.filter(illicit))]
          if (!matches.length) return
          const chosen = api.choice({ kind: 'target', source: '04010', seat: inv.seat,
            prompt: '选择加入手牌的违法卡。',
            options: matches.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })) })
          api.moveCard({ code: chosen, from: 'discard', to: 'hand' })
          api.info(`${inv.name} 从弃牌堆找回了「${api.cardName(chosen)}」。`)
          return
        }
        api.searchTop(inv.seat, { amount: 9, trait: 'Illicit', traitZh: '违法', source: '04010', mandatory: true })
      },
    }],
  },
]

// ---------------------------------------------------------------------------
// 5c-21：以折扣打出另一张牌（解锢灵魂）
// ---------------------------------------------------------------------------

export const MIGRATED_ESCAPE_ENTRIES_5C21 = [
  // 03033 解锢灵魂：选择一张法术/仪式，以费用 -3、不花行动打出。
  // 候选筛选里的「有没有合法目标」由 api.cardHasLegalTarget 提供（与 effectError 同源），
  // 否则会把手上有需要敌人的事件卡也列出来，选中后白打一张。
  {
    code: '03033',
    abilities: [{
      kind: 'played', label: '费用 -3 打出一张法术或仪式',
      resolve: ({ inv, api }) => {
        const candidates = inv.hand.filter(code => api.cardTraits(code).some(trait => ['spell', 'ritual'].includes(trait))
          && api.cardHasLegalTarget(inv.seat, code))
        if (!candidates.length) { api.info('没有可折扣打出的法术或仪式。'); return }
        const chosen = api.choice({ kind: 'card', source: '03033', seat: inv.seat,
          prompt: '选择要以费用-3打出的法术或仪式。',
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })) })
        api.playCard(inv.seat, chosen, { discount: 3, noAction: true })
      },
    }],
  },
]

// ---------------------------------------------------------------------------
// 5a-5：卡号分支第一次搬成「条目级被动标记」（03010 分析性思维）
// ---------------------------------------------------------------------------
//
// 引擎原来写死 `asset.code === '03010'`（检定只投入 1 张牌时横置它抽 1 张）。
// 现在改为读条目 passive 上的声明式标记：`registeredEntry(code)?.passive?.analyticalMind`。
// 读点仍只有一处，行为不变——这是 5a「先补读点、再删分支」的最小样例。

export const MIGRATED_CARD_RULE_ENTRIES_5A5 = [
  {
    code: '03010',
    // remoteCommit 是旧数据里的另一项被动（引擎当前没有读点），随条目原样保留。
    passive: { analyticalMind: true, remoteCommit: true },
  },
]

// ---------------------------------------------------------------------------
// 5c-22：反应窗口里的快速事件（预警）
// ---------------------------------------------------------------------------

export const MIGRATED_ESCAPE_ENTRIES_5C22 = [
  // 03150 预警：刚抽到诡计时快速打出——花 1 个线索（放回所在地点）取消它。
  // 旧 handler 不打日志，这里也不打（日志进 state.log = 进指纹）。
  {
    code: '03150',
    abilities: [{
      kind: 'played', fast: true, trigger: 'encounterDrawn',
      criteria: { nonWeaknessOnly: true, treacheryOnly: true },
      label: '花 1 个线索取消刚抽到的诡计',
      resolve: ({ inv, api }) => {
        api.spendClueToLocation(inv.seat, 1)
        api.cancelCurrentAttack()
      },
    }],
  },
]

// ---------------------------------------------------------------------------
// 5c-23：遭遇牌库检索（追猎）
// ---------------------------------------------------------------------------

export const MIGRATED_ESCAPE_ENTRIES_5C23 = [
  // 03263 追猎：刚抽到遭遇卡时快速打出——从遭遇牌库顶 9 张里选一名敌人，在所在地点生成并交战。
  // 没有敌人候选时按旧实现回落成「正常抽一张遭遇卡」。
  {
    code: '03263',
    abilities: [{
      kind: 'played', fast: true, trigger: 'encounterDrawn',
      criteria: { ownMythosOnly: true },
      label: '从遭遇牌库顶 9 张里找一名敌人生成并交战',
      resolve: ({ inv, api }) => {
        const candidates = api.encounterEnemies(9)
        if (!candidates.length) { api.drawEncounter(inv.seat); return }
        const chosen = candidates.length === 1 ? candidates[0] : api.choice({ kind: 'enemy', source: '03263',
          seat: inv.seat, prompt: '从遭遇牌库顶 9 张中选择 1 名敌人生成。',
          options: candidates.map((code, index) => ({ id: String(index), cardCode: code, label: api.cardName(code) })) })
        const picked = candidates[Number(chosen)] || candidates[0]
        api.spawnEncounterEnemy(inv.seat, picked)
      },
    }],
  },
]

// ---------------------------------------------------------------------------
// 5c-24：打出后变成场上卡 + 封印标记（危险预感）
// ---------------------------------------------------------------------------

export const MIGRATED_ESCAPE_ENTRIES_5C24 = [
  // 04199 危险预感：快速事件——把这张牌放到场上，封印一个随机混乱标记；
  // 之后本次检定改为结算封印的那个标记，卡片随后被弃掉（读点在引擎的揭示段）。
  {
    code: '04199',
    substituteSealedToken: true,
    abilities: [{
      kind: 'played', fast: true, becomesAsset: true,
      label: '放入场并封印一个随机混乱标记',
      resolve: ({ inv, api }) => {
        const asset = api.putSelfIntoPlay(inv.seat, '04199')
        const token = asset ? api.sealRandomChaosToken(asset) : null
        api.info(`🔮 ${inv.name} 把「${api.cardName('04199')}」放入场${token ? `并封印了 ${api.tokenLabel(token)}` : ''}。`)
      },
    }],
  },
]

// ---------------------------------------------------------------------------
// 5c-25：检定 + 「本局一次」标记（古代遗物）
// ---------------------------------------------------------------------------

export const MIGRATED_ESCAPE_ENTRIES_5C25 = [
  // 04191 古代遗物：横置，检定意志或智识(4)。成功移除当前密谋 1 个毁灭（每局最多成功一次），
  // 失败在遗物上放 1 个毁灭。旧实现把「成功过一次」记在 inv.tfaRelicDoomSuccess，
  // 现在换成调查员级的通用标记 inv.gameFlags。
  {
    code: '04191',
    abilities: [{
      kind: 'action', label: '横置：检定意志或智识(4)，成功移除密谋 1 毁灭',
      cost: { action: false, exhaust: true },
      resolve: ({ inv, source, api }) => {
        if (api.gameFlag(inv.seat, 'relicDoomSuccess')) {
          api.info('本场游戏已经成功使用过一次「古代遗物」。')
          return
        }
        const picked = api.choice({ kind: 'skill', source: '04191', seat: inv.seat,
          prompt: '选择意志还是智识检定。',
          options: [{ id: 'willpower', label: '意志(4)' }, { id: 'intellect', label: '智识(4)' }] })
        const skill = picked === 'intellect' ? 'intellect' : 'willpower'
        api.startTest({
          seat: inv.seat, skill, difficulty: 4,
          resolve: result => {
            if (result.success) {
              api.setGameFlag(inv.seat, 'relicDoomSuccess')
              if (api.removeDoom(1) > 0) {
                api.info(`🏺 古代遗物：移除当前密谋上的 1 个毁灭（当前 ${api.doom()}）。`)
              } else {
                api.info('🏺 古代遗物：当前密谋上没有毁灭可移除。')
              }
              return
            }
            api.placeDoomOnCard(source, 1)
            api.info(`🏺 古代遗物：检定失败，在遗物上放置 1 个毁灭（当前 ${source?.doom || 0}）。`)
          },
        })
      },
    }],
  },
]

// ---------------------------------------------------------------------------
// 5c-27：击败敌人后的反应 —— 敌人与事件卡一起进胜利区（掩埋）
// ---------------------------------------------------------------------------

export const MIGRATED_ESCAPE_ENTRIES_5C27 = [
  // 03016 掩埋：击败非精英敌人后快速打出——把那名敌人和这张牌一起放进胜利区。
  {
    code: '03016',
    abilities: [{
      kind: 'played', fast: true, trigger: 'defeatEnemy',
      criteria: { nonElite: true },
      label: '把击败的非精英敌人与自身加入胜利区',
      resolve: ({ api }) => {
        const enemy = api.reactionContext()?.enemy
        if (!enemy) return
        api.buryEnemyInVictory(enemy, '03016')
      },
    }],
  },
]

// ---------------------------------------------------------------------------
// 5c-28：充能支援的转移与回收（灵语人 / 愤怒之灵）
// ---------------------------------------------------------------------------

export const MIGRATED_ESCAPE_ENTRIES_5C28 = [
  // 03014 灵语人：横置，选一个自己控制的充能支援——返回手牌，或把全部充能换成资源后弃置。
  {
    code: '03014',
    abilities: [{
      kind: 'action', label: '横置：选择一个充能支援，将其返回手牌，或把全部充能转为资源并弃置',
      cost: { action: false, exhaust: true },
      resolve: ({ inv, source, api }) => {
        const candidates = inv.assets.filter(card => card.id !== source?.id
          && api.isChargeAsset(card) && api.canLeavePlay(card))
        if (!candidates.length) return
        const targetId = api.choice({ kind: 'target', source: '03014', seat: inv.seat,
          prompt: '选择一个由你控制的充能支援。',
          options: candidates.map(card => ({ id: card.id, label: api.cardName(card.code) })) })
        const card = candidates.find(item => item.id === targetId)
        if (!card) return
        const mode = api.choice({ kind: 'effect', source: '03014', seat: inv.seat,
          prompt: '选择灵语人的结算方式。', options: [
            { id: 'return', label: '将支援返回手牌' },
            { id: 'resources', label: `获得 ${card.uses || 0} 资源并弃置支援` },
          ] })
        if (mode === 'return') {
          api.returnAssetToHand(inv.seat, card)
        } else {
          api.gainResources(inv.seat, card.uses || 0)
          api.discardAsset(inv.seat, card)
        }
        api.info(`「${api.cardName('03014')}」将「${api.cardName(card.code)}」${mode === 'return' ? '返回手牌' : '转化充能并弃置'}。`)
      },
    }],
  },
  // 03015 愤怒之灵：作为威胁区的弱点牌（有充能），横置一个「未横置、有充能、法术特性」的支援，
  // 移动 1 个充能到自身。弱点数据体与主动能力放在同一个条目里（弱点读点仍是 weaknessProfile）。
  {
    code: '03015',
    abilities: [
      {
        kind: 'weakness', label: '愤怒之灵（威胁区弱点）',
        weakness: { type: 'threat', initialUses: 0, usesType: 'charges' },
      },
      {
        kind: 'action', label: '横置一个法术支援并移动其 1 个充能到愤怒之灵',
        cost: { action: false },
        resolve: ({ inv, source, api }) => {
          const candidates = inv.assets.filter(card => !card.exhausted && api.isChargeAsset(card)
            && (card.uses || 0) > 0 && api.cardTraits(card.code).includes('spell'))
          if (!candidates.length) return
          const targetId = api.choice({ kind: 'target', source: '03015', seat: inv.seat,
            prompt: '选择并横置一个有充能的法术支援。',
            options: candidates.map(card => ({ id: card.id, label: api.cardName(card.code) })) })
          const card = candidates.find(item => item.id === targetId)
          if (!card) return
          api.exhaust(card)
          api.addUses(card, -1)
          api.addUses(source, 1)
          api.info(`「${api.cardName('03015')}」从「${api.cardName(card.code)}」移动了1个充能（${source?.uses || 0}/4）。`)
        },
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// 5c-29：研究记录与充能类型（古代雕文）
// ---------------------------------------------------------------------------

export const MIGRATED_ESCAPE_ENTRIES_5C29 = [
  // 03025 古代雕文：弃 1 张智识图标手牌，在卡上放 1 个秘密；满 3 个时移出游戏，
  // 获得 5 资源并记下「翻译雕文」这项研究（战役账本）。
  {
    code: '03025',
    abilities: [{
      kind: 'action', label: '翻译古代雕文',
      cost: { action: true, discardHand: 1, discardHandIcon: 'intellect' },
      resolve: ({ inv, source, api }) => {
        if (!source) return
        api.addUses(source, 1)
        api.setUsesType(source, 'secrets')
        if ((source.uses || 0) >= 3) {
          api.discardAsset(inv.seat, source)
          api.gainResources(inv.seat, 5)
          api.recordResearch('translatedGlyphs')
        }
      },
    }],
  },
]

// ---------------------------------------------------------------------------
// 5c-30：附属到地点并把帷幕视为 1（骷髅钥匙）
// ---------------------------------------------------------------------------

export const MIGRATED_ESCAPE_ENTRIES_5C30 = [
  // 04270 骷髅钥匙：快速支援；动作把它附属到所在地点，该地点的帷幕视为 1。
  // 原先「解除附属」那半段在引擎里**永远走不到**（能力长在支援身上，附属期间它不在 inv.assets 里），
  // 所以这一批只迁附属那半段；解除需要「地点附属上的能力枚举」，属未做机制（记在 §6）。
  {
    code: '04270', fast: true,
    abilities: [{
      kind: 'action', label: '附属/解除到所在地点',
      cost: { action: true },
      resolve: ({ state, inv, source, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        if (!here || !source) return
        api.attachSelfToLocation(source, here.id, { shroudAsOne: true })
        api.info(`「${api.cardName('04270')}」附属到「${here.name}」，该地点隐藏值视为 1。`)
      },
    }],
  },
]

// ---------------------------------------------------------------------------
// 5c-32：卡牌造成的敌人攻击 / 角色切换（英勇救援、即兴表演）
// ---------------------------------------------------------------------------

export const MIGRATED_ESCAPE_ENTRIES_5C32 = [
  // 03106 英勇救援：别人被敌人攻击时快速打出——自己接战、替其承受这次攻击，并反击 1 点。
  // 旧原语读 `_reaction.enemyId`，但手牌触发的反应上下文里只有 `enemy`（没有 enemyId），
  // 所以这条反应以前**永远不会生效**；现在改读 `enemy`，是一处有意的修正。
  {
    code: '03106',
    abilities: [{
      kind: 'played', fast: true, trigger: 'enemyAttack',
      criteria: { otherInvestigator: true, nonEliteOnly: true },
      label: '替其他调查员承受这次攻击并反击 1 点',
      resolve: ({ inv, api }) => {
        const enemy = api.reactionContext()?.enemy
        if (!enemy || !api.isEnemyInPlay(enemy)) return
        api.engage(enemy, inv.seat)
        api.enemyAttackByCard(enemy, api.cardName('03106'), inv.seat)
        api.damageEnemy(enemy, 1, inv.seat)
      },
    }],
  },
  // 03018 即兴表演：切换角色，本回合下一张该阵营的卡费用 -3，并抽 1 张。
  // 旧条目的 `duringOwnTurn: true` 由 play-condition.js 翻译成「只能在自己的回合打出」，
  // 迁移后必须显式写成 playCondition，否则会在别人回合也能打出。
  {
    code: '03018',
    playCondition: [{ when: ownTurn(), message: '只能在自己的回合打出' }],
    abilities: [{
      kind: 'played', fast: true, label: '切换角色并抽 1 张（下一张该阵营卡 -3）',
      resolve: ({ inv, api }) => {
        const role = api.switchRole(inv.seat, '03018', '选择即兴表演要切换到的角色。')
        if (!role) return
        api.setRoleDiscount(inv.seat, role, 3)
        api.drawCardsLogged(inv.seat, 1)
        api.info(`${inv.name} 切换为${api.className(role)}；本回合下一张该阵营卡牌费用-3。`)
      },
    }],
  },
]

// ---------------------------------------------------------------------------
// 5c-33：额外花费弹药换额外揭示（吃子弹）
// ---------------------------------------------------------------------------

export const MIGRATED_ESCAPE_ENTRIES_5C33 = [
  // 03304 吃子弹：启动枪械攻击时快速打出——多花 N 发弹药，本次检定额外揭示 N 个混乱标记。
  {
    code: '03304',
    abilities: [{
      kind: 'played', fast: true, trigger: 'activateFirearmFight',
      label: '额外花费弹药，换取本次检定额外揭示的混乱标记',
      resolve: ({ inv, api }) => {
        const context = api.reactionContext()
        const assetId = context?.assetId ?? context?.context?.assetId ?? null
        const firearm = (assetId && inv.assets.find(card => card.id === assetId))
          || inv.assets.find(card => api.cardTraits(card.code).includes('firearm') && (card.uses || 0) > 0)
        if (!firearm) return
        const amount = Number(api.choice({ kind: 'amount', source: '03304', seat: inv.seat,
          prompt: '选择额外花费的弹药。',
          options: Array.from({ length: firearm.uses + 1 }, (_, value) => ({ id: String(value), label: `${value}弹药` })) }))
        api.addUses(firearm, -amount)
        api.addExtraChaosChoicesToTest(amount)
      },
    }],
  },
]

// ---------------------------------------------------------------------------
// 5c-34：把牌放进附属区并能当手牌打出（背包）
// ---------------------------------------------------------------------------

export const MIGRATED_ESCAPE_ENTRIES_5C34 = [
  // 04037 背包：入场时从牌库顶 6 张挑最多 3 张道具/补给放进 attachedCards；
  // 其中的牌可以像手牌一样打出（读点见 doPlay / legalMoves / validateMove 的 cardBackpack）。
  {
    code: '04037', cardBackpack: true,
    abilities: [{
      kind: 'entersPlay', label: '入场：从牌库顶 6 张挑最多 3 张道具/补给放进背包',
      resolve: ({ inv, source, api }) => {
        if (!source) return
        const top = api.topDeckCodes(inv.seat, 6).reverse()
        const remaining = top.filter(code => api.cardType(code) && api.isNonWeakness(code)
          && api.cardTraits(code).some(trait => trait === 'item' || trait === 'supply'))
        const chosen = []
        while (chosen.length < 3 && remaining.length) {
          const answer = api.choice({ kind: 'card', source: '04037', seat: inv.seat, canSkip: true,
            prompt: `背包：选择要附属的卡（已选 ${chosen.length}/3）。`,
            options: [{ id: 'done', label: '完成附属' },
              ...remaining.map((code, index) => ({ id: String(index), cardCode: code, label: api.cardName(code) }))] })
          if (answer === 'done') break
          const picked = remaining.splice(Number(answer), 1)[0]
          if (picked) chosen.push(picked)
        }
        api.takeFromDeck(inv.seat, chosen)
        api.shuffleDeck(inv.seat)
        api.setAttachedCards(source, chosen)
        if (!chosen.length) {
          api.discardAsset(inv.seat, source)
          api.info('🎒 背包里没有可附属的道具/补给，弃掉背包。')
          return
        }
        api.info(`🎒 背包附属了 ${chosen.length} 张牌：${chosen.map(code => api.cardName(code)).join('、')}。`)
      },
    }],
  },
]

// 按卡号合并：同一张卡可以同时有旧印、主动能力与修正，注册表只接受一个条目。
// Phase 5 起，机械迁移的批次（tools/migrate-card.mjs 生成）也走同一次合并。
const byCode = new Map()
for (const entry of [...elderSignEntries, ...NEW_CARD_ABILITIES, ...MIGRATED_MODIFIER_ENTRIES,
  ...LIFECYCLE_ENTRIES, ...TRANSITION_ENTRIES, ...MIGRATED_ESCAPE_ENTRIES, ...MIGRATED_ESCAPE_ENTRIES_5C4, ...MIGRATED_ESCAPE_ENTRIES_5C5, ...MIGRATED_REACTION_ENTRIES, ...MIGRATED_REACTION_ENTRIES_5B6B, ...MIGRATED_REACTION_ENTRIES_5B6C, ...MIGRATED_ESCAPE_ENTRIES_5C6, ...MIGRATED_ESCAPE_ENTRIES_5C7, ...MIGRATED_ESCAPE_ENTRIES_5C8, ...MIGRATED_ESCAPE_ENTRIES_5C9,
  ...MIGRATED_CARD_ENTRIES, ...MIGRATED_FREETRIGGER_ENTRIES, ...MIGRATED_ESCAPE_ENTRIES_5C10, ...MIGRATED_REACTION_ENTRIES_5B6D, ...MIGRATED_PASSIVE_ENTRIES, ...MIGRATED_PASSIVE_ABILITY_ENTRIES, ...MIGRATED_RULE_FIELD_ENTRIES, ...MIGRATED_SEAL_ATTACH_ENTRIES, ...MIGRATED_MIXED_ENTRIES_5B11, ...MIGRATED_ESCAPE_ENTRIES_5C19, ...MIGRATED_ESCAPE_ENTRIES_5C20, ...MIGRATED_ESCAPE_ENTRIES_5C21, ...MIGRATED_CARD_RULE_ENTRIES_5A5, ...MIGRATED_ESCAPE_ENTRIES_5C22, ...MIGRATED_ESCAPE_ENTRIES_5C23, ...MIGRATED_ESCAPE_ENTRIES_5C24, ...MIGRATED_ESCAPE_ENTRIES_5C25, ...MIGRATED_ESCAPE_ENTRIES_5C27, ...MIGRATED_ESCAPE_ENTRIES_5C28, ...MIGRATED_ESCAPE_ENTRIES_5C29, ...MIGRATED_ESCAPE_ENTRIES_5C30, ...MIGRATED_ESCAPE_ENTRIES_5C32, ...MIGRATED_ESCAPE_ENTRIES_5C33, ...MIGRATED_ESCAPE_ENTRIES_5C34, CALVIN_ENTRY]) {
  const existing = byCode.get(entry.code) || { code: entry.code }
  byCode.set(entry.code, {
    ...existing,
    ...entry,
    abilities: [...(existing.abilities || []), ...(entry.abilities || [])],
    modifiers: [...(existing.modifiers || []), ...(entry.modifiers || [])],
  })
}

export const CARD_ABILITY_ENTRIES = [...byCode.values()]

// 已进入能力层的卡号集合。构筑层、图鉴与审计用它判断"这张卡有没有行为实现"，
// 不必为了迁移进度去读 EFFECTS（旧通道）。
export const CARD_ABILITY_CODES = new Set(CARD_ABILITY_ENTRIES.map(entry => entry.code))

// Phase 5 迁走的卡号（数据从 EFFECTS 搬进能力层，形状不变）。
// 自动构筑的评分口径要对这些卡「把搬走的数据原样计回分数」，否则开局牌组会变
// （牌组会写进对局存档与 replay 基线）。更早的手写描述子不在这个集合里：
// 它们的 abilities/played 历来不参与评分，保持历史口径。
export const PHASE5_MIGRATED_CODES = new Set([
  ...MIGRATED_CARD_ENTRIES.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C4.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C5.map(entry => entry.code),
  ...MIGRATED_REACTION_ENTRIES.map(entry => entry.code),
  ...MIGRATED_REACTION_ENTRIES_5B6B.map(entry => entry.code),
  ...MIGRATED_REACTION_ENTRIES_5B6C.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C6.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C7.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C8.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C9.map(entry => entry.code),
  ...MIGRATED_FREETRIGGER_ENTRIES.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C10.map(entry => entry.code),
  ...MIGRATED_REACTION_ENTRIES_5B6D.map(entry => entry.code),
  ...MIGRATED_PASSIVE_ENTRIES.map(entry => entry.code),
  ...MIGRATED_PASSIVE_ABILITY_ENTRIES.map(entry => entry.code),
  ...MIGRATED_RULE_FIELD_ENTRIES.map(entry => entry.code),
  ...MIGRATED_SEAL_ATTACH_ENTRIES.map(entry => entry.code),
  ...MIGRATED_MIXED_ENTRIES_5B11.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C19.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C20.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C21.map(entry => entry.code),
  ...MIGRATED_CARD_RULE_ENTRIES_5A5.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C22.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C23.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C24.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C25.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C27.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C28.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C29.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C30.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C32.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C33.map(entry => entry.code),
  ...MIGRATED_ESCAPE_ENTRIES_5C34.map(entry => entry.code),
])
