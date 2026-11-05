export const CHARACTERS = [
  {id:'spirit',name:'Hồn ma người chơi',file:'spirit',height:1.8},
  {id:'spirit-female',name:'Hồn nữ tóc dài',file:'spirit-female',height:1.8},
  {id:'spirit-round',name:'Hồn tròn',file:'spirit-round',height:1.7},
  {id:'spirit-hat',name:'Hồn đội nón',file:'spirit-hat',height:1.65},
  {id:'guide',name:'Tiểu Sai dẫn đường',file:'tieu-sai',height:1.85},
  {id:'judge',name:'Diêm Vương',file:'diem-vuong',height:2},
  {id:'penitent',name:'Người chịu phạt',file:'penitent',height:1.8},
  {id:'traveler-male',name:'Lữ hành nam',file:'traveler-male',height:1.8},
  {id:'traveler-female',name:'Lữ hành nữ',file:'traveler-female',height:1.8},
  {id:'clerk',name:'Thư lại đeo kính',file:'clerk',height:1.7},
  {id:'demon',name:'Quỷ sai đỏ lực lưỡng',file:'executioner-red',height:1.95},
  {id:'guard-green',name:'Quỷ sai xanh lục',file:'executioner-green',height:1.9},
  {id:'guard-blue',name:'Quỷ sai xanh cao gầy',file:'executioner-blue',height:2.1},
  {id:'hound',name:'Chó ngao âm phủ',file:'hell-hound',height:1.4},
  {id:'ox',name:'Trâu quỷ',file:'demon-ox',height:1.7},
] as const;
export type ActorKind=typeof CHARACTERS[number]['id'];
export const characterAsset=(id:ActorKind)=>CHARACTERS.find(c=>c.id===id)!;
