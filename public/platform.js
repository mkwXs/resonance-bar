import { validate } from './core.js';
export const isAndroid = typeof window !== 'undefined' && !!window.ResonanceNative;
export async function loadState() {
  if (isAndroid) {
    const result=JSON.parse(window.ResonanceNative.readState());
    if(result.error)throw new Error(result.error);
    return validate(result);
  }
  const response=await fetch('/api/state');
  const result=await response.json();
  if(!response.ok)throw new Error(result.error || '本地资料无法读取');
  return validate(result);
}
export async function writeState(next) {
  validate(next);
  if (isAndroid) {
    const result=JSON.parse(window.ResonanceNative.writeState(JSON.stringify(next)));
    if(result.error)throw new Error(result.error);
    return validate(result);
  }
  const response=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error || '保存失败');
  return result;
}
export function nativeExport(name,text,type) {
  if(!isAndroid)return false;
  const error=window.ResonanceNative.exportFile(name,text,type);
  if(error)throw new Error(error);
  return true;
}
