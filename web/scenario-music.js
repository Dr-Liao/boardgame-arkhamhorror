// Curated by setting and pacing. Track files remain shared; playlists never copy audio.
const chapter = (name, mood, tracks) => Object.freeze({ name, mood, tracks: Object.freeze(tracks) })
export const SCENARIO_MUSIC = Object.freeze({
  nightOfTheZealot: Object.freeze({
    theGathering: chapter('集结', '封闭宅邸、地下异响、恐惧初现', ['darkestChild', 'longNoteOne', 'theDread']),
    theMidnightMasks: chapter('午夜假面', '夜街追踪、秘密调查、午夜倒计时', ['darkWalk', 'dancesAndDames', 'chasePulse']),
    theDevourerBelow: chapter('地底噬魔', '森林邪教、献祭仪式、古神迫近', ['ritual', 'gatheringDarkness', 'unseenHorrors']),
  }),
  theDunwichLegacy: Object.freeze({
    extracurricularActivity: chapter('课外活动', '夜间校园、失踪学者、实验体阴影', ['darkestChild', 'echoesOfTime', 'unseenHorrors']),
    theHouseAlwaysWins: chapter('百赌百胜', '地下赌场、爵士俱乐部、黑帮试探', ['deadlyRoulette', 'dancesAndDames']),
    theMiskatonicMuseum: chapter('米斯卡塔尼克博物馆', '夜探展厅、古物禁书、潜伏追猎', ['echoesOfTime', 'theDread', 'longNoteOne']),
    theEssexCountyExpress: chapter('疯狂列车', '疾行列车、车厢崩塌、紧迫逃生', ['chasePulse', 'eveningOfChaos', 'unseenHorrors']),
    bloodOnTheAltar: chapter('血色祭坛', '失踪村民、隐秘地窖、献祭仪式', ['ritual', 'theDread', 'ghostProcessional']),
    undimensionedAndUnseen: chapter('无人知晓', '乡野搜寻、无形巨兽、危险逼近', ['unseenHorrors', 'darkWalk', 'gatheringDarkness']),
    whereDoomAwaits: chapter('毁灭之地', '哨兵山、邪教仪式、时空裂隙', ['gatheringDarkness', 'ritual', 'shadowlandsAntechamber']),
    lostInTimeAndSpace: chapter('迷失时空', '异界漂流、空间错乱、绝望迷航', ['shadowlandsAntechamber', 'ossuarySixAir', 'longNoteTwo']),
  }),
  thePathToCarcosa: Object.freeze({
    curtainCall: chapter('谢幕', '荒废剧院、失谐旋律、现实崩解', ['eveningOfChaos', 'darkestChild', 'danseMacabre']),
    theLastKing: chapter('最后的王者', '华丽晚宴、怪诞舞曲、宾客异变', ['danseMacabre', 'ghostProcessional', 'eveningOfChaos']),
    echoesOfThePast: chapter('往事回声', '历史档案、幽远钟声、尘封秘密', ['echoesOfTime', 'longNoteOne', 'theDread']),
    theUnspeakableOath: chapter('邪秽誓约', '疗养院、心理压迫、漫长疑惧', ['longNoteTwo', 'theDread', 'ossuarySixAir']),
    aPhantomOfTruth: chapter('真相幻影', '巴黎夜街、追踪陌客、梦魇追逐', ['dancesAndDames', 'darkWalk', 'chasePulse']),
    thePallidMask: chapter('苍白面具', '地下墓穴、幽灵行进、石室迷宫', ['ghostProcessional', 'ossuarySixAir', 'longNoteOne']),
    blackStarsRise: chapter('黑星升起', '风暴修道院、黑星预兆、异界门扉', ['gatheringDarkness', 'shadowlandsAntechamber', 'ritual']),
    dimCarcosa: chapter('卡城幽影', '哈利湖、失落之城、黄衣终幕', ['ossuarySixAir', 'shadowlandsAntechamber', 'eveningOfChaos']),
  }),
})

export const scenarioPlaylistId = (campaignId, scenarioId) =>
  SCENARIO_MUSIC[campaignId]?.[scenarioId] ? `${campaignId}/${scenarioId}` : null

export const SCENARIO_PLAYLISTS = Object.freeze(Object.fromEntries(
  Object.entries(SCENARIO_MUSIC).flatMap(([campaignId, chapters]) =>
    Object.entries(chapters).map(([scenarioId, chapter]) => [`${campaignId}/${scenarioId}`, chapter.tracks]))))
