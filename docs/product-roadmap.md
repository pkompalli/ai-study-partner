# StudyMate by OnCourse — Product Roadmap

## The 8-Layer Onboarding Framework

1. **Why are you here** (emotional) — "I'm falling behind" / "Big exam coming" / "Better grades" / "Can't organize myself"
2. **What are you studying** — college coursework / competitive exam / self-paced
3. **Where are you now** — timing in semester (just starting / mid-semester / final stretch / between semesters)
4. **Current resources & materials** — what they already use (Marrow, textbooks, etc.) — never position as replacement
5. **Exam dates** — pre-filled from syllabi, student confirms
6. **Study rhythm** — sessions/week (3-10), preferred times, session length (30-90min)
7. **Plan** — agent-generated, student adjusts
8. **Calendar + Start** — offer Google Calendar, start first session

Only 3-4 layers require real input from the student. The rest the agent figures out.

---

## Three Student Archetypes

**Path A: College Coursework** (current flow)
```
College → Program → Year → Agent finds courses → Syllabi → Exam dates → Schedule
```

**Path B: Competitive Exam** (NEET, UPSC, MCAT)
- Which exam + exam date → agent builds syllabus → self-assessment sliders per area
- Countdown plan with phases:
  - Phase 1: Content Review (Weeks 1-12)
  - Phase 2: Practice & Reinforce (Weeks 13-18)
  - Phase 3: Mock Exams (Weeks 19-22)

**Path C: Self-paced Learning**
- "What do you want to learn?" + optional resource (Coursera course, textbook, upload syllabus, "figure it out for me")
- Optional deadline
- Agent builds structure → study rhythm → plan

Architecture: Almost nothing changes between paths. Difference is just how agent sources course structure. Downstream identical: topics → study plan → sessions → calendar.

---

## Onboarding Tone

"Why are you here?" — like a sharp friend or good tutor would ask. Whole onboarding = sharp 2-minute conversation, not a wizard with progress bars.

| Pick | Response |
|------|----------|
| "I'm behind" | "No stress. Let's figure out where you are and close the gaps." |
| "Exams coming, not ready" | "When's the exam? Let's make every day count." |
| "Better grades" | "Good. Let's find what's holding you back and fix it." |
| "Can't organize myself" | "That's literally what I'm here for. Let's build your plan." |
| "Big exam prep" | "Long game. Let's break it into phases you can actually follow." |
| "Just exploring" | "Cool. Tell me what you're studying and I'll show you what I can do." |

Agent uses these signals:
- "Catch up" student → prioritizes gaps
- "Crunch mode" student → triages ruthlessly
- "Stay on top" student → follows syllabus week-by-week

---

## Agent Workspace Architecture

Agent runs autonomously (not request/response). Streams progress via SSE, pauses at checkpoints for student confirmation.

```
Student → creates Agent Job → orchestrator runs tasks (parallel)
  ← SSE progress streaming     → web search, PDF extract, DB writes
  → confirms at checkpoints
```

**Tables:** `agent_jobs`, `agent_tasks`

**Tool registry:** `web_search`, `web_fetch`, `extract_course`, `create_course`, `create_plan`, `calendar_read`, `calendar_write`

**Key components:**
1. Agent Jobs table (Supabase): agent_jobs (id, user_id, type, goal, status, plan JSONB), agent_tasks (id, job_id, type, status, input, output, tool_calls JSONB, parent_task_id)
2. Agent Orchestrator (server-side, long-running): breaks goal into plan, executes tasks with tools, streams via SSE, pauses at checkpoints
3. Agent UI Component: task list with live status, expandable tool calls, checkpoint modals, progress persists across page refreshes

**Build order:** Agent infrastructure → Onboarding agent → Daily study agent → Exam prep agent → Calendar integration

---

## Agent Pushiness Philosophy

**"Agent owns the information. Student owns the decision."**

| Agent SHOULD | Agent SHOULD NOT |
|---|---|
| Know what needs studying | Assume every free block = study time |
| Show a suggested plan | Auto-schedule without asking |
| Highlight "exam in 5 days, Ch4 is weak" | Send anxiety-inducing notifications |
| Respect marked personal/break time | Treat unmarked time as available |
| Let student drag/rearrange study blocks | Lock into rigid schedule |

---

## Calendar = Output, Not Input

Key insight: Most undergrads don't use calendars. Calendar is an optional power feature, not the entry point.

- **Who uses calendars:** Med/law/grad students, organized undergrads, Canvas/Blackboard auto-sync users
- **Who doesn't:** Most undergrads (know timetable by heart, mental tracking)

Flip the value proposition: "Let me put useful things IN your calendar" (delivering value) vs "Give me your calendar so I can read it" (extracting).

- Student sees plan BEFORE connecting calendar
- Calendar connect = "put these in my calendar" not "read my calendar"
- App becomes the REASON they start using a calendar
- Student moving sessions around TELLS you their real availability organically

---

## Gap Analysis

App is strong on **in-session** experience. Missing everything **around** the session:

```
MISSING              BUILT                    MISSING
Plan what to study → Schedule when → Study → Track if it's working + replan
```

### Missing Features

| Feature | Priority |
|---------|----------|
| Study planner / scheduler | P0 |
| Exam date tracking | P0 |
| Agentic onboarding | P0 |
| Agent task infrastructure | P0 |
| Readiness dashboard | P1 |
| Study rhythm / preferences | P1 |
| Google Calendar integration | P1 |
| Phased planning (NEET, UPSC) | P1 |
| Web search agent | P1 |
| Material upload + indexing | P1 |
| Study FROM my materials (professor's slides/PPTs) | P1 |
| Previous year papers / past questions | P1 |
| Professor/exam style awareness | P2 |
| Current affairs linking (UPSC) | P2 |
| Proactive nudges | P2 |

---

## User Journey Mapping — Agentic "Wow" Moments

### Journey 1: Onboarding (Day 1)
- Upload syllabus/timetable PDF → auto-extract courses, topics, exam dates
- "When is your next exam?" → countdown-aware study plan from day 1
- Auto-detect starting point based on syllabus week
- **Wow:** Student uploads one PDF, 30 seconds later has fully structured course with study plan

### Journey 2: Daily Study Session (Ongoing)
- "Start today's session" — one button, agent picks optimal topic (weakness × time since review × exam proximity × spaced repetition)
- Auto-mode switching: study → quiz → flashcard review
- Session summary + next session preview
- **Wow:** Student never has to think about what to study

### Journey 3: Homework Cycle (Weekly)
- Homework insights → study plan adjustment
- Pre-homework prep sessions
- Post-homework reinforcement (auto-generate flashcards from mistakes)
- **Wow:** App knows homework is due, preps before, fixes gaps after

### Journey 4: Exam Crunch (1-2 weeks before)
- "Exam in 10 days" mode — day-by-day revision plan weighted by weakness + importance
- Readiness score per topic — visual dashboard
- Simulated exam conditions, daily confidence check
- **Wow:** Clear personalized path to exam readiness, anxiety drops

### Journey 5: Post-Exam / Between Terms
- "How did the exam go?" → adjust understanding of knowledge
- Knowledge maintenance — light weekly spaced repetition
- Next semester prep — refreshers before new courses
- **Wow:** Continuous learning companion, not just exam tool

**ROI ranking:** Daily Study > Onboarding > Exam Crunch > Homework > Post-Exam

---

## The 6 Iterations

### Iteration 1: Exam Dates + Readiness Dashboard — "Where do I stand?" ✅ COMPLETE

- `exam_dates` table with `chapter_ids uuid[]` (empty = ALL)
- Add/edit/delete exam dates with course selector, label, date, notes
- Chapter/topic multi-select dropdown reflecting course hierarchy (Subject → Topic → Chapter)
- "All topics" toggle with exit-to-explicit-selection flow
- Countdown cards with urgency color coding (red/amber/yellow/green)
- Past exams collapsible
- 6-hour window view (3h back, 3h forward) — focused, not cluttered
- Chronological layout: Earlier today (dimmed) → Now banner → Upcoming
- Dynamic "Now" banner showing active session / current scheduled / next up
- Smart topic suggestions ranked by: exam proximity × low readiness
- Reason tags (e.g., "Exam in 7d · Not yet studied")
- Editable time picker, date picker (dd/mm/yy), duration selector (15/30/60/90m)
- Per-course readiness bars for all topics
- `study_plan_items` table with persistence (auto-save + user overrides survive reload)
- 7 performance indices (migration 010)
- "For you now" in sidebar (Zap icon) + "For you" in bottom nav

**Data sources:** attempt_answers → per-topic accuracy, topic_progress → sessions count, homework_submissions → per-topic scores, exam_dates → proximity weighting

**Pending migrations:** `009_study_plan_items.sql`, `010_performance_indices.sql`

---

### Iteration 2: "Start Studying" — Smart Session Recommendation — "What should I study now?"

Recommendation engine picks next topic based on:
- Weakest readiness score
- Closest exam date
- Longest time since last review (spaced repetition principle)
- Chapters covered by upcoming exam

**What we build:**
- Study preferences store — sessions/week, preferred duration, focus course
- "Start studying" button on dashboard → creates session for recommended topic
- Explanation: "Studying Equilibrium because your midterm covers it in 8 days and it's your weakest topic"

**Why it stands alone:** Student opens app, presses one button, starts studying the right thing. No planning UI needed. No calendar needed. Just a smart default.

**Depends on:** Iteration 1

---

### Iteration 3: Weekly Study Plan — "What's my week look like?"

**What we build:**
- `study_plans` table — weekly plan with daily session slots
- Plan generator allocates topics to days based on:
  - Readiness scores
  - Exam proximity
  - Study preferences (days/week, preferred times, duration)
  - Subject weighting (e.g., 60% Chemistry)
- Weekly plan UI:
  - Day-by-day view with subject, topic, duration
  - Drag to rearrange
  - Mark sessions as done / skipped
  - "Regenerate this week" button
- Auto-regenerate every Monday based on actual progress from prior week
- Plan adjusts when exam dates change or readiness scores shift

**Why it stands alone:** Student has a concrete weekly schedule. Combined with Iteration 2, pressing "Start" on any planned session opens the right study session.

**Depends on:** Iterations 1 + 2

---

### Iteration 4: New Conversational Onboarding — "Set everything up for me"

**What we build:**
- Conversational onboarding UI (replaces current wizard)
- All 8 layers from the framework:
  - Why are you here → What are you studying → Where are you now → Resources → Exam dates → Study rhythm → Plan → Start
- Three paths: College Coursework / Competitive Exam / Self-paced
- Web search tool — agent searches for university syllabi, exam structures
- Agent workspace UI — "watch it work" while courses are being set up
- Checkpoint system — agent pauses for student confirmation (which courses, which professor's syllabus)
- Onboarding outputs feed directly into: courses, exam dates, study preferences, first weekly plan

**Why it stands alone:** New users get the magic onboarding experience. Existing users aren't affected. The onboarding produces everything Iterations 1-3 need.

**Depends on:** Iterations 1-3

---

### Iteration 5: Google Calendar Integration — "Put it in my calendar"

**What we build:**
- Google OAuth flow (connect/disconnect in settings)
- Push: weekly plan sessions → Google Calendar events
- Pull: read existing events to avoid scheduling conflicts
- Sync: when student moves a session in-app, calendar updates; when plan regenerates, calendar updates
- Disconnect gracefully — app works fully without it

**Why it stands alone:** Students who already have Iterations 1-3 working can optionally connect their calendar. Study sessions show up as calendar events with reminders.

**Depends on:** Iteration 3

---

### Iteration 6: Ongoing Agent Behaviors — "Keep me on track"

**What we build:**
- Background agent loop — runs periodic checks
- Weekly plan auto-regeneration (Sunday night for Monday)
- Post-session plan adjustment — "You scored 90% on Equilibrium, shifting focus to Thermochemistry"
- Nudges (in-app, or push via calendar): "Exam in 3 days — your weakest topic is X"
- Post-exam reflection: "How did it go?" → adjust readiness model
- For long-horizon preps: phase transitions ("You've completed Phase 1, moving to revision mode")

**Why it stands alone:** The app goes from reactive (student opens it) to proactive (app surfaces the right thing at the right time). Each behavior works independently.

**Depends on:** Iterations 1-5

---

## "For You Now" — How It Evolves Across Iterations

| Iteration | What "For You Now" shows |
|-----------|--------------------------|
| 1 | "Your midterm is in 12 days. Equilibrium is your weakest topic." |
| 2 | "Start studying → Equilibrium (45 min)" — one tap |
| 3 | Full day schedule: "You have 3 sessions today" |
| 4 | First thing after onboarding: "Your semester is set up. Here's your first week." |
| 6 | "You scored 90% on Equilibrium yesterday. Shifting focus to Thermochemistry." |

---

## Summary

```
Iteration 1    Exam dates + readiness dashboard          ✅ COMPLETE
    ↓           "Where do I stand?"
Iteration 2    Smart session recommendation
    ↓           "What should I study now?"
Iteration 3    Weekly study plan
    ↓           "What's my week look like?"
Iteration 4    Conversational onboarding
    ↓           "Set everything up for me"
Iteration 5    Google Calendar
    ↓           "Put it in my calendar"
Iteration 6    Ongoing agent behaviors
                "Keep me on track"
```

Each iteration is useful the day it ships. Each one makes the next one more powerful.

---

## Roleplay Walkthroughs (validated the framework)

### Roleplay 1: BU Chemistry Freshman
- Wants better grades, one priority course (Chemistry 101)
- Identifies weak chapters (Molecular Geometry, Thermochemistry, Equilibrium)
- Midterm in 18 days, 7 sessions/week, 60% Chemistry focused
- Plan front-loads Chemistry, rebalances after midterm

### Roleplay 2: MBBS Intern preparing for NEET PG
- 9 months to exam, doing internship (1-2 hrs working days, 5-6 hrs days off)
- Patchy coverage across 19 subjects, uses Marrow/PrepLadder
- 3-phase plan: Cover Ground (months 1-5), Revise + Practice (months 6-7), Mock + Triage (months 8-9)
- Working days = MCQ-focused (tired), days off = content-heavy in morning

### Roleplay 3: Engineering graduate preparing for UPSC Prelims
- First attempt, 12 months, full-time prep
- Self-study with standard books (Laxmikanth, Spectrum, Shankar)
- 6 focused hours/day, morning + evening blocks
- 3-phase plan: Foundation (months 1-6), Revision + Integration (months 7-9), Test Mode (months 10-12)
- App connects newspaper reading to syllabus, queues MCQs
