import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store/useAppStore';
import { useThemeColors } from '@/hooks/use-theme-colors';

// RF-02 (refinado): resumen post-sesión. Se muestra al parar el cronómetro
// cuando el usuario activó "Avisos de concentración" en More.
export default function SessionSummaryModal() {
  const sessionSummary = useAppStore((s) => s.sessionSummary);
  const hide = useAppStore((s) => s.hideSessionSummary);
  const c = useThemeColors();

  const { visible, durationSeconds, interruptions } = sessionSummary;

  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 18,
          stiffness: 220,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(0.85);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity]);

  const perfect = interruptions === 0;
  const okColor = '#10B981';
  const warnColor = '#F59E0B';
  const accent = perfect ? okColor : warnColor;
  const accentSoft = perfect ? 'rgba(16,185,129,0.14)' : 'rgba(245,158,11,0.14)';

  const h = Math.floor(durationSeconds / 3600);
  const m = Math.floor((durationSeconds % 3600) / 60);
  const durationText = h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={hide}>
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: c.modalOverlay }]}
        activeOpacity={1}
        onPress={hide}
      />
      <View style={styles.centered} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: c.modalBg, transform: [{ scale }], opacity },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: accentSoft }]}>
            <Ionicons
              name={perfect ? 'checkmark-circle' : 'alert-circle'}
              size={34}
              color={accent}
            />
          </View>

          <Text style={[styles.title, { color: c.textPrimary }]}>Sesión completada</Text>

          <Text style={[styles.duration, { color: c.accentStrong }]}>{durationText}</Text>

          <View style={[styles.divider, { backgroundColor: c.border }]} />

          {perfect ? (
            <>
              <Text style={[styles.stat, { color: okColor }]}>Sin interrupciones</Text>
              <Text style={[styles.statSub, { color: c.textSecondary }]}>
                Mantuviste el foco. Buena sesión.
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.stat, { color: warnColor }]}>
                {interruptions === 1 ? '1 interrupción' : `${interruptions} interrupciones`}
              </Text>
              <Text style={[styles.statSub, { color: c.textSecondary }]}>
                Saliste de la app durante la sesión.
              </Text>
            </>
          )}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: c.accentStrong }]}
            activeOpacity={0.85}
            onPress={hide}
          >
            <Text style={styles.buttonText}>Listo</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  duration: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: -0.5,
  },
  divider: {
    width: '100%',
    height: 1,
    marginTop: 14,
    marginBottom: 14,
  },
  stat: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  statSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
    paddingHorizontal: 8,
  },
  button: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
