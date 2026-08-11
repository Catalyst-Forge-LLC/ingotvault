@echo off
setlocal EnableExtensions
REM Optional Windows launcher for Task Scheduler / double-click.
REM Prefer a global `ingot` on PATH after: pnpm add -g git-ingot

set "SCHEDULED="
for %%A in (%*) do (
  if /I "%%~A"=="--scheduled" set "SCHEDULED=1"
)

where ingot >nul 2>&1
if errorlevel 1 (
  echo ERROR: ingot not on PATH. Install with: pnpm add -g git-ingot
  if not defined SCHEDULED pause
  exit /b 2
)

ingot %*
set "EXIT_CODE=%ERRORLEVEL%"

if not defined SCHEDULED (
  echo.
  pause
)

exit /b %EXIT_CODE%
