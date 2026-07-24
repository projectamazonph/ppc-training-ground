```markdown
# amph-v2 Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the `amph-v2` TypeScript codebase. You'll learn how to structure files, write and organize code, follow commit conventions, and run tests using vitest. This guide is ideal for contributors seeking to maintain consistency and quality in the project.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `userProfile.ts`, `orderManager.test.ts`

### Import Style
- Use **alias imports** for modules.
  - Example:
    ```typescript
    import { UserService } from '@/services/userService'
    ```

### Export Style
- Use **named exports**.
  - Example:
    ```typescript
    export function calculateTotal(price: number, tax: number): number {
      return price + tax
    }
    ```

### Commit Messages
- Follow **conventional commits**.
- Use the `fix` prefix for bug fixes.
  - Example:
    ```
    fix: correct typo in user authentication logic
    ```
- Average commit message length: ~68 characters.

## Workflows

### Running Tests
**Trigger:** When you want to run the test suite to verify code changes.
**Command:** `/run-tests`

1. Ensure all dependencies are installed.
2. Run the vitest test suite:
   ```bash
   npx vitest
   ```
3. Review the output for passing and failing tests.

### Adding a New Feature or Bug Fix
**Trigger:** When implementing a new feature or fixing a bug.
**Command:** `/start-feature`

1. Create a new branch for your work.
2. Follow coding conventions for file naming, imports, and exports.
3. Write or update tests in a corresponding `.test.ts` file.
4. Commit your changes using the conventional commit format (e.g., `fix: ...`).
5. Open a pull request for review.

## Testing Patterns

- Testing is done using **vitest**.
- Test files use the `*.test.ts` pattern and are placed alongside the code or in a `tests` directory.
- Example test file:
  ```typescript
  // userProfile.test.ts
  import { describe, it, expect } from 'vitest'
  import { getUserProfile } from './userProfile'

  describe('getUserProfile', () => {
    it('returns correct user data', () => {
      const user = getUserProfile(1)
      expect(user.id).toBe(1)
    })
  })
  ```

## Commands
| Command        | Purpose                                      |
|----------------|----------------------------------------------|
| /run-tests     | Run the vitest test suite                    |
| /start-feature | Begin work on a new feature or bug fix       |
```
