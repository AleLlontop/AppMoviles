import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, Animated, Easing,
} from 'react-native';
import { useAppStore } from '@/store/useAppStore';
import { useThemeColors } from '@/hooks/use-theme-colors';

export default function FocusGuardModal() {
  const { focusGuardModal, hideFocusGuardModal } = useAppStore();
  const c = useThemeColors();
  const { visible, interruptions } = focusGuardModal;

  // Animación de entrada (scale + fade)
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 18,
          stiffness: 220,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const interruptionLabel = interruptions === 1
    ? '1 interrupción'
    : `${interruptions} interrupciones`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={hideFocusGuardModal}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: c.modalOverlay }]}
        activeOpacity={1}
        onPress={hideFocusGuardModal}
      />

      {/* Card centrada */}
      <View style={styles.centered} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: c.modalBg, transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {/* Título */}
          <Text style={[styles.title, { color: c.textPrimary }]}>
            Bienvenido de vuelta
          </Text>

          {/* Subtítulo */}
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            {interruptions === 1
              ? 'Tuviste 1 interrupción en esta sesión.'
              : `Tuviste ${interruptions} interrupciones en esta sesión.`}
          </Text>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: c.border }]} />

          {/* Botón */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: c.accentStrong }]}
            activeOpacity={0.85}
            onPress={hideFocusGuardModal}
          >
            <Text style={styles.buttonText}>Volver al estudio</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
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
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  divider: {
    width: '100%',
    height: 1,
    marginVertical: 4,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
