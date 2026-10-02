USE email_sending_project;

CREATE TABLE IF NOT EXISTS unique_emails (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(320) NOT NULL,
  information JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_emails_email_unique (email),
  CONSTRAINT unique_emails_information_json_check CHECK (
    information IS NULL OR JSON_VALID(information)
  )
) ENGINE=InnoDB;
