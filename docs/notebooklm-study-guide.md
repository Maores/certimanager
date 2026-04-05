# How to Study CertiManager with NotebookLM

## What Is NotebookLM?

NotebookLM (notebooklm.google.com) is Google's AI-powered research tool. You upload documents, and it creates an AI that understands them deeply. You can ask it questions, generate summaries, create study guides, and even listen to AI-generated audio overviews.

---

## Step 1: Create a Notebook

1. Go to **notebooklm.google.com**
2. Click **New Notebook**
3. Name it "CertiManager Project"

---

## Step 2: Upload Sources

Upload these files as sources (drag and drop or use the upload button):

### Must-upload (core understanding)
| File | What It Covers |
|------|---------------|
| `docs/certimanager-project-summary.md` | Full architecture, data flow, features, tech stack |
| `src/types/database.ts` | All TypeScript types and helper functions |
| `CLAUDE.md` + `AGENTS.md` | Project rules and conventions |

### Recommended (deeper understanding)
| File | What It Covers |
|------|---------------|
| `src/app/dashboard/layout.tsx` | How the dashboard shell works (sidebar, nav, auth check) |
| `src/app/dashboard/page.tsx` | Main dashboard with stats queries |
| `src/app/dashboard/employees/page.tsx` | How employee listing + filtering works |
| `src/app/dashboard/employees/actions.ts` | How server actions handle CRUD + auth |
| `src/app/dashboard/certifications/page.tsx` | How certification listing + multi-filter works |
| `src/app/dashboard/reports/page.tsx` | How the reports/analytics page queries data |
| `src/lib/supabase/server.ts` | How Supabase client is created server-side |
| `src/lib/supabase/middleware.ts` | How auth protection works |

### Optional (specific features)
| File | What It Covers |
|------|---------------|
| `src/components/employees/employee-list-client.tsx` | Bulk select + delete pattern |
| `src/app/dashboard/import/actions.ts` | Excel parsing + bulk import |
| `src/components/layout/sidebar.tsx` | Navigation component with icon mapping |

**Tip:** NotebookLM works best with 5-15 sources. Start with the "must-upload" files, then add more as needed.

---

## Step 3: Generate an Audio Overview

After uploading sources:
1. Click the **Audio Overview** button (headphones icon)
2. NotebookLM will generate a podcast-style conversation about your project
3. Two AI hosts will discuss CertiManager's architecture, explaining concepts naturally
4. Listen during commute, exercise, or downtime

**Custom focus:** Before generating, you can add a note like:
> "Focus on explaining the data flow — how a request goes from the browser to the database and back. Also explain how authentication and data isolation work."

---

## Step 4: Ask Questions

Use the chat to ask NotebookLM questions. Good starting questions:

### Architecture questions
- "How does data flow from the browser to the database when a user adds a new employee?"
- "Explain the authentication flow step by step"
- "Why does every query include manager_id?"
- "What happens when you delete an employee? What about their certifications?"

### Feature questions
- "How does the reports page calculate compliance percentage?"
- "How do the search filters work on the certifications page?"
- "How does bulk delete work? Walk me through the code flow."
- "How does the Excel import feature parse and validate data?"

### Tech stack questions
- "What's the difference between a server component and a client component in this project?"
- "What are server actions and why does this project use them instead of API routes?"
- "How does Supabase handle authentication with Next.js?"
- "What is revalidatePath and why is it called after mutations?"

### Explain-to-others questions
- "Explain CertiManager to someone who has never seen it, in 30 seconds"
- "What would I tell a developer who is joining this project?"
- "Summarize the database schema in plain language"

---

## Step 5: Create Study Materials

Ask NotebookLM to generate:

1. **Glossary**: "Create a glossary of all technical terms used in this project"
2. **FAQ**: "Write a FAQ for someone new to this codebase"
3. **Flowcharts**: "Describe the flow of creating a new certification as a numbered list"
4. **Quiz**: "Create a 10-question quiz to test my understanding of the project architecture"
5. **Briefing doc**: "Write a 1-page briefing document I could hand to a new team member"

---

## Tips for Best Results

1. **Upload the summary file first** — It gives NotebookLM the big picture before diving into code files
2. **Ask follow-up questions** — "You mentioned server actions — give me a specific example from the code"
3. **Use "cite sources"** — NotebookLM highlights which uploaded file each answer comes from
4. **Regenerate audio** after adding new sources — The overview updates to include new material
5. **Pin important notes** — Save key insights as notes inside the notebook for quick reference
6. **Start broad, go deep** — Begin with "Give me an overview" then drill into specific features

---

## What NotebookLM Won't Know

NotebookLM only knows what you upload. It won't know about:
- The live deployed site or its current state
- Supabase dashboard configuration (RLS policies, storage buckets)
- Render deployment settings
- Git history and who made which changes
- Future plans not documented in uploaded files

For these topics, refer to the session history files in `.claude/` or ask me directly.
