---
name: homework-prod-audit
description: Review recent homework grading, retries and parent interventions using the Homework Check production database. Use when asked to investigate AI checking quality or homework review cases in this project.
---

# Homework production audit

Run this when the user asks to review recent production homework grading or investigate why children needed parental review. The helper reads the live database inside the running application container without copying the database or images.

## Connection and execution

From the project root, run the helper through the local SSH configuration. The configuration contains the private connection details and is ignored by Git. Use it without printing or copying its contents.

```sh
ssh -F data/homework-audit/ssh-config -o BatchMode=yes homework-audit 'docker exec -i homework-check-prod node --no-warnings - 30' < .agents/skills/homework-prod-audit/scripts/audit.cjs
```

The argument is the lookback in days, from 1 to 365; choose it based on the request. If the output exceeds the tool response limit, redirect it to a private temporary file and inspect it in sections, then remove the file after the audit. For detailed case evidence, pass `--details` after the day count. If the private config or SSH access is missing, use an existing authorized private SSH alias or connection supplied in the session; do not guess hosts or print secrets. Do not record connection values in tracked files, logs, reports, or messages. Request access only when no authorized connection works.

## Interpret results

- The helper reports child submissions and AI/parent completion separately. Assignment completion and the latest submission are snapshots; do not call the latter the first attempt or infer that parent completion proves what happened offline.
- Older versions may lack `homework_events` and newer columns. The helper checks the actual schema; lack of historical events or overwritten attempts limits what can be reconstructed. Older photos may have expired.
- `--details` includes assignment text, AI summaries, and model readings, which can contain a child's work. Use it only when needed for the requested audit, avoid unnecessary reproduction or persistent copies, and do not expose private account or connection information.
- Compare model readings and verdicts, the child-facing message, and the current code and running version before attributing a cause. Distinguish confirmed observations, missing evidence, and inference. A model's transcript is not proof of what a photo shows.
- Check recent failures in application logs when useful, but report availability and gaps. Do not dump environment variables or credentials. The helper never starts a scrape, regrades homework, modifies the database, or changes production configuration.
