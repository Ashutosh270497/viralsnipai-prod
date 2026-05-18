# V1 Known Limitations

- MP4 export queue is in memory. Run one web instance until a persistent queue is added.
- Upload route buffers files in memory. Keep `MAX_UPLOAD_MB` at 500 or lower, and lower for serverless environments unless direct-to-S3 upload is implemented.
- True large-file support requires direct-to-S3 multipart upload.
- Social publishing is not V1 unless `NEXT_PUBLIC_ENABLE_SOCIAL_PUBLISHING=true`.
- Export translation is not V1 unless `NEXT_PUBLIC_ENABLE_EXPORT_TRANSLATION=true`.
- Advanced export/editor/repurpose controls are internal unless their flags are enabled.
- Advanced Remotion rendering may require Chrome/Remotion environment tuning.
- Source quality cannot be improved beyond the input video; low-resolution uploads may export softly.
- Horizontal scaling requires persistent export jobs, distributed locks, and shared render storage.
