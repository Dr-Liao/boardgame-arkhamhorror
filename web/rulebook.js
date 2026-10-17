import { RULE_INDEX, RULE_SOURCES, ruleById } from './rulebook-data.js'
import { tableIcon } from './table-components.js'
export function createRulebook(h,render) {
  let opened=false, selected='round', query='', history=[], returnFocus=null, returnRuleId=null
  let cachedNode=null,cachedKey='',cachedQuery=''
  let directoryScroll={top:0,left:0}
  const rememberDirectory=()=>{const nav=cachedNode?.querySelector('nav');if(nav?.isConnected)directoryScroll={top:nav.scrollTop,left:nav.scrollLeft}}
  const restoreDirectory=(node,scroll)=>queueMicrotask(()=>{const nav=node?.querySelector('nav');if(nav?.isConnected){nav.scrollTop=scroll.top;nav.scrollLeft=scroll.left}})
  const show = id => { if(!opened){returnFocus=document.activeElement;returnRuleId=returnFocus?.dataset?.ruleId||null;directoryScroll={top:0,left:0}}else rememberDirectory(); opened=true; selected=ruleById(id).id;query='';render();queueMicrotask(()=>document.querySelector('.ah-rulebook-close')?.focus()) }
  window.addEventListener('arkham-open-rule',event=>{if(opened)history.push(selected);show(event.detail)})
  window.addEventListener('keydown',event=>{if(event.key==='F1' && document.querySelector('.ah-rulebook-launcher')){event.preventDefault();show('round')}})
  const close=()=>{opened=false;history=[];render();queueMicrotask(()=>{
    const restored=returnFocus?.isConnected ? returnFocus
      : returnRuleId ? [...document.querySelectorAll('.ah-carddetail-modal [data-rule-id]')].find(node=>node.dataset.ruleId===returnRuleId) : null
    ;(restored||document.querySelector('.ah-carddetail-modal button,.ah-db-modal input,.ah-header-rulebook,.ah-rulebook-launcher'))?.focus({preventScroll:true})
  })}
  const select=id=>{rememberDirectory();history.push(selected);selected=id;render();queueMicrotask(()=>document.querySelector('.ah-rulebook-article')?.focus({preventScroll:true}))}
  return {open:show,render(active){
    if(!active){opened=false;cachedNode=null;cachedKey='';return null}
    const key=JSON.stringify([opened,selected,query,history])
    if(cachedNode && cachedKey===key){
      const focused=cachedNode.contains(document.activeElement)?document.activeElement:null
      if(focused)queueMicrotask(()=>focused.isConnected&&focused.focus({preventScroll:true}))
      restoreDirectory(cachedNode,{...directoryScroll})
      return cachedNode
    }
    if(cachedQuery!==query)directoryScroll={top:0,left:0}
    const scroll={...directoryScroll}
    cachedKey=key;cachedQuery=query
    const matches=RULE_INDEX.filter(r=>`${r.title} ${r.aliases.join(' ')} ${r.body.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
    const groups=new Map()
    for(const rule of matches){if(!groups.has(rule.initial))groups.set(rule.initial,[]);groups.get(rule.initial).push(rule)}
    const current=ruleById(selected)
    cachedNode=h('div',{className:'ah-rulebook-layer'},
      h('button',{className:'ah-rulebook-launcher',title:'规则书 · F1',onclick:()=>show(selected)},tableIcon('book'),'规则书'),
      opened ? h('div',{className:'ah-rulebook-backdrop'},h('section',{className:'ah-rulebook',role:'dialog','aria-modal':'true','aria-label':'游戏规则书',onclick:e=>e.stopPropagation(),onkeydown:e=>{
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}
        if(e.key==='Tab'){const controls=[...e.currentTarget.querySelectorAll('button:not(:disabled),input,a')].filter(n=>n.getClientRects().length),i=controls.indexOf(document.activeElement);if(i<0 || (e.shiftKey?i===0:i===controls.length-1)){e.preventDefault();controls[e.shiftKey?controls.length-1:0]?.focus()}}
      }},
      h('header',{},h('div',{},h('small',{},'调查员手册 / ARKHAM'),h('h2',{},'游戏规则书')),h('button',{className:'ah-rulebook-close',onclick:close},'关闭规则书')),
      h('div',{className:'ah-rulebook-layout'},
        h('aside',{},h('input',{type:'search',value:query,'aria-label':'搜索规则',placeholder:'搜索关键字或英文名称…',oninput:e=>{const cursor=e.target.selectionStart;query=e.target.value;render();queueMicrotask(()=>{const input=document.querySelector('.ah-rulebook input');input?.focus();input?.setSelectionRange(cursor,cursor)})}}),
          h('small',{className:'ah-rule-index-label'},'拼音索引 · A–Z'),
          h('nav',{'aria-label':'规则目录',onscroll:rememberDirectory},matches.length?[...groups].map(([initial,rules])=>h('section',{className:'ah-rule-index-group','data-rule-initial':initial,'aria-label':initial+' 组'},
            h('h3',{},initial),rules.map(r=>h('button',{'data-rule-id':r.id,'aria-current':r.id===selected?'page':null,onclick:()=>select(r.id)},h('small',{},r.group),r.title)))):h('p',{role:'status'},'没有找到规则，试试“交战”或“投入”。'))),
        h('article',{className:'ah-rulebook-article',tabindex:-1,'data-rule-topic':selected},
          h('button',{className:'ah-rulebook-back',disabled:!history.length,onclick:()=>{rememberDirectory();selected=history.pop();render()}},'← 返回上一条'),
          h('small',{},current.group),h('h1',{},current.title),current.body.map(p=>h('p',{},p)),
          h('div',{className:'ah-rulebook-related'},h('h3',{},'相关规则'),current.related.map(id=>h('button',{onclick:()=>select(id)},ruleById(id).title))),
          h('footer',{},h('p',{},'本页为当前游戏的操作与机制指南。原版完整规则、时机表和勘误可从下方查阅；本局可执行动作以桌面提示为准。'),RULE_SOURCES.map(([label,url])=>h('a',{href:url,target:'_blank',rel:'noopener noreferrer'},label+' ↗'))))))) : null)
    restoreDirectory(cachedNode,scroll)
    return cachedNode
  }}
}
