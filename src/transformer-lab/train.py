"""Train a tiny word-level GPT on two public-domain Carroll books.

Architecture mirrors the user's mini_transformer (pre-LN decoder, tied head),
word-level so the attention maps are interpretable. Dropout + cosine LR +
best-checkpoint selection keep it from memorising 70k tokens.
"""
import json, math, os, re, sys, time, unicodedata
from collections import Counter
import torch
import torch.nn.functional as F

torch.manual_seed(1337)
OUT = os.path.dirname(os.path.abspath(__file__))
CTX = int(os.environ.get("CTX", 32))
D_MODEL = int(os.environ.get("D", 64))
N_HEADS = int(os.environ.get("H", 4))
N_LAYERS = int(os.environ.get("L", 2))
D_FF = int(os.environ.get("FF", 256))
VOCAB_MAX = int(os.environ.get("VOCAB", 600))
STEPS = int(os.environ.get("STEPS", 3000))
DROPOUT = float(os.environ.get("DROPOUT", 0.15))
BATCH = 32
TOPK = int(os.environ.get('TOPK', 40))
LR = 2e-3

# ---------- corpus ----------
def clean(path):
    raw = open(path, encoding="utf-8").read()
    s = raw.find("*** START OF")
    e = raw.find("*** END OF")
    if s > 0:
        raw = raw[raw.find("\n", s):e]
    raw = unicodedata.normalize("NFKD", raw)
    raw = "".join(c for c in raw if not unicodedata.combining(c))
    return (raw.replace("\u201c", '"').replace("\u201d", '"').replace("\u2019", "'")
               .replace("\u2014", " -- ").replace("_", " ").lower())

import urllib.request
BOOKS = {"alice.txt": "https://www.gutenberg.org/files/11/11-0.txt",
         "looking_glass.txt": "https://www.gutenberg.org/cache/epub/12/pg12.txt"}

def fetch(name, url):
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "corpus", name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        print(f"downloading {name}…", file=sys.stderr)
        urllib.request.urlretrieve(url, path)
    return path

raw = clean(fetch("alice.txt", BOOKS["alice.txt"])) + "\n" + clean(fetch("looking_glass.txt", BOOKS["looking_glass.txt"]))
TOKEN_RE = re.compile(r"[a-z]+(?:'[a-z]+)?|[.,;:!?\"()]|--")
tokens = TOKEN_RE.findall(raw)
freq = Counter(tokens)
vocab = ["<unk>"] + [w for w, c in freq.most_common(VOCAB_MAX) if c >= 2]
stoi = {w: i for i, w in enumerate(vocab)}
itos = vocab
ids = [stoi.get(t, 0) for t in tokens]
coverage = sum(1 for i in ids if i != 0) / len(ids)
print(f"corpus: {len(tokens)} tokens | vocab {len(vocab)} | coverage {coverage:.1%}", file=sys.stderr)

data = torch.tensor(ids, dtype=torch.long)
n = int(len(data) * 0.94)
train_data, val_data = data[:n], data[n:]

# ---------- model ----------
class Attention(torch.nn.Module):
    def __init__(self, d_model, n_heads, ctx, p):
        super().__init__()
        self.n_heads, self.d_head = n_heads, d_model // n_heads
        self.qkv = torch.nn.Linear(d_model, 3 * d_model)
        self.proj = torch.nn.Linear(d_model, d_model)
        self.drop = torch.nn.Dropout(p)
        self.register_buffer("mask", torch.triu(torch.full((ctx, ctx), float("-inf")), diagonal=1))

    def forward(self, x, want_attn=False):
        B, T, C = x.shape
        q, k, v = self.qkv(x).split(C, dim=2)
        q = q.view(B, T, self.n_heads, self.d_head).transpose(1, 2)
        k = k.view(B, T, self.n_heads, self.d_head).transpose(1, 2)
        v = v.view(B, T, self.n_heads, self.d_head).transpose(1, 2)
        att = (q @ k.transpose(-2, -1)) / math.sqrt(self.d_head) + self.mask[:T, :T]
        att = att.softmax(dim=-1)
        att_d = self.drop(att)
        out = (att_d @ v).transpose(1, 2).contiguous().view(B, T, C)
        return (self.drop(self.proj(out)), att) if want_attn else self.drop(self.proj(out))


class Block(torch.nn.Module):
    def __init__(self, d_model, n_heads, d_ff, ctx, p):
        super().__init__()
        self.ln1 = torch.nn.LayerNorm(d_model)
        self.attn = Attention(d_model, n_heads, ctx, p)
        self.ln2 = torch.nn.LayerNorm(d_model)
        self.fc1 = torch.nn.Linear(d_model, d_ff)
        self.fc2 = torch.nn.Linear(d_ff, d_model)
        self.drop = torch.nn.Dropout(p)

    def forward(self, x, want_attn=False):
        if want_attn:
            a, att = self.attn(self.ln1(x), True)
        else:
            a = self.attn(self.ln1(x))
        x = x + a
        x = x + self.drop(self.fc2(F.gelu(self.fc1(self.ln2(x)))))
        return (x, att) if want_attn else x


class MiniGPT(torch.nn.Module):
    def __init__(self, vocab_size, ctx, d_model, n_heads, n_layers, d_ff, p):
        super().__init__()
        self.ctx = ctx
        self.tok = torch.nn.Embedding(vocab_size, d_model)
        self.pos = torch.nn.Embedding(ctx, d_model)
        self.drop = torch.nn.Dropout(p)
        self.blocks = torch.nn.ModuleList(Block(d_model, n_heads, d_ff, ctx, p) for _ in range(n_layers))
        self.ln_f = torch.nn.LayerNorm(d_model)
        self.lm_head = torch.nn.Linear(d_model, vocab_size, bias=False)
        self.lm_head.weight = self.tok.weight

    def forward(self, idx, return_attn=False):
        B, T = idx.shape
        x = self.drop(self.tok(idx) + self.pos(torch.arange(T)))
        maps = []
        for blk in self.blocks:
            if return_attn:
                x, att = blk(x, True); maps.append(att)
            else:
                x = blk(x)
        logits = self.lm_head(self.ln_f(x))
        return (logits, maps) if return_attn else logits


model = MiniGPT(len(vocab), CTX, D_MODEL, N_HEADS, N_LAYERS, D_FF, DROPOUT)
nparams = sum(p.numel() for p in model.parameters())
print(f"params {nparams/1000:.1f}k | d={D_MODEL} h={N_HEADS} L={N_LAYERS} ff={D_FF} ctx={CTX} drop={DROPOUT}", file=sys.stderr)

opt = torch.optim.AdamW(model.parameters(), lr=LR, betas=(0.9, 0.95), weight_decay=0.05)
sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=LR, total_steps=STEPS, pct_start=0.1)

def batch(split):
    d = train_data if split == "train" else val_data
    ix = torch.randint(len(d) - CTX - 1, (BATCH,))
    return (torch.stack([d[i:i + CTX] for i in ix]),
            torch.stack([d[i + 1:i + 1 + CTX] for i in ix]))

@torch.no_grad()
def eval_loss(iters=50):
    model.eval(); tot = 0.0
    for _ in range(iters):
        x, y = batch("val")
        lg = model(x)
        tot += F.cross_entropy(lg.reshape(-1, lg.size(-1)), y.reshape(-1)).item()
    model.train()
    return tot / iters

best = {"loss": 9e9, "state": None, "step": 0}
t0 = time.time()
for step in range(1, STEPS + 1):
    x, y = batch("train")
    lg = model(x)
    loss = F.cross_entropy(lg.reshape(-1, lg.size(-1)), y.reshape(-1))
    opt.zero_grad(set_to_none=True); loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    opt.step(); sched.step()
    if step % 250 == 0 or step == 1:
        vl = eval_loss()
        flag = ""
        if vl < best["loss"]:
            best = {"loss": vl, "state": {k: v.clone() for k, v in model.state_dict().items()}, "step": step}
            flag = " *"
        print(f"step {step:5d} | train {loss.item():.3f} | val {vl:.3f}{flag} | {time.time()-t0:.0f}s", file=sys.stderr)

model.load_state_dict(best["state"])
print(f"best val {best['loss']:.3f} @ step {best['step']}", file=sys.stderr)
torch.save({"model": model.state_dict(),
            "config": dict(vocab_size=len(vocab), ctx=CTX, d_model=D_MODEL, n_heads=N_HEADS,
                           n_layers=N_LAYERS, d_ff=D_FF),
            "vocab": vocab, "val_loss": best["loss"]}, os.path.join(OUT, "model.pt"))

@torch.no_grad()
def sample(prompt, n_new=50, temp=0.85):
    idx = torch.tensor([[stoi.get(t, 0) for t in TOKEN_RE.findall(prompt.lower())]])
    for _ in range(n_new):
        logits = model(idx[:, -CTX:])
        logits = logits[:, -1] / temp
        logits[:, 0] = -float("inf")  # nunca gerar <unk>
        if TOPK:
            v, _ = torch.topk(logits, TOPK)
            logits[logits < v[:, [-1]]] = -float("inf")
        probs = F.softmax(logits, dim=-1)
        idx = torch.cat([idx, torch.multinomial(probs, 1)], dim=1)
    return " ".join(itos[i] for i in idx[0].tolist())

for prompt in ["alice was", "the queen said", "she looked at the"]:
    print(f"\n{prompt!r} -> {sample(prompt)}\n", file=sys.stderr)

print(json.dumps({"params": nparams, "val_loss": round(best["loss"], 3), "vocab": len(vocab)}))
