import { loadState, writeState, nativeExport, isAndroid } from './platform.js';
import { SOURCE, MAX_BACKUP_BYTES, MAX_PREVIEW_LENGTH, validate, cost, shopping, filterRecipes } from './core.js';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => `¥${n.toFixed(2)}`;
let state, search = '', base = '全部', busy = false, editingId = null, svgId = 0;
let lastFocus;
const main = $('#main');
const detail = $('#detail-dialog'), editor = $('#edit-dialog'), confirmDialog = $('#confirm-dialog');
function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),4200); }
function open(dialog) { lastFocus = document.activeElement; dialog.showModal(); }
function close(dialog) { dialog.close(); lastFocus?.focus?.(); }
for (const dialog of [detail,editor,confirmDialog]) {
  dialog.addEventListener('click',e=>{ if(e.target===dialog) {const r=dialog.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) { if(dialog===editor) return; close(dialog); }} });
}
function save(next) {
  if (busy) return Promise.reject(new Error('正在保存，请稍后再试'));
  busy=true; $('#connection').textContent='正在保存…';
  return writeState({...next,revision:state.revision}).then(body=>{state=body;return body;  }).finally(()=>{busy=false; $('#connection').textContent='本地文件 · 已连接';}).catch(error=>{ $('#connection').textContent='保存未完成'; throw error; });
}
function preview(r,large=false) {
  return r.previewImage ? `<img class="recipe-preview" src="${esc(r.previewImage)}" alt="${esc(r.name)}预览图" decoding="async">` : glass(r,large);
}
async function preparePreview(file) {
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('请选择 PNG、JPG 或 WebP 图片');
  if (file.size > 10 * 1024 * 1024) throw new Error('原图不能超过 10 MB');
  const image = new Image();
  const source = await new Promise((resolve,reject) => { const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error('图片读取失败')); reader.readAsDataURL(file); });
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('图片无法解码，请换一张图片'));image.src=source;});
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('图片尺寸无效');
  const scale = Math.min(1,1200 / Math.max(image.naturalWidth,image.naturalHeight));
  const canvas = document.createElement('canvas'); canvas.width=Math.max(1,Math.round(image.naturalWidth*scale)); canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  for (const quality of [.85,.65,.45]) { const result=canvas.toDataURL('image/webp',quality); if(result.length<=MAX_PREVIEW_LENGTH)return result; }
  throw new Error('图片压缩后仍太大，请裁剪后重试');
}
function glass(r,large=false) {
  const id='glass-'+(++svgId), c=esc(r.color), a=esc(r.accent), short=r.character==='柯莱塔';
  const top=short?95:44, bottom=220, left=short?23:38, right=short?137:122;
  let ornament='';
  if(r.character.includes('玄翎')) ornament='<path d="M70 71C28 54 14 24 12 13c32 8 48 20 58 58m18 0c42-17 56-47 58-58-32 8-48 20-58 58" fill="#a8d9df" fill-opacity=".6" stroke="#d9eeee" stroke-opacity=".5"/><path d="m13 14 53 53m79-53L92 67" stroke="#152f3f" stroke-width="4"/>';
  else if(r.character==='秧秧') ornament='<path d="M89 89C78 45 93 15 127 8c-1 43-18 65-38 81" fill="#d7ecea" fill-opacity=".7"/><path d="m92 84 31-70" stroke="#a4c8c4"/>';
  else if(r.character==='清宵') ornament='<path d="M108 14v82l-5 10-5-10V14z" fill="#c7e6f0" fill-opacity=".7"/><path d="M88 30h30m-15-18V5" stroke="#e4f3f8" stroke-width="3"/>';
  else if(r.character==='心') ornament='<path d="m37 52-7-37 28 22m44 0 28-22-7 37" fill="#e3e3df" stroke="#c7d9e2" stroke-width="2"/><path d="m41 43-5-20 15 15m58 0 15-15-5 20" fill="#ba8d9a"/><path d="M35 105q45 60 90 0" fill="none" stroke="#c6aa69" stroke-dasharray="2 2" stroke-width="2"/><path d="m80 131 9 11-9 14-9-14z" fill="#72bfe6" stroke="#d9c693"/>';
  else if(r.character==='爱弥斯') ornament='<path d="M93 65V29" stroke="#b8dce4"/><path d="M80 13h9V7h10v6h9v10h-9v9H89v-9h-9z" fill="#d4a3c7"/>';
  else if(r.character==='达妮娅'||short) ornament=`<path d="M${left-2} ${top+22}q${80-left+2} 35 ${right-left+4} 0" fill="none" stroke="#d6b96e" stroke-width="2" stroke-dasharray="2 2"/><path d="m80 ${top+38} 8 10-8 13-8-13z" fill="#69bde3" stroke="#dcbd70"/>`;
  else ornament='<path d="M112 6v39m-17-29 34 20m-34 0 34-20" stroke="#c9e5ee" stroke-width="2"/><path d="M110 39v27" stroke="#94b7c6"/>';
  return `<svg class="drink-svg${large?' large':''}" viewBox="0 0 160 260" role="img" aria-label="${esc(r.name)}杯型配色示意，非实拍"><defs><linearGradient id="${id}-liquid" x1="0" x2="0" y1="0" y2="1"><stop stop-color="${c}" stop-opacity=".25"/><stop offset=".48" stop-color="${c}" stop-opacity=".56"/><stop offset="1" stop-color="${a}" stop-opacity=".88"/></linearGradient><linearGradient id="${id}-glass"><stop stop-color="#e7f7ff" stop-opacity=".22"/><stop offset=".2" stop-color="#b5dde9" stop-opacity=".03"/><stop offset=".75" stop-color="#b5dde9" stop-opacity=".04"/><stop offset="1" stop-color="#e7f7ff" stop-opacity=".28"/></linearGradient></defs><ellipse cx="80" cy="237" rx="47" ry="6" fill="#000" opacity=".25"/><path d="M${left} ${top}h${right-left}l-5 ${bottom-top}q-35 8-${right-left-10} 0z" fill="url(#${id}-glass)" stroke="#bdd7e8" stroke-opacity=".5"/><path d="M${left+4} ${top+33}h${right-left-8}l-4 ${bottom-top-39}q-32 7-${right-left-16} 0z" fill="url(#${id}-liquid)"/><ellipse cx="80" cy="${top+33}" rx="${(right-left-8)/2}" ry="3" fill="${c}" opacity=".35"/><g fill="#e2f5fa" fill-opacity=".16" stroke="#e2f4ff" stroke-opacity=".35"><path d="m49 88 26-5 7 31-27 6z"/><path d="m84 119 24-8 7 30-24 8z"/><path d="m49 148 27-4 4 30-26 5z"/><path d="m80 179 27-5 3 26-27 6z"/></g><path d="M${left+5} ${top+7}l4 ${bottom-top-16}" stroke="#e6f6ff" stroke-opacity=".4"/><path d="M${right-5} ${top+7}l-4 ${bottom-top-16}" stroke="#effaff" stroke-opacity=".2"/><ellipse cx="80" cy="${top}" rx="${(right-left)/2}" ry="4" fill="none" stroke="#c6e4f1" stroke-opacity=".6"/><g fill="#d5f2fa" fill-opacity=".5"><circle cx="88" cy="86" r="1.2"/><circle cx="69" cy="132" r="1"/><circle cx="94" cy="162" r="1.3"/><circle cx="61" cy="195" r="1"/></g>${ornament}</svg>`;
}
function render() {
  if(!state) return;
  const isShopping=location.hash==='#shopping';
  $('#nav-recipes').classList.toggle('active',!isShopping); $('#nav-shopping').classList.toggle('active',isShopping);
  $('#nav-count').textContent=String(state.recipes.length).padStart(2,'0');
  $('#breadcrumb').textContent=isShopping?'采购与预算':'角色调酒档案';
  if(isShopping) renderShopping(); else renderRecipes();
}
function renderRecipes() {
  const bases=[...new Set(state.recipes.map(r=>r.base))];
  if(!bases.includes(base)) base='全部';
  main.innerHTML=`<section class="hero"><div><div class="eyebrow">WUTHERING WAVES · COCKTAIL ARCHIVE</div><h1>将共鸣，<br><em>调入杯中。</em></h1><p>一杯一位共鸣者，一抹属于角色的颜色。<br>用少量原料，把喜爱的灵感带进你的调酒日常。</p><div class="hero-foot"><span>低甜度配方</span><span>居家轻松复刻</span><span>灵感自由编辑</span></div></div><div class="hero-art">${state.recipes.slice(0,3).map(r=>glass(r)).join('')}<span class="art-caption">COLOR STUDIES / 原创杯型示意</span></div></section>
  <div class="stats"><div class="stat"><strong>${String(state.recipes.length).padStart(2,'0')}</strong><span>角色特调</span><small>每一杯都各有共鸣</small></div><div class="stat"><strong>${String(bases.length).padStart(2,'0')}</strong><span>共用基酒</span><small>少量原料，更多灵感</small></div><div class="stat"><strong>3–8</strong><span>ml 糖浆 / 多数原方</span><small>茶与苏打，让甜度轻一点</small></div></div>
  <section aria-labelledby="collection-title"><div class="section-head"><div><h2 id="collection-title">共鸣者酒单 <small>THE COLLECTION</small></h2><p>找到今天想调的一杯</p></div><button class="text-button" id="new-inline">＋ 添加你的灵感</button></div>
  <div class="toolbar"><div class="filters" role="group" aria-label="按基酒筛选">${['全部',...bases].map(b=>`<button class="filter ${base===b?'active':''}" data-base="${esc(b)}" aria-pressed="${base===b}">${esc(b==='全部'?'全部酒款':b)}</button>`).join('')}</div><label class="search-box"><span aria-hidden="true">⌕</span><input type="search" id="search" placeholder="搜索角色、酒名或原料…" aria-label="搜索角色、酒名或原料" value="${esc(search)}"></label></div><div id="result-info" class="tiny-note" aria-live="polite"></div><div class="recipe-grid" id="recipe-grid"></div></section>
  <aside class="source-note"><strong>灵感档案，不是官方设定。</strong> 酒名、配色与杯饰沿用<a href="${SOURCE}" target="_blank" rel="noreferrer">原对话的八款居家方案 ↗</a>，角色资料尚未独立核实。杯中配方与角色视觉灵感在详情中分开展示；插画为配色示意，实际颜色会因茶与酸度而变化。所有价格均为人民币估算值。</aside>`;
  $('#new-inline').onclick=()=>edit();
  $('#search').oninput=e=>{search=e.target.value;renderCards();};
  main.querySelectorAll('[data-base]').forEach(b=>b.onclick=()=>{base=b.dataset.base;main.querySelectorAll('[data-base]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});renderCards();});
  renderCards();
}
function renderCards() {
  const results=filterRecipes(state.recipes,search,base);
  $('#result-info').textContent=search||base!=='全部'?`找到 ${results.length} 款配方，共 ${state.recipes.length} 款`:'';
  $('#recipe-grid').innerHTML=results.length?results.map(r=>{
    const c=cost(r,state.prices), idx=state.recipes.indexOf(r);
    return `<article class="recipe-card"><div class="card-art" style="--drink:${r.color}"><span class="art-num">NO. ${String(idx+1).padStart(2,'0')}</span><span class="art-tag">${esc(r.base)}</span>${preview(r)}<span class="art-lines">RESONANCE / ${String(idx+1).padStart(2,'0')}</span><button class="card-open" data-open="${esc(r.id)}" aria-label="查看${esc(r.character)}：${esc(r.name)}配方"></button></div><div class="card-body"><div class="card-kicker"><span>${esc(r.character)}</span><span>${esc(r.sweetness.split('·')[0])}</span></div><h3 class="card-title">${esc(r.name)}</h3><p class="card-description">${esc(r.palette)} · ${esc(r.glass)}</p><div class="card-bottom"><span><b>${money(c.total)}</b> ${c.missing.length?'起 · 估算':'/ 杯 · 估算'}</span><button data-open="${esc(r.id)}" aria-label="打开${esc(r.name)}详情">查看配方 <span aria-hidden="true">↗</span></button></div></div></article>`;
  }).join(''):`<div class="empty"><p>${state.recipes.length?'没有找到这杯酒。试试角色名、伏特加或苏打水。':'酒单还是空的，添加你的第一杯共鸣。'}</p><button class="button secondary" id="empty-action">${state.recipes.length?'清除筛选':'新增配方'}</button></div>`;
  $('#recipe-grid').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>showDetail(b.dataset.open));
  if($('#empty-action')) $('#empty-action').onclick=()=>{if(!state.recipes.length) edit();else{search='';base='全部';renderRecipes();}};
}
function showDetail(id) {
  const r=state.recipes.find(r=>r.id===id); if(!r) return;
  const c=cost(r,state.prices), vol=r.ingredients.reduce((n,i)=>n+i.ml,0);
  detail.innerHTML=`<div class="modal-bar"><span>RECIPE FILE / ${esc(r.character)}</span><button class="icon-button" data-close aria-label="关闭详情">×</button></div><div class="detail-content"><div class="detail-top"><div class="card-art detail-art" style="--drink:${r.color}">${preview(r,true)}</div><div class="detail-heading"><div class="detail-character">${esc(r.character)} · 角色主题特调</div><h1>${esc(r.name)}</h1><div class="detail-tags"><span class="pill">${esc(r.base)}</span><span class="pill">${esc(r.sweetness)}</span><span class="pill">单杯 ${vol} ml＋冰</span></div><p>${esc(r.taste)}</p><p>建议杯型：${esc(r.glass)}<br>材料消耗估算：<strong>${money(c.total)} / 杯</strong>${c.missing.length?`<br><span class="error">未计价：${esc(c.missing.join('、'))}</span>`:''}</p><div class="detail-actions"><button class="button" id="edit-current">编辑配方</button><button class="button secondary" id="copy-current">复制配方</button></div></div></div><div class="recipe-columns"><div><section class="detail-section"><h2>01 / 材料与用量</h2>${r.ingredients.map(i=>`<div class="ingredient"><span>${esc(i.name)}${i.note?`<small>${esc(i.note)}</small>`:''}</span><b>${i.ml} ml</b></div>`).join('')}<div class="ingredient"><span>冰块</span><b>适量</b></div><p class="tiny-note">毫升为未融冰的液体量；可选糖浆默认 0 ml。成本不含杯具、冰块、杯饰及可选闪粉。</p></section><section class="detail-section"><h2>03 / 装饰说明</h2><p>${esc(r.garnish)}</p><p>纸、金属链、胶片及吊坠只固定在杯外，避免接触酒液与杯口。</p></section></div><div><section class="detail-section"><h2>02 / 制作步骤</h2><ol class="steps">${r.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></section><section class="detail-section"><h2>04 / 制作笔记</h2><p>${esc(r.notes)}</p></section></div></div><aside class="visual-inspiration"><h2>角色视觉灵感 / 与酒液配方分开记录</h2><p>配色关键词：${esc(r.palette)}</p><p>${esc(r.inspiration)}</p><p>资料核实说明：${esc(r.verification)}</p></aside></div><div class="modal-foot"><p>同人创作 · 含酒精原方，请量取基酒用量</p><button class="text-button" id="delete-current">删除这款方案</button></div>`;
  detail.querySelector('[data-close]').onclick=()=>close(detail);
  $('#edit-current').onclick=()=>{close(detail);edit(r.id);};
  $('#copy-current').onclick=()=>copyRecipe(r.id);
  $('#delete-current').onclick=()=>deleteRecipe(r.id);
  if(!detail.open) open(detail);
}
async function copyRecipe(id) {
  const recipe=structuredClone(state.recipes.find(r=>r.id===id)); if(!recipe)return;
  recipe.id=crypto.randomUUID();recipe.name+=' · 副本';recipe.servings=0;
  try {await save({...state,recipes:[...state.recipes,recipe]});render();toast('配方已复制，采购杯数默认为 0');close(detail);showDetail(recipe.id);}catch(e){toast(e.message);}
}
function ask(title,message,action,{label='确认',danger=false,extra=''}={}) {
  confirmDialog.innerHTML=`<h2>${esc(title)}</h2><p>${esc(message)}</p>${extra}<div class="form-error" role="alert"></div><div class="confirm-actions"><button class="button secondary" id="cancel-confirm">取消</button><button class="button ${danger?'danger':''}" id="accept-confirm">${esc(label)}</button></div>`;
  $('#cancel-confirm').onclick=()=>close(confirmDialog);
  $('#accept-confirm').onclick=async e=>{e.target.disabled=true;try{await action();close(confirmDialog);}catch(err){confirmDialog.querySelector('.form-error').textContent=err.message;}finally{e.target.disabled=false;}};
  open(confirmDialog);
}
function deleteRecipe(id) {
  const r=state.recipes.find(r=>r.id===id);
  ask(`删除「${r.name}」？`,'这款方案将从酒单与采购计划中移除。保存前的资料会自动备份到 data/backups 文件夹。',async()=>{await save({...state,recipes:state.recipes.filter(r=>r.id!==id)});if(detail.open)close(detail);render();toast('方案已删除，旧版已自动备份');},{label:'删除方案',danger:true});
}
function newRecipe() {
  return {id:crypto.randomUUID(),character:'',name:'',base:'伏特加',glass:'透明高球杯',palette:'',color:'#89c8dc',accent:'#c889a9',inspiration:'',verification:'原创视觉方案；角色资料尚未核实，不代表官方设定。',garnish:'',taste:'',sweetness:'低甜',notes:'冰块适量。装饰固定在杯外。',ingredients:[{name:'伏特加',ml:30,note:''},{name:'无糖苏打水',ml:120,note:''}],steps:['加入适量冰块。'],servings:0};
}
function field(label,name,value,opts={}) { const tag=opts.textarea?'textarea':'input';return `<label class="${opts.wide?'wide':''}">${esc(label)}${tag==='textarea'?`<textarea name="${name}" rows="${opts.rows||3}" maxlength="8000" ${opts.required?'required':''}>${esc(value)}</textarea>`:`<input name="${name}" value="${esc(value)}" type="${opts.type||'text'}" maxlength="${opts.type==='color'?7:8000}" ${opts.required?'required':''}>`}</label>`; }
function ingredientRow(i) {return `<div class="ingredient-row"><label>材料名称<input class="ing-name" required maxlength="100" value="${esc(i.name)}" list="material-options" placeholder="如：伏特加"></label><label>用量 ml<input class="ing-ml" type="number" min="0" max="5000" step="0.1" required value="${i.ml}"></label><label>用量备注<input class="ing-note" maxlength="8000" value="${esc(i.note)}" placeholder="如：0–3 ml，可选"></label><button type="button" class="remove" aria-label="移除这项材料">×</button></div>`;}
function edit(id) {
  editingId=id||null;const r=structuredClone(id?state.recipes.find(r=>r.id===id):newRecipe());
  editor.innerHTML=`<form id="recipe-form"><div class="modal-bar"><span>EDIT RECIPE / 配方编辑</span><button type="button" class="icon-button" id="cancel-edit" aria-label="取消编辑">×</button></div><div class="edit-content"><h2>${id?'让这杯酒，更像你的灵感。':'记录一杯新的共鸣。'}</h2><p class="tiny-note">保存后直接写入本地文件，所有字段均可修改。带 * 的项目必填。</p><div class="form-grid">${field('角色名称 *','character',r.character,{required:true})}${field('酒名 *','name',r.name,{required:true})}${field('基酒分类 *','base',r.base,{required:true})}${field('建议杯型','glass',r.glass)}${field('配色关键词','palette',r.palette)}${field('甜度描述','sweetness',r.sweetness)}${field('主体示意色','color',r.color,{type:'color'})}${field('渐变示意色','accent',r.accent,{type:'color'})}${field('口感描述（未实测请注明）','taste',r.taste,{wide:true})}</div><h3 class="field-heading">01 / 实际酒液材料</h3><p class="tiny-note">统一使用 ml。可选材料可填写 0 ml，在备注中保留范围；冰块另列为适量。新材料保存后请在采购页补充价格。</p><datalist id="material-options">${state.prices.map(p=>`<option value="${esc(p.name)}"></option>`).join('')}</datalist><div id="ingredient-rows">${r.ingredients.map(ingredientRow).join('')}</div><button type="button" class="text-button" id="add-ingredient">＋ 增加材料</button><div class="form-grid">${field('制作步骤 *（每行一步）','steps',r.steps.join('\n'),{textarea:true,required:true,wide:true,rows:7})}${field('装饰说明','garnish',r.garnish,{textarea:true,wide:true})}${field('制作笔记 / 色彩变化 / 可选材料','notes',r.notes,{textarea:true,wide:true})}</div><h3 class="field-heading">02 / 角色视觉资料（与配方分开）</h3><div class="form-grid">${field('视觉灵感与资料来源','inspiration',r.inspiration,{textarea:true,wide:true})}${field('资料核实状态 / 未核实处','verification',r.verification,{textarea:true,wide:true})}</div><div class="form-error" id="edit-error" role="alert"></div></div><div class="modal-foot"><p>本地保存 · 自动保留修改前备份</p><div class="detail-actions"><button type="button" class="button secondary" id="cancel-edit-bottom">取消</button><button class="button" id="save-recipe">保存配方</button></div></div></form>`;
  let pendingImage=r.previewImage || '', processingImage=false;
  editor.querySelector('.form-grid').insertAdjacentHTML('beforebegin',`<section class="preview-editor" aria-labelledby="preview-heading"><h3 id="preview-heading" class="field-heading">配方预览图片</h3><div class="preview-editor-content"><div id="image-preview" class="image-preview"></div><div class="preview-controls"><button type="button" class="button secondary" id="upload-preview">上传 / 替换图片</button><input id="preview-file" type="file" accept="image/png,image/jpeg,image/webp" hidden><button type="button" class="text-button" id="remove-preview">移除图片，恢复杯型插画</button><p class="tiny-note">支持 PNG、JPG、WebP，原图最大 10 MB。自动缩小与压缩，图片保存在本地并随 JSON 备份；点击“保存配方”后生效。</p><p id="image-error" class="form-error" role="alert"></p></div></div></section>`);
  const refreshImage=()=>{ $('#image-preview').innerHTML=preview({...r,previewImage:pendingImage},true); $('#remove-preview').disabled=!pendingImage; };
  refreshImage();
  $('#upload-preview').onclick=()=>$('#preview-file').click();
  const imageForm=$('#recipe-form');
  $('#preview-file').onchange=async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;
    processingImage=true;$('#upload-preview').disabled=true;$('#preview-file').disabled=true;$('#save-recipe').disabled=true;$('#remove-preview').disabled=true;$('#image-error').textContent='正在处理图片…';
    try { const prepared=await preparePreview(file);if(!imageForm.isConnected)return;pendingImage=prepared;$('#image-error').textContent='已准备好预览，保存配方后生效。';refreshImage(); }
    catch(error){if(imageForm.isConnected)$('#image-error').textContent=error.message;}
    finally{processingImage=false;if(imageForm.isConnected){$('#upload-preview').disabled=false;$('#preview-file').disabled=false;$('#save-recipe').disabled=false;$('#remove-preview').disabled=!pendingImage;}}
  };
  $('#remove-preview').onclick=()=>{pendingImage='';$('#image-error').textContent='保存后将恢复默认杯型插画。';refreshImage();};
  const cancel=()=>{close(editor);};
  $('#cancel-edit').onclick=cancel;$('#cancel-edit-bottom').onclick=cancel;
  $('#add-ingredient').onclick=()=>{$('#ingredient-rows').insertAdjacentHTML('beforeend',ingredientRow({name:'',ml:0,note:''}));};
  $('#ingredient-rows').onclick=e=>{if(e.target.closest('.remove'))e.target.closest('.ingredient-row').remove();};
  $('#recipe-form').onsubmit=async e=>{
    e.preventDefault();if(processingImage)return;const button=$('#save-recipe');button.disabled=true;
    try {
      const data=new FormData(e.target);const updated={...r,previewImage:pendingImage};
      for(const key of ['character','name','base','glass','palette','sweetness','color','accent','taste','garnish','notes','inspiration','verification'])updated[key]=String(data.get(key)).trim();
      updated.steps=String(data.get('steps')).split('\n').map(s=>s.trim()).filter(Boolean);
      updated.ingredients=[...$('#ingredient-rows').children].map(row=>({name:row.querySelector('.ing-name').value.trim(),ml:Number(row.querySelector('.ing-ml').value),note:row.querySelector('.ing-note').value.trim()}));
      const next={...state,recipes:editingId?state.recipes.map(x=>x.id===editingId?updated:x):[...state.recipes,updated]};
      validate(next);await save(next);close(editor);render();showDetail(updated.id);toast('已保存到本地文件，刷新后仍可读取');
    }catch(error){$('#edit-error').textContent=error.message;$('#edit-error').scrollIntoView({block:'nearest'});}finally{button.disabled=false;}
  };
  open(editor);
}
function renderShopping() {
  const rows=shopping(state), cups=state.recipes.reduce((n,r)=>n+r.servings,0), consumed=rows.reduce((n,r)=>n+(r.consumed||0),0), purchase=rows.reduce((n,r)=>n+(r.purchase||0),0), missing=rows.filter(r=>r.packs===null);
  main.innerHTML=`<div class="page-intro"><div class="eyebrow">SHOPPING LIST / HOME BAR</div><h1>为下一场共鸣，备好原料。</h1><p>按制作杯数自动汇总。共用材料只采购一次，预算不再靠猜。</p></div><div class="budget-summary"><div class="budget-box"><span>液体消耗成本 · 估算${missing.length?' / 未完整':''}</span><strong>${money(consumed)}</strong><small>按实际毫升数折算，非首次采购额</small></div><div class="budget-box"><span>包装采购预算 · 估算${missing.length?' / 未完整':''}</span><strong>${money(purchase)}</strong><small>从零采购，按包装向上取整</small></div><div class="budget-box"><span>本次计划</span><strong>${cups} <small>杯</small></strong><small>${rows.length} 种液体材料</small></div></div><section class="panel"><div class="section-head"><h2>01 / 选择本次制作杯数</h2><button class="text-button" id="all-one">全部各一杯</button></div><div class="servings-grid">${state.recipes.map(r=>`<label class="serving"><span>${esc(r.character)}<small>${esc(r.name)}</small></span><input type="number" min="0" max="100" step="1" value="${r.servings}" data-servings="${esc(r.id)}" aria-label="${esc(r.character)}制作杯数"></label>`).join('')}</div><p class="tiny-note">0 表示本次不制作。杯数更改后自动保存；新增与复制的配方默认为 0 杯。</p></section><section class="panel"><div class="section-head"><h2>02 / 材料采购清单</h2><button class="text-button" id="copy-shopping">复制清单</button></div>${missing.length?`<p class="error tiny-note">${esc(missing.map(r=>r.name).join('、'))} 尚未定价；上方预算仅包含已定价材料。请在下方价格表补充。</p>`:''}<div class="table-wrap"><table><thead><tr><th>材料</th><th>总用量</th><th>包装 / 参考价</th><th>采购数</th><th>消耗估算</th><th>采购估算</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${esc(r.name)}<small>${esc(r.note)}</small></td><td>${Number(r.ml.toFixed(1))} ml</td><td>${r.packs===null?'待定价':`${r.packMl} ml / ${money(r.price)}`}</td><td>${r.packs===null?'—':`${r.packs} 份`}</td><td>${r.consumed===null?'待定价':money(r.consumed)}</td><td>${r.purchase===null?'待定价':money(r.purchase)}</td></tr>`).join(''):'<tr><td colspan="6">还没有计划制作的配方，请在上方选择杯数。</td></tr>'}</tbody><tfoot><tr><td colspan="4">合计${missing.length?'（已定价部分）':''}</td><td>${money(consumed)}</td><td>${money(purchase)}</td></tr></tfoot></table></div><p class="tiny-note">冰块适量。纸质杯签、链条、吊坠、玻璃杯及可选闪粉不在上表计价，请按需要另留预算。</p></section><section class="panel"><h2>03 / 调整你的参考价格</h2><p class="tiny-note">金额单位：人民币。填写“可用液体量 / 等效份量”，系统按该份量折算，不是实时商家报价。</p><form id="price-form"><div class="table-wrap"><table><thead><tr><th>材料</th><th>可用容量 ml</th><th>每份价格 ¥</th><th>规格说明</th></tr></thead><tbody>${[...state.prices,...rows.filter(r=>!state.prices.some(p=>p.name===r.name)).map(r=>({name:r.name,packMl:250,price:0,note:'新材料，请填写价格'}))].map((p,i)=>`<tr data-price-name="${esc(p.name)}"><td>${esc(p.name)}</td><td><input class="price-input pack-ml" type="number" min="0.1" max="1000000" step="0.1" required value="${p.packMl}" aria-label="${esc(p.name)}可用容量毫升"></td><td><input class="price-input pack-price" type="number" min="0" max="100000" step="0.01" required value="${p.price}" aria-label="${esc(p.name)}每份价格"></td><td><small>${esc(p.note)}</small><input class="pack-note" type="hidden" value="${esc(p.note)}"></td></tr>`).join('')}</tbody></table></div><div class="section-head" style="margin-top:18px;margin-bottom:0"><p id="price-error" class="form-error" role="alert"></p><button class="button" id="save-prices">保存参考价</button></div></form></section><aside class="source-note budget-explanation"><b>预算口径</b> · 茶液按冲泡后的等效液体量计算；柠檬按可用汁量估算。整包干花、鲜果与工具的实际收银金额会不同，已有库存也未扣除。原企划首次完整采购参考为 ¥173–321，包含部分装饰与可重复使用材料，和这里的液体采购口径不同。<br><b>原文汇总已纠正</b> · 按预置原方各一杯，伏特加 105 ml、金酒 100 ml、白朗姆 65 ml、苏打水 940 ml、乌龙茶 190 ml；其余材料随明细实时相加。清宵与秧秧的可选糖浆默认 0 ml，绯雪石榴糖浆默认取原范围下限 3 ml。</aside>`;
  main.querySelectorAll('[data-servings]').forEach(input=>input.onchange=async()=>{
    const value=Number(input.value);if(!Number.isInteger(value)||value<0||value>100){toast('杯数需要为 0–100 的整数');renderShopping();return;}
    input.disabled=true;try{await save({...state,recipes:state.recipes.map(r=>r.id===input.dataset.servings?{...r,servings:value}:r)});renderShopping();toast('制作计划已保存');}catch(e){toast(e.message);renderShopping();}
  });
  $('#all-one').onclick=async()=>{try{await save({...state,recipes:state.recipes.map(r=>({...r,servings:1}))});renderShopping();toast('已设置为每款一杯');}catch(e){toast(e.message);}};
  $('#copy-shopping').onclick=async()=>{const text=`共鸣调酒室 · ${cups} 杯采购清单\n`+rows.map(r=>`${r.name}：${r.ml} ml；${r.packs===null?'价格待补充':`采购 ${r.packs} × ${r.packMl} ml，估算 ${money(r.purchase)}`}`).join('\n')+`\n液体消耗估算 ${money(consumed)}，包装采购估算 ${money(purchase)}${missing.length?'（未完整）':''}。不含冰块、杯具和装饰。`;try{await navigator.clipboard.writeText(text);toast('采购清单已复制');}catch{download('采购清单.txt',text,'text/plain');toast('剪贴板不可用，已下载清单');}};
  $('#price-form').onsubmit=async e=>{e.preventDefault();$('#save-prices').disabled=true;try{const prices=[...e.target.querySelectorAll('[data-price-name]')].map(row=>({name:row.dataset.priceName,packMl:Number(row.querySelector('.pack-ml').value),price:Number(row.querySelector('.pack-price').value),note:row.querySelector('.pack-note').value}));await save({...state,prices});renderShopping();toast('参考价已保存，预算已更新');}catch(error){$('#price-error').textContent=error.message;$('#save-prices').disabled=false;}};
}
function download(name,text,type='application/json') {if(nativeExport(name,text,type))return;const url=URL.createObjectURL(new Blob([text],{type:`${type};charset=utf-8`}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#export').onclick=()=>{if(!state)return;download(`共鸣调酒室-备份-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2));toast(isAndroid?'请选择备份保存位置':'已导出配方、制作计划和参考价');};
$('#import').onclick=()=>{if(state)$('#import-file').click();};
$('#import-file').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try{
    if(file.size>MAX_BACKUP_BYTES)throw new Error('包含图片的完整备份不能超过 25 MB');const imported=validate(JSON.parse(await file.text()));
    ask('导入 JSON 备份',`已校验 ${imported.recipes.length} 款配方和 ${imported.prices.length} 项参考价。合并时同 ID 的配方会更新，其他配方保留；替换会使用备份中的完整资料。操作前自动备份当前文件。`,async()=>{
      const mode=$('#import-mode').value;
      const next=mode==='replace'?imported:{...state,recipes:[...new Map([...state.recipes,...imported.recipes].map(r=>[r.id,r])).values()],prices:[...new Map([...state.prices,...imported.prices].map(p=>[p.name,p])).values()]};
      validate(next);await save(next);if(detail.open)close(detail);if(editor.open)close(editor);render();toast('备份已导入并保存到本地');
    },{label:'导入并保存',extra:'<label for="import-mode">导入方式</label><select id="import-mode"><option value="merge">合并更新（保留其他配方）</option><option value="replace">替换全部配方与参考价</option></select>'});
  }catch(error){toast('无法导入：'+error.message);}
};
$('#new-top').onclick=()=>{if(state)edit();};
window.addEventListener('hashchange',render);
async function init(){try{state=await loadState();$('#connection').textContent='本地文件 · 已连接';render();}catch(e){main.innerHTML=`<div class="loading error">无法打开资料：${esc(e.message)}<br><button class="button secondary" id="retry">重新连接</button></div>`;$('#connection').textContent='连接失败';$('#retry').onclick=init;}}
init();
