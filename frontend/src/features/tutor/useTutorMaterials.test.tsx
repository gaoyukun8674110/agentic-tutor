import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MATERIAL_POLL_TIMEOUT_MS, useTutorMaterials } from './useTutorMaterials';

const { fetchStudyMaterialsMock, uploadStudyMaterialMock, reingestStudyMaterialMock } = vi.hoisted(
  () => ({
    fetchStudyMaterialsMock: vi.fn(),
    uploadStudyMaterialMock: vi.fn(),
    reingestStudyMaterialMock: vi.fn(),
  }),
);

vi.mock('../../utils/chatApi', async () => {
  const actual = await vi.importActual<typeof import('../../utils/chatApi')>('../../utils/chatApi');
  return {
    ...actual,
    fetchStudyMaterials: fetchStudyMaterialsMock,
    uploadStudyMaterial: uploadStudyMaterialMock,
    reingestStudyMaterial: reingestStudyMaterialMock,
  };
});

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useTutorMaterials', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('stops automatic polling after the pending-material timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchStudyMaterialsMock.mockResolvedValue([
      {
        id: 1,
        filename: 'notes.md',
        file_type: 'md',
        status: 'pending',
        error: null,
        char_count: 0,
        chunk_count: 0,
        created_at: 'now',
        updated_at: 'now',
      },
    ]);

    const { result } = renderHook(() => useTutorMaterials(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.materials).toHaveLength(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MATERIAL_POLL_TIMEOUT_MS + 1000);
    });

    expect(result.current.materialPollingExpired).toBe(true);
    const callsAfterTimeout = fetchStudyMaterialsMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(fetchStudyMaterialsMock.mock.calls.length).toBe(callsAfterTimeout);
  });
});
