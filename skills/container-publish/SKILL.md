---
name: container-publish
description: >
  Publishing Docker images for NestJS apps. Load this skill when pushing images
  to a container registry, using docker buildx for multi-arch builds, publishing
  to GHCR (GitHub Container Registry), setting up GitHub Actions for docker
  build-push, or managing semver and :latest tags.
---

## Core Principles

1. **Always publish both a semver tag and :latest.** Pinning to a semver tag enables
   rollback. The :latest tag lets integrations pick up new releases without config
   changes. Publish both in every release workflow.

2. **Multi-arch by default (amd64 + arm64).** ARM-based runners and Apple Silicon
   development machines require arm64 images. `docker buildx` handles both in a
   single push.

3. **Use GHCR with GITHUB_TOKEN — no extra secrets.** GitHub Container Registry
   authenticates with the built-in `GITHUB_TOKEN`. No manual PAT management needed.

4. **Never push :latest from a branch.** Only tag workflows triggered by semver
   tags (`v*.*.*`) or merges to main should push :latest. Branch pushes should only
   push a sha-tagged image for traceability.

5. **Sign and attest images in production.** Use `docker/attest-build-provenance-action`
   or Cosign to attest that CI built the image. Unsigned images in production are a
   supply chain risk.

## Patterns

### docker buildx: Multi-Arch Local Build

```bash
# Create a buildx builder with multi-arch support
docker buildx create --name multi --use

# Build and push amd64 + arm64
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --target production \
  --tag ghcr.io/my-org/my-api:1.2.3 \
  --tag ghcr.io/my-org/my-api:latest \
  --push \
  .
```

### GitHub Actions: Build and Push on Tag

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          target: production
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### GitHub Actions: Push SHA Tag on Every Main Merge

```yaml
# .github/workflows/ci.yml (add to existing CI job)
- name: Build and push SHA-tagged image
  if: github.ref == 'refs/heads/main'
  uses: docker/build-push-action@v5
  with:
    context: .
    target: production
    platforms: linux/amd64,linux/arm64
    push: true
    tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### Making the GHCR Image Public

By default GHCR images are private. To make them public:
1. Navigate to the package on GitHub.
2. Package settings > Change visibility > Public.

Or via GitHub CLI:
```bash
gh api --method PATCH /user/packages/container/my-api \
  -f visibility=public
```

## Anti-patterns

### :latest Only Tag (No Rollback)

```bash
# BAD — if :latest is broken, there is no previous version to roll back to
docker buildx build --tag ghcr.io/my-org/my-api:latest --push .

# GOOD — always tag with a specific version too
docker buildx build \
  --tag ghcr.io/my-org/my-api:1.2.3 \
  --tag ghcr.io/my-org/my-api:latest \
  --push .
```

### Single-Arch Images

```bash
# BAD — arm64 hosts (Apple Silicon CI, Graviton) cannot run this image
docker build -t ghcr.io/my-org/my-api:latest .
docker push ghcr.io/my-org/my-api:latest

# GOOD — multi-platform via buildx
docker buildx build --platform linux/amd64,linux/arm64 --push ...
```

### Manual Push from Dev Machine

```bash
# BAD — image built locally may differ from CI environment
#       developer secrets may be in the build context
docker build -t ghcr.io/my-org/my-api:latest .
docker push ghcr.io/my-org/my-api:latest

# GOOD — all publishes go through GitHub Actions using GITHUB_TOKEN
```

## Decision Guide

| Scenario | Recommendation |
|---|---|
| Release on git tag | GitHub Actions with `on: push: tags: v*.*.*` |
| Traceability without full release | Push SHA-tagged image on merge to main |
| ARM + AMD64 support | `docker buildx` with `--platform linux/amd64,linux/arm64` |
| Registry choice | GHCR for GitHub projects (free, GITHUB_TOKEN auth) |
| Rollback capability | Always push both semver and :latest |
| Build caching in CI | `cache-from/cache-to: type=gha` in build-push-action |
