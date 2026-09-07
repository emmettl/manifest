# MANIFEST working agreements

- MANIFEST is an independent, unnumbered Motion Studies investigation. Keep it unlinked from the catalogue unless the user requests that change.
- Consume exact published `@motionstudies/*` versions. Do not import sibling-repository source or promote maritime-specific code into shared packages without a demonstrated reusable contract.
- All current public vessel data is synthetic. Preserve visible source labels. Do not publish raw/derived provider data without a documented publication path.
- Keep presence grids distinct from tracks. Do not infer cargo contents from vessel class, flag, destination strings or geographic proximity.
- Keep raw inputs and credentials out of Git and `public/`; observed compiler outputs are local and review-required.
- Never interpolate across separate track segments. Preserve reception gaps and dateline-safe geometry.
- Run `npm run check` for application/data changes. CI additionally verifies fixture regeneration. Pages deploys from `main` after checks pass.
- Global credential/Git rules: sandbox host-auth failures are inconclusive; retry the same read-only check once with narrow host escalation. Git mutations require host access when `.git` is read-only.
