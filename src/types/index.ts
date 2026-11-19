export interface UserPreferences {
  theme: 'light' | 'dark';
  fontSize: 'normal' | 'large';
  showQuestionPalette: boolean;
  autoNextQuestion: boolean;
  soundNotifications: boolean;
  preferredSubjectCodes: string[];
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  username: string;
  registrationNumber?: string;
  role: 'student' | 'admin' | 'super_admin';
  actorType: 'student' | 'admin';
  phoneNumber?: string;
  jambYear?: number;
  intendedCourse?: string;
  preferredInstitution?: string;
  emailVerified?: boolean;
  preferences?: UserPreferences;
  createdAt?: string;
}

export interface TopicItem {
  id: string;
  subjectId: string;
  name: string;
  description: string;
}

export interface SubjectItem {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  isCompulsory: boolean;
  isActive: boolean;
  questionCount?: number;
  topics?: TopicItem[];
}

export interface SubjectCombinationItem {
  id: string;
  name: string;
  faculty: string;
  subjectCodes: string[];
  description: string;
  isActive: boolean;
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

export interface ExamResultItem {
  id: string;
  sessionId: string;
  userId: string;
  examTitle: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  scoreOutOf400: number;
  percentage: string;
  timeSpentSeconds: number;
  subjectBreakdown: SubjectBreakdownItem[];
  createdAt: string;
}

export interface ExamQuestionItem {
  questionOrder: number;
  questionId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  topicName: string;
  questionText: string;
  questionImageUrl: string | null;
  difficulty: string;
  questionSource: 'sample_practice' | 'verified_past_question';
  examYear: number | null;
  options: Array<{ label: string; text: string }>;
  selectedOption: 'A' | 'B' | 'C' | 'D' | null;
  isMarkedForReview: boolean;
}

export interface ExamSessionDetail {
  id: string;
  examTitle: string;
  examMode: 'timed' | 'revision';
  examType: string;
  status: 'in_progress' | 'submitted' | 'expired';
  totalQuestions: number;
  durationSeconds: number;
  remainingSeconds: number;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  subjects: Array<{ id: string; code: string; name: string }>;
}

export interface PlatformSettings {
  id: string;
  siteName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  jambDefaultYear: number;
  defaultExamDurationMinutes: number;
  allowStudentRegistration: boolean;
  defaultAllowReview: boolean;
}
