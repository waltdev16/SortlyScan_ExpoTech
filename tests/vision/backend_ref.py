"""Referencia: el mismo pipeline que POST /vision/classify del backend FastAPI (VisionEngine)."""
import json, mimetypes, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, "/home/claude/hist/backend")
from app.core.config import Settings
from app.services.vision import VisionEngine
e = VisionEngine(); e.load(Settings(_env_file=None, vision_model_dir="/home/claude/hist/machine-learning/models", vision_threads=1))
assert e.ready
out = {}
for p in sorted(Path("/tmp/visioncmp/imgs").iterdir()):
    ct = mimetypes.guess_type(p.name)[0]
    data = p.read_bytes()
    r = e.classify(ct, data, 5 * 1024 * 1024)
    img = e._decode(ct, data, 5 * 1024 * 1024)
    logits = e.session.run(None, {e.input_name: e._tensor(img)})[0][0]
    probs = np.exp(logits - logits.max()); probs = probs / probs.sum()
    out[p.name] = {"probs": [float(x) for x in probs], "status": r["status"], "category": r["category"], "confidence": r["confidence"], "reason": r["reason"]}
json.dump(out, open("/tmp/visioncmp/backend.json", "w"))
print(len(out), "referencias del backend")
