import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import type { UserSettingsInput } from '@busify/shared';
import { api } from '@/lib/api';
import type { PublicConfig, UserSettings } from '@/lib/types';

export const DEFAULT_CONFIG: PublicConfig = {
  registrationOpen: true,
  announcement: '',
  alert: { defaultRadiusM: 200, minRadiusM: 50, maxRadiusM: 2000, gpsMaxAccuracyM: 150, confirmReadings: 2 },
  demoMode: false,
  httpsEnabled: false,
};

/** Public server configuration (/api/config). Falls back to defaults while loading. */
export function usePublicConfig() {
  const query = useQuery({
    queryKey: ['config'],
    queryFn: () => api.get<PublicConfig>('/config'),
    staleTime: 5 * 60_000,
  });
  return { ...query, config: query.data ?? DEFAULT_CONFIG };
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  alertRadiusM: 200,
  soundEnabled: true,
  vibrationEnabled: true,
  notificationsEnabled: true,
  keepScreenAwake: true,
  updatedAt: new Date(0).toISOString(),
};

export function useUserSettings(enabled = true) {
  const query = useQuery({
    queryKey: ['me', 'settings'],
    queryFn: async () => (await api.get<{ settings: UserSettings }>('/me/settings')).settings,
    enabled,
    staleTime: 60_000,
  });
  return { ...query, settings: query.data ?? DEFAULT_USER_SETTINGS };
}

export function useSaveUserSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UserSettingsInput) =>
      (await api.put<{ settings: UserSettings }>('/me/settings', input)).settings,
    onSuccess: (settings) => queryClient.setQueryData(['me', 'settings'], settings),
  });
}
