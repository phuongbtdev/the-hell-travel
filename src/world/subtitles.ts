import { SPEAKER_NAMES, type DialogueLine } from './dialogue';

/** Keep the large subtitles readable without losing any part of the story. */
export function paginateDialogue(lines:DialogueLine[],limit=160):DialogueLine[]{
  const pages:DialogueLine[]=[];
  for(const line of lines){
    let page='';
    const sentences=line.text.trim().split(/(?<=[.!?…])\s+/u);
    for(const sentence of sentences){
      for(const word of sentence.split(/\s+/u)){
        if(page&&page.length+word.length+1>limit){pages.push({speaker:line.speaker,text:page});page='';}
        page=page?`${page} ${word}`:word;
      }
    }
    if(page)pages.push({speaker:line.speaker,text:page});
  }
  return pages;
}

export class Subtitles {
  private pages:DialogueLine[]=[];
  private index=0;
  get visible(){return this.pages.length>0;}
  constructor(private elements:{panel:HTMLElement;speaker:HTMLElement;text:HTMLElement;progress:HTMLElement;previous:HTMLButtonElement;next:HTMLButtonElement;close:HTMLButtonElement}){
    elements.previous.addEventListener('click',()=>this.previous());
    elements.next.addEventListener('click',()=>this.next());
    elements.close.addEventListener('click',()=>this.clear());
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>this.updateHeight()).observe(elements.panel);
  }
  show(lines:DialogueLine[]){this.pages=paginateDialogue(lines);this.index=0;this.render();}
  next(){if(!this.visible)return;if(this.index<this.pages.length-1){this.index++;this.render();}else this.clear();}
  previous(){if(this.index>0){this.index--;this.render();}}
  clear(){this.pages=[];this.index=0;this.render();}
  private render(){
    const e=this.elements,line=this.pages[this.index];
    e.panel.classList.toggle('hidden',!line);e.panel.setAttribute('aria-hidden',String(!line));
    e.panel.inert=!line;
    if(line){e.speaker.textContent=SPEAKER_NAMES[line.speaker];e.text.textContent=line.text;e.progress.textContent=`${this.index+1} / ${this.pages.length}`;e.previous.disabled=this.index===0;e.next.textContent=this.index===this.pages.length-1?'Đóng':'Tiếp tục →';e.text.scrollTop=0;}
    this.updateHeight();
  }
  private updateHeight(){document.body.style.setProperty('--subtitle-height',this.visible?`${this.elements.panel.offsetHeight+18}px`:'0px');}
}
