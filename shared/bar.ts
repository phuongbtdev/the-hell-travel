export const BAR_BPM=120;
export const BAR_TRACK_SECONDS=32;
export const BAR_SLOGAN='Tội gì cũng phải quẩy chứ';
export const DANCES=[
 {id:'dance-bounce',label:'Nhún theo beat',icon:'✦',group:'party'},
 {id:'dance-sway',label:'Lắc lư',icon:'〰',group:'party'},
 {id:'dance-hands',label:'Quẩy tay',icon:'↑',group:'party'},
 {id:'dance-shuffle',label:'Trượt chân',icon:'↔',group:'party'},
 {id:'dance-spin',label:'Xoay hồn',icon:'↻',group:'party'},
 {id:'dance-summon',label:'Gọi hội',icon:'✧',group:'party'},
 {id:'dance-hiphop',label:'Hip hop',icon:'★',group:'street'},
 {id:'dance-popping',label:'Popping',icon:'ϟ',group:'street'},
 {id:'dance-robot',label:'Robot',icon:'▣',group:'street'},
 {id:'dance-moonwalk',label:'Moonwalk',icon:'☾',group:'street'},
 {id:'dance-break',label:'Breakdance',icon:'⟳',group:'street'},
] as const;
export type DanceId=typeof DANCES[number]['id'];
export const isDance=(value:unknown):value is DanceId=>typeof value==='string'&&DANCES.some(d=>d.id===value);
export const barSeconds=(now=Date.now())=>((now/1000%BAR_TRACK_SECONDS)+BAR_TRACK_SECONDS)%BAR_TRACK_SECONDS;
