// Curated by setting and pacing. Track files remain shared; playlists never copy audio.
const chapter = (name, mood, tracks) => Object.freeze({ name, mood, tracks: Object.freeze(tracks) })
export const SCENARIO_MUSIC = Object.freeze({
  theForgottenAge: Object.freeze({
    theUntamedWilds: chapter('荒莽密林', '潮湿丛林、未知踪迹、远处神庙', ['magicForest', 'shamanistic', 'lostFrontier']),
    theDoomOfEztli: chapter('埃兹特里的覆灭', '古代神庙、陷阱、崩塌逃生', ['invariance', 'enterTheMaze', 'ancientRite']),
    threadsOfFate: chapter('命运之线', '城市追查、失窃文物、暗处势力', ['penumbra', 'gloomHorizon']),
    theBoundaryBeyond: chapter('界限彼端', '城市与古代重叠、时空裂隙', ['staticMotion', 'orion300xb', 'digitalBark']),
    heartOfTheEldersPart1: chapter('久远腹地（上）', '重返雨林、寻找洞窟入口', ['truthInTheStones', 'magicForest']),
    heartOfTheEldersPart2: chapter('久远腹地（下）', '洞窟深处、古老仪式与遗物', ['rites', 'ancientRite', 'enterTheMaze']),
    theCityOfArchives: chapter('天机之城', '异星档案、陌生身体、科技低鸣', ['orion300xb', 'digitalBark', 'staticMotion']),
    theDepthsOfYoth: chapter('幽嘶深渊', '地下蛇城、逼近的危险', ['controlledChaos', 'interloper']),
    shatteredAeons: chapter('破碎永世', '纪元崩裂、终局迫近', ['thunderDreams', 'interloper', 'itIsLost']),
    turnBackTime: chapter('时间倒流', '回到过去、封印遗物、余音', ['truthInTheStones', 'itIsLost', 'lostFrontier']),
  }),
  nightOfTheZealot: Object.freeze({
    theGathering: chapter('集结', '封闭宅邸、地下异响、恐惧初现', ['darkestChild', 'comePlayWithMe', 'longNoteOne']),
    theMidnightMasks: chapter('午夜假面', '夜街追踪、秘密调查、午夜倒计时', ['darkWalk', 'onTheGround', 'chasePulse']),
    theDevourerBelow: chapter('地底噬魔', '森林邪教、献祭仪式、古神迫近', ['ritual', 'theVoices', 'gatheringDarkness']),
  }),
  theDunwichLegacy: Object.freeze({
    extracurricularActivity: chapter('课外活动', '夜间校园、失踪学者、实验体阴影', ['echoesOfTime', 'rightBehindYou', 'unseenHorrors']),
    theHouseAlwaysWins: chapter('百赌百胜', '地下赌场、爵士俱乐部、黑帮试探', ['deadlyRoulette', 'iKnewAGuy', 'dancesAndDames']),
    theMiskatonicMuseum: chapter('米斯卡塔尼克博物馆', '夜探展厅、古物禁书、潜伏追猎', ['theDread', 'decay', 'longNoteThree']),
    theEssexCountyExpress: chapter('疯狂列车', '疾行列车、车厢崩塌、紧迫逃生', ['chasePulse', 'nightBreak', 'wretchedDestroyer']),
    bloodOnTheAltar: chapter('血色祭坛', '失踪村民、隐秘地窖、献祭仪式', ['ritual', 'ossuaryTwoTurn', 'ghostProcessional']),
    undimensionedAndUnseen: chapter('无人知晓', '乡野搜寻、无形巨兽、危险逼近', ['unseenHorrors', 'lightlessDawn', 'shadowlandsFourBreath']),
    whereDoomAwaits: chapter('毁灭之地', '哨兵山、邪教仪式、时空裂隙', ['gatheringDarkness', 'shadowlandsSevenCodex']),
    lostInTimeAndSpace: chapter('迷失时空', '异界漂流、空间错乱、绝望迷航', ['shadowlandsAntechamber', 'ossuarySevenResolve', 'longNoteTwo']),
  }),
  thePathToCarcosa: Object.freeze({
    curtainCall: chapter('谢幕', '荒废剧院、失谐旋律、现实崩解', ['eveningOfChaos', 'comePlayWithMe', 'darkestChild']),
    theLastKing: chapter('最后的王者', '华丽晚宴、怪诞舞曲、宾客异变', ['danseMacabre', 'ghostProcessional', 'ossuaryOneBeginning']),
    echoesOfThePast: chapter('往事回声', '历史档案、幽远钟声、尘封秘密', ['echoesOfTime', 'longNoteOne', 'decay']),
    theUnspeakableOath: chapter('邪秽誓约', '疗养院、心理压迫、漫长疑惧', ['longNoteTwo', 'theDread', 'rightBehindYou']),
    aPhantomOfTruth: chapter('真相幻影', '巴黎夜街、追踪陌客、梦魇追逐', ['dancesAndDames', 'onTheGround', 'darkWalk']),
    thePallidMask: chapter('苍白面具', '地下墓穴、幽灵行进、石室迷宫', ['ossuarySixAir', 'ossuaryTwoTurn', 'longNoteThree']),
    blackStarsRise: chapter('黑星升起', '风暴修道院、黑星预兆、异界门扉', ['shadowlandsAntechamber', 'shadowlandsFourBreath', 'lightlessDawn']),
    dimCarcosa: chapter('卡城幽影', '哈利湖、失落之城、黄衣终幕', ['ossuarySixAir', 'ossuarySevenResolve', 'shadowlandsSevenCodex']),
  }),
})

export const scenarioPlaylistId = (campaignId, scenarioId) =>
  SCENARIO_MUSIC[campaignId]?.[scenarioId] ? `${campaignId}/${scenarioId}` : null

export const SCENARIO_PLAYLISTS = Object.freeze(Object.fromEntries(
  Object.entries(SCENARIO_MUSIC).flatMap(([campaignId, chapters]) =>
    Object.entries(chapters).map(([scenarioId, chapter]) => [`${campaignId}/${scenarioId}`, chapter.tracks]))))
