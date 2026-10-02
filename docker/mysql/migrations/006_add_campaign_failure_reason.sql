USE email_sending_project;

ALTER TABLE campaign
  ADD COLUMN failure_reason TEXT NULL AFTER send_error;

UPDATE campaign
SET failure_reason = send_error
WHERE failure_reason IS NULL
  AND send_error IS NOT NULL;

UPDATE campaign
SET failure_reason = 'BREVO_API_KEY is not configured, so the email provider could not send this campaign.'
WHERE send_status = 'failed'
  AND send_error LIKE '%skipped%'
  AND failure_reason = send_error;
