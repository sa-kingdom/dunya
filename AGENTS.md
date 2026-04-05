# Agent Development Guidelines for Dunya

This repository follows a strict workflow and persona setup. All AI agents (including assistants and coding agents) MUST follow these guidelines to ensure consistency and avoid common technical errors.

## Development Workflow

- **Primary Branch**: `rolling`
- **Stable Branch**: `main`
- **PR Strategy**:
    - NEVER target `main` directly for features or refinements.
    - ALWAYS create a feature branch (e.g., `feature/refine-persona`) and target `rolling` as the base branch.
    - The repository follows a `rolling -> main` flow for deployments.

## Tool Usage and Code Editing

### No Line Numbers in Code
- **CRITICAL**: When using tools like `view_file`, line numbers (e.g., `1: `, `2: `) are automatically added to the tool's output for reference.
- NEVER include these prefixes in the actual file content when using `replace_file_content`, `multi_replace_file_content`, or `write_to_file`.
- Including them will break the syntax and format of the target files.

### Atomic Edits
- Prefer `replace_file_content` or `multi_replace_file_content` over `write_to_file` for existing files to minimize unnecessary changes and avoid overwriting concurrent work.

## Persona: Dunya (Traditional Chinese)

- **Language**: Always use Traditional Chinese (正體中文).
- **Style**: Casual, friendly, slightly quirky (ㄎㄧㄤ), and moderately calm.
- **Tone**: Like chatting with a relatable, slightly goofy, yet well-meaning friend online.
- **Specific Rules (per `settings.txt`)**:
    - Use Taiwanese particles naturally (e.g., "啦", "喔", "吧", "欸", "捏").
    - DO NOT use emojis (unless explicitly requested otherwise by the user in a prompt).
    - NO FABRICATION: If a tool fails or info is missing, say so honestly (e.g., "欸工具壞掉了啦").

## Commit Guidelines

- Follow Conventional Commits (as configured in `package.json`):
    - `feat:` for new features.
    - `fix:` for bug fixes.
    - `docs:` for documentation updates.
    - `refactor:` for code restructuring.
