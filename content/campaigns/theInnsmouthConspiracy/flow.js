const effect=event=>({type:'registered',handler:'innsmouthInterludes',event})
const scenario=(scenarioId,next)=>({type:'scenario',scenarioId,next})
const interlude=(event,next,upgrades=true)=>({type:'interlude',title:event,next,upgrades,effects:[effect(event)]})
export const flow={start:'prologue',nodes:{
 prologue:{type:'story',next:'thePitOfDespair',effects:[effect('prologue')]},
 thePitOfDespair:scenario('thePitOfDespair','interlude1'),
 interlude1:interlude('interlude1','harperPreparation',false),
 // 参考 nextStep：interlude1 → continueNoUpgrade TheVanishingOfElinaHarper（无升级窗口，审计 M40）。
 harperPreparation:{...interlude('prepareHarper','theVanishingOfElinaHarper',false),title:'艾莲娜·哈珀失踪案：故事与牌组升级'},
 theVanishingOfElinaHarper:scenario('theVanishingOfElinaHarper','interlude2'),
 interlude2:interlude('interlude2','inTooDeep'),
 inTooDeep:scenario('inTooDeep','devilReef'),
 devilReef:scenario('devilReef','interlude3'),
 interlude3:interlude('interlude3','horrorInHighGear'),
 horrorInHighGear:scenario('horrorInHighGear','beforeFog'),
 beforeFog:{type:'interlude',title:'雾中之光前的牌组升级',next:'aLightInTheFog',upgrades:true},
 aLightInTheFog:scenario('aLightInTheFog','theLairOfDagon'),
 theLairOfDagon:scenario('theLairOfDagon','interlude4'),
 interlude4:interlude('interlude4','intoTheMaelstrom'),
 intoTheMaelstrom:scenario('intoTheMaelstrom','epilogue'),
 epilogue:{type:'story',next:'end',effects:[effect('epilogue')]},
 end:{type:'end',outcome:'victory'},
}}
