# Support AI content pack (DRAFT)

This directory holds the first structured content pack for the Dhream Market Support AI. Every document in it is text that **already exists** in the Dhream Market repository, copied faithfully from the page it came from, with the file and line range it came from. Nothing in this pack is approved. Nothing in this pack was written by an AI.

- Pack data: [`pack.json`](./pack.json) - the documents.
- Known gaps: [`gaps.json`](./gaps.json) - the policy questions the repo does not answer yet.
- Owner review: [`review-checklist.md`](./review-checklist.md), [`conflicts.md`](./conflicts.md), [`commitments.md`](./commitments.md).
- Machine check: `node docs/support-ai-content-pack/validate.mjs`.

Base branch: `fix/support-ai-policy-alignment`
Base commit: `f978e2792cb6368d915e595e2f75eaffa9abd1ff`
Schema version: 1

## Purpose

A retriever needs text it can quote. This pack gives it text that a human has read on the live site, plus enough provenance that a reviewer can check any sentence in seconds. It exists so that the Support AI never has to invent a policy, a timeframe, a fee or a deadline.

Three things the pack deliberately does **not** contain:

1. **Anything the owner has not approved.** Every document is `status: "draft"` with `approvedBy: null` and `approvedAt: null`. The owner approves documents one at a time.
2. **Anything the repo does not already say.** Where the repo is silent, the question is recorded in [`gaps.json`](./gaps.json) instead of being filled with a plausible value.
3. **Anything the owner has deferred.** The staged cancellation policy is decided but not built, so no document states a cancellation rule and every cancellation statement found in the repo is listed in GAP-001 with its file and line.

## Schema

`pack.json` is `{ meta, documents }`.

`meta` = `{ generatedAt, baseBranch, baseCommit, documentCount, schemaVersion }`.

Each document has exactly these fields:

| field | type | meaning |
| --- | --- | --- |
| `id` | string | stable identifier, `DOC-0001` upwards |
| `topicKey` | string | stable dotted key, e.g. `faq.account.reset-password`, `policy.refund-policy.return-window` |
| `title` | string | the topic as the source names it |
| `question` | string or null | the exact question text, for FAQ entries only; `null` elsewhere |
| `audience` | string[] | any of `visitor`, `buyer`, `vendor`, `support_agent` |
| `locale` | string | `en` |
| `status` | string | always `draft` in this pack |
| `version` | number | `1` |
| `body` | string | the text, plain markdown, copied from the source |
| `sourceRefs` | object[] | `{ file, lineStart, lineEnd }` - where the body came from |
| `overlapsWith` | string[] | other document ids, or legacy knowledge-base intent ids |
| `intentHints` | string[] | v2 intent ids this document could answer |
| `flags` | string[] | review flags, see below |
| `contentHash` | string | sha256 of the body, trimmed and whitespace-collapsed |
| `effectiveFrom` | null | set when the owner approves the document |
| `reviewBy` | null | set when the owner schedules a re-review |
| `owner` | null | the accountable owner |
| `approvedBy` | null | the person who approved it |
| `approvedAt` | null | when it was approved |

### Allowed `intentHints`

`general.greeting`, `general.about_platform`, `buyer.how_to_order`, `buyer.track_order_info`, `buyer.payment_methods_info`, `buyer.delivery_info`, `buyer.returns_policy_info`, `buyer.cancellation_info`, `vendor.onboarding_guide`, `vendor.listing_guide`, `vendor.store_management_guide`, `vendor.fees_plans_info`, `vendor.payout_info_general`, `vendor.kyc_info_general`, `agent.procedure_lookup`, `account.help_general`.

`buyer.cancellation_info` and `agent.procedure_lookup` are currently unused: there is no cancellation text (GAP-001) and no agent procedure text anywhere in the repo (GAP-011).

### Allowed `flags`

| flag | meaning |
| --- | --- |
| `CONTAINS_COMMITMENT` | the body promises a timeframe, amount, outcome, eligibility or deadline |
| `CONFLICT` | another source states something different (see [`conflicts.md`](./conflicts.md)) |
| `NEEDS_OWNER_DECISION` | the owner has said this specific rule is still undecided |
| `PERSONAL_DATA_RELATED` | privacy, deletion, data export or KYC documents |
| `LEGAL_TEXT` | the text comes from the terms, privacy, refund or payment policy pages |
| `STALE_RISK` | the text carries a date or describes something that changes |

## Status lifecycle

| status | meaning |
| --- | --- |
| `draft` | extracted from the repo, not reviewed. **Every document in this pack is `draft`.** |
| `in_review` | the owner has started reviewing it. Still not quotable by the AI. |
| `approved` | the owner has approved it. Only `approved` documents may be loaded into a retrieval index. `effectiveFrom`, `approvedBy` and `approvedAt` must be set. |
| `retired` | the text is no longer true or has been replaced. Removed from the index, kept for audit. |

A document moves forward one step at a time and only by a person. The review flow is [`review-checklist.md`](./review-checklist.md): the owner fills in the **owner decision** column for each row, and that decision is what changes `status`, `owner` and `approvedBy`.

**Only the owner approves.** No document in this pack may be moved to `approved` by an agent, a script, a retriever or a test. If a document needs to change, the source page changes first, then the pack is regenerated - the pack is never edited into something the pages do not say.

## How the pack was assembled

- Bodies are copied from the source with the markup, icons, styling and navigation removed. Lists become `- ` lines, section headings become `## `, sub-headings become `### `. Numbers, timeframes, percentages and amounts are copied exactly.
- One body never mixes two topics. Each body comes from a single page section, a single FAQ entry or the single contact block.
- Every body opens with the source page's own title line (and, on the four legal pages, the `Last Updated` line) so that an excerpt is self-contained and no body falls below the 20-word floor. Those header lines are recorded as their own `sourceRefs` entry in the same file.
- FAQ answers are prefixed with their exact question, which is also stored in the `question` field.
- `contentHash` is `sha256(body.trim().replace(/\s+/g, ' '))`. Word counts are whitespace-separated tokens after removing markdown `##` and `- ` markers.
- **Email addresses and phone numbers appear in exactly one document**, `contact.support-channels` (`DOC-0165`). Everywhere else they are excluded.
- Blocks that state a cancellation rule were removed and are listed, with file and line, in GAP-001. The "Contact Us" sections of the four legal pages were removed because contact details live in the one contact document. The "Need Help?" and "Related Guides" blocks of the help pages were removed as navigation.
- `lib/support-ai/knowledge-base.ts` was used as a **secondary** source only. Where a legacy intent duplicates a page, the document id is recorded in `overlapsWith`; where the legacy text says something different, it is recorded in [`conflicts.md`](./conflicts.md). The two dynamic legacy intents (`order-status-inquiry`, `vendor-payout-status`) look up private order and payout data and are excluded from the pack entirely.

## How the pack will be used

1. **Retrieval tests first.** The pack is copied into the standalone Support AI project and used as the retrieval corpus, so that answer quality can be measured before anything touches production. At this stage the pack is read as DRAFT, and the evaluation checks whether the retriever surfaces the right document and whether the answer stays inside the approved wording.
2. **PostgreSQL later.** Once the owner has approved documents, the approved set is loaded into a `support_ai_documents` table with the same fields as here, plus the approval metadata. The retriever then only ever selects rows where `status = 'approved'` and `locale` matches the request. Draft documents stay in the repository, not in the index.

So the order is: extract, review, approve, load. Nothing is loaded before it is approved.

## The rule about AI-written text

**AI-written text must never be added to this pack.**

If the Support AI produces a sentence that is not in an approved document, that sentence is not content - it is a bug report. It does not get pasted into `pack.json`. The repair is always the same: write the sentence down on the actual site page, have the owner approve the page, then regenerate the pack from the page.

This applies to paraphrases too. A "clearer" restatement of the refund window, a friendlier summary of the payout rule, or a tidied list of return conditions is not an improvement to this pack; it is a second, unreviewed source of truth that will drift from the site. The pack is a copy of the site, not a summary of it.

The only text that may be added to a pack document is text that already exists in the repository, and the only person who may change a document's `status` to `approved` is the owner.

## Rollback

Deleting this directory, or reverting the two commits that introduced it, removes everything. The pack touches no application code, no configuration, no schema and no dependency.
