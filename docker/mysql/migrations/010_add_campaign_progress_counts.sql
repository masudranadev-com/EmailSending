ALTER TABLE campaign
  ADD COLUMN recipient_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER customers,
  ADD COLUMN sent_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER recipient_count,
  ADD COLUMN failed_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER sent_count,
  ADD COLUMN sending_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER failed_count,
  ADD COLUMN pending_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER sending_count;

UPDATE campaign
SET
  recipient_count = COALESCE(JSON_LENGTH(customers), 0),
  sent_count = (
    SELECT COUNT(*)
    FROM JSON_TABLE(
      customers,
      '$[*]' COLUMNS (
        mail_sent VARCHAR(20) PATH '$.mail_sent' NULL ON EMPTY NULL ON ERROR
      )
    ) AS contact_statuses
    WHERE LOWER(TRIM(mail_sent)) = 'success'
  ),
  failed_count = (
    SELECT COUNT(*)
    FROM JSON_TABLE(
      customers,
      '$[*]' COLUMNS (
        mail_sent VARCHAR(20) PATH '$.mail_sent' NULL ON EMPTY NULL ON ERROR
      )
    ) AS contact_statuses
    WHERE LOWER(TRIM(mail_sent)) IN ('failed', 'faild')
  ),
  sending_count = (
    SELECT COUNT(*)
    FROM JSON_TABLE(
      customers,
      '$[*]' COLUMNS (
        mail_sent VARCHAR(20) PATH '$.mail_sent' NULL ON EMPTY NULL ON ERROR
      )
    ) AS contact_statuses
    WHERE LOWER(TRIM(mail_sent)) = 'sending'
  ),
  pending_count = GREATEST(
    COALESCE(JSON_LENGTH(customers), 0)
    - (
      SELECT COUNT(*)
      FROM JSON_TABLE(
        customers,
        '$[*]' COLUMNS (
          mail_sent VARCHAR(20) PATH '$.mail_sent' NULL ON EMPTY NULL ON ERROR
        )
      ) AS contact_statuses
      WHERE LOWER(TRIM(mail_sent)) IN ('success', 'failed', 'faild')
    ),
    0
  );
