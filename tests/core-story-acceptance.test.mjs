import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, answer, settle, asset, enemy, play, use, validateMove } from './core-fixture.mjs'
import { SCENARIOS } from '../src/cards/scenarios-data.js'

function scene(id) {
  const s=fixture('01005'); s.scenario=structuredClone(SCENARIOS[id]); s.campaign.scenarioIndex=Object.keys(SCENARIOS).indexOf(id)
  s.acts=structuredClone(s.scenario.acts); s.agendas=structuredClone(s.scenario.agendas); s.actIndex=0; s.agendaIndex=0
  s.locations=Object.values(s.scenario.locations).map(l=>({...l,revealed:true,clues:l.cluesPerInvestigator||0,maxClues:l.cluesPerInvestigator||0}))
  s.investigators[0].location=s.scenario.startLocation
  return s
}

test('Core 01105 议程一两个背面分支分别弃牌或队长受恐惧',()=>{
  for(const option of ['horror','discard']) {
    const s=fixture(); s.doom=2; s.investigators[0].hand=['01088']; move(s,{action:'endTurn'})
    settle(s,c=>c.kind==='agenda'?option:null)
    assert.equal(s.agendaIndex,1); assert.equal(s.investigators[0].horror,option==='horror'?2:0)
    assert.equal(s.investigators[0].hand.length,option==='discard'?1:2)
  }
})

test('Core 01106 议程二洗回遭遇弃牌并弃到食尸鬼由队长抽取',()=>{
  const s=fixture(); s.agendaIndex=1; s.doom=6; s.encounterDeck=['dissonantVoices']; s.encounterDiscard=['ghoulMinion']
  move(s,{action:'endTurn'}); settle(s)
  assert.equal(s.agendaIndex,2); assert.ok(s.enemies.some(e=>e.code==='ghoulMinion'&&e.engagedSeat===0))
})

test('Core 01108 01111 01112 支付线索离开书房，四地点入场并删除书房',()=>{
  const s=fixture(); s.investigators[0].clues=2; s.clues=2
  move(s,{action:'advanceAct'}); settle(s)
  assert.equal(s.actIndex,1); assert.equal(s.investigators[0].location,'hallway')
  assert.deepEqual(s.locations.map(l=>l.id).sort(),['attic','cellar','hallway','parlor'])
  assert.ok(s.locations.find(l=>l.id==='hallway').revealed); assert.equal(s.investigators[0].clues,0)
})

test('Core 01108 01105 推进时演出文本取卡背 advanceText，而不是通用占位句',()=>{
  const run = (s, action) => {
    const events = []
    events.push(...move(s,{action}))
    for(let guard=0; s.pendingChoice && guard<20; guard++) {
      const c=s.pendingChoice
      const id=['done','skip','self'].find(id=>c.options.some(o=>o.id===id)) ?? c.options[0]?.id
      events.push(...move(s,{action:'choose',choiceId:c.id,optionId:id}))
    }
    return events
  }
  const actState=fixture(); actState.investigators[0].clues=2; actState.clues=2
  const actCue=run(actState,'advanceAct').find(event=>event.presentation?.title==='场景推进')
  assert.equal(actCue.presentation.text, SCENARIOS.theGathering.acts[0].advanceText)
  assert.ok(!actCue.presentation.text.includes('翻开场景卡'), '不能回落到通用占位句')

  const agendaState=fixture(); agendaState.doom=agendaState.agendas[0].doomThreshold-1
  const agendaCue=run(agendaState,'endTurn').find(event=>event.presentation?.title==='密谋推进')
  assert.equal(agendaCue.presentation.text, SCENARIOS.theGathering.agendas[0].advanceText)
  assert.ok(!agendaCue.presentation.text.includes('翻开密谋'), '不能回落到通用占位句')
})

test('Core 01109 01115 01117 轮末走廊付线索揭示客厅、生成丽塔和祭司',()=>{
  const s=scene('theGathering'); s.actIndex=1; s.investigators[0].location='hallway'; s.investigators[0].clues=3; s.clues=3
  assert.ok(validateMove(s,0,{action:'advanceAct'})); move(s,{action:'endTurn'})
  settle(s,c=>c.kind==='act'?'advance':c.kind==='payment'?'3':null)
  assert.equal(s.actIndex,2); assert.ok(s.locations.find(l=>l.id==='parlor').revealed)
  assert.equal(s.storyAssets[0].code,'01117'); assert.equal(s.storyAssets[0].location,'parlor'); assert.equal(s.enemies[0].code,'ghoulPriest')
})

test('Core 01110 击败祭司后选择房屋命运，两条结局互斥',()=>{
  for(const resolution of ['r1','r2']) {
    const s=scene('theGathering'); s.actIndex=2; const e=enemy(s,{code:'ghoulPriest',health:1})
    move(s,{action:'fight',enemyId:e.id}); settle(s,c=>c.kind==='story'&&c.options.some(o=>o.id===resolution)?resolution:null)
    assert.equal(s.campaign.scenarioResults[0].resolution,resolution)
    assert.equal(!!s.campaign.records.houseBurned,resolution==='r1')
  }
})

test('Core 01107 最终议程按当前幕进入死亡或逃脱分支',()=>{
  for(const act of [0,2]) {
    const s=scene('theGathering'); s.actIndex=act; s.agendaIndex=2; s.doom=9
    enemy(s,{code:'ghoulPriest',location:'attic',engagedSeat:null})
    move(s,{action:'endTurn'}); settle(s)
    assert.equal(s.campaign.scenarioResults[0].resolution,act===0?'r3':'noResolution')
    if(act===2) assert.equal(s.campaign.investigators[0].trauma.physical,1)
  }
})

test('Core 01121a 01122 假面议程先生成猎手，再到午夜结局',()=>{
  const s=scene('theMidnightMasks'); s.doom=s.agendas[0].doomThreshold-1
  move(s,{action:'endTurn'}); settle(s)
  assert.equal(s.agendaIndex,1); assert.ok(s.enemies.some(e=>e.code==='theMaskedHunter'))
  s.enemies=[]; s.investigators[0].engaged=[]; s.doom=s.agendas[1].doomThreshold-1
  move(s,{action:'endTurn'}); settle(s)
  assert.equal(s.campaign.scenarioResults[0].resolution,'r2'); assert.equal(s.campaign.records.pastMidnight,true)
})

test('Core 01123 团队花费线索抽取异教徒，收集六人后结局一',()=>{
  const s=scene('theMidnightMasks'); s.cultistDeck=['ruthTurner']; s.investigators[0].clues=2; s.clues=2
  move(s,{action:'drawCultist'}); settle(s)
  assert.equal(s.cultistDeck.length,0); assert.equal(s.investigators[0].clues,0); assert.equal(s.enemies[0].code,'ruthTurner')
  s.cultistsInVictory=['wolfManDrew','hermanCollins','peterWarren','victoriaDevereux','ruthTurner','theMaskedHunter']
  move(s,{action:'resource'}); settle(s)
  assert.equal(s.campaign.scenarioResults[0].resolution,'r1')
})

test('Core 01143 议程一从弃牌找出怪物强制生成主道路并放毁灭',()=>{
  const s=scene('theDevourerBelow'); s.doom=3; s.encounterDeck=['dissonantVoices']; s.encounterDiscard=['fleshEater']
  move(s,{action:'endTurn'}); settle(s)
  const e=s.enemies.find(e=>e.code==='fleshEater'); assert.ok(e); assert.equal(e.location,'mainPath'); assert.equal(e.doom,1)
  assert.equal(s.agendaIndex,1)
})

test('Core 01144 议程二增加敌人难度，背面检定失败把疯狂弱点加入手牌',()=>{
  const s=scene('theDevourerBelow'); s.agendaIndex=1; s.investigators[0].willpower=0; s.chaosBag=['autofail']; s.doom=4
  move(s,{action:'endTurn'}); settle(s)
  assert.equal(s.agendaIndex,2); assert.ok(s.investigators[0].hand.some(c=>['01096','01097','01099','01100'].includes(c)))
})

test('Core 01146 01147 线索推进放入仪式地和逃跑异教徒，进入仪式地推进到第三幕',()=>{
  const s=scene('theDevourerBelow'); s.locations=s.locations.filter(l=>l.id!=='ritualSite')
  s.campaign.records.cultistsEscaped=['01138']; s.investigators[0].clues=3; s.clues=3
  move(s,{action:'advanceAct'}); settle(s)
  assert.equal(s.actIndex,1); assert.ok(s.locations.find(l=>l.id==='ritualSite')); assert.equal(s.enemies[0].location,'mainPath')
  s.enemies=[]; s.investigators[0].engaged=[]; s.encounterDeck=['fleshEater']; s.encounterDiscard=[]
  move(s,{action:'move',locationId:'ritualSite'}); settle(s)
  assert.equal(s.actIndex,2); assert.equal(s.enemies[0].code,'fleshEater'); assert.equal(s.enemies[0].location,'ritualSite')
})

test('Core 01148 破坏仪式支付个人线索、检定成功积累并进入结局一',()=>{
  const s=scene('theDevourerBelow'); s.actIndex=2; s.investigators[0].clues=2; s.clues=2; s.investigators[0].willpower=5
  for(let i=0;i<2;i++) {move(s,{action:'interruptRitual',skill:'willpower'}); settle(s)}
  assert.equal(s.campaign.scenarioResults[0].resolution,'r1'); assert.equal(s.campaign.records.ritualBroken,true)
})

test('Core 01149 主道路撤退到无结局失败，不误报胜利',()=>{
  const s=scene('theDevourerBelow'); move(s,{action:'resign'}); settle(s)
  assert.equal(s.campaign.scenarioResults[0].resolution,'noResolution'); assert.equal(s.campaign.failed,true)
})

test('Core 01129 大学搜索书籍或法术，01134 北区支付五资源全队仅一次',()=>{
  const s=scene('theMidnightMasks'); s.investigators[0].location='miskatonicUniversity'; s.investigators[0].deck=['01060','01088']
  move(s,{action:'locationAbility',locationId:'miskatonicUniversity'}); settle(s,c=>c.kind==='search'?c.options.find(o=>o.id!=='skip').id:null)
  assert.ok(s.investigators[0].hand.includes('01060'))
  s.investigators[0].location='northside'; move(s,{action:'locationAbility',locationId:'northside'}); settle(s)
  assert.equal(s.investigators[0].resources,25); assert.equal(s.investigators[0].clues,2)
  assert.ok(validateMove(s,0,{action:'locationAbility',locationId:'northside'}))
})

test('Core 01010 在逃中只在自己回合开始打出，当轮非精英不交战或攻击',()=>{
  const s=fixture('01003'); s.investigators[0].hand=['01010']; s.investigators[0].deck=Array(10).fill('01088')
  s.encounterDeck=['obscuringFog']
  move(s,{action:'endTurn'}); settle(s,c=>c.kind==='reaction'&&c.options.some(o=>o.cardCode==='01010')?c.options.find(o=>o.cardCode==='01010').id:null)
  assert.ok(s.investigators[0].onTheLam); assert.ok(s.investigators[0].discard.includes('01010'))
  enemy(s,{damage:1}); move(s,{action:'resource'}); settle(s); assert.equal(s.investigators[0].damage,0)
})

test('Core 01022 证据只在自己击败后发现线索，不在队友击败后响应',()=>{
  const s=fixture('01005',2); s.humanSeats=[0,1]; s.investigators[0].hand=['01022']; s.investigators[1].hand=['01022']; const e=enemy(s,{health:1})
  move(s,{action:'fight',enemyId:e.id}); answer(s,'done')
  let teammateOffered=false
  // 击败后的「本地点」窗口属于同地点的其他调查员，但「证据！」只响应「你击败」，
  // 不能把 01022 列为该窗口的快速事件候选（修复前同地点窗口会把它错递给队友）。
  settle(s,c=>{
    if(c.kind==='reaction'&&c.seat===1&&c.options.some(o=>o.cardCode==='01022')) teammateOffered=true
    return c.kind==='reaction'&&c.seat===0&&c.options.some(o=>o.cardCode==='01022')?'0':null
  })
  assert.equal(teammateOffered,false,'队友不应在本地点被击败后被询问「证据！」')
  assert.equal(s.investigators[0].clues,1); assert.deepEqual(s.investigators[1].hand,['01022'])
})

test('Core 01055 打出飞贼本身仍会引发借机攻击（只有脱身行动豁免）',()=>{
  const s=fixture(); s.investigators[0].hand=['01055']; s.investigators[0].resources=10
  enemy(s,{damage:1})
  move(s,{action:'play',cardId:'01055'}); settle(s)
  assert.equal(s.investigators[0].damage,1,'打出资产不享受行动的「不引发借机攻击」')
  assert.ok(s.investigators[0].assets.some(asset=>asset.code==='01055'))
})

test('Core 01050 01055 脱离并移动遵守目的地限制且不受借机攻击',()=>{
  for(const code of ['01050','01055']) {
    const s=fixture(); s.locations[0].connections=['target']; s.locations.push({...s.locations[0],id:'target',revealed:true})
    enemy(s,{damage:1}); if(code==='01050') play(s,code); else use(s,asset(s,code))
    settle(s,c=>c.kind==='move'?'target':null)
    assert.equal(s.investigators[0].location,'target'); assert.equal(s.investigators[0].damage,0)
    assert.equal(s.enemies[0].location,'study'); assert.equal(s.enemies[0].engagedSeat,null)
  }
})
