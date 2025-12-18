-- Custom Threads & Full-Text Search Migration
-- Run with: bun run migrate

-- ============================================
-- CUSTOM THREADS (Missive-like thread merging)
-- ============================================

-- Custom threads allow users to merge emails from different conversations
-- and add comments/notes to create a complete project history
CREATE TABLE IF NOT EXISTS threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title TEXT, -- Custom title (defaults to first email subject if not set)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_threads_user ON threads(user_id);
CREATE INDEX idx_threads_updated ON threads(updated_at DESC);

-- Thread items: polymorphic table for emails, comments, notes
-- Items can be soft-deleted (unlike Missive!) for flexibility
CREATE TABLE IF NOT EXISTS thread_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL, -- who added this item

  -- Item type and reference
  item_type TEXT NOT NULL CHECK (item_type IN ('email', 'comment', 'note', 'divider')),
  email_id UUID REFERENCES emails(id) ON DELETE SET NULL, -- for email items

  -- Content (for comments/notes)
  content TEXT,

  -- Ordering and display
  position INTEGER DEFAULT 0, -- for manual reordering if needed
  item_date TIMESTAMPTZ NOT NULL, -- the date to sort by (email received_at or comment created_at)

  -- Soft delete support (unlike Missive!)
  removed_at TIMESTAMPTZ, -- NULL = visible, set = soft deleted
  removed_by UUID REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_thread_items_thread ON thread_items(thread_id);
CREATE INDEX idx_thread_items_email ON thread_items(email_id);
CREATE INDEX idx_thread_items_date ON thread_items(item_date);
CREATE INDEX idx_thread_items_active ON thread_items(thread_id, removed_at) WHERE removed_at IS NULL;

-- Prevent duplicate email in same thread
CREATE UNIQUE INDEX idx_thread_items_unique_email
  ON thread_items(thread_id, email_id)
  WHERE email_id IS NOT NULL AND removed_at IS NULL;

-- ============================================
-- FULL-TEXT SEARCH
-- ============================================

-- Add full-text search vector column to emails
ALTER TABLE emails ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_emails_search ON emails USING GIN(search_vector);

-- Function to update search vector on insert/update
CREATE OR REPLACE FUNCTION emails_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.from_name, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.from_email, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.body_preview, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update search vector
DROP TRIGGER IF EXISTS emails_search_vector_trigger ON emails;
CREATE TRIGGER emails_search_vector_trigger
  BEFORE INSERT OR UPDATE OF subject, from_name, from_email, body_preview
  ON emails
  FOR EACH ROW
  EXECUTE FUNCTION emails_search_vector_update();

-- Backfill existing emails with search vectors
UPDATE emails SET search_vector =
  setweight(to_tsvector('english', COALESCE(subject, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(from_name, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(from_email, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(body_preview, '')), 'C')
WHERE search_vector IS NULL;

-- ============================================
-- THREAD TRIGGERS
-- ============================================

-- Update thread updated_at when items change
CREATE OR REPLACE FUNCTION update_thread_timestamp() RETURNS trigger AS $$
BEGIN
  UPDATE threads SET updated_at = NOW() WHERE id = COALESCE(NEW.thread_id, OLD.thread_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_thread_on_item_change ON thread_items;
CREATE TRIGGER update_thread_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON thread_items
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_timestamp();

-- Apply updated_at trigger to threads
CREATE TRIGGER update_threads_updated_at
  BEFORE UPDATE ON threads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ENABLE REALTIME (optional)
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE threads;
ALTER PUBLICATION supabase_realtime ADD TABLE thread_items;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_items ENABLE ROW LEVEL SECURITY;

-- Note: Actual RLS policies will be added based on your auth setup
-- For now, service role bypasses RLS
