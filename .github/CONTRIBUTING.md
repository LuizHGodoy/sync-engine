# Contributing to Sync Engine

Thank you for your interest in contributing to Sync Engine! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Issue Reporting](#issue-reporting)

## Code of Conduct

This project follows a Code of Conduct to ensure a welcoming environment for all contributors. Please be respectful and inclusive in all interactions.

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn or npm
- React Native/Expo development environment

### Setup

1. Fork the repository
2. Clone your fork:

   ```bash
   git clone https://github.com/your-username/sync-engine.git
   cd sync-engine
   ```

3. Install dependencies:

   ```bash
   yarn install
   ```

4. Build the library:

   ```bash
   cd packages/sync-engine-lib
   yarn build
   ```

5. Run the demo app:

   ```bash
   cd apps/demo-app
   yarn start
   ```

## Development Workflow

### Branch Naming

- `feature/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/documentation-update` - Documentation updates
- `refactor/refactor-description` - Code refactoring
- `test/test-description` - Test additions/updates

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
type(scope): description

Examples:
feat(sync): add batch synchronization support
fix(queue): resolve memory leak in queue storage
docs(readme): update installation instructions
test(sync): add unit tests for conflict resolution
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Provide proper type definitions
- Use strict type checking
- Document complex types with JSDoc comments

### Code Style

- Use descriptive variable and function names in English
- Follow existing code formatting
- Use Prettier for consistent formatting
- Use ESLint rules when available

### Error Handling

- Use proper error handling with try/catch blocks
- Provide meaningful error messages in English
- Log errors appropriately for debugging

### Documentation

- Document all public APIs
- Use JSDoc comments for functions and classes
- Keep README files up to date
- Provide examples for new features

## Testing

### Running Tests

```bash
# Run all tests
yarn test

# Run tests for specific package
cd packages/sync-engine-lib
yarn test

# Run tests in watch mode
yarn test --watch
```

### Test Guidelines

- Write unit tests for all new functionality
- Ensure good test coverage
- Test both success and error scenarios
- Use descriptive test names
- Mock external dependencies appropriately

### Test Structure

```typescript
describe("FeatureName", () => {
  describe("when condition", () => {
    it("should do expected behavior", () => {
      // Test implementation
    });
  });
});
```

## Submitting Changes

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the coding standards
3. Add or update tests as needed
4. Update documentation if necessary
5. Ensure all tests pass
6. Submit a pull request

### Pull Request Template

Use the provided PR template and fill out all sections:

- Clear description of changes
- Link to related issues
- Testing information
- Breaking changes (if any)
- Screenshots (if applicable)

### Review Process

- All PRs require at least one review
- Address reviewer feedback promptly
- Keep PRs focused and reasonably sized
- Squash commits if requested

## Issue Reporting

### Before Creating an Issue

1. Search existing issues to avoid duplicates
2. Check the documentation
3. Try the latest version
4. Provide minimal reproduction case

### Issue Types

Use the appropriate issue template:

- **Bug Report** - For bugs and unexpected behavior
- **Feature Request** - For new feature suggestions
- **Documentation** - For documentation improvements
- **Question** - For questions and support

### Bug Reports

Include:

- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Minimal code example
- Error messages and stack traces

### Feature Requests

Include:

- Clear use case description
- Proposed API or solution
- Alternative solutions considered
- Backward compatibility considerations

## Development Tips

### Debugging

- Use the demo app for testing changes
- Enable debug mode in SyncEngine
- Check network logs for sync issues
- Use React Native Debugger for mobile debugging

### Performance

- Monitor memory usage in long-running sync operations
- Test with large datasets
- Profile database operations
- Consider batch operations for performance

### Architecture

- Follow the existing patterns
- Keep components loosely coupled
- Use dependency injection where appropriate
- Document architectural decisions

## Release Process

Releases are handled by maintainers:

1. Version bump following semver
2. Update CHANGELOG.md
3. Create release notes
4. Publish to npm
5. Create GitHub release

## Getting Help

- Check existing documentation
- Search closed issues for solutions
- Ask questions in discussions
- Contact maintainers for complex issues

## Recognition

Contributors will be recognized in:

- CHANGELOG.md for significant contributions
- README.md contributors section
- Release notes for major features

Thank you for contributing to Sync Engine! 🚀
