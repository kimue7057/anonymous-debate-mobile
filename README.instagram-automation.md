# Instagram Card News Automation

## Goal

Build a follow-up project that automatically turns debate results into Instagram card news posts and publishes them through an automation workflow.

## Suggested Branch

- Branch name: `feature/instagram-cardnews-automation`
- If Git is available locally, create it with:

```powershell
git checkout -b feature/instagram-cardnews-automation
```

## Current Project Context

- This repository is a lightweight anonymous debate app.
- The frontend reads active debates and comments from Supabase.
- The main data sources already exist:
  - `debates`
  - `comments`
  - `ai_summaries`
- Relevant files:
  - `app.js`
  - `admin/admin.js`
  - `supabaseClient.js`
  - `supabase-schema.sql`

## What We Already Confirmed

- The existing structure fits an external automation workflow well.
- The cleanest architecture is:
  - Supabase for debate data
  - n8n for orchestration
  - OpenAI for summary/caption/card copy generation
  - HTML/CSS or template-based image rendering for slide assets
  - Meta Instagram Content Publishing API for upload
- Browser automation for Instagram upload is not recommended unless there is no official API path available for the target account setup.

## Recommended MVP

Build the first version as `auto-generate + human approval + publish`, not fully hands-off publishing.

Reason:

- Debate content may need moderation before posting.
- Generated summaries and slide copy should be reviewable.
- It reduces the first delivery risk while keeping most of the automation value.

## MVP Flow

1. Detect a finished debate.
2. Fetch the debate, visible comments, and latest AI summary from Supabase.
3. Generate card news copy:
   - title slide
   - issue summary
   - pro summary
   - con summary
   - vote/result slide
   - closing CTA slide
4. Render the slides into Instagram-sized images.
5. Save generated assets and metadata.
6. Let an admin review and approve.
7. Publish as an Instagram carousel post.
8. Store the publish result and prevent duplicate posting.

## Data / Feature Additions To Plan

- Add a table such as `social_posts` for publish tracking.
- Optional fields or tables to consider:
  - `publish_status`
  - `platform`
  - `debate_id`
  - `caption`
  - `asset_urls`
  - `published_at`
  - `external_post_id`
  - `error_message`
- Consider an admin action in the existing admin UI:
  - generate card news
  - preview assets
  - approve publish
  - republish or retry on failure

## Suggested Technical Architecture

### Option A: Recommended

- Keep the current web app focused on debate/admin features.
- Add n8n as a separate automation layer.
- Add a small render service or script that creates slide images from template data.

### Option B

- Put more of the generation logic directly inside this repo with serverless functions or a lightweight backend.

### Recommendation

Choose Option A first because it keeps concerns separated and is easier to evolve.

## Implementation Order

1. Design the `social_posts` schema.
2. Add admin-side controls for generation and approval.
3. Define the slide JSON format.
4. Build a deterministic HTML/CSS slide renderer.
5. Create the n8n workflow:
   - trigger
   - fetch data
   - generate copy
   - render images
   - await approval
   - publish to Instagram
   - save result
6. Test with one real Instagram professional account.
7. Add retry, audit logs, and failure notifications.

## Important Constraints

- Instagram publishing requirements depend on Meta app configuration and account type.
- For broader production usage, Meta permissions and app review may be required.
- Avoid committing sensitive tokens into the repo.
- Store any Meta, OpenAI, and n8n secrets securely.

## Good First Deliverable

The best first deliverable for the next session is:

- schema proposal for `social_posts`
- admin UX proposal for generate/approve/publish
- n8n workflow outline
- slide template format

## Next Chat Prompt

See `PROMPT.instagram-automation-next-chat.md`.
