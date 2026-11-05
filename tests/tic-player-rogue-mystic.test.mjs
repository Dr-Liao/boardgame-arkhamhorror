import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, settle } from './core-fixture.mjs'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { registeredEntry, registerCardAbilities } from '../src/engine/ability.js'
import { performTest, reactionWindow, drawCards, executeDescriptor, getStat, legalMoves, validateMove, spawnEnemy, relocateEnemy } from '../src/engine/engine.js'
import { resolveTransaction, choiceError } from '../src/engine/resolution.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { randomValue } from '../src/engine/rules-state.js'

const first = c => c.options.find(o => o.id.startsWith('desc:'))?.id
function run(state, body, select=()=>null) {
  resolveTransaction(state,0,{action:'ticPlayerTest'},body)
  for(let n=0;state.pendingChoice;n++) {
    assert.ok(n<160,JSON.stringify(state.pendingChoice))
    Object.assign(state, JSON.parse(JSON.stringify(state)))
    const c=state.pendingChoice
    const id=select(c,state)??['done','skip','self'].find(id=>c.options.some(o=>o.id===id))??c.options[0].id
    const cmd={action:'choose',choiceId:c.id,optionId:id}
    assert.equal(choiceError(state,c.seat,cmd),null)
    resolveTransaction(state,c.seat,cmd,body)
  }
}
function card(s,code,index=0,context={},select=()=>null) {
  const id=s.investigators[0].assets.find(a=>a.code===code)?.id
  run(s,draft=>executeDescriptor(draft,{inv:draft.investigators[0],source:draft.investigators[0].assets.find(a=>a.id===id)||{code},
    descriptor:registeredEntry(code).abilities[index],context,events:[]}),select)
}
function play(s,code,select=()=>null) {s.investigators[0].hand.push(code); move(s,{action:'play',cardId:code});settle(s,select)}
function setup(n=1) {const s=fixture('01001',n);s.abilityLimits={};s.enemies=[];for(const inv of s.investigators)inv.location=s.investigators[0].location;return s}

for(const code of ['07025','07305']) test(`P6 ${code} exhausted target bonus, ammo and empty-ammo rejection`,()=>{
  for(const exhausted of [false,true]) {
    const s=setup(),a=asset(s,code),e=enemy(s,{exhausted});
    const cmd=legalMoves(s,0).find(m=>m.action==='ability'&&m.assetId===a.id&&m.targetId===e.id&&m.abilityIndex===0)
    assert.ok(cmd);move(s,cmd);settle(s)
    assert.equal(s.enemies[0].damageTaken,exhausted?2:1);assert.equal(s.investigators[0].assets[0].uses,3)
    s.investigators[0].assets[0].uses=0
    assert.equal(legalMoves(s,0).some(m=>m.action==='ability'&&m.assetId===a.id&&m.abilityIndex===0),false)
  }
})
test('P6 07305 actual evade reaction pays ammo and no extra action',()=>{
  const s=setup(),a=asset(s,'07305'),e=enemy(s);s.chaosBag=['0','0']
  const before=s.investigators[0].actionsLeft
  move(s,{action:'evade',enemyId:e.id});settle(s,first)
  assert.equal(s.enemies[0].damageTaken,2);assert.equal(s.investigators[0].assets[0].uses,3)
  assert.equal(s.investigators[0].actionsLeft,before-1)
})
test('P6 07026 up-to-five seal, upkeep choice and leave-play release',()=>{
  const s=setup();s.chaosBag=['0',...Array(6).fill('curse')]
  play(s,'07026',c=>c.kind==='mechanic'?c.options.some(o=>o.id==='confirm')?'confirm':c.options.find(o=>o.id.startsWith('pick:')&&!o.selected)?.id:c.source===s.investigators[0].assets.find(a=>a.code==='07026')?.id?'5':null)
  const id=s.investigators[0].assets.find(a=>a.code==='07026').id
  assert.equal(s.chaos.sealed.filter(t=>t.source===id).length,5)
  const resources=s.investigators[0].resources
  run(s,d=>reactionWindow(d,'mythosEnd',{when:'mythosEnd',seat:0,location:d.investigators[0].location},[]),c=>c.source==='07026'?'pay':null)
  assert.equal(s.investigators[0].resources,resources-1)
  run(s,d=>reactionWindow(d,'mythosEnd',{when:'mythosEnd',seat:0,location:d.investigators[0].location},[]),c=>c.source==='07026'?'discard':null)
  assert.equal(s.chaos.sealed.length,0);assert.equal(s.chaosBag.filter(t=>t==='curse').length,6)
})
test('P6 07027 cancels opportunity attack only and spends one charge',()=>{
  const s=setup();asset(s,'07027');enemy(s,{damage:2})
  move(s,{action:'resource'});settle(s,first)
  assert.equal(s.investigators[0].damage,0);assert.equal(s.investigators[0].assets[0].uses,2)
})
test('P6 07028 extra cost preflight and resource distribution',()=>{
  const s=setup(2);s.chaosBag=['0'];s.investigators[0].hand=['07028']
  const before=s.investigators.map(i=>i.resources)
  move(s,{action:'play',cardId:'07028'});settle(s,c=>c.source==='07028'?'1':null)
  assert.equal(s.chaosBag.filter(t=>t==='curse').length,2)
  assert.deepEqual(s.investigators.map(i=>i.resources),[before[0],before[1]+5])
  const t=setup();t.chaosBag=['0',...Array(9).fill('curse')];t.investigators[0].hand=['07028']
  assert.ok(validateMove(t,0,{action:'play',cardId:'07028'}));assert.equal(t.investigators[0].resources,30)
})
test('P6 07029 enters-play reaction omits action and exhaust costs; action may use willpower',()=>{
  const s=setup(),e=enemy(s);const before=s.investigators[0].actionsLeft
  play(s,'07029',c=>first(c)??c.options.find(o=>o.id===`fight:${e.id}:willpower`)?.id)
  const a=s.investigators[0].assets.find(a=>a.code==='07029')
  assert.equal(a.exhausted,false);assert.equal(s.investigators[0].actionsLeft,before-1);assert.equal(s.enemies[0].damageTaken,1)
  const cmd=legalMoves(s,0).find(m=>m.action==='ability'&&m.assetId===a.id)
  move(s,cmd);settle(s,c=>c.options.find(o=>o.id===`evade:${e.id}:willpower`)?.id)
  assert.equal(s.investigators[0].assets[0].exhausted,true);assert.equal(s.enemies[0].exhausted,true)
})
test('P6 07030 bag replacement leaves sealed tokens alone and schedules reverse replacement',()=>{
  const s=setup();s.chaosBag=['0','curse','curse','bless'];createMechanicsApi(s).chaosTokens.seal('other','curse',1)
  play(s,'07030');assert.equal(s.chaosBag.filter(t=>t==='bless').length,2);assert.equal(s.chaos.sealed[0].token,'curse')
  assert.deepEqual(s.scenarioFlags.mechanics.tokenSchedules.map(({from,to})=>({from,to})),[{from:'bless',to:'curse'}])
})
test('P6 07031 five-token reveal cancels only with bless or elder sign and returns all physical tokens',()=>{
  for(const [token,cancelled] of [['bless',true],['eldersign',true],['0',false]]) {
    const s=setup();s.chaosBag=Array(5).fill(token)
    const descriptor=registeredEntry('07031').abilities[0]
    let observed
    run(s,d=>{d._reaction={when:'treachery',seat:0};executeDescriptor(d,{inv:d.investigators[0],source:{code:'07031'},descriptor,alreadyPaid:true,context:{},events:[]});observed=d._reaction.cancelled===true;delete d._reaction})
    assert.equal(observed,cancelled);assert.equal(s.chaosBag.length,5);assert.equal(s.chaos.revealed.length,0)
  }
})
test('P6 07032 Promise adds a curse after commit or takes two horror when pool full',()=>{
  for(const count of [0,10]) {
    const s=setup();s.chaosBag=['0',...Array(count).fill('curse')];if(count)createMechanicsApi(s).chaosTokens.seal('pool-full','curse',count);s.investigators[0].hand=['07032']
    run(s,d=>performTest(d,0,'willpower',0,{}),c=>c.kind==='commit'&&c.options.some(o=>o.id==='0')?'0':null)
    assert.ok(s.investigators[0].discard.includes('07032'));assert.equal(s.investigators[0].horror,count===10?2:0)
    assert.equal(createMechanicsApi(s).chaosTokens.count('curse'),count===10?10:s.chaosBag.filter(t=>t==='curse').length)
  }
})
test('P6 07114 succeeds by two to optionally evade an unengaged enemy; lower margin cannot',()=>{
  for(const shroud of [0,8]) {
    const s=setup(),e=enemy(s,{engagedSeat:null});const loc=s.locations.find(l=>l.id===s.investigators[0].location);loc.shroud=shroud;loc.clues=2
    play(s,'07114',c=>c.source==='07114'?e.id:null)
    assert.equal(Boolean(s.enemies[0].exhausted),shroud===0)
  }
})
test('P6 07116 False Covenant exhausts to cancel a physical curse and redraw',()=>{
  const s=setup();asset(s,'07116');s.chaosBag=['curse','0']
  // The seed search keeps the expected draw physical and reproducible; no mocked random API.
  for(let seed=1;seed<100;seed++){if(randomValue({rngState:seed})<0.5){s.rngState=seed;break}}
  run(s,d=>performTest(d,0,'willpower',0,{}),first)
  assert.equal(s.chaos.revealed.length,0);assert.equal(s.investigators[0].assets[0].exhausted,true)
})
test('P6 07120 Paradoxical Covenant accepts both revealed faces and rejects one-face tests',()=>{
  // 单元级：窗口里两个面都揭示时才提供反应；只揭示一面时不提供。
  const s=setup();asset(s,'07120')
  const both={when:'chaosRevealStepEnded',seat:0,location:s.investigators[0].location,tokens:[{face:'bless',index:0},{face:'curse',index:1}]}
  s.skillTest={seat:0,stage:'ST.4',value:0,difficulty:99,committed:[]}
  run(s,d=>reactionWindow(d,'chaosRevealStepEnded',both,[]),first)
  assert.equal(s.skillTest.autoSuccess,true);assert.equal(s.investigators[0].assets[0].exhausted,true)
  const one=setup();asset(one,'07120')
  one.skillTest={seat:0,stage:'ST.4',value:0,difficulty:99,committed:[]}
  run(one,d=>reactionWindow(d,'chaosRevealStepEnded',{...both,location:one.investigators[0].location,tokens:[{face:'bless',index:0}]},[]),first)
  assert.equal(one.skillTest.autoSuccess,undefined)
})
test('P6 07120 真实检定揭示祝福+诅咒后自动成功（审计 H10 回归）',()=>{
  // 祝福/诅咒都会「再揭示一枚」：袋里只有这三枚时，链式揭示必然同时出现祝福与诅咒。
  // 找到能稳定复现该顺序的种子（随机只走 randomValue，测试不 mock 随机）。
  let success=null, attempts=0
  for(let seed=1;seed<400&&!success;seed++) {
    const s=setup();const a=asset(s,'07120')
    s.chaosBag=['bless','curse','0'];s.rngState=seed
    let result
    run(s,d=>{result=performTest(d,0,'willpower',30,{})},c=>c.source===a.id?'trigger':first(c))
    const drawn=result?.drawn||[]
    if(!drawn.includes('bless')||!drawn.includes('curse')) continue
    attempts++
    // 基础意志 3 + 祝福/诅咒/0 的修正远低于难度 30：只有 autoSuccess 能让本次检定成功。
    assert.equal(result.success,true,'揭示祝福+诅咒后自动成功（修复前窗口写入的 autoSuccess 无人读）')
    assert.equal(s.investigators[0].assets.find(item=>item.code==='07120')?.exhausted,true,'横置代价已支付')
    assert.equal(result.value<30,true,'不是靠数值通过')
    success=result
  }
  assert.ok(success,'应至少有一个种子能同时揭示祝福与诅咒')
  assert.ok(attempts>0)
})
test('P6 07156 enters-play blessing reaction is optional; upkeep curse or discard',()=>{
  const s=setup();play(s,'07156',first);assert.equal(s.chaosBag.filter(t=>t==='bless').length,3)
  run(s,d=>reactionWindow(d,'upkeepEnd',{when:'upkeepEnd',seat:0},[]),c=>c.source==='07156'?'curse':null)
  assert.equal(s.chaosBag.filter(t=>t==='curse').length,1)
  s.chaosBag.push(...Array(9).fill('curse'))
  run(s,d=>reactionWindow(d,'upkeepEnd',{when:'upkeepEnd',seat:0},[]))
  assert.equal(s.investigators[0].assets.some(a=>a.code==='07156'),false)
})
test('P6 07159 doom cap and intellect attack damage',()=>{
  const s=setup(),a=asset(s,'07159',{doom:3}),e=enemy(s)
  const cmd=legalMoves(s,0).find(m=>m.action==='ability'&&m.assetId===a.id&&m.targetId===e.id)
  move(s,cmd);settle(s,c=>c.source==='07159'?'intellect':null)
  assert.equal(s.investigators[0].assets[0].doom,3);assert.equal(s.enemies[0].damageTaken,4)
})
test('P6 07193 only actually added curses grant skill and damage',()=>{
  const s=setup();s.investigators[0].combat=100;s.chaosBag=['0',...Array(9).fill('curse')];const e=enemy(s)
  play(s,'07193',c=>c.source==='07193'&&c.kind==='target'?e.id:c.source==='07193'?'1':null)
  assert.equal(s.lastTestResult.source.label,'攻击')
  assert.equal(s.enemies[0].damageTaken,2)
})
test('P6 07195 second curse can become skull and optionally retain its physical token',()=>{
  const s=setup();asset(s,'07195');s.chaosBag=['0'];s.chaos.revealed=['curse','curse'];s.chaos.frames=[0]
  s.skillTest={seat:0,committed:[],stage:'ST.4',tokenTreatments:{}}
  run(s,d=>reactionWindow(d,'tokenEffectWouldResolve',{when:'tokenEffectWouldResolve',seat:0,location:d.investigators[0].location,token:'curse',tokenIndex:1},[]),c=>c.source==='07195'?'no':first(c))
  assert.equal(s.skillTest.tokenTreatments[1].as,'skull');assert.equal(s.skillTest.tokenTreatments[1].retain,true)
})
test('P6 07224 coin uses deterministic random and draws only on bless-to-curse',()=>{
  const s=setup();asset(s,'07224');s.chaosBag=['0'];s.chaos.revealed=['bless'];s.chaos.frames=[0]
  s.skillTest={seat:0,committed:[],stage:'ST.4',tokenTreatments:{}}
  const before=s.investigators[0].hand.length
  run(s,d=>reactionWindow(d,'tokenEffectWouldResolve',{when:'tokenEffectWouldResolve',seat:0,location:d.investigators[0].location,token:'bless',tokenIndex:0},[]))
  const face=s.skillTest.tokenTreatments[0].as
  assert.ok(['bless','curse'].includes(face));assert.equal(s.investigators[0].hand.length,before+(face==='curse'?1:0))
})
test('P6 07265 promises apply only on own turn and discard Geas on the actual forbidden draw',()=>{
  const s=setup();play(s,'07265',c=>c.source==='07265'?'draw':null)
  assert.equal(getStat(s,s.investigators[0],'willpower'),s.investigators[0].willpower+1)
  run(s,d=>drawCards(d,d.investigators[0],1,[]))
  assert.equal(s.investigators[0].assets.some(a=>a.code==='07265'),false);assert.equal(s.chaosBag.filter(t=>t==='curse').length,10)
})
test('P6 07266 separate resource payers and replenish preserves resources above two',()=>{
  const s=setup();asset(s,'07266',{uses:4})
  run(s,d=>reactionWindow(d,'roundStarts',{when:'roundStarts'},[]));assert.equal(s.investigators[0].assets[0].uses,4)
  s.investigators[0].assets[0].uses=0
  run(s,d=>reactionWindow(d,'roundStarts',{when:'roundStarts'},[]));assert.equal(s.investigators[0].assets[0].uses,2)
  let used=false
  run(s,d=>performTest(d,0,'combat',0,{}),c=>{if(c.kind!=='playerWindow'||used)return null;const option=c.options.find(o=>o.label?.includes('老练探员上'));if(option){used=true;return option.id}return null})
  assert.equal(s.investigators[0].assets[0].uses,1);assert.equal(s.lastTestResult.value,s.investigators[0].combat+1)
})
test('P6 07306 any-skill commit exact curse cost and automatic success',()=>{
  const s=setup();s.investigators[0].hand=['07306']
  run(s,d=>performTest(d,0,'agility',6,{}),c=>c.kind==='commit'&&c.options.some(o=>o.id==='0')?'0':null)
  assert.equal(s.lastTestResult.success,true);assert.equal(s.chaosBag.filter(t=>t==='curse').length,6)
  assert.equal(s.chaos.revealed.length,0)
})
test('P6 07308 add tokens or heal horror distributed over local investigator and asset',()=>{
  const s=setup();play(s,'07308',c=>c.source==='07308'?'3':null)
  assert.equal(s.chaosBag.filter(t=>t==='bless').length,3);assert.equal(s.chaosBag.filter(t=>t==='curse').length,3)
  s.investigators[0].horror=1;const a=asset(s,'01033',{horror:2})
  play(s,'07308',c=>c.source==='07308'&&c.options.some(o=>o.id==='heal')?'heal':c.source==='07308'&&c.kind==='effect'?'3':c.source==='07308'&&c.options.some(o=>o.id==='investigator:0')?'investigator:0':c.source==='07308'?`asset:${a.id}`:null)
  assert.equal(s.investigators[0].horror,0);assert.equal(s.investigators[0].assets[0].horror,0)
})

for(const [code,action,upgraded] of [['07117','fight',false],['07118','investigate',false],['07119','evade',false],['07226','fight',true],['07227','investigate',true],['07228','evade',true]]) {
  test('P6 '+code+' uses willpower, printed bonus and exact charge cost',()=>{
    const s=setup(),a=asset(s,code),e=enemy(s),inv=s.investigators[0],loc=s.locations.find(l=>l.id===inv.location)
    loc.shroud=0;loc.clues=5;inv.clues=0
    const cmd=legalMoves(s,0).find(m=>m.action==='ability'&&m.assetId===a.id&&m.abilityIndex===0&&(action==='investigate'||m.targetId===e.id))
    assert.ok(cmd);move(s,cmd);settle(s)
    assert.equal(s.lastTestResult.skill,'willpower');assert.equal(s.lastTestResult.value,inv.willpower+(upgraded?2:0))
    assert.equal(s.investigators[0].assets[0].uses,2)
    if(action==='fight')assert.equal(s.enemies[0].damageTaken,2)
    if(action==='investigate')assert.equal(s.investigators[0].clues,2)
    if(action==='evade')assert.equal(s.enemies[0].exhausted,true)
  })
  test('P6 '+code+' curse reward occurs even on failure; base once and upgrade each curse',()=>{
    const s=setup(),a=asset(s,code),e=enemy(s,{fight:99,evade:99}),loc=s.locations.find(l=>l.id===s.investigators[0].location)
    loc.shroud=99;loc.clues=4;s.chaosBag=['curse','curse','0']
    for(let seed=1;seed<1000;seed++){const rng={rngState:seed};if(randomValue(rng)<2/3&&randomValue(rng)<1/2){s.rngState=seed;break}}
    const cmd=legalMoves(s,0).find(m=>m.action==='ability'&&m.assetId===a.id&&m.abilityIndex===0&&(action==='investigate'||m.targetId===e.id))
    move(s,cmd);settle(s,c=>c.options.some(o=>o.id==='charge')?'charge':null)
    assert.equal(s.lastTestResult.success,false)
    assert.equal(s.investigators[0].assets[0].uses,upgraded?4:3)
  })
}

test('P6 07158 doom is a cost, adds two only to the matching test and is once per test',()=>{
  const s=setup(),a=asset(s,'07158');let used=false
  run(s,d=>performTest(d,0,'willpower',0,{}),c=>{
    if(c.kind!=='playerWindow'||used)return null
    const o=c.options.find(o=>o.label?.includes('意志')&&o.label?.includes('毁灭'))
    if(o){used=true;return o.id}return null
  })
  assert.equal(s.investigators[0].assets[0].doom,1);assert.equal(s.lastTestResult.value,s.investigators[0].willpower+2)
})
test('P6 07158 「每次检定一次」在同一回合的第二次检定仍可用（审计 M27 perTest 键回归）',()=>{
  // perTest 实例 id 只在 TIC 章节（eventWindowInstances）写入；07158 是 TIC 玩家卡，用真实章节夹具。
  const s=chapterFixture('theVanishingOfElinaHarper');s.enemies=[];asset(s,'07158')
  const useInOneTest=()=>{
    let uses=0
    run(s,d=>performTest(d,0,'willpower',0,{}),c=>{
      if(c.kind!=='playerWindow')return null
      const o=c.options.find(o=>o.label?.includes('意志')&&o.label?.includes('毁灭'))
      if(o){uses++;return o.id}
      return null
    })
    return uses
  }
  assert.equal(useInOneTest(),1,'第一次检定支付 1 毁灭、+2 意志')
  assert.equal(s.lastTestResult.value,s.investigators[0].willpower+2)
  // 修复前 perTest 键取从未赋值的 state.skillTest.id，回落到 round/turnSerial → 同一回合的
  // 第二次检定被误判为「同一次检定」，能力消失（审计 M27/M32 根因）。
  assert.equal(useInOneTest(),1,'同一回合的第二次检定仍可用')
  assert.equal(s.lastTestResult.value,s.investigators[0].willpower+2)
  assert.equal(s.investigators[0].assets[0].doom,2,'两次检定各支付 1 毁灭')
})
test('P6 07267 captures a basic weakness from its actual owner and draws it on leave',()=>{
  const s=setup(2),a=asset(s,'07267');s.investigators[1].deck.push('01098')
  const before=getStat(s,s.investigators[0],'willpower')
  run(s,d=>drawCards(d,d.investigators[1],1,[]),first)
  assert.equal(s.investigators[1].threat.length,0);assert.deepEqual(s.investigators[0].assets[0].capturedCards,[{code:'01098',seat:1}])
  assert.equal(getStat(s,s.investigators[0],'willpower'),before-1)
  const descriptor={...registeredEntry('07267').abilities[1],resolve:({inv,source,api})=>api.discardAsset(inv.seat,source)}
  run(s,d=>executeDescriptor(d,{inv:d.investigators[0],source:d.investigators[0].assets[0],descriptor,alreadyPaid:true,events:[]}))
  assert.ok(s.investigators[1].threat.some(t=>t.code==='01098'));assert.equal(s.investigators[0].threat.length,0)
})


test('P6 07115 Skeptic changes each physical bless and curse modifier to plus one',()=>{
  const s=setup();s.investigators[0].hand=['07115'];s.chaosBag=['bless','curse','0']
  for(let seed=1;seed<1000;seed++){const rng={rngState:seed};if(randomValue(rng)<2/3&&randomValue(rng)<1/2){s.rngState=seed;break}}
  run(s,d=>performTest(d,0,'willpower',0,{}),c=>c.kind==='commit'&&c.options.some(o=>o.id==='0')?'0':null)
  assert.equal(s.lastTestResult.value,s.investigators[0].willpower+3)
  assert.ok(s.lastTestResult.drawn.includes('bless'));assert.ok(s.lastTestResult.drawn.includes('curse'))
})
test('P6 07194 Tristan picks two distinct skills until that investigator next turn',()=>{
  const s=setup(2);asset(s,'07194');const before=['willpower','intellect','combat','agility'].map(k=>getStat(s,s.investigators[0],k))
  run(s,d=>reactionWindow(d,'turnBegins',{when:'turnBegins',seat:0,location:d.investigators[0].location},[]),c=>first(c)??(c.source==='07194'?c.options.some(o=>o.id==='willpower')?'willpower':'intellect':null))
  assert.equal(getStat(s,s.investigators[0],'willpower'),before[0]+1);assert.equal(getStat(s,s.investigators[0],'intellect'),before[1]+1)
  assert.equal(getStat(s,s.investigators[0],'combat'),before[2]);assert.equal(s.effects[0].duration,'startOfNextTurn')
})
test('P6 07194 Tristan plays from hand free after three actual special tokens',()=>{
  const s=setup();s.investigators[0].hand=['07194'];s.chaosBag=['curse','curse','curse','0']
  for(let seed=1;seed<1000;seed++){const rng={rngState:seed};if(randomValue(rng)<3/4&&randomValue(rng)<2/3&&randomValue(rng)<1/2){s.rngState=seed;break}}
  const resources=s.investigators[0].resources,actions=s.investigators[0].actionsLeft
  run(s,d=>performTest(d,0,'willpower',0,{}),first)
  assert.ok(s.investigators[0].assets.some(a=>a.code==='07194'));assert.equal(s.investigators[0].hand.includes('07194'),false)
  assert.equal(s.investigators[0].resources,resources);assert.equal(s.investigators[0].actionsLeft,actions)
})
test('P6 07225 Djinn sets current base to five without lasting into later tests or others turns',()=>{
  const s=setup(2);asset(s,'07225')
  run(s,d=>performTest(d,0,'willpower',0,{}),first)
  assert.equal(s.lastTestResult.value,5);assert.equal(s.investigators[0].assets[0].exhausted,true)
  s.investigators[0].assets[0].exhausted=false;s.currentSeat=1
  run(s,d=>performTest(d,0,'willpower',0,{}),first)
  assert.equal(s.lastTestResult.value,s.investigators[0].willpower);assert.equal(s.investigators[0].assets[0].exhausted,false)
})
test('P6 07268 Flute X resource cost seals up to X and release is required',()=>{
  const s=setup();s.chaosBag=['0','curse','curse','curse'];const e=enemy(s,{elite:false,damage:2}),victim=enemy(s,{engagedSeat:null})
  play(s,'07268',c=>c.source==='07268'?'2':c.kind==='mechanic'?c.options.some(o=>o.id==='confirm')?'confirm':c.options.find(o=>o.id.startsWith('pick:')&&!o.selected)?.id:c.options.some(o=>o.id==='2')?'2':null)
  const a=s.investigators[0].assets.find(a=>a.code==='07268');assert.ok(a)
  // 官方卡面/参考实现口径：Cost X = 实付 X 资源（PaidForCardCost 的 totalResourcePayment）。
  assert.equal(s.investigators[0].resources,28);assert.equal(s.chaos.sealed.filter(t=>t.source===a.id).length,2)
  const cmd=legalMoves(s,0).find(m=>m.action==='ability'&&m.assetId===a.id&&m.targetId===e.id)
  assert.ok(cmd);move(s,cmd);settle(s,c=>c.source==='07268'?'damage:'+victim.id:null)
  assert.equal(s.enemies.find(x=>x.id===victim.id).damageTaken,2);assert.equal(s.chaos.sealed.filter(t=>t.source===a.id).length,1)
  assert.equal(s.investigators[0].assets[0].exhausted,true)
})
test('P6 07307 Dice exact curse cost ignores one token and guarded next curse returns asset',()=>{
  const s=setup();asset(s,'07307');s.chaosBag=['0','autofail']
  for(let seed=1;seed<1000;seed++){if(randomValue({rngState:seed})<0.5){s.rngState=seed;break}}
  // The initial 0 is ignored; every possible next token is guarded curse or autofail.
  run(s,d=>performTest(d,0,'willpower',0,{}),first)
  assert.ok(s.investigators[0].hand.includes('07307'));assert.equal(s.investigators[0].assets.some(a=>a.code==='07307'),false)
  assert.ok(s.lastTestResult.drawn.some(t=>['curse','autofail'].includes(t)));assert.equal(s.lastTestResult.drawn.includes('0'),false)
})

for(const entersBy of ['spawn','move'])test('P6 07157 Under Surveillance triggers once on nonElite '+entersBy+' and retains event until entry',()=>{
  const s=setup();const here=s.investigators[0].location;const loc=s.locations.find(l=>l.id===here);loc.clues=2;s.investigators[0].clues=0
  play(s,'07157');assert.equal(s.investigators[0].discard.includes('07157'),false);assert.equal(s.playerLocationAttachments.length,1)
  s.investigators[0].hand.push('07157');assert.ok(validateMove(s,0,{action:'play',cardId:'07157'}));s.investigators[0].hand=[]
  if(entersBy==='spawn')run(s,d=>spawnEnemy(d,'ghoulMinion',here,0))
  else {s.locations.push({id:'outside',name:'外面',connections:[here],revealed:true,clues:0,shroud:1});loc.connections.push('outside');const e=enemy(s,{location:'outside',engagedSeat:null});run(s,d=>relocateEnemy(d,d.enemies.find(x=>x.id===e.id),here,[]))}
  assert.equal(s.playerLocationAttachments.length,0);assert.ok(s.investigators[0].discard.includes('07157'))
  assert.equal(s.investigators[0].clues,1);assert.equal(s.enemies[0].exhausted,true);assert.equal(s.enemies[0].preventReady.rounds,1)
})

registerCardAbilities([
  {code:'ticPlayerReadyTarget',abilities:[{kind:'forced',trigger:'tokenEffectWouldResolve',label:'验收：在标记结算前重整目标',resolve:({state,api})=>api.ready(state.enemies[0])}]},
  {code:'ticPlayerRemoveSourceDoom',abilities:[{kind:'forced',trigger:'tokenEffectWouldResolve',label:'验收：在标记结算前移除源毁灭',resolve:({state,api})=>api.removeDoomFromCard(state.investigators[0].assets.find(a=>a.code==='07159'),2)}]},
  {code:'ticPlayerPoolProbe',abilities:[{kind:'forced',trigger:'chaosTokenRevealed',label:'验收：立即归还标记池可用性',criteria:({context})=>context.token==='0',resolve:({api})=>api.setScenarioFlag('ticPoolProbe',api.chaosTokens.add('curse',1,{exact:true}))}]},
])
for(const code of ['07025','07305'])test('P6 '+code+' exhausted-target bonus rechecks target readiness during the actual test',()=>{
  const s=setup(),a=asset(s,code),e=enemy(s,{exhausted:true});asset(s,'ticPlayerReadyTarget')
  const cmd=legalMoves(s,0).find(m=>m.action==='ability'&&m.assetId===a.id&&m.abilityIndex===0&&m.targetId===e.id)
  move(s,cmd);settle(s)
  assert.equal(s.enemies[0].exhausted,false);assert.equal(s.enemies[0].damageTaken,1)
  assert.equal(s.lastTestResult.value,s.investigators[0].combat)
})
test('P6 07159 doom-based bonus rechecks source doom at resolution',()=>{
  const s=setup(),a=asset(s,'07159',{doom:3}),e=enemy(s);asset(s,'ticPlayerRemoveSourceDoom')
  const cmd=legalMoves(s,0).find(m=>m.action==='ability'&&m.assetId===a.id&&m.targetId===e.id)
  move(s,cmd);settle(s,c=>c.source==='07159'?'combat':null)
  assert.equal(s.investigators[0].assets[0].doom,1);assert.equal(s.enemies[0].damageTaken,2)
  assert.equal(s.lastTestResult.value,s.investigators[0].combat+1)
})
test('P6 07225 Djinn sets each base skill in a combined-skill test to five',()=>{
  const s=setup();asset(s,'07225');run(s,d=>performTest(d,0,['willpower','agility'],0,{}),first)
  assert.equal(s.lastTestResult.value,10)
})
test('P6 07116 False Covenant returns the canceled curse to pool before the next reveal',()=>{
  const s=setup();asset(s,'07116');asset(s,'ticPlayerPoolProbe');s.chaosBag=[...Array(10).fill('curse'),'0']
  createMechanicsApi(s).chaosTokens.seal('other','curse',9)
  for(let seed=1;seed<1000;seed++){if(randomValue({rngState:seed})<0.5){s.rngState=seed;break}}
  run(s,d=>performTest(d,0,'willpower',0,{}),first)
  assert.equal(s.scenarioFlags.ticPoolProbe,1)
})
