# Test baseline - 2026-10-11

## RT-0 command baseline

Executed the pre-E2E baseline from `scripts/test.ps1` as individual steps and recorded every result without fixing failures.

| Check | Result | First failure / note |
|---|---|---|
| Backend ruff | fail | `tests\test_material_ingest_once.py:74:10: B017 pytest.raises(Exception) should be considered evil` |
| Backend black | fail | `would reformat H:\agentic-tutor\backend\tests\test_pdf_images.py` |
| Backend mypy | pass | `Success: no issues found in 35 source files` |
| Backend compileall | pass | `Listing 'app'...` |
| Backend app import | pass | `JWT_SECRET is unset in DEBUG mode; generated an ephemeral in-memory secret` |
| Backend alembic upgrade head | fail | `RuntimeError: pgvector RAG migration requires PostgreSQL` when running the script's temporary SQLite migration check |
| Backend tutor eval schema | pass | `JWT_SECRET is unset in DEBUG mode; generated an ephemeral in-memory secret` |
| Backend pytest coverage | fail | `Coverage failure: total of 34 is less than fail-under=60` |
| Backend pip-audit | pass | `No known vulnerabilities found` |
| Frontend prettier | fail | `Code style issues found in 7 files`: `BrandMark.tsx`, `DataWall.test.tsx`, `FullscreenHero.tsx`, `StudyStats.test.tsx`, `TodayPlanSkills.tsx`, `index.css`, `DashboardPage.tsx` |
| Frontend lint | pass | `npm run lint` |
| Frontend vitest | pass | `npm run test:run` |
| Frontend type-check | pass | `npm run type-check` |
| Frontend build | pass | `npm run build` |
| Frontend npm audit | pass | `npm run audit:prod` |

## RT-1 encoding verification

- Scope: `backend/**/*.py` and `frontend/src/**/*.{ts,tsx,css}`
- Method: strict UTF-8 read for each file discovered by `rg --files`
- Result: pass, 0 decode errors across 204 files
- Conclusion: the suspected Chinese mojibake issue is a terminal/display decoding problem, not source file corruption. Close this P0 without a bulk encoding repair.

## RT-2 focused validation

- `python -m compileall app/api/materials.py tests/test_material_upload_api.py tests/test_materials_api.py`: pass
- `python -m pytest tests/test_material_upload_api.py::test_background_ingest_closes_session_on_failure -q`: pass
- `python -m pytest tests/test_material_upload_api.py tests/test_materials_api.py tests/test_material_ingest_once.py -q`: pass, 8 tests / 1 warning, after starting `docker compose up -d db` and waiting for pgvector on `localhost:55432`.

## Dashboard visual refresh validation

- `cd frontend; npm run type-check`: pass
- `cd frontend; npm run lint`: pass
- `cd frontend; npm run test:run`: pass, 24 files / 79 tests
- `cd frontend; npm run build`: pass
- Browser screenshots with mocked API: `.pi-work/screenshots/dashboard-light-1920.png`, `.pi-work/screenshots/dashboard-light-390.png`, `.pi-work/screenshots/dashboard-dark-1920.png`, `.pi-work/screenshots/dashboard-dark-390.png`
- Browser DOM checks: CTA visible, calendar mentions 0, `学习统计` title count 1, `番茄钟` title count 1 in light/dark and desktop/mobile.
