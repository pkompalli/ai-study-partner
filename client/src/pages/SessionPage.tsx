import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass, BookOpen } from 'lucide-react';
import { useSessionStore } from '@/store/sessionStore';
import { useCourseStore } from '@/store/courseStore';
import { useUIStore } from '@/store/uiStore';
import { ChatWindow } from '@/components/session/ChatWindow';
import { ChatInput } from '@/components/session/ChatInput';
import { TopicSummary } from '@/components/session/TopicSummary';
import { CheckPanel } from '@/components/session/CheckPanel';
import { FlashcardDeck } from '@/components/flashcards/FlashcardDeck';
import { Spinner } from '@/components/ui/Spinner';

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    activeSession, messages, isStreaming, streamingContent, regeneratingIndex,
    activeFlashcards,
    topicSummary, summaryStreaming, summaryStreamingContent,
    responsePills, pillsLoading, flashcardsLoading,
    accumulatedCheckQuestions, checkResetKey,
    loadSession, sendMessage, clearSession,
    fetchSummary, regenerateMessage, reviewCard,
  } = useSessionStore();
  const { fetchCourse, setActiveCourse } = useCourseStore();
  const { addToast } = useUIStore();

  const [loading, setLoading] = useState(true);
  const [summaryDepth, setSummaryDepth] = useState(0);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    loadSession(id).then(async () => {
      const session = useSessionStore.getState().activeSession;
      if (session?.course_id) {
        fetchCourse(session.course_id).catch(() => {});
      }
      const msgs = useSessionStore.getState().messages.filter(m => m.role !== 'system');
      if (msgs.length === 0) {
        fetchSummary(id, 0);
      } else {
        setSummaryCollapsed(true);
        fetchSummary(id, 0);
      }
    }).finally(() => setLoading(false));
    return () => {
      clearSession();
      setActiveCourse(null);
    };
  }, [id, loadSession, clearSession, fetchSummary, fetchCourse, setActiveCourse]);

  const visibleMessages = messages.filter(m => m.role !== 'system');

  // Scroll to bottom on new messages or streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleMessages.length, streamingContent]);

  const handleSend = async (content: string) => {
    try {
      await sendMessage(content);
    } catch {
      addToast('Failed to send message', 'error');
    }
  };

  const handleSummaryDepthChange = async (newDepth: number) => {
    if (!id) return;
    const clamped = Math.max(0, Math.min(3, newDepth));
    setSummaryDepth(clamped);
    // resetPanel=true: depth change is a deliberate fresh start for check questions
    fetchSummary(id, clamped, true);
  };

  const handleRegenerate = async (visibleIndex: number, depth: number) => {
    try {
      await regenerateMessage(visibleIndex, depth);
    } catch {
      addToast('Failed to regenerate response', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const hasSummary = topicSummary !== null || summaryStreaming;

  // Check questions grow throughout the session; only reset on depth change (checkResetKey)
  const checkQuestions = accumulatedCheckQuestions;

  // Explore strip: followup pills persist during streaming; fall back to summary starters
  const exploreItems: string[] = responsePills?.followupPills?.length
    ? responsePills.followupPills
    : (topicSummary?.starters ?? []);
  const showExplore = exploreItems.length > 0 && !summaryStreaming && activeSession?.status === 'active';

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Session header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="p-1 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {activeSession?.title ?? 'Study Session'}
          </p>
          <p className="text-xs text-gray-400">
            {activeSession?.status === 'active' ? 'Active session' : 'Session ended'}
          </p>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0">

        {/* LEFT: Lesson area */}
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

        {/* RIGHT: Check (top ~60%) + Flashcards (bottom ~40%) */}
        <div className="flex flex-col w-80 flex-shrink-0">

          {/* Check panel */}
          <div className="flex-[3] min-h-0 overflow-hidden border-b border-gray-100">
            <CheckPanel
              questions={checkQuestions}
              isLoading={pillsLoading || (summaryStreaming && checkQuestions.length === 0)}
              resetKey={checkResetKey}
            />
          </div>

          {/* Flashcard panel */}
          <div className="flex-[2] min-h-0 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
              <p className="text-xs font-semibold text-gray-600">Flashcards</p>
            </div>

            {flashcardsLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Spinner className="h-5 w-5 text-primary-400" />
              </div>
            ) : activeFlashcards ? (
              <div className="flex-1 overflow-y-auto">
                <FlashcardDeck
                cards={activeFlashcards.cards}
                onReview={(cardId, correct) => reviewCard(cardId, correct)}
              />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-2">
                <BookOpen className="h-6 w-6 text-gray-300" />
                <p className="text-xs text-gray-400 leading-relaxed">
                  Flashcards will appear once content loads.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
