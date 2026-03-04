# umarise/anchor-action

Anchor build artifacts to Bitcoin. One line in your workflow.

## Usage

```yaml
- uses: umarise/anchor-action@v1
  with:
    file: build/output.tar.gz
  env:
    UMARISE_API_KEY: ${{ secrets.UMARISE_API_KEY }}
```

That's it. Every build gets a `.proof` file — uploaded as a GitHub Actions artifact.

## What happens

1. Installs `@umarise/cli`
2. Runs `umarise anchor <file>`
3. Uploads `<file>.proof` as artifact

The proof bundle contains `certificate.json` + `proof.ots`. Verifiable offline, independent of Umarise.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `file` | ✅ | — | Path to the file to anchor |
| `upload-artifact` | — | `true` | Upload `.proof` as GitHub Actions artifact |

## Outputs

| Output | Description |
|---|---|
| `origin-id` | The `origin_id` from Umarise |
| `hash` | SHA-256 hash of the file |
| `proof-path` | Local path to the `.proof` file |

## Secrets

Add `UMARISE_API_KEY` to your repository secrets:
Settings → Secrets and variables → Actions → New repository secret.

Get your key at [umarise.com/developers](https://umarise.com/developers).

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
        uses: umarise/anchor-action@v1
        with:
          file: build.tar.gz
        env:
          UMARISE_API_KEY: ${{ secrets.UMARISE_API_KEY }}
```

## Verify offline

```bash
# Download the .proof artifact from GitHub Actions
unzip build.tar.gz.proof
sha256sum build.tar.gz              # compare with certificate.json
ots verify proof.ots                # verify against Bitcoin
```

No Umarise server needed for verification.

## License

Unlicense (Public Domain)
