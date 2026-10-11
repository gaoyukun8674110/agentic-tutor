import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SettingsModelPage } from './SettingsModelPage';

const {
  fetchChatProvidersMock,
  fetchLlmCredentialsMock,
  testLlmCredentialMock,
  saveLlmCredentialMock,
  patchLlmCredentialMock,
  deleteLlmCredentialMock,
} = vi.hoisted(() => ({
  fetchChatProvidersMock: vi.fn(),
  fetchLlmCredentialsMock: vi.fn(),
  testLlmCredentialMock: vi.fn(),
  saveLlmCredentialMock: vi.fn(),
  patchLlmCredentialMock: vi.fn(),
  deleteLlmCredentialMock: vi.fn(),
}));

vi.mock('../components/TopNavbar', () => ({ TopNavbar: () => <div>top-nav</div> }));

vi.mock('../utils/settings', () => ({
  useSettings: () => ({
    tokens: {
      pageGradient: '#fff',
      overlayGradient: 'transparent',
      textPrimary: '#111',
      textSecondary: '#666',
      accentPrimary: '#2563eb',
      warning: '#b45309',
    },
    textStyle: {},
    t: (_zh: string, en: string) => en,
  }),
}));

vi.mock('../utils/glassStyles', () => ({
  cardSurfaceStyle: () => ({}),
  primaryActionStyle: () => ({}),
  statusPanelStyle: () => ({}),
}));

vi.mock('../utils/chatApi', async () => {
  const actual = await vi.importActual<typeof import('../utils/chatApi')>('../utils/chatApi');
  return {
    ...actual,
    fetchChatProviders: fetchChatProvidersMock,
  };
});

vi.mock('../utils/llmCredentialsApi', async () => {
  const actual = await vi.importActual<typeof import('../utils/llmCredentialsApi')>(
    '../utils/llmCredentialsApi',
  );
  return {
    ...actual,
    fetchLlmCredentials: fetchLlmCredentialsMock,
    saveLlmCredential: saveLlmCredentialMock,
    patchLlmCredential: patchLlmCredentialMock,
    deleteLlmCredential: deleteLlmCredentialMock,
    testLlmCredential: testLlmCredentialMock,
  };
});

function renderSettings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SettingsModelPage />
    </QueryClientProvider>,
  );
}

function mockProviders() {
  fetchChatProvidersMock.mockResolvedValue([
    {
      id: 'linkapi',
      name: 'LinkAPI',
      adapter: 'openai-compatible',
      enabled: false,
      implemented: true,
      default_model: 'gpt-test',
      models: ['gpt-test'],
      source: 'none',
    },
    {
      id: 'ollama',
      name: 'Ollama',
      adapter: 'openai-compatible',
      enabled: true,
      implemented: true,
      default_model: 'llama',
      models: ['llama'],
      source: 'local',
    },
  ]);
  fetchLlmCredentialsMock.mockResolvedValue([]);
}

describe('SettingsModelPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows provider source labels and a successful credential test result', async () => {
    mockProviders();
    testLlmCredentialMock.mockResolvedValue({ ok: true });

    renderSettings();

    expect(await screen.findAllByText('LinkAPI')).toHaveLength(2);
    expect(screen.getAllByText('Source: none').length).toBeGreaterThan(0);
    expect(screen.getByText('Source: local')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Test connection/i }));

    await waitFor(() => expect(testLlmCredentialMock).toHaveBeenCalledWith('linkapi'));
    expect(await screen.findByTestId('credential-test-result')).toHaveTextContent(
      'Connection test passed',
    );
  });

  it('shows a failed credential test result', async () => {
    mockProviders();
    testLlmCredentialMock.mockRejectedValue(new Error('bad key'));

    renderSettings();

    expect(await screen.findAllByText('LinkAPI')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Test connection/i }));

    expect(await screen.findByTestId('credential-test-result')).toHaveTextContent('bad key');
  });
});
