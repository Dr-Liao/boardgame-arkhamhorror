// Extracted without changing the P0 rule data or original card identities.
import { bindScenarioIdentities } from '../../../../identities.js'

export const scenario = {
    id: 'theDevourerBelow',
    name: '夜之狂热 · 第三幕：地底噬魔',
    intro: '你们跨入阿卡姆南边的密林，异教徒正要在那里完成召唤「乌默尔多斯」的仪式。必须阻止他们……',
    setup: '将主道路放置入场，从 6 张阿卡姆密林中随机抽出 4 张放置入场。将仪式场所和乌默尔多斯放在一边。随机选择 1 个「使者」遭遇组。按逃跑的异教徒数量在密谋上放毁灭。每位调查员从主道路开始。',
    resolutions: {
      noResolution: '丽塔逃跑了，阿卡姆被乌默尔多斯吞噬……（所有仍活着的调查员阵亡，调查失败。）',
      r1: '你成功阻止了邪教的仪式，召唤被迫中止。（每位调查员 +2 精神创伤，额外 5 经验。）',
      r2: '你在乌默尔多斯身上留下伤痕，将它击退。（每位调查员 +2 肉体与 +2 精神创伤，额外 10 经验。）',
      r3: '你将丽塔推向了乌默尔多斯……你活了下来，但代价惨痛。（每位调查员 +2 肉体与 +2 精神创伤。）',
    },

    startLocation: 'mainPath',
    setAsideLocations: ['ritualSite'],

    locations: {
      mainPath: {
        id: 'mainPath', name: '主道路', shroud: 2, clues: 0, victory: 0,
        connections: ['unhallowedGround', 'twistingPaths', 'oldHouse', 'cliffside', 'tangledThicket', 'quietGlade', 'ritualSite'],
        flavor: '主道路与其他每个树林地点连接。',
        text: '[action]：撤退。「我们根本无法阻止他们！」',
        resign: true,
      },
      unhallowedGround: {
        id: 'unhallowedGround', name: '阿卡姆密林 · 邪恶之地', shroud: 4, cluesPerInvestigator: 1, victory: 0,
        connections: ['mainPath', 'twistingPaths', 'quietGlade'],
        flavor: '这片空地一直被当作黑暗仪式的场所。',
        text: '强制 - 进入后：意志（4）检定，失败受到 1 点伤害和 1 点恐惧。',
        onEnter: { test: { skill: 'willpower', difficulty: 4 }, fail: { kind: 'damageAndHorror', damage: 1, horror: 1 } },
      },
      twistingPaths: {
        id: 'twistingPaths', name: '阿卡姆密林 · 扭曲的道路', shroud: 3, cluesPerInvestigator: 1, victory: 0,
        connections: ['mainPath', 'unhallowedGround', 'quietGlade'],
        flavor: '林中道路扭曲旋转，仿佛如活物一般。',
        text: '强制 - 离开时：智力（3）检定，失败取消本次移动。',
      },
      oldHouse: {
        id: 'oldHouse', name: '阿卡姆密林 · 老屋', shroud: 2, cluesPerInvestigator: 1, victory: 0,
        connections: ['mainPath', 'cliffside', 'tangledThicket'],
        flavor: '一座爬满藤曼的屋子坐落在小道的边缘。',
        text: '在本地点调查改为使用意志。',
        investigateSkill: 'willpower',
      },
      cliffside: {
        id: 'cliffside', name: '阿卡姆密林 · 悬崖边', shroud: 2, cluesPerInvestigator: 1, victory: 0,
        connections: ['mainPath', 'oldHouse', 'tangledThicket'],
        flavor: '要到那块高地的顶端，你将不得不攀崖而上。',
        text: '在本地点调查改为使用敏捷。',
        investigateSkill: 'agility',
      },
      tangledThicket: {
        id: 'tangledThicket', name: '阿卡姆密林 · 一团乱麻', shroud: 2, cluesPerInvestigator: 1, victory: 0,
        connections: ['mainPath', 'oldHouse', 'cliffside'],
        flavor: '一条殖民地时期的古老马道，早已是杂草丛生。',
        text: '在本地点调查改为使用战斗。',
        investigateSkill: 'combat',
      },
      quietGlade: {
        id: 'quietGlade', name: '阿卡姆密林 · 静谧空地', shroud: 1, clues: 0, victory: 0,
        connections: ['mainPath', 'unhallowedGround', 'twistingPaths'],
        flavor: '若非这些妖魔鬼怪，这将是处野餐胜地。',
        text: '[action]：治愈 1 点伤害或 1 点恐惧。（每回合仅限一次）',
        ability: { id: 'quietGladeHeal', label: '治愈 1 点伤害或 1 点恐惧', limit: 'player-turn', effect: { type: 'chooseOne', options: [{ label: '治愈 1 伤害', effect: { type: 'heal', amount: 1, what: 'damage' } }, { label: '治愈 1 恐惧', effect: { type: 'heal', amount: 1, what: 'horror' } }] } },
      },
      ritualSite: {
        id: 'ritualSite', name: '仪式地', shroud: 3, cluesPerInvestigator: 2, victory: 0,
        connections: ['mainPath', 'quietGlade', 'tangledThicket'],
        flavor: '墙上符文闪烁，若隐若现，空气中凝结着死亡的气息。',
        text: '强制 - 回合结束时，若线索少于调查员人数的 2 倍，补至 2 倍。',
      },
    },

    acts: [
      {
        id: 'act1', stage: '1a', name: '顺藤摸瓜',
        text: '收集线索，深入密林。',
        objective: { type: 'clues', perInvestigator: 3 },
        advanceText: '你找到了通往仪式地的道路！',
        reveal: { type: 'revealRitualSite' },
      },
      {
        id: 'act2', stage: '2a', name: '深入黑暗',
        text: '目标 - 如果有调查员进入仪式地，推进。',
        objective: { type: 'enterLocation', location: 'ritualSite' },
        advanceText: '你闯入仪式地，异教徒的吟唱就在眼前！',
        reveal: { type: 'drawEnemyAtRitualSite' },
      },
      {
        id: 'act3', stage: '3a', name: '阻止计划',
        text: '[action] 花费 1 个线索：意志（3）或敏捷（3）检定，成功在本场景上放 1 个线索。目标 - 本场景线索达到调查员人数的 2 倍则推进。',
        objective: { type: 'actClues', perInvestigator: 2 },
        advanceText: '仪式被破坏了！',
        reveal: { type: 'resolutionChoice' },
      },
    ],

    agendas: [
      {
        id: 'agenda1', stage: '1a', name: '阿卡姆密林', doomThreshold: 4,
        text: '',
        advanceText: '一个怪物从密林中现身！',
        reveal: { type: 'drawMonsterAtMainPath' },
      },
      {
        id: 'agenda2', stage: '2a', name: '仪式开始', doomThreshold: 5,
        text: '每个敌人得到 +1 攻击与 +1 躲避。',
        advanceText: '吟唱声越发响亮！',
        reveal: { type: 'madnessTest' },
        passive: { enemyFight: 1, enemyEvade: 1 },
      },
      {
        id: 'agenda3', stage: '3a', name: '复仇开始', doomThreshold: 5,
        text: '强制 - 推进时：放置仪式地，并在该地点生成乌默尔多斯。',
        advanceText: '乌默尔多斯降临了！',
        reveal: { type: 'spawnUmordhoth' },
        forced: {
          enemyDefeated: { type: 'umordhothDefeated' },
        },
      },
    ],

    enemies: {
      umordhoth: {
        code: 'umordhoth', name: '乌默尔多斯', subname: '地底噬魔', fight: 5, evade: 6, health: 6, healthPerPlayerBonus: 4,
        damage: 3, horror: 3, hunter: true, massive: true, elite: true,
        victory: 0, traits: ['AncientOne', 'Elite'],
        text: '猎手。庞大。乌默尔多斯 +4 生命/调查员。强制 - 每位调查员回合结束时：重整乌默尔多斯。[action] 若你控制丽塔·钱德勒：牺牲丽塔（→ 结局 3）。',
      },
      acolyte: {
        code: 'acolyte', name: '祭司', fight: 3, evade: 2, health: 1,
        damage: 1, horror: 0, traits: ['Humanoid', 'Cultist'],
        text: '生成 - 任意无人地点。强制 - 入场后：在祭司上放置 1 个毁灭标记。',
        spawnAnyEmpty: true, onSpawnDoom: 1,
      },
      wizardOfTheOrder: {
        code: 'wizardOfTheOrder', name: '密会巫师', fight: 4, evade: 2, health: 2,
        damage: 1, horror: 0, retaliate: true, traits: ['Humanoid', 'Cultist'],
        text: '生成 - 任意无人地点。反击。强制 - 神话阶段结束时：在密会巫师上放置 1 个毁灭标记。',
        spawnAnyEmpty: true, mythosEndDoom: 1,
      },
      screechingByakhee: {
        code: 'screechingByakhee', name: '尖叫的拜亚基', fight: 3, evade: 3, health: 4,
        damage: 1, horror: 2, hunter: true, prey: 'lowestSanity', victory: 1, traits: ['Monster', 'Byakhee'],
        text: '猎物 - 剩余神智值最低。猎手。与剩余神智值 4 或以下的调查员交战时 +1 攻击 +1 躲避。',
      },
      yithianObserver: {
        code: 'yithianObserver', name: '伊斯观测者', fight: 4, evade: 3, health: 4,
        damage: 1, horror: 1, prey: 'fewestHand', victory: 1, traits: ['Monster', 'Yithian'],
        text: '猎物 - 手牌最少。强制 - 攻击你时：随机弃 1 张手牌，不能弃则 +1 伤害 +1 恐惧。',
      },
      relentlessDarkYoung: {
        code: 'relentlessDarkYoung', name: '坚韧的黑山羊幼崽', fight: 4, evade: 2, health: 5,
        damage: 2, horror: 1, prey: 'lowestAgility', victory: 1, traits: ['Monster', 'DarkYoung'],
        text: '猎物 - 敏捷最低。强制 - 回合结束时治愈 2 点伤害。',
      },
      goatSpawn: {
        code: 'goatSpawn', name: '黑山羊眷族', fight: 3, evade: 2, health: 3,
        damage: 1, horror: 0, hunter: true, retaliate: true, traits: ['Humanoid', 'Monster'],
        text: '猎手。反击。强制 - 被击败时：本地点每位调查员受到 1 点恐惧。',
      },
      youngDeepOne: {
        code: 'youngDeepOne', name: '年幼的深潜者', fight: 3, evade: 3, health: 3,
        damage: 1, horror: 1, hunter: true, prey: 'lowestCombat', traits: ['Humanoid', 'Monster', 'DeepOne'],
        text: '猎物 - 战斗最低。猎手。强制 - 与你交战后：受到 1 点恐惧。',
      },
    },

    treacheries: {
      theYellowSign: {
        code: 'theYellowSign', name: '黄衣之印', traits: ['Omen'],
        test: { skill: 'willpower', difficulty: 4 },
        fail: { kind: 'horrorAndDrawMadness', horror: 2 },
        text: '显现 - 意志（4）检定。失败时受到 2 点恐惧，从你的牌库搜寻一张疯狂弱点并抽取，然后混洗牌库。',
      },
      dreamsOfRlyeh: {
        code: 'dreamsOfRlyeh', name: '克苏鲁梦境', traits: ['Omen'],
        threat: {
          statModifiers: { willpower: -1 }, sanityModifier: -1,
          discardCost: { action: 1 }, discardTest: { skill: 'willpower', difficulty: 3 },
          sameLocationAction: true,
        },
        text: '显现 - 放入你的威胁区域。你得到 -1 意志与 -1 神智。同地点调查员可花费 1 行动：意志（3）检定，成功则弃掉克苏鲁梦境。',
      },
      umordhothsWrath: {
        code: 'umordhothsWrath', name: '乌默尔多斯的愤怒', traits: ['Curse'],
        test: { skill: 'willpower', difficulty: 5 },
        fail: { kind: 'wrathByAmount' },
        text: '显现 - 意志（5）检定，每低于难度 1 点：弃 1 张手牌或受 1 点伤害和 1 点恐惧。',
      },
      offerOfPower: {
        code: 'offerOfPower', name: '提供力量', traits: ['Pact'], peril: true,
        effect: { kind: 'choosePowerOrHorror', draw: 2, doom: 2, horror: 2 },
        text: '险境。显现 - 你必须（选择一项）：抽 2 张牌并在当前密谋放 2 毁灭（可推进），或受到 2 点恐惧。',
      },
    },

    storyAssets: {},

    // 遭遇牌堆（The Devourer Below + Ancient Evils + Striking Fear + Ghouls + Dark Cult + 一个随机使者组；食尸鬼祭司若存活另加）
    encounterDeck: [
      'umordhothsWrath', 'umordhothsWrath',
      'ancientEvils', 'ancientEvils', 'ancientEvils',
      'rottingRemains', 'rottingRemains', 'rottingRemains',
      'frozenInFear', 'frozenInFear', 'dissonantVoices', 'dissonantVoices',
      'ghoulMinion', 'ghoulMinion', 'ghoulMinion', 'ravenousGhoul',
      'graspingHands', 'graspingHands', 'graspingHands',
      'acolyte', 'acolyte', 'acolyte',
      'wizardOfTheOrder',
      'mysteriousChanting', 'mysteriousChanting',
    ],

    // 使者组（随机选 1 个加入遭遇牌堆）
    agentSets: {
      agentsOfHastur: ['screechingByakhee', 'screechingByakhee', 'theYellowSign', 'theYellowSign'],
      agentsOfYogSothoth: ['yithianObserver', 'yithianObserver', 'offerOfPower', 'offerOfPower'],
      agentsOfShubNiggurath: ['relentlessDarkYoung', 'goatSpawn', 'goatSpawn', 'goatSpawn'],
      agentsOfCthulhu: ['youngDeepOne', 'youngDeepOne', 'dreamsOfRlyeh', 'dreamsOfRlyeh'],
    },

    // 阿卡姆密林（6 选 4）
    woodsPool: ['unhallowedGround', 'twistingPaths', 'oldHouse', 'cliffside', 'tangledThicket', 'quietGlade'],

    tokenMeanings: {
      easy: {
        skull: { kind: 'count', count: 'monsters', base: 0 },
        cultist: { kind: 'static', mod: -2, onDraw: { placeDoomOnNearestEnemy: 1 } },
        tablet: { kind: 'static', mod: -3, ifMonsterAtLocation: { damage: 1, horror: 0 } },
        elderthing: { kind: 'static', mod: -5, drawAnotherIf: 'ancientOne' },
      },
      standard: {
        skull: { kind: 'count', count: 'monsters', base: 0 },
        cultist: { kind: 'static', mod: -2, onDraw: { placeDoomOnNearestEnemy: 1 } },
        tablet: { kind: 'static', mod: -3, ifMonsterAtLocation: { damage: 1, horror: 0 } },
        elderthing: { kind: 'static', mod: -5, drawAnotherIf: 'ancientOne' },
      },
      hard: {
        skull: { kind: 'static', mod: -3, onFail: { drawEnemyTrait: 'Monster' } },
        cultist: { kind: 'static', mod: -4, onDraw: { placeDoomOnNearestEnemy: 2 } },
        tablet: { kind: 'static', mod: -5, ifMonsterAtLocation: { damage: 1, horror: 1 } },
        elderthing: { kind: 'static', mod: -7, drawAnotherIf: 'ancientOne' },
      },
      expert: {
        skull: { kind: 'static', mod: -3, onFail: { drawEnemyTrait: 'Monster' } },
        cultist: { kind: 'static', mod: -4, onDraw: { placeDoomOnNearestEnemy: 2 } },
        tablet: { kind: 'static', mod: -5, ifMonsterAtLocation: { damage: 1, horror: 1 } },
        elderthing: { kind: 'static', mod: -7, drawAnotherIf: 'ancientOne' },
      },
    },

    chaosBagExtra: ['elderthing'],
  }

export const identities = {
    scenario: {
      theDevourerBelow: {
        originalCode: '01142', approximation: true,
        identityReason: '剧本容器汇总场景参考卡、设置和结局；此编号只标识场景参考卡，不把全部容器内容当作一张卡的规则。',
      },
    },
    locations: {
      mainPath: { originalCode: '01149' },
      unhallowedGround: { originalCode: '01150', variant: 'Unhallowed Ground' },
      twistingPaths: { originalCode: '01151', variant: 'Twisting Paths' },
      oldHouse: { originalCode: '01152', variant: 'Old House' },
      cliffside: { originalCode: '01153', variant: 'Cliffside' },
      tangledThicket: { originalCode: '01154', variant: 'Tangled Thicket' },
      quietGlade: { originalCode: '01155', variant: 'Quiet Glade' },
      ritualSite: { originalCode: '01156' },
    },
    acts: {
      act1: { originalCode: '01146' },
      act2: { originalCode: '01147' },
      act3: { originalCode: '01148' },
    },
    agendas: {
      agenda1: { originalCode: '01143' },
      agenda2: { originalCode: '01144' },
      agenda3: {
        originalCode: '01145',
        identityReason: '背面替换当前场景与密谋，保存face区分正反面；JSON以01145及back_text保存，不能虚构01145b编号。',
      },
    },
    enemies: {
      umordhoth: { originalCode: '01157' },
      acolyte: { originalCode: '01169' },
      wizardOfTheOrder: { originalCode: '01170' },
      screechingByakhee: { originalCode: '01175' },
      yithianObserver: { originalCode: '01177' },
      relentlessDarkYoung: { originalCode: '01179' },
      goatSpawn: { originalCode: '01180' },
      youngDeepOne: { originalCode: '01181' },
    },
    treacheries: {
      umordhothsWrath: { originalCode: '01158' },
      theYellowSign: { originalCode: '01176' },
      offerOfPower: { originalCode: '01178' },
      dreamsOfRlyeh: { originalCode: '01182' },
    },
    storyAssets: {},
  }

bindScenarioIdentities(scenario, identities)
