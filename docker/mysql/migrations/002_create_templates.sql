USE email_sending_project;

CREATE TABLE IF NOT EXISTS templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(180) NOT NULL,
  email_subject VARCHAR(255) NOT NULL,
  email_from_name VARCHAR(160) NOT NULL,
  email_from_email VARCHAR(320) NOT NULL,
  email_reply_to VARCHAR(320) NULL,
  status ENUM('active', 'draft', 'archived') NOT NULL DEFAULT 'draft',
  template_body LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY templates_status_index (status),
  KEY templates_email_from_email_index (email_from_email)
) ENGINE=InnoDB;
