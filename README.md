# A Little Better

> "Don't optimize your life. Take care of it."

A private, local-first life-care app — daily care, study, reflection, people, and the things I read, watch, make and live — with gentle advice and **on-device AI** (semantic search, journal themes, weekly summaries, emotion trends and tag suggestions) that never sends my data anywhere. Installable on phone and desktop as a PWA, works fully offline, and optionally syncs across my own devices.

## About the Project

A Little Better is a personal project built for my own daily life. The application is designed around my routines, preferences, reflections, and the way I want to interact with a personal care system.

The interface, visual language, prompts, and interactions are intentionally personalized to reflect my own needs and preferences. It is meant to feel calm and encouraging — a record of life, not a performance evaluation.

**Design principles**

- **Private by default** — everything lives on the device; nothing is sent anywhere unless I turn on sync with my own account.
- **Gentle, never pushy** — "Not today" is a valid answer, streaks never shame, and advice encourages rather than nags.
- **Grounded in real data** — every suggestion the app makes explains what it noticed, so it can be trusted.

## Features

### Today
- **Thought of the Day** — 366 original thoughts on hope, fun, opportunity and rest; a new one each day, never repeating within a year
- **Today, take care of** — three gentle priorities (myself, my space, my people) that tick off as things get done and jump to where to do them
- **Care for Me** — daily basics with an intentional "Not today" flow, reading minutes, and a low-friction focus timer
- **Care Around Me** — room reset timer, nightly message check, and relationship connection (tap who you reached out to)
- **Noticed for You** — private, on-device advice (see below)
- **When I need a reset** — guided tools for procrastination, overthinking, temper, self-doubt and insecurity, plus mindful redirects for boredom and doom-scrolling
- **This Evening** — a wind-down routine and the day's reflection

### Week
- A 7-day "showing up" strip and an at-a-glance summary of what filled the week
- **Learning** — a study log:
  - Subjects with editable topics (Not started → Learning → Confident), goals and goal dates
  - A **start/stop study timer** that keeps counting even if the app is closed, with a running-timer pill on every tab
  - Manual session logging, per-topic time, and weekly / monthly / all-time totals
  - **Weekly goals** per subject — study time and/or days per week (Monday–Sunday), with progress bars
- "Little things" from the week and gentle cycle reminders

### Life
A personal collection, grouped into **My archive** and **Looking ahead**:
- **Books** — reading records, re-reads, and Goodreads CSV import
- **Movies** — watch records, ratings, rewatches, and Letterboxd import
- **Series** — shows, seasons and episode tracking
- **Artwork** and **Experiences** — with photos
- **Someday, Maybe** and **Annual Vision** — things to try, and this year's intentions

### Journal
- Free writing with mood and tags, with no streak to keep
- Reflections from the reset tools can be saved to the Journal — only when explicitly chosen

### Me
- **My People** — the people I want to stay close to, with "last connected" tracking
- Best-effort local reminders (wind-down and get-up)
- Cycle tracking with import
- **Patterns & Insights** — reading, room resets, focus time, current streaks

### Settings
- Appearance: light, dark, or match device
- Sound chimes
- Cross-device sync: sign in, change password, forgot-password flow
- JSON backup export / import with validation before anything is replaced

## On-device AI

A small language model runs **entirely in the browser**, so my writing never leaves the device. It's opt-in (Settings → On-device AI).

- **Model:** [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) sentence embeddings (384 dimensions, int8-quantized ONNX, ~23 MB), run with [Transformers.js](https://github.com/huggingface/transformers.js) / ONNX Runtime Web in a **Web Worker** so the UI never blocks.
- **Self-hosted:** the model files are served by the app itself from `public/models`, and the WebAssembly engine is copied from `node_modules` into `public/ort` at build time — no calls to Hugging Face or a CDN, and both are cached by the service worker for offline use.
- **Incremental indexing:** every journal entry, reflection, Life note and study note is embedded once and cached locally in IndexedDB (never synced); a text hash means only new or edited writing is re-embedded.

What it powers:

| Feature | How it works |
|---|---|
| 🔎 **Search by meaning** (Journal) | The query is embedded and ranked against every piece of writing by cosine similarity — "times I felt anxious before exams" finds entries that never use those words. |
| 🧵 **Journal themes** | **Spherical k-means** with k-means++ initialisation clusters the embeddings; the number of themes is chosen automatically by the **silhouette score**. Each theme is named **zero-shot** (the candidate theme name closest in meaning to the cluster centroid), with keywords from **class-based TF-IDF** and a month-by-month trend. |
| 💛 **Emotion understanding** | A **trained classifier head**: softmax (multinomial logistic) regression on the frozen sentence embeddings, trained from scratch on 270 labelled diary sentences across eight emotions (joy, calm, gratitude, sadness, anxiety, anger, loneliness, tiredness) plus an explicit *neutral* class. The weights ship with the app as a 29 KB JSON file, so nothing is trained or sent anywhere at runtime. The advisor uses this instead of its word list (which still screens for very heavy writing). |
| ✍️ **Your week in three sentences** (Week) | **Extractive summarisation**: the last 7 days of writing are split into sentences and embedded; **TextRank** (PageRank over the sentence-similarity graph) scores how central each sentence is, and **Maximal Marginal Relevance** picks three that are representative but not repetitive, gently down-weighting very short sentences. |
| 💭 **How my writing has felt** (Me) | The emotion classifier applied over time: an 8-week chart of the feelings in journal entries and reflections, tappable to see which entries made a week feel that way. |
| 🏷️ **Tag suggestions** (Journal editor) | While writing, up to three tags are suggested. Tags already in use are represented by the mean embedding of the entries carrying them — a **nearest-centroid classifier learned from my own tagging** — alongside zero-shot starter tags matched by their descriptions. |

All the ML maths — similarity search, k-means, silhouette, c-TF-IDF, TextRank, MMR, softmax regression with Adam, stratified cross-validation and tag scoring — is implemented from scratch in [`src/features/ai/ml.ts`](src/features/ai/ml.ts) and unit-tested; a separate test suite runs the real model to check that search, emotions and themes behave as expected.

### Training & evaluation

**Training** (`npm run train:emotion`, [`scripts/emotion/train.ts`](scripts/emotion/train.ts)): 270 hand-written diary sentences (30 per class) are embedded with the same on-device model, and a softmax-regression head is trained on them with cross-entropy + L2 and Adam. The L2 strength and an optional confidence threshold are chosen by **5-fold stratified cross-validation on the training data only** (best: L2 = 0.003, no threshold — CV accuracy 83.7%, macro-F1 0.835). A **leakage check** aborts training if any training sentence is a near-duplicate of a test sentence (cosine ≥ 0.9; the closest pair is 0.82).

**Evaluation** (`npm run eval`): a held-out set of **90 diary-style sentences** (10 per emotion plus 10 neutral), labelled by hand before running any model and never used for training or tuning — including indirect phrasing (*"My phone was silent all day"*) and negation.

| | Accuracy | Macro-F1 |
|---|---|---|
| Word-list baseline (the advisor's original keyword matching) | 31.1% | 0.317 |
| v1 — few-shot prototype classifier (4 example sentences per emotion) | 73.3% | 0.747 |
| **v2 — trained softmax-regression head** | **82.2%** | **0.824** |

Test accuracy (82.2%) closely matches cross-validation (83.7%), so the head isn't overfitting its training sentences. Per class (v2):

| Class | Precision | Recall | F1 |
|---|---|---|---|
| joy | 1.00 | 0.80 | 0.89 |
| calm | 0.64 | 0.90 | 0.75 |
| gratitude | 0.90 | 0.90 | 0.90 |
| sadness | 0.82 | 0.90 | 0.86 |
| anxiety | 0.80 | 0.80 | 0.80 |
| anger | 0.88 | 0.70 | 0.78 |
| loneliness | 0.78 | 0.70 | 0.74 |
| tiredness | 1.00 | 0.80 | 0.89 |
| neutral | 0.75 | 0.90 | 0.82 |

The biggest gain came from giving *neutral* its own class instead of a similarity cut-off, which fixed most of v1's "mild feeling read as neutral" errors. The remaining confusions are between genuinely close feelings — loneliness ↔ calm/sadness, anger ↔ gratitude/calm — where a single sentence can honestly be read either way. The set is small and self-written, so these numbers show relative improvement rather than a general benchmark.

## Noticed for You — the on-device advisor

A rule-based advisor that runs entirely on the device (no AI service, no network) and turns my own logs into a couple of gentle pieces of advice a day. Every piece of advice comes with a **"Because…"** line showing exactly what it noticed.

- **What it looks at:** study sessions and weekly goals, watching vs. focused time, binge-watching, doom-scrolling and boredom taps, reading and movement habits, gaps since an experience, artwork or contacting someone, Annual Vision progress, and themes in the journal and reflections (read with a small on-device word list that handles simple negation like "didn't cry").
- **Examples:**
  - *"I noticed last week's goals for Japanese and Aptitude didn't quite happen. That's okay — maybe aim for a little more this week. You wanted to 'Visit Japan' — a little Japanese brings that closer."*
  - *"You've caught yourself scrolling a few times. Try putting your phone in another room for one hour today."* — Because: 5 taps this week, 5 late at night.
- **Never repetitive:** picks are made once a day, the same advice rests for several days unless the data behind it changes, each kind has several wordings, and "Not helpful" quiets that kind of advice for a month.
- **Careful with heavy days:** if journal writing sounds very heavy, it offers support and suggests reaching out to someone trusted — never advice.
- Reachable from any tab via the **🧭 Noticed** button, with a dot when there's something new.

## Architecture

### Local-first

All data lives in **IndexedDB through Dexie**. Feature code never touches the database directly — it goes through a repository layer (`src/db/repositories`), which keeps persistence in one place and lets sync evolve independently. The PWA service worker keeps the app available offline, including after installation.

### Optional cross-device sync (Supabase)

When configured and signed in, data syncs between my own devices through Supabase (Postgres + Row Level Security + Storage). The app keeps working fully offline; sync catches up when it can.

- **Push, then pull, per table** — local-only data always reaches the account before anything could be pulled over it, so an empty account can never wipe a device.
- **Last-write-wins per row**, using each record's own `updatedAt`.
- **Two clocks, never mixed** — pushes compare against this device's clock; pulls use per-table cursors on the **server-assigned** `synced_at`, so a device with a wrong clock can't miss another device's changes. A small overlap window catches late-committing writes.
- **Deletes propagate** — soft deletes for most tables; tombstones for tables that hard-delete locally (care entries, images), plus Storage cleanup for photos.
- **Duplicate resolution** — if the same care item is ticked on two devices before syncing, the newer record wins everywhere.
- Study subjects and sessions reuse the existing `life_items` table (fields in a JSONB payload), so the feature needed no schema migration; each study session is its own row, so concurrent logging on two devices can't overwrite either.

See [`supabase/README.md`](supabase/README.md) for the schema, migrations and design notes.

### Project structure

```text
src/
├── app/                 App shell, navigation, theming
├── db/                  Dexie database, schema and repositories
├── features/
│   ├── today/           Daily care, Thought of the Day, evening
│   ├── week/            Week overview
│   ├── study/           Learning: subjects, timer, sessions, weekly goals
│   ├── advisor/         "Noticed for You" rules, selection and UI
│   ├── ai/              On-device AI: model worker, embeddings, ML maths, search, themes
│   ├── toolbox/         Reflection and reset tools
│   ├── journal/         Journal
│   ├── life/            Books, movies, series, artwork, experiences, wishlists
│   ├── people/          My People
│   ├── me/              Reminders, cycle tracking, patterns
│   └── settings/        Appearance, sync account, backups
├── lib/sync/            Supabase auth and the sync engine
└── shared/              Reusable components, hooks and utilities
tests/                   Vitest suites (sync, advisor, study, goals, AI maths, real-model checks)
public/models/           The on-device language model (served by the app)
scripts/                 Build helpers (copies the ONNX Runtime engine into public/ort)
  emotion/               Emotion training data and training script
supabase/                SQL migrations and sync documentation
```

## Technologies

- **Frontend:** React 18, TypeScript
- **Build tool:** Vite
- **Styling:** Tailwind CSS with a CSS-variable palette (light and dark)
- **Local database:** IndexedDB via Dexie
- **PWA:** vite-plugin-pwa, Workbox service worker
- **Cloud (optional):** Supabase — Auth, Postgres with Row Level Security, Storage
- **On-device AI:** Transformers.js, ONNX Runtime Web (WebAssembly), all-MiniLM-L6-v2
- **Testing:** Vitest with fake-indexeddb
- **Imports:** Goodreads and Letterboxd CSV

## Testing

```bash
npm test        # everything
npm run eval    # just the emotion-classifier evaluation
npm run train:emotion   # retrain the emotion head (writes src/features/ai/emotionHead.json)
```

The suites run the real sync engine against an in-memory database and a mock Supabase that assigns its own server timestamps — covering first sync, conflicts, delete propagation, duplicate resolution, clock skew, and error messages — plus the advisor's rules and non-repetition, the study log, weekly goals, the daily-thought rotation, the ML maths (clustering, silhouette, keywords, emotion prototypes, softmax regression), and the real on-device model (meaning search, emotion reading — including negation like "didn't cry" — and theme grouping).

## Data & Privacy

- No account or network connection is needed; all personal data stays on the device by default.
- Sync is opt-in and uses my own Supabase project, with Row Level Security so each account can only ever read its own rows.
- The advisor and on-device AI run locally and never send anything anywhere; embeddings stay on each device and are never synced.
- Data can be exported to and restored from a JSON backup at any time.

## Running Locally

### Requirements

- Node.js 18+

### Install and run

```bash
npm install
npm run dev
```

The app will be available at the local URL printed by Vite, usually `http://localhost:5173`. To open it from another device on the same network:

```bash
npm run dev -- --host
```

### Optional: cross-device sync

Copy `.env.example` to `.env.local` and fill in your own Supabase project URL and public anon key, then apply the migrations in `supabase/migrations` (see [`supabase/README.md`](supabase/README.md)). Without these values the app runs fully local.

### Production build

```bash
npm run build
npm run preview -- --host
```

## Roadmap

- **Personal pattern model** — a small model trained only on my own data, on-device, to surface what actually helps my mood and routines
- Hosting and installing on phone and desktop

## Credits

- [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) by the Sentence-Transformers project (Apache 2.0), via the [Xenova ONNX conversion](https://huggingface.co/Xenova/all-MiniLM-L6-v2).
- [Transformers.js](https://github.com/huggingface/transformers.js) by Hugging Face (Apache 2.0).
