// Extracted without changing the P0 rule data or original card identities.
import { bindScenarioIdentities } from '../../../../identities.js'

export const scenario = {
    id: 'theGathering',
    name: '夜之狂热 · 第一幕：集结',
    intro: '你和你的搭档们在故乡——马萨诸塞州的阿卡姆市调查着一系列奇怪事件。过去几周发生了多起市民神秘失踪案。你们决定一同到队长家中讨论这些怪异的事件……',
    setup: '将地点「书房」放置入场，其他地点放在一边。每位调查员从书房开始。将食尸鬼祭司和丽塔·钱德勒放在一边。混洗遭遇牌库（集结/鼠群/食尸鬼/恐惧打击/远古恶魔/寒冷刺骨）。',
    resolutions: {
      noResolution: '你们活着逃出了房子，那女人带着你们冲入雨夜……（记录：房屋还在、食尸鬼祭司还活着。）',
      r1: '你点头同意，红发女人将火炬丢在地上，屋子瞬间化为火海。你看着自己的一切被火焰吞没。（记录：房屋已烧毁。队长受到 1 点精神创伤。）',
      r2: '你拒不服从，把那疯女人赶了出去。或许她说得对，但这里毕竟是你的家。（记录：房屋还在。队长获得额外 1 点经验。）',
      r3: '你们跑到走廊，那巨大滚烫的屏障依然挡着去路。凶残的入侵者已把你们团团包围，无处可逃……',
    },

    startLocation: 'study',
    setAsideLocations: ['hallway', 'attic', 'cellar', 'parlor'],

    locations: {
      study: {
        id: 'study', name: '书房', shroud: 2, cluesPerInvestigator: 2,
        connections: [], victory: 0,
        flavor: '书房里弥漫着血腥味，地板通向一扇紧闭的门。',
      },
      hallway: {
        id: 'hallway', name: '走廊', shroud: 1, cluesPerInvestigator: 0,
        connections: ['attic', 'cellar', 'parlor'], victory: 0,
        flavor: '长长的走廊连接着房子的其余部分。',
      },
      attic: {
        id: 'attic', name: '阁楼', shroud: 1, cluesPerInvestigator: 2,
        connections: ['hallway'], victory: 1, onEnter: { horror: 1 },
        flavor: '灰尘密布的阁楼里，月光从破窗漏进来。',
      },
      cellar: {
        id: 'cellar', name: '地窖', shroud: 4, cluesPerInvestigator: 2,
        connections: ['hallway'], victory: 1, onEnter: { damage: 1 },
        flavor: '潮湿的地窖深处，有什么东西在黑暗中蠕动。',
      },
      parlor: {
        id: 'parlor', name: '客厅', shroud: 2, cluesPerInvestigator: 0,
        connections: ['hallway'], victory: 0, resign: true, parley: true,
        flavor: '前门就在这里，但一堵灼热的屏障挡住了去路。',
      },
    },

    acts: [
      {
        id: 'act1', stage: '1a', name: '被困于此',
        text: '书房的门紧锁。你必须寻找线索，弄清发生了什么。',
        objective: { type: 'clues', perInvestigator: 2 },
        advanceText: '你发现了地板上的暗门，终于能离开书房了！',
        reveal: { type: 'openHallway' },
      },
      {
        id: 'act2', stage: '2a', name: '灼热屏障',
        text: '一堵灼热的屏障封住了前门，你必须找到破解之法。',
        objective: { type: 'clues', perInvestigator: 3, atLocation: 'hallway' },
        advanceText: '屏障消失了！但客厅里传来一个女人求救的声音……',
        reveal: { type: 'revealParlor' },
      },
      {
        id: 'act3', stage: '3a', name: '瞧瞧你们做的好事！',
        text: '食尸鬼祭司正在主持亵渎的仪式。阻止它！',
        objective: { type: 'defeatEnemy', enemy: 'ghoulPriest' },
        advanceText: '食尸鬼祭司倒下了，但房屋的命运还未定……',
        reveal: { type: 'resolutionChoice' },
      },
    ],

    agendas: [
      {
        id: 'agenda1', stage: '1a', name: '到底发生了什么？！', doomThreshold: 3,
        text: '墙壁里的低语越来越响。',
        advanceText: '黑暗中传来一声凄厉的尖啸！',
        reveal: { type: 'agenda1Reveal' },
      },
      {
        id: 'agenda2', stage: '2a', name: '食尸鬼崛起', doomThreshold: 7,
        text: '食尸鬼从地底爬了出来，饥饿难耐。',
        advanceText: '食尸鬼蜂拥而出，涌向房子各处！',
        reveal: { type: 'agenda2Reveal' },
      },
      {
        id: 'agenda3', stage: '3a', name: '他们爬出来了！', doomThreshold: 10,
        text: '食尸鬼们正在破墙而出，整栋房子都在颤抖！',
        advanceText: '',
        reveal: { type: 'agenda3Reveal' },
        forced: {
          enemyPhaseEnd: { type: 'ghoulsMoveToParlor' },
          roundEnd: { type: 'doomPerGhoulAtParlorHallway' },
        },
      },
    ],

    enemies: {
      ghoulPriest: {
        code: 'ghoulPriest', name: '食尸鬼祭司', fight: 4, evade: 4, healthPerInvestigator: 5,
        damage: 2, horror: 2, hunter: true, retaliate: true, elite: true,
        prey: 'highestCombat', victory: 2, traits: ['Humanoid', 'Monster', 'Ghoul', 'Elite'],
        text: '一个穿着红袍、头戴骨制面具的人形，发出呓语与低吼。',
      },
      fleshEater: {
        code: 'fleshEater', name: '食肉者', fight: 4, evade: 1, health: 4,
        damage: 1, horror: 2, spawn: 'attic', victory: 1, traits: ['Humanoid', 'Monster', 'Ghoul'],
        text: '贪婪地撕咬腐烂尸体的食尸鬼。',
      },
      icyGhoul: {
        code: 'icyGhoul', name: '冰封食尸鬼', fight: 3, evade: 4, health: 4,
        damage: 2, horror: 1, spawn: 'cellar', victory: 1, traits: ['Humanoid', 'Monster', 'Ghoul'],
        text: '浑身覆满冰霜的食尸鬼。',
      },
      swarmOfRats: {
        code: 'swarmOfRats', name: '鼠群', fight: 1, evade: 3, health: 1,
        damage: 1, horror: 0, hunter: true, traits: ['Creature'],
        text: '成群的老鼠在脚边乱窜。',
      },
      ghoulMinion: {
        code: 'ghoulMinion', name: '食尸鬼爪牙', fight: 2, evade: 2, health: 2,
        damage: 1, horror: 1, traits: ['Humanoid', 'Monster', 'Ghoul'],
        text: '腐败的食尸鬼，被血腥味吸引而来。',
      },
      ravenousGhoul: {
        code: 'ravenousGhoul', name: '饥饿的食尸鬼', fight: 3, evade: 3, health: 3,
        damage: 1, horror: 1, prey: 'lowestHealth', traits: ['Humanoid', 'Monster', 'Ghoul'],
        text: '饿到发狂的食尸鬼。',
      },
    },

    treacheries: {
      graspingHands: {
        code: 'graspingHands', name: '攫噬之手', test: { skill: 'agility', difficulty: 3 },
        fail: { kind: 'damageByAmount' },
        text: '无数只手从地板下伸出。敏捷（3）检定，每低于难度 1 点受到 1 点伤害。',
      },
      rottingRemains: {
        code: 'rottingRemains', name: '腐烂的尸体', test: { skill: 'willpower', difficulty: 3 },
        fail: { kind: 'horrorByAmount' },
        text: '一具腐烂的尸体从墙中倒下。意志（3）检定，每低于难度 1 点受到 1 点恐惧。',
      },
      frozenInFear: {
        code: 'frozenInFear', name: '呆若木鸡',
        threat: { extraActionCost: ['move', 'fight', 'evade'], endTurnTest: { skill: 'willpower', difficulty: 3 } },
        text: '你每回合第一次执行移动/攻击/躲避需额外 1 行动。回合结束意志（3）检定成功则弃掉。',
      },
      dissonantVoices: {
        code: 'dissonantVoices', name: '刺耳之声',
        threat: { cannotPlay: ['asset', 'event'], roundEndDiscard: true },
        text: '你不能打出支援或事件。本轮结束时弃掉。',
      },
      ancientEvils: {
        code: 'ancientEvils', name: '远古恶魔', effect: { kind: 'addDoom', amount: 1 },
        text: '古老的邪恶正在靠近。在当前密谋上放置 1 点毁灭。',
      },
      cryptChill: {
        code: 'cryptChill', name: '地窖寒风', test: { skill: 'willpower', difficulty: 4 },
        fail: { kind: 'discardAssetOrDamage', damage: 2 },
        text: '刺骨的寒意袭来。意志（4）检定，失败弃 1 件资产（否则受 2 点伤害）。',
      },
      obscuringFog: {
        code: 'obscuringFog', name: '朦胧之雾', effect: { kind: 'attachShroud', amount: 2 },
        text: '浓雾笼罩了你所在的地点，该地点帷幕 +2；被成功调查后弃掉。',
      },
    },

    storyAssets: {
      '01117': {
        code: '01117', name: '丽塔·钱德勒', subname: '狂热者', cost: 0, slot: 'Ally', unique: true,
        text: '你控制丽塔·钱德勒时：你所在地点的每位调查员 +1 战斗。你所在地点的调查员成功攻击一个怪物敌人时，该调查员造成 +1 伤害。',
      },
    },

    // 遭遇牌堆（26 张）
    encounterDeck: [
      'fleshEater', 'icyGhoul',
      'swarmOfRats', 'swarmOfRats', 'swarmOfRats',
      'ghoulMinion', 'ghoulMinion', 'ghoulMinion', 'ravenousGhoul',
      'graspingHands', 'graspingHands', 'graspingHands',
      'rottingRemains', 'rottingRemains', 'rottingRemains',
      'frozenInFear', 'frozenInFear', 'dissonantVoices', 'dissonantVoices',
      'ancientEvils', 'ancientEvils', 'ancientEvils',
      'cryptChill', 'cryptChill', 'obscuringFog', 'obscuringFog',
    ],

    tokenMeanings: {
      easy: {
        skull: { kind: 'count', count: 'ghoulsAtLocation', base: 0 },
        cultist: { kind: 'static', mod: -1, onFail: { horror: 1 } },
        tablet: { kind: 'static', mod: -2, ifGhoul: { damage: 1, horror: 0 } },
      },
      standard: {
        skull: { kind: 'count', count: 'ghoulsAtLocation', base: 0 },
        cultist: { kind: 'static', mod: -1, onFail: { horror: 1 } },
        tablet: { kind: 'static', mod: -2, ifGhoul: { damage: 1, horror: 0 } },
      },
      hard: {
        skull: { kind: 'static', mod: -2, onFail: { drawEnemyTrait: 'Ghoul' } },
        cultist: { kind: 'static', mod: 0, onFail: { horror: 2 }, drawAnother: true },
        tablet: { kind: 'static', mod: -4, ifGhoul: { damage: 1, horror: 1 } },
      },
      expert: {
        skull: { kind: 'static', mod: -2, onFail: { drawEnemyTrait: 'Ghoul' } },
        cultist: { kind: 'static', mod: 0, onFail: { horror: 2 }, drawAnother: true },
        tablet: { kind: 'static', mod: -4, ifGhoul: { damage: 1, horror: 1 } },
      },
    },
  }

export const identities = {
    scenario: {
      theGathering: {
        originalCode: '01104', approximation: true,
        identityReason: '剧本容器汇总场景参考卡、设置和结局；此编号只标识场景参考卡，不把全部容器内容当作一张卡的规则。',
      },
    },
    locations: {
      study: { originalCode: '01111' },
      hallway: { originalCode: '01112' },
      attic: { originalCode: '01113' },
      cellar: { originalCode: '01114' },
      parlor: { originalCode: '01115' },
    },
    acts: {
      act1: { originalCode: '01108' },
      act2: {
        originalCode: '01109',
      },
      act3: { originalCode: '01110' },
    },
    agendas: {
      agenda1: { originalCode: '01105' },
      agenda2: { originalCode: '01106' },
      agenda3: { originalCode: '01107' },
    },
    enemies: {
      ghoulPriest: { originalCode: '01116' },
      fleshEater: { originalCode: '01118' },
      icyGhoul: { originalCode: '01119' },
      swarmOfRats: { originalCode: '01159' },
      ghoulMinion: { originalCode: '01160' },
      ravenousGhoul: { originalCode: '01161' },
    },
    treacheries: {
      graspingHands: { originalCode: '01162' },
      rottingRemains: { originalCode: '01163' },
      frozenInFear: { originalCode: '01164' },
      dissonantVoices: { originalCode: '01165' },
      ancientEvils: { originalCode: '01166' },
      cryptChill: { originalCode: '01167' },
      obscuringFog: { originalCode: '01168' },
    },
    storyAssets: {
      '01117': {
        originalCode: '01117',
      },
    },
  }

bindScenarioIdentities(scenario, identities)
