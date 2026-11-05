# AGENTS.md — PayPal Guardian

## Project Overview

PayPal Guardian is an AI-powered Chrome extension designed to identify potential social engineering and phishing attempts in PayPal invoices.

The application uses Next.js, TypeScript, Tailwind CSS, Vercel AI SDK and Zod.

## Development Guidelines

- Use TypeScript and follow existing project conventions.
- Keep code simple, modular and maintainable.
- Follow ESLint and Prettier configurations.
- Avoid unnecessary dependencies, abstractions and complexity.
- Never expose API keys or sensitive credentials in client-side code.
- Treat invoice content as untrusted input.
- Validate external data and AI-generated outputs.

## Working With Me

- Work on **one task at a time**.
- Explain the proposed approach before implementing significant changes.
- Explain important technical decisions and trade-offs.
- Prefer small, focused changes over large refactors.
- Do not introduce features I haven't requested.
- Ask before making major architectural decisions.
- Help me understand the code rather than simply generating it.

## Testing

- Test new functionality and relevant edge cases.
- Do not modify unrelated code to make tests pass.
- Report what was tested and any remaining issues.
- Never claim functionality works without verification.

## AI Integration

- Use structured outputs with Zod validation.
- Keep system prompts focused and maintainable.
- Handle model errors and invalid responses gracefully.
- Evaluate false positives and false negatives.
- Never treat AI classifications as definitive proof of fraud.

## Important

Prioritise correctness, security and understanding over implementation speed.
