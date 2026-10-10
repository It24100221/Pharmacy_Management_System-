# Final Startup and Recovery Guide

## Normal shared-database startup

```powershell
cd backend
npm.cmd run migrate
npm.cmd start
```

In another terminal:

```powershell
cd frontend
npm.cmd run dev
```

Open `http://localhost:3000`. Check `http://localhost:5000/api/health` before logging in.

## Isolated demo startup

Run once from the repository root:

```powershell
$env:DEMO_DB_NAME = 'pharmacy_management_demo_20261010b'
node qa-audit/prepare-demo-database.js
node qa-audit/seed-demo-database.js
```

Start a separate backend process:

```powershell
cd backend
$env:DB_NAME = 'pharmacy_management_demo_20261010b'
$env:PORT = '5002'
npm.cmd start
```

The isolated API health URL is `http://localhost:5002/api/health`. Credentials are written only to ignored `backend/.local/` handoff files.

For a browser demo against the isolated database, use a separate frontend terminal with the proxy target overridden for that process:

```powershell
cd frontend
$env:VITE_DEV_API_TARGET = 'http://localhost:5002'
npm.cmd run dev
```

## Recovery

### Port already in use

```powershell
Get-NetTCPConnection -LocalPort 5000,5001,5002,3000 -ErrorAction SilentlyContinue
```

Keep an existing process if it is healthy. Otherwise stop only the identified process and restart the matching command. Do not kill unknown processes.

### Backend stopped

Restart `npm.cmd start` from `backend`. Confirm `/api/health` returns `database: connected`.

### Frontend stopped or stale

Restart `npm.cmd run dev` from `frontend`. If the browser shows an old session, use a private window or clear site storage for `localhost:3000`; do not edit database records.

### SQL Server unavailable

```powershell
Get-Service | Where-Object { $_.Name -match 'MSSQL' }
```

Start or restart the approved SQL Server Express service using administrator access, then retry the health endpoint. Do not rerun migrations until health is available.

### Missing demo records

Do not reseed the shared database. The demo seed script is idempotent for an isolated database; if a fresh fixture is required, choose a new `pharmacy_management_demo_*` name and run prepare and seed again.

