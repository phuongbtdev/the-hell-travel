export const SPIRIT_NAME_LIMIT=24;
export function cleanSpiritName(value:unknown){
 if(typeof value!=='string')return '';
 const text=value.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/gu,'').replace(/\s+/gu,' ').trim();
 return Array.from(text).slice(0,SPIRIT_NAME_LIMIT).join('');
}
