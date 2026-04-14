-- Onboarding sessions and messages for conversational onboarding flow
CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  current_layer INT NOT NULL DEFAULT 1,
  collected_data JSONB NOT NULL DEFAULT '{}',
  course_id UUID REFERENCES courses(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onboarding_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'checkpoint', 'tool_result')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_onboarding_sessions_user ON onboarding_sessions(user_id);
CREATE INDEX idx_onboarding_sessions_status ON onboarding_sessions(user_id, status);
CREATE INDEX idx_onboarding_messages_session ON onboarding_messages(session_id);

-- RLS policies
ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own onboarding sessions"
  ON onboarding_sessions FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage messages in their onboarding sessions"
  ON onboarding_messages FOR ALL
  USING (session_id IN (
    SELECT id FROM onboarding_sessions WHERE user_id = auth.uid()
  ));
