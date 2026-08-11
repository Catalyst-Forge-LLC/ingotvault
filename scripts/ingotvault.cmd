@echo off
setlocal EnableExtensions
REM Optional Windows launcher for Task Scheduler / double-click.
REM Prefer a global `ingotvault` on PATH after: pnpm add -g ingotvault

set "SCHEDULED="
for %%A in (%*) do (
  if /I "%%~A"=="--scheduled" set "SCHEDULED=1"
)

where ingotvault >nul 2>&1
if errorlevel 1 (
  echo ERROR: ingotvault not on PATH. Install with: pnpm add -g ingotvault
  if not defined SCHEDULED pause
  exit /b 2
)

ingotvault %*
set "EXIT_CODE=%ERRORLEVEL%"

if not defined SCHEDULED (
  echo.
  pause
)

exit /b %EXIT_CODE%
