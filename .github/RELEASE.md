# InfoFlow Extension Release Configuration

## Automated Release Process

This project is configured for automated releases of the InfoFlow browser extension using GitHub Actions.

### Release Workflow

The release workflow `.github/workflows/release.yml` will:

1. **On push to main branch:**
   - Install dependencies for InfoFlow extension
   - Run type checking
   - Build Chrome extension
   - Build Firefox extension
   - Package both extensions into ZIP files
   - Create GitHub Release with version tag
   - Upload Chrome and Firefox extension files

2. **On pull requests:**
   - Run build validation without publishing
   - Upload build artifacts for testing

### Build Process

The CI script will:
- Build Chrome extension (`chrome.zip`)
- Build Firefox extension (`firefox.zip`)
- Use version from `package.json` for release tag
- Create GitHub Release with both extension files

### Manual Release Commands

For local development and testing:

```bash
# Navigate to InfoFlow directory
cd apps/InfoFlow

# Build both extensions
pnpm release

# Build specific browser extension
pnpm build          # Chrome
pnpm build:firefox  # Firefox

# Package extensions
pnpm zip            # Chrome ZIP
pnpm zip:firefox    # Firefox ZIP

# Complete release preparation
pnpm release:prepare
```

### Version Management

- Version is managed in `apps/InfoFlow/package.json`
- Release tags use format `v{version}` (e.g., `v1.0.0`)
- To update version: `npm version patch` in InfoFlow directory

### Build Artifacts

- **Chrome Extension**: `apps/InfoFlow/chrome.zip`
- **Firefox Extension**: `apps/InfoFlow/firefox.zip`
- **Build Output**: `apps/InfoFlow/dist/`

### Installation

After release, users can:
1. Download extension ZIP files from GitHub Release
2. Unzip the files
3. Load extension in browser developer mode
4. Chrome: `chrome://extensions/` → Load unpacked
5. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on

### Release Notes Format

Each release includes:
- Version number and tag
- Installation instructions for both browsers
- List of included files
- Automated changelog from main branch