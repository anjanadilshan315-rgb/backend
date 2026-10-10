-- =============================================================================
--  Wedding Invitation Platform — database schema
-- -----------------------------------------------------------------------------
--  Creates the whole database in one go. Safe to re-run: every table uses
--  CREATE TABLE IF NOT EXISTS and seed rows use INSERT IGNORE, so existing data
--  is never dropped.
--
--  Compatible with MySQL 8.0+ and MariaDB 10.4+.
--
--  Run with:   mysql -u root -p < database/schema.sql
--  or:         npm run db:schema        (uses the DB_* values from .env)
--
--  Keep this file as the single source of truth: when a table changes, update
--  it here and add a matching ALTER statement under database/migrations/.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `railway`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `railway`;

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- -----------------------------------------------------------------------------
--  Sales team (dashboard) users
--    role = 'admin' : every permission, can manage other staff users
--    role = 'user'  : only the permissions granted in staff_permissions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `staff_users` (
  `id`             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `name`           VARCHAR(150)     NOT NULL,
  `email`          VARCHAR(255)     NOT NULL,
  `phone`          VARCHAR(30)      NULL,
  `password_hash`  VARCHAR(255)     NOT NULL,
  `role`           ENUM('admin','user') NOT NULL DEFAULT 'user',
  `is_active`      TINYINT(1)       NOT NULL DEFAULT 1,
  `last_login_at`  DATETIME         NULL,
  `created_by`     INT UNSIGNED     NULL,
  `created_at`     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_staff_users_email` (`email`),
  KEY `idx_staff_users_role` (`role`),
  CONSTRAINT `fk_staff_users_created_by` FOREIGN KEY (`created_by`)
    REFERENCES `staff_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permission keys are defined in src/common/constants/permissions.ts
CREATE TABLE IF NOT EXISTS `staff_permissions` (
  `staff_id`    INT UNSIGNED NOT NULL,
  `permission`  VARCHAR(64)  NOT NULL,
  `granted_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`staff_id`, `permission`),
  CONSTRAINT `fk_staff_permissions_staff` FOREIGN KEY (`staff_id`)
    REFERENCES `staff_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  Customers (register through the website)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
  `id`             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `first_name`     VARCHAR(100)  NOT NULL,
  `last_name`      VARCHAR(100)  NOT NULL,
  `email`          VARCHAR(255)  NOT NULL,
  `phone`          VARCHAR(30)   NOT NULL,
  `password_hash`  VARCHAR(255)  NOT NULL,
  `is_active`      TINYINT(1)    NOT NULL DEFAULT 1,
  `last_login_at`  DATETIME      NULL,
  `created_by_staff_id` INT UNSIGNED NULL,
  `created_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customers_email` (`email`),
  KEY `idx_customers_phone` (`phone`),
  KEY `idx_customers_created_at` (`created_at`),
  CONSTRAINT `fk_customers_created_by_staff` FOREIGN KEY (`created_by_staff_id`)
    REFERENCES `staff_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  Refresh tokens (staff + customers). Only the SHA-256 hash is stored.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `subject_type`  ENUM('staff','customer') NOT NULL,
  `subject_id`    INT UNSIGNED    NOT NULL,
  `token_hash`    CHAR(64)        NOT NULL,
  `expires_at`    DATETIME        NOT NULL,
  `revoked_at`    DATETIME        NULL,
  `ip_address`    VARCHAR(45)     NULL,
  `user_agent`    VARCHAR(255)    NULL,
  `created_at`    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_refresh_tokens_hash` (`token_hash`),
  KEY `idx_refresh_tokens_subject` (`subject_type`, `subject_id`),
  KEY `idx_refresh_tokens_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  Invitation templates (static designs for now; a template builder comes later)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `templates` (
  `id`                 INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `code`               VARCHAR(50)    NOT NULL,
  `name`               VARCHAR(150)   NOT NULL,
  `description`        VARCHAR(1000)  NULL,
  `category`           VARCHAR(50)    NULL,
  `preview_image_url`  VARCHAR(1000)  NULL,
  `demo_slug`          VARCHAR(120)   NULL,
  `price`              DECIMAL(10,2)  NULL,
  `is_active`          TINYINT(1)     NOT NULL DEFAULT 1,
  `sort_order`         INT            NOT NULL DEFAULT 0,
  `created_at`         TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_templates_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  Invitations (a customer's submission for one template)
--    draft     -> customer is still filling the step form
--    pending   -> submitted, waiting for payment (shown to the sales team)
--    paid      -> payment confirmed by the sales team; guests can be emailed
--    cancelled -> cancelled by the sales team
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `invitations` (
  `id`                 INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `reference_no`       VARCHAR(20)    NULL,
  `customer_id`        INT UNSIGNED   NOT NULL,
  `template_id`        INT UNSIGNED   NOT NULL,
  `slug`               VARCHAR(120)   NULL,
  `status`             ENUM('draft','pending','paid','cancelled') NOT NULL DEFAULT 'draft',
  `current_step`       TINYINT UNSIGNED NOT NULL DEFAULT 1,

  `groom_name`         VARCHAR(150)   NULL,
  `bride_name`         VARCHAR(150)   NULL,
  `groom_phone`        VARCHAR(30)    NULL,
  `bride_phone`        VARCHAR(30)    NULL,
  `groom_parents`      VARCHAR(255)   NULL,
  `bride_parents`      VARCHAR(255)   NULL,
  `wedding_date`       DATE           NULL,
  `wedding_time`       TIME           NULL,
  `rsvp_deadline`      DATE           NULL,
  `venue_name`         VARCHAR(255)   NULL,
  `venue_address`      VARCHAR(500)   NULL,
  `map_url`            VARCHAR(1000)  NULL,
  `greeting_message`   TEXT           NULL,
  `events_schedule`    JSON           NULL,
  `extra_details`      JSON           NULL,

  `submitted_at`       DATETIME       NULL,
  `paid_at`            DATETIME       NULL,
  `payment_amount`     DECIMAL(10,2)  NULL,
  `payment_reference`  VARCHAR(100)   NULL,
  `paid_marked_by`     INT UNSIGNED   NULL,
  `staff_notes`        TEXT           NULL,

  `created_at`         TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_invitations_reference_no` (`reference_no`),
  UNIQUE KEY `uq_invitations_slug` (`slug`),
  KEY `idx_invitations_customer` (`customer_id`),
  KEY `idx_invitations_status_submitted` (`status`, `submitted_at`),
  KEY `idx_invitations_template` (`template_id`),
  CONSTRAINT `fk_invitations_customer` FOREIGN KEY (`customer_id`)
    REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invitations_template` FOREIGN KEY (`template_id`)
    REFERENCES `templates` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_invitations_paid_marked_by` FOREIGN KEY (`paid_marked_by`)
    REFERENCES `staff_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Photos are stored on Cloudinary; only the URL and public_id are kept here.
CREATE TABLE IF NOT EXISTS `invitation_photos` (
  `id`             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `invitation_id`  INT UNSIGNED  NOT NULL,
  `category`       ENUM('cover','groom','bride','gallery') NOT NULL DEFAULT 'gallery',
  `url`            VARCHAR(1000) NOT NULL,
  `public_id`      VARCHAR(255)  NOT NULL,
  `width`          INT UNSIGNED  NULL,
  `height`         INT UNSIGNED  NULL,
  `bytes`          INT UNSIGNED  NULL,
  `sort_order`     INT           NOT NULL DEFAULT 0,
  `created_at`     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_invitation_photos_invitation` (`invitation_id`, `category`, `sort_order`),
  CONSTRAINT `fk_invitation_photos_invitation` FOREIGN KEY (`invitation_id`)
    REFERENCES `invitations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `invitation_status_history` (
  `id`               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `invitation_id`    INT UNSIGNED  NOT NULL,
  `from_status`      ENUM('draft','pending','paid','cancelled') NULL,
  `to_status`        ENUM('draft','pending','paid','cancelled') NOT NULL,
  `changed_by_type`  ENUM('customer','staff','system') NOT NULL,
  `changed_by_id`    INT UNSIGNED  NULL,
  `note`             VARCHAR(500)  NULL,
  `created_at`       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status_history_invitation` (`invitation_id`, `created_at`),
  CONSTRAINT `fk_status_history_invitation` FOREIGN KEY (`invitation_id`)
    REFERENCES `invitations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  Bulk e-mail batches (one row per "send invitations" action)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `email_batches` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `invitation_id`   INT UNSIGNED  NOT NULL,
  `requested_by_type` ENUM('customer','staff') NOT NULL,
  `requested_by_id` INT UNSIGNED  NULL,
  `status`          ENUM('queued','processing','completed','completed_with_errors') NOT NULL DEFAULT 'queued',
  `total_count`     INT UNSIGNED  NOT NULL DEFAULT 0,
  `sent_count`      INT UNSIGNED  NOT NULL DEFAULT 0,
  `failed_count`    INT UNSIGNED  NOT NULL DEFAULT 0,
  `started_at`      DATETIME      NULL,
  `completed_at`    DATETIME      NULL,
  `created_at`      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_batches_invitation` (`invitation_id`, `created_at`),
  KEY `idx_email_batches_status` (`status`),
  CONSTRAINT `fk_email_batches_invitation` FOREIGN KEY (`invitation_id`)
    REFERENCES `invitations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  Guests of an invitation (imported from Excel or added by hand)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `guests` (
  `id`                   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `invitation_id`        INT UNSIGNED  NOT NULL,
  `name`                 VARCHAR(150)  NOT NULL,
  `email`                VARCHAR(255)  NULL,
  `phone`                VARCHAR(30)   NULL,
  `invite_code`          VARCHAR(32)   NOT NULL,
  `email_status`         ENUM('not_sent','queued','sent','failed') NOT NULL DEFAULT 'not_sent',
  `email_error`          VARCHAR(500)  NULL,
  `email_sent_at`        DATETIME      NULL,
  `last_email_batch_id`  INT UNSIGNED  NULL,
  `rsvp_status`          ENUM('pending','attending','declined') NOT NULL DEFAULT 'pending',
  `head_count`           SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `responded_at`         DATETIME      NULL,
  `created_at`           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_guests_invite_code` (`invite_code`),
  UNIQUE KEY `uq_guests_invitation_email` (`invitation_id`, `email`),
  KEY `idx_guests_email_status` (`invitation_id`, `email_status`),
  KEY `idx_guests_batch` (`last_email_batch_id`, `email_status`),
  KEY `idx_guests_rsvp` (`invitation_id`, `rsvp_status`),
  CONSTRAINT `fk_guests_invitation` FOREIGN KEY (`invitation_id`)
    REFERENCES `invitations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_guests_email_batch` FOREIGN KEY (`last_email_batch_id`)
    REFERENCES `email_batches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  Guest book wishes posted on the public invitation page
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `wishes` (
  `id`             INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `invitation_id`  INT UNSIGNED   NOT NULL,
  `guest_id`       INT UNSIGNED   NULL,
  `name`           VARCHAR(150)   NOT NULL,
  `message`        VARCHAR(1000)  NOT NULL,
  `is_visible`     TINYINT(1)     NOT NULL DEFAULT 1,
  `created_at`     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wishes_invitation` (`invitation_id`, `is_visible`, `created_at`),
  CONSTRAINT `fk_wishes_invitation` FOREIGN KEY (`invitation_id`)
    REFERENCES `invitations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wishes_guest` FOREIGN KEY (`guest_id`)
    REFERENCES `guests` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  Contact form messages from the website
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `contact_messages` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(150)  NOT NULL,
  `email`       VARCHAR(255)  NOT NULL,
  `phone`       VARCHAR(30)   NULL,
  `subject`     VARCHAR(255)  NULL,
  `message`     TEXT          NOT NULL,
  `is_read`     TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contact_messages_read` (`is_read`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
--  Seed data
-- =============================================================================

-- Default admin.  Email: admin@example.com   Password: Admin@12345
-- CHANGE THIS PASSWORD right after the first login (or create your own admin
-- with `npm run seed:admin` and deactivate this one).
INSERT IGNORE INTO `staff_users` (`id`, `name`, `email`, `password_hash`, `role`)
VALUES (1, 'System Admin', 'admin@example.com',
        '$2b$12$z4ngr56h3FSpPHvA0L6RUeQ0FrEFim9LOenEy9By8tVAGwXC4roYC', 'admin');

-- The five static templates. `code` must match the template components in the
-- website. Prices are left NULL; set them from the dashboard or here.
INSERT IGNORE INTO `templates` (`id`, `code`, `name`, `description`, `category`, `demo_slug`, `sort_order`) VALUES
  (1, 'tpl_classic', 'Classic Elegance', 'Timeless ivory and gold design with a photo gallery, event timeline, RSVP and guest wishes.', 'classic', 'demo-template', 1),
  (2, 'tpl_royal',   'Royal Kandyan',    'Traditional Sri Lankan Kandyan theme with rich maroon and gold details.',                       'traditional', 'demo-kandyan', 2),
  (3, 'tpl_modern',  'Modern Luxe',      'Clean, bold typography with full-width photos for modern couples.',                              'modern', 'demo-modern', 3),
  (4, 'tpl_floral',  'Floral Garden',    'Soft watercolor florals and pastel tones for garden and outdoor weddings.',                      'floral', 'demo-floral', 4),
  (5, 'tpl_minimal', 'Minimal White',    'Minimal white layout that puts the couple''s photos and details first.',                         'minimal', 'demo-minimal', 5);
