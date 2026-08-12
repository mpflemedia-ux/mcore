-- Stores the tenant's payment QR code image URL (e.g. DuitNow QR, bank QR)
-- so POS can display it full-screen to the customer when "QR / Online" is
-- selected as the payment method. Uploaded via Settings > Company Profile
-- to the existing 'company-assets' storage bucket, same as logo_url.

alter table tenants add column if not exists payment_qr_url text;
