# Contributing to CriptEnv

Thank you for your interest in contributing to CriptEnv! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

### Development Setup

```bash
# Clone the repository
git clone https://github.com/criptenv/criptenv.git
cd criptenv

# Install dependencies
npm install

# Run tests
npm test

# Build CLI
npm run build
```

### Project Structure

```
criptenv/
├── cli/                  # CLI implementation (TypeScript/Node.js)
│   ├── src/
│   │   ├── commands/    # CLI commands
│   │   ├── crypto/      # Encryption logic
│   │   ├── services/    # Business logic
│   │   └── utils/       # Utilities
│   └── package.json
│
├── api/                  # FastAPI backend
│   ├── app/
│   │   ├── api/         # API routes
│   │   ├── core/        # Core config
│   │   ├── models/      # Database models
│   │   └── services/   # Business logic
│   └── requirements.txt
│
├── web/                  # Next.js frontend
│   ├── app/             # App router pages
│   ├── components/      # React components
│   └── package.json
│
├── docs/                 # Documentation
│   ├── prd/
│   ├── discovery/
│   ├── roadmap/
│   ├── specs/
│   ├── user-stories/
│   └── guidelines/
│
└── supabase/             # Database migrations
    └── migrations/
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b bugfix/issue-number
```

### 2. Make Changes

- Write code following our style guidelines
- Add/update tests
- Update documentation if needed

### 3. Commit

We use conventional commits:

```bash
git commit -m "feat: add new command"
git commit -m "fix: resolve sync conflict"
git commit -m "docs: update README"
```

### 4. Push & Create PR

```bash
git push origin feature/your-feature-name
```

Then open a Pull Request on GitHub.

## Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Formatting, no code change
- `refactor` - Code restructuring
- `test` - Adding tests
- `chore` - Maintenance tasks

**Example:**
```
feat(cli): add import command for .env files

Add support for importing existing .env files into the vault.
Supports standard .env format with comments and quotes.

Closes #123
```

## Pull Request Process

1. **Fill out PR template** completely
2. **Pass all CI checks** (tests, linting, type checking)
3. **Get 2 approvals** from maintainers
4. **Squash and merge** your commits

### PR Template

```markdown
## Summary
Brief description of changes

## Motivation
Why is this change needed?

## Changes
- Change 1
- Change 2

## Testing
How was this tested?

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console.log or debug code
- [ ] Security considerations addressed
```

## Security Contributions

### Reporting Vulnerabilities

Please report security vulnerabilities responsibly:

1. **Email**: security@criptenv.com
2. **Response**: Within 48 hours
3. **Disclosure**: After 90 days or fix deployment

### Security-Sensitive Changes

For cryptographic or authentication changes:

1. Discuss with maintainers first
2. Provide threat model analysis
3. Get security review approval
4. Document security properties

## Questions?

- **Docs**: https://docs.criptenv.com
- **Issues**: https://github.com/criptenv/criptenv/issues
- **Discussions**: https://github.com/criptenv/criptenv/discussions

---

Thank you for contributing to CriptEnv! 🔐
