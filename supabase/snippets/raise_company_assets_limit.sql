-- Raise company-assets upload limit to 100 MB. Free plan may still cap at 50 MB.
UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE id = 'company-assets';
