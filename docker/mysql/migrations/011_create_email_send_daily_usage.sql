CREATE TABLE IF NOT EXISTS email_send_daily_usage (
  send_date DATE NOT NULL,
  sent_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (send_date)
) ENGINE=InnoDB;

INSERT INTO email_send_daily_usage (send_date, sent_count)
SELECT DATE(sent_at) AS send_date, COUNT(*) AS sent_count
FROM campaign_email_messages
WHERE status = 'sent'
  AND sent_at IS NOT NULL
GROUP BY DATE(sent_at)
ON DUPLICATE KEY UPDATE
  sent_count = GREATEST(email_send_daily_usage.sent_count, VALUES(sent_count));
