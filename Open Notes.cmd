@echo off
cd /d "%~dp0"
node scripts/open.mjs
if errorlevel 1 pause
