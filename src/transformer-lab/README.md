# Transformer Lab — training code

Source for the browser app at [`../../apps/transformer-lab/`](../../apps/transformer-lab/).
A decoder-only transformer implemented from scratch in PyTorch, trained on two public-domain
Lewis Carroll books, exported to fp16 tensors and re-implemented in JavaScript so the forward
pass runs entirely in the browser.

## Model

| | |
|---|---|
| parameters | **198,208** |
| layers | 2 (pre-LN, residual around attention and FFN) |
| heads | 4 (d_head = 16) |
| d_model / d_ff | 64 / 256 |
| context | 32 tokens |
| vocabulary | 1,501 words (min frequency 2, `<unk>` for the rest — 94.9% coverage) |
| tokenizer | word-level regex `[a-z]+('…)?\|[.,;:!?"()]\|--` |
| corpus | *Alice's Adventures in Wonderland* + *Through the Looking-Glass*, 72,170 tokens |
| training | AdamW, OneCycle 2e-3, batch 32, 6,000 steps, dropout 0.15, best-val checkpoint |
| val loss | 4.13 (perplexity ≈ 62) |

## Files

```
train.py        # corpus download → tokenizer → model → 6k steps → model.pt
export.py       # model.pt → ../../apps/transformer-lab/weights.js (+ reference.json)
model.pt        # trained checkpoint (state_dict + config + vocab)
reference.json  # PyTorch attention maps and top-10 next-token probs for "the queen said"
```

## Reproduce

```bash
python3 train.py     # ~40 s on an Apple-silicon CPU; downloads the corpus on first run
python3 export.py    # writes apps/transformer-lab/weights.js (~536 KB of fp16 base64)
```

Requires Python 3.10+ with `torch` (tested with 2.13 on macOS arm64).

## Numerical parity with the JS forward pass

`reference.json` holds the PyTorch reference for the prompt `the queen said`. Running
`window.__tf('the queen said')` in the app returns the same tensors, and the two agree to:

- attention weights: **max abs error ≈ 5e-5**
- next-token probabilities: **≈ 2.5e-3** (largest, on the top token 0.3917 vs 0.3892)

The gap comes from storing the weights as fp16 and from the `erf` approximation used by GELU;
both are well below anything visible in the app.

## Notes

- `<unk>` (id 0) is masked out during sampling, so generated text never emits placeholder tokens.
- The corpus is public domain (Project Gutenberg #11 and #12); the download URLs live in `train.py`.
- Deleting `corpus/` re-downloads it; the directory is intentionally not committed.
