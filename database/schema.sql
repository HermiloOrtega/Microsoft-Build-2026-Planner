-- MS_Build_26 Database Schema
-- Run: mysql -u root -p < database/schema.sql

CREATE DATABASE IF NOT EXISTS MS_Build_26
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE MS_Build_26;

-- ── SESSIONS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(32)  NOT NULL,
  title        VARCHAR(512) NOT NULL,
  description  TEXT,
  type         VARCHAR(64),
  level        INT,
  category     VARCHAR(128),
  modality     VARCHAR(64),
  is_recorded  TINYINT(1)   NOT NULL DEFAULT 0,
  session_url  VARCHAR(1024),
  is_favorite  TINYINT(1)   NOT NULL DEFAULT 0,
  prio         ENUM('must','high','good','skip') NOT NULL DEFAULT 'good',
  why          TEXT,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── SPEAKERS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS speakers (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(256) NOT NULL,
  profile_url VARCHAR(1024),
  photo_url   VARCHAR(1024),
  UNIQUE KEY uq_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── SESSION_SPEAKERS (junction) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_speakers (
  session_id  INT UNSIGNED NOT NULL,
  speaker_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (session_id, speaker_id),
  CONSTRAINT fk_ss_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_ss_speaker FOREIGN KEY (speaker_id) REFERENCES speakers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;