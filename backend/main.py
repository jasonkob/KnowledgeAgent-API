import json
import os
import tempfile
import time
from typing import Any, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Load env from backend/.env or repo-root .env (optional)
try:  # pragma: no cover
    from dotenv import load_dotenv

    _HERE = os.path.dirname(__file__)
    load_dotenv(os.path.join(_HERE, ".env"), override=False)
    load_dotenv(os.path.join(_HERE, "..", ".env"), override=False)
except Exception:
    pass

try:
    from typhoon_ocr import ocr_document
except Exception as e:
    ocr_document = None
    _IMPORT_ERROR = e
else:
    _IMPORT_ERROR = None


def _as_text(result: Any) -> str:
    """Return human-readable text; also fixes double-escaped newlines (\\n)."""
    if isinstance(result, str):
        text = result
    else:
        text = json.dumps(result, ensure_ascii=False, indent=2)

    if "\\n" in text:
        text = text.replace("\\n", "\n")
    return text


def _is_pdf(file: UploadFile) -> bool:
    name = (file.filename or "").lower()
    ctype = (file.content_type or "").lower()
    return name.endswith(".pdf") or ctype == "application/pdf"


def _count_pdf_pages(pdf_path: str) -> int:
    try:
        from pypdf import PdfReader  # type: ignore
    except Exception as e:  # pragma: no cover
        raise RuntimeError(
            "Missing dependency 'pypdf' required for multi-page PDF OCR. "
            "Run: pip install -r requirements.txt"
        ) from e

    reader = PdfReader(pdf_path)
    return len(reader.pages)


app = FastAPI(title="DocsPipeline OCR Backend", version="0.1.0")

cors_origins = os.environ.get("CORS_ORIGINS", "").strip()
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in cors_origins.split(",") if o.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/healthz")
def healthz():
    return {
        "ok": True,
        "typhoon_ocr_imported": ocr_document is not None,
        "error": str(_IMPORT_ERROR) if _IMPORT_ERROR else None,
    }


@app.post("/v1/ocr")
async def ocr_endpoint(
    file: UploadFile = File(...),
    model: str = "typhoon-ocr",
    task_type: str = "structure",
    base_url: str = "https://api.opentyphoon.ai/v1",
    api_key: Optional[str] = None,
    page_num: Optional[int] = None,
):
    if ocr_document is None:
        raise HTTPException(
            status_code=500,
            detail=f"typhoon_ocr import failed: {_IMPORT_ERROR}",
        )

    resolved_api_key = api_key or os.environ.get("OPENTYPHOON_API_KEY")
    if not resolved_api_key:
        raise HTTPException(status_code=400, detail="Missing OPENTYPHOON_API_KEY")

    start = time.time()

    suffix = os.path.splitext(file.filename or "upload")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = tmp.name
        tmp.write(await file.read())

    try:
        if _is_pdf(file):
            total_pages = _count_pdf_pages(tmp_path)

            if page_num is not None:
                if page_num < 1 or page_num > total_pages:
                    raise HTTPException(
                        status_code=400,
                        detail=f"page_num must be between 1 and {total_pages}",
                    )
                page_range = [page_num]
            else:
                page_range = list(range(1, total_pages + 1))

            page_results = []
            text_blocks: list[str] = []

            for pn in page_range:
                p_start = time.time()
                result = ocr_document(
                    tmp_path,
                    base_url=base_url,
                    api_key=resolved_api_key,
                    model=model,
                    task_type=task_type,
                    page_num=pn,
                )
                text = _as_text(result).strip()
                text_blocks.append(f"## Page {pn}\n\n{text}" if text else f"## Page {pn}\n\n")
                page_results.append(
                    {
                        "page_num": pn,
                        "text": text,
                        "result": result,
                        "elapsed_seconds": time.time() - p_start,
                    }
                )

            full_text = "\n\n---\n\n".join(text_blocks).strip() + "\n"
            elapsed = time.time() - start
            return JSONResponse(
                {
                    "text": full_text,
                    "pages_total": total_pages,
                    "pages_processed": len(page_range),
                    "page_results": page_results,
                    "elapsed_seconds": elapsed,
                    "model": model,
                    "task_type": task_type,
                }
            )

        # Images (single page)
        result = ocr_document(
            tmp_path,
            base_url=base_url,
            api_key=resolved_api_key,
            model=model,
            task_type=task_type,
        )
        text = _as_text(result)
        elapsed = time.time() - start
        return JSONResponse(
            {
                "text": text,
                "result": result,
                "elapsed_seconds": elapsed,
                "model": model,
                "task_type": task_type,
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
