import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchStudyMaterials,
  reingestStudyMaterial,
  uploadStudyMaterial,
  type StudyMaterial,
} from '../../utils/chatApi';
import { getUserFacingError } from '../../utils/apiClient';
import { deriveSelectedMaterialIds } from '../../utils/materialSelection';
import { tutorQueryKeys } from './tutorQueryKeys';

const MATERIAL_POLL_INTERVAL_MS = 2000;
export const MATERIAL_POLL_TIMEOUT_MS = 5 * 60 * 1000;

export function useTutorMaterials() {
  const queryClient = useQueryClient();
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [materialPollingExpired, setMaterialPollingExpired] = useState(false);
  const userTouchedMaterialsRef = useRef(false);
  const pollingIntervalRef = useRef<number | null>(null);
  const pollingStartedAtRef = useRef<number | null>(null);

  const materialsQuery = useQuery({
    queryKey: tutorQueryKeys.materials(),
    queryFn: ({ signal }) => fetchStudyMaterials({ signal }),
    retry: false,
  });

  const stopMaterialPolling = useCallback(() => {
    if (pollingIntervalRef.current !== null) {
      window.clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startMaterialPolling = useCallback(
    () => {
      if (typeof window === 'undefined') return;
      if (pollingIntervalRef.current !== null) return;
      pollingStartedAtRef.current = Date.now();
      setMaterialPollingExpired(false);
      pollingIntervalRef.current = window.setInterval(() => {
        const startedAt = pollingStartedAtRef.current ?? Date.now();
        if (Date.now() - startedAt >= MATERIAL_POLL_TIMEOUT_MS) {
          setMaterialPollingExpired(true);
          stopMaterialPolling();
          return;
        }
        void queryClient
          .fetchQuery({
            queryKey: tutorQueryKeys.materials(),
            queryFn: () => fetchStudyMaterials(),
          })
          .then((items) => {
            if (!items.some((item) => item.status === 'pending')) {
              stopMaterialPolling();
            }
          })
          .catch(() => {
            stopMaterialPolling();
          });
      }, MATERIAL_POLL_INTERVAL_MS);
    },
    [queryClient, stopMaterialPolling],
  );

  const uploadStudyMaterialMutation = useMutation({
    mutationFn: (file: File) => uploadStudyMaterial(file),
    onSuccess: (material) => {
      queryClient.setQueryData<StudyMaterial[]>(tutorQueryKeys.materials(), (items) => [
        material,
        ...(items ?? []).filter((item) => item.id !== material.id),
      ]);
      userTouchedMaterialsRef.current = true;
      setSelectedMaterialIds((ids) => Array.from(new Set([...ids, material.id])));
      setMaterialError(null);
      if (material.status === 'pending') {
        startMaterialPolling();
      }
    },
    onError: (error) => {
      setMaterialError(getUserFacingError(error));
    },
  });

  const reingestStudyMaterialMutation = useMutation({
    mutationFn: (materialId: number) => reingestStudyMaterial(materialId),
    onSuccess: (material) => {
      queryClient.setQueryData<StudyMaterial[]>(tutorQueryKeys.materials(), (items) => [
        material,
        ...(items ?? []).filter((item) => item.id !== material.id),
      ]);
      setMaterialError(null);
      if (material.status === 'pending') {
        startMaterialPolling();
      }
    },
    onError: (error) => {
      setMaterialError(getUserFacingError(error));
    },
  });

  const materials = useMemo(() => materialsQuery.data ?? [], [materialsQuery.data]);
  const loadError = useMemo(
    () => (materialsQuery.error ? getUserFacingError(materialsQuery.error) : null),
    [materialsQuery.error],
  );

  useEffect(() => {
    setSelectedMaterialIds((ids) => {
      const materialIds = materials.map((material) => material.id);
      return deriveSelectedMaterialIds(materialIds, ids, userTouchedMaterialsRef.current);
    });
  }, [materials]);

  useEffect(() => {
    if (materials.some((material) => material.status === 'pending') && !materialPollingExpired) {
      startMaterialPolling();
    }
    if (!materials.some((material) => material.status === 'pending')) {
      pollingStartedAtRef.current = null;
      setMaterialPollingExpired(false);
      stopMaterialPolling();
    }
  }, [materialPollingExpired, materials, startMaterialPolling, stopMaterialPolling]);

  useEffect(
    () => () => {
      stopMaterialPolling();
    },
    [stopMaterialPolling],
  );

  const toggleMaterialSelection = (materialId: number) => {
    userTouchedMaterialsRef.current = true;
    setSelectedMaterialIds((ids) =>
      ids.includes(materialId) ? ids.filter((id) => id !== materialId) : [...ids, materialId],
    );
  };

  const handleMaterialUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || uploadStudyMaterialMutation.isPending) {
      event.target.value = '';
      return;
    }

    setMaterialError(null);
    uploadStudyMaterialMutation.mutate(file);
    event.target.value = '';
  };

  const refreshMaterials = () => {
    setMaterialPollingExpired(false);
    void materialsQuery.refetch();
  };

  const reingestMaterial = (materialId: number) => {
    setMaterialError(null);
    reingestStudyMaterialMutation.mutate(materialId);
  };

  return {
    materials,
    selectedMaterialIds,
    isLoadingMaterials: materialsQuery.isLoading,
    isUploadingMaterial: uploadStudyMaterialMutation.isPending,
    isRefreshingMaterials: materialsQuery.isFetching,
    isReingestingMaterial: reingestStudyMaterialMutation.isPending,
    materialPollingExpired,
    materialError,
    loadError,
    toggleMaterialSelection,
    handleMaterialUpload,
    refreshMaterials,
    reingestMaterial,
  };
}
