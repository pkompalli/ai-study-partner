import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass, BookOpen, Lightbulb, Menu, Brain, ChevronLeft, ChevronRight, Bookmark, Check } from 'lucide-react';
import { useSessionStore } from '@/store/sessionStore';
import { useCourseStore } from '@/store/courseStore';
import { useUIStore } from '@/store/uiStore';
import { ChatWindow } from '@/components/session/ChatWindow';
import { ChatInput } from '@/components/session/ChatInput';
import { TopicSummary } from '@/components/session/TopicSummary';
import { FlashcardDeck } from '@/components/flashcards/FlashcardDeck';
import { Spinner } from '@/components/ui/Spinner';
import { SidebarCourseTree } from '@/components/session/SidebarCourseTree';

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    activeSession, messages, isStreaming, streamingContent, regeneratingIndex,
    activeFlashcards,
    topicSummary, summaryStreaming, summaryStreamingContent,
    responsePills, pillsLoading,
    loadSession, sendMessage, clearSession,
    fetchSummary, regenerateMessage, reviewCard, saveCardFromQuestion,
  } = useSessionStore();
  const { fetchCourse, setActiveCourse, activeCourse } = useCourseStore();
  const { addToast } = useUIStore();

  const [loading, setLoading] = useState(true);
  const [summaryDepth, setSummaryDepth] = useState(3);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  // Panel toggles
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);

  // MCQ history
  const [mcqHistory, setMcqHistory] = useState<
    Array<{ question: string; answerPills: string[]; correctIndex: number; explanation: string }>
  >([]);
  const [mcqHistoryIndex, setMcqHistoryIndex] = useState(0);
  const [mcqSelections, setMcqSelections] = useState<Record<number, number>>({});
  const [savedMcqIndices, setSavedMcqIndices] = useState<Set<number>>(new Set());

  // Flashcard panel
  const [reviewMode, setReviewMode] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    loadSession(id).then(async () => {
      const session = useSessionStore.getState().activeSession;
      if (session?.course_id) {
        fetchCourse(session.course_id).catch(() => {});
      }
      fetchSummary(id, 0);
    }).finally(() => setLoading(false));
    return () => {
      clearSession();
      setActiveCourse(null);
    };
  }, [id, loadSession, clearSession, fetchSummary, fetchCourse, setActiveCourse]);

  const visibleMessages = messages.filter(m => m.role !== 'system');

  // MCQ derived values
  const mcqQuestion = responsePills?.answerPills?.length
    ? responsePills.question
    : (!summaryStreaming && visibleMessages.length === 0 ? (topicSummary?.question ?? '') : '');
  const mcqPills = responsePills?.answerPills?.length
    ? responsePills.answerPills
    : (!summaryStreaming && visibleMessages.length === 0 ? (topicSummary?.answerPills ?? []) : []);
  const mcqCorrectIndex = responsePills?.answerPills?.length
    ? responsePills.correctIndex
    : (topicSummary?.correctIndex ?? -1);
  const mcqExplanation = responsePills?.answerPills?.length
    ? responsePills.explanation
    : (topicSummary?.explanation ?? '');

  // Scroll to bottom on new messages or streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleMessages.length, streamingContent]);

  // Accumulate MCQ history — new question → push + jump to end
  useEffect(() => {
    if (!mcqQuestion || !mcqPills.length) return;
    setMcqHistory(prev => {
      if (prev[prev.length - 1]?.question === mcqQuestion) return prev;
      const next = [...prev, {
        question: mcqQuestion, answerPills: mcqPills,
        correctIndex: mcqCorrectIndex, explanation: mcqExplanation,
      }];
      setMcqHistoryIndex(next.length - 1);
      return next;
    });
  }, [mcqQuestion]);

  const currentMcq = mcqHistory[mcqHistoryIndex] ?? null;

  // Explore strip
  const exploreItems: string[] = responsePills?.followupPills?.length
    ? responsePills.followupPills
    : (topicSummary?.starters ?? []);
  const showExplore = exploreItems.length > 0 && !summaryStreaming && activeSession?.status === 'active';

  const handleSend = async (content: string) => {
    try {
      await sendMessage(content);
    } catch {
      addToast('Failed to send message', 'error');
    }
  };

  const handleSummaryDepthChange = async (newDepth: number) => {
    if (!id) return;
    const clamped = Math.max(1, Math.min(5, newDepth));
    setSummaryDepth(clamped);
    fetchSummary(id, clamped);
  };

  const handleRegenerate = async (visibleIndex: number, depth: number) => {
    try {
      await regenerateMessage(visibleIndex, depth);
    } catch {
      addToast('Failed to regenerate response', 'error');
    }
  };

  const handleSaveCard = async (historyIndex: number) => {
    const mcq = mcqHistory[historyIndex];
    if (!mcq) return;
    const correctAnswer = mcq.answerPills[mcq.correctIndex];
    const saved = await saveCardFromQuestion(mcq.question, correctAnswer, mcq.explanation);
    if (saved) setSavedMcqIndices(prev => new Set(prev).add(historyIndex));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const hasSummary = topicSummary !== null || summaryStreaming;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <button onClick={() => setLeftOpen(o => !o)} className="p-1 rounded-lg hover:bg-gray-100">
          <Menu className="h-4 w-4 text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {activeSession?.title ?? 'Study Session'}
          </p>
          <p className="text-xs text-gray-400">
            {activeSession?.status === 'active' ? 'Active session' : 'Session ended'}
          </p>
        </div>
        <button onClick={() => setRightOpen(o => !o)} className="p-1 rounded-lg hover:bg-gray-100">
          <Brain className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* 3-column body */}
      <div className="flex flex-1 min-h-0">

        {/* LEFT PANEL — collapsible, default closed */}
        {leftOpen && (
          <div className="w-56 flex-shrink-0 border-r border-gray-100 flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Topics</p>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {activeCourse?.subjects && (
                <SidebarCourseTree
                  subjects={activeCourse.subjects}
                  courseId={activeSession?.course_id ?? ''}
                  onNavigate={() => setLeftOpen(false)}
                />
              )}
            </div>
          </div>
        )}

        {/* CENTER COLUMN */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-gray-100">

          {/* Scrollable content */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="px-4">
              {hasSummary && (
                <TopicSummary
                  summary={topicSummary?.summary ?? ''}
                  isStreaming={summaryStreaming}
                  streamingContent={summaryStreamingContent}
                  collapsed={summaryCollapsed}
                  onToggle={() => setSummaryCollapsed(c => !c)}
                  depth={summaryDepth}
                  onDepthChange={handleSummaryDepthChange}
                />
              )}

              {!hasSummary && visibleMessages.length === 0 && (
                <div className="flex items-center justify-center py-16">
                  <Spinner className="h-6 w-6 text-primary-400" />
                </div>
              )}

              {(visibleMessages.length > 0 || (isStreaming && regeneratingIndex === null)) && (
                <ChatWindow
                  messages={messages}
                  isStreaming={isStreaming}
                  streamingContent={streamingContent}
                  regeneratingIndex={regeneratingIndex}
                  onRegenerate={handleRegenerate}
                />
              )}
            </div>
          </div>

          {/* Explore strip — pinned above chat input */}
          {showExplore && (
            <div className="border-t border-sky-100 bg-sky-50 px-4 py-2.5 flex-shrink-0">
              <p className="text-xs font-semibold text-sky-700 mb-2 flex items-center gap-1">
                <Compass className="h-3 w-3" /> Explore
              </p>
              <div className="grid grid-cols-3 gap-2">
                {exploreItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(item)}
                    className="px-3 py-2 rounded-lg text-xs font-medium bg-white border border-sky-200 text-sky-800 hover:bg-sky-100 transition-colors text-center leading-snug"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat input */}
          {activeSession?.status === 'active' && (
            <ChatInput
              onSend={handleSend}
              disabled={isStreaming}
              placeholder="Ask your AI tutor anything..."
            />
          )}
        </div>

        {/* RIGHT PANEL — collapsible, default open */}
        {rightOpen && (
          <div className="w-80 flex-shrink-0 border-l border-gray-100 flex flex-col min-h-0">

            {/* MCQ — 65% */}
            <div className="flex flex-col border-b border-gray-100 min-h-0 overflow-hidden" style={{ flex: 65 }}>
              {/* Header with history navigation */}
              <div className="px-3 py-2 border-b border-gray-100 bg-orange-50 flex-shrink-0 flex items-center gap-1">
                <Lightbulb className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-orange-700 flex-1">Check</span>
                {mcqHistory.length > 0 && (
                  <>
                    <button
                      disabled={mcqHistoryIndex === 0}
                      onClick={() => setMcqHistoryIndex(i => i - 1)}
                      className="p-0.5 rounded hover:bg-orange-100 disabled:opacity-30 transition-opacity"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 text-orange-500" />
                    </button>
                    <span className="text-xs text-orange-400 tabular-nums px-0.5">
                      {mcqHistoryIndex + 1}/{mcqHistory.length}
                    </span>
                    <button
                      disabled={mcqHistoryIndex === mcqHistory.length - 1}
                      onClick={() => setMcqHistoryIndex(i => i + 1)}
                      className="p-0.5 rounded hover:bg-orange-100 disabled:opacity-30 transition-opacity"
                    >
                      <ChevronRight className="h-3.5 w-3.5 text-orange-500" />
                    </button>
                  </>
                )}
              </div>

              {/* Scrollable MCQ body */}
              <div className="flex-1 overflow-y-auto px-3 py-3">
                {currentMcq ? (
                  <>
                    <p className="text-sm font-medium text-gray-800 mb-3 leading-snug">
                      {currentMcq.question}
                    </p>
                    <div className="space-y-2">
                      {currentMcq.answerPills.map((pill, i) => {
                        const selected = mcqSelections[mcqHistoryIndex];
                        const locked = selected !== undefined;
                        const isSelected = selected === i;
                        const isCorrect = i === currentMcq.correctIndex;
                        let cls = 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 cursor-pointer';
                        if (locked) {
                          if (isSelected && isCorrect)  cls = 'bg-green-100 border border-green-400 text-green-800';
                          else if (isCorrect)            cls = 'bg-green-50  border border-green-300 text-green-700';
                          else if (isSelected)           cls = 'bg-red-100   border border-red-400   text-red-800';
                          else                           cls = 'bg-white border border-gray-100 text-gray-400 opacity-50';
                        }
                        return (
                          <button
                            key={i}
                            disabled={locked}
                            onClick={() => setMcqSelections(prev => ({ ...prev, [mcqHistoryIndex]: i }))}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${cls}`}
                          >
                            {locked && isSelected && isCorrect  && <span className="flex-shrink-0 text-green-600">✓</span>}
                            {locked && isSelected && !isCorrect && <span className="flex-shrink-0 text-red-600">✗</span>}
                            <span>{pill}</span>
                          </button>
                        );
                      })}
                    </div>
                    {mcqSelections[mcqHistoryIndex] !== undefined && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                        {currentMcq.explanation && (
                          <p className="text-xs text-gray-600 leading-snug">{currentMcq.explanation}</p>
                        )}
                        {savedMcqIndices.has(mcqHistoryIndex) ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                            <Check className="h-3 w-3" /> Saved to deck
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSaveCard(mcqHistoryIndex)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                          >
                            <Bookmark className="h-3 w-3" /> Save as flashcard
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    {pillsLoading || summaryStreaming
                      ? <Spinner className="h-5 w-5 text-orange-300" />
                      : <p className="text-xs text-gray-400 text-center leading-relaxed">Questions appear here<br/>as you study.</p>
                    }
                  </div>
                )}
              </div>
            </div>

            {/* Saved cards — 35% */}
            {(() => {
              const savedCards = activeFlashcards?.cards ?? [];
              return (
                <div className="flex flex-col min-h-0 overflow-hidden" style={{ flex: 35 }}>
                  {reviewMode ? (
                    <>
                      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0 flex items-center gap-2">
                        <p className="text-xs font-semibold text-gray-600 flex-1">Review</p>
                        <button
                          onClick={() => setReviewMode(false)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          ✕ Exit
                        </button>
                      </div>
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <FlashcardDeck
                          cards={savedCards}
                          onReview={(cardId, correct) => reviewCard(cardId, correct)}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0 flex items-center gap-2">
                        <p className="text-xs font-semibold text-gray-600 flex-1">Saved Cards</p>
                        {savedCards.length > 0 && (
                          <>
                            <span className="text-xs text-gray-400">{savedCards.length}</span>
                            <button
                              onClick={() => setReviewMode(true)}
                              className="text-xs font-medium text-primary-600 hover:text-primary-800"
                            >
                              Start Review →
                            </button>
                          </>
                        )}
                      </div>
                      {savedCards.length > 0 ? (
                        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                          {savedCards.map(card => (
                            <div
                              key={card.id}
                              className="text-xs text-gray-700 px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-100 leading-snug"
                            >
                              {card.front}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-2">
                          <BookOpen className="h-5 w-5 text-gray-200" />
                          <p className="text-xs text-gray-400 leading-relaxed">
                            Answer a question and tap<br/>"Save as flashcard" to build<br/>your review deck.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

          </div>
        )}

      </div>
    </div>
  );
}
