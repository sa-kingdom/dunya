# Agent Development Guidelines for Dunya

This repository follows a strict workflow. All AI agents (including assistants and coding agents) must adhere to these guidelines to ensure consistency and avoid common errors.

## Development Workflow

- **Primary Branch**: `rolling`
- **Stable Branch**: `main`
- **PR Strategy**:
    - NEVER target `main` directly for features or refinements.
    - ALWAYS create a feature branch and target `rolling` as the base branch.
    - The repository follows a `rolling -> main` flow for deployments.

## Tool Usage and Code Editing

- **Atomic Edits**: Prefer `replace_file_content` or `multi_replace_file_content` over `write_to_file` for existing files to minimize unnecessary changes and avoid overwriting concurrent work.

## Commit Guidelines

- Follow Conventional Commits (as configured in `package.json`):
    - `feat:`: New features.
    - `fix:`: Bug fixes.
    - `docs:`: Documentation updates.
    - `refactor:`: Code restructuring.
    - `test:`: Adding or fixing tests.
    - `chore:`: Maintenance tasks or dependency updates.
    - `perf:`: Performance improvements.
    - `style:`: Changes that do not affect the meaning of the code (white-space, formatting, etc.).
    - `ci:`: Changes to CI configuration scripts and tools.
    - `build:`: Changes that affect the build system or external dependencies.
