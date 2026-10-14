import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TutorSidebar } from './TutorSidebar';
import type { ThemeTokens } from '../../utils/settings';

const tokens = {
  surfaceMuted: '#fff',
  surfaceAccent: '#f7f7f7',
  surfaceElevated: '#fff',
  inputSurface: '#fff',
  hoverSurface: '#eee',
  borderSubtle: '1px solid #ddd',
  borderSoft: '1px solid #ddd',
  shadowSoft: 'none',
  textPrimary: '#111',
  textSecondary: '#555',
  textMuted: '#777',
  disabledText: '#aaa',
  warning: '#b45309',
  warningSoft: '#fff7ed',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
  success: '#047857',
  successSoft: '#d1fae5',
  info: '#0369a1',
  infoSoft: '#e0f2fe',
} as ThemeTokens;

function renderSidebar(overrides: Partial<React.ComponentProps<typeof TutorSidebar>> = {}) {
  const props: React.ComponentProps<typeof TutorSidebar> = {
    sidebarOpen: true,
    sidebarWidth: 300,
    tokens,
    language: 'en',
    profiles: [],
    selectedProfile: 'three_stage',
    customPrompt: '',
    materials: [],
    selectedMaterialIds: [],
    isUploadingMaterial: false,
    isRefreshingMaterials: false,
    isReingestingMaterial: false,
    materialPollingExpired: false,
    materialError: null,
    loadError: null,
    historyLoadError: null,
    remainingSeconds: 1500,
    timerState: 'focus',
    isRunning: false,
    timerHasStarted: false,
    historySearchOpen: false,
    historySearchQuery: '',
    isSearchingHistory: false,
    historyItems: [],
    activeConversationId: null,
    materialInputRef: { current: null },
    historySearchInputRef: { current: null },
    t: (_zh, en) => en,
    onExit: vi.fn(),
    onCollapse: vi.fn(),
    onStartNewChat: vi.fn(),
    onToggleHistorySearch: vi.fn(),
    onCloseHistorySearch: vi.fn(),
    onHistorySearchQueryChange: vi.fn(),
    onSelectedProfileChange: vi.fn(),
    onCustomPromptChange: vi.fn(),
    onMaterialUpload: vi.fn(),
    onToggleMaterialSelection: vi.fn(),
    onRefreshMaterials: vi.fn(),
    onReingestMaterial: vi.fn(),
    onToggleTimer: vi.fn(),
    onResetTimer: vi.fn(),
    onStartNextRound: vi.fn(),
    onOpenHistoryItem: vi.fn(),
    onExportHistoryItem: vi.fn(),
    onRemoveHistoryItem: vi.fn(),
    ...overrides,
  };
  return { ...render(<TutorSidebar {...props} />), props };
}

describe('TutorSidebar materials', () => {
  it('shows failed material errors and retries reingest', async () => {
    const onReingestMaterial = vi.fn();
    renderSidebar({
      onReingestMaterial,
      materials: [
        {
          id: 7,
          filename: 'broken.pdf',
          file_type: 'pdf',
          status: 'failed',
          error: 'PDF image processing failed',
          char_count: 0,
          chunk_count: 0,
          created_at: 'now',
          updated_at: 'now',
        },
      ],
    });

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('PDF image processing failed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry ingest' }));

    expect(onReingestMaterial).toHaveBeenCalledWith(7);
  });
});
