# Rule: Update WorkDoneTillNow.md After Every Phase

## When This Rule Applies
After completing ANY phase, task, or meaningful chunk of work on the DarkIQ project.

## What You Must Do
At the end of every phase or significant task, update `/Users/avinash/Projects/MLProject/WorkDoneTillNow.md` with a new section covering:

1. **What was built** — every file created, every script written, every config added. Be specific with file paths.
2. **Every decision made** — why a tool/library/approach was chosen over alternatives. No decision is too small.
3. **Challenges faced** — any errors hit, dead ends, things that didn't work and why.
4. **How challenges were resolved** — exact fix applied.
5. **What is synthetic vs real** — clearly flag any data or values that are generated/mocked vs real.
6. **Resume talking points** — 1-3 bullet points the user can directly use on their CV or in interviews for this phase's work.
7. **What comes next** — a one-line bridge to the next phase.

## Tone & Style
- Write in plain, clear English — no jargon without explanation
- Imagine the user is reading this 6 months later before a job interview
- Every "why" must be answered — never just say what was done, always say why
- Be honest about limitations and workarounds

## Format
Use this exact heading structure for each phase entry:
```
## Phase X — [Phase Name]
**Date Completed:** YYYY-MM-DD
**Status:** ✅ Complete

### What Was Built
### Decisions Made
### Challenges & How They Were Resolved
### What Is Real vs Synthetic
### Resume Talking Points
### Up Next
```

## Important
- Never skip this update even for small changes
- This file is the user's single source of truth for interviews and portfolio reviews
- Commit this file to GitHub along with every phase commit
