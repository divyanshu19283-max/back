@echo off
setlocal
cd /d %~dp0
if not exist .venv (
  py -m venv .venv
)
call .venv\Scripts\activate
python -m pip install -r requirements.txt
set PYTHONPATH=%CD%
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
