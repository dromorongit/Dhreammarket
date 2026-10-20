# Baseline - Dhream Market payout & refund money paths

Recorded **before** any change was made to the repository, so the numbers below
describe the state of the codebase that the new characterization tests were
written against.

## Environment

| Item | Value |
| --- | --- |
| Date | 2026-10-20 |
| Node version | v24.15.0 |
| npm version | 12.0.2 |
| OS | win32 |
| Git commit | `e615ffe0bf3986bb61120127a3f5c70093a7b853` |
| Git branch | `feature/seller-os-money-view` |
| Working tree at baseline | clean (`git status --porcelain` produced no output) |
| Test runner | vitest 4.1.10 |
| Coverage provider | `@vitest/coverage-v8` 4.1.10 (installed) |
| Database | none - no test in this repository opens a database connection |

## Command results

| # | Command | Exit code | Result |
| --- | --- | --- | --- |
| 1 | `npx tsc --noEmit` | 0 | PASS - no type errors, no output |
| 2 | `npm run lint` (`next lint`) | 0 | PASS - `✔ No ESLint warnings or errors` |
| 3 | `npx vitest run` | 0 | PASS - **80 test files passed, 917 tests passed, 0 failed, 0 skipped** (duration 163.19s) |
| 4 | `npx vitest run --coverage lib/refunds` | 1 | Threshold failure caused by running a subset - see below. The `lib/refunds` coverage numbers themselves are healthy. |

Raw output of command 3:

```
 RUN  v4.1.10 C:/Users/Dromor Narh/Desktop/GithubRepos/Dhreamarket

 Test Files  80 passed (80)
      Tests  917 passed (917)
   Start at  02:07:53
   Duration  163.19s (transform 10.78s, setup 0ms, import 50.64s, tests 29.41s, environment 67ms)
```

## Pre-existing failing or skipped tests

**There are none.**

- Failing tests: **0**
- Skipped tests: **0**
- Todo tests: **0**
- `describe.skip` / `it.skip` blocks: **0**

Every one of the 80 test files and 917 tests passed on the baseline commit. The
suite is green before any of this work started.

### Flakiness

No flaky-looking tests were observed. The single full-suite run completed with
no retries, no timeouts (the configured `testTimeout` is 30 000 ms and the
slowest test finished far below it) and no "retry" notices in the output. This
is a single observation, not a statistical claim - a second run was not made
because the baseline suite has no known flaky candidates to watch.

## Notes on command 4 (`npx vitest run --coverage lib/refunds`)

The coverage package **is** installed, so the command was run. It produced a
non-zero exit code, but only because of how the coverage thresholds in
`vitest.config.ts` are scoped:

```
coverage: {
  include: ['lib/**/*.ts', 'app/api/**/*.ts'],
  thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
}
```

The `include` list spans the whole `lib/` and `app/api/` trees, but the command
only executed the `lib/refunds` tests, so every other file was reported as 0%
covered and the **global** threshold check failed:

```
ERROR: Coverage for lines (2.13%) does not meet global threshold (85%)
ERROR: Coverage for functions (3.17%) does not meet global threshold (85%)
ERROR: Coverage for statements (2.22%) does not meet global threshold (85%)
ERROR: Coverage for branches (2.09%) does not meet global threshold (85%)
```

The coverage actually achieved **inside `lib/refunds`** is the meaningful
number:

| File | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| `lib/refunds` (directory) | 89.68% | 79.54% | 91.30% | 91.82% |
| `lib/refunds/process-refund.ts` | 93.13% | 75.00% | 89.28% | 93.54% |
| `lib/refunds/refund-email.ts` | 96.15% | 81.48% | 100% | 100% |
| `lib/refunds/refund-service.ts` | 87.46% | 80.08% | 91.42% | 90.23% |

This threshold error is a **pre-existing artefact of running a filtered
coverage command**, not a repository failure: the same command on the full
suite is what the `npm run test:coverage` script does, and the failure comes
from the untouched files outside `lib/refunds` being reported at 0%.

## Statement

**All of the results above were produced on the unmodified baseline commit
`e615ffe` with a clean working tree. Every failure and threshold error listed
in this document existed before any file was added or changed by this task.
No production code, configuration file or existing test file was modified.**
