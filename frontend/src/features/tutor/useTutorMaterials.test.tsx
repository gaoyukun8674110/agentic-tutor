import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MATERIAL_POLL_TIMEOUT_MS, useTutorMaterials } from './useTutorMaterials';
import type { StudyMaterial } from '../../utils/chatApi';

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

function material(id: number, overrides: Partial<StudyMaterial> = {}): StudyMaterial {
  return {
    id,
    filename: `notes-${id}.md`,
    file_type: 'md',
    status: 'ready',
    error: null,
    char_count: 10,
    chunk_count: 1,
    created_at: 'now',
    updated_at: 'now',
    ...overrides,
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

  it('does not auto-select materials loaded from the server', async () => {
    fetchStudyMaterialsMock.mockResolvedValue([material(1), material(2)]);

    const { result } = renderHook(() => useTutorMaterials(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.materials).toHaveLength(2));

    expect(result.current.selectedMaterialIds).toEqual([]);
  });

  it('does not auto-select a newly uploaded material', async () => {
    fetchStudyMaterialsMock.mockResolvedValue([]);
    uploadStudyMaterialMock.mockResolvedValue(material(7, { filename: 'uploaded.md' }));

    const { result } = renderHook(() => useTutorMaterials(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.materials).toEqual([]));

    const file = new File(['hello'], 'uploaded.md', { type: 'text/markdown' });
    await act(async () => {
      result.current.handleMaterialUpload({
        target: { files: [file], value: 'uploaded.md' },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    await waitFor(() => expect(result.current.materials).toHaveLength(1));

    expect(result.current.selectedMaterialIds).toEqual([]);
  });
});
