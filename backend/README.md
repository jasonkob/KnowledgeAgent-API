# FastAPI OCR backend (Typhoon OCR)

This folder adds a small Python backend for OCR using `typhoon_ocr`.

## Setup

1) Create a Python venv (recommended)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2) Install deps

```powershell
pip install -r requirements.txt
```

3) Set env

- `OPENTYPHOON_API_KEY` (required)
- Optional: `CORS_ORIGINS` (comma-separated)

4) Run

```powershell
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

## API

- `GET /healthz`
- `POST /v1/ocr` (multipart form)
  - field `file`: PDF / image
  - query params: `model` (default `typhoon-ocr`), `task_type` (default `structure`)
  - PDF behavior:
    - By default, OCRs **all pages** and concatenates into a single markdown string in `text`
    - Optional: `page_num` to OCR a single page (1-indexed)

## Hook into Next.js pipeline

Set `OCR_BACKEND_URL` in your Next.js env (example: `http://127.0.0.1:8001`).

Then OCR stage will call `POST {OCR_BACKEND_URL}/v1/ocr` for PDF/image inputs.
