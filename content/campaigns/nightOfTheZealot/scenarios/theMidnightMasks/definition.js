// Extracted without changing the P0 rule data or original card identities.
import { bindScenarioIdentities } from '../../../../identities.js'

export const scenario = {
    id: 'theMidnightMasks',
    name: '夜之狂热 · 第二幕：午夜假面',
    intro: '你决定在午夜前找到尽可能多的异教徒，揭开他们的假面，查明那场亵渎仪式的计划……',
    setup: '将北区、东城区、河岸城、圣玛丽医院、墓地、米斯卡塔尼克大学、你的房子以及商业区/南区各随机一张放置入场。将「乌默尔多斯的崇拜者」5 名独特异教徒混洗为独立的异教徒牌堆。按人数生成若干祭司。若食尸鬼祭司仍存活，洗入遭遇牌库。',
    resolutions: {
      noResolution: '你们未能查明真相，但至少活了下来。',
      r1: '你成功获取了邪教计划的信息。但愿这一些够用。（结局 1：盘问到的异教徒记录在案。）',
      r2: '钟声响起，午夜已至。你们已经没有时间了……（结局 2：记录午夜已至。）',
    },

    startLocation: 'yourHouse',
    setAsideLocations: [],
    resignAnywhere: true,
    // 墓地的失败分支在 movement.js 里还要选「受到 2 点恐惧」或「移动到河岸城」；
    // onEnter 只声明了检定和默认失败，给 AI/移动提示补一句完整结算。
    locationNotices: {
      graveyard: '意志(3)检定，失败时受到 2 点恐惧，或移动到河岸城',
    },
    locationVariants: {
      southside: [
        { originalCode: '01126', name: '南区 · 历史协会', text: '[action]：抽取3张卡牌。(每场游戏仅限一次)', ability: { id: 'southsideDraw', label: '抽取 3 张牌', limit: 'game', effect: { type: 'draw', amount: 3 } } },
        { originalCode: '01127', name: '南区 · 老马旅社', shroud: 2, text: '[action]：查找你的牌库，找出一张盟友支援并将其加入你的手牌。(每场游戏仅限一次)', ability: { id: 'southsideAlly', label: '检索一张盟友支援', limit: 'game', effect: { type: 'searchTop', amount: 999, trait: 'Ally', choose: 1 } } },
      ],
      downtown: [
        { originalCode: '01130', name: '商业区 · 阿卡姆第一银行', text: '[action]：获得3资源。(每场游戏仅限一次)', ability: { id: 'downtownLoan', label: '获得 3 资源', limit: 'game', effect: { type: 'gainResource', amount: 3 } } },
        { originalCode: '01131', name: '商业区 · 阿卡姆疯人院', shroud: 4, cluesPerInvestigator: 2, victory: 1, text: '[action]：治愈3点恐惧。(每场游戏仅限一次)', ability: { id: 'downtownHeal', label: '治愈 3 点恐惧', limit: 'game', effect: { type: 'heal', amount: 3, what: 'horror' } } },
      ],
    },

    locations: {
      yourHouse: {
        id: 'yourHouse', name: '你的房子', shroud: 2, cluesPerInvestigator: 1, victory: 0,
        connections: ['southside', 'miskatonicUniversity', 'easttown', 'graveyard'],
        flavor: '你对回家还是有点胆战心惊。',
        text: '强制 - 在食尸鬼祭司生成时：改为将其生成在此处。',
        ability: { id: 'yourHouseDraw', label: '抽 1 张牌并获得 1 资源', limit: 'player-turn', effect: { type: 'sequence', effects: [{ type: 'draw', amount: 1 }, { type: 'gainResource', amount: 1 }] } },
      },
      rivertown: {
        id: 'rivertown', name: '河岸城', shroud: 1, cluesPerInvestigator: 1, victory: 0, central: true, traits: ['Central'],
        connections: ['downtown', 'southside', 'stMarysHospital', 'northside', 'miskatonicUniversity'],
        flavor: '今晚，米斯卡塔尼克河的水面有些异样。',
      },
      southside: {
        id: 'southside', name: '南区 · 历史协会', shroud: 3, cluesPerInvestigator: 1, victory: 0,
        connections: ['rivertown', 'stMarysHospital', 'northside', 'miskatonicUniversity', 'easttown', 'graveyard', 'yourHouse'],
        flavor: '历史协会坐落在一座乔治亚风格的豪宅内。',
        text: '[action]：抽取 3 张卡牌。（每场游戏仅限一次）',
        ability: { id: 'southsideDraw', label: '抽取 3 张牌', limit: 'game', effect: { type: 'draw', amount: 3 } },
      },
      stMarysHospital: {
        id: 'stMarysHospital', name: '圣玛丽医院', shroud: 2, cluesPerInvestigator: 1, victory: 0,
        connections: ['rivertown', 'southside', 'northside', 'miskatonicUniversity'],
        flavor: '在圣玛丽医院久留有利于恢复身体健康。',
        text: '[action]：治愈 3 点伤害。（每场游戏仅限一次）',
        ability: { id: 'stMarysHeal', label: '治愈 3 点伤害', limit: 'game', effect: { type: 'heal', amount: 3, what: 'damage' } },
      },
      miskatonicUniversity: {
        id: 'miskatonicUniversity', name: '米斯卡塔尼克大学', shroud: 4, cluesPerInvestigator: 2, victory: 1,
        connections: ['rivertown', 'stMarysHospital', 'southside', 'easttown', 'graveyard', 'yourHouse', 'downtown', 'northside'],
        flavor: '校园安静而孤寂。',
        text: '[action]：查找牌库顶 6 张，找出 1 张书籍或法术加入手牌。',
        ability: { id: 'miskatonicSearch', label: '检索牌库顶 6 张中的书籍或法术', effect: { type: 'searchTop', amount: 6, traits: ['Tome', 'Spell'], choose: 1 } },
      },
      downtown: {
        id: 'downtown', name: '商业区 · 阿卡姆第一银行', shroud: 3, cluesPerInvestigator: 1, victory: 0,
        connections: ['rivertown', 'miskatonicUniversity', 'northside', 'easttown'],
        flavor: '我们将这称作一笔「贷款」。',
        text: '[action]：获得 3 资源。（每场游戏仅限一次）',
        ability: { id: 'downtownLoan', label: '获得 3 资源', limit: 'game', effect: { type: 'gainResource', amount: 3 } },
      },
      easttown: {
        id: 'easttown', name: '东城区', shroud: 2, cluesPerInvestigator: 1, victory: 0,
        connections: ['southside', 'miskatonicUniversity', 'graveyard', 'yourHouse', 'downtown', 'northside'],
        flavor: '东城区入夜后依然人来人往。',
        text: '你位于东城区时，你打出每张盟友支援的费用 -2。',
      },
      graveyard: {
        id: 'graveyard', name: '墓地', shroud: 1, cluesPerInvestigator: 2, victory: 1,
        connections: ['southside', 'miskatonicUniversity', 'easttown', 'yourHouse'],
        flavor: '墓地里弥漫着不祥的寂静。',
        text: '强制 - 你进入墓地后：意志（3）检定，失败须受到 2 点恐惧或移动到河岸城。',
        onEnter: { test: { skill: 'willpower', difficulty: 3 }, fail: { kind: 'takeHorror', amount: 2 } },
      },
      northside: {
        id: 'northside', name: '北区', shroud: 3, cluesPerInvestigator: 2, victory: 1,
        connections: ['rivertown', 'southside', 'stMarysHospital', 'miskatonicUniversity', 'downtown', 'easttown'],
        flavor: '在北区，一点小钱就能让人无所不言。',
        text: '[action] 花费 5 资源：从供应堆获得 2 个线索。（每场游戏团队仅限一次）',
        ability: { id: 'northsideBribe', label: '花费 5 资源获得 2 个线索', limit: 'team-game', cost: { resources: 5 }, effect: { type: 'gainClues', amount: 2 } },
      },
    },

    acts: [
      {
        id: 'act1', stage: '1a', name: '揭露阴谋',
        text: '[action]：调查员共同花费 2 线索/人，抽取异教徒牌库顶的卡牌。目标 - 将尽可能多的独特异教徒敌人加入胜利区；胜利区有 6 个独特异教徒则推进。',
        objective: { type: 'uniqueCultists', amount: 6 },
        advanceText: '你终于拼凑出了邪教的完整计划！',
        reveal: { type: 'resolutionChoice' },
      },
    ],

    agendas: [
      {
        id: 'agenda1', stage: '1a', name: '猎人还是猎物？', doomThreshold: 6,
        text: '[action]：撤退。你不愿冒险多做停留，带着收集的信息去往安全之处。',
        advanceText: '一个戴着骨制面具的身影从阴影中现身，锁定了猎物……',
        reveal: { type: 'spawnMaskedHunter' },
      },
      {
        id: 'agenda2', stage: '2a', name: '时间飞逝', doomThreshold: 8,
        text: '[action]：撤退。你不愿冒险多做停留。',
        advanceText: '午夜的钟声敲响了。',
        reveal: { type: 'resolution2' },
      },
    ],

    enemies: {
      theMaskedHunter: {
        code: 'theMaskedHunter', name: '假面猎手', subname: '无息的跟踪者', fight: 4, evade: 2, health: 4, healthPerPlayerBonus: 2,
        damage: 2, horror: 1, hunter: true, elite: true, unique: true, uniqueCultist: true,
        prey: 'mostClues', victory: 2, traits: ['Humanoid', 'Cultist', 'Elite'],
        text: '生成 - 与猎物交战。猎物 - 线索最多。猎手。每有一位调查员，假面猎手 +2 生命。你与假面猎手交战时，不能发现或花费线索。',
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
      wolfManDrew: {
        code: 'wolfManDrew', name: '「狼人」德鲁', subname: '食人狂', fight: 4, evade: 2, health: 4,
        damage: 2, horror: 0, spawn: 'downtown', victory: 1, unique: true, uniqueCultist: true, traits: ['Humanoid', 'Cultist'],
        text: '生成 - 商业区。强制 - 攻击时：治愈他 1 点伤害。',
      },
      hermanCollins: {
        code: 'hermanCollins', name: '赫尔曼·柯林斯', subname: '墓地管理员', fight: 3, evade: 4, health: 4,
        damage: 1, horror: 1, spawn: 'graveyard', victory: 1, unique: true, uniqueCultist: true, traits: ['Humanoid', 'Cultist'],
        text: '生成 - 墓地。[action] 弃 4 张手牌：谈判，将赫尔曼·柯林斯加入胜利区。',
        parley: { cost: { discardHand: 4 }, label: '弃 4 张手牌谈判' },
      },
      peterWarren: {
        code: 'peterWarren', name: '彼得·沃伦', subname: '神秘学教授', fight: 2, evade: 3, health: 3,
        damage: 1, horror: 0, spawn: 'miskatonicUniversity', victory: 1, unique: true, uniqueCultist: true, traits: ['Humanoid', 'Cultist'],
        text: '生成 - 米斯卡塔尼克大学。[action] 花费 2 个线索：谈判，将彼得·沃伦加入胜利区。',
        parley: { cost: { clues: 2 }, label: '花 2 线索谈判' },
      },
      victoriaDevereux: {
        code: 'victoriaDevereux', name: '维多利亚·德佛罗', subname: '收藏家', fight: 3, evade: 2, health: 3,
        damage: 1, horror: 0, spawn: 'northside', victory: 1, unique: true, uniqueCultist: true, traits: ['Humanoid', 'Cultist'],
        text: '生成 - 北区。[action] 花费 5 资源：谈判，将维多利亚·德佛罗加入胜利区。',
        parley: { cost: { resources: 5 }, label: '花 5 资源谈判' },
      },
      ruthTurner: {
        code: 'ruthTurner', name: '露丝·特纳', subname: '殓葬师', fight: 2, evade: 5, health: 4,
        damage: 1, horror: 0, spawn: 'stMarysHospital', victory: 1, unique: true, uniqueCultist: true, traits: ['Humanoid', 'Cultist'],
        text: '生成 - 圣玛丽医院。强制 - 躲避露丝·特纳后：将她加入胜利区。',
        evadeToVictory: true,
      },
      huntingNightgaunt: {
        code: 'huntingNightgaunt', name: '狩猎中的夜魇', fight: 3, evade: 1, health: 4,
        damage: 1, horror: 1, hunter: true, traits: ['Monster', 'Nightgaunt'],
        text: '猎手。调查员尝试躲避狩猎中的夜魇时，揭示的每个混乱标记的负值修正翻倍。',
      },
    },

    treacheries: {
      huntingShadow: {
        code: 'huntingShadow', name: '追猎鬼影', traits: ['Curse'], peril: true,
        effect: { kind: 'chooseCluesOrDamage', clues: 1, damage: 2 },
        text: '险境。显现 - 你必须（选择一项）：花费 1 个线索或受到 2 点伤害。',
      },
      falseLead: {
        code: 'falseLead', name: '错误指示',
        test: { skill: 'intellect', difficulty: 4 },
        fail: { kind: 'cluesByAmount' },
        text: '显现 - 如果你没有线索，错误指示获得涌动。否则智力（4）检定，每低于难度 1 点，将你的 1 个线索放到所在地点。',
      },
      mysteriousChanting: {
        code: 'mysteriousChanting', name: '神秘咏唱', traits: ['Hex'],
        effect: { kind: 'doomOnNearestCultist', amount: 2 },
        text: '显现 - 在最近的异教徒敌人上放置 2 个毁灭标记；若没有，从遭遇牌库抽出一个异教徒敌人。',
      },
      onWingsOfDarkness: {
        code: 'onWingsOfDarkness', name: '乘着黑暗之翼',
        test: { skill: 'agility', difficulty: 4 },
        fail: { kind: 'onWingsOfDarkness', damage: 1, horror: 1 },
        text: '显现 - 敏捷（4）检定，失败受到 1 点伤害和 1 点恐惧，并与非夜魇敌人解除交战，移动到一个中心地点。',
      },
      lockedDoor: {
        code: 'lockedDoor', name: '上锁的门', traits: ['Obstacle'],
        effect: { kind: 'attachLockedDoor' },
        text: '显现 - 附属到线索最多且无上锁的门的地点。附属地点不能被调查。[action] 战斗/敏捷（4）检定成功弃掉。',
      },
    },

    storyAssets: {},

    // 遭遇牌堆（The Midnight Masks + Chilling Cold + Nightgaunts + Locked Doors + Dark Cult；食尸鬼祭司若存活另加）
    encounterDeck: [
      'huntingShadow', 'huntingShadow', 'huntingShadow',
      'falseLead', 'falseLead',
      'cryptChill', 'cryptChill', 'obscuringFog', 'obscuringFog',
      'huntingNightgaunt', 'huntingNightgaunt',
      'onWingsOfDarkness', 'onWingsOfDarkness',
      'lockedDoor', 'lockedDoor',
      'acolyte', 'acolyte', 'acolyte',
      'wizardOfTheOrder',
      'mysteriousChanting', 'mysteriousChanting',
    ],

    // 异教徒牌堆（独立，5 名独特异教徒）
    cultistDeck: ['wolfManDrew', 'hermanCollins', 'peterWarren', 'victoriaDevereux', 'ruthTurner'],

    tokenMeanings: {
      easy: {
        skull: { kind: 'count', count: 'maxDoomOnCultist', base: 0 },
        cultist: { kind: 'static', mod: -2, onDraw: { placeDoomOnNearestCultist: 1 } },
        tablet: { kind: 'static', mod: -3, onFail: { placeCluesOnLocation: 1 } },
      },
      standard: {
        skull: { kind: 'count', count: 'maxDoomOnCultist', base: 0 },
        cultist: { kind: 'static', mod: -2, onDraw: { placeDoomOnNearestCultist: 1 } },
        tablet: { kind: 'static', mod: -3, onFail: { placeCluesOnLocation: 1 } },
      },
      hard: {
        skull: { kind: 'count', count: 'totalDoom', base: 0 },
        cultist: { kind: 'static', mod: -2, onDraw: { placeDoomOnEachCultist: 1 }, drawAnotherIfNoCultist: true },
        tablet: { kind: 'static', mod: -4, onFail: { placeCluesOnLocation: 'all' } },
      },
      expert: {
        skull: { kind: 'count', count: 'totalDoom', base: 0 },
        cultist: { kind: 'static', mod: -2, onDraw: { placeDoomOnEachCultist: 1 }, drawAnotherIfNoCultist: true },
        tablet: { kind: 'static', mod: -4, onFail: { placeCluesOnLocation: 'all' } },
      },
    },
  }

export const identities = {
    scenario: {
      theMidnightMasks: {
        originalCode: '01120', approximation: true,
        identityReason: '剧本容器汇总场景参考卡、设置和结局；此编号只标识场景参考卡，不把全部容器内容当作一张卡的规则。',
      },
    },
    locations: {
      yourHouse: {
        originalCode: '01124',
      },
      rivertown: { originalCode: '01125' },
      southside: { originalCode: '01126', variant: 'Historical Society' },
      stMarysHospital: { originalCode: '01128' },
      miskatonicUniversity: { originalCode: '01129' },
      downtown: { originalCode: '01130', variant: 'First Bank of Arkham' },
      easttown: { originalCode: '01132' },
      graveyard: {
        originalCode: '01133',
      },
      northside: { originalCode: '01134' },
    },
    acts: {
      act1: { originalCode: '01123' },
    },
    agendas: {
      agenda1: {
        originalCode: '01121a', haskellCardCode: '01121a', linkedOriginalCode: '01121b',
        identityReason: '本工作区cards_en.json顶层实际code为01121a，linked_card.code为01121b；Haskell同样使用01121a，不能截短为01121。',
      },
      agenda2: { originalCode: '01122' },
    },
    enemies: {
      theMaskedHunter: { originalCode: '01121b', linkedOriginalCode: '01121a' },
      acolyte: { originalCode: '01169' },
      wizardOfTheOrder: { originalCode: '01170' },
      wolfManDrew: { originalCode: '01137' },
      hermanCollins: { originalCode: '01138' },
      peterWarren: { originalCode: '01139' },
      victoriaDevereux: { originalCode: '01140' },
      ruthTurner: { originalCode: '01141' },
      huntingNightgaunt: { originalCode: '01172' },
    },
    treacheries: {
      huntingShadow: { originalCode: '01135' },
      falseLead: { originalCode: '01136' },
      mysteriousChanting: { originalCode: '01171' },
      onWingsOfDarkness: {
        originalCode: '01173',
      },
      lockedDoor: { originalCode: '01174' },
    },
    storyAssets: {},
  }

bindScenarioIdentities(scenario, identities)
