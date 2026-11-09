USE email_sending_project;

CREATE TABLE IF NOT EXISTS target_clients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(320) NOT NULL,
  information JSON NULL,
  status ENUM('new', 'old') NOT NULL DEFAULT 'new',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY target_clients_email_unique (email),
  KEY target_clients_status_id_index (status, id),
  CONSTRAINT target_clients_information_json_check CHECK (
    information IS NULL OR JSON_VALID(information)
  )
) ENGINE=InnoDB;

INSERT IGNORE INTO target_clients (email, information, status, created_at, updated_at)
SELECT email, information, 'old', created_at, updated_at
FROM unique_emails;
