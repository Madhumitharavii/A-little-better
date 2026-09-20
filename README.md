# A Little Better

> "Don't optimize your life. Take care of it."

## About the Project

A Little Better is a personal project built for my own daily life. The application is designed around my routines, preferences, reflections, and the way I want to interact with a personal care system.

The interface, visual language, prompts, and interactions are intentionally personalized to reflect my own needs and preferences.

## Features

### Today
- Daily care checklist with an intentional "Not today" flow
- Reading tracker
- Focus timer and short reset activities
- Relationship connection prompts
- Mindful redirects for boredom and excessive scrolling
- Daily and evening reflections
- Streaks based on actual activity rather than arbitrary counters

### Week
- Weekly planning and reflection
- Small weekly actions and "little things" tracking
- Weekly view of personal activities and progress

### Toolbox
Guided reflection and reset tools for:
- Procrastination
- Overthinking
- Temper & Anger
- Self-Doubt
- Appearance & Insecurity
- Boredom and excessive scrolling
- Relationship connection
- Focus and room-reset activities

Reflections are only saved to the Journal when explicitly chosen by the user.

### Journal
- Create, edit, and delete journal entries
- Save reflections from Toolbox with their source
- Flexible journaling without forced daily entries

### Life
A personal collection for keeping track of things that matter to me:

- **Books** — reading records and Goodreads import
- **Movies** — movie records, ratings, and Letterboxd import
- **Series** — shows, seasons, and episode tracking
- **Artwork** — personal artwork collection
- **Experiences** — memorable experiences and activities
- **Wishlists** — annual vision and someday/maybe items
- **Images** — attach and manage personal images

### Personal Data & Insights
- Local data export and import
- Validation and confirmation before imported data replaces existing data
- Statistics and patterns based on stored activity
- Settings, reminders, and personalization
- Period tracking and data management

## Local-First Architecture

The application is designed to work independently of a cloud backend.

Application data is stored locally using **IndexedDB through Dexie**, with repositories separating database operations from the feature-level UI.

The PWA service worker allows the application shell to remain available offline, including after installation.

## Cloud Development

A **Supabase backend foundation** has been added for future cloud functionality, including:

- Authentication
- Database schema and Row Level Security
- Storage
- Data synchronization
- Local-to-cloud data mapping

The cloud synchronization layer is currently under development. The application continues to function as a local-first PWA without requiring Supabase configuration.

## Technologies

- **Frontend:** React, TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Local Database:** IndexedDB, Dexie
- **PWA:** vite-plugin-pwa, Service Worker
- **Cloud Backend:** Supabase *(under development)*
- **Data Import:** Goodreads, Letterboxd
- **Database Layer:** Repository pattern

## Architecture

```text
src/
├── app/                 App shell and navigation
├── db/                  Dexie database and repositories
├── features/
│   ├── today/           Daily care and check-ins
│   ├── week/            Weekly planning and reflection
│   ├── toolbox/         Reflection and reset tools
│   ├── journal/         Journal functionality
│   ├── life/            Books, movies, series, artwork, experiences
│   │                    and wishlists
│   └── me/              Settings, backups, statistics and tracking
├── lib/
│   └── sync/            Authentication and cloud synchronization
└── shared/              Reusable components and utilities
```

The UI does not access IndexedDB directly. Data access is handled through the repository layer, keeping persistence separate from feature-level code and allowing the cloud synchronization layer to evolve independently.

## Data & Privacy

The local-first version does not require an account or cloud connection.

Personal application data is stored locally on the user's device. Data can be manually exported as a JSON file and imported when needed.

## Current Status

**Actively developed.**

The core local-first application and its major features are implemented and functional. The project is continuing to evolve, with cloud authentication, synchronization, and other refinements being developed as subsequent stages.

## Running Locally

### Requirements

- Node.js 18+

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application will be available at the local URL printed by Vite, usually:

```text
http://localhost:5173
```

To access it from another device on the same network:

```bash
npm run dev -- --host
```

### Production Build

```bash
npm run build
npm run preview -- --host
```