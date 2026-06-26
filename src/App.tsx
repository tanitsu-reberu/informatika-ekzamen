import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  Gamepad2,
  GraduationCap,
  Sparkles,
  Star,
  Target,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { achievements, allQuestions, tickets, type Achievement, type Question } from './data'

type View = 'home' | 'training' | 'exam' | 'examResult' | 'achievements' | 'interactive'

type ExamAnswer = {
  questionId: string
  selectedIndex: number
}

type ProgressState = {
  known: Record<string, boolean>
  points: number
  streak: number
  bestStreak: number
  achievements: string[]
  mistakes: string[]
  examsPassed: number
  interactiveDone: Record<string, boolean>
}

const initialProgress: ProgressState = {
  known: {},
  points: 0,
  streak: 0,
  bestStreak: 0,
  achievements: [],
  mistakes: [],
  examsPassed: 0,
  interactiveDone: {},
}

const storageKey = 'informatika-exam-progress-v1'

const achievementIcons: Record<string, typeof Sparkles> = {
  Sparkles,
  BadgeCheck,
  Flame,
  GraduationCap,
  Trophy,
  Gamepad2,
}

function loadProgress(): ProgressState {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? { ...initialProgress, ...JSON.parse(raw) } : initialProgress
  } catch {
    return initialProgress
  }
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5)
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export default function App() {
  const [view, setView] = useState<View>('home')
  const [progress, setProgress] = useState<ProgressState>(loadProgress)
  const [activeTicketId, setActiveTicketId] = useState(1)
  const [trainingIndex, setTrainingIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [examQuestions, setExamQuestions] = useState<Question[]>([])
  const [examIndex, setExamIndex] = useState(0)
  const [examAnswers, setExamAnswers] = useState<ExamAnswer[]>([])
  const [examTimeLeft, setExamTimeLeft] = useState(8 * 60)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(progress))
  }, [progress])

  useEffect(() => {
    if (view !== 'exam') return
    if (examTimeLeft <= 0) {
      finishExam()
      return
    }
    const timer = window.setInterval(() => setExamTimeLeft((value) => value - 1), 1000)
    return () => window.clearInterval(timer)
  }, [view, examTimeLeft])

  const activeTicket = tickets.find((ticket) => ticket.id === activeTicketId) ?? tickets[0]
  const currentTrainingQuestion = activeTicket.questions[trainingIndex]
  const knownTotal = Object.values(progress.known).filter(Boolean).length
  const totalProgress = Math.round((knownTotal / allQuestions.length) * 100)

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  const unlock = (id: string) => {
    setProgress((state) => {
      if (state.achievements.includes(id)) return state
      const item = achievements.find((achievement) => achievement.id === id)
      if (item) showToast(`Достижение: ${item.title}`)
      return { ...state, achievements: [...state.achievements, id] }
    })
  }

  const updateScore = (correct: boolean, questionId: string) => {
    setProgress((state) => {
      const nextStreak = correct ? state.streak + 1 : 0
      const mistakes = correct
        ? state.mistakes.filter((id) => id !== questionId)
        : Array.from(new Set([...state.mistakes, questionId]))
      return {
        ...state,
        points: state.points + (correct ? 10 + Math.min(state.streak, 5) : 0),
        streak: nextStreak,
        bestStreak: Math.max(state.bestStreak, nextStreak),
        mistakes,
      }
    })
    if (correct) unlock('first_correct')
    if (correct && progress.streak + 1 >= 5) unlock('streak_5')
  }

  const markKnown = (question: Question, known: boolean) => {
    setProgress((state) => {
      const nextKnown = { ...state.known, [question.id]: known }
      const ticketComplete = activeTicket.questions.every((item) => nextKnown[item.id])
      if (ticketComplete) window.setTimeout(() => unlock('first_ticket'), 0)
      return { ...state, known: nextKnown }
    })
    if (!known) {
      setProgress((state) => ({ ...state, mistakes: Array.from(new Set([...state.mistakes, question.id])) }))
    }
    goNextTraining()
  }

  const answerTraining = (index: number) => {
    if (selectedAnswer !== null) return
    setSelectedAnswer(index)
    updateScore(index === currentTrainingQuestion.answerIndex, currentTrainingQuestion.id)
  }

  const goNextTraining = () => {
    setSelectedAnswer(null)
    setTrainingIndex((index) => (index + 1) % activeTicket.questions.length)
  }

  const startTraining = (ticketId: number) => {
    setActiveTicketId(ticketId)
    setTrainingIndex(0)
    setSelectedAnswer(null)
    setView('training')
  }

  const startExam = (source?: Question[]) => {
    const pool = source?.length ? source : allQuestions
    setExamQuestions(shuffle(pool).slice(0, Math.min(10, pool.length)))
    setExamIndex(0)
    setExamAnswers([])
    setExamTimeLeft(8 * 60)
    setView('exam')
  }

  const answerExam = (index: number) => {
    const question = examQuestions[examIndex]
    const nextAnswers = [...examAnswers, { questionId: question.id, selectedIndex: index }]
    setExamAnswers(nextAnswers)
    if (examIndex + 1 >= examQuestions.length) {
      finishExam(nextAnswers)
      return
    }
    setExamIndex((value) => value + 1)
  }

  const finishExam = (answers = examAnswers) => {
    const wrongIds = examQuestions
      .filter((question) => answers.find((answer) => answer.questionId === question.id)?.selectedIndex !== question.answerIndex)
      .map((question) => question.id)
    const correctCount = examQuestions.length - wrongIds.length
    setProgress((state) => ({
      ...state,
      points: state.points + correctCount * 15,
      examsPassed: state.examsPassed + 1,
      mistakes: Array.from(new Set([...state.mistakes, ...wrongIds])),
    }))
    unlock('exam_done')
    if (wrongIds.length === 0 && examQuestions.length > 0) unlock('perfect_exam')
    setView('examResult')
  }

  const resetProgress = () => {
    setProgress(initialProgress)
    localStorage.removeItem(storageKey)
    showToast('Прогресс сброшен')
  }

  const completeInteractive = (id: string) => {
    setProgress((state) => {
      const next = { ...state.interactiveDone, [id]: true }
      if (['truth', 'base', 'sql'].every((key) => next[key])) window.setTimeout(() => unlock('interactive_master'), 0)
      return { ...state, points: state.points + 20, interactiveDone: next }
    })
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(244,63,94,0.12),transparent_30%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <Header
          progress={progress}
          totalProgress={totalProgress}
          onHome={() => setView('home')}
          onExam={() => startExam()}
          onInteractive={() => setView('interactive')}
          onAchievements={() => setView('achievements')}
        />

        {view === 'home' && (
          <HomeView
            progress={progress}
            totalProgress={totalProgress}
            onTraining={startTraining}
            onExam={() => startExam()}
            onRepeatMistakes={() => startExam(progress.mistakes.map((id) => allQuestions.find((question) => question.id === id)).filter(Boolean) as Question[])}
            onInteractive={() => setView('interactive')}
            onReset={resetProgress}
          />
        )}

        {view === 'training' && (
          <TrainingView
            ticket={activeTicket}
            question={currentTrainingQuestion}
            index={trainingIndex}
            selectedAnswer={selectedAnswer}
            known={progress.known[currentTrainingQuestion.id]}
            onBack={() => setView('home')}
            onAnswer={answerTraining}
            onKnow={() => markKnown(currentTrainingQuestion, true)}
            onDontKnow={() => markKnown(currentTrainingQuestion, false)}
            onNext={goNextTraining}
          />
        )}

        {view === 'exam' && (
          <ExamView
            question={examQuestions[examIndex]}
            index={examIndex}
            total={examQuestions.length}
            timeLeft={examTimeLeft}
            onAnswer={answerExam}
            onFinish={() => finishExam()}
          />
        )}

        {view === 'examResult' && (
          <ExamResult
            questions={examQuestions}
            answers={examAnswers}
            onHome={() => setView('home')}
            onRepeatWrong={(items) => startExam(items)}
          />
        )}

        {view === 'interactive' && (
          <InteractiveView
            done={progress.interactiveDone}
            onComplete={completeInteractive}
            onBack={() => setView('home')}
          />
        )}

        {view === 'achievements' && (
          <AchievementsView progress={progress} onBack={() => setView('home')} />
        )}
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100 shadow-2xl backdrop-blur">
          {toast}
        </div>
      )}
    </main>
  )
}

function Header({
  progress,
  totalProgress,
  onHome,
  onExam,
  onInteractive,
  onAchievements,
}: {
  progress: ProgressState
  totalProgress: number
  onHome: () => void
  onExam: () => void
  onInteractive: () => void
  onAchievements: () => void
}) {
  return (
    <header className="sticky top-0 z-40 -mx-4 border-b border-white/10 bg-slate-950/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <button onClick={onHome} className="flex items-center gap-3 text-left transition hover:opacity-90">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/20">
            <Brain size={24} />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">Информатика: Экзамен</p>
            <p className="text-xs text-slate-400">11 билетов, тренировка, экзамен, интерактив</p>
          </div>
        </button>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <StatBadge icon={<Star size={16} />} label="Очки" value={progress.points} />
          <StatBadge icon={<Flame size={16} />} label="Серия" value={progress.streak} />
          <StatBadge icon={<Target size={16} />} label="Прогресс" value={`${totalProgress}%`} />
          <button onClick={onExam} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 active:scale-[0.98]">
            Экзамен
          </button>
          <button onClick={onInteractive} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/60 hover:text-cyan-100 active:scale-[0.98]">
            Практика
          </button>
          <button onClick={onAchievements} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-amber-300/60 hover:text-amber-100 active:scale-[0.98]">
            Награды
          </button>
        </div>
      </div>
    </header>
  )
}

function StatBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-slate-400">{icon}{label}</div>
      <div className="text-sm font-bold text-slate-100">{value}</div>
    </div>
  )
}

function HomeView({
  progress,
  totalProgress,
  onTraining,
  onExam,
  onRepeatMistakes,
  onInteractive,
  onReset,
}: {
  progress: ProgressState
  totalProgress: number
  onTraining: (ticketId: number) => void
  onExam: () => void
  onRepeatMistakes: () => void
  onInteractive: () => void
  onReset: () => void
}) {
  return (
    <section className="py-8">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 sm:p-7">
          <div className="mb-8 max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
              <Zap size={14} /> Быстрое повторение перед экзаменом
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">Тренируй билеты как игру, а не как стопку конспектов.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">Карточки, объяснения, повтор ошибок, очки, серии и мини-тренажёры по логике, системам счисления и SQL.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <ActionButton icon={<BookOpen />} title="Начать тренировку" text="Выбери билет ниже" onClick={() => onTraining(1)} />
            <ActionButton icon={<GraduationCap />} title="Экзамен" text="10 случайных вопросов" onClick={onExam} />
            <ActionButton icon={<Gamepad2 />} title="Интерактив" text="Таблица, перевод, SQL" onClick={onInteractive} />
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Статистика</h2>
            <BarChart3 className="text-cyan-300" />
          </div>
          <div className="mt-5 space-y-4">
            <ProgressLine label="Общий прогресс" value={totalProgress} />
            <ProgressLine label="Лучший streak" value={Math.min(100, progress.bestStreak * 10)} caption={`${progress.bestStreak} подряд`} />
            <ProgressLine label="Достижения" value={Math.round((progress.achievements.length / achievements.length) * 100)} caption={`${progress.achievements.length}/${achievements.length}`} />
          </div>
          <div className="mt-6 grid gap-2">
            <button disabled={!progress.mistakes.length} onClick={onRepeatMistakes} className="rounded-xl bg-rose-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">
              Повторить ошибки ({progress.mistakes.length})
            </button>
            <button onClick={onReset} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-rose-300/50 hover:text-rose-100">
              Сбросить прогресс
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tickets.map((ticket, index) => {
          const known = ticket.questions.filter((question) => progress.known[question.id]).length
          const percent = Math.round((known / ticket.questions.length) * 100)
          return (
            <article
              key={ticket.id}
              className="group rounded-3xl border border-white/10 bg-white/[0.035] p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-white/[0.06] motion-reduce:transform-none"
              style={{ animationDelay: `${index * 45}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-400">{ticket.subtitle}</p>
                  <h3 className="mt-1 text-2xl font-bold text-white">{ticket.title}</h3>
                </div>
                <div className="rounded-2xl bg-slate-800 px-3 py-2 text-sm font-bold text-cyan-200">{known}/{ticket.questions.length}</div>
              </div>
              <div className="mt-5">
                <ProgressBar value={percent} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={() => onTraining(ticket.id)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 active:scale-[0.98]">
                  Начать тренировку <ChevronRight size={16} />
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function ActionButton({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-slate-900 active:scale-[0.98] motion-reduce:transform-none">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-200">{icon}</div>
      <div className="font-bold text-white">{title}</div>
      <div className="text-sm text-slate-400">{text}</div>
    </button>
  )
}

function ProgressLine({ label, value, caption }: { label: string; value: number; caption?: string }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-semibold text-cyan-200">{caption ?? `${value}%`}</span>
      </div>
      <ProgressBar value={value} />
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
      <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-all duration-500" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  )
}

function TrainingView({
  ticket,
  question,
  index,
  selectedAnswer,
  known,
  onBack,
  onAnswer,
  onKnow,
  onDontKnow,
  onNext,
}: {
  ticket: { title: string; questions: Question[] }
  question: Question
  index: number
  selectedAnswer: number | null
  known?: boolean
  onBack: () => void
  onAnswer: (index: number) => void
  onKnow: () => void
  onDontKnow: () => void
  onNext: () => void
}) {
  const answered = selectedAnswer !== null
  const correct = selectedAnswer === question.answerIndex
  const percent = Math.round(((index + Number(answered)) / ticket.questions.length) * 100)

  return (
    <section className="mx-auto w-full max-w-4xl py-8">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white">
        <ArrowLeft size={16} /> Все билеты
      </button>
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 sm:p-7">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-cyan-200">{ticket.title} · вопрос {index + 1}/{ticket.questions.length}</p>
            <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Тренировка</h1>
          </div>
          <div className={cn('rounded-xl px-3 py-2 text-sm font-semibold', known ? 'bg-emerald-400/15 text-emerald-200' : 'bg-slate-800 text-slate-300')}>
            {known ? 'Изучено' : 'На повторении'}
          </div>
        </div>
        <ProgressBar value={percent} />
        <QuestionCard question={question} selectedAnswer={selectedAnswer} onAnswer={onAnswer} />
        {answered && (
          <div className={cn('mt-5 rounded-2xl border p-4', correct ? 'border-emerald-300/30 bg-emerald-300/10' : 'border-rose-300/30 bg-rose-300/10')}>
            <div className="flex items-center gap-2 font-bold">{correct ? <Check /> : <X />} {correct ? 'Верно' : 'Нужно повторить'}</div>
            <p className="mt-2 text-sm leading-6 text-slate-200">{question.explanation}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button onClick={onKnow} className="rounded-xl bg-emerald-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-200">Знаю</button>
              <button onClick={onDontKnow} className="rounded-xl bg-rose-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-rose-200">Не знаю</button>
              <button onClick={onNext} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-100 transition hover:border-cyan-300/50">Дальше</button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function QuestionCard({ question, selectedAnswer, onAnswer }: { question: Question; selectedAnswer: number | null; onAnswer: (index: number) => void }) {
  return (
    <div className="mt-6">
      <div className="rounded-2xl bg-slate-950/70 p-5">
        <div className="mb-3 inline-flex rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">{question.category}</div>
        <h2 className="text-xl font-bold leading-snug text-white">{question.text}</h2>
      </div>
      <div className="mt-4 grid gap-3">
        {question.options.map((option, index) => {
          const answered = selectedAnswer !== null
          const isCorrect = index === question.answerIndex
          const isSelected = index === selectedAnswer
          return (
            <button
              key={option}
              disabled={answered}
              onClick={() => onAnswer(index)}
              className={cn(
                'rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition duration-200 active:scale-[0.99]',
                !answered && 'border-white/10 bg-white/[0.04] hover:border-cyan-300/50 hover:bg-cyan-300/10',
                answered && isCorrect && 'border-emerald-300/50 bg-emerald-300/15 text-emerald-100',
                answered && isSelected && !isCorrect && 'border-rose-300/50 bg-rose-300/15 text-rose-100',
                answered && !isSelected && !isCorrect && 'border-white/10 bg-white/[0.02] text-slate-500',
              )}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ExamView({
  question,
  index,
  total,
  timeLeft,
  onAnswer,
  onFinish,
}: {
  question?: Question
  index: number
  total: number
  timeLeft: number
  onAnswer: (index: number) => void
  onFinish: () => void
}) {
  if (!question) return null
  return (
    <section className="mx-auto w-full max-w-4xl py-8">
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-slate-300"><GraduationCap size={18} /> Экзамен {index + 1}/{total}</div>
        <div className="flex items-center gap-2 text-sm font-bold text-amber-200"><Clock3 size={18} /> {formatTime(timeLeft)}</div>
      </div>
      <ProgressBar value={Math.round((index / total) * 100)} />
      <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
        <QuestionCard question={question} selectedAnswer={null} onAnswer={onAnswer} />
        <button onClick={onFinish} className="mt-5 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-rose-300/50 hover:text-rose-100">
          Завершить досрочно
        </button>
      </div>
    </section>
  )
}

function ExamResult({ questions, answers, onHome, onRepeatWrong }: { questions: Question[]; answers: ExamAnswer[]; onHome: () => void; onRepeatWrong: (items: Question[]) => void }) {
  const wrong = questions.filter((question) => answers.find((answer) => answer.questionId === question.id)?.selectedIndex !== question.answerIndex)
  const correct = questions.length - wrong.length
  const percent = questions.length ? Math.round((correct / questions.length) * 100) : 0

  return (
    <section className="mx-auto w-full max-w-5xl py-8">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-cyan-200">Результат экзамена</p>
            <h1 className="text-4xl font-black text-white">{correct}/{questions.length} · {percent}%</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={onHome} className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950">На главную</button>
            <button disabled={!wrong.length} onClick={() => onRepeatWrong(wrong)} className="rounded-xl bg-rose-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:bg-slate-700 disabled:text-slate-400">Повторить ошибки</button>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {wrong.length === 0 ? (
            <div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-emerald-100">Ошибок нет. Отличный пробный прогон.</div>
          ) : (
            wrong.map((question) => {
              const answer = answers.find((item) => item.questionId === question.id)
              return (
                <div key={question.id} className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4">
                  <div className="font-bold text-white">{question.text}</div>
                  <div className="mt-2 text-sm text-rose-100">Ваш ответ: {answer ? question.options[answer.selectedIndex] : 'нет ответа'}</div>
                  <div className="text-sm text-emerald-100">Правильно: {question.options[question.answerIndex]}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{question.explanation}</p>
                </div>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}

function InteractiveView({ done, onComplete, onBack }: { done: Record<string, boolean>; onComplete: (id: string) => void; onBack: () => void }) {
  return (
    <section className="py-8">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white">
        <ArrowLeft size={16} /> На главную
      </button>
      <div className="mb-6">
        <h1 className="text-4xl font-black text-white">Интерактивная практика</h1>
        <p className="mt-2 text-slate-300">Три быстрых тренажёра по самым неприятным местам: логика, системы счисления, SQL.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <TruthTableTrainer done={done.truth} onComplete={() => onComplete('truth')} />
        <BaseConverterTrainer done={done.base} onComplete={() => onComplete('base')} />
        <SqlTrainer done={done.sql} onComplete={() => onComplete('sql')} />
      </div>
    </section>
  )
}

function TruthTableTrainer({ done, onComplete }: { done?: boolean; onComplete: () => void }) {
  const [values, setValues] = useState([0, 0, 0, 0])
  const correct = [0, 1, 1, 1]
  const solved = values.every((value, index) => value === correct[index])
  return (
    <TrainerCard title="Таблица истинности" done={done} description="Заполни итоговый столбец для (¬A & B) v A.">
      <div className="overflow-hidden rounded-2xl border border-white/10">
        {[
          ['A', 'B', 'F'],
          ['0', '0', values[0]],
          ['0', '1', values[1]],
          ['1', '0', values[2]],
          ['1', '1', values[3]],
        ].map((row, r) => (
          <div key={r} className="grid grid-cols-3 border-b border-white/10 last:border-b-0">
            {row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                disabled={r === 0 || c < 2}
                onClick={() => setValues((items) => items.map((item, index) => index === r - 1 ? Number(!item) : item))}
                className={cn('px-3 py-3 text-center text-sm', r === 0 ? 'bg-slate-800 font-bold' : 'bg-slate-950/40', c === 2 && r > 0 && 'font-bold text-cyan-200')}
              >
                {cell}
              </button>
            ))}
          </div>
        ))}
      </div>
      <CheckTrainerButton solved={solved} done={done} onComplete={onComplete} />
    </TrainerCard>
  )
}

function BaseConverterTrainer({ done, onComplete }: { done?: boolean; onComplete: () => void }) {
  const [answer, setAnswer] = useState('')
  const solved = answer.trim() === '684'
  return (
    <TrainerCard title="Перевод числа" done={done} description="Переведи 10214₅ в десятичную систему.">
      <div className="rounded-2xl bg-slate-950/60 p-4 text-sm text-slate-300">
        Подсказка: 1·5⁴ + 0·5³ + 2·5² + 1·5¹ + 4·5⁰
      </div>
      <input value={answer} onChange={(event) => setAnswer(event.target.value)} inputMode="numeric" placeholder="Ответ" className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300" />
      <CheckTrainerButton solved={solved} done={done} onComplete={onComplete} />
    </TrainerCard>
  )
}

function SqlTrainer({ done, onComplete }: { done?: boolean; onComplete: () => void }) {
  const [query, setQuery] = useState('')
  const normalized = query.toLowerCase().replaceAll('ё', 'е')
  const solved = normalized.includes('select') && normalized.includes('from') && normalized.includes('читатели') && normalized.includes('where') && normalized.includes('москва')
  return (
    <TrainerCard title="SQL-тренажёр" done={done} description="Напиши запрос: вывести читателей из Москвы.">
      <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={5} placeholder="SELECT * FROM Читатели WHERE Адрес = 'Москва';" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-cyan-300" />
      <CheckTrainerButton solved={solved} done={done} onComplete={onComplete} />
    </TrainerCard>
  )
}

function TrainerCard({ title, description, done, children }: { title: string; description: string; done?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/40 motion-reduce:transform-none">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        </div>
        {done && <BadgeCheck className="text-emerald-300" />}
      </div>
      {children}
    </div>
  )
}

function CheckTrainerButton({ solved, done, onComplete }: { solved: boolean; done?: boolean; onComplete: () => void }) {
  return (
    <button
      onClick={onComplete}
      disabled={!solved || done}
      className="mt-4 w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
    >
      {done ? 'Зачтено' : solved ? 'Проверить и зачесть' : 'Пока неверно'}
    </button>
  )
}

function AchievementsView({ progress, onBack }: { progress: ProgressState; onBack: () => void }) {
  return (
    <section className="py-8">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white">
        <ArrowLeft size={16} /> На главную
      </button>
      <h1 className="text-4xl font-black text-white">Достижения</h1>
      <p className="mt-2 text-slate-300">Открыто {progress.achievements.length} из {achievements.length}.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {achievements.map((achievement) => (
          <AchievementCard key={achievement.id} achievement={achievement} unlocked={progress.achievements.includes(achievement.id)} />
        ))}
      </div>
    </section>
  )
}

function AchievementCard({ achievement, unlocked }: { achievement: Achievement; unlocked: boolean }) {
  const Icon = achievementIcons[achievement.icon] ?? Trophy
  return (
    <div className={cn('rounded-3xl border p-5 transition duration-300', unlocked ? 'border-amber-300/40 bg-amber-300/10' : 'border-white/10 bg-white/[0.03] opacity-70')}>
      <div className={cn('mb-4 flex h-12 w-12 items-center justify-center rounded-2xl', unlocked ? 'bg-amber-300 text-slate-950' : 'bg-slate-800 text-slate-400')}>
        <Icon size={24} />
      </div>
      <h2 className="text-lg font-bold text-white">{achievement.title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-400">{achievement.description}</p>
    </div>
  )
}
