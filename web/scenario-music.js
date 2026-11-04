// Curated by setting and pacing. Track files remain shared; playlists never copy audio.
const chapter = (name, mood, tracks) => Object.freeze({ name, mood, tracks: Object.freeze(tracks) })
export const SCENARIO_MUSIC = Object.freeze({
  theCircleUndone: Object.freeze({
    disappearanceAtTheTwilightEstate: chapter("暮色庄园失踪事件", "庄园晚宴、失踪者、暮色疑云", ["tcuVanishing","tcuEveningFallPiano","tcuThisHouse"]),
    theWitchingHour: chapter("巫异时刻", "林间迷途、女巫集会、命运占卜", ["tcuBabaYaga","tcuMystOnTheMoor","tcuSpellbound"]),
    atDeathsDoorstep: chapter("死亡门前", "幽灵庄园、现实翻面、看守人追猎", ["tcuScpX5xOuterThoughts","tcuOssuary4Animate","tcuPhantasm"]),
    theSecretName: chapter("隐秘之名", "女巫旧屋、异次元走廊、黑书秘密", ["tcuMetaphysik","tcuCrypto","tcuInnerSanctum"]),
    theWagesOfSin: chapter("恶罪报应", "绞刑山墓地、异端幽魂、未了之事", ["tcuOssuary5Rest","tcuAnguish","tcuLandOfTheDead"]),
    forTheGreaterGood: chapter("崇高利益", "秘社调查、机关钥匙、内殿阴谋", ["tcuHiddenPast","tcuHiddenWonders","tcuMysticForce"]),
    unionAndDisillusion: chapter("聚合幻灭", "荒岛火盆、阵法仪式、阵营对峙", ["tcuShadowlands1Horizon","tcuShadowlands2Bridge","tcuFinalBattleOfTheDarkWizards"]),
    inTheClutchesOfChaos: chapter("混沌魔掌", "阿卡姆裂口、连锁入侵、危机升级", ["tcuTheEscalation","tcuDarkling","tcuVolatileReaction"]),
    beforeTheBlackThrone: chapter("黑色王座", "宇宙漂流、虚空吞噬、终末倒计时", ["tcuOssuary3Words","tcuSymmetry","tcuShadowlands6ThePit"]),
  }),
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
  // 食梦者：24 个位置中 16 个使用 8 首新曲，8 个复用旧曲（33.3%）；音频统一放在 common/。
  theDreamEaters: Object.freeze({
    beyondTheGatesOfSleep: chapter('梦境门外', '七十级台阶、幻梦森林、初次入梦', ['tdeDreamsBecomeReal', 'tdeDreamlike', 'magicForest']),
    wakingNightmare: chapter('清醒噩梦', '圣玛丽医院、蛛群滋生、现实交融', ['tdeUnnaturalSituation', 'tdeSpiderEyes', 'controlledChaos']),
    theSearchForKadath: chapter('寻觅卡达斯', '幻梦境远行、乌撒与狄拉斯-利恩、黑夜将至', ['tdeAirPrelude', 'tdeFloatingCities', 'ancientRite']),
    aThousandShapesOfHorror: chapter('万千骇形', '无名之屋、无尽阶梯、地下世界', ['tdeDreamlike', 'tdeSoporific', 'enterTheMaze']),
    darkSideOfTheMoon: chapter('月之暗面', '月兽之城、警报等级、月核深处', ['tdeFloatingCities', 'tdeSoporific', 'orion300xb']),
    pointOfNoReturn: chapter('无归之地', '辛之墓穴、食尸鬼平原、地下世界围困', ['tdeUnnaturalSituation', 'tdeSpiderEyes', 'interloper']),
    whereTheGodsDwell: chapter('神居之所', '冷原冰封荒土、缟玛瑙城堡、食梦者终局', ['tdeAirPrelude', 'tdeFrozenStar', 'thunderDreams']),
    weaverOfTheCosmos: chapter('编织宇宙', '巨网竖列、蛛后阿特拉克·纳克亚、现实交织', ['tdeDreamsBecomeReal', 'tdeFrozenStar', 'darkestChild']),
  }),
  // 印斯茅斯暗潮（六循环 P8 注册时补）：复用既有曲库（不新增音频、不复制文件），
  // 按「深海／小镇疑云／洪水追逐／灯塔终局」配速；每章 2–3 首，避免与前三循环曲目重复计次。
  theInnsmouthConspiracy: Object.freeze({
    thePitOfDespair: chapter('绝望深坑', '洞穴深处、淹没水道、钥匙与记忆', ['rites', 'ancientRite', 'controlledChaos']),
    theVanishingOfElinaHarper: chapter('艾莲娜·哈珀失踪案', '小镇疑云、封锁街区、指认与营救', ['penumbra', 'darkWalk', 'gloomHorizon']),
    inTooDeep: chapter('深陷危局', '洪水漫城、路障封锁、逐街推进', ['controlledChaos', 'staticMotion', 'itIsLost']),
    devilReef: chapter('魔鬼礁石', '渔船出海、沉没洞窟、海底钥匙', ['tdeFloatingCities', 'truthInTheStones', 'invariance']),
    horrorInHighGear: chapter('全速恐惧', '旧公路追逐、载具疾驰、抵达时机', ['itIsLost', 'orion300xb', 'staticMotion']),
    aLightInTheFog: chapter('雾中之光', '灯塔迷雾、停尸房与地下室、多线终局', ['tcuMystOnTheMoor', 'tdeDreamlike', 'lostFrontier']),
    theLairOfDagon: chapter('达贡巢穴', '深海祭坛、誓约仪式、诅咒与祝福', ['tdeUnnaturalSituation', 'rites', 'thunderDreams']),
    intoTheMaelstrom: chapter('暗潮之下', '伊哈·恩斯雷门扉、深海之城、终局抉择', ['tdeFrozenStar', 'ancientRite', 'itIsLost']),
  }),
})

export const scenarioPlaylistId = (campaignId, scenarioId) =>
  SCENARIO_MUSIC[campaignId]?.[scenarioId] ? `${campaignId}/${scenarioId}` : null

export const SCENARIO_PLAYLISTS = Object.freeze(Object.fromEntries(
  Object.entries(SCENARIO_MUSIC).flatMap(([campaignId, chapters]) =>
    Object.entries(chapters).map(([scenarioId, chapter]) => [`${campaignId}/${scenarioId}`, chapter.tracks]))))
