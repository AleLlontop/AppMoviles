import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { Achievement } from '@/services/achievementsService';

interface AchievementUnlockedModalProps {
  visible: boolean;
  achievement: Achievement | null;
  onDismiss: () => void;
}

export default function AchievementUnlockedModal({
  visible,
  achievement,
  onDismiss,
}: AchievementUnlockedModalProps) {
  const c = useThemeColors();
  const [scaleAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible && achievement) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();

      const timer = setTimeout(() => {
        Animated.spring(scaleAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }).start(() => onDismiss());
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [visible, achievement]);

  if (!achievement) return null;

  return (
    <Modal transparent={true} visible={visible} pointerEvents="none">
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.modalContent,
            { backgroundColor: c.surface },
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Celebration icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.bigEmoji}>{achievement.icon}</Text>
            <Text style={styles.celebrationEmoji}>✨</Text>
          </View>

          {/* Title and description */}
          <Text style={[styles.title, { color: c.textPrimary }]}>
            ¡Logro desbloqueado!
          </Text>

          <Text style={[styles.achievementTitle, { color: c.accent }]}>
            {achievement.title}
          </Text>

          <Text style={[styles.description, { color: c.textSecondary }]}>
            {achievement.description}
          </Text>

          {/* CTA Button */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: c.accent }]}
            onPress={onDismiss}
          >
            <Text style={styles.buttonText}>Genial, seguir estudiando</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: 'center',
    width: '80%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  bigEmoji: {
    fontSize: 64,
  },
  celebrationEmoji: {
    fontSize: 24,
    position: 'absolute',
    top: 0,
    right: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  achievementTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
