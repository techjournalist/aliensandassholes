import json, sys, soundfile as sf
from kokoro_onnx import Kokoro
D = sys.argv[1]
k = Kokoro(D+"/kokoro.onnx", D+"/voices.bin")
out = {}
for name, text in json.load(open("lines.json")):
    s, sr = k.create(text, voice="am_michael", speed=1.0, lang="en-us")
    sf.write(name+".wav", s, sr); out[name] = round(len(s)/sr, 3); print(name, out[name])
json.dump(out, open("durations.json","w"), indent=1)
