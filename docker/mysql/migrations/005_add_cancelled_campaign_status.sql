USE email_sending_project;

ALTER TABLE campaign
  MODIFY COLUMN send_status ENUM('pending', 'scheduled', 'sending', 'sent', 'failed', 'cancelled') NOT NULL DEFAULT 'pending';
