USE email_sending_project;

ALTER TABLE campaign
  ADD COLUMN send_status ENUM('pending', 'scheduled', 'sending', 'sent', 'failed', 'cancelled') NOT NULL DEFAULT 'pending' AFTER schedule_date,
  ADD COLUMN sent_at DATETIME NULL AFTER send_status,
  ADD COLUMN send_error TEXT NULL AFTER sent_at,
  ADD COLUMN failure_reason TEXT NULL AFTER send_error;

ALTER TABLE campaign
  ADD KEY campaign_send_status_index (send_status);
