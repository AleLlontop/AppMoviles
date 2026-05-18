import { useColorScheme } from 'react-native';
import { useAppStore } from '@/store/useAppStore';

export const lightColors = {
  background:   '#F7F9FB',
  surface:      '#FFFFFF',
  textPrimary:  '#191C1E',
  textSecondary:'#7B7486',
  accent:       '#A594F9',
  accentStrong: '#826BF0',
  timerHeader:  '#A799E7',
  optionText:   '#374151',
  separator:    '#F3F4F6',
  border:       'rgba(123,116,134,0.15)',
  modalOverlay: 'rgba(0,0,0,0.35)',
  modalBg:      '#FFFFFF',
  handle:       '#E5E7EB',
};

export const darkColors = {
  background:   '#111113',
  surface:      '#1C1C1E',
  textPrimary:  '#F2F2F7',
  textSecondary:'#8E8E93',
  accent:       '#A594F9',
  accentStrong: '#826BF0',
  timerHeader:  '#2E2660',
  optionText:   '#D1D5DB',
  separator:    '#2C2C2E',
  border:       'rgba(255,255,255,0.08)',
  modalOverlay: 'rgba(0,0,0,0.6)',
  modalBg:      '#1C1C1E',
  handle:       '#3A3A3C',
};

export type AppColors = typeof lightColors;

export function useThemeColors(): AppColors {
  const system = useColorScheme();
  const { theme } = useAppStore();
  const resolved = theme === 'system' ? system : theme;
  return resolved === 'dark' ? darkColors : lightColors;
}
