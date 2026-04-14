# StudyMate Onboarding Framework

## What This Is

A conversational onboarding system that sets up a student's entire study life in under 2 minutes. The system asks sharp, grounded questions — each one visibly earning value — while an agent works in the background to find courses, extract syllabi, and build a personalized study plan.

The onboarding adapts to three student archetypes but follows a single underlying framework.

---

## Design Principles

1. **Conversation, not a wizard.** No step numbers, no progress bars, no "Step 3 of 8." Each screen is one question in plain language. The whole thing should feel like talking to a sharp, helpful person.

2. **Every question earns visible value.** If we ask something, the student should immediately see why — either through a parenthetical explanation or because the agent visibly starts working with that input.

3. **Students feel heard.** The first question is about THEM — not logistics. The system adapts its language, tone, and plan based on who they are and what they're going through.

4. **Compel investment without friction.** Students share information about themselves willingly because each question feels relevant, not bureaucratic. No question should trigger hesitation, boredom, or "why do they need this?"

5. **Agent does the heavy lifting.** The student provides minimal input. The agent searches the web, finds syllabi, extracts course structures, identifies exam dates, and builds the plan. The student confirms and adjusts.

6. **Respectful, not pushy.** The agent owns the information. The student owns the decision. Nothing gets scheduled or committed without the student's say.

7. **Realistic, not aspirational.** Plans respect energy levels, real availability, and the fact that things change. Rest is designed in, not an afterthought.

---

## The Three Entry Paths

Every student falls into one of three paths based on what they're preparing for. The onboarding detects this early and adapts, but all paths converge to the same output: courses set up, plan generated, sessions scheduled.

| Path | Who | Example |
|------|-----|---------|
| **College Coursework** | Currently enrolled students | Freshman at BU taking Chemistry |
| **Competitive Exam** | Preparing for a specific high-stakes exam | MBBS intern preparing for NEET PG |
| **Self-paced Learning** | Career switchers, gap year, hobbyists | Engineer learning Machine Learning |

---

## Conversation Structure

### Layer 1: Why Are You Here

**Purpose:** Emotional context. Calibrates tone, urgency, and plan shape.

**Question:** "Why are you here?"

| Answer | What it signals | How the system adapts |
|--------|----------------|----------------------|
| I'm behind and need to catch up | Anxiety, gaps exist | Gap analysis first, reassuring tone |
| Exams are coming and I'm not ready | Time pressure | Asks "when?" immediately, countdown plan |
| I want better grades this semester | Aspiration, not crisis | Asks which course(s), balanced improvement |
| Can't organize myself — need a plan | Self-awareness about discipline | Emphasizes the plan/schedule as hero output |
| Prepping for a big exam | Long-term, high stakes | Routes to competitive exam path |
| Just exploring | Low commitment | Lightweight setup, quick demo session |

**Follow-up response:** One line, conversational, that acknowledges their situation. Then moves to the next question. No motivational speeches.

---

### Layer 2: What Are You Studying

**Purpose:** Identify courses/subjects and the student's context.

This is where the three paths diverge:

#### Path A — College Coursework

| Question | Why we ask | What agent does with it |
|----------|-----------|------------------------|
| Where do you study? (University) | Find the right syllabus | Web search for university course catalog |
| What program? What year? | Narrow down courses | Filters to relevant semester |
| Which courses are you taking? (agent pre-fills, student confirms) | Exact course list | Triggers syllabus extraction per course |
| Is there one course you want to focus on, or all of them? | Prioritization | Weights the study plan accordingly |

#### Path B — Competitive Exam

| Question | Why we ask | What agent does with it |
|----------|-----------|------------------------|
| Which exam? | Identify syllabus | Looks up official exam structure |
| When is the exam? | Time horizon | Determines phase breakdown |
| First attempt or repeat? | Calibrate approach | First-timers need foundation; repeaters need targeted gaps |
| What's your background? (degree/field) | Identify existing strengths | Skips subjects where they have a base |
| Working, full-time prep, or student? | Available hours | Shapes daily pattern |
| Using any coaching/material? | Don't duplicate | App fills gaps coaching doesn't cover |

#### Path C — Self-paced Learning

| Question | Why we ask | What agent does with it |
|----------|-----------|------------------------|
| What do you want to learn? | Subject identification | Searches for course/curriculum structure |
| Any specific resource? (course, textbook, upload) | Ground content in their materials | Extracts structure from their source |
| Any deadline or open-ended? | Urgency | Deadline = phased plan; open = steady pace |

---

### Layer 3: Where Are You Now

**Purpose:** Understand current position so the plan starts from reality, not zero.

| Approach | When to use | How it works |
|----------|------------|--------------|
| Semester timeline slider | College students | "How far into the semester are you?" — slider from Week 1 to Week 16 |
| Subject-level self-assessment | Competitive exam / multi-subject | Show all subjects, student taps: Strong / Shaky / Not started |
| Weak topic selection | Single course focus | Show all chapters, student taps the ones giving them trouble |

**Key design rule:** Make self-assessment feel safe, not like a test. Use language like "tap honestly where you stand" and "no judgement — just need to know where to put the hours."

**Agent works in parallel:** While the student self-assesses, the agent is searching for syllabi and extracting course structures in the background. This overlap saves time and makes the experience feel fast.

---

### Layer 4: Current Resources and Materials

**Purpose:** Understand what the student is already using so the app complements rather than duplicates. Also opens the door for material upload — the single biggest differentiator ("MY tutor who knows MY course").

**Question:** "Are you using any resources or materials already?"

**Options adapt by path:**

#### College Coursework

| Option | What it signals | How the system adapts |
|--------|----------------|----------------------|
| Professor's slides / lecture notes | Has primary source material | Offer to upload — app teaches from THEIR slides |
| A specific textbook | Has a reference anchor | Agent can map chapters to study sessions |
| Recorded lectures (university portal) | Passive learning happening | App adds active recall on top |
| Nothing specific yet | Blank slate | App generates content from syllabus |

#### Competitive Exam

| Option | What it signals | How the system adapts |
|--------|----------------|----------------------|
| Online coaching (Marrow, Unacademy, PrepLadder, Vision IAS, etc.) | Content covered elsewhere | App focuses on scheduling, tracking, testing — not content delivery |
| Classroom coaching (Vajiram, Allen, Shankar IAS, etc.) | Structured input exists | App wraps around coaching schedule |
| Standard books (Laxmikanth, Spectrum, Guyton, etc.) | Self-directed, needs structure | App provides the plan, practice, and revision that books can't |
| Mix of things, not consistent | Has resources but no system | App becomes the organizing layer |
| Nothing structured yet | Starting from zero | App takes a larger role in content delivery |

#### Self-paced Learning

| Option | What it signals | How the system adapts |
|--------|----------------|----------------------|
| A specific online course (Coursera, MIT OCW, etc.) | Has a curriculum to follow | App maps to that curriculum's structure |
| A textbook | Chapter-based structure available | Agent extracts TOC |
| YouTube / scattered resources | No structure | App provides the structure |
| I'll upload my materials | Has custom content | Upload flow for PDFs, slides, notes |

**Follow-up (for all paths):**

> "Want to upload any materials? Slides, notes, past papers — anything you have. I'll teach from YOUR stuff, not generic content."
>
> [Upload files]  [Maybe later]

**"Maybe later" is always fine.** The app works without uploads. But students who upload materials get a visibly better experience — and this plants the seed for that.

**Design rule:** Never position the app as a replacement for what they're already using. Always position as the layer on top — the plan, the practice, the tracking, the revision scheduling that their current resources can't do.

---

### Layer 5: Exam Dates and Deadlines

**Purpose:** Anchor the plan to real dates.

**How it works:**
- Agent pre-fills dates found in syllabi or web search
- Student confirms, corrects, or fills in blanks
- Even rough dates are useful — system says so explicitly

**Display format:** Simple table per course — Midterm date, Final date, Assignment deadlines if found.

**For competitive exams:** Single exam date, but agent may identify registration deadlines, admit card dates, etc.

---

### Layer 6: Study Rhythm

**Purpose:** Understand how much time the student has and when.

Three questions, all visual/tappable:

**Question 1 — Volume:** "How many study sessions per week?"

| 3 | 5 | 7 | 10 |
|---|---|---|---|
| Light | Steady | Focused | All-in |

**Question 2 — Timing:** "When do you prefer to study?"

Checkboxes: Mornings / Afternoons / Evenings / Weekends

**Question 3 — Allocation** (if multiple courses/subjects): "How should I split the time?"

Slider from "Equal across all" to "Mostly [priority subject]" to "All [priority subject]"

**For competitive exam / long-horizon students, additional questions:**
- Hours per day (realistic, not aspirational)
- Working days vs days off pattern
- Energy-aware block preferences (e.g., "content in morning, MCQs at night")

**Parenthetical:** *(you can always change this later)* — reduces pressure on getting it "right."

---

### Layer 7: The Plan

**Purpose:** Show the student what the agent built. This is the payoff moment.

**What it contains:**
- For short-horizon (weeks): Day-by-day session schedule for the next 1–2 weeks
- For long-horizon (months): Phase overview (3 phases) + detailed Week 1 schedule

**Plan design rules:**
- Explicitly explain the reasoning: "Chemistry-heavy because your exam is closest" or "Short subjects first for quick wins"
- Show session details: Day, time, subject, specific topic, duration
- Include rest days with a note: "You'll need it" — not as an afterthought
- For long-horizon plans: acknowledge that the plan will change — "I re-plan every week based on what actually happened"

**Student action:** [Looks good →] or [Let me adjust]

"Let me adjust" opens the schedule for drag/rearrange — not a form, a direct manipulation UI.

---

### Layer 8: Calendar + Start

**Purpose:** Convert the plan into action.

**Calendar is offered as value delivery, not data extraction:**

> "Want these sessions in your Google Calendar?"
>
> [Yes, connect calendar]  [No, I'll check here]

**Why this framing works:**
- Calendar connect = "let me put useful things IN your calendar"
- Not = "give me access to read your calendar"
- Students who connect get reminders = re-engagement for free
- Students who don't connect still have the full experience in-app

**Then the final screen:**

> You're set.
>
> [Summary: courses, chapters, exams tracked, sessions/week]
>
> Your first session: [Today/Tomorrow] at [time]
> [Subject] — [Topic]
>
> [Start first session →]

The first session is always available immediately. Don't make them wait.

---

## Adaptive Behaviors

### Tone Adaptation

| Student context | Tone |
|----------------|------|
| Behind / struggling | Reassuring, no pressure, "we'll close the gaps" |
| Exam crunch | Direct, urgent but calm, "let's make every day count" |
| Aspiration / improvement | Encouraging, collaborative |
| Can't organize | Practical, "that's literally what I'm here for" |
| Long-haul prep (UPSC, NEET) | Respectful of the marathon, burnout-aware |
| Internship / working | Realistic about energy, "let's be honest about time" |
| Just exploring | Lightweight, no commitment pressure |

### Plan Adaptation

| Context | Plan shape |
|---------|-----------|
| Single exam in < 4 weeks | Daily countdown, topic triage, mock exams |
| Single course, semester-long | Weekly sessions following syllabus progression |
| Multi-course semester | Weighted allocation, priority subject gets more slots |
| Competitive exam, months out | 3-phase plan (foundation → revision → mock) |
| Working / internship alongside | Energy-aware: light sessions on work days, heavy on days off |
| Full-time preparation | Structured daily blocks with built-in rest |

### Agent Behaviors During Onboarding

| Trigger | Agent action |
|---------|-------------|
| Student names university + course | Web search for syllabus, extract structure |
| Student names competitive exam | Look up official syllabus, weightage, cutoff trends |
| Student self-assesses as "shaky" | Weight study plan toward those areas |
| Agent can't find syllabus | Offer: [Upload syllabus PDF] or [Enter topics manually] |
| Agent finds multiple syllabus versions | Checkpoint: "Which professor?" — student picks |
| Student mentions coaching platform | Acknowledge it, position app as complementary — plan, practice, tracking |
| Student mentions standard books | Map study sessions to book chapters, reference by name in schedule |
| Student uploads materials | Index and ground all sessions, questions, flashcards in their content |
| Student says "nothing structured yet" | App takes larger content delivery role, not just scheduling |
| Student mentions newspaper habit (UPSC) | Offer current affairs ↔ syllabus linking |

---

## What Onboarding Produces

By the end of the conversation, the system has:

| Output | Description |
|--------|-------------|
| **Courses** | Fully structured with topics/chapters, sourced from real syllabi |
| **Exam dates** | Anchored to real calendar, countdown-aware |
| **Student profile** | Goal, context, strengths, weak areas, available time, preferences |
| **Resource awareness** | What they're already using — coaching, books, uploads — so sessions build on top, not from scratch |
| **Study plan** | Phased (if long-horizon) or weekly (if short-horizon), weighted by weakness and exam proximity |
| **Session schedule** | Specific sessions with day, time, subject, topic, duration |
| **Calendar events** | Pushed to Google Calendar (if connected) |
| **First session** | Ready to start immediately |

---

## What Onboarding Does NOT Do

- Does not ask questions it can figure out itself (agent searches, student confirms)
- Does not require calendar access to function (calendar is optional, additive)
- Does not create an aspirational plan (respects real availability and energy)
- Does not front-load setup at the expense of time-to-value (first session is available within 2 minutes)
- Does not feel like a form, a wizard, or an enterprise onboarding flow
- Does not use jargon, motivational language, or unnecessary emojis
- Does not assume the student's schedule — suggests and lets them adjust

---

## Metrics That Matter

| Metric | What it tells us |
|--------|-----------------|
| Onboarding completion rate | Is it too long or does a question cause drop-off? |
| Time to first session start | Are we getting students to value fast enough? |
| Calendar connect rate | Is the value proposition landing? |
| Plan adjustment rate | Are our defaults good or does everyone change the plan? |
| Day 2 return rate | Did the onboarding create enough pull to come back? |
| Week 1 session completion rate | Is the plan realistic for this student's life? |
