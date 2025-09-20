# Deployment guide

This document shows how to deploy the `frontend` (Next.js) to Vercel and the `backend` (Express + algorithm executable) to a Docker-friendly host such as Render, Railway, or Fly. It includes recommended environment variables and verification steps.

## 1) Deploy frontend to Vercel

- The `frontend` is a Next.js app. Vercel has first-class support for Next.

Steps (UI):

1. Go to https://vercel.com and sign in with GitHub/GitLab/Bitbucket.
2. Import the repository `pikasonix/WAYO` (select the `main` branch).
3. For the project root path, set it to `frontend`.
4. Build Command: `npm run build` (Vercel will detect Next automatically).
5. Output Directory: leave default (Vercel handles Next output).
6. Add Environment Variables (see list below).
7. Deploy. Vercel will produce a URL like `https://<project>.vercel.app`.

Steps (CLI, optional):

1. Install Vercel CLI: `npm i -g vercel` (locally or CI).
2. From repo root run: `cd frontend && vercel` and follow prompts.

Environment variables for frontend (add these in Vercel project settings):

- NEXT_PUBLIC_API_URL — the full URL of your backend, e.g. `https://my-backend.onrender.com`.
- NEXT_PUBLIC_API_BASE_PATH — usually `/api` (default in code).
- NEXT_PUBLIC_DISABLE_SUPABASE — set to `true` to keep the local stub, or `false` if you configure Supabase.
- NEXT_PUBLIC_MAP_TILE_URL — optional, URL template for map tiles.
- NEXT_PUBLIC_MAP_ATTRIBUTION — optional.
- NEXT_PUBLIC_DEFAULT_CENTER_LAT / LNG / ZOOM — optional map defaults.
- NEXT_PUBLIC_DEFAULT_* (ants, iterations, etc.) — optional defaults used by UI.

If you use Supabase in production, you'll need:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

Note: Variables prefixed with NEXT_PUBLIC are exposed to the browser. Keep server-only secrets out of the frontend.

## 2) Prepare backend for hosting

Files added: `backend/Dockerfile` — a minimal container for the Node server.

Important considerations:

- The backend executes a local algorithm binary `PDPTW_HYBRID_ACO_GREEDY_V3.exe`. That executable is a Windows PE binary. Docker images based on Linux cannot run Windows .exe files. You have three options:
  1. Provide a Linux build of the algorithm executable (recommended for production).
  2. Run the backend on a Windows host that supports running the .exe (e.g., a VPS or Windows-based cloud VM).
  3. Recompile the algorithm for Linux and include the native binary in the container.

- For Docker-based hosts (Render, Railway, Fly), you must include a Linux-compatible executable or adapt the service to call a remote worker.

Environment variables used by backend (set these in host provider):

- PORT — port to listen on (default 3001)
- HOST — host binding (default localhost; set to 0.0.0.0 for cloud containers)
- CORS_ORIGIN — CORS origin (default `*`)
- MAX_FILE_SIZE — JSON body size limit (default `5mb`)
- ALGORITHM_EXECUTABLE — path/name of the algorithm binary (default `PDPTW_HYBRID_ACO_GREEDY_V3.exe`)
- DEFAULT_NUM_ROUTES, DEFAULT_ANTS, DEFAULT_ITERATIONS, DEFAULT_ALPHA, DEFAULT_BETA, DEFAULT_RHO, DEFAULT_TAU_MAX, DEFAULT_TAU_MIN, DEFAULT_GREEDY_BIAS, DEFAULT_ELITE_SOLUTIONS, DEFAULT_LOCAL_SEARCH_PROB, DEFAULT_RESTART_THRESHOLD — optional defaults for algorithm parameters

Health check endpoint: The server does not expose a dedicated health route; add one or use the root HTTP TCP check against the port. You can add a simple `/health` route returning 200 if needed.

### Deploy to Render (Docker)

1. Create a new Web Service on Render.
2. Connect your GitHub repo and set root to `/backend`.
3. Choose 'Docker' as the Environment (or let Render detect a Dockerfile).
4. Set Environment Variables listed above. Important: set `HOST=0.0.0.0` so Render binds to container interface.
5. If your executable is Windows-only, instead either upload a Linux binary or choose a non-container Windows host.

### Deploy to Railway (Node/Docker)

1. Create a new project on Railway and connect your Git repo.
2. For a Docker deployment, Railway will use the `backend/Dockerfile`.
3. Ensure the executable is Linux-compatible.
4. Set environment variables in Railway dashboard and deploy.

### Deploy to Fly.io

1. Install Fly CLI and follow https://fly.io/docs/ to initialize.
2. In project root run `fly launch` and choose `backend` as the path or adjust the generated `fly.toml`.
3. Ensure you provide a Linux executable and set env vars via `fly secrets set`.

## 3) Quick verification

After both services are deployed:

1. In the frontend, open the deployed Vercel URL and perform an action that triggers the backend (e.g., run the route solver UI).
2. Check the backend logs on your host (Render/Railway/Fly) for `POST /api/solve called` and for errors when running the algorithm.

Example `curl` test:

```bash
curl -X POST https://<your-backend>/api/solve \
  -H "Content-Type: application/json" \
  -d '{"instance": "<instance content>", "params": {"ants":10}}'
```

If the backend returns a 500 with an error about executing the `.exe`, see the note above about Linux vs Windows executables.

## 4) Recommended small changes (optional)

- Add a simple `/health` route to `backend/server.js` that returns 200 OK. This helps platform health checks.
- Consider packaging the algorithm as a Linux binary or adding a containerized worker that can run Windows executables via Wine (advanced, not recommended for production).

## 5) Next steps I can do for you

- Add `/health` route and update `server.js` to bind to `0.0.0.0` by default.
- Add CI workflow to automatically deploy frontend to Vercel and backend to Render/Fly.
- Create a Linux build of the algorithm if you can provide source or compile instructions.
