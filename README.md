# DiningIQ 🍽️

**AI-powered meal planning for university dining halls.**

[![Download on the App Store](https://img.shields.io/badge/Download_on_the-App_Store-0D96F6?logo=apple&logoColor=white)](https://apps.apple.com/app/diningiq/id6757298851)

DiningIQ builds personalized daily meal plans from real dining-hall nutrition data. Students complete a short onboarding (goals, body metrics, diet preferences), and the app uses LLMs to recommend meals across campus dining halls that fit their macros and dietary needs — then lets them log what they eat and track their nutrition over time.

Built for the University of Maryland dining halls (South Campus, Yahentamitsi, and 251 North), with an architecture that generalizes to any dining-hall dataset.

> **Status:** Personal project / MVP. Built with Expo (iOS + Android + web); currently published to the [iOS App Store](https://apps.apple.com/app/diningiq/id6757298851). Node/Express backend deployed on Railway.

---

## Screenshots

| Meal plans per dining hall | Meal logging & macros | Weekly analytics |
|:--:|:--:|:--:|
| ![Personalized meal recommendations at each dining hall](assets/screenshots/meal-plan.jpg) | ![Log meals and track macros](assets/screenshots/meal-logging.jpg) | ![Track weekly progress through graphs and statistics](assets/screenshots/analytics.jpg) |

---

## Features

- 🎯 **Personalized onboarding** — gender, height/weight/age, fitness goal (lose weight / maintain / build muscle), diet type (vegetarian, vegan, omnivore, keto, …), and dining frequency.
- 🤖 **AI meal-plan generation** — LLM-generated meal recommendations per dining hall, grounded in the real nutrition database, with breakfast / lunch / dinner / brunch options.
- 📊 **Macro & nutrition analytics** — weekly macro breakdowns and meal statistics.
- 📝 **Meal logging** — log meals, adjust serving sizes, and track intake against goals.
- 🔐 **Multiple sign-in options** — Google Sign-In, Apple Sign-In, and username/passcode (JWT-based).
- 📱 **Cross-platform** — one Expo codebase for iOS, Android, and web.

---

## Tech Stack

**Mobile app (root)**
- [Expo](https://expo.dev) (SDK 54) + [React Native](https://reactnative.dev) 0.81 / React 19
- [Expo Router](https://docs.expo.dev/router/introduction) — file-based routing
- [NativeWind](https://www.nativewind.dev) (Tailwind CSS for React Native)
- TypeScript

**Backend (`/backend`)**
- [Node.js](https://nodejs.org) + [Express 5](https://expressjs.com) (TypeScript)
- [Prisma ORM](https://www.prisma.io) + PostgreSQL
- JWT auth + bcrypt, Google/Apple OAuth verification
- LLM providers: OpenAI + Google Gemini (via the Vercel AI SDK)

**Infrastructure**
- Backend hosted on [Railway](https://railway.app)
- Mobile builds via [EAS](https://expo.dev/eas)
- GitHub Actions for scheduled meal generation and automated code review

---

## Project Structure

```
DiningIQ/
├── app/                    # Expo Router screens (mobile app)
│   ├── onboarding/         # gender, metrics, goal, diet, frequency
│   ├── account/            # profile, meal plan, meal logging, macros analytics
│   └── meal-option/        # meal detail view
├── components/             # Shared UI components
├── lib/                    # Client-side helpers (API client, auth)
├── assets/                 # Images, icons, fonts
├── backend/
│   └── src/
│       ├── routes/         # auth, user, mealPlan, mealLogging
│       ├── services/       # meal plan generation service
│       ├── Meal-Plan/      # batch meal-generation & dining-data scripts
│       ├── middleware/     # auth middleware
│       ├── lib/            # Prisma client
│       └── index.ts        # Express entry point
└── .github/workflows/      # scheduled jobs + CI
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- A PostgreSQL database
- API keys: OpenAI and/or Google Gemini, plus Google & Apple OAuth credentials
- **Your own dining-hall nutrition dataset** (see below) — the UMD dining data is **not** included in this repo

### 1. Backend

```bash
cd backend
npm install

# Configure environment (see below), then set up the database
npx prisma generate
npx prisma migrate dev

npm run dev        # start the API on http://localhost:3000
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-strong-random-secret
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_API_KEY=...          # for Gemini meal generation
GOOGLE_IOS_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com
APPLE_BUNDLE_ID=com.dietiq.app
PORT=3000
```

### 2. Mobile app

```bash
# from the repo root
npm install
npx expo start
```

Create `.env` in the repo root:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com
```

> `EXPO_PUBLIC_*` variables are **bundled into the client app** and are not secret. Real secrets (database URL, API keys, JWT secret) live only in the backend environment.

From the Expo dev server you can open the app in an iOS simulator, Android emulator, [Expo Go](https://expo.dev/go), or a development build.

### 3. Dining data

DiningIQ generates meal plans from a **dining-hall nutrition database** — the entrees, descriptions, and nutrition facts the LLM grounds its recommendations in. **This dataset is not included in the repo** and is specific to the University of Maryland dining halls it was built for.

To run DiningIQ against your own campus (or any dining provider), you'll need to supply your own data: populate the database with your dining halls, entrees, and nutrition info so the meal-generation prompts have something to draw from. The scripts in `backend/src/Meal-Plan/` show the expected shape and how the data feeds into generation.

---

## API Overview

The Express backend exposes a REST API. Selected endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/register`, `/login` | Username/passcode auth |
| `POST` | `/google-auth`, `/apple-auth` | OAuth sign-in |
| `POST` | `/add-metrics`, `/update-field` | Onboarding & profile |
| `POST` | `/generate-meal-plan` | Trigger AI meal-plan generation |
| `GET`  | `/get-meal-plan`, `/generation-status` | Fetch plan / poll status |
| `POST` | `/modify-meal-plan` | Regenerate or adjust a plan |
| `POST` | `/add-meal`, `DELETE /remove-meal` | Meal logging |
| `PUT`  | `/increase-serving`, `/decrease-serving`, `/update-meal` | Adjust logged meals |
| `GET`  | `/weekly-macros`, `/fetch-meal-stats` | Nutrition analytics |
| `DELETE` | `/delete-account` | Account deletion |

---

## Automated Jobs (GitHub Actions)

- **Daily meal generation** (`cron.yml`) — regenerates meal plans on a schedule.
- **Copy dining data** (`copy-dining-data.yml`) — refreshes the dining-hall nutrition dataset.
- **Claude Code Review** (`claude.yml`, `claude-code-review.yml`) — AI code review, gated to trusted contributors.
