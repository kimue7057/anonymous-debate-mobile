# Next Chat Prompt

Use the prompt below in a new Codex chat to continue this work:

```text
Please continue the Instagram card news automation follow-up project in this repository.

Start by reading:
- C:\Users\user\OneDrive\문서\GitHub\anonymous-debate-mobile\README.instagram-automation.md
- C:\Users\user\OneDrive\문서\GitHub\anonymous-debate-mobile\PROMPT.instagram-automation-next-chat.md
- C:\Users\user\OneDrive\문서\GitHub\anonymous-debate-mobile\supabase-schema.sql
- C:\Users\user\OneDrive\문서\GitHub\anonymous-debate-mobile\supabaseClient.js
- C:\Users\user\OneDrive\문서\GitHub\anonymous-debate-mobile\admin\admin.js
- C:\Users\user\OneDrive\문서\GitHub\anonymous-debate-mobile\app.js

Context:
- This project is an anonymous debate app backed by Supabase.
- We want the next project to automatically turn debate results into Instagram carousel/card news posts.
- The preferred architecture is Supabase + n8n + OpenAI + image rendering + Meta Instagram publishing API.
- For MVP, prefer auto-generation plus admin approval before publishing.
- We likely need a new table such as social_posts for publish tracking.
- We want concrete implementation work, not just ideas.

Your tasks:
1. Inspect the existing codebase and summarize the current relevant architecture.
2. Propose the exact DB schema changes needed for Instagram publishing workflow.
3. Implement the first repo-side changes needed for this MVP.
4. If useful, create docs for the n8n workflow contract and slide JSON format.
5. Call out any blockers clearly, especially around Meta auth/app review requirements.

When you respond, prioritize:
- practical implementation steps
- schema and admin workflow design
- minimal-risk MVP structure
- code changes where possible
```
