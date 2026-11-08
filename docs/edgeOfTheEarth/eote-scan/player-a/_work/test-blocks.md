
================================================================================
## 08019  [tests/eote-player-m2-1.test.mjs:152]
// ── 08019 全副武装 ──────────────────────────────────────────────────────────
test('P6 08019 全副武装 第一回合开始：从手中打出任意张[[道具]]支援（每张 -1），本回合少 3 个行动', () => {
  const state = fixture('01001')
  state.round = 1
  state.currentSeat = 0
  state.abilityLimits = {}
  asset(state, '08019')
  me(state).hand = ['02016', '02016']
  me(state).resources = 0
  me(state).actionsLeft = 5
  probe(state, draft => reactionWindow(draft, 'turnBegins', { when: 'turnBegins', seat: 0 }, []),
    pending => (pending.options.some(option => option.cardCode === '02016') ? pending.options.find(option => option.cardCode === '02016').id : null))
  // 第二次选择时手牌只剩一张（同一写法重复），最终两张都入场。
  assert.equal(me(state).hand.filter(code => code === '02016').length, 0, '两张道具都从手牌打出')
  assert.equal(me(state).assets.filter(card => card.code === '02016').length, 2, '两张道具支援已入场')
  assert.equal(me(state).resources, 0, '费用 -1 后 1 费道具免费打出')
  assert.equal(me(state).actionsLeft, 2, '本回合少进行三次行动（5 - 3）')
})

================================================================================
## 08020  [tests/eote-player-m2-1.test.mjs:461]
// ── 08020 正面迎击（approximation）──────────────────────────────────────────
test('P6 08020 正面迎击 敌人先攻击你；本次攻击自动成功并造成 2 点伤害（approximation）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const target = enemy(state, { fight: 3, evade: 3, health: 20, damage: 1, horror: 0 })
  me(state).damage = 0
  resolvePlayed(state, '08020', { choose: pending => (pending.options.some(option => option.id === target.id) ? target.id : null) })
  assert.equal(freshEnemy(state, target.id).damageTaken, 2, '自动成功的攻击造成 2 点伤害（不抽混乱标记）')
  assert.equal(me(state).damage, 1, '额外费用：所选敌人先攻击你')
})

================================================================================
## 08021  [tests/eote-player-m2-1.test.mjs:472]
// ── 08021 “到我身后！”（approximation）─────────────────────────────────────
test('P6 08021 “到我身后！” 另一位调查员被攻击时改为攻击你并交战，取消 1 点恐惧（approximation）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const attacker = enemy(state, { fight: 2, evade: 2, health: 20, damage: 1, horror: 1 })
  me(state).damage = 0
  me(state).horror = 0
  state._reaction = { context: { when: 'enemyAttack', seat: 1, location: me(state).location, enemy: attacker } }
  resolvePlayed(state, '08021')
  const after = freshEnemy(state, attacker.id)
  assert.equal(after.engagedSeat, 0, '改为与你交战')
  assert.equal(me(state).damage, 1, '你结算了这次攻击的伤害')
  assert.equal(me(state).horror, 0, '取消该次攻击 1 点恐惧（近似为治愈 1 点恐惧）')
})

================================================================================
## 08022  [tests/eote-player-m2-1.test.mjs:171]
// ── 08022 成群结队 ──────────────────────────────────────────────────────────
test('P6 08022 成群结队 每控制一张不同职阶的卡牌：攻击 +1[combat] 且 +1 伤害', () => {
  const state = fixture('01001')
  me(state).assets = []
  // 五个不同职阶的在场卡牌。
  for (const code of ['10019', '10040', '10062', '10084', '10108']) asset(state, code)
  const target = enemy(state, { fight: 1, evade: 1, health: 20 })
  state.chaosBag = ['0']
  const combatBase = getStat(state, me(state), 'combat')
  resolvePlayed(state, '08022', { choose: pending => (pending.options.some(option => option.id === target.id) ? target.id : null) })
  assert.equal(state.lastTestResult?.value, combatBase + 5, '五个不同职阶 → +5 技能值')
  assert.equal(freshEnemy(state, target.id).damageTaken, 6, '基础 1 伤害 +5')
})

================================================================================
## 08023  [tests/eote-player-m2-1.test.mjs:185]
// ── 08023 扫堂腿 ────────────────────────────────────────────────────────────
test('P6 08023 扫堂腿 攻击加入[agility]、+1 伤害，成功自动躲避该敌人', () => {
  const state = fixture('01001')
  me(state).assets = []
  const target = enemy(state, { fight: 1, evade: 1, health: 20 })
  state.chaosBag = ['+1']
  const combatBase = getStat(state, me(state), 'combat')
  const agility = getStat(state, me(state), 'agility')
  resolvePlayed(state, '08023', { choose: pending => (pending.options.some(option => option.id === target.id) ? target.id : null) })
  assert.ok(state.lastTestResult?.success, '攻击成功')
  assert.equal(state.lastTestResult.value, combatBase + agility + 1, '攻击技能值 = 战斗 + 敏捷 + 标记')
  const after = freshEnemy(state, target.id)
  assert.equal(after.damageTaken, 2, '本次攻击 1 + 1 伤害')
  assert.equal(after.exhausted, true, '成功后自动躲避（横置）')
  assert.equal(after.engagedSeat, null, '自动躲避解除交战')
})

================================================================================
## 08024  [tests/eote-player-m2-1.test.mjs:487]
// ── 08024 防御姿态（approximation）──────────────────────────────────────────
test('P6 08024 防御姿态 手中/投入时获得等于敏捷的战斗图标、等于战斗的敏捷图标（approximation）', () => {
  const state = fixture('01001')
  const base = ALL_CARDS['01001']
  assert.equal(commitIcons(state, me(state), '08024', 'combat'), base.agility, '战斗检定：等于敏捷的战斗图标')
  assert.equal(commitIcons(state, me(state), '08024', 'agility'), base.combat, '敏捷检定：等于战斗的敏捷图标')
  assert.equal(commitIcons(state, me(state), '08024', 'willpower'), 0, '其他技能不提供图标')
})

================================================================================
## 08025  [tests/eote-player-m2-1.test.mjs:202]
// ── 08025 蝴蝶对剑（等级 2）─────────────────────────────────────────────────
test('P6 08025 蝴蝶对剑 攻击 +1[combat]；可横置再次攻击（加入[agility]，+1 伤害）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const blade = asset(state, '08025')
  const target = enemy(state, { fight: 0, evade: 1, health: 30 })
  state.chaosBag = ['0', '0', '0', '0']
  const attack = legalMoves(state).find(option => option.action === 'ability' && option.assetId === blade.id)
  assert.ok(attack, '蝴蝶对剑应有攻击行动')
  move(state, attack)
  act(state, pending => (pending.options.some(option => option.id === 'again') ? 'again' : null))
  assert.equal(me(state).assets.find(card => card.code === '08025').exhausted, true, '再次攻击后横置')
  assert.equal(freshEnemy(state, target.id).damageTaken, 3, '第一次 1 伤害 + 第二次 2 伤害')
})

================================================================================
## 08026  [tests/eote-player-m2-1.test.mjs:217]
// ── 08026 闪躲 ──────────────────────────────────────────────────────────────
test('P6 08026 闪躲 取消敌人攻击；敏捷(1)成功后对该敌人造成 1 点伤害', () => {
  const state = fixture('01001')
  const attacker = enemy(state, { fight: 1, evade: 1, health: 10 })
  state.chaosBag = ['+1', '+1']
  // catalog-only 阶段不能靠真实 play 入口打出事件：直接把「正在攻击」的上下文放到反应上下文，
  // 再执行已注册的 played 描述符（resolve 内仍走 api.cancelCurrentAttack / api.startTest）。
  state._reaction = { context: { when: 'enemyAttack', seat: 0, enemy: attacker, attackKind: 'enemy' } }
  resolvePlayed(state, '08026')
  assert.equal(freshEnemy(state, attacker.id).damageTaken, 1, '敏捷(1)成功后造成 1 点伤害')
})

================================================================================
## 08027  [tests/eote-player-m2-1.test.mjs:229]
// ── 08027 战斗训练 ──────────────────────────────────────────────────────────
test('P6 08027 战斗训练 沉稳：+1[combat] +1[agility]，伤害优先分配给本卡，每次检定可花 1 资源 +1', () => {
  const state = fixture('01001')
  me(state).assets = []
  const training = asset(state, '08027')
  assert.equal(getStat(state, me(state), 'combat'), ALL_CARDS['01001'].combat + 1)
  assert.equal(getStat(state, me(state), 'agility'), ALL_CARDS['01001'].agility + 1)
  const effect = assetEffect(me(state), me(state).assets.find(card => card.id === training.id))
  assert.equal(effect.composure, true, '沉稳读点：非直接恐惧优先分配')
  const entry = registeredEntry('08027')
  assert.equal(entry.fast, true)
  assert.deepEqual(entry.freeTriggers.map(trigger => trigger.skill), ['combat', 'agility'])
})

================================================================================
## 08028  [tests/eote-player-m2-1.test.mjs:496]
// ── 08028 追猎行动（approximation）──────────────────────────────────────────
test('P6 08028 追猎行动 神话抽遭遇前：生成遭遇敌人并交战、附属本卡；击败后获得 3 资源（approximation）', () => {
  const state = fixture('01001')
  me(state).assets = []
  me(state).resources = 0
  state.encounterDeck = ['ghoulMinion']
  resolvePlayed(state, '08028', {
    choose: pending => {
      const option = pending.options.find(item => item.cardCode === 'ghoulMinion')
      return option ? option.id : null
    },
  })
  const spawned = state.enemies.find(item => item.code === 'ghoulMinion')
  assert.ok(spawned, '从遭遇牌库生成敌人')
  assert.equal(spawned.engagedSeat, 0, '与生成者交战')
  assert.ok(state.effects.some(effect => effect.sourceCode === '08028'), '击败奖励效果已记录')
  // 击败被追猎敌人：触发效果记录上的 defeatEnemy 反应，获得 3 资源。
  probe(state, draft => reactionWindow(draft, 'defeatEnemy', {
    when: 'defeatEnemy', seat: 0, enemy: draft.enemies.find(item => item.code === 'ghoulMinion'),
    location: draft.investigators[0].location,
  }, []), pending => {
    const option = pending.options.find(item => String(item.id).startsWith('desc:effect'))
    return option ? option.id : null
  })
  assert.equal(me(state).resources, 3, '击败被追猎敌人获得 3 资源')
})

================================================================================
## 08029  [tests/eote-player-m2-1.test.mjs:243]
// ── 08029 提尔斯哈之牙 ──────────────────────────────────────────────────────
test('P6 08029 提尔斯哈之牙 攻击已揭示地点敌人：移动至其地点，加入[agility]，+3 伤害', () => {
  const state = fixture('01001')
  me(state).assets = []
  // 两个地点：同地点与另一已揭示地点各一个敌人。
  const here = state.locations[0]
  state.locations.push({ id: 'far', name: '远端', clues: 0, shroud: 1, connections: [here.id], revealed: true })
  here.connections = ['far']
  state.enemies.push({
    id: 'farEnemy', code: 'ghoulMinion', name: '远端敌人', location: 'far',
    fight: 0, evade: 1, health: 20, damageTaken: 0, damage: 1, horror: 1, engagedSeat: null, exhausted: false,
  })
  state.chaosBag = ['0']
  const combatBase = getStat(state, me(state), 'combat')
  const agility = getStat(state, me(state), 'agility')
  resolvePlayed(state, '08029', {
    choose: pending => (pending.options.some(option => option.id === 'farEnemy') ? 'farEnemy' : null),
  })
  assert.equal(me(state).location, 'far', '结算前移动到敌人地点')
  assert.equal(state.lastTestResult?.value, combatBase + agility, '攻击加入敏捷')
  assert.equal(freshEnemy(state, 'farEnemy').damageTaken, 4, '基础 1 + 3 伤害')
})

================================================================================
## 08030  [tests/eote-player-m2-1.test.mjs:266]
// ── 08030 蝴蝶对剑（等级 5）─────────────────────────────────────────────────
test('P6 08030 蝴蝶对剑 第一次 +2[combat]；可再次攻击；两次都成功横置使第二次 +1 伤害', () => {
  const state = fixture('01001')
  me(state).assets = []
  const blade = asset(state, '08030')
  const target = enemy(state, { fight: 0, evade: 1, health: 40 })
  state.chaosBag = ['+1', '+1', '+1', '+1']
  const attack = legalMoves(state).find(option => option.action === 'ability' && option.assetId === blade.id)
  move(state, attack)
  act(state, pending => (pending.options.some(option => option.id === 'again') ? 'again'
    : pending.options.some(option => option.id === 'exhaust') ? 'exhaust' : null))
  assert.equal(me(state).assets.find(card => card.code === '08030').exhausted, true, '横置蝴蝶对剑')
  assert.equal(freshEnemy(state, target.id).damageTaken, 3, '第一次 1 伤害 + 第二次 1 伤害 + 横置追加 1')
})

================================================================================
## 08031  [tests/eote-player-m2-1.test.mjs:523]
// ── 08031 强制学习（approximation）──────────────────────────────────────────
test('P6 08031 强制学习 牌库 +15；补给阶段抽 2 弃 1（approximation：重整末尾再抽 1 弃 1）', () => {
  const state = fixture('01001')
  me(state).assets = []
  asset(state, '08031')
  const baseRules = deckRules(me(state))
  const builtRules = deckRules(me(state), ['08031'], {})
  assert.equal(builtRules.size, baseRules.size + 15, '构筑层牌库 +15')
  me(state).hand = []
  me(state).deck = ['10006', '10023', '10002', '10028']
  probe(state, draft => reactionWindow(draft, 'upkeepEnd', { when: 'upkeepEnd', seat: 0 }, []))
  assert.equal(me(state).hand.length, 0, '额外抽 1 后弃 1：手牌净 0')
  assert.equal(me(state).discard.length, 1, '弃掉 1 张手牌')
  assert.equal(me(state).deck.length, 3, '多抽了 1 张')
})

================================================================================
## 08032  [tests/eote-player-m2-1.test.mjs:281]
// ── 08032 耶利米·科尔比 ─────────────────────────────────────────────────────
test('P6 08032 耶利米·科尔比 +1[intellect]；入场后揭示牌库顶 5 张，按费用奇偶抽牌并洗回其余', () => {
  const state = fixture('01001')
  me(state).assets = []
  asset(state, '08032')
  me(state).hand = []
  // 牌库：顶 5 张 = 偶 0/2/0 + 奇 1/1（deck 末尾是牌库顶）。
  me(state).deck = ['10006', '10023', '10002', '10028', '10006']
  const baseIntellect = ALL_CARDS['01001'].intellect
  assert.equal(getStat(state, me(state), 'intellect'), baseIntellect + 1, '+1 智力')
  resolveAbility(state, '08032', {
    kind: 'reaction', context: { assetCode: '08032' },
    choose: pending => (pending.options.some(option => option.id === 'even') ? 'even' : null),
  })
  const hand = me(state).hand
  assert.deepEqual(hand.sort(), ['10002', '10006', '10006'], '抽取 3 张偶数费用卡牌')
  assert.equal(me(state).deck.length, 2, '剩下 2 张洗回牌库')
  assert.deepEqual(me(state).deck.sort(), ['10023', '10028'], '奇数费用卡牌留在牌库')
})

================================================================================
## 08033  [tests/eote-player-m2-1.test.mjs:539]
// ── 08033 通路档案（等级 0，approximation）──────────────────────────────────
test('P6 08033 通路档案 额外费用在 4 地点放灵脉；调查带灵脉地点后移到本卡，满 4 弃卡得资源（approximation）', () => {
  const state = fixture('01001')
  me(state).assets = []
  me(state).resources = 10
  multiLocation(state, ['ley1', 'ley2', 'ley3'])
  const prophecy = asset(state, '08033')
  resolveAbility(state, '08033', { kind: 'entersPlay', source: { id: prophecy.id, code: '08033' } })
  const marked = state.locations.filter(location => (location.traitGrants?.LeyLine || []).includes('08033'))
  assert.equal(marked.length, 4, '4 个不同地点各放置 1 个灵脉')
  assert.equal(me(state).resources, 6, '额外费用：支付 4 资源')
  // 调查成功反应：把灵脉移到本卡。
  let archive = me(state).assets.find(card => card.code === '08033')
  archive.uses = 3
  probe(state, draft => reactionWindow(draft, 'investigateSuccess', {
    when: 'investigateSuccess', seat: 0, location: draft.investigators[0].location,
  }, []), pending => {
    const option = pending.options.find(item => String(item.id).startsWith('desc:08033'))
    return option ? option.id : null
  })
  assert.equal(me(state).assets.some(card => card.code === '08033'), false, '集齐 4 灵脉后弃掉本卡')
  assert.equal(me(state).resources, 10, '拿取 4 灵脉作为资源（6 + 4）')
  assert.equal(state.scenarioFlags?.eoteConfirmedPath, true, '记录“你已经确认了前行道路”')
})

================================================================================
## 08034  [tests/eote-player-m2-1.test.mjs:564]
// ── 08034 繁星密语（approximation）──────────────────────────────────────────
test('P6 08034 繁星密语 弃牌库顶：弱点洗回，非弱点本回合每次检定获得其图标（approximation）', () => {
  const state = fixture('01001')
  me(state).hand = []
  const normal = Object.entries(ALL_CARDS)
    .find(([, def]) => def.type === 'asset' && Object.keys(def.icons || {}).length
      && Object.values(def.icons).some(value => value > 0))[0]
  const icons = Object.values(ALL_CARDS[normal].icons).reduce((sum, value) => sum + (Number(value) || 0), 0)
  me(state).deck = ['10006', normal]
  resolvePlayed(state, '08034')
  const effect = state.effects.find(item => item.sourceCode === '08034')
  assert.ok(effect, '非弱点：得到本回合加值效果')
  assert.equal(effect.modifiers[0].amount, icons, '等于该牌图标总数')
  // 弱点分支：洗回牌库、不产生加值效果。
  const weakness = Object.entries(ALL_CARDS)
    .find(([, def]) => ['weakness', 'basicweakness'].includes(def.subtype))[0]
  const fresh = fixture('01001')
  me(fresh).hand = []
  me(fresh).deck = ['10006', weakness]
  resolvePlayed(fresh, '08034')
  assert.equal(me(fresh).deck.length, 2, '弱点洗回牌库（张数不变）')
  assert.equal(fresh.effects.some(item => item.sourceCode === '08034'), false, '弱点分支不产生加值效果')
})

================================================================================
## 08035  [tests/eote-player-m2-1.test.mjs:301]
// ── 08035 登山靴 ────────────────────────────────────────────────────────────
test('P6 08035 登山靴 +1[agility]；最后一个线索被发现后横置移动到有线索/未揭示的连接地点', () => {
  const state = fixture('01001')
  me(state).assets = []
  const boots = asset(state, '08035')
  twoLocations(state)
  state.locations[0].clues = 0
  assert.equal(getStat(state, me(state), 'agility'), ALL_CARDS['01001'].agility + 1, '+1 敏捷')
  // 走真实 clueDiscovered 反应窗口（费用由引擎支付：横置登山靴）。
  probe(state, draft => reactionWindow(draft, 'clueDiscovered', {
    when: 'clueDiscovered', seat: 0, location: 'study', lastClue: true,
  }, []), pending => {
    if (pending.options.some(option => option.id === 'attic')) return 'attic'
    const descriptor = pending.options.find(option => String(option.id).startsWith('desc:08035'))
    if (descriptor) return descriptor.id
    return null
  })
  assert.equal(me(state).location, 'attic', '移动到符合条件的连接地点')
  assert.equal(me(state).assets.find(card => card.id === boots.id).exhausted, true, '横置登山靴')
})

================================================================================
## 08036  [tests/eote-player-m2-1.test.mjs:322]
// ── 08036 加入马队 ──────────────────────────────────────────────────────────
test('P6 08036 加入马队 每控制一张不同职阶的卡牌费用 -1；快速移动到任意已揭示地点', () => {
  const state = fixture('01001')
  me(state).assets = []
  for (const code of ['10019', '10040', '10062']) asset(state, code)
  const def = ALL_CARDS['08036']
  assert.equal(registeredEntry('08036').playCostModifier({ state, inv: me(state), card: def }), -3, '三种不同职阶 → 费用 -3')
  assert.equal(playCost(state, me(state), def), Math.max(0, (def.cost || 0) - 3), '实际打出费用随职阶数递减')
  assert.equal(registeredEntry('08036').playCondition.length, 1, '只可在自己回合打出（playCondition）')
  twoLocations(state)
  resolvePlayed(state, '08036', {
    choose: pending => (pending.options.some(option => option.id === 'attic') ? 'attic' : null),
  })
  assert.equal(me(state).location, 'attic', '移动到任意已揭示地点')
})

================================================================================
## 08037  [tests/eote-player-m2-1.test.mjs:588]
// ── 08037 地区勘测（approximation）──────────────────────────────────────────
test('P6 08037 地区勘测 手中/投入时获得等于敏捷的智力图标、等于智力的敏捷图标（approximation）', () => {
  const state = fixture('01001')
  const base = ALL_CARDS['01001']
  assert.equal(commitIcons(state, me(state), '08037', 'intellect'), base.agility, '智力检定：等于敏捷的智力图标')
  assert.equal(commitIcons(state, me(state), '08037', 'agility'), base.intellect, '敏捷检定：等于智力的敏捷图标')
})

================================================================================
## 08038  [tests/eote-player-m2-1.test.mjs:338]
// ── 08038 医学教科书 ────────────────────────────────────────────────────────
test('P6 08038 医学教科书 行动：智力(2)成功治愈 1（超 2 点则 2）；失败必须横置或造成 1 伤害', () => {
  const state = fixture('01001')
  me(state).assets = []
  const textbook = asset(state, '08038')
  me(state).damage = 2
  state.chaosBag = ['+1', '+1']
  const action = legalMoves(state).find(option => option.action === 'ability' && option.assetId === textbook.id)
  assert.ok(action, '医学教科书应有行动')
  move(state, action)
  act(state)
  assert.ok(state.lastTestResult?.success, '智力(2)检定成功')
  assert.equal(me(state).damage, 0, '成功且超过难度 2 点：治愈 2 点伤害')
  // 负面路径：检定失败时必须横置或对目标造成 1 点伤害。
  me(state).damage = 3
  state.chaosBag = ['autofail', 'autofail']
  const action2 = legalMoves(state).find(option => option.action === 'ability' && option.assetId === textbook.id)
  move(state, action2)
  act(state, pending => (pending.options.some(option => option.id === 'damage') ? 'damage' : null))
  assert.equal(me(state).damage, 4, '失败并选择造成 1 点伤害')
})

================================================================================
## 08039  [tests/eote-player-m2-1.test.mjs:360]
// ── 08039 发掘古物 ──────────────────────────────────────────────────────────
test('P6 08039 发掘古物 选择至多 2 张[seeker]支援；难度=费用和；成功依次入场，遗物支援各抽 1 张', () => {
  const state = fixture('01001')
  me(state).assets = []
  me(state).hand = ['10043', '10056']
  me(state).deck = ['10006', '10006', '10006']
  state.chaosBag = ['+1', '+1']
  resolvePlayed(state, '08039', {
    choose: pending => {
      if (pending.options.some(option => option.cardCode === '10043')) return pending.options.find(option => option.cardCode === '10043').id
      if (pending.options.some(option => option.cardCode === '10056')) return pending.options.find(option => option.cardCode === '10056').id
      return null
    },
  })
  assert.equal(state.lastTestResult?.difficulty, 3, '难度 = 费用 1 + 2')
  assert.ok(me(state).assets.some(card => card.code === '10043'), '第一张支援已放置入场')
  assert.ok(me(state).assets.some(card => card.code === '10056'), '第二张支援已放置入场')
  assert.equal(me(state).hand.length, 1, '两张支援离手后，遗物支援抽 1 张')
})

================================================================================
## 08040  [tests/eote-player-m2-1.test.mjs:380]
// ── 08040 科学理论 ──────────────────────────────────────────────────────────
test('P6 08040 科学理论 沉稳：+1[intellect] +1[combat]，伤害优先分配给本卡，每次检定可花 1 资源 +1', () => {
  const state = fixture('01001')
  me(state).assets = []
  const theory = asset(state, '08040')
  assert.equal(getStat(state, me(state), 'intellect'), ALL_CARDS['01001'].intellect + 1)
  assert.equal(getStat(state, me(state), 'combat'), ALL_CARDS['01001'].combat + 1)
  assert.equal(assetEffect(me(state), me(state).assets.find(card => card.id === theory.id)).composure, true)
  const entry = registeredEntry('08040')
  assert.equal(entry.fast, true)
  assert.deepEqual(entry.freeTriggers.map(trigger => trigger.skill), ['intellect', 'combat'])
})

================================================================================
## 08041  [tests/eote-player-m2-1.test.mjs:596]
// ── 08041 通路档案（等级 4，approximation）──────────────────────────────────
test('P6 08041 通路档案 入场 4 灵脉；免费把 1 灵脉移到非精英敌人（approximation）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const archive = asset(state, '08041')
  resolveAbility(state, '08041', { kind: 'entersPlay', assetCode: '08041' })
  let current = me(state).assets.find(card => card.code === '08041')
  assert.equal(current.uses, 4, '入场使用 4 灵脉')
  const foe = enemy(state, { fight: 2, evade: 2, health: 10 })
  resolveAbility(state, '08041', { kind: 'free', assetCode: '08041', choose: pending => (pending.options.some(option => option.id === foe.id) ? foe.id : null) })
  current = me(state).assets.find(card => card.code === '08041')
  assert.equal(current.uses, 3, '移动 1 灵脉到非精英敌人（近似：扣减使用次数）')
  assert.equal(freshEnemy(state, foe.id)?.id, foe.id, '目标敌人仍在场')
})

================================================================================
## 08042  [tests/eote-player-m2-1.test.mjs:611]
// ── 08042 通路档案（等级 4，approximation）──────────────────────────────────
test('P6 08042 通路档案 入场 4 灵脉；免费把 1 灵脉移到已揭示地点（approximation）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const archive = asset(state, '08042')
  resolveAbility(state, '08042', { kind: 'entersPlay', assetCode: '08042' })
  let current = me(state).assets.find(card => card.code === '08042')
  const here = state.locations[0]
  here.revealed = true
  resolveAbility(state, '08042', {
    kind: 'free', assetCode: '08042',
    choose: pending => (pending.options.some(option => option.id === here.id) ? here.id : null),
  })
  current = me(state).assets.find(card => card.code === '08042')
  assert.equal(current.uses, 3, '扣减 1 灵脉')
  assert.ok((state.locations.find(location => location.id === here.id).traitGrants?.LeyLine || []).includes('08042'),
    '地点获得灵脉标记')
})

================================================================================
## 08043  [tests/eote-player-m2-1.test.mjs:630]
// ── 08043 通路档案（等级 4，approximation）──────────────────────────────────
test('P6 08043 通路档案 入场 4 灵脉；免费移灵脉到非精英敌人，行动不触发趁乱攻击（approximation）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const archive = asset(state, '08043')
  resolveAbility(state, '08043', { kind: 'entersPlay', assetCode: '08043' })
  let current = me(state).assets.find(card => card.code === '08043')
  const foe = enemy(state, { fight: 2, evade: 2, health: 10 })
  resolveAbility(state, '08043', { kind: 'free', assetCode: '08043', choose: pending => (pending.options.some(option => option.id === foe.id) ? foe.id : null) })
  current = me(state).assets.find(card => card.code === '08043')
  assert.equal(current.uses, 3, '扣减 1 灵脉')
  assert.equal(registeredEntry('08043').abilities.find(ability => ability.kind === 'action').noOpportunityAttack, true,
    '本行动不会触发趁乱攻击')
})

================================================================================
## 08044  [tests/eote-player-m2-1.test.mjs:645]
// ── 08044 通路档案（等级 4，approximation）──────────────────────────────────
test('P6 08044 通路档案 入场 4 灵脉；行动令调查员抽 1 并治愈 1 点伤害（approximation）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const archive = asset(state, '08044')
  resolveAbility(state, '08044', { kind: 'entersPlay', assetCode: '08044' })
  let current = me(state).assets.find(card => card.code === '08044')
  const foe = enemy(state, { fight: 2, evade: 2, health: 10 })
  resolveAbility(state, '08044', { kind: 'free', assetCode: '08044', choose: pending => (pending.options.some(option => String(option.id) === '0') ? '0' : null) })
  current = me(state).assets.find(card => card.code === '08044')
  assert.equal(current.uses, 3, '扣减 1 灵脉到调查员（近似：仅扣减灵脉数）')
  me(state).damage = 2
  me(state).hand = []
  me(state).deck = ['10006', '10023']
  const action = legalMoves(state).find(option => option.action === 'ability' && option.assetId === current.id
    && String(option.label || '').includes('抽 1'))
  assert.ok(action, '通路档案应有抽牌/治愈行动')
  move(state, action)
  act(state, pending => (pending.options.some(option => option.id === 'damage') ? 'damage' : null))
  assert.equal(me(state).hand.length, 1, '抽 1 张')
  assert.equal(me(state).damage, 1, '治愈 1 点伤害')
})

================================================================================
## 08045  [tests/eote-player-m2-1.test.mjs:393]
// ── 08045 亵渎预言 ──────────────────────────────────────────────────────────
test('P6 08045 亵渎预言 入场指定坐标点；不在坐标点时 +1[智力] +1[敏捷] 且忽略趁乱攻击；可移动任意调查员至坐标点', () => {
  const state = fixture('01001')
  me(state).assets = []
  const prophecy = asset(state, '08045')
  twoLocations(state)
  const baseIntellect = ALL_CARDS['01001'].intellect
  const baseAgility = ALL_CARDS['01001'].agility
  // 入场：选择阁楼为坐标点。
  resolveAbility(state, '08045', {
    kind: 'entersPlay',
    choose: pending => (pending.options.some(option => option.id === 'attic') ? 'attic' : null),
  })
  const coordinate = state.locations.find(location => (location.traitGrants?.Coordinate || []).includes('08045'))
  assert.equal(coordinate?.id, 'attic', '坐标点 = 阁楼（地点特性原语记账）')
  assert.equal(getStat(state, me(state), 'intellect'), baseIntellect + 1, '不在坐标点：+1 智力')
  assert.equal(getStat(state, me(state), 'agility'), baseAgility + 1, '不在坐标点：+1 敏捷')
  assert.ok(registeredEntry('08045').modifiers.some(modifier => modifier.target === 'ignore:opportunityAttack'),
    '忽略趁乱攻击的修正读点')
  // 行动：移动自己到坐标点。
  const action = legalMoves(state).find(option => option.action === 'ability' && option.assetId === prophecy.id)
  assert.ok(action, '亵渎预言应有移动行动')
  move(state, action)
  act(state)
  assert.equal(me(state).location, 'attic', '移动到坐标点')
  assert.equal(getStat(state, me(state), 'intellect'), baseIntellect, '在坐标点时不再 +1 智力')
  // 离场：撤销坐标点特性。
  resolveAbility(state, '08045', { kind: 'leavesPlay' })
  assert.equal(state.locations.find(location => (location.traitGrants?.Coordinate || []).includes('08045')), undefined,
    '离场后坐标点标记被撤销')
})

================================================================================
## 08046  [tests/eote-player-m2-1.test.mjs:668]
// ── 08046 地下支持（approximation：构筑限制待 P7）───────────────────────────
test('P6 08046 地下支持 建造时牌库 -5（近似：同名限制待构筑层接线）', () => {
  const state = fixture('01001')
  const baseRules = deckRules(me(state))
  const builtRules = deckRules(me(state), ['08046'], {})
  assert.equal(builtRules.size, baseRules.size - 5, '构筑层牌库 -5')
  assert.equal(registeredEntry('08046').deckConstruction.sizeBonus, -5)
})

================================================================================
## 08047  [tests/eote-player-m2-1.test.mjs:677]
// ── 08047 提前侦察（approximation）──────────────────────────────────────────
test('P6 08047 提前侦察 最多移动 3 次，移动期间不与敌交战（approximation：移动后立即解除交战）', () => {
  const state = fixture('01001')
  me(state).assets = []
  twoLocations(state)
  state.enemies.push({
    id: 'watcher', code: 'ghoulMinion', name: '旁观敌人', location: 'attic',
    fight: 2, evade: 2, health: 10, damageTaken: 0, damage: 1, horror: 1, engagedSeat: null, exhausted: false,
  })
  let moves = 0
  const plan = ['attic', 'study', 'attic']
  resolvePlayed(state, '08047', {
    choose: pending => {
      const wanted = plan[moves]
      const option = pending.options.find(item => item.id === wanted)
      if (!option) return pending.options.some(item => item.id === 'stop') ? 'stop' : null
      moves += 1
      return option.id
    },
  })
  assert.equal(moves, 3, '最多移动 3 次')
  assert.equal(me(state).location, 'attic', '按选择移动 3 次')
  assert.equal(freshEnemy(state, 'watcher').engagedSeat, null, '移动期间/结束后均未与敌人交战')
})

================================================================================
## 08048  [tests/eote-player-m2-1.test.mjs:425]
// ── 08048 21点 ──────────────────────────────────────────────────────────────
test('P6 08048 21点 依次揭示直到停下，按总和（忽视 +/-）获得资源', () => {
  const state = fixture('01001')
  me(state).resources = 0
  // 总和 19：10 + 5 + 2 + 2（符号取绝对值）。逐枚揭示用 debugNextTokens 固定顺序。
  state.chaosBag = ['autofail', 'skull', '+2', '-2']
  state.debugNextTokens = ['autofail', 'skull', '+2', '-2']
  let count = 0
  resolvePlayed(state, '08048', {
    choose: pending => {
      if (pending.options.some(option => option.id === 'continue') && count < 4) { count += 1; return 'continue' }
      return pending.options.some(option => option.id === 'stop') ? 'stop' : null
    },
  })
  assert.equal(count, 4, '依次揭示 4 枚后停下')
  assert.equal(me(state).resources, 5, '总和 19 → 获得 5 资源')
  // [elder_sign] 视作 11：11 + 10 = 21 → 获得 9 资源。
  me(state).resources = 0
  state.chaosBag = ['eldersign', 'autofail']
  state.debugNextTokens = ['eldersign', 'autofail']
  let count2 = 0
  resolvePlayed(state, '08048', {
    choose: pending => {
      if (pending.options.some(option => option.id === '11')) return '11'
      if (pending.options.some(option => option.id === 'continue') && count2 < 2) { count2 += 1; return 'continue' }
      return pending.options.some(option => option.id === 'stop') ? 'stop' : null
    },
  })
  assert.equal(count2, 2, '揭示 2 枚后停下')
  assert.equal(me(state).resources, 9, '总和 21 → 获得 9 资源')
})

================================================================================
## 08049  [tests/eote-player-m2-2.test.mjs:125]
test('P6 08049 反间谍活动：取消诡计显现并由「遭遇牌库→你的牌库」升级改抽自己牌库', () => {
  // 主效果：取消该诡计显现，并从遭遇牌库抽牌（此处遭遇牌库为空，只断言取消与结算日志）。
  const s = game()
  const inv = s.investigators[0]
  inv.hand = ['08049']
  inv.resources = 10
  s.encounterDeck = []
  s.encounterDiscard = []
  const context = { when: 'treachery', seat: 0, location: inv.location, cardCode: 'dissonantVoices', cancelled: false }
  runDescriptor(s, '08049', 'played', { context })
  assert.equal(context.cancelled, true, '取消该卡牌的显现')
  assert.ok((s.log || []).some(line => String(line).includes('反间谍活动')), '日志记录结算')

  // 「你的牌库」升级：playUpgrades.yourDeck → 改为抽自己的牌库顶。
  const upgraded = game()
  const upInv = upgraded.investigators[0]
  upInv.deck = Array(10).fill('01088')
  const context2 = {
    when: 'treachery', seat: 0, location: upInv.location, cardCode: 'dissonantVoices',
    cancelled: false, playCost: { playUpgrades: { yourDeck: true } },
  }
  const deckBefore = upInv.deck.length
  runDescriptor(upgraded, '08049', 'played', { context: context2 })
  assert.equal(context2.cancelled, true)
  assert.equal(upgraded.investigators[0].deck.length, deckBefore - 1, '升级后抽自己的牌库顶')

  // beforePlayCost 升级描述子：提升费用 2 点并记录 playUpgrades。
  const kickerState = game()
  const costContext = { cardCode: '08049', cost: 2, costIncrease: 0 }
  runDescriptor(kickerState, '08049', 'reaction', { context: costContext, ignoreCosts: true })
  assert.equal(costContext.costIncrease, 2, '提升费用 2 点')
  assert.equal(costContext.playUpgrades?.yourDeck, true, '记录「你的牌库」升级')
  // 第二条升级（"你"→"任意调查员"）近似：花 2 点记录升级（跨座位触发待原语）。
  const anyContext = { cardCode: '08049', cost: 2, costIncrease: 0 }
  runDescriptor(kickerState, '08049', 'reaction', { context: anyContext, ignoreCosts: true, index: 1 })
  assert.equal(anyContext.costIncrease, 2, '第二条升级同样提升费用 2 点')
  assert.equal(anyContext.playUpgrades?.anyInvestigator, true, '记录「任意调查员」升级（近似）')
})

================================================================================
## 08050  [tests/eote-player-m2-2.test.mjs:164]
test('P6 08050 欺骗制度：每控制一种不同职阶获得 1 资源；无卡牌时不获得', () => {
  const s = game()
  const inv = s.investigators[0]
  asset(s, '01028') // guardian
  asset(s, '01030') // seeker
  inv.resources = 3
  runDescriptor(s, '08050', 'played')
  assert.equal(s.investigators[0].resources, 5, '两种职阶 → +2 资源')

  const empty = game()
  empty.investigators[0].resources = 3
  runDescriptor(empty, '08050', 'played')
  assert.equal(empty.investigators[0].resources, 3, '没有控制的卡牌 → 不获得资源')
})

================================================================================
## 08051  [tests/eote-player-m2-2.test.mjs:545]
test('P6 08051 不当交易：揭示手牌道具，另一位调查员打出后你抽 1 并获得其印刷费用资源', () => {
  const s = fixture('01001', 2)
  s.abilityLimits = {}
  const inv = s.investigators[0]
  inv.hand = ['01030']
  inv.resources = 5
  inv.deck = Array(10).fill('01088')
  const before = { resources: inv.resources, deck: inv.deck.length }
  runDescriptor(s, '08051', 'played', { select: choice => {
    if (choice.options.some(option => option.id === '01030')) return '01030'
    if (choice.options.some(option => option.id === '1')) return '1'
    if (choice.options.some(option => option.id === 'play')) return 'play'
    return null
  } })
  const other = s.investigators[1]
  assert.equal(other.assets.some(item => item.code === '01030'), true, '道具被另一位调查员打出并置于其控制下')
  assert.equal(s.investigators[0].hand.includes('01030'), false, '手牌已离手')
  assert.equal(s.investigators[0].resources, before.resources + (Number(ALL_CARDS['01030'].cost) || 0), '获得该支援印刷费用的资源')
  assert.equal(s.investigators[0].deck.length, before.deck - 1, '抽取 1 张卡牌')
})

================================================================================
## 08052  [tests/eote-player-m2-2.test.mjs:179]
test('P6 08052 行业专家：获得等于最低（未检定）技能值的万能图标', () => {
  const s = game()
  const inv = s.investigators[0]
  const printed = ALL_CARDS[inv.code]
  const stats = { willpower: printed.willpower, intellect: printed.intellect, combat: printed.combat, agility: printed.agility }
  const expected = Math.min(stats.intellect, stats.combat, stats.agility)
  s.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [] }
  assert.equal(commitIcons(s, inv, '08052', 'willpower'), (ALL_CARDS['08052'].icons?.wild || 0) + expected, 'willpower 检定：取其余三项最低值')
  s.skillTest = { seat: 0, skill: 'agility', difficulty: 2, committed: [] }
  assert.equal(commitIcons(s, inv, '08052', 'agility'), (ALL_CARDS['08052'].icons?.wild || 0) + Math.min(stats.willpower, stats.intellect, stats.combat))
})

================================================================================
## 08053  [tests/eote-player-m2-2.test.mjs:566]
test('P6 08053 红色闹钟（2经验）：回合开始放充能/拿资源，1/2/3 充能分支', () => {
  const s = game()
  const inv = s.investigators[0]
  const clock = asset(s, '08053')
  clock.uses = 0
  runDescriptor(s, '08053', 'forced', { context: { when: 'turnBegins', seat: 0 } })
  assert.equal(s.investigators[0].assets.find(item => item.id === clock.id).uses, 1, '放置 1 充能')
  assert.ok((s.effects || []).some(effect => (effect.modifiers || []).some(modifier => modifier.target === 'skill:*' && modifier.amount === 3)), '1 充能：下一次技能检定 +3 效果已挂')

  // 2 充能分支：移动最多 2 次（本次选择不移动）。
  const clock2 = s.investigators[0].assets.find(item => item.id === clock.id)
  clock2.uses = 1
  runDescriptor(s, '08053', 'forced', { context: { when: 'turnBegins', seat: 0 }, select: choice => (choice.options.some(option => option.id === 'skip') ? 'skip' : null) })
  assert.equal(s.investigators[0].assets.find(item => item.id === clock.id).uses, 2, '2 充能分支')
  // 3 充能分支：额外行动。
  s.investigators[0].assets.find(item => item.id === clock.id).uses = 2
  const actionsBefore = s.investigators[0].actionsLeft
  runDescriptor(s, '08053', 'forced', { context: { when: 'turnBegins', seat: 0 }, select: choice => (choice.options.some(option => option.id === 'skip') ? 'skip' : null) })
  assert.equal(s.investigators[0].actionsLeft, actionsBefore + 1, '3 充能：本回合额外 1 次行动')

  // 拿取充能作为资源分支。
  const takeState = game()
  const takeInv = takeState.investigators[0]
  const takeClock = asset(takeState, '08053')
  takeClock.uses = 2
  takeInv.resources = 0
  runDescriptor(takeState, '08053', 'forced', { context: { when: 'turnBegins', seat: 0 }, select: choice => (choice.options.some(option => option.id === 'take') ? 'take' : null) })
  assert.equal(takeState.investigators[0].resources, 2, '拿取 2 充能作为 2 资源')
})

================================================================================
## 08054  [tests/eote-player-m2-2.test.mjs:191]
test('P6 08054 金钱万能：把进行中的检定改为资源技能检定并抽 1 张', () => {
  const s = game()
  const inv = s.investigators[0]
  inv.resources = 8
  inv.deck = Array(10).fill('01088')
  s.skillTest = { seat: 0, skill: 'willpower', difficulty: 3, committed: [], baseValue: 4, value: 4 }
  const deckBefore = inv.deck.length
  runDescriptor(s, '08054', 'played')
  assert.equal(s.skillTest.resourceSkill, true, '转为资源技能检定')
  assert.equal(s.skillTest.baseValue, 4, '基础值 = floor(8/2)')
  assert.deepEqual(s.skillTest.skill, [])
  assert.equal(s.investigators[0].deck.length, deckBefore - 1, '抽 1 张牌')
})

================================================================================
## 08055  [tests/eote-player-m2-2.test.mjs:596]
test('P6 08055 黑市：从任意调查员牌库顶揭示共 5 张放在一边（近似：置入弃牌堆）', () => {
  const s = game()
  const inv = s.investigators[0]
  inv.deck = Array(10).fill('01088')
  const deckBefore = inv.deck.length
  runDescriptor(s, '08055', 'played', { select: choice => (choice.options.some(option => option.id === 'skip') ? 'skip' : null) })
  assert.equal(s.investigators[0].deck.length, deckBefore - 5, '从牌库顶揭示 5 张')
  assert.equal(s.investigators[0].discard.length, 5, '放在一边的牌进入弃牌堆（近似）')
})

================================================================================
## 08056  [tests/eote-player-m2-2.test.mjs:205]
test('P6 08056 刚毅果敢：+1 意志/+1 敏捷、沉稳先吃非直接恐惧、花 1 资源 +1 档位', () => {
  const s = game()
  const inv = s.investigators[0]
  asset(s, '08056')
  assert.equal(registeredEntry('08056').composure, true, '沉稳关键字')
  assert.deepEqual(registeredEntry('08056').freeTriggers.map(trigger => trigger.skill), ['willpower', 'agility'])
  assert.equal(getStat(s, inv, 'willpower'), Number(ALL_CARDS['01001'].willpower) + 1, '+1 意志')
  assert.equal(getStat(s, inv, 'agility'), Number(ALL_CARDS['01001'].agility) + 1, '+1 敏捷')
  // freeTrigger：技能检定期间花 1 资源 +1 技能值。
  s.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [], value: 4, freeTriggerUses: {} }
  let paidOnce = false
  transact(s, draft => {
    draft.__freeTriggerBonus = applyFreeTriggers(draft, draft.investigators[0], 'willpower', [])
  }, choice => {
    if (!paidOnce && choice.options.some(option => option.id === 'pay')) { paidOnce = true; return 'pay' }
    return null
  })
  assert.equal(s.__freeTriggerBonus, 1, '花 1 资源 +1 档位')
  assert.equal(s.investigators[0].resources, 29, '资源已支付')
  // 沉稳：非直接恐惧必须先分配给刚毅果敢（该卡神智 1，1 点恐惧即被击败；调查员不承受）。
  transact(s, draft => { applyHarm(draft, draft.investigators[0], 0, 1, []) })
  assert.equal(s.investigators[0].horror, 0, '非直接恐惧没有落到调查员身上')
  const stillThere = s.investigators[0].assets.find(item => item.code === '08056')
  const inDiscard = (s.investigators[0].discard || []).includes('08056')
  assert.ok((stillThere?.horror || 0) === 1 || inDiscard, '沉稳先承受非直接恐惧（随后因神智满被击败）')
  // approximation：非直接伤害用 redirectOneDamageToSelf 近似（每次结算 1 点转移到本卡）。
  const redirect = game()
  asset(redirect, '08056')
  transact(redirect, draft => { applyHarm(draft, draft.investigators[0], 2, 0, []) })
  const redirectMoxie = redirect.investigators[0].assets.find(item => item.code === '08056')
  assert.equal(redirect.investigators[0].damage, 1, '2 点非直接伤害中 1 点转移到刚毅果敢')
  assert.equal(redirectMoxie?.damage || 0, 1, '刚毅果敢先承受 1 点非直接伤害（近似）')
})

================================================================================
## 08057  [tests/eote-player-m2-2.test.mjs:239]
test('P6 08057 黑色扇子：资源阈值 15/20 的每回合额外行动与技能修正（10+ 生命/神智待引擎读点）', () => {
  const s = game()
  const inv = s.investigators[0]
  const fan = asset(s, '08057')
  inv.resources = 0
  const baseWillpower = getStat(s, inv, 'willpower')
  assert.equal(getStat(s, inv, 'willpower'), baseWillpower, '20 资源以下无技能加值')
  s.investigators[0].resources = 15
  const actionsBefore = s.investigators[0].actionsLeft
  const move15 = legalMoves(s, 0).find(command => command.action === 'ability' && command.assetId === fan.id)
  assert.ok(move15, '15+ 资源：额外行动能力进入合法动作')
  move(s, move15)
  settle(s)
  assert.equal(s.investigators[0].actionsLeft, actionsBefore + 1, '本回合额外 1 次行动')
  assert.equal(legalMoves(s, 0).some(command => command.action === 'ability' && command.assetId === fan.id), false, '每回合仅一次')
  s.investigators[0].resources = 20
  assert.equal(getStat(s, s.investigators[0], 'willpower'), baseWillpower + 1, '20+ 资源：每项技能 +1')
  // approximation：引擎 getMaxHealth/getMaxSanity 不读 modifiers，+1 生命/神智用被动数据通道常驻实现。
  const statState = game()
  const statInv = statState.investigators[0]
  const baseHealth = getMaxHealth(statInv)
  const baseSanity = getMaxSanity(statInv)
  asset(statState, '08057')
  assert.equal(getMaxHealth(statState.investigators[0]), baseHealth + 1, '+1 生命（近似：不按 10 资源条件）')
  assert.equal(getMaxSanity(statState.investigators[0]), baseSanity + 1, '+1 神智（近似：不按 10 资源条件）')
})

================================================================================
## 08058  [tests/eote-player-m2-2.test.mjs:606]
test('P6 08058 红色闹钟（5经验）：先拿取再放充能，1/2/3 充能分支', () => {
  const s = game()
  const inv = s.investigators[0]
  const clock = asset(s, '08058')
  clock.uses = 0
  runDescriptor(s, '08058', 'forced', { context: { when: 'turnBegins', seat: 0 } })
  assert.equal(s.investigators[0].assets.find(item => item.id === clock.id).uses, 1, '放置 1 充能')
  assert.ok((s.effects || []).some(effect => (effect.modifiers || []).some(modifier => modifier.target === 'skill:*' && modifier.amount === 4)), '1 充能：下一次技能检定 +4 效果已挂')
  // 先拿取再放置：选择不拿取 → 2 充能 + 放置 1 = 3 充能 → 2 次额外行动。
  const fresh = s.investigators[0].assets.find(item => item.id === clock.id)
  fresh.uses = 2
  s.investigators[0].resources = 0
  const actionsBefore = s.investigators[0].actionsLeft
  runDescriptor(s, '08058', 'forced', { context: { when: 'turnBegins', seat: 0 }, select: choice => {
    if (choice.options.some(option => option.id === 'skip')) return 'skip'
    return null
  } })
  assert.equal(s.investigators[0].resources, 0, '选择不拿取时资源不变')
  assert.equal(s.investigators[0].assets.find(item => item.id === clock.id).uses, 3, '2 充能 + 放置 1 = 3 充能')
  assert.equal(s.investigators[0].actionsLeft, actionsBefore + 2, '3 充能：本回合额外 2 次行动')

  // 「先拿取全部充能作为资源」分支：2 充能 → 拿取 2 资源后再放 1（净 1 充能）。
  const takeState = game()
  const takeClock = asset(takeState, '08058')
  takeClock.uses = 2
  takeState.investigators[0].resources = 0
  runDescriptor(takeState, '08058', 'forced', { context: { when: 'turnBegins', seat: 0 }, select: choice => {
    if (choice.options.some(option => option.id === 'take')) return 'take'
    return null
  } })
  assert.equal(takeState.investigators[0].resources, 2, '拿取 2 充能作为资源')
  assert.equal(takeState.investigators[0].assets.find(item => item.id === takeClock.id).uses, 1, '拿取后放置 1 充能')
})

================================================================================
## 08059  [tests/eote-player-m2-2.test.mjs:640]
test('P6 08059 掉进兔子洞：建库身份参数写入场景标记（近似：真实升级计价待 P7）', () => {
  const s = game()
  runDescriptor(s, '08059', 'setup')
  const flag = s.scenarioFlags?.downTheRabbitHole
  assert.equal(flag?.upgradeDiscountFirst, 2, '前 2 张升级 -1 经验参数')
  assert.equal(flag?.purchaseCostDelta, 1, '新购卡 +1 经验参数')
})

================================================================================
## 08060  [tests/eote-player-m2-2.test.mjs:266]
test('P6 08060 咏春棍：额外法术槽；每个已填槽 +1 战斗，至少 2 个则 +1 伤害', () => {
  const s = game()
  const inv = s.investigators[0]
  asset(s, '08060')
  const pole = inv.assets[0]
  asset(s, '01060') // 皱缩术（Arcane）
  asset(s, '01061') // 探知术（Arcane）
  const e = enemy(s, { fight: 1, evade: 1, health: 30, damage: 0 })
  s.chaosBag = ['+3']
  const fightMove = legalMoves(s, 0).find(command => command.action === 'ability' && command.assetId === pole.id && command.abilityIndex === 0)
  assert.ok(fightMove, '攻击能力进入合法动作')
  move(s, fightMove)
  settle(s, choice => choice.kind === 'target' ? e.id : null)
  assert.equal(s.lastTestResult.success, true)
  assert.equal(s.enemies.find(item => item.id === e.id).damageTaken, 2, '基础 1 伤害 + 2 已填法术槽的 +1 伤害')

  // 负面路径：没有已填法术槽时只有基础 1 伤害，也没有战斗加值。
  const bare = game()
  const barePole = asset(bare, '08060')
  const bareEnemy = enemy(bare, { fight: 1, evade: 1, health: 30, damage: 0 })
  bare.chaosBag = ['0']
  const bareMove = legalMoves(bare, 0).find(command => command.action === 'ability' && command.assetId === barePole.id)
  move(bare, bareMove)
  settle(bare, choice => choice.kind === 'target' ? bareEnemy.id : null)
  assert.equal(bare.enemies.find(item => item.id === bareEnemy.id).damageTaken, 1, '0 个已填法术槽：仅基础 1 伤害')
})

================================================================================
## 08061  [tests/eote-player-m2-2.test.mjs:293]
test('P6 08061 冥想放空：每个已填法术槽治愈 1 点伤害或恐惧', () => {
  const s = game()
  const inv = s.investigators[0]
  asset(s, '01060')
  asset(s, '01061')
  inv.damage = 1
  inv.horror = 1
  runDescriptor(s, '08061', 'played', { select: choice => (choice.options.some(option => option.id === 'damage') ? 'damage' : null) })
  assert.equal(s.investigators[0].damage, 0, '第一个已填槽治愈 1 点伤害')
  assert.equal(s.investigators[0].horror, 0, '第二个已填槽治愈 1 点恐惧')
  // 负面路径：没有已填法术槽时不治愈。
  const none = game()
  none.investigators[0].damage = 1
  runDescriptor(none, '08061', 'played')
  assert.equal(none.investigators[0].damage, 1, '没有已填法术槽 → 不治愈')
})

================================================================================
## 08062  [tests/eote-player-m2-2.test.mjs:648]
test('P6 08062 闭环：入场充能数=职阶数；花 1 充能横置执行一次基础行动', () => {
  const s = game()
  const inv = s.investigators[0]
  const circle = asset(s, '08062')
  asset(s, '01028') // guardian
  asset(s, '01030') // seeker
  runDescriptor(s, '08062', 'entersPlay', { source: circle })
  const fresh = s.investigators[0].assets.find(item => item.id === circle.id)
  assert.equal(fresh.uses, 3, '职阶数（neutral/guardian/seeker）= 3 充能')
  // 执行一次基础行动：选任意一个基础行动执行。
  let sawActionChoice = false
  runDescriptor(s, '08062', 'free', {
    source: fresh, ignoreCosts: false,
    select: choice => {
      if (choice.kind === 'action') { sawActionChoice = true; return choice.options[0].id }
      return null
    },
  })
  assert.equal(sawActionChoice, true, '发起一次基础行动选择')
  const after = s.investigators[0].assets.find(item => item.id === circle.id)
  assert.equal(after.exhausted, true, '横置已支付')
  assert.equal(after.uses, 2, '花费 1 充能')
})

================================================================================
## 08063  [tests/eote-player-m2-2.test.mjs:310]
test('P6 08063 力量之风：打出时放置 2 充能；回合中抽到时自动打出', () => {
  const s = game()
  const inv = s.investigators[0]
  const target = asset(s, '03236') // 使用(3 充能)
  target.uses = 1
  runDescriptor(s, '08063', 'played')
  assert.equal(s.investigators[0].assets.find(item => item.id === target.id).uses, 3, '打出：放置 2 充能')

  // 抽到时打出：reaction 描述子与 played 使用同一效果（quickEvent/trigger 已注册）。
  const quick = registeredEntry('08063').abilities.find(ability => ability.quickEvent === true)
  assert.ok(quick, '抽到时打出的快速事件描述子')
  assert.equal(quick.trigger.includes('cardDrawn'), true)
  const drawn = game()
  const drawnTarget = asset(drawn, '03236')
  drawnTarget.uses = 0
  drawn.investigators[0].hand = ['08063']
  runDescriptor(drawn, '08063', 'reaction', { index: 0 })
  assert.equal(drawn.investigators[0].assets.find(item => item.id === drawnTarget.id).uses, 2, '抽到后打出：放置 2 充能')
})

================================================================================
## 08064  [tests/eote-player-m2-2.test.mjs:672]
test('P6 08064 先见：指定卡牌与抽到的卡相同 → 取消/弃掉；遭遇牌可取消显现', () => {
  const s = game()
  const inv = s.investigators[0]
  inv.hand = ['01088', '01031']
  runDescriptor(s, '08064', 'played', {
    context: { when: 'cardDrawn', seat: 0, location: inv.location, cardCode: '01088' },
    select: choice => {
      if (choice.options.some(option => option.id === '01088')) return '01088'
      if (choice.options.some(option => option.id === 'cancel')) return 'cancel'
      return null
    },
  })
  assert.equal(s.investigators[0].hand.includes('01088'), false, '取消并弃掉抽到的卡牌')
  assert.equal((s.investigators[0].discard || []).includes('01088'), true)

  const encounter = game()
  const context = { when: 'encounterDrawn', seat: 0, location: encounter.investigators[0].location, cardCode: 'dissonantVoices', cancelled: false }
  runDescriptor(encounter, '08064', 'played', {
    context,
    select: choice => {
      if (choice.options.some(option => option.id === 'dissonantVoices')) return 'dissonantVoices'
      if (choice.options.some(option => option.id === 'cancel')) return 'cancel'
      return null
    },
  })
  assert.equal(context.cancelled, true, '遭遇牌的显现被取消')
})

================================================================================
## 08065  [tests/eote-player-m2-2.test.mjs:330]
test('P6 08065 密教理论：投入时获得等于[智慧]的[意志]图标与等于[意志]的[智慧]图标', () => {
  const s = game()
  const inv = s.investigators[0]
  const printed = ALL_CARDS[inv.code]
  s.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [] }
  assert.equal(commitIcons(s, inv, '08065', 'willpower'), printed.intellect, '意志检定：等于智慧的意志图标')
  s.skillTest = { seat: 0, skill: 'intellect', difficulty: 2, committed: [] }
  assert.equal(commitIcons(s, inv, '08065', 'intellect'), printed.willpower, '智慧检定：等于意志的智慧图标')
})

================================================================================
## 08066  [tests/eote-player-m2-2.test.mjs:340]
test('P6 08066 平行命运：查看 6 张后放回且可抽取 1 张；洗回分支来自同一读点', () => {
  const s = game()
  const inv = s.investigators[0]
  inv.deck = ['01088', '01088', '01088', '01088', '01088', '01088', '01088', '01088']
  const deckBefore = inv.deck.length
  runDescriptor(s, '08066', 'played', { select: choice => {
    if (choice.options.some(option => option.id === 'draw')) return 'draw'
    if (choice.options.some(option => option.id === 'top')) return 'top'
    if (choice.options.some(option => option.id === 'shuffle')) return 'top'
    return null
  } })
  const after = s.investigators[0]
  assert.equal(after.deck.length, deckBefore - 1, '查看 6 张后抽取 1 张（其余放回牌库顶）')

  // 洗回分支：不丢牌，也不抽牌（选择不抽）。
  const shuffleState = game()
  const shuffleInv = shuffleState.investigators[0]
  shuffleInv.deck = ['01088', '01088', '01088', '01088', '01088', '01088']
  runDescriptor(shuffleState, '08066', 'played', { select: choice => {
    if (choice.options.some(option => option.id === 'shuffle')) return 'shuffle'
    if (choice.options.some(option => option.id === 'skip')) return 'skip'
    return null
  } })
  assert.equal(shuffleState.investigators[0].deck.length, 6, '洗回分支：卡牌全部回到牌库')
})

================================================================================
## 08067  [tests/eote-player-m2-2.test.mjs:366]
test('P6 08067 天文地图集：横置看顶 1 张，非弱点则正面朝下附属（最多 5 张）', () => {
  const s = game()
  const inv = s.investigators[0]
  const atlas = asset(s, '08067')
  inv.deck = ['01088', '01088', '01088', '01088', '01088', '01088', '01031']
  const look = legalMoves(s, 0).find(command => command.action === 'ability' && command.assetId === atlas.id && command.abilityIndex === 0)
  assert.ok(look, '看顶能力进入合法动作')
  move(s, look)
  settle(s)
  const freshAtlas = s.investigators[0].assets.find(item => item.id === atlas.id)
  assert.equal(freshAtlas.exhausted, true)
  assert.equal((freshAtlas.attachments || []).length, 1, '非弱点顶牌附属到地图集')
  assert.equal(freshAtlas.attachments[0].code, '01031')
  assert.equal(freshAtlas.attachments[0].facedown, true, '正面朝下')
  assert.equal(s.investigators[0].deck.includes('01031'), false, '离开牌库')

  // 负面路径：顶牌是弱点时不附属。
  const weak = game()
  const weakInv = weak.investigators[0]
  const weakAtlas = asset(weak, '08067')
  weakInv.deck = ['01088', '01096']
  const weakLook = legalMoves(weak, 0).find(command => command.action === 'ability' && command.assetId === weakAtlas.id)
  move(weak, weakLook)
  settle(weak)
  assert.equal((weak.investigators[0].assets[0].attachments || []).length, 0, '弱点不附属')
  assert.equal(weak.investigators[0].deck.includes('01096'), true, '弱点留在牌库')

  // 能力 2 近似：把附属牌投入检定（+图标），检定成功则加入手牌。
  const invest = game()
  const investInv = invest.investigators[0]
  const investAtlas = asset(invest, '08067')
  investAtlas.attachments = [{ id: 'aTest1', code: '01031', ownerSeat: 0, facedown: true }]
  invest.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [] }
  investAtlas.exhausted = false
  runDescriptor(invest, '08067', 'free', {
    source: investAtlas, index: 1, ignoreCosts: true,
    select: choice => (choice.options.some(option => option.id === 'aTest1') ? 'aTest1' : null),
  })
  const iconBonus = 1 // 01031 的图标为 willpower 1
  assert.equal(invest.skillTest.pendingBonus, iconBonus, '附属牌按图标数加入本次检定')
  assert.equal(invest.investigators[0].assets.find(item => item.id === investAtlas.id).attachments[0].uses, 1, '标记为已投入')
  runDescriptor(invest, '08067', 'reaction', {
    source: invest.investigators[0].assets.find(item => item.id === investAtlas.id),
    context: { when: 'testEnds', success: true, seat: 0 },
  })
  assert.equal(invest.investigators[0].hand.includes('01031'), true, '检定成功后加入手牌（近似）')
})

================================================================================
## 08068  [tests/eote-player-m2-2.test.mjs:414]
test('P6 08068 治愈真言：花费 1 充能治愈同地点调查员总计 2 点伤害', () => {
  const s = game()
  const inv = s.investigators[0]
  const words = asset(s, '08068')
  words.uses = 4
  inv.damage = 2
  const healMove = legalMoves(s, 0).find(command => command.action === 'ability' && command.assetId === words.id)
  assert.ok(healMove, '治愈能力进入合法动作')
  move(s, healMove)
  settle(s)
  assert.equal(s.investigators[0].damage, 0, '总计治愈 2 点伤害')
  assert.equal(s.investigators[0].assets.find(item => item.id === words.id).uses, 3, '花费 1 充能')
})

================================================================================
## 08069  [tests/eote-player-m2-2.test.mjs:428]
test('P6 08069 情绪稳定：沉稳先吃非直接恐惧；法术检定期间 +1 技能值', () => {
  const s = game()
  const inv = s.investigators[0]
  asset(s, '08069')
  assert.deepEqual(registeredEntry('08069').freeTriggers.map(trigger => trigger.requireTestTrait), ['Spell'])
  assert.equal(registeredEntry('08069').composure, true)
  transact(s, draft => { applyHarm(draft, draft.investigators[0], 0, 1, []) })
  assert.equal(s.investigators[0].assets.find(item => item.code === '08069').horror || 0, 1, '沉稳先承受非直接恐惧')
  assert.equal(s.investigators[0].horror, 0)
  // 法术卡技能检定：+1 技能值（01060 皱缩术是 Spell 卡）。
  const withSpell = game()
  asset(withSpell, '08069')
  const base = getStat(withSpell, withSpell.investigators[0], 'willpower')
  withSpell.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [], source: { code: '01060' } }
  assert.equal(getStat(withSpell, withSpell.investigators[0], 'willpower'), base + 1, '法术检定期间 +1 技能值')
  withSpell.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [], source: { code: '01088' } }
  assert.equal(getStat(withSpell, withSpell.investigators[0], 'willpower'), base, '非法术检定无加值')
})

================================================================================
## 08070  [tests/eote-player-m2-2.test.mjs:700]
test('P6 08070 真法魔典：揭示手牌法术支援并结算其能力', () => {
  const s = game()
  const inv = s.investigators[0]
  asset(s, '08070')
  inv.hand = ['01060'] // 皱缩术（Spell 资产，带 [action] 攻击能力）
  enemy(s, { fight: 1, evade: 1, health: 10, damage: 0 })
  s.chaosBag = ['+2']
  runDescriptor(s, '08070', 'free', { source: inv.assets.find(item => item.code === '08070') })
  assert.ok(s.lastTestResult, '代理结算了法术卡上的技能检定能力')
})

================================================================================
## 08071  [tests/eote-player-m2-2.test.mjs:447]
test('P6 08071 补给匮乏：游戏第一个回合开始时弃掉牌库顶 10 张（每局一次）', () => {
  const s = game()
  const inv = s.investigators[0]
  asset(s, '08071')
  inv.deck = Array(15).fill('01088')
  inv.discard = []
  s.round = 1
  transact(s, draft => {
    // 通过 turnBegins 强制窗口结算（forced 描述子由 triggerReaction 自动结算）。
    triggerReaction(draft, 0, 'turnBegins', [], { seat: 0, when: 'turnBegins' })
  })
  assert.equal(s.investigators[0].deck.length, 5, '牌库顶 10 张被弃掉')
  assert.equal(s.investigators[0].discard.length, 10, '进入弃牌堆')
  // 每局一次：再次触发不再弃牌。
  transact(s, draft => {
    triggerReaction(draft, 0, 'turnBegins', [], { seat: 0, when: 'turnBegins' })
  })
  assert.equal(s.investigators[0].deck.length, 5, '同一局第二次触发不再弃牌')
})

================================================================================
## 08072  [tests/eote-player-m2-2.test.mjs:711]
test('P6 08072 沙夫纳的目录：花费秘密获得资源（近似秘密当资源）；秘密耗尽弃掉', () => {
  const s = game()
  const inv = s.investigators[0]
  const catalogue = asset(s, '08072')
  catalogue.uses = 5
  inv.resources = 0
  runDescriptor(s, '08072', 'free', { source: catalogue, ignoreCosts: false })
  assert.equal(s.investigators[0].assets.find(item => item.id === catalogue.id).uses, 4, '花费 1 秘密')
  assert.equal(s.investigators[0].resources, 1, '获得 1 资源')
  // 耗尽：用掉最后 1 个秘密后条目 discardWhenEmpty 弃掉。
  s.investigators[0].assets.find(item => item.id === catalogue.id).uses = 1
  runDescriptor(s, '08072', 'free', { source: s.investigators[0].assets.find(item => item.id === catalogue.id), ignoreCosts: false })
  assert.equal(s.investigators[0].assets.some(item => item.id === catalogue.id), false, '秘密耗尽后弃掉')
})

================================================================================
## 08073  [tests/eote-player-m2-2.test.mjs:467]
test('P6 08073 绷带：同地点调查员/盟友受伤后花 1 补给治愈 1 点', () => {
  const s = game()
  const inv = s.investigators[0]
  const bandages = asset(s, '08073')
  bandages.uses = 3
  inv.damage = 2
  runDescriptor(s, '08073', 'reaction', {
    index: 0, source: bandages, ignoreCosts: false,
    context: { when: 'harmAssigned', seat: 0, location: inv.location, damage: 1, horror: 0 },
  })
  assert.equal(s.investigators[0].damage, 1, '调查员 1 点伤害被治愈')
  assert.equal(s.investigators[0].assets.find(item => item.id === bandages.id).uses, 2, '花费 1 补给')

  // 盟友支援受伤：治愈该支援 1 点伤害。
  const allyState = game()
  const allyBandages = asset(allyState, '08073')
  allyBandages.uses = 3
  const ally = asset(allyState, '01018') // 巡警（盟友，生命 2）
  ally.damage = 1
  runDescriptor(allyState, '08073', 'reaction', {
    index: 1, source: allyBandages, ignoreCosts: false,
    context: { when: 'assetHarmPlaced', seat: 0, assetId: ally.id, damage: 1, horror: 0 },
  })
  assert.equal(allyState.investigators[0].assets.find(item => item.id === ally.id).damage, 0, '盟友 1 点伤害被治愈')
  assert.equal(allyState.investigators[0].assets.find(item => item.id === allyBandages.id).uses, 2, '花费 1 补给')
})

================================================================================
## 08074  [tests/eote-player-m2-2.test.mjs:726]
test('P6 08074 应急装备：附属到道具支援（3 耐久）；宿主检定期间花 1 耐久 +2', () => {
  const s = game()
  const inv = s.investigators[0]
  const host = asset(s, '01030') // 放大镜（道具）
  inv.hand = ['08074']
  runDescriptor(s, '08074', 'played', { select: choice => (choice.options.some(option => option.id === '0') ? '0' : null) })
  const hostAfter = s.investigators[0].assets.find(item => item.id === host.id)
  const attachment = (hostAfter.attachments || []).find(item => item.code === '08074')
  assert.ok(attachment, '应急装备附属到道具支援')
  assert.equal(attachment.uses, 3, '附属实例 3 耐久')
  s.skillTest = { seat: 0, skill: 'intellect', difficulty: 2, committed: [], source: { assetId: hostAfter.id } }
  runDescriptor(s, '08074', 'free', {
    source: attachment, ignoreCosts: false, index: 0,
    select: choice => (choice.options.some(option => option.id === 'skip') ? 'skip' : null),
  })
  assert.equal(s.skillTest.pendingBonus, 2, '本次检定 +2')
})

================================================================================
## 08075  [tests/eote-player-m2-2.test.mjs:494]
test('P6 08075 厄运手镯：检定中花 1 充能 +2（每次检定一次）；被攻击后获得充能', () => {
  const s = game()
  const inv = s.investigators[0]
  const bangle = asset(s, '08075')
  bangle.uses = 1
  s.skillTest = { seat: 0, skill: 'willpower', difficulty: 3, committed: [] }
  const abilityMove = legalMoves(s, 0).find(command => command.action === 'ability' && command.assetId === bangle.id && command.abilityIndex === 0)
  assert.ok(abilityMove, '检定中 +2 能力进入合法动作')
  move(s, abilityMove)
  settle(s)
  assert.equal(s.skillTest.pendingBonus, 2, '本次检定 +2')
  assert.equal(s.investigators[0].assets.find(item => item.id === bangle.id).uses, 0, '花费 1 充能')
  // 每次检定仅限一次：即使再补充能，本次检定也不能再次使用。
  s.investigators[0].assets.find(item => item.id === bangle.id).uses = 1
  assert.equal(legalMoves(s, 0).some(command => command.action === 'ability' && command.assetId === bangle.id), false, '每次检定仅一次')

  const attacked = game()
  const freshBangle = asset(attacked, '08075')
  freshBangle.uses = 0
  runDescriptor(attacked, '08075', 'reaction', {
    index: 0, source: freshBangle,
    context: { when: 'enemyAttacked', seat: 0, location: attacked.investigators[0].location, attack: { kind: 'fight' } },
  })
  assert.equal(attacked.investigators[0].assets.find(item => item.id === freshBangle.id).uses, 1, '被攻击后放置 1 充能')
})

================================================================================
## 08076  [tests/eote-player-m2-2.test.mjs:744]
test('P6 08076 阅后即焚：放逐一张 0-5 级手牌、发现 2 线索；等级≥2 时移除 1 毁灭', () => {
  const s = game()
  const inv = s.investigators[0]
  s.locations[0].clues = 2
  inv.hand = ['01088', '01028'] // 01088 event 0级；01028 巡警 2级
  inv.clues = 0
  s.doom = 1
  runDescriptor(s, '08076', 'played', {
    select: choice => (choice.options.some(option => option.id === '01088') ? '01088' : null),
  })
  assert.equal(s.investigators[0].hand.includes('01088'), false, '被放逐的 0 级卡离开手牌')
  assert.equal((s.removedFromGame || []).includes('01088'), true, '进入移除/放逐区')
  assert.equal(s.investigators[0].clues, 2, '发现 2 个线索')
  assert.equal(s.doom, 1, '0 级卡不移除毁灭印记')

  const high = game()
  const highInv = high.investigators[0]
  high.locations[0].clues = 2
  highInv.hand = ['01028'] // 2 级
  high.doom = 1
  runDescriptor(high, '08076', 'played', {
    select: choice => (choice.options.some(option => option.id === '01028') ? '01028' : null),
  })
  assert.equal(high.doom, 0, '等级 ≥2：移除当前密谋上的 1 个毁灭印记')
})

================================================================================
## 08077  [tests/eote-player-m2-2.test.mjs:520]
test('P6 08077 人多力量大：每有一种不同职阶获得 1 个万能图标', () => {
  const s = game()
  const inv = s.investigators[0]
  assert.equal(commitIcons(s, inv, '08077', 'willpower'), ALL_CARDS['08077'].icons?.wild || 0)
  asset(s, '01028') // guardian
  asset(s, '01030') // seeker
  s.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [] }
  assert.equal(commitIcons(s, inv, '08077', 'willpower'), (ALL_CARDS['08077'].icons?.wild || 0) + 2, '两种职阶 → 2 个万能图标')
})

================================================================================
## 08078  [tests/eote-player-m2-2.test.mjs:530]
test('P6 08078 无畏精神：获得等于[战斗]的[意志]图标与等于[意志]的[战斗]图标', () => {
  const s = game()
  const inv = s.investigators[0]
  const printed = ALL_CARDS[inv.code]
  s.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [] }
  assert.equal(commitIcons(s, inv, '08078', 'willpower'), printed.combat)
  s.skillTest = { seat: 0, skill: 'combat', difficulty: 2, committed: [] }
  assert.equal(commitIcons(s, inv, '08078', 'combat'), printed.willpower)
})