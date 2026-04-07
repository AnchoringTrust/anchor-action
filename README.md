[![Anchored by Umarise](https://img.shields.io/badge/anchored-Bitcoin-c49a6c?style=flat)](https://umarise.com)

# Umarise Anchor

**Prove when your code existed. One YAML file. Bitcoin-verified.**

Every `git push` → your entire repository is snapshotted, hashed, and anchored to Bitcoin. The proof is independently verifiable by anyone, forever, without trusting Umarise.

```
push → snapshot → SHA-256 hash → Bitcoin anchor → .proof artifact
```

> Your source code never leaves the runner. Only the hash is sent.

---

## Quick start

Add one file to your repo: `.github/workflows/anchor.yml`

```yaml
name: Anchor to Bitcoin

on:
  push:
    branches: [main]

jobs:
  anchor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Create deterministic snapshot
        run: |
          tar --sort=name \
              --mtime='UTC 1970-01-01' \
              --owner=0 --group=0 --numeric-owner \
              -cf build.tar .
          gzip -n -f build.tar

      - name: Anchor to Bitcoin
        uses: AnchoringTrust/anchor-action@v1
        with:
          file: build.tar.gz
        env:
          UMARISE_API_KEY: ${{ secrets.UMARISE_API_KEY }}
```

That's it. **25 lines. No SDK. No dependency. No code change.**

Every push to `main` now produces a `.proof` file — uploaded as a GitHub Actions artifact.

> ✅ Last tested: April 7, 2026 — 100% working.

---

## What it does

| Step | What happens | Where |
|------|-------------|-------|
| 1 | Checks out your repository | Runner |
| 2 | Creates a deterministic tar.gz snapshot | Runner |
| 3 | Computes SHA-256 hash (bytes never leave the runner) | Runner |
| 4 | Sends only the hash to Umarise Core API | API |
| 5 | Hash is anchored to Bitcoin via OpenTimestamps | Bitcoin |
| 6 | Downloads `.proof` bundle (certificate + OTS proof) | Runner |
| 7 | Uploads `.proof` as a build artifact | GitHub |

**Privacy:** Your source code never leaves the CI runner. Only a 64-character hash is transmitted.

---

## Why deterministic hashing?

The `tar` command uses fixed timestamps, sort order, and ownership to ensure the **same code always produces the same hash**. Without this, identical code would produce different hashes on different runs.

> ⚠️ Do **not** use `tar czf build.tar.gz .` — this produces non-deterministic archives and inconsistent hashes.

---

## Verify

No account needed. No trust required.

```bash
pip install umarise
umarise verify build.tar.gz.proof
# ✓ Hash match | Bitcoin Block #939611 | 2026-03-06 | VALID
```

Or drag-and-drop at [verify-anchoring.org](https://verify-anchoring.org).

Or with standard tools:

```bash
unzip build.tar.gz.proof
sha256sum build.tar.gz        # compare with certificate.json
ots verify proof.ots          # verify against Bitcoin
```

---

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `file` | ✅ | — | Path to the file to anchor |
| `upload-artifact` | — | `true` | Upload `.proof` as build artifact |

**Authentication:** Set `UMARISE_API_KEY` as a repository secret (Settings → Secrets → Actions).

> 💡 **Tip: One key, multiple repos.** Your API key is not repo-specific. Use the same key across all your repositories to keep all anchors under one account and avoid wasting your 100 free sandbox anchors.

> 💡 **Tip: Naming the workflow file.** When creating the file on GitHub (Add file → Create new file), type the full path `.github/workflows/anchor.yml` in the filename field — GitHub creates the folders automatically. Any `.yml` file in `.github/workflows/` is recognized as a workflow.

> ⚠️ **Default branch must be `main`.** The workflow triggers on `branches: [main]`. If your repository uses a different default branch name (e.g. `master`, `develop`), either rename it (Settings → General → Default branch) or change `branches: [main]` in the YAML to match.

---

## Outputs

| Output | Description |
|---|---|
| `origin-id` | The origin ID from Umarise |
| `hash` | SHA-256 hash of the file |
| `proof-path` | Local path to the `.proof` file |

---

## Pricing

| Tier | Price | Includes |
|------|-------|---------|
| **Developer sandbox** | Free | 100 anchors, no credit card |
| **Production** | €1 per 1,000 anchors | Pay-as-you-go via Stripe |

Get your free API key at [umarise.com/developers](https://umarise.com/developers).

---

## Proof storage advice

Your `.proof` files are uploaded as GitHub Actions artifacts (90-day retention by default). For long-term storage:

- **Commit proofs to your repo** in a `proofs/` directory — they become part of your git history
- **Keep the original artifact** (build.tar.gz) alongside its `.proof` — you need both to verify
- **Backup to external storage** (S3, GCS, etc.) for audit-critical proofs

---

## Where this fits

Code signing proves **who**. SBOMs prove **what**. Anchoring proves **when**.

```
build → test → deploy → anchor
```

A `.proof` file next to a `.sig` and `.sbom` completes the audit trail.

---

## Setup

1. Get an API key at [umarise.com/developers](https://umarise.com/developers) (100 free anchors, no credit card)
2. Add `UMARISE_API_KEY` to your repo secrets (Settings → Secrets → Actions)
3. Copy the YAML above to `.github/workflows/anchor.yml`
4. Push. Done.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Error: UMARISE_API_KEY not set` | Secret name typo or missing | Check Settings → Secrets → Actions. Name must be exactly `UMARISE_API_KEY` (case-sensitive) |
| `401 Unauthorized` | Invalid or revoked API key | Generate a new key at [umarise.com/developers](https://umarise.com/developers) and update the secret |
| `402 Credit balance exhausted` | 100 free sandbox anchors used up | Upgrade to production (€1/1,000 anchors) at [umarise.com/developers](https://umarise.com/developers) |
| Workflow not triggering | Default branch is not `main` | Rename branch (Settings → General → Default branch) or change `branches: [main]` in the YAML |
| `tar: .: file changed as we read it` | Files modified during snapshot | Safe to ignore — does not affect the hash |
| No artifact uploaded | `upload-artifact` set to `false` | Remove or set `upload-artifact: true` |

> 💡 **Still stuck?** Open an issue at [github.com/AnchoringTrust/anchor-action](https://github.com/AnchoringTrust/anchor-action/issues) or email support@umarise.com.

---

## Links

- [Get API key](https://umarise.com/developers)
- [Live case study: 4,000+ anchored artifacts](https://umarise.com/case/ai-code-generation)
- [Independent verifier](https://verify-anchoring.org)
- [Open specification](https://anchoring-spec.org)
- [CLI & Python SDK](https://pypi.org/project/umarise/)
- [Node.js SDK](https://www.npmjs.com/package/@umarise/anchor)

## License

Unlicense (Public Domain)
