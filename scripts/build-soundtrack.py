"""Compose original looping ambient music locally; no external audio assets."""
import math, array, wave, os, subprocess, tempfile, random

RATE=22050;DURATION=24;random.seed(18)
OUT='public/audio/music';os.makedirs(OUT,exist_ok=True)
profiles={'hall':(146.83,.75,'bell'),'wind':(110,1.5,'flute'),'fire':(98,.5,'plucked'),'metal':(130.81,.75,'bell'),'ice':(220,1.0,'bell'),'water':(164.81,.75,'flute'),'stone':(73.42,1.5,'plucked'),'beast':(82.41,.75,'plucked')}
pattern=[0,7,10,5,3,7,0,12,10,7,5,3,0,5,7,3]
for name,(base,beat,timbre) in profiles.items():
    out=array.array('f',[0])*(RATE*DURATION)
    def note(start,freq,length,amp,kind):
        for i in range(int(length*RATE)):
            p=int(start*RATE)+i
            if p>=len(out):break
            t=i/RATE;attack=min(1,t/.035);env=attack*math.exp(-t*(2.5 if kind=='bell' else 1.7))
            if kind=='bell':s=math.sin(2*math.pi*freq*t)+.28*math.sin(2*math.pi*freq*2.76*t)+.10*math.sin(2*math.pi*freq*5.4*t)
            elif kind=='flute':s=math.sin(2*math.pi*freq*t+.016*math.sin(t*30))+.18*math.sin(2*math.pi*freq*2*t)
            else:s=math.sin(2*math.pi*freq*t)+.32*math.sin(2*math.pi*freq*2*t)+.12*math.sin(2*math.pi*freq*3*t)
            out[p]+=s*env*amp
    for i in range(int(DURATION/beat)):
        note(i*beat,base*2**(pattern[i%len(pattern)]/12),min(2.1,beat*2.5),.25 if i%4==0 else .17,timbre)
        if i%4==0:note(i*beat,base/2,3.5,.13,'flute')
        if name in ['fire','stone','beast'] and i%2==0:note(i*beat,52,.20,.22,'plucked')
    # Two short echoes, plus a brief edge envelope for click-free looping.
    for delay,gain in [(.21,.18),(.43,.09)]:
        step=int(delay*RATE)
        for i in range(len(out)-1,step-1,-1):out[i]+=out[i-step]*gain
    peak=max(abs(v) for v in out) or 1
    pcm=array.array('h',(int(max(-1,min(1,v/peak*.76))*32767*min(1,i/(RATE*.15),(len(out)-i)/(RATE*.3))) for i,v in enumerate(out)))
    tmp=os.path.join(tempfile.gettempdir(),f'underworld-{name}.wav')
    with wave.open(tmp,'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',tmp,'-c:a','aac','-b:a','96k',f'{OUT}/{name}.m4a'],check=True)
    os.remove(tmp);print(name,flush=True)
