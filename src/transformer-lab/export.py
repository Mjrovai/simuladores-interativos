"""Export the trained checkpoint to fp16 base64 tensors + a JS weights file,
and dump a reference (attention + logits) for numerical verification."""
import base64, json, os, sys
import torch
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_JS = os.environ.get("OUT_JS", os.path.join(HERE, "..", "..", "apps", "transformer-lab", "weights.js"))
OUT_REF = os.environ.get("OUT_REF", os.path.join(HERE, "reference.json"))

ck = torch.load(os.path.join(HERE, "model.pt"), weights_only=False)
sd = ck["model"]; cfg = ck["config"]; vocab = ck["vocab"]

def b64(t):
    t = t.detach().to(torch.float16).contiguous().cpu().numpy()
    return base64.b64encode(t.tobytes()).decode("ascii")

tensors, shapes = {}, {}
for name, t in sd.items():
    if name == "lm_head.weight":
        continue
    tensors[name] = b64(t)
    shapes[name] = list(t.shape)

payload = {"config": cfg, "vocab": vocab, "valLoss": float(ck.get("val_loss", 0)),
           "dtype": "float16", "shapes": shapes, "tensors": tensors}
with open(OUT_JS, "w") as f:
    f.write("window.TF_LAB = ")
    json.dump(payload, f, separators=(",", ":"))
    f.write(";\n")
print(f"{OUT_JS}: {os.path.getsize(OUT_JS)/1024:.0f} KB | {len(tensors)} tensores | {sum(torch.tensor(v).numel() for v in []) if False else ''}")

# ---- referência para verificação numérica ----
PROMPT = "the queen said"
TOKEN_RE = __import__("re").compile(r"[a-z]+(?:'[a-z]+)?|[.,;:!?\"()]|--")
import unicodedata
def enc(s):
    s = unicodedata.normalize("NFKD", s).lower()
    s = "".join(c for c in s if not unicodedata.combining(c))
    stoi = {w: i for i, w in enumerate(vocab)}
    return [stoi.get(t, 0) for t in TOKEN_RE.findall(s)]

# reconstrói o módulo a partir do checkpoint (mesma classe do treino)
sys.path.insert(0, HERE)
import importlib.util
spec = importlib.util.spec_from_file_location("tw", os.path.join(HERE, "train_v2.py"))
# evita re-treinar: carrega só as classes via exec do trecho de classes
src = open(os.path.join(HERE, "train_v2.py")).read()
ns = {"torch": torch, "math": __import__("math"), "F": F}
exec(src[src.index("class Attention"):src.index("model = MiniGPT")], ns)
MiniGPT = ns["MiniGPT"]
model = MiniGPT(cfg["vocab_size"], cfg["ctx"], cfg["d_model"], cfg["n_heads"], cfg["n_layers"], cfg["d_ff"], 0.0)
model.load_state_dict(sd); model.eval()

ids = enc(PROMPT)
with torch.no_grad():
    logits, maps = model(torch.tensor([ids]), return_attn=True)
probs = F.softmax(logits[0, -1], dim=-1)
top = torch.topk(probs, 10)
ref = {"prompt": PROMPT, "ids": ids,
       "tokens": [vocab[i] for i in ids],
       "top": [{"token": vocab[i], "p": round(float(p), 6)} for p, i in zip(top.values, top.indices)],
       "attn": [[[[round(float(v), 6) for v in row] for row in head] for head in lay[0].tolist()] for lay in maps]}
json.dump(ref, open(OUT_REF, "w"), ensure_ascii=False)
print(f"ref: {OUT_REF} ({os.path.getsize(OUT_REF)/1024:.0f} KB) | top: {ref['top'][:3]}")
