@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Creating local virtual environment...
  py -3 -m venv .venv
  if errorlevel 1 (
    python -m venv .venv
    if errorlevel 1 (
      echo Failed to create virtual environment.
      pause
      exit /b 1
    )
  )
)

call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

if not exist ".env" (
  echo Missing .env file. Copy .env.example to .env and add your OPENAI_API_KEY first.
  pause
  exit /b 1
)

python summarize_backend.py
