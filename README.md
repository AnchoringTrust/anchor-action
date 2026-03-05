# AnchoringTrust/anchor-action

Anchor build artifacts to Bitcoin. One line in your workflow.

```
artifact → artifact.proof
```

## Usage

```yaml
- uses: AnchoringTrust/anchor-action@v1
  with:
    file: build/output.tar.gz
  env:
    UMARISE_API_KEY: ${{ secrets.UMARISE_API_KEY }}
```

That's it. Every build gets a `.proof` file — uploaded as a GitHub Actions artifact.

## What it does

1. Hashes your file locally (SHA-256, bytes never leave your runner)
2. Anchors the hash to Bitcoin via Umarise Core API
3. Downloads the `.proof` bundle (certificate + OTS proof)
4. Uploads `<file>.proof` as a build artifact

The proof is independently verifiable. No Umarise account needed to verify.

## Example: anchored releases

Your GitHub release will look like:

```
v1.2.0

release.tar.gz
release.tar.gz.proof
```

Anyone can verify: `what is this .proof file?` → that's your marketing.

## Full example

```yaml
name: Build & Anchor

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build
        run: tar czf build.tar.gz dist/

      - name: Anchor to Bitcoin
        uses: AnchoringTrust/anchor-action@v1
        with:
          file: build.tar.gz
        env:
          UMARISE_API_KEY: ${{ secrets.UMARISE_API_KEY }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `file` | ✅ | — | Path to the file to anchor |
| `upload-artifact` | — | `true` | Upload `.proof` as build artifact |

## Outputs

| Output | Description |
|---|---|
| `origin-id` | The origin ID from Umarise |
| `hash` | SHA-256 hash of the file |
| `proof-path` | Local path to the `.proof` file |

## Setup

1. Get an API key at [umarise.com/developers](https://umarise.com/developers)
2. Add `UMARISE_API_KEY` to your repo secrets (Settings → Secrets → Actions)
3. Add the step to your workflow
4. Push. Done.

## Verify offline

```bash
unzip build.tar.gz.proof
sha256sum build.tar.gz              # compare with certificate.json
ots verify proof.ots                # verify against Bitcoin blockchain
```

Or use [verify-anchoring.org](https://verify-anchoring.org) — independent, client-side, no upload.

## Links

- [Get API key](https://umarise.com/developers)
- [CLI](https://www.npmjs.com/package/@umarise/cli) — `npx @umarise/cli anchor <file>`
- [Node.js SDK](https://www.npmjs.com/package/@umarise/anchor)
- [Python SDK](https://pypi.org/project/umarise-core-sdk/)
- [Anchoring Specification](https://anchoring-spec.org)

## License

Unlicense (Public Domain)
