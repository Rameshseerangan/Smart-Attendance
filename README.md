<<<<<<< HEAD
# Smart Attendance & Proxy Detection System

AI-based classroom attendance automation using Face Recognition (ArcFace/InsightFace)
and Anti-Spoofing (liveness detection), built with FastAPI + MongoDB + React.

```
Capture Video/Image → Face Detection → Face Recognition → Liveness Check
                     → Attendance Processing → MongoDB → Dashboard & Reports
```

---

## Project Structure

```
smart-attendance/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/      # REST endpoints (auth, students, faculty, subjects, attendance, reports, admin_db)
│   │   ├── core/                  # config, database, security, deps (RBAC)
│   │   ├── schemas/                # Pydantic request/response models
│   │   ├── services/cv_pipeline/   # face detection, liveness, matching, orchestration
│   │   ├── jobs/                   # one-off scripts (seed_admin.py)
│   │   ├── static/uploads/         # temp storage for uploaded video/images (auto-cleaned)
│   │   └── main.py                 # FastAPI app entrypoint
│   ├── ml_models/anti_spoof/        # liveness model weights go here (see below)
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── pages/                  # route-level pages
    │   ├── components/             # reusable UI (Card, StatusBadge, ConfidenceRing)
    │   ├── layouts/                 # AppLayout (sidebar nav)
    │   ├── services/                # API client modules (axios)
    │   └── context/                 # AuthContext
    └── package.json
```

---

## Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install -r requirements.txt
# Note: torch is large. If you don't have a GPU, you can save disk space with:
#   pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

cp .env.example .env
# Edit .env and set MONGO_URI to your MongoDB Atlas connection string
# Generate a real JWT_SECRET_KEY (e.g. `openssl rand -hex 32`)

# Create the first admin account (interactive prompt):
python -m app.jobs.seed_admin

# Run the API:
uvicorn app.main:app --reload --port 8000
```

API docs (Swagger UI) will be live at **http://localhost:8000/docs** — useful for
testing endpoints directly before the frontend is wired up.

### First run — model downloads
The first time `FaceEngine` is used (i.e. the first face-related API call), InsightFace
will auto-download the `buffalo_l` model pack (~280MB) from GitHub releases. This requires
normal internet access and happens once — models are cached locally afterward at
`~/.insightface/models/`.

---

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Runs at **http://localhost:3000**, proxying `/api/*` requests to the backend at
`localhost:8000` (configured in `vite.config.js`).

---

## First-Time Usage Flow

1. Run `python -m app.jobs.seed_admin` → create your admin login.
2. Log into the frontend as admin → **Admin → Faculty** → add faculty accounts.
3. **Admin → Subjects** → create subjects, assign to faculty, set department/year/section.
4. **Admin → Students** → add students, then click **Enroll Face** on each student and
   upload 3-5 clear photos (different angles/lighting recommended).
5. Log in as faculty (or stay as admin) → **Take Attendance** → select subject, upload a
   classroom video or photo → watch live processing → attendance is auto-committed.
6. **Attendance Records** to review, or build report views against
   `/api/v1/reports/absentees` and `/api/v1/reports/defaulters`.

---

## ⚠️ Production Readiness Checklist

This is a complete, working architecture — but two things need your attention before
this is genuinely production-grade for catching real proxy attempts:

### 1. Anti-spoofing model weights (critical)
`app/services/cv_pipeline/liveness_detector.py` defines a correct **interface**
(preprocessing → CNN → live/spoof probability → threshold), but ships with
**untrained weights**. Right now it will run without crashing, but its liveness
scores are meaningless until you do one of:
- Download pretrained **Silent-Face-Anti-Spoofing** (MiniFASNetV2) weights and adapt
  the loading code in `LivenessDetector.__init__` to match their checkpoint format, or
- Fine-tune on the **CelebA-Spoof** dataset plus a sample of your own students'
  printed-photo/phone-screen spoof attempts — this institution-specific fine-tuning is
  what actually pushes accuracy toward 98%+, since generic models miss local tricks
  (specific phone models, lighting, printer paper stock).

Place the final checkpoint at `backend/ml_models/anti_spoof/minifasnet.pth`.

### 2. Face match / liveness thresholds need calibration on YOUR data
`FACE_MATCH_THRESHOLD` and `LIVENESS_THRESHOLD` in `.env` are reasonable starting
points, not tuned values. Run a pilot with 2-3 actual classroom videos, log the
similarity/liveness scores, and adjust thresholds based on real false-accept/false-reject
rates before relying on this for graded attendance.

### Other things intentionally deferred (per your "local-first" instruction)
- **Deployment** (Docker, nginx, process manager) — not addressed yet, by design.
- **Celery/Redis** — `BackgroundTasks` is sufficient for one faculty member processing
  one video at a time locally. Swap to Celery (already in requirements.txt) only when
  multiple faculty will upload concurrently and you need a real task queue.
- **MongoDB Atlas Vector Search** — current matcher is brute-force cosine over an
  in-memory cohort (fine up to several thousand students). Migrate to `$vectorSearch`
  only if you scale beyond that or need sub-millisecond lookups.

---

## Tech Stack Summary

| Layer | Technology | Why |
|---|---|---|
| Backend framework | FastAPI | async-native, automatic OpenAPI docs, Pydantic validation |
| Face detection/recognition | InsightFace (RetinaFace + ArcFace) | ~99% LFW accuracy, robust to classroom angles |
| Anti-spoofing | MiniFASNet (PyTorch) | single-frame liveness, no interactive blink-check needed |
| Database | MongoDB Atlas | flexible schema for embeddings, scales horizontally |
| Frontend | React + Tailwind CSS | component reuse across faculty/admin views |
| Auth | JWT (python-jose) + bcrypt | stateless, RBAC via role claim |
=======
# Smart-Attendance
>>>>>>> d8c4dad866967bad6c4b7e25135be450821d8ff9
