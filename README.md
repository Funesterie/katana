# Katana

`katana` scans oversized Node/Express files and produces an extraction plan for routes, helpers, and service families.

It is built for situations like a 10k+ line `server.cjs` where you need a safe first pass before manual refactors.

## Install

```bash
npm i -g funesterie-katana
```

Or run it without installing:

```bash
npx funesterie-katana scan apps/server/server.cjs --stdout md
```

## What it does

- detects route declarations such as `app.get(...)`, `app.post(...)`, `app.use(...)`
- detects helper/function declarations
- groups routes by API family
- groups helpers by domain keywords such as memory, auth, mail, resources, runtime
- suggests module targets and extraction order
- emits text, markdown, and JSON reports

## Usage

```bash
katana scan apps/server/server.cjs
katana scan apps/server/server.cjs --stdout md
katana scan apps/server/server.cjs --json katana-report.json --md katana-report.md
katana scan apps/server/server.cjs --top 12 --root D:/funesterie/a11/a11backendrailway
```

## Example Output

```text
Katana report for apps/server/server.cjs
- 12640 lines
- 42 routes
- 318 helper/function declarations

Top candidate cuts
1. memory -> apps/server/src/services/memory.cjs
2. resources -> apps/server/src/services/resources.cjs
3. auth -> apps/server/src/routes/auth.cjs
```

## Exit Codes

- `0`: report generated
- `1`: invalid usage or file read failure

## Notes

Katana does not rewrite files yet. It creates a reliable cut map first so the real extraction can happen in small, testable slices.
