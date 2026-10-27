export const SOURCE = 'https://chatgpt.com/share/6addf745-0a30-83e8-8647-bda5312f465c';
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
export const MAX_PREVIEW_LENGTH = 700000;
export function validate(state) {
  const fail = m => { throw new Error(m); };
  const str = (v, name, required = false, max = 8000) => {
    if (typeof v !== 'string' || v.length > max || (required && !v.trim())) fail(`${name}必须为${required ? '非空' : ''}文本，最长 ${max} 字`);
  };
  const num = (v, name, max = 100000) => { if (!Number.isFinite(v) || v < 0 || v > max) fail(`${name}必须在 0–${max} 之间`); };
  if (!state || state.schemaVersion !== 1 || !Array.isArray(state.recipes) || state.recipes.length > 200) fail('不支持的备份格式（需要 schemaVersion: 1，最多 200 款配方）');
  const ids = new Set();
  for (const r of state.recipes) {
    if (!r || typeof r !== 'object') fail('配方格式错误');
    for (const k of ['id','character','name','base','glass','palette','inspiration','verification','garnish','taste','sweetness','notes']) str(r[k],k,['id','character','name','base'].includes(k));
    if (ids.has(r.id)) fail('配方 ID 重复'); ids.add(r.id);
    if (r.previewImage !== undefined && r.previewImage !== '') {
      if (typeof r.previewImage !== 'string' || r.previewImage.length > MAX_PREVIEW_LENGTH || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(r.previewImage)) fail('预览图需要为本地 PNG、JPEG 或 WebP 图片，保存大小不能超过约 500 KB');
    }
    if (!/^#[0-9a-f]{6}$/i.test(r.color) || !/^#[0-9a-f]{6}$/i.test(r.accent)) fail('配色需要六位十六进制色值');
    num(r.servings,'制作杯数',100);
    if (!Number.isInteger(r.servings)) fail('制作杯数必须为整数');
    if (!Array.isArray(r.ingredients) || r.ingredients.length < 1 || r.ingredients.length > 40) fail('每款需要 1–40 项材料');
    for (const i of r.ingredients) { str(i.name,'材料名称',true,100); num(i.ml,'毫升用量',5000); str(i.note,'用量备注'); }
    if (!Array.isArray(r.steps) || !r.steps.length || r.steps.length > 100) fail('每款需要 1–100 个制作步骤');
    r.steps.forEach(s => str(s,'制作步骤',true));
  }
  if (!Array.isArray(state.prices) || state.prices.length > 300) fail('价格表格式错误');
  const names = new Set();
  for (const p of state.prices) {
    str(p.name,'价格材料名称',true,100); str(p.note,'价格备注'); num(p.packMl,'包装容量',1000000); num(p.price,'包装价格');
    if (!p.packMl) fail('包装容量需要大于 0');
    if (names.has(p.name)) fail('价格材料名称重复'); names.add(p.name);
  }
  return state;
}
export function cost(recipe, prices) {
  let total = 0; const missing = [];
  for (const i of recipe.ingredients) {
    const p = prices.find(p => p.name === i.name);
    if (p) total += i.ml * p.price / p.packMl;
    else if (i.ml > 0) missing.push(i.name);
  }
  return { total, missing };
}
export function shopping(state) {
  const amounts = new Map();
  for (const r of state.recipes) for (const i of r.ingredients) if (i.ml && r.servings) amounts.set(i.name,(amounts.get(i.name) || 0) + i.ml * r.servings);
  return [...amounts].map(([name, ml]) => {
    const p = state.prices.find(p => p.name === name);
    return { name, ml, packMl: p?.packMl ?? 0, price: p?.price ?? 0, note: p?.note ?? '尚未定价，请补充包装容量和参考价', packs: p ? Math.ceil(ml / p.packMl) : null, consumed: p ? ml * p.price / p.packMl : null, purchase: p ? Math.ceil(ml / p.packMl) * p.price : null };
  });
}
export function filterRecipes(recipes, query, base) {
  const q = query.trim().toLocaleLowerCase();
  return recipes.filter(r => (base === '全部' || r.base === base) && [r.character,r.name,r.palette,r.inspiration,r.taste,...r.ingredients.map(i=>i.name)].join(' ').toLocaleLowerCase().includes(q));
}
