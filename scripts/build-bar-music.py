"""Original 120 BPM, 16-bar dance loop for Bar Mạnh Bà. No sampled songs."""
import array, math, os, random, subprocess, tempfile, wave

RATE=22050
BPM=120
BEAT=60/BPM
DURATION=32
N=RATE*DURATION
random.seed(1818)
left=array.array('f',[0])*N
right=array.array('f',[0])*N

def add(start,duration,voice,amp,pan=0):
    start=round(start*RATE)
    for i in range(round(duration*RATE)):
        t=i/RATE
        value=voice(t)*amp
        at=(start+i)%N
        left[at]+=value*(1-pan*.45)
        right[at]+=value*(1+pan*.45)

def kick(t):
    phase=2*math.pi*(46*t+110*.020*(1-math.exp(-t/.020)))
    return math.sin(phase)*math.exp(-t*13)+random.uniform(-1,1)*math.exp(-t*170)*.12

def clap(t):
    return random.uniform(-1,1)*math.exp(-t*24)*(.4+.6*abs(math.sin(t*430)))

def hat(t):
    return random.uniform(-1,1)*math.exp(-t*85)*(.4+.6*math.sin(t*8700)**2)

notes=[0,0,7,10,0,3,7,5,0,0,10,7,5,3,7,12]
for beat in range(64):
    add(beat*BEAT,.4,kick,.76)
    if beat%4 in (1,3):add(beat*BEAT,.18,clap,.26,(-1 if beat%4==1 else 1)*.18)
    for off in [0,.5]:add((beat+off)*BEAT,.08,hat,.10 if off==0 else .17,.35 if off else -.25)
    # Rounded offbeat bass and minor pentatonic bronze chimes.
    bass=55*2**([0,0,3,5][(beat//4)%4]/12)
    add((beat+.5)*BEAT,.22,lambda t,f=bass:(math.sin(t*f*2*math.pi)+.18*math.sin(t*f*4*math.pi))*min(1,t/.009)*math.exp(-t*12),.31)
    if beat%2==0:
        freq=220*2**(notes[(beat//2)%len(notes)]/12)
        add((beat+.75)*BEAT,.70,lambda t,f=freq:(math.sin(t*f*2*math.pi)+.2*math.sin(t*f*5.52*math.pi))*min(1,t/.008)*math.exp(-t*7),.17,(-.55 if beat%4 else .55))
    if beat%8==7:
        for off in [.25,.75]:add((beat+off)*BEAT,.10,clap,.10)
    if beat%4==0:
        chord=[110,110*2**(3/12),110*2**(7/12)]
        add(beat*BEAT,2,lambda t,fs=chord:sum(math.sin(t*f*2*math.pi) for f in fs)/3*min(1,t/.15)*math.exp(-t*1.9)*(.45+.55*min(1,(t%BEAT)/.16)),.17)

# Circular stereo echoes preserve the exact 64-beat seam.
for channel,other in [(left,right),(right,left)]:
    source=array.array('f',other)
    delay=round(BEAT*.75*RATE)
    for i in range(N):channel[i]+=source[(i-delay)%N]*.12
peak=max(max(abs(v) for v in left),max(abs(v) for v in right)) or 1
pcm=array.array('h')
for l,r in zip(left,right):
    pcm.append(round(math.tanh(l/peak*1.5)*.88*32767))
    pcm.append(round(math.tanh(r/peak*1.5)*.88*32767))
os.makedirs('public/audio/music',exist_ok=True)
with tempfile.NamedTemporaryFile(suffix='.wav',delete=False) as temp:path=temp.name
try:
    with wave.open(path,'wb') as output:
        output.setnchannels(2);output.setsampwidth(2);output.setframerate(RATE);output.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',path,'-c:a','aac','-b:a','128k','-movflags','+faststart','public/audio/music/bar.m4a'],check=True)
finally:os.remove(path)
print('Bar Mạnh Bà: 120 BPM / 64 beats / 32 seconds / stereo')
