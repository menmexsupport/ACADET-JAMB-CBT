import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export interface UserPreferences {
  theme: 'light' | 'dark';
  fontSize: 'normal' | 'large';
  showQuestionPalette: boolean;
  autoNextQuestion: boolean;
  soundNotifications: boolean;
  preferredSubjectCodes: string[];
}

export interface SubjectBreakdownItem {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  scoreOutOf100: number;
  percentage: number;
}

// 1. Students / Users table
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    username: text('username').notNull(),
    registrationNumber: text('registration_number').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull().default('student'),
    phoneNumber: text('phone_number').notNull(),
    jambYear: integer('jamb_year').notNull().default(2026),
    intendedCourse: text('intended_course').notNull().default(''),
    preferredInstitution: text('preferred_institution').notNull().default(''),
    emailVerified: boolean('email_verified').notNull().default(false),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    sessionVersion: integer('session_version').notNull().default(1),
    accountStatus: text('account_status').notNull().default('active'), // 'active' | 'suspended'
    suspendedReason: text('suspended_reason'),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    preferences: jsonb('preferences')
      .$type<UserPreferences>()
      .notNull()
      .default({
        theme: 'light',
        fontSize: 'normal',
        showQuestionPalette: true,
        autoNextQuestion: false,
        soundNotifications: true,
        preferredSubjectCodes: ['ENG', 'MTH', 'PHY', 'CHM'],
      }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('users_email_idx').on(t.email),
    uniqueIndex('users_username_idx').on(t.username),
    uniqueIndex('users_reg_no_idx').on(t.registrationNumber),
  ]
);

// 2. Isolated Admin Accounts table
export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull().default('admin'), // 'admin' | 'super_admin'
    isActive: boolean('is_active').notNull().default(true),
    sessionVersion: integer('session_version').notNull().default(1),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('admin_users_email_idx').on(t.email),
    uniqueIndex('admin_users_username_idx').on(t.username),
  ]
);

// 3. Email Verification Tokens
export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('email_verify_token_hash_idx').on(t.tokenHash)]
);

// 4. Password Reset Tokens
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    requestIp: text('request_ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('password_reset_token_hash_idx').on(t.tokenHash)]
);

// 5. Subjects (JAMB UTME Catalog)
export const subjects = pgTable(
  'subjects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull(), // e.g., ENG, MTH, PHY
    name: text('name').notNull(),
    category: text('category').notNull().default('General'), // Compulsory | Science | Commercial | Arts
    description: text('description').notNull().default(''),
    isCompulsory: boolean('is_compulsory').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('subjects_code_idx').on(t.code)]
);

// 6. Official JAMB Subject Combinations
export const subjectCombinations = pgTable('subject_combinations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(), // e.g., Medicine & Surgery, Engineering, Law
  faculty: text('faculty').notNull(),
  subjectCodes: jsonb('subject_codes').$type<string[]>().notNull(),
  description: text('description').notNull().default(''),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 7. Topics per Subject
export const topics = pgTable(
  'topics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('topics_subject_name_idx').on(t.subjectId, t.name)]
);

// 8. Questions Bank
export const questions = pgTable(
  'questions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
    questionText: text('question_text').notNull(),
    questionImageUrl: text('question_image_url'),
    difficulty: text('difficulty').notNull().default('Medium'), // Easy | Medium | Hard
    questionSource: text('question_source').notNull().default('sample_practice'), // 'sample_practice' | 'verified_past_question'
    examYear: integer('exam_year'),
    explanation: text('explanation').notNull().default(''),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('questions_subject_idx').on(t.subjectId),
    index('questions_source_year_idx').on(t.questionSource, t.examYear),
  ]
);

// 9. Question Options (A, B, C, D)
export const questionOptions = pgTable(
  'question_options',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    optionLabel: text('option_label').notNull(), // 'A' | 'B' | 'C' | 'D'
    optionText: text('option_text').notNull(),
    isCorrect: boolean('is_correct').notNull().default(false),
  },
  (t) => [uniqueIndex('question_options_q_label_idx').on(t.questionId, t.optionLabel)]
);

// 10. Examination Blueprints / Practice Templates
export const examinations = pgTable('examinations', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  examType: text('exam_type').notNull().default('practice'), // 'practice' | 'utme_4_subject' | 'topic_practice' | 'revision' | 'mock'
  description: text('description').notNull().default(''),
  instructions: text('instructions').notNull().default('Read each question carefully and select the best option (A–D).'),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  questionCount: integer('question_count').notNull().default(40),
  difficultyFilter: text('difficulty_filter').notNull().default('All'),
  allowReview: boolean('allow_review').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 11. Examination Subjects Mapping
export const examinationSubjects = pgTable('examination_subjects', {
  id: uuid('id').defaultRandom().primaryKey(),
  examinationId: uuid('examination_id')
    .notNull()
    .references(() => examinations.id, { onDelete: 'cascade' }),
  subjectId: uuid('subject_id')
    .notNull()
    .references(() => subjects.id, { onDelete: 'cascade' }),
  questionCount: integer('question_count').notNull().default(40),
});

// 12. Examination Fixed Questions Mapping
export const examinationQuestions = pgTable('examination_questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  examinationId: uuid('examination_id')
    .notNull()
    .references(() => examinations.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  questionOrder: integer('question_order').notNull(),
});

// 13. Scheduled Mock Examinations
export const mockExaminations = pgTable('mock_examinations', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  instructions: text('instructions').notNull().default('Official timed JAMB UTME Mock Simulation. Use of English is compulsory plus 3 selected subjects.'),
  subjectIds: jsonb('subject_ids').$type<string[]>().notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(120),
  questionCount: integer('question_count').notNull().default(40),
  eligibilityYear: integer('eligibility_year'), // null = all years
  allowReview: boolean('allow_review').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 14. Mock Examination Registrations
export const mockRegistrations = pgTable(
  'mock_registrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    mockExaminationId: uuid('mock_examination_id')
      .notNull()
      .references(() => mockExaminations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('registered'), // 'registered' | 'started' | 'completed'
    registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('mock_reg_mock_user_idx').on(t.mockExaminationId, t.userId)]
);

// 15. Active / Completed Examination Sessions
export const examinationSessions = pgTable(
  'examination_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    examinationId: uuid('examination_id').references(() => examinations.id, { onDelete: 'set null' }),
    mockExaminationId: uuid('mock_examination_id').references(() => mockExaminations.id, { onDelete: 'set null' }),
    examTitle: text('exam_title').notNull(),
    examMode: text('exam_mode').notNull().default('timed'), // 'timed' | 'revision'
    examType: text('exam_type').notNull().default('practice'), // 'practice' | 'utme_4_subject' | 'topic_practice' | 'past_questions' | 'mock'
    subjectIds: jsonb('subject_ids').$type<string[]>().notNull(),
    totalQuestions: integer('total_questions').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    timeSpentSeconds: integer('time_spent_seconds').notNull().default(0),
    status: text('status').notNull().default('in_progress'), // 'in_progress' | 'submitted' | 'expired'
    allowReview: boolean('allow_review').notNull().default(true),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('exam_sessions_user_status_idx').on(t.userId, t.status)]
);

// 16. Student Answers per Examination Session
export const studentAnswers = pgTable(
  'student_answers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => examinationSessions.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    questionOrder: integer('question_order').notNull(),
    selectedOption: text('selected_option'), // 'A' | 'B' | 'C' | 'D' | null
    isMarkedForReview: boolean('is_marked_for_review').notNull().default(false),
    isCorrect: boolean('is_correct'), // computed strictly on submission
    answeredAt: timestamp('answered_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('student_answers_session_question_idx').on(t.sessionId, t.questionId),
    index('student_answers_session_order_idx').on(t.sessionId, t.questionOrder),
  ]
);

// 17. Examination Results (Immutable graded snapshot)
export const examinationResults = pgTable(
  'examination_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => examinationSessions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    examTitle: text('exam_title').notNull(),
    totalQuestions: integer('total_questions').notNull(),
    correctCount: integer('correct_count').notNull(),
    wrongCount: integer('wrong_count').notNull(),
    unansweredCount: integer('unanswered_count').notNull(),
    scoreOutOf400: integer('score_out_of_400').notNull().default(0),
    percentage: numeric('percentage', { precision: 5, scale: 2 }).notNull(),
    timeSpentSeconds: integer('time_spent_seconds').notNull(),
    subjectBreakdown: jsonb('subject_breakdown').$type<SubjectBreakdownItem[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('exam_results_session_idx').on(t.sessionId),
    index('exam_results_user_idx').on(t.userId),
  ]
);

// 18. Study Materials
export const studyMaterials = pgTable('study_materials', {
  id: uuid('id').defaultRandom().primaryKey(),
  subjectId: uuid('subject_id')
    .notNull()
    .references(() => subjects.id, { onDelete: 'cascade' }),
  topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  category: text('category').notNull().default('Study Notes'), // 'Past Questions' | 'Tutorials' | 'Study Notes' | 'Revision Materials'
  examYear: integer('exam_year'),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull().default('application/pdf'),
  fileSizeBytes: integer('file_size_bytes').notNull().default(0),
  storageKey: text('storage_key').notNull(),
  storageProvider: text('storage_provider').notNull().default('local'), // 'local' | 's3'
  downloadCount: integer('download_count').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  uploadedBy: uuid('uploaded_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 19. Announcements
export const announcements = pgTable('announcements', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  isPinned: boolean('is_pinned').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 20. Notifications
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'cascade' }), // null = broadcast to all students
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull().default('system'), // 'system' | 'announcement' | 'mock_exam' | 'admin_direct'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 21. Notification Reads
export const notificationReads = pgTable(
  'notification_reads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    readAt: timestamp('read_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('notification_reads_notif_user_idx').on(t.notificationId, t.userId)]
);

// 22. Security & Admin Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id'),
  actorRole: text('actor_role').notNull(),
  actorEmail: text('actor_email').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  details: jsonb('details').$type<Record<string, unknown>>(),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 23. Platform Settings (Singleton)
export const platformSettings = pgTable('platform_settings', {
  id: text('id').primaryKey().default('default'),
  siteName: text('site_name').notNull().default('Acadet JAMB CBT'),
  tagline: text('tagline').notNull().default('Prepare, Practice and Pass JAMB UTME with Confidence'),
  supportEmail: text('support_email').notNull().default('support@acadetjamb.com'),
  supportPhone: text('support_phone').notNull().default('+234 800 222 3380'),
  jambDefaultYear: integer('jamb_default_year').notNull().default(2026),
  defaultExamDurationMinutes: integer('default_exam_duration_minutes').notNull().default(120),
  allowStudentRegistration: boolean('allow_student_registration').notNull().default(true),
  defaultAllowReview: boolean('default_allow_review').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
