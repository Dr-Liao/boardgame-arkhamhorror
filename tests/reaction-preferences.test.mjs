import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, allCardDefs, applyMove } from '../src/engine/engine.js'
import { EFFECTS, isAutomaticReward } from '../src/cards/card-effects.js'
import { requestChoice, resolveTransaction } from '../src/engine/resolution.js'
import { reactionChoices, reactionView, reactionEnabled, setReactionEnabled } from '../web/reaction-preferences.js'

test('免费且不限次的资源反应自动领取，有成本、目标或次数限制的反应保留选择',()=>{
  assert.equal(isAutomaticReward(EFFECTS['01033'].reactions[0]),true)
  const reward={effect:{type:'gainResource',amount:1}}
  for(const r of [{...reward,cost:{resources:1}},{...reward,cost:{exhaust:true}},
    {...reward,limit:'round'},{effect:{type:'gainResource',target:'location'}},
    {effect:{type:'draw',amount:1}},{effect:{type:'dealDamage',amount:1}}])assert.equal(isAutomaticReward(r),false)
  const defs=allCardDefs({runtimeOnly:true})
  assert.equal(defs['01033'].hasReactionPrompt,false)
  assert.equal(defs['01073'].hasReactionPrompt,true)
  assert.equal(defs['01075'].hasReactionPrompt,true)
})

test('米兰调查奖励不询问，后续反应读档恢复不重复领取',()=>{
  const st=createGameState({playerInvestigator:'01001',seed:'milan-auto'},[{seat:0,role:'human'}])
  const answer=(s,id)=>applyMove(s,s.pendingChoice.seat,{action:'choose',choiceId:s.pendingChoice.id,optionId:id})
  for(let i=0;st.pendingChoice;i++){
    assert.ok(i<40)
    answer(st,['done','skip','self'].find(id=>st.pendingChoice.options.some(o=>o.id===id))||st.pendingChoice.options[0].id)
  }
  const inv=st.investigators[0]
  inv.hand=[];inv.assets=[{id:'milan',code:'01033'},{id:'scavenge',code:'01073'}];inv.discard=['01087']
  inv.actionsLeft=3;st.chaosBag=['0']
  const loc=st.locations.find(l=>l.id===inv.location);loc.shroud=0;loc.clues=5
  const resources=inv.resources,events=applyMove(st,0,{action:'investigate'})
  for(let i=0;st.pendingChoice?.source!=='scavenging';i++){
    assert.ok(i<20);assert.ok(st.pendingChoice)
    assert.notEqual(st.pendingChoice.source,'milan')
    events.push(...answer(st,['done','skip'].find(id=>st.pendingChoice.options.some(o=>o.id===id))))
  }
  assert.equal(st.investigators[0].resources,resources+1)
  assert.ok(st.continuation.answers.some(a=>a.source==='milan'&&a.optionId==='trigger'))
  const resumed=JSON.parse(JSON.stringify(st))
  answer(resumed,'skip')
  assert.equal(resumed.investigators[0].resources,resources+1)
  assert.equal(resumed.investigators[0].actionsLeft,2)
  assert.equal(events.filter(e=>e.text?.includes('触发「米兰')).length,1)
})

test('自动奖励保留 AI 非本人回合跳过策略和已保存答案',()=>{
  for(const currentSeat of [0,1]){
    const st={revision:0,currentSeat,phase:'investigation',humanSeats:[0],resources:0}
    const execute=draft=>{
      const answer=requestChoice(draft,{kind:'reaction',source:'milan',seat:1,canSkip:true,automaticOptionId:'trigger',options:[{id:'skip'},{id:'trigger'}]})
      if(answer==='trigger')draft.resources++
      requestChoice(draft,{kind:'target',source:'next',seat:1,options:[{id:'done'}]})
    }
    resolveTransaction(st,currentSeat,{action:'test'},execute)
    assert.equal(st.pendingChoice.source,'next')
    assert.equal(st.resources,currentSeat===1?1:0)
    const restored=JSON.parse(JSON.stringify(st))
    resolveTransaction(restored,1,{optionId:'done'},execute)
    assert.equal(restored.resources,st.resources)
  }
  const st={revision:0,currentSeat:0,phase:'investigation',humanSeats:[0]}
  const execute=auto=>draft=>{draft.answer=requestChoice(draft,{kind:'reaction',source:'milan',seat:0,canSkip:true,automaticOptionId:auto?'trigger':null,options:[{id:'skip'},{id:'trigger'}]})}
  resolveTransaction(st,0,{action:'test'},execute(false))
  resolveTransaction(st,0,{optionId:'skip'},execute(true))
  assert.equal(st.answer,'skip','已存储的选择仍按原答案恢复')
})

test('反应开关按本局、角色与卡牌记忆，混合窗口保留开启项，可重新开启',()=>{
  const st=createGameState({seed:'reaction-preferences',playerInvestigator:'01001'},[{seat:0,role:'human'},{seat:1,role:'ai'}])
  st.investigators[0].hand=['01023','01065']
  st.pendingChoice={id:'r',kind:'reaction',seat:0,canSkip:true,source:{type:'window'},options:[{id:'skip'},{id:'0'},{id:'1'}]}
  st.legalMoves=st.pendingChoice.options.map(option=>({action:'choose',choiceId:'r',optionId:option.id}))
  const s={sessionId:'preference-unit',state:st}
  assert.deepEqual(reactionChoices(st).map(item=>item.code),['01023','01065'])
  setReactionEnabled(s.sessionId,0,['01023'],false)
  assert.deepEqual(reactionView(s).state.legalMoves.map(m=>m.optionId),['skip','1'])
  assert.equal(st.legalMoves.length,3,'不修改权威选择')
  assert.ok(reactionEnabled('another-game',0,'01023'))
  assert.ok(reactionEnabled(s.sessionId,1,'01023'))
  setReactionEnabled(s.sessionId,0,['01023'],true)
  assert.equal(reactionView(s),s)
  st.pendingChoice={id:'cop',kind:'reaction',seat:0,source:'rolandClue',canSkip:true}
  st.legalMoves=[{action:'choose',choiceId:'cop',optionId:'trigger'}]
  assert.equal(reactionChoices(st)[0].code,'01001')
})

test('AI 只在自己的调查回合接受可选反应；自动跳过后仍可恢复强制选择',()=>{
  for(const phase of ['investigation','mythos','enemy','upkeep'])for(const currentSeat of [0,1]){
    const st={revision:0,currentSeat,phase,humanSeats:[0]}
    const execute=draft=>{
      draft.answer=requestChoice(draft,{kind:'reaction',source:'card',seat:1,canSkip:true,prompt:'反应？',options:[{id:'skip'},{id:'trigger'}]})
      draft.harm=requestChoice(draft,{kind:'assign-damage',source:'harm',seat:1,prompt:'分配伤害',options:[{id:'self'}]})
    }
    resolveTransaction(st,currentSeat,{action:'test'},execute)
    const own=phase==='investigation'&&currentSeat===1
    assert.equal(st.pendingChoice.kind,own?'reaction':'assign-damage')
    const restored=JSON.parse(JSON.stringify(st))
    if(own)resolveTransaction(restored,1,{optionId:'skip'},execute)
    resolveTransaction(restored,1,{optionId:'self'},execute)
    assert.equal(restored.answer,'skip');assert.equal(restored.harm,'self');assert.equal(restored.pendingChoice,null)
  }
})

test('人类跨回合反应和强制结算不被 AI 策略关闭',()=>{
  for(const kind of ['reaction','playerWindow','boost','assign-horror']){
    const st={revision:0,currentSeat:1,phase:'enemy',humanSeats:[0]}
    resolveTransaction(st,1,{action:'test'},draft=>requestChoice(draft,{kind,source:'card',seat:0,canSkip:true,prompt:'选择',options:[{id:'skip'},{id:'trigger'}]}))
    assert.equal(st.pendingChoice.kind,kind)
  }
})
