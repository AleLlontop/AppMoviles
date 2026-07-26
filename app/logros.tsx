import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';

import { getAchievementsWithProgress, AchievementWithProgress } from '@/services/achievementsService';
import { useThemeColors } from '@/hooks/use-theme-colors';

interface AchievementCategory {
  label: string;
  achievements: AchievementWithProgress[];
}

export default function LogrosScreen() {
  const c = useThemeColors();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [achievements, setAchievements] = useState<AchievementWithProgress[]>([]);
  const [categories, setCategories] = useState<AchievementCategory[]>([]);
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementWithProgress | null>(null);

  const getClearDescription = (ach: AchievementWithProgress | null): string => {
    if (!ach) return '';
    const overrides: Record<string, string> = {
      'primer_dia': 'Completá tu primera sesión de estudio.',
      'semilla_plantada': 'Estudiá 2 días seguidos para desbloquear este logro.',
      'jardin_creciendo': 'Estudiá en 3 materias diferentes para desbloquear este logro.',
      '3_dias_fuego': 'Estudiá en 3 días distintos para desbloquear este logro.',
      'semana_impecable': 'Estudiá 7 días consecutivos sin interrupciones.',
      '50_dias': 'Alcanzá una racha de 50 días consecutivos de estudio.',
      '50_minutos': 'Acumulá 50 minutos totales de estudio.',
      '1000_horas': 'Acumulá 1000 horas totales de estudio.',
      '14_dias_fuego': 'Alcanzá una racha de 14 días consecutivos de estudio.',
    };
    return overrides[ach.slug] || ach.description;
  };

  useEffect(() => {
    if (isFocused) {
      fetchAchievements();
    }
  }, [isFocused]);

  const fetchAchievements = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAchievementsWithProgress();
      setAchievements(data);
      organizeByCategory(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar logros');
    } finally {
      setLoading(false);
    }
  };

  const organizeByCategory = (data: AchievementWithProgress[]) => {
    const categorized: Record<string, AchievementWithProgress[]> = {
      'RACHAS': [],
      'HORAS ACUMULADAS': [],
      'DÍAS CUMPLIDOS': [],
      'TOTALES': [],
      'HÁBITOS': [],
    };

    data.forEach(ach => {
      if (ach.slug.includes('fuego') || ach.slug.includes('dia')) {
        categorized['RACHAS'].push(ach);
      } else if (ach.slug.includes('minutos') || ach.slug.includes('horas')) {
        categorized['HORAS ACUMULADAS'].push(ach);
      } else if (ach.slug.includes('dia') && ach.slug.includes('cumplido')) {
        categorized['DÍAS CUMPLIDOS'].push(ach);
      } else if (ach.slug.includes('semilla') || ach.slug.includes('jardin')) {
        categorized['HÁBITOS'].push(ach);
      } else {
        categorized['TOTALES'].push(ach);
      }
    });

    const result: AchievementCategory[] = Object.entries(categorized)
      .filter(([_, achs]) => achs.length > 0)
      .map(([label, achievements]) => ({ label, achievements }));

    setCategories(result);
  };

  const handleRetry = () => {
    fetchAchievements();
  };

  const unlockedCount = achievements.filter(a => a.isUnlocked).length;
  const totalCount = achievements.length;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#A594F9" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={[styles.header, { backgroundColor: c.accent }]}>
          <Text style={styles.headerDate}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <Text style={styles.headerTitle}>Logros</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: 'red', marginBottom: 8, fontSize: 16 }}>⚠️</Text>
          <Text style={{ color: 'red', marginBottom: 16, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity onPress={handleRetry} style={{ padding: 10, backgroundColor: '#A594F9', borderRadius: 8 }}>
            <Text style={{ color: 'white', fontWeight: '600' }}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (achievements.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={[styles.header, { backgroundColor: c.accent }]}>
          <Text style={styles.headerDate}>Mi progreso</Text>
          <Text style={styles.headerTitle}>Logros</Text>
          <Text style={styles.headerSub}>Desbloqueá insignias cumpliendo objetivos</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 64, marginBottom: 16 }}>🏆</Text>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: c.textPrimary, marginBottom: 8, textAlign: 'center' }}>
            Aún no tienes logros
          </Text>
          <Text style={{ fontSize: 14, color: c.textSecondary, textAlign: 'center' }}>
            Desbloqueá logros cumpliendo metas y alcanzando hitos.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: c.accent }]}>
          <Text style={styles.headerDate}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <Text style={styles.headerTitle}>Logros</Text>
          <Text style={styles.headerSub}>
            {unlockedCount} de {totalCount} desbloqueados
          </Text>
        </View>

        {/* Progress bar */}
        <View style={[styles.progressSection, { backgroundColor: c.surface }]}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: '#A594F9', width: `${(unlockedCount / totalCount) * 100}%` },
              ]}
            />
          </View>
          <Text style={{ fontSize: 12, color: c.textSecondary, textAlign: 'center', marginTop: 8 }}>
            {Math.round((unlockedCount / totalCount) * 100)}% completado
          </Text>
        </View>

        {/* Categories */}
        {categories.map((category) => (
          <View key={category.label} style={styles.categorySection}>
            <Text style={[styles.categoryLabel, { color: c.textSecondary }]}>
              {category.label}
            </Text>

            {/* Achievements in rows */}
            {category.achievements.length > 0 && (
              <View style={styles.achievementRow}>
                {category.achievements.slice(0, 3).map((ach) => (
                  <TouchableOpacity
                    key={ach.id}
                    style={styles.achievementCard}
                    activeOpacity={0.7}
                    onPress={() => setSelectedAchievement(ach)}
                  >
                    {/* Ring or Circle */}
                    {ach.isUnlocked ? (
                      <View style={[styles.circle, { backgroundColor: '#30C040' }]}>
                        <Text style={styles.checkmark}>✓</Text>
                      </View>
                    ) : (
                      <View style={styles.ring}>
                        <Text style={styles.emoji}>{ach.icon}</Text>
                      </View>
                    )}

                    {/* Label */}
                    <Text style={[styles.achTitle, { color: c.textPrimary }]}>
                      {ach.title}
                    </Text>

                    {/* Progress */}
                    {ach.progress !== undefined && ach.target !== undefined && (
                      <Text style={[styles.achProgress, { color: '#A594F9' }]}>
                        {ach.progress}/{ach.target}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Achievement Detail Modal */}
      <Modal
        visible={selectedAchievement !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedAchievement(null)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
          <View style={[styles.modalContent, { backgroundColor: c.surface }]}>
            {/* Close button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedAchievement(null)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            {/* Icon */}
            <Text style={styles.modalIcon}>{selectedAchievement?.icon}</Text>

            {/* Title */}
            <Text style={[styles.modalTitle, { color: c.textPrimary }]}>
              {selectedAchievement?.title}
            </Text>

            {/* Description */}
            <Text style={[styles.modalDescription, { color: c.textSecondary }]}>
              {getClearDescription(selectedAchievement)}
            </Text>

            {/* Status */}
            {selectedAchievement && (
              <View style={styles.statusSection}>
                {selectedAchievement.isUnlocked ? (
                  <>
                    <Text style={[styles.statusText, { color: '#30C040' }]}>✓ Desbloqueado</Text>
                    {selectedAchievement.unlocked_at && (
                      <Text style={[styles.dateText, { color: c.textSecondary }]}>
                        {new Date(selectedAchievement.unlocked_at).toLocaleDateString('es-ES')}
                      </Text>
                    )}
                  </>
                ) : selectedAchievement.progress !== undefined && selectedAchievement.target !== undefined ? (
                  <>
                    <Text style={[styles.statusText, { color: '#A594F9' }]}>
                      {selectedAchievement.progress} / {selectedAchievement.target}
                    </Text>
                    <View style={[styles.progressBar, { marginTop: 12 }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${(selectedAchievement.progress / selectedAchievement.target) * 100}%`,
                          },
                        ]}
                      />
                    </View>
                  </>
                ) : (
                  <Text style={[styles.statusText, { color: c.textSecondary }]}>Bloqueado</Text>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  headerDate: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  progressSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(165,148,249,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  categorySection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  achievementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  achievementCard: {
    flex: 1,
    alignItems: 'center',
  },
  ring: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#A594F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emoji: {
    fontSize: 32,
  },
  checkmark: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
  },
  achTitle: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  achProgress: {
    fontSize: 9,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#A594F9',
  },
  modalIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  statusSection: {
    width: '100%',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 4,
  },
});
