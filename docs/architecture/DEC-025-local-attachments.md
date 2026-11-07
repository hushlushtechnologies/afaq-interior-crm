# DEC-025 — Sprint 15 local-only attachment security policy

Status: approved by the project owner in chat on 2026-11-07 (Asia/Dubai).
Scope: Sprint 15 local validation only. This decision supersedes the historical draft DEC-025 entry in docs/requirements/OPEN_DECISIONS.md for this scope. It does not approve broader production use or an antivirus provider.

## Approved controls

- Use the existing private Supabase Storage bucket and preserve its 10 MiB (10 × 1024 × 1024 bytes) per-file limit.
- Allow only PDF (application/pdf), PNG (image/png), JPEG (image/jpeg) and WebP (image/webp). Reject SVG, HTML, executables, scripts, archives and other formats.
- Enforce size server-side before accepting an upload. Validate extension, declared MIME, actual signature and reliably detectable structural validity. Do not trust filenames or client MIME claims.
- Use a maintained image-processing library where available, bounded decoding resources, safe server-side re-encoding and metadata stripping when supported without significant architectural changes. Guard against decompression bombs.
- Use a maintained PDF parser where practical. Reject reliably detected unsupported active content. Do not automatically convert or modify PDFs, execute content or render untrusted PDF content as application HTML.
- Generate unpredictable unique object names, prevent path traversal/overwrite and store only sanitized original filenames as display metadata. Bind each attachment to an authorized lead and uploader.
- Enforce current Phase 2 RBAC/RLS. Issue short-lived signed download URLs only after authorization. Prefer PDF download behavior with safe content-type/content-disposition where controllable.
- Reject invalid uploads. Clean up partial objects on failure and never expose failed uploads. If secure quarantine is unavailable, reject rather than inventing an incomplete quarantine process.
- Record upload, download-access issuance and removal with actor, attachment, lead, action and timestamp. Do not log contents, secrets or signed URLs. Apply upload rate limits and permission checks.
- Do not send files to external antivirus, AI, scanning, document-processing or paid services. Do not increase limits or enable third-party processing without further approval.

## Scanning limitation

No antivirus/malware scanning engine is approved. Validation and re-encoding are not malware scanning and do not certify that a file is safe or malware-free. Residual malware risk must be documented. Malware scanning remains deferred to a separate security decision before broader production use. No live attachment capability is implied by this policy record alone.

## Required verification

Test all four allowed formats, unsupported extensions, MIME/signature mismatches, oversize/malformed files, unauthorized uploads/downloads, cross-lead attempts, traversal filenames, duplicate filenames, partial-upload cleanup, audit events and Storage RLS enforcement.

Preserve Sprint 13/14 functionality, existing architecture and bucket restrictions. Continue Sprint 15 only; stop for testing and owner acceptance before Sprint 16.