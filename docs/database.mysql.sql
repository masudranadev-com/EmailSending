CREATE DATABASE IF NOT EXISTS email_sending_project
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE email_sending_project;

CREATE TABLE IF NOT EXISTS `user` (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY user_username_unique (username)
) ENGINE=InnoDB;

INSERT INTO `user` (username, password_hash)
VALUES (
  'admin',
  'scrypt$16384$8$1$default-admin-v1$bb574d19fd70be487cdf6165e8d5303a3fab6250306148cded3ab0140c531c6e690fe48fa88897c324668656092a01d497de9ab23d83294e6d5ca6025bb45358'
)
ON DUPLICATE KEY UPDATE username = VALUES(username);

CREATE TABLE IF NOT EXISTS campaign (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(180) NOT NULL,
  customers JSON NOT NULL,
  template_id BIGINT UNSIGNED NULL,
  subject VARCHAR(255) NOT NULL,
  from_name VARCHAR(160) NOT NULL,
  from_email VARCHAR(320) NOT NULL,
  reply_to VARCHAR(320) NULL,
  is_schedule BOOLEAN NOT NULL DEFAULT FALSE,
  schedule_date DATETIME NULL,
  send_status ENUM('pending', 'scheduled', 'sending', 'sent', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  sent_at DATETIME NULL,
  send_error TEXT NULL,
  failure_reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY campaign_template_id_index (template_id),
  KEY campaign_schedule_date_index (schedule_date),
  KEY campaign_is_schedule_index (is_schedule),
  KEY campaign_send_status_index (send_status),
  CONSTRAINT campaign_customers_json_check CHECK (JSON_VALID(customers))
) ENGINE=InnoDB;

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

CREATE TABLE IF NOT EXISTS campaign_email_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_id BIGINT UNSIGNED NOT NULL,
  customer_unique_id VARCHAR(120) NOT NULL,
  customer_email VARCHAR(320) NOT NULL,
  business_name VARCHAR(255) NULL,
  direction ENUM('outbound') NOT NULL DEFAULT 'outbound',
  message_type ENUM('initial', 'follow_up') NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body LONGTEXT NULL,
  status ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  provider ENUM('brevo_api', 'brevo_smtp') NOT NULL,
  provider_message_id VARCHAR(255) NULL,
  rfc_message_id VARCHAR(255) NULL,
  parent_message_id VARCHAR(255) NULL,
  thread_root_message_id VARCHAR(255) NULL,
  references_header TEXT NULL,
  sent_at DATETIME NULL,
  failed_at DATETIME NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY campaign_email_messages_campaign_index (campaign_id),
  KEY campaign_email_messages_customer_index (campaign_id, customer_unique_id),
  KEY campaign_email_messages_email_index (campaign_id, customer_email),
  KEY campaign_email_messages_thread_index (thread_root_message_id),
  CONSTRAINT campaign_email_messages_campaign_fk
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;
