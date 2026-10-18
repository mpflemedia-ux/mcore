-- Allow all common file types in project-comments bucket, increase limit to 25 MB
UPDATE storage.buckets
SET 
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/csv', 'text/plain',
    'application/zip', 'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint'
  ]
WHERE id = 'project-comments';
