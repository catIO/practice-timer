# Practice Timer — User Management & Data Architecture Plan

## Auth Strategy: Supabase (separate project from Brite-Sight)

Separate Supabase project for this app. Users sign in with email/password. Same Google/Apple OAuth providers can be enabled so users share a login identity across apps without coupling infrastructure.

Same client-side patterns as Brite-Sight: `@supabase/supabase-js` with Supabase Auth, RLS policies, and Netlify Functions for privileged operations.

---

## Domain Structure

- `timer.practice-mate.app` → Timer, practice plan, log, settings (no auth required)
- `repertoire.practice-mate.app` → Repertoire manager (auth required)
- Both served from same Netlify site, subdomain detected client-side

---

## Feature Access Tiers

| Feature | Guest (no login) | Registered (free) |
|---------|:-:|:-:|
| Timer (work/break/iterations) | ✅ | ✅ |
| Sound & notifications | ✅ | ✅ |
| Quick practice plan (localStorage, single plan) | ✅ | ✅ |
| Practice log (today only, localStorage) | ✅ | ✅ |
| Settings | ✅ | ✅ |
| **Multiple saved practice plans** | ❌ | ✅ |
| **Reusable practice segments library** | ❌ | ✅ |
| **Repertoire management** | ❌ | ✅ |
| **Progress videos & scores on pieces** | ❌ | ✅ |
| **Full practice log history & analytics** | ❌ | ✅ |
| **Shareable reports (permalinks)** | ❌ | ✅ |
| **Cross-device sync** | ❌ | ✅ |
| **Data export** | ❌ | ✅ |

**Rationale:** The timer is the hook — it works immediately with zero friction. Once users want to *track* and *organize* over time, they register. Guest data migrates on sign-up (same pattern as Brite-Sight).

---

## Database Schema (Supabase / Postgres)

### `user_profiles`
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  display_name TEXT,
  instrument TEXT,
  settings JSONB DEFAULT '{}',  -- migrated from localStorage settings
  week_starts_on TEXT DEFAULT 'monday',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `practice_segments` (reusable library)
```sql
CREATE TABLE practice_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,               -- e.g. "Scales - C Major 3 octaves"
  category TEXT,                    -- e.g. "Scales", "Etudes", "Repertoire", "Sight Reading"
  default_duration_seconds INT,     -- suggested time allocation
  notes TEXT,
  repertoire_id UUID REFERENCES repertoire(id) ON DELETE SET NULL,  -- optional link
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `repertoire` (pieces library)
```sql
CREATE TABLE repertoire (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,              -- "Bach Partita No. 2 in D minor"
  composer TEXT,
  movement TEXT,                   -- optional sub-piece
  difficulty TEXT,                 -- user-defined
  status TEXT DEFAULT 'learning', -- 'learning' | 'maintaining' | 'performance-ready' | 'archived'
  start_date DATE,
  target_date DATE,               -- performance/exam date
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `repertoire_media` (progress videos & scores)
```sql
CREATE TABLE repertoire_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repertoire_id UUID REFERENCES repertoire(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  media_type TEXT NOT NULL,         -- 'video' | 'audio' | 'score' | 'image'
  storage_path TEXT NOT NULL,       -- Supabase Storage path
  label TEXT,                       -- "Week 3 run-through", "Annotated score"
  recorded_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### `practice_plans`
```sql
CREATE TABLE practice_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Practice Plan',
  description TEXT,
  is_active BOOLEAN DEFAULT false,  -- which plan is currently loaded
  items JSONB NOT NULL DEFAULT '[]', -- the nested plan tree (existing format)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `plan_segment_instances` (links segments into plans)
```sql
CREATE TABLE plan_segment_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES practice_plans(id) ON DELETE CASCADE NOT NULL,
  segment_id UUID REFERENCES practice_segments(id) ON DELETE SET NULL,
  plan_item_id TEXT NOT NULL,       -- matches the item.id in the JSONB tree
  allocated_seconds INT,
  sort_order INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### `practice_log`
```sql
CREATE TABLE practice_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  total_seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);
```

### `practice_log_details` (per-piece time)
```sql
CREATE TABLE practice_log_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  segment_id UUID REFERENCES practice_segments(id) ON DELETE SET NULL,
  repertoire_id UUID REFERENCES repertoire(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,          -- denormalized for history
  seconds INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Key Architectural Decisions

### 1. Reusable Practice Segments
- Segments are a **library** — "Scales", "Bach Partita mvt 1", "Sight reading"
- When building a plan, you pull segments from your library (or create inline)
- Changing a segment's name/defaults updates it everywhere
- Segments can optionally link to a repertoire piece

### 2. Repertoire ↔ Practice Tracking
- Each repertoire piece tracks: status, start date, target date, notes
- Media uploads (videos, photos of scores) stored in **Supabase Storage**
- Practice time automatically aggregates per repertoire piece across all plans/sessions
- Progress timeline: "You've practiced this piece 4h 23m over 12 sessions since March 1"

### 3. Guest → Registered Migration
Same pattern as Brite-Sight:
- Guest practice log (localStorage) migrates to DB on sign-up
- Guest plan migrates as a new `practice_plans` row
- Guest settings migrate to `user_profiles.settings`
- Clear localStorage after successful migration

### 4. Plans as Structured JSONB + Relational Links
- Keep the flexible nested JSONB tree (it works well for the editor)
- Add `plan_segment_instances` as a relational index into the tree
- This gives you: fast segment-level queries, time aggregation by segment/piece, without losing the rich nested editor UX

---

## Auth Implementation (matching Brite-Sight pattern)

```
client/
  src/
    contexts/
      AuthContext.tsx          -- user/session state, auth listeners
    services/
      supabaseClient.ts       -- createClient with env vars
      authService.ts          -- signUp, signIn, signOut, magic link, reset
      userMigration.ts        -- localStorage → Supabase on first login
    components/
      AuthModal.tsx           -- login/signup/magic-link UI
      ProtectedRoute.tsx      -- redirect to login for gated features

netlify/
  functions/
    utils/
      auth.ts                 -- authenticateRequest(event) helper
    delete-account.ts         -- account deletion
```

**Env vars needed:**
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   (server-side only)
```

---

## RLS Policies (all tables)

```sql
-- Standard pattern for all user-owned tables:
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own data"
  ON <table> FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## Implementation Phases

### Phase 1: Auth Foundation
- [ ] Set up Supabase project
- [ ] Add `supabaseClient.ts`, `authService.ts`, `AuthContext.tsx`
- [ ] Add `AuthModal` component (email/password + magic link)
- [ ] Add `ProtectedRoute` wrapper
- [ ] Gate navigation: show lock icons on registered-only features
- [ ] Create DB tables: `user_profiles`, `practice_plans`, `practice_log`, `practice_log_details`
- [ ] Guest → registered migration service

### Phase 2: Cloud-Synced Plans & Log
- [ ] Sync practice plans to Supabase (save on edit with debounce)
- [ ] Sync practice log to Supabase (log on timer tick)
- [ ] Multiple plans support (list, create, switch, delete)
- [ ] Full log history with date range queries

### Phase 3: Reusable Segments
- [ ] `practice_segments` table + CRUD UI
- [ ] Segment library panel (searchable, categorized)
- [ ] Drag segments from library into plan
- [ ] Time tracking aggregated by segment across sessions

### Phase 4: Repertoire
- [ ] `repertoire` table + CRUD UI (piece card with status, dates, notes)
- [ ] Link segments to repertoire pieces
- [ ] Practice time dashboard per piece (total time, session count, streak)
- [ ] Repertoire list view with status filters

### Phase 5: Media & Progress Tracking
- [ ] Supabase Storage bucket for user media
- [ ] Upload progress videos (compressed, max 2min / 100MB)
- [ ] Upload score images/PDFs
- [ ] Timeline view: videos + practice data over time per piece
- [ ] Before/after comparison view

---

## File Storage (Supabase Storage)

```
bucket: user-media
  /{user_id}/
    /videos/{repertoire_id}/{timestamp}.mp4
    /scores/{repertoire_id}/{filename}.pdf
    /images/{repertoire_id}/{timestamp}.jpg
```

RLS on bucket: users can only read/write their own `{user_id}/` prefix.

---

## Migration Path from Current App

| Current (localStorage) | New (Supabase) |
|------------------------|----------------|
| `practice-timer-settings` | `user_profiles.settings` |
| `practice-timer-plan` | `practice_plans.items` (single plan row) |
| `practice-timer-log` | `practice_log` rows |
| `practice-timer-detailed-log` | `practice_log_details` rows |

Guest mode continues to use localStorage exactly as today. Zero breaking changes for anonymous users.
