import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  Grid,
  LogOut,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import { formatDuration } from '../../lib/pdfReport.ts';
import BrandEmblem from '../common/BrandEmblem.tsx';

export interface SampleSubject {
  code: string;
  name: string;
}

interface SampleQuestion {
  id: string;
  subjectCode: string;
  subjectName: string;
  topic: string;
  year: number | null;
  questionText: string;
  options: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string }>;
  correctOption: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

interface SampleCbtPreviewProps {
  candidateName?: string;
  registrationNumber?: string;
  selectedSubjects?: SampleSubject[];
  onClose: () => void;
}

const DEFAULT_SUBJECTS: SampleSubject[] = [
  { code: 'ENG', name: 'Use of English' },
  { code: 'MTH', name: 'Mathematics' },
  { code: 'PHY', name: 'Physics' },
  { code: 'CHM', name: 'Chemistry' },
];

const SAMPLE_BANK: SampleQuestion[] = [
  // Use of English
  {
    id: 'eng-1',
    subjectCode: 'ENG',
    subjectName: 'Use of English',
    topic: 'Lexis & Structure',
    year: 2023,
    questionText:
      'Choose the option nearest in meaning to the underlined word: The principal commended the prefect for her "candour" during the disciplinary panel.',
    options: [
      { label: 'A', text: 'Frankness' },
      { label: 'B', text: 'Timidity' },
      { label: 'C', text: 'Ambition' },
      { label: 'D', text: 'Politeness' },
    ],
    correctOption: 'A',
    explanation: '"Candour" means the quality of being open, sincere, and frank in expression.',
  },
  {
    id: 'eng-2',
    subjectCode: 'ENG',
    subjectName: 'Use of English',
    topic: 'Concord & Grammar',
    year: 2022,
    questionText:
      'Neither the Biology teacher nor the laboratory assistants _____ present when the equipment arrived.',
    options: [
      { label: 'A', text: 'was' },
      { label: 'B', text: 'is' },
      { label: 'C', text: 'were' },
      { label: 'D', text: 'has been' },
    ],
    correctOption: 'C',
    explanation:
      'With "neither...nor", the verb agrees with the nearer subject ("assistants", which is plural), requiring "were".',
  },
  {
    id: 'eng-3',
    subjectCode: 'ENG',
    subjectName: 'Use of English',
    topic: 'Idioms',
    year: 2024,
    questionText:
      'After reviewing the audit report, the bursar decided to "clear the air" before the board meeting.',
    options: [
      { label: 'A', text: 'Open all windows in the hall' },
      { label: 'B', text: 'Remove misunderstandings openly' },
      { label: 'C', text: 'Postpone the meeting indefinitely' },
      { label: 'D', text: 'Resign from the committee' },
    ],
    correctOption: 'B',
    explanation: 'To "clear the air" means to resolve doubts, tension, or misunderstandings through open discussion.',
  },
  {
    id: 'eng-4',
    subjectCode: 'ENG',
    subjectName: 'Use of English',
    topic: 'Oral English',
    year: 2021,
    questionText: 'Choose the word that has the SAME vowel sound as the underlined letters in "seat".',
    options: [
      { label: 'A', text: 'Sit' },
      { label: 'B', text: 'Bread' },
      { label: 'C', text: 'Police' },
      { label: 'D', text: 'Great' },
    ],
    correctOption: 'C',
    explanation: 'Both "seat" and the second syllable of "police" carry the long /iː/ vowel sound.',
  },

  // Mathematics
  {
    id: 'mth-1',
    subjectCode: 'MTH',
    subjectName: 'Mathematics',
    topic: 'Quadratic Equations',
    year: 2023,
    questionText: 'Find the sum and product of the roots of the equation 2x² - 7x + 6 = 0.',
    options: [
      { label: 'A', text: 'Sum = 7/2, Product = 3' },
      { label: 'B', text: 'Sum = -7/2, Product = 3' },
      { label: 'C', text: 'Sum = 7, Product = 6' },
      { label: 'D', text: 'Sum = 3/2, Product = 7/2' },
    ],
    correctOption: 'A',
    explanation: 'For ax² + bx + c = 0, sum of roots = -b/a = 7/2 and product of roots = c/a = 6/2 = 3.',
  },
  {
    id: 'mth-2',
    subjectCode: 'MTH',
    subjectName: 'Mathematics',
    topic: 'Logarithms',
    year: 2022,
    questionText: 'Evaluate log₁₀(25) + log₁₀(40) without using tables.',
    options: [
      { label: 'A', text: '2' },
      { label: 'B', text: '3' },
      { label: 'C', text: '4' },
      { label: 'D', text: '10' },
    ],
    correctOption: 'B',
    explanation: 'log₁₀(25 × 40) = log₁₀(1000) = log₁₀(10³) = 3.',
  },
  {
    id: 'mth-3',
    subjectCode: 'MTH',
    subjectName: 'Mathematics',
    topic: 'Mensuration',
    year: 2024,
    questionText:
      'A cylinder has radius 7 cm and height 10 cm. Calculate its volume (take π = 22/7).',
    options: [
      { label: 'A', text: '440 cm³' },
      { label: 'B', text: '770 cm³' },
      { label: 'C', text: '1,540 cm³' },
      { label: 'D', text: '3,080 cm³' },
    ],
    correctOption: 'C',
    explanation: 'Volume = πr²h = (22/7) × 7 × 7 × 10 = 154 × 10 = 1,540 cm³.',
  },
  {
    id: 'mth-4',
    subjectCode: 'MTH',
    subjectName: 'Mathematics',
    topic: 'Calculus',
    year: 2021,
    questionText: 'Find dy/dx if y = 3x⁴ - 5x² + 9.',
    options: [
      { label: 'A', text: '12x³ - 10x' },
      { label: 'B', text: '12x⁴ - 10x' },
      { label: 'C', text: '3x³ - 5x' },
      { label: 'D', text: '12x³ - 5' },
    ],
    correctOption: 'A',
    explanation: 'Differentiating term by term: d/dx(3x⁴) = 12x³, d/dx(-5x²) = -10x, and d/dx(9) = 0.',
  },

  // Physics
  {
    id: 'phy-1',
    subjectCode: 'PHY',
    subjectName: 'Physics',
    topic: 'Motion & Mechanics',
    year: 2023,
    questionText:
      'A car accelerates uniformly from rest at 4 m/s² for 5 seconds. What distance does it cover?',
    options: [
      { label: 'A', text: '20 m' },
      { label: 'B', text: '40 m' },
      { label: 'C', text: '50 m' },
      { label: 'D', text: '100 m' },
    ],
    correctOption: 'C',
    explanation: 'Using s = ut + ½at² with u = 0: s = ½ × 4 × 5² = 2 × 25 = 50 m.',
  },
  {
    id: 'phy-2',
    subjectCode: 'PHY',
    subjectName: 'Physics',
    topic: 'Current Electricity',
    year: 2022,
    questionText:
      'Two resistors of 6 Ω and 3 Ω are connected in parallel across a 12 V battery. Calculate the total current drawn.',
    options: [
      { label: 'A', text: '2.0 A' },
      { label: 'B', text: '4.0 A' },
      { label: 'C', text: '6.0 A' },
      { label: 'D', text: '9.0 A' },
    ],
    correctOption: 'C',
    explanation: 'Equivalent resistance R = (6 × 3)/(6 + 3) = 2 Ω. Total current I = V/R = 12/2 = 6.0 A.',
  },
  {
    id: 'phy-3',
    subjectCode: 'PHY',
    subjectName: 'Physics',
    topic: 'Waves',
    year: 2024,
    questionText:
      'A sound wave of frequency 500 Hz travels through air at 340 m/s. Calculate its wavelength.',
    options: [
      { label: 'A', text: '0.68 m' },
      { label: 'B', text: '1.47 m' },
      { label: 'C', text: '170 m' },
      { label: 'D', text: '840 m' },
    ],
    correctOption: 'A',
    explanation: 'Wavelength λ = v / f = 340 / 500 = 0.68 m.',
  },
  {
    id: 'phy-4',
    subjectCode: 'PHY',
    subjectName: 'Physics',
    topic: 'Thermal Physics',
    year: 2020,
    questionText:
      'Which instrument is most suitable for measuring rapid changes in temperature in a laboratory?',
    options: [
      { label: 'A', text: 'Clinical thermometer' },
      { label: 'B', text: 'Thermocouple thermometer' },
      { label: 'C', text: 'Alcohol-in-glass thermometer' },
      { label: 'D', text: 'Constant-volume gas thermometer' },
    ],
    correctOption: 'B',
    explanation:
      'A thermocouple has very low thermal capacity and responds quickly to rapid temperature variations.',
  },

  // Chemistry
  {
    id: 'chm-1',
    subjectCode: 'CHM',
    subjectName: 'Chemistry',
    topic: 'Stoichiometry',
    year: 2023,
    questionText:
      'How many moles are present in 10.6 g of anhydrous sodium trioxocarbonate(IV), Na₂CO₃? (Na = 23, C = 12, O = 16)',
    options: [
      { label: 'A', text: '0.05 mol' },
      { label: 'B', text: '0.10 mol' },
      { label: 'C', text: '0.20 mol' },
      { label: 'D', text: '1.00 mol' },
    ],
    correctOption: 'B',
    explanation: 'Molar mass of Na₂CO₃ = (2×23) + 12 + (3×16) = 106 g/mol. Moles = 10.6 / 106 = 0.10 mol.',
  },
  {
    id: 'chm-2',
    subjectCode: 'CHM',
    subjectName: 'Chemistry',
    topic: 'Acids & Bases',
    year: 2022,
    questionText: 'What is the pH of a 0.001 mol/dm³ aqueous solution of HCl?',
    options: [
      { label: 'A', text: '1' },
      { label: 'B', text: '2' },
      { label: 'C', text: '3' },
      { label: 'D', text: '4' },
    ],
    correctOption: 'C',
    explanation: 'HCl is a strong monoprotic acid: [H⁺] = 10⁻³ mol/dm³, so pH = -log₁₀(10⁻³) = 3.',
  },
  {
    id: 'chm-3',
    subjectCode: 'CHM',
    subjectName: 'Chemistry',
    topic: 'Organic Chemistry',
    year: 2024,
    questionText: 'Which homologous series has the general molecular formula CₙH₂ₙ₊₂?',
    options: [
      { label: 'A', text: 'Alkanes' },
      { label: 'B', text: 'Alkenes' },
      { label: 'C', text: 'Alkynes' },
      { label: 'D', text: 'Alkanols' },
    ],
    correctOption: 'A',
    explanation: 'Saturated hydrocarbons (alkanes) follow the general formula CₙH₂ₙ₊₂.',
  },
  {
    id: 'chm-4',
    subjectCode: 'CHM',
    subjectName: 'Chemistry',
    topic: 'Chemical Equilibrium',
    year: 2021,
    questionText:
      'For the reaction N₂(g) + 3H₂(g) ⇌ 2NH₃(g), ΔH = -92 kJ/mol. Increasing pressure at constant temperature will:',
    options: [
      { label: 'A', text: 'Shift equilibrium to the left' },
      { label: 'B', text: 'Shift equilibrium to the right' },
      { label: 'C', text: 'Have no effect on yield' },
      { label: 'D', text: 'Decrease the rate of reaction' },
    ],
    correctOption: 'B',
    explanation:
      'There are 4 moles of gas on the left and 2 moles on the right; higher pressure shifts equilibrium toward fewer gas moles (right).',
  },

  // Biology
  {
    id: 'bio-1',
    subjectCode: 'BIO',
    subjectName: 'Biology',
    topic: 'Cell Biology',
    year: 2023,
    questionText: 'Which organelle is primarily responsible for ATP synthesis during aerobic respiration?',
    options: [
      { label: 'A', text: 'Golgi apparatus' },
      { label: 'B', text: 'Mitochondrion' },
      { label: 'C', text: 'Lysosome' },
      { label: 'D', text: 'Centriole' },
    ],
    correctOption: 'B',
    explanation: 'Mitochondria carry out oxidative phosphorylation to generate cellular ATP.',
  },
  {
    id: 'bio-2',
    subjectCode: 'BIO',
    subjectName: 'Biology',
    topic: 'Genetics',
    year: 2022,
    questionText: 'In a monohybrid cross between two heterozygotes (Tt × Tt), what is the expected phenotypic ratio?',
    options: [
      { label: 'A', text: '1 : 1' },
      { label: 'B', text: '2 : 1' },
      { label: 'C', text: '3 : 1' },
      { label: 'D', text: '9 : 3 : 3 : 1' },
    ],
    correctOption: 'C',
    explanation: 'The genotypes 1 TT : 2 Tt : 1 tt produce 3 dominant phenotype to 1 recessive phenotype.',
  },
  {
    id: 'bio-3',
    subjectCode: 'BIO',
    subjectName: 'Biology',
    topic: 'Circulatory System',
    year: 2024,
    questionText: 'Which chamber of the mammalian heart pumps oxygenated blood directly into the aorta?',
    options: [
      { label: 'A', text: 'Right atrium' },
      { label: 'B', text: 'Right ventricle' },
      { label: 'C', text: 'Left atrium' },
      { label: 'D', text: 'Left ventricle' },
    ],
    correctOption: 'D',
    explanation: 'The thick-walled left ventricle contracts to pump oxygenated blood through the aorta to the body.',
  },
  {
    id: 'bio-4',
    subjectCode: 'BIO',
    subjectName: 'Biology',
    topic: 'Ecology',
    year: 2021,
    questionText: 'Which ecological instrument is used to measure the speed of wind?',
    options: [
      { label: 'A', text: 'Hygrometer' },
      { label: 'B', text: 'Anemometer' },
      { label: 'C', text: 'Barometer' },
      { label: 'D', text: 'Secchi disc' },
    ],
    correctOption: 'B',
    explanation: 'An anemometer measures wind speed, whereas a hygrometer measures relative humidity.',
  },
];

export default function SampleCbtPreview({
  candidateName = 'John Doe',
  registrationNumber = 'PREJAMB2026001',
  selectedSubjects,
  onClose,
}: SampleCbtPreviewProps) {
  const activeSubjects = useMemo(() => {
    const base = selectedSubjects && selectedSubjects.length === 4 ? selectedSubjects : DEFAULT_SUBJECTS;
    const bankCodes = new Set(SAMPLE_BANK.map((q) => q.subjectCode));
    const resolved: SampleSubject[] = [];
    for (const s of base) {
      if (bankCodes.has(s.code) && !resolved.some((r) => r.code === s.code)) {
        resolved.push(s);
      }
    }
    for (const fallback of DEFAULT_SUBJECTS) {
      if (resolved.length >= 4) break;
      if (!resolved.some((r) => r.code === fallback.code)) {
        resolved.push(fallback);
      }
    }
    return resolved;
  }, [selectedSubjects]);

  const questions = useMemo(() => {
    const ordered: SampleQuestion[] = [];
    for (const sub of activeSubjects) {
      ordered.push(...SAMPLE_BANK.filter((q) => q.subjectCode === sub.code));
    }
    return ordered;
  }, [activeSubjects]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(20 * 60);
  const [showGridDrawer, setShowGridDrawer] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setSubmitted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [submitted]);

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;
  const markedCount = Object.values(marked).filter(Boolean).length;

  const subjectMeta = useMemo(() => {
    return activeSubjects.map((sub) => {
      const items = questions
        .map((q, idx) => ({ q, idx }))
        .filter((entry) => entry.q.subjectCode === sub.code);
      const answered = items.filter((entry) => Boolean(answers[entry.q.id])).length;
      return {
        ...sub,
        total: items.length,
        answered,
        firstIndex: items[0]?.idx ?? 0,
      };
    });
  }, [activeSubjects, questions, answers]);

  const subjectPosition = useMemo(() => {
    if (!currentQuestion) return { pos: 1, total: questions.length };
    const list = questions.filter((q) => q.subjectCode === currentQuestion.subjectCode);
    const idx = list.findIndex((q) => q.id === currentQuestion.id);
    return { pos: idx >= 0 ? idx + 1 : 1, total: list.length };
  }, [questions, currentQuestion]);

  const scoreSummary = useMemo(() => {
    let correct = 0;
    const breakdown = activeSubjects.map((sub) => {
      const subQs = questions.filter((q) => q.subjectCode === sub.code);
      const subCorrect = subQs.filter((q) => answers[q.id] === q.correctOption).length;
      correct += subCorrect;
      const pct = subQs.length > 0 ? Math.round((subCorrect / subQs.length) * 100) : 0;
      return {
        ...sub,
        total: subQs.length,
        correct: subCorrect,
        percentage: pct,
      };
    });
    const pct = questions.length > 0 ? (correct / questions.length) * 100 : 0;
    const scoreOutOf400 = Math.round((pct / 100) * 400);
    return { correct, total: questions.length, percentage: pct, scoreOutOf400, breakdown };
  }, [activeSubjects, questions, answers]);

  const handleRestart = () => {
    setAnswers({});
    setMarked({});
    setCurrentIndex(0);
    setRemainingSeconds(20 * 60);
    setSubmitted(false);
    setShowConfirmModal(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F2F4F7] text-[#111827] dark:bg-slate-950 dark:text-slate-100">
        <header className="sticky top-0 z-30 border-b border-[#094D25] bg-[#0B5E2E] text-white">
          <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return</span>
            </button>
            <button
              type="button"
              onClick={handleRestart}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-white/40 bg-[#094D25] px-3 text-xs font-bold text-white hover:bg-[#084722]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Retake Sample</span>
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-4xl space-y-4 px-4 py-5">
          <div className="rounded-md border border-[#CBD5E1] bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold tracking-wide text-[#0B5E2E] uppercase dark:text-emerald-400">
              Sample CBT Result Summary
            </p>
            <h1 className="mt-1 font-display text-xl font-bold text-[#111827] dark:text-white">
              {candidateName}
            </h1>
            <p className="mt-0.5 font-mono text-xs text-[#4B5563] tabular-nums dark:text-slate-400">
              {registrationNumber} · UTME Practice Preview
            </p>

            <div className="mt-4 grid grid-cols-2 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="border-r border-b border-[#CBD5E1] p-3.5 sm:border-b-0 dark:border-slate-800">
                <p className="text-xs font-medium text-[#4B5563] dark:text-slate-400">UTME Score</p>
                <p className="mt-1 font-mono text-2xl font-bold text-[#0B5E2E] tabular-nums dark:text-emerald-400">
                  {scoreSummary.scoreOutOf400}/400
                </p>
              </div>
              <div className="border-b border-[#CBD5E1] p-3.5 sm:border-r sm:border-b-0 dark:border-slate-800">
                <p className="text-xs font-medium text-[#4B5563] dark:text-slate-400">Accuracy</p>
                <p className="mt-1 font-mono text-2xl font-bold text-[#111827] tabular-nums dark:text-white">
                  {scoreSummary.percentage.toFixed(0)}%
                </p>
              </div>
              <div className="border-r border-[#CBD5E1] p-3.5 dark:border-slate-800">
                <p className="text-xs font-medium text-[#4B5563] dark:text-slate-400">Correct</p>
                <p className="mt-1 font-mono text-2xl font-bold text-[#16A34A] tabular-nums dark:text-emerald-400">
                  {scoreSummary.correct}/{scoreSummary.total}
                </p>
              </div>
              <div className="p-3.5">
                <p className="text-xs font-medium text-[#4B5563] dark:text-slate-400">Unanswered</p>
                <p className="mt-1 font-mono text-2xl font-bold text-[#111827] tabular-nums dark:text-white">
                  {unansweredCount}
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-md border border-[#CBD5E1] dark:border-slate-800">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-[#CBD5E1] bg-[#F3F4F6] text-[#374151] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-3.5 py-2.5 font-semibold">Subject</th>
                    <th className="px-3.5 py-2.5 text-right font-semibold">Correct</th>
                    <th className="px-3.5 py-2.5 text-right font-semibold">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] dark:divide-slate-800">
                  {scoreSummary.breakdown.map((b) => (
                    <tr key={b.code}>
                      <td className="px-3.5 py-2.5 font-semibold text-[#111827] dark:text-white">{b.name}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                        {b.correct}/{b.total}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-[#0B5E2E] tabular-nums dark:text-emerald-400">
                        {b.percentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-display text-base font-bold text-[#111827] dark:text-white">
              Corrections &amp; Explanations
            </h2>
            {questions.map((q, idx) => {
              const picked = answers[q.id];
              const isRight = picked === q.correctOption;
              return (
                <div
                  key={q.id}
                  className="rounded-md border border-[#CBD5E1] bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] pb-2.5 dark:border-slate-800">
                    <span className="text-xs font-semibold text-[#4B5563] dark:text-slate-400">
                      Item {idx + 1} · {q.subjectName}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-bold ${
                        isRight ? 'text-[#16A34A] dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {isRight ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {isRight ? 'Correct' : picked ? `Wrong (Picked ${picked})` : 'Unanswered'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed font-medium text-[#111827] dark:text-slate-100">
                    {q.questionText}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[#0B5E2E] dark:text-emerald-400">
                    Correct Option: {q.correctOption}.{' '}
                    {q.options.find((o) => o.label === q.correctOption)?.text}
                  </p>
                  <p className="mt-2 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-xs leading-relaxed text-[#374151] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    <strong className="text-[#111827] dark:text-white">Explanation:</strong> {q.explanation}
                  </p>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F2F4F7] text-[#111827] dark:bg-slate-950 dark:text-slate-100">
      {/* Deep Green Official CBT Header */}
      <header className="sticky top-0 z-30 border-b border-[#CBD5E1] bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[#0B5E2E] text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <BrandEmblem sizeClass="h-9 w-9" />
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold text-white sm:text-base">
                  Pre-JAMB Academy CBT
                </p>
                <p className="truncate text-[11px] font-medium text-emerald-100">
                  UTME Practice Examination Preview
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3 sm:gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-bold text-white uppercase">Candidate: {candidateName}</p>
                <p className="font-mono text-[11px] text-emerald-100 tabular-nums">
                  Reg. No: {registrationNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-white/40 bg-[#094D25] px-3 text-xs font-bold text-white hover:bg-[#084722]"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Exit</span>
              </button>
            </div>
          </div>
        </div>

        {/* Light Grey Sub-Header */}
        <div className="border-b border-[#CBD5E1] bg-[#F3F4F6] dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-5">
            <span className="font-display text-sm font-bold text-[#111827] sm:text-base dark:text-white">
              {currentQuestion?.subjectName}
            </span>

            <div className="flex shrink-0 items-center gap-2">
              <div className="flex h-9 items-center gap-2 rounded-md border border-[#CBD5E1] bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
                <span className="hidden text-xs font-semibold text-[#374151] sm:inline dark:text-slate-300">
                  Time Remaining:
                </span>
                <span className="font-mono text-sm font-bold text-[#DC2626] tabular-nums sm:text-base dark:text-rose-400">
                  {formatDuration(remainingSeconds)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="inline-flex h-9 items-center justify-center rounded-md bg-[#0B5E2E] px-3.5 text-xs font-bold text-white hover:bg-[#084722]"
              >
                Submit
              </button>
            </div>
          </div>
        </div>

        {/* 4-Subject Switcher Tabs */}
        <div className="bg-white dark:bg-slate-950">
          <div className="mx-auto flex max-w-7xl items-center gap-1.5 overflow-x-auto px-4 py-1.5 sm:px-5">
            {subjectMeta.map((sub) => {
              const active = currentQuestion?.subjectCode === sub.code;
              return (
                <button
                  key={sub.code}
                  type="button"
                  onClick={() => setCurrentIndex(sub.firstIndex)}
                  className={`flex min-h-[34px] shrink-0 items-center gap-2 rounded-md border px-3 py-1 text-xs font-bold whitespace-nowrap ${
                    active
                      ? 'border-[#0B5E2E] bg-[#0B5E2E] text-white'
                      : 'border-[#CBD5E1] bg-[#F8FAFC] text-[#111827] hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                  }`}
                >
                  <span>{sub.name}</span>
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      active ? 'text-emerald-100' : 'text-[#4B5563] dark:text-slate-400'
                    }`}
                  >
                    {sub.answered}/{sub.total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Two-Column CBT Stage */}
      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-4 px-4 py-4 pb-24 sm:px-5 lg:grid-cols-12 lg:py-5 lg:pb-6">
        <section className="lg:col-span-8">
          {currentQuestion && (
            <div className="flex h-full flex-col justify-between overflow-hidden rounded-md border border-[#CBD5E1] bg-white dark:border-slate-800 dark:bg-slate-900">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#CBD5E1] bg-[#DCEAFB] px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-sm font-bold text-[#111827] sm:text-base dark:text-white">
                      Question {subjectPosition.pos} of {subjectPosition.total}
                    </h1>
                    <span className="text-xs font-medium text-[#374151] dark:text-slate-300">
                      ({currentQuestion.topic}
                      {currentQuestion.year ? ` · UTME ${currentQuestion.year}` : ''})
                    </span>
                  </div>
                  {answers[currentQuestion.id] && (
                    <button
                      type="button"
                      onClick={() =>
                        setAnswers((prev) => {
                          const next = { ...prev };
                          delete next[currentQuestion.id];
                          return next;
                        })
                      }
                      className="min-h-[30px] rounded-md border border-[#94A3B8] bg-white px-2.5 text-xs font-semibold text-[#111827] hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    >
                      Clear Answer
                    </button>
                  )}
                </div>

                <div className="p-4 sm:p-6">
                  <p className="mb-5 text-base leading-[1.65] font-medium whitespace-pre-line text-[#111827] sm:text-[17px] dark:text-slate-100">
                    {currentQuestion.questionText}
                  </p>

                  <div className="space-y-2.5" role="radiogroup" aria-label="Answer choices">
                    {currentQuestion.options.map((opt) => {
                      const selected = answers[currentQuestion.id] === opt.label;
                      return (
                        <label
                          key={opt.label}
                          className={`flex min-h-[48px] w-full cursor-pointer items-center gap-3 rounded-md border px-3.5 py-2.5 ${
                            selected
                              ? 'border-[#0B5E2E] bg-emerald-50 text-[#111827] dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-white'
                              : 'border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`sample-${currentQuestion.id}`}
                            checked={selected}
                            onChange={() =>
                              setAnswers((prev) => ({
                                ...prev,
                                [currentQuestion.id]: opt.label,
                              }))
                            }
                            className="h-4 w-4 shrink-0 accent-[#0B5E2E]"
                          />
                          <span className="font-mono text-sm font-bold text-[#111827] dark:text-white">
                            {opt.label}.
                          </span>
                          <span className="text-sm whitespace-pre-line sm:text-base">{opt.text}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="hidden border-t border-[#E5E7EB] bg-[#F9FAFB] px-6 py-4 lg:flex lg:items-center lg:justify-between dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    className="inline-flex min-h-[42px] items-center justify-center rounded-md bg-[#0B5E2E] px-5 py-2 text-sm font-bold text-white hover:bg-[#084722] disabled:opacity-45"
                  >
                    &lt;&lt; Previous
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      currentQuestion &&
                      setMarked((prev) => ({
                        ...prev,
                        [currentQuestion.id]: !prev[currentQuestion.id],
                      }))
                    }
                    className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-semibold ${
                      currentQuestion && marked[currentQuestion.id]
                        ? 'border-[#D97706] bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'border-[#CBD5E1] bg-white text-[#111827] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <Bookmark className="h-4 w-4" />
                    <span>{currentQuestion && marked[currentQuestion.id] ? 'Marked' : 'Mark'}</span>
                  </button>
                </div>

                {currentIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                    className="inline-flex min-h-[42px] items-center justify-center rounded-md bg-[#0B5E2E] px-6 py-2 text-sm font-bold text-white hover:bg-[#084722]"
                  >
                    Next &gt;&gt;
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(true)}
                    className="inline-flex min-h-[42px] items-center justify-center rounded-md bg-[#0B5E2E] px-6 py-2 text-sm font-bold text-white hover:bg-[#084722]"
                  >
                    Submit Examination
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Question Palette (Desktop right column + Mobile/Tablet inline below question) */}
        <aside className="lg:col-span-4">
          <div className="overflow-hidden rounded-md border border-[#CBD5E1] bg-white lg:sticky lg:top-28 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between bg-[#0B5E2E] px-4 py-2.5 text-white">
              <h2 className="font-display text-sm font-bold">Question Palette</h2>
              <span className="font-mono text-xs font-semibold text-emerald-100 tabular-nums">
                {answeredCount}/{questions.length}
              </span>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-4 gap-1.5">
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const isAnswered = Boolean(answers[q.id]);
                  const isMarked = Boolean(marked[q.id]);
                  let cls =
                    'border-[#CBD5E1] bg-white text-[#111827] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
                  if (isCurrent) cls = 'border-[#2563EB] bg-[#2563EB] text-white';
                  else if (isMarked) cls = 'border-[#D97706] bg-[#D97706] text-white';
                  else if (isAnswered) cls = 'border-[#16A34A] bg-[#16A34A] text-white';
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`flex h-9 items-center justify-center rounded-sm border font-mono text-xs font-bold tabular-nums ${cls}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 space-y-1.5 border-t border-[#E5E7EB] pt-3 text-xs dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-xs bg-[#2563EB]" />
                  <span className="text-[#374151] dark:text-slate-300">Current</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-xs bg-[#16A34A]" />
                  <span className="text-[#374151] dark:text-slate-300">Answered ({answeredCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-xs border border-[#94A3B8] bg-white dark:bg-slate-800" />
                  <span className="text-[#374151] dark:text-slate-300">Not Answered ({unansweredCount})</span>
                </div>
                {markedCount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-xs bg-[#D97706]" />
                    <span className="text-[#374151] dark:text-slate-300">Marked ({markedCount})</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="mt-4 min-h-[42px] w-full rounded-md bg-[#0B5E2E] py-2 text-sm font-bold text-white hover:bg-[#084722]"
              >
                Submit Examination
              </button>
            </div>
          </div>
        </aside>
      </main>

      <footer className="hidden border-t border-[#CBD5E1] bg-[#E5E7EB] px-5 py-2.5 text-xs text-[#374151] lg:block dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <span className="font-semibold">JAMB UTME CBT Examination</span>
          <span className="font-semibold text-[#0B5E2E] dark:text-emerald-400">Pre-JAMB Academy CBT</span>
        </div>
      </footer>

      {/* Mobile Fixed Controls */}
      <nav
        aria-label="Exam navigation controls"
        className="fixed right-0 bottom-0 left-0 z-30 border-t border-[#CBD5E1] bg-white px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] lg:hidden dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mx-auto grid max-w-4xl grid-cols-4 gap-2">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            className="flex min-h-[44px] items-center justify-center rounded-md border border-[#CBD5E1] bg-white text-xs font-bold text-[#111827] disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            &lt;&lt; Prev
          </button>

          <button
            type="button"
            onClick={() =>
              currentQuestion &&
              setMarked((prev) => ({
                ...prev,
                [currentQuestion.id]: !prev[currentQuestion.id],
              }))
            }
            className={`flex min-h-[44px] items-center justify-center gap-1 rounded-md border text-xs font-bold ${
              currentQuestion && marked[currentQuestion.id]
                ? 'border-[#D97706] bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                : 'border-[#CBD5E1] bg-white text-[#111827] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>{currentQuestion && marked[currentQuestion.id] ? 'Marked' : 'Mark'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowGridDrawer(true)}
            className="flex min-h-[44px] items-center justify-center gap-1 rounded-md border border-[#CBD5E1] bg-[#F2F4F7] text-xs font-bold text-[#111827] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Grid className="h-3.5 w-3.5 text-[#0B5E2E]" />
            <span>Palette</span>
          </button>

          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              className="flex min-h-[44px] items-center justify-center rounded-md bg-[#0B5E2E] text-xs font-bold text-white hover:bg-[#084722]"
            >
              Next &gt;&gt;
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="flex min-h-[44px] items-center justify-center rounded-md bg-[#0B5E2E] text-xs font-bold text-white hover:bg-[#084722]"
            >
              Submit
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Palette Drawer */}
      {showGridDrawer && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50"
          onClick={() => setShowGridDrawer(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-lg border-t border-[#CBD5E1] bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-3 flex items-center justify-between border-b border-[#E5E7EB] pb-2.5 dark:border-slate-800">
              <h3 className="font-display text-sm font-bold text-[#0B5E2E] dark:text-emerald-400">
                Question Palette ({answeredCount}/{questions.length} Answered)
              </h3>
              <button
                type="button"
                onClick={() => setShowGridDrawer(false)}
                aria-label="Close question palette"
                className="flex h-10 w-10 items-center justify-center rounded-md text-[#4B5563] hover:bg-slate-100 dark:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid max-h-60 grid-cols-5 gap-2 overflow-y-auto">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = Boolean(answers[q.id]);
                const isMarked = Boolean(marked[q.id]);
                let cls =
                  'border-[#CBD5E1] bg-white text-[#111827] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
                if (isCurrent) cls = 'border-[#2563EB] bg-[#2563EB] text-white';
                else if (isMarked) cls = 'border-[#D97706] bg-[#D97706] text-white';
                else if (isAnswered) cls = 'border-[#16A34A] bg-[#16A34A] text-white';
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowGridDrawer(false);
                    }}
                    className={`flex h-11 items-center justify-center rounded-sm border font-mono text-xs font-bold tabular-nums ${cls}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap gap-3 border-t border-[#E5E7EB] pt-3 text-xs text-[#374151] dark:border-slate-800 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs bg-[#2563EB]" /> Current
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs bg-[#16A34A]" /> Answered ({answeredCount})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs border border-[#94A3B8] bg-white dark:bg-slate-800" /> Not Answered ({unansweredCount})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs bg-[#D97706]" /> Marked ({markedCount})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Submission Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-md border border-[#CBD5E1] bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-lg font-bold text-[#111827] dark:text-white">
              Submit Sample Examination?
            </h3>
            <p className="mt-1 text-sm text-[#4B5563] dark:text-slate-400">
              Review your progress below before viewing your sample UTME score.
            </p>

            <div className="mt-4 grid grid-cols-3 rounded-md border border-[#CBD5E1] bg-[#F2F4F7] text-center dark:border-slate-800 dark:bg-slate-950">
              <div className="border-r border-[#CBD5E1] p-3 dark:border-slate-800">
                <p className="font-mono text-lg font-bold text-[#16A34A] tabular-nums">{answeredCount}</p>
                <p className="text-xs text-[#4B5563] dark:text-slate-400">Answered</p>
              </div>
              <div className="border-r border-[#CBD5E1] p-3 dark:border-slate-800">
                <p className="font-mono text-lg font-bold text-[#111827] tabular-nums dark:text-white">
                  {unansweredCount}
                </p>
                <p className="text-xs text-[#4B5563] dark:text-slate-400">Not Answered</p>
              </div>
              <div className="p-3">
                <p className="font-mono text-lg font-bold text-[#D97706] tabular-nums">{markedCount}</p>
                <p className="text-xs text-[#4B5563] dark:text-slate-400">Marked</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="min-h-[44px] rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-bold text-[#111827] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Continue Exam
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setSubmitted(true);
                }}
                className="min-h-[44px] rounded-md bg-[#0B5E2E] px-3 text-xs font-bold text-white hover:bg-[#084722]"
              >
                Submit Exam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
