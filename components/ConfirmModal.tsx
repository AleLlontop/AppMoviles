import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  description?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

// Modal de confirmación reusable. Sigue el patrón visual de FocusGuardModal:
// card centrada, animación spring + fade, divider, botones full-width.
export function ConfirmModal({
  visible,
  title,
  description,
  icon,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const c = useThemeColors();
  const [busy, setBusy] = useState(false);
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setBusy(false);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 220 }),
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

  const handleConfirm = async () => {
    if (busy) return;
    try {
      setBusy(true);
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  const confirmBg = destructive ? '#EF4444' : c.accentStrong;
  const iconBg = destructive ? 'rgba(239,68,68,0.14)' : `${c.accent}29`;
  const iconFg = destructive ? '#EF4444' : c.accentStrong;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: c.modalOverlay }]}
        activeOpacity={1}
        onPress={busy ? undefined : onCancel}
      />
      <View style={styles.centered} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: c.modalBg, transform: [{ scale }], opacity },
          ]}
        >
          {icon && (
            <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
              <Ionicons name={icon} size={26} color={iconFg} />
            </View>
          )}

          <Text style={[styles.title, { color: c.textPrimary }]}>{title}</Text>

          {description ? (
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>{description}</Text>
          ) : null}

          <View style={[styles.divider, { backgroundColor: c.border }]} />

          <TouchableOpacity
            style={[styles.buttonPrimary, { backgroundColor: confirmBg }]}
            activeOpacity={0.85}
            onPress={handleConfirm}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonPrimaryText}>{confirmLabel}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.buttonGhost}
            activeOpacity={0.7}
            onPress={onCancel}
            disabled={busy}
          >
            <Text style={[styles.buttonGhostText, { color: c.textSecondary }]}>{cancelLabel}</Text>
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
    paddingHorizontal: 26,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: -2,
  },
  divider: { width: '100%', height: 1, marginTop: 6, marginBottom: 4 },
  buttonPrimary: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  buttonGhost: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGhostText: { fontSize: 14, fontWeight: '600' },
});
