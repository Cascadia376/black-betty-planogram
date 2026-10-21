# Commercial evidence — bounded second pass

This review starts from draft PR14 head `9939e8c3f197027f5dc0939b39bfceec05da64a1`.
GitHub read-only checks confirmed PR14 targets `codex/promotion-intelligence`,
and PR13 remains open at `473895b27ce314d17574f3e8f4e35cb926fbbbfc`, targeting
main. That exact PR13 commit is an ancestor of this branch. The branch deployment
guards remain unchanged. The [first-pass report](COMMERCIAL_EVIDENCE_REVIEW.md),
validation JSON and artifacts are retained as historical records.

The baseline here passed 330 tests. Independent review of the prior implementation
found three additional defects; no live source, campaign, model or hosted staging
was used to reproduce them.

| Finding | Reproduced behavior | Resulting behavior |
| --- | --- | --- |
| Browser concurrency | Two repository instances saved different workspaces at version 0; both fulfilled, both returned version 1, and the second erased the first. | The demo repository holds an exclusive origin-wide Web Lock across read, version check and write. One writer succeeds; the stale writer must reload. |
| Misleading shared acknowledgement | A shared update response containing the unchanged version, or a different valid workspace, was accepted as success. | Acknowledgement must contain exactly the next version and submitted JSON content. Object-key order may differ, as with PostgreSQL JSONB; array order and values must match. A mismatch remains unacknowledged and directs the buyer to reload before retrying. |
| Deleted-source identity | Source deletion left the opportunity `MATCHED` with its old master SKU; its retained receipt still entered a comparable batch. | New deletion clears active product identity. Comparison additionally requires a currently matched supplier/master SKU pair, excluding old saved records with this stale mapping. Historical decision receipts and campaign references remain intact. |

The first four unit assertions failed on unchanged PR14. A separate browser
counterexample then seeded the exact older deleted-source shape and showed that
fixing new deletions alone was insufficient. Both before-state results are retained
in [pass2 evidence](evidence/commercial-pass2-validation.json).

The small follow-on improvement makes comparison review usable: each opportunity
now shows the selected receipt's SKU, period, stores, fixture/observed mode,
qualification and source revision, or explicitly says no retained receipt matches
its current product identity. Buyers can see the scope differences behind a
suppressed batch score. This uses existing receipt metadata; it introduces no
new qualification, ranking, campaign or promotional-lift rules.

## Persistence boundaries

Web Locks protect cooperating updated demo tabs on the same origin. Demo writes
require a browser supporting Web Locks on HTTPS or localhost; without it, reads
and exports remain available and mutations fail before storage changes. Refresh
older demo tabs before a multi-tab rehearsal. This is not cross-device storage,
protection from manual site-data edits, or a replacement for shared database CAS.
Tests inject a deterministic lock stand-in only in isolated unit fixtures; desktop
tests use actual Chromium Web Locks and two pages in one browser context.

Shared mode still uses the existing signed-user Supabase client, buyer RLS and
version predicate. The acknowledgement check matches PR13's existing audit trigger,
which increments the version by one. No migration, table, credential, policy or
permission changes were needed. Unsupported version values fail before I/O.
A matching returned revision does not add server idempotency or authenticate source
qualification. Existing shared synthetic/qualified-receipt rejection remains in
place and the first-pass asynchronous integrity probe still passes.

The source-deletion fix changes only the inbox's current product interpretation.
It does not delete historical commercial receipts or change linked campaign
records. The current comparison helper also prevents older saved stale identity
from becoming active evidence without rewriting those records.

## Executed validation

- `npm test`: **340 passed / 56 files**, including ten new unit cases.
- `npm run typecheck`, `npm run lint`, `npm run build`: **passed**.
- Eight relevant desktop cases: **passed**, including three new cases using actual
  Web Locks, unsupported-browser refusal, new and previously saved deleted-source
  records, and the five existing Promotion Intelligence flows at 1440/1280 widths.
- `node scripts/commercial-evidence-demo.mjs`: **seven checks passed** over 1,170
  synthetic store-day rows.
- `node scripts/commercial-integrity-probe.mjs "$PWD" --assert-safe`: **passed**;
  prior scope, money and asynchronous integrity fixes remain intact.

One intermediate browser run failed because the old global text locator matched
both the new comparison detail and the retained receipt panel. The assertion now
selects the retained panel explicitly; the full relevant rerun passed. The
previous pass's hosted-staging opt-in skip remains an unexecuted live gate; this
pass did not rerun unrelated browser flows. No new dependency installation or
network access workaround was needed. The known changelog/raw-workbook/metadata
access denials were not retried.

The root coordinator independently reviewed the CAS/acknowledgement and deletion
contracts without new material findings; its separate focused test result is
recorded in the validation JSON. Full first-pass test logs are unchanged.

Rehearsal, using a separate loopback port:

```sh
VITE_DATA_ADAPTER=mock VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_SUPABASE_ANON_KEY= npm run dev -- --host 127.0.0.1 --port 5210 --strictPort
# In a second terminal:
E2E_BASE_URL=http://127.0.0.1:5210 E2E_EXTERNAL_SERVER=1 E2E_LOCAL_TRANSPORT=0 E2E_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- tests/e2e/commercial-recovery-pass2.spec.ts tests/e2e/promotion-intelligence.spec.ts --workers=1
```

[Desktop comparison after source deletion](evidence/commercial-pass2/source-deleted-comparison.png)
shows historical receipts retained while the affected opportunity has no current
comparison score.

## Remaining decisions

No new live qualification was invented. The highest-value remaining backlog gates
still need the source owner to accept complete immutable store/day evidence,
financial definitions and independent POS controls, plus a reviewed authenticated
source transport. Two-buyer shared acceptance requires the approved staging target
and the already reviewed PR13 migration/session approvals. Promotional lift still
requires qualified promotion classification and matched baseline evidence.

These commits are local and ready for root review/publication. No merge,
deployment, production migration, hosted CI, live model call, OND/floorplan change,
external communication or live campaign/retail transaction occurred.
