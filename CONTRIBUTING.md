# Contributing to Chaos Grid

Thank you for your interest in contributing to Chaos Grid.

## Development Setup

```bash
git clone https://github.com/onoz1169/chaos-grid.git
cd chaos-grid
npm install
npm run dev
```

Prerequisites:

- Node.js 18+
- Rust 1.77+ (install via [rustup](https://rustup.rs/))

## Submitting Issues

- Use the provided issue templates (bug report or feature request).
- Search existing issues before opening a new one.
- Include reproduction steps for bugs.

## Pull Requests

1. Fork the repository and create your branch from `main`.
2. Make your changes. Keep commits focused and atomic.
3. Ensure `npx tsc --noEmit` passes for the frontend.
4. Ensure `cargo check --manifest-path src-tauri/Cargo.toml` passes for the Rust backend.
5. Open a pull request against `main`.

## Code Style

- **Frontend**: TypeScript + React. Follow existing patterns in `src/`.
- **Backend**: Rust. Follow existing patterns in `src-tauri/src/`.
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/) -- `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
