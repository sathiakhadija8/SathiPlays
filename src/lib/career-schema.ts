import pool from './db';
import { type RowDataPacket } from 'mysql2';
import { DAILY_PRACTICE_DEFAULT_ICON } from './career-constants';

let subjectsCoverChecked = false;
let dailyPracticeIconsChecked = false;
let studySessionsChecked = false;

export async function ensureSubjectsCoverColumn() {
  if (subjectsCoverChecked) return;

  const [rows] = await pool.query<(RowDataPacket & { cnt: number })[]>(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'subjects'
       AND column_name = 'cover_image_path'`,
  );

  if (Number(rows[0]?.cnt ?? 0) === 0) {
    await pool.query(`ALTER TABLE subjects ADD COLUMN cover_image_path VARCHAR(400) NULL AFTER icon_key`);
  }

  subjectsCoverChecked = true;
}

export async function ensureDailyPracticeIconColumns() {
  if (dailyPracticeIconsChecked) return;

  const [iconTypeRows] = await pool.query<(RowDataPacket & { cnt: number })[]>(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'daily_practice_items'
       AND column_name = 'icon_type'`,
  );
  if (Number(iconTypeRows[0]?.cnt ?? 0) === 0) {
    await pool.query(
      `ALTER TABLE daily_practice_items
       ADD COLUMN icon_type ENUM('preset','upload') NOT NULL DEFAULT 'preset' AFTER display_name`,
    );
  }

  const [presetRows] = await pool.query<(RowDataPacket & { cnt: number })[]>(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'daily_practice_items'
       AND column_name = 'preset_icon'`,
  );
  if (Number(presetRows[0]?.cnt ?? 0) === 0) {
    await pool.query(`ALTER TABLE daily_practice_items ADD COLUMN preset_icon VARCHAR(120) NULL AFTER icon_type`);
  }

  const [uploadRows] = await pool.query<(RowDataPacket & { cnt: number })[]>(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'daily_practice_items'
       AND column_name = 'uploaded_icon_url'`,
  );
  if (Number(uploadRows[0]?.cnt ?? 0) === 0) {
    await pool.query(`ALTER TABLE daily_practice_items ADD COLUMN uploaded_icon_url VARCHAR(400) NULL AFTER preset_icon`);
  }

  await pool.query(
    `UPDATE daily_practice_items
     SET icon_type = COALESCE(icon_type, 'preset'),
         preset_icon = COALESCE(
           preset_icon,
           CASE
             WHEN key_name = 'communication' THEN '🗣'
             WHEN key_name = 'driving' THEN '🚗'
             ELSE ?
           END
         )
     WHERE is_active = 1`,
    [DAILY_PRACTICE_DEFAULT_ICON],
  );

  dailyPracticeIconsChecked = true;
}

export async function ensureStudySessionsTable() {
  if (studySessionsChecked) return;

  await pool.query(
    `CREATE TABLE IF NOT EXISTS study_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date DATE NOT NULL,
      duration_minutes INT NOT NULL,
      subject_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_study_sessions_date (date),
      INDEX idx_study_sessions_subject_id (subject_id),
      CONSTRAINT fk_study_sessions_subject
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
        ON DELETE SET NULL
    )`,
  );

  studySessionsChecked = true;
}
