CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "username" text NOT NULL,
  "registration_number" text NOT NULL,
  "password_hash" text NOT NULL,
  "role" text NOT NULL DEFAULT 'student',
  "phone_number" text NOT NULL,
  "jamb_year" integer NOT NULL DEFAULT 2026,
  "intended_course" text NOT NULL DEFAULT '',
  "preferred_institution" text NOT NULL DEFAULT '',
  "email_verified" boolean NOT NULL DEFAULT false,
  "email_verified_at" timestamptz,
  "session_version" integer NOT NULL DEFAULT 1,
  "account_status" text NOT NULL DEFAULT 'active',
  "suspended_reason" text,
  "suspended_at" timestamptz,
  "preferences" jsonb NOT NULL DEFAULT '{"theme":"light","fontSize":"normal","showQuestionPalette":true,"autoNextQuestion":false,"soundNotifications":true,"preferredSubjectCodes":["ENG","MTH","PHY","CHM"]}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_idx" ON "users" ("username");
CREATE UNIQUE INDEX IF NOT EXISTS "users_reg_no_idx" ON "users" ("registration_number");

CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "username" text NOT NULL,
  "password_hash" text NOT NULL,
  "role" text NOT NULL DEFAULT 'admin',
  "is_active" boolean NOT NULL DEFAULT true,
  "session_version" integer NOT NULL DEFAULT 1,
  "last_login_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_email_idx" ON "admin_users" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_username_idx" ON "admin_users" ("username");

CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_verify_token_hash_idx" ON "email_verification_tokens" ("token_hash");

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "request_ip" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_token_hash_idx" ON "password_reset_tokens" ("token_hash");

CREATE TABLE IF NOT EXISTS "subjects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" text NOT NULL,
  "name" text NOT NULL,
  "category" text NOT NULL DEFAULT 'General',
  "description" text NOT NULL DEFAULT '',
  "is_compulsory" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "subjects_code_idx" ON "subjects" ("code");

CREATE TABLE IF NOT EXISTS "subject_combinations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "faculty" text NOT NULL,
  "subject_codes" jsonb NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "topics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "topics_subject_name_idx" ON "topics" ("subject_id", "name");

CREATE TABLE IF NOT EXISTS "questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE CASCADE,
  "topic_id" uuid REFERENCES "topics"("id") ON DELETE SET NULL,
  "question_text" text NOT NULL,
  "question_image_url" text,
  "difficulty" text NOT NULL DEFAULT 'Medium',
  "question_source" text NOT NULL DEFAULT 'sample_practice',
  "exam_year" integer,
  "explanation" text NOT NULL DEFAULT '',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "questions_subject_idx" ON "questions" ("subject_id");
CREATE INDEX IF NOT EXISTS "questions_source_year_idx" ON "questions" ("question_source", "exam_year");

CREATE TABLE IF NOT EXISTS "question_options" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "question_id" uuid NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
  "option_label" text NOT NULL,
  "option_text" text NOT NULL,
  "is_correct" boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS "question_options_q_label_idx" ON "question_options" ("question_id", "option_label");

CREATE TABLE IF NOT EXISTS "examinations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "exam_type" text NOT NULL DEFAULT 'practice',
  "description" text NOT NULL DEFAULT '',
  "instructions" text NOT NULL DEFAULT 'Read each question carefully and select the best option (A-D).',
  "duration_minutes" integer NOT NULL DEFAULT 60,
  "question_count" integer NOT NULL DEFAULT 40,
  "difficulty_filter" text NOT NULL DEFAULT 'All',
  "allow_review" boolean NOT NULL DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "examination_subjects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "examination_id" uuid NOT NULL REFERENCES "examinations"("id") ON DELETE CASCADE,
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE CASCADE,
  "question_count" integer NOT NULL DEFAULT 40
);

CREATE TABLE IF NOT EXISTS "examination_questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "examination_id" uuid NOT NULL REFERENCES "examinations"("id") ON DELETE CASCADE,
  "question_id" uuid NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
  "question_order" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "mock_examinations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "instructions" text NOT NULL DEFAULT 'Official timed JAMB UTME Mock Simulation.',
  "subject_ids" jsonb NOT NULL,
  "start_at" timestamptz NOT NULL,
  "end_at" timestamptz NOT NULL,
  "duration_minutes" integer NOT NULL DEFAULT 120,
  "question_count" integer NOT NULL DEFAULT 40,
  "eligibility_year" integer,
  "allow_review" boolean NOT NULL DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "mock_registrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "mock_examination_id" uuid NOT NULL REFERENCES "mock_examinations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'registered',
  "registered_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "mock_reg_mock_user_idx" ON "mock_registrations" ("mock_examination_id", "user_id");

CREATE TABLE IF NOT EXISTS "examination_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "examination_id" uuid REFERENCES "examinations"("id") ON DELETE SET NULL,
  "mock_examination_id" uuid REFERENCES "mock_examinations"("id") ON DELETE SET NULL,
  "exam_title" text NOT NULL,
  "exam_mode" text NOT NULL DEFAULT 'timed',
  "exam_type" text NOT NULL DEFAULT 'practice',
  "subject_ids" jsonb NOT NULL,
  "total_questions" integer NOT NULL,
  "duration_seconds" integer NOT NULL,
  "time_spent_seconds" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'in_progress',
  "allow_review" boolean NOT NULL DEFAULT true,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL,
  "submitted_at" timestamptz,
  "last_synced_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "exam_sessions_user_status_idx" ON "examination_sessions" ("user_id", "status");

CREATE TABLE IF NOT EXISTS "student_answers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" uuid NOT NULL REFERENCES "examination_sessions"("id") ON DELETE CASCADE,
  "question_id" uuid NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE CASCADE,
  "question_order" integer NOT NULL,
  "selected_option" text,
  "is_marked_for_review" boolean NOT NULL DEFAULT false,
  "is_correct" boolean,
  "answered_at" timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_answers_session_question_idx" ON "student_answers" ("session_id", "question_id");
CREATE INDEX IF NOT EXISTS "student_answers_session_order_idx" ON "student_answers" ("session_id", "question_order");

CREATE TABLE IF NOT EXISTS "examination_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" uuid NOT NULL REFERENCES "examination_sessions"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "exam_title" text NOT NULL,
  "total_questions" integer NOT NULL,
  "correct_count" integer NOT NULL,
  "wrong_count" integer NOT NULL,
  "unanswered_count" integer NOT NULL,
  "score_out_of_400" integer NOT NULL DEFAULT 0,
  "percentage" numeric(5, 2) NOT NULL,
  "time_spent_seconds" integer NOT NULL,
  "subject_breakdown" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "exam_results_session_idx" ON "examination_results" ("session_id");
CREATE INDEX IF NOT EXISTS "exam_results_user_idx" ON "examination_results" ("user_id");

CREATE TABLE IF NOT EXISTS "study_materials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE CASCADE,
  "topic_id" uuid REFERENCES "topics"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "category" text NOT NULL DEFAULT 'Study Notes',
  "exam_year" integer,
  "file_name" text NOT NULL,
  "file_type" text NOT NULL DEFAULT 'application/pdf',
  "file_size_bytes" integer NOT NULL DEFAULT 0,
  "storage_key" text NOT NULL,
  "storage_provider" text NOT NULL DEFAULT 'local',
  "download_count" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "uploaded_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "announcements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "body" text NOT NULL,
  "is_pinned" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "target_user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "type" text NOT NULL DEFAULT 'system',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notification_reads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "notification_id" uuid NOT NULL REFERENCES "notifications"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "read_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_reads_notif_user_idx" ON "notification_reads" ("notification_id", "user_id");

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id" uuid,
  "actor_role" text NOT NULL,
  "actor_email" text NOT NULL,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text,
  "details" jsonb,
  "ip_address" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "platform_settings" (
  "id" text PRIMARY KEY DEFAULT 'default',
  "site_name" text NOT NULL DEFAULT 'Acadet JAMB CBT',
  "tagline" text NOT NULL DEFAULT 'Prepare, Practice and Pass JAMB UTME with Confidence',
  "support_email" text NOT NULL DEFAULT 'support@acadetjamb.com',
  "support_phone" text NOT NULL DEFAULT '+234 800 222 3380',
  "jamb_default_year" integer NOT NULL DEFAULT 2026,
  "default_exam_duration_minutes" integer NOT NULL DEFAULT 120,
  "allow_student_registration" boolean NOT NULL DEFAULT true,
  "default_allow_review" boolean NOT NULL DEFAULT true,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
