# Contributing to MorningTV

Thank you for your interest in contributing to MorningTV! We welcome contributions, bug reports, feature proposals, and pull requests.

## Development Setup

### Prerequisites
- **Node.js**: v20 or higher (`npm v10+`)
- **Rust**: Stable toolchain (1.80+) via [rustup.rs](https://rustup.rs/)
- **Windows Build Tools** (on Windows): Visual Studio 2022 C++ Build Tools

### Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/morningstarwebd/morningtv.git
   cd morningtv
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Run development mode (Hot-Reloading Frontend + Native Tauri Backend)**:
   ```bash
   npm run tauri:dev
   ```

4. **Run code quality checks**:
   ```bash
   # Frontend linting (Biome & ESLint)
   npm run lint

   # Frontend production build & typecheck
   npm run build

   # Rust backend check & tests
   npm run cargo:check
   npm run test
   ```

## Development Architecture

- `src/`: React 19 + TypeScript + Tailwind CSS v4 frontend.
- `src-tauri/`: Tauri v2 Rust backend with Tokio, Axum in-process streaming proxy, SQLite channel cache, and IPC commands.
- `crates/sentinel/`: High-performance multi-threaded stream auditor and auto-healer.
- `playlists/`: Master M3U playlists categorized by genre and country.

## Guidelines & Pull Request Process

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Ensure all tests and linters pass:
   ```bash
   npm run ci
   ```
3. Commit using conventional commit format:
   - `feat(player): add picture-in-picture keyboard shortcut`
   - `fix(proxy): handle dynamic port collision`
   - `docs: update setup instructions`
4. Open a Pull Request on GitHub against `main`. All CI checks must pass before merging.

## Code of Conduct

Please note that this project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.
