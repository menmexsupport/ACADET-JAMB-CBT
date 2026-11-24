import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { eq, and } from 'drizzle-orm';
import { db } from './index.ts';
import {
  adminUsers,
  announcements,
  examinations,
  examinationSubjects,
  mockExaminations,
  notifications,
  platformSettings,
  questionOptions,
  questions,
  studyMaterials,
  subjectCombinations,
  subjects,
  topics,
  users,
} from './schema.ts';
import { SEED_COMBINATIONS, SEED_QUESTIONS, SEED_SUBJECTS } from './seedData.ts';

function generateSamplePdfBuffer(title: string, bodyLines: string[]): Buffer {
  // Valid minimal single-page PDF 1.4 document so downloads open cleanly in any PDF viewer
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const lines = [
    'BT',
    '/F1 16 Tf',
    '50 760 Td',
    `(${esc('Acadet JAMB CBT - Study Material')}) Tj`,
    '0 -26 Td',
    '/F1 13 Tf',
    `(${esc(title)}) Tj`,
    '0 -24 Td',
    '/F1 10 Tf',
  ];
  for (const line of bodyLines) {
    lines.push(`(${esc(line)}) Tj`);
    lines.push('0 -16 Td');
  }
  lines.push('ET');
  const stream = lines.join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

export async function runSeed(): Promise<void> {
  // 1. Platform Settings
  const existingSettings = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, 'default'));
  if (existingSettings.length === 0) {
    await db.insert(platformSettings).values({
      id: 'default',
      siteName: 'Acadet JAMB CBT',
      tagline: 'Prepare, Practice and Pass JAMB UTME with Confidence',
      supportEmail: 'support@acadetjamb.com',
      supportPhone: '+234 800 222 3380',
      jambDefaultYear: 2026,
      defaultExamDurationMinutes: 120,
      allowStudentRegistration: true,
      defaultAllowReview: true,
    });
  }

  // 2. Super Admin Bootstrap
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@acadetjamb.com').toLowerCase();
  const existingAdmins = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, adminEmail));
  let adminId: string;
  if (existingAdmins.length === 0) {
    const adminPass = process.env.ADMIN_PASSWORD || 'Admin@Acadet2026';
    const hash = await bcrypt.hash(adminPass, 12);
    const [insertedAdmin] = await db
      .insert(adminUsers)
      .values({
        fullName: process.env.ADMIN_FULL_NAME || 'Acadet Super Admin',
        email: adminEmail,
        username: process.env.ADMIN_USERNAME || 'acadetadmin',
        passwordHash: hash,
        role: 'super_admin',
        isActive: true,
      })
      .returning();
    adminId = insertedAdmin.id;
  } else {
    adminId = existingAdmins[0].id;
  }

  // 3. Starter Student Account (for immediate verification/login)
  const studentEmail = 'adewale@acadetjamb.com';
  const existingStudents = await db
    .select()
    .from(users)
    .where(eq(users.email, studentEmail));
  if (existingStudents.length === 0) {
    const studentHash = await bcrypt.hash('Student@2026', 12);
    await db.insert(users).values({
      fullName: 'Adewale Ogunleye',
      email: studentEmail,
      username: 'adewale2026',
      registrationNumber: 'ACD-JAMB-2026-1001',
      passwordHash: studentHash,
      role: 'student',
      phoneNumber: '+2348012345678',
      jambYear: 2026,
      intendedCourse: 'Computer Science',
      preferredInstitution: 'University of Lagos (UNILAG)',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      accountStatus: 'active',
    });
  }

  // 4. Subjects & Topics (bulk preload for fast idempotent startup)
  const subjectMap = new Map<string, string>(); // code -> id
  const topicMap = new Map<string, string>(); // `${code}:${topicName}` -> id

  const existingSubjects = await db.select().from(subjects);
  const existingSubjectByCode = new Map(existingSubjects.map((row) => [row.code, row]));
  const existingTopics = await db.select().from(topics);
  const existingTopicKeys = new Map(existingTopics.map((row) => [`${row.subjectId}:${row.name}`, row.id]));

  for (const s of SEED_SUBJECTS) {
    const existing = existingSubjectByCode.get(s.code);
    let subjectId: string;
    if (!existing) {
      const [created] = await db
        .insert(subjects)
        .values({
          code: s.code,
          name: s.name,
          category: s.category,
          description: s.description,
          isCompulsory: s.isCompulsory,
          isActive: true,
        })
        .returning();
      subjectId = created.id;
    } else {
      subjectId = existing.id;
      if (existing.name !== s.name || existing.description !== s.description || !existing.isActive) {
        await db
          .update(subjects)
          .set({ name: s.name, description: s.description, category: s.category, isActive: true })
          .where(eq(subjects.id, subjectId));
      }
    }
    subjectMap.set(s.code, subjectId);

    const missingTopics = s.topics.filter((tName) => !existingTopicKeys.has(`${subjectId}:${tName}`));
    if (missingTopics.length > 0) {
      const insertedTopics = await db
        .insert(topics)
        .values(
          missingTopics.map((topicName) => ({
            subjectId,
            name: topicName,
            description: `${s.name} syllabus module on ${topicName}.`,
          }))
        )
        .returning();
      for (const t of insertedTopics) {
        existingTopicKeys.set(`${subjectId}:${t.name}`, t.id);
      }
    }
    for (const topicName of s.topics) {
      const tid = existingTopicKeys.get(`${subjectId}:${topicName}`);
      if (tid) topicMap.set(`${s.code}:${topicName}`, tid);
    }
  }

  // 5. Subject Combinations (idempotent by name)
  const existingCombos = await db.select().from(subjectCombinations);
  const existingComboNames = new Set(existingCombos.map((c) => c.name));
  const missingCombos = SEED_COMBINATIONS.filter((c) => !existingComboNames.has(c.name));
  if (missingCombos.length > 0) {
    await db.insert(subjectCombinations).values(
      missingCombos.map((combo) => ({
        name: combo.name,
        faculty: combo.faculty,
        subjectCodes: combo.subjectCodes,
        description: combo.description,
        isActive: true,
      }))
    );
  }

  // 6. Seed Sample Practice Questions per subject (idempotent for newly added subjects)
  const subjectsWithQuestions = new Set<string>();
  const existingQs = await db.select({ subjectId: questions.subjectId }).from(questions);
  for (const row of existingQs) {
    subjectsWithQuestions.add(row.subjectId);
  }

  const labels: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
  for (const q of SEED_QUESTIONS) {
    const subjectId = subjectMap.get(q.subjectCode);
    if (!subjectId || subjectsWithQuestions.has(subjectId)) continue;
    const topicId = topicMap.get(`${q.subjectCode}:${q.topicName}`) || null;

    const [insertedQ] = await db
      .insert(questions)
      .values({
        subjectId,
        topicId,
        questionText: q.questionText,
        difficulty: q.difficulty,
        questionSource: 'sample_practice',
        examYear: null,
        explanation: q.explanation,
        isActive: true,
        createdBy: adminId,
      })
      .returning();

    await db.insert(questionOptions).values(
      labels.map((label) => ({
        questionId: insertedQ.id,
        optionLabel: label,
        optionText: q.options[label],
        isCorrect: q.correctOption === label,
      }))
    );
  }

  // 7. Practice Examination Blueprints
  const existingExams = await db.select({ id: examinations.id }).from(examinations).limit(1);
  if (existingExams.length === 0) {
    const engId = subjectMap.get('ENG')!;
    const mthId = subjectMap.get('MTH')!;
    const phyId = subjectMap.get('PHY')!;
    const chmId = subjectMap.get('CHM')!;
    const bioId = subjectMap.get('BIO')!;

    const [utmeSci] = await db
      .insert(examinations)
      .values({
        title: 'UTME Science Full Simulation (ENG, MTH, PHY, CHM)',
        examType: 'utme_4_subject',
        description: 'Official 4-subject UTME structure for Engineering, Physical Sciences, and Computing candidates.',
        instructions: 'Answer all questions across Use of English, Mathematics, Physics, and Chemistry within the time limit.',
        durationMinutes: 60,
        questionCount: 40,
        difficultyFilter: 'All',
        allowReview: true,
        isActive: true,
        createdBy: adminId,
      })
      .returning();

    for (const sId of [engId, mthId, phyId, chmId]) {
      await db.insert(examinationSubjects).values({
        examinationId: utmeSci.id,
        subjectId: sId,
        questionCount: 10,
      });
    }

    const [utmeMed] = await db
      .insert(examinations)
      .values({
        title: 'UTME Medical Sciences Drill (ENG, BIO, CHM, PHY)',
        examType: 'utme_4_subject',
        description: 'Timed 4-subject practice examination tailored for Medicine, Pharmacy, and Nursing candidates.',
        instructions: 'Use the built-in CBT calculator when needed and review flagged questions before final submission.',
        durationMinutes: 60,
        questionCount: 36,
        difficultyFilter: 'All',
        allowReview: true,
        isActive: true,
        createdBy: adminId,
      })
      .returning();

    for (const sId of [engId, bioId, chmId, phyId]) {
      await db.insert(examinationSubjects).values({
        examinationId: utmeMed.id,
        subjectId: sId,
        questionCount: 9,
      });
    }

    const [engSprint] = await db
      .insert(examinations)
      .values({
        title: 'Use of English Compulsory Drill',
        examType: 'practice',
        description: 'Focused practice on Lexis & Structure, Oral Forms, and Sentence Interpretation.',
        instructions: 'Select the best option A–D for each question.',
        durationMinutes: 20,
        questionCount: 10,
        difficultyFilter: 'All',
        allowReview: true,
        isActive: true,
        createdBy: adminId,
      })
      .returning();

    await db.insert(examinationSubjects).values({
      examinationId: engSprint.id,
      subjectId: engId,
      questionCount: 10,
    });
  }

  // 8. Scheduled Mock Examinations
  const existingMocks = await db.select({ id: mockExaminations.id }).from(mockExaminations).limit(1);
  if (existingMocks.length === 0) {
    const now = Date.now();
    const engId = subjectMap.get('ENG')!;
    const mthId = subjectMap.get('MTH')!;
    const phyId = subjectMap.get('PHY')!;
    const chmId = subjectMap.get('CHM')!;
    const govId = subjectMap.get('GOV')!;
    const ecnId = subjectMap.get('ECN')!;
    const litId = subjectMap.get('LIT')!;

    await db.insert(mockExaminations).values([
      {
        title: 'Acadet National UTME Mock Exam — Session A (Open Now)',
        description: 'Live timed mock simulation covering Use of English, Mathematics, Physics, and Chemistry.',
        instructions: 'Server-authoritative timer starts immediately when you begin. Answers auto-save as you progress.',
        subjectIds: [engId, mthId, phyId, chmId],
        startAt: new Date(now - 2 * 60 * 60 * 1000), // started 2 hours ago
        endAt: new Date(now + 7 * 24 * 60 * 60 * 1000), // open for 7 days
        durationMinutes: 60,
        questionCount: 36,
        eligibilityYear: 2026,
        allowReview: true,
        isActive: true,
        createdBy: adminId,
      },
      {
        title: 'Acadet Humanities & Social Sciences Mock — Session B',
        description: 'Scheduled national mock test for Law, Economics, and Social Science candidates.',
        instructions: 'Register ahead of the start window to reserve your mock seat.',
        subjectIds: [engId, govId, ecnId, litId],
        startAt: new Date(now + 3 * 24 * 60 * 60 * 1000),
        endAt: new Date(now + 10 * 24 * 60 * 60 * 1000),
        durationMinutes: 60,
        questionCount: 24,
        eligibilityYear: 2026,
        allowReview: true,
        isActive: true,
        createdBy: adminId,
      },
    ]);
  }

  // 9. Study Materials (Real generated PDF documents saved locally)
  const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads', 'materials');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const materialSeeds = [
    {
      code: 'ENG',
      title: 'JAMB Use of English: Lexis, Structure & Oral Forms Handbook',
      description: 'Concise rules on concord, subjunctive mood, vowel/consonant stress patterns, and comprehension strategy.',
      category: 'Study Notes',
      fileName: 'use-of-english-handbook.pdf',
      lines: [
        'Subject: Use of English (Compulsory)',
        '1. Concord Rules: With neither...nor, the verb agrees with the nearer noun.',
        '2. Subjunctive: "It is high time" takes the past tense verb form.',
        '3. Stress Patterns: Two-syllable nouns stress syllable 1; verbs stress syllable 2.',
        '4. Prepositional Collocations: congratulate ON, abstain FROM, comply WITH.',
      ],
    },
    {
      code: 'MTH',
      title: 'UTME Mathematics Formula Sheet & Revision Guide',
      description: 'Essential formulas for algebra, trigonometry, differentiation, integration, and probability.',
      category: 'Revision Materials',
      fileName: 'mathematics-formula-sheet.pdf',
      lines: [
        'Subject: Mathematics (UTME Core)',
        '1. Quadratic Roots: sum = -b/a, product = c/a.',
        '2. Trigonometry: sin^2(x) + cos^2(x) = 1; tan(x) = sin(x)/cos(x).',
        '3. Power Rule: d/dx (x^n) = n * x^(n-1).',
        '4. Coordinate Geometry: m = (y2 - y1) / (x2 - x1).',
      ],
    },
    {
      code: 'PHY',
      title: 'UTME Physics Key Laws, Equations & Mechanics Summary',
      description: 'Quick-reference notes on Newton laws, gas laws, wave equations, Ohm law, and radioactivity.',
      category: 'Tutorials',
      fileName: 'physics-equations-summary.pdf',
      lines: [
        'Subject: Physics',
        '1. Kinematics: v = u + at; s = ut + 0.5*a*t^2; v^2 = u^2 + 2as.',
        '2. Gas Laws: P1*V1/T1 = P2*V2/T2 (Kelvin temperature required).',
        '3. Waves: v = f * lambda.',
        '4. Electricity: V = IR; Power P = IV = I^2 * R; Parallel 1/R = sum(1/Ri).',
      ],
    },
    {
      code: 'CHM',
      title: 'UTME Chemistry Stoichiometry, Equilibrium & Organic Guide',
      description: 'Structured revision sheet on mole calculations, pH scale, Le Chatelier principle, and functional groups.',
      category: 'Study Notes',
      fileName: 'chemistry-revision-guide.pdf',
      lines: [
        'Subject: Chemistry',
        '1. Moles: n = mass / molar_mass; Gas volume at STP = n * 22.4 dm^3.',
        '2. pH Calculation: pH = -log10([H+]).',
        '3. Functional Groups: -OH (alkanol), -COOH (alkanoic acid), -COOR (ester).',
        '4. Equilibrium: Higher pressure shifts gas equilibrium to fewer moles.',
      ],
    },
    {
      code: 'BIO',
      title: 'UTME Biology Cell Biology, Genetics & Physiology Digest',
      description: 'High-yield review of organelles, Mendelian crosses, mammalian heart circulation, and hormones.',
      category: 'Revision Materials',
      fileName: 'biology-high-yield-digest.pdf',
      lines: [
        'Subject: Biology',
        '1. Organelles: Mitochondrion = ATP; Ribosome = Protein synthesis.',
        '2. Genetics: Monohybrid Tt x Tt yields 1 TT : 2 Tt : 1 tt (3:1 phenotype).',
        '3. Circulation: Left ventricle pumps oxygenated blood to the aorta.',
        '4. Nucleic Acids: DNA uses Thymine (T); RNA uses Uracil (U).',
      ],
    },
  ];

  const existingMaterials = await db.select({ id: studyMaterials.id, fileName: studyMaterials.fileName }).from(studyMaterials);
  const existingMaterialFiles = new Set(existingMaterials.map((m) => m.fileName));

  for (const m of materialSeeds) {
    const targetPath = path.join(uploadDir, m.fileName);
    const pdfBuf = generateSamplePdfBuffer(m.title, m.lines);
    if (!fs.existsSync(targetPath)) {
      fs.writeFileSync(targetPath, pdfBuf);
    }

    if (existingMaterials.length === 0 && !existingMaterialFiles.has(m.fileName)) {
      const subjectId = subjectMap.get(m.code);
      if (!subjectId) continue;

      await db.insert(studyMaterials).values({
        subjectId,
        title: m.title,
        description: m.description,
        category: m.category,
        fileName: m.fileName,
        fileType: 'application/pdf',
        fileSizeBytes: pdfBuf.length,
        storageKey: `materials/${m.fileName}`,
        storageProvider: 'local',
        downloadCount: 0,
        isActive: true,
        uploadedBy: adminId,
      });
    }
  }

  // 10. Announcements & Notifications
  const existingAnnouncements = await db.select({ id: announcements.id }).from(announcements).limit(1);
  if (existingAnnouncements.length === 0) {
    await db.insert(announcements).values([
      {
        title: '2026 JAMB UTME Mock Session A Is Now Open',
        body: 'Candidates preparing for the 2026 UTME can now register and sit for the National Mock Examination from the Mock Examinations tab. Review explanations are enabled upon submission.',
        isPinned: true,
        isActive: true,
        createdBy: adminId,
      },
      {
        title: 'Compulsory 4-Subject UTME Structure Enforced',
        body: 'In accordance with official UTME guidelines, all 4-subject examinations include Use of English alongside three approved elective subjects.',
        isPinned: false,
        isActive: true,
        createdBy: adminId,
      },
    ]);
  }

  const existingNotifs = await db.select({ id: notifications.id }).from(notifications).limit(1);
  if (existingNotifs.length === 0) {
    await db.insert(notifications).values([
      {
        targetUserId: null,
        title: 'Welcome to Acadet JAMB CBT',
        message: 'Configure your preferred 4-subject UTME combination in Practice Exams or attempt an active Mock Examination to benchmark your readiness.',
        type: 'system',
      },
      {
        targetUserId: null,
        title: 'New Study Guides Added',
        message: 'Download updated PDF revision handbooks for Use of English, Mathematics, Physics, Chemistry, and Biology in Study Materials.',
        type: 'announcement',
      },
    ]);
  }

  console.log('[db:seed] Seed completed successfully.');
}

const isDirectRun = process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');
if (isDirectRun) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[db:seed] Seed failed:', err);
      process.exit(1);
    });
}
