import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';

interface EditNameSheetProps {
  visible: boolean;
  title: string;
  description?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  initialValue: string;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  saveLabel?: string;
  // Devolver el nuevo valor; lanzar para que el sheet muestre el mensaje en el banner.
  onSave: (newValue: string) => Promise<void> | void;
  onClose: () => void;
}

export function EditNameSheet({
  visible,
  title,
  description,
  icon = 'pencil',
  initialValue,
  placeholder,
  minLength = 3,
  maxLength = 50,
  saveLabel = 'Guardar cambios',
  onSave,
  onClose,
}: EditNameSheetProps) {
  const c = useThemeColors();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      setError(null);
      setSaving(false);
    }
  }, [visible, initialValue]);

  // El KeyboardAvoidingView dentro de un Modal es flaky en Android — y a veces
  // también en iOS según la versión. Empujamos el sheet manualmente con paddingBottom
  // igual a la altura del teclado.
  useEffect(() => {
    if (!visible) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => {
      setKbHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const trimmed = value.trim();
  const tooShort = trimmed.length < minLength;
  const tooLong = trimmed.length > maxLength;
  const disabled = saving || tooShort || tooLong || trimmed === initialValue.trim();

  const handleSave = async () => {
    if (disabled) return;
    setError(null);
    setSaving(true);
    try {
      await onSave(trimmed);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const counterColor =
    trimmed.length > maxLength
      ? '#EF4444'
      : trimmed.length > maxLength * 0.9
      ? '#F59E0B'
      : c.accentStrong;

  // Padding base + altura del teclado para que el contenido no quede tapado.
  const basePadBottom = Platform.OS === 'ios' ? 40 : 28;
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => !saving && onClose()}
    >
      <View style={styles.outer}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.backdrop, { backgroundColor: c.modalOverlay }]}
          onPress={() => {
            if (saving) return;
            Keyboard.dismiss();
            onClose();
          }}
        />
        <View style={styles.kav} pointerEvents="box-none">
          <View
            style={[
              styles.sheet,
              { backgroundColor: c.modalBg, paddingBottom: basePadBottom + kbHeight },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: c.handle }]} />

            <View style={styles.header}>
              <View style={[styles.iconWrap, { backgroundColor: `${c.accent}29` }]}>
                <Ionicons name={icon} size={18} color={c.accentStrong} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: c.textPrimary }]}>{title}</Text>
                {description ? (
                  <Text style={[styles.desc, { color: c.textSecondary }]} numberOfLines={2}>
                    {description}
                  </Text>
                ) : null}
              </View>
            </View>

            <Text style={[styles.label, { color: c.textSecondary }]}>NOMBRE</Text>
            <TextInput
              value={value}
              onChangeText={(t) => {
                setValue(t);
                if (error) setError(null);
              }}
              placeholder={placeholder}
              placeholderTextColor={c.textSecondary}
              autoFocus
              maxLength={maxLength}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              style={[
                styles.input,
                {
                  backgroundColor: c.surface,
                  color: c.textPrimary,
                  borderColor: c.border,
                },
              ]}
            />
            <View style={styles.hintRow}>
              <Text style={{ fontSize: 11, color: c.textSecondary }}>
                Entre {minLength} y {maxLength} caracteres
              </Text>
              <Text style={{ fontSize: 11, color: counterColor, fontWeight: '600' }}>
                {trimmed.length} / {maxLength}
              </Text>
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="warning" size={14} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleSave}
              disabled={disabled}
              activeOpacity={0.85}
              style={[
                styles.saveBtn,
                { backgroundColor: c.accentStrong, opacity: disabled ? 0.5 : 1 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>{saveLabel}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => !saving && onClose()}
              style={styles.cancelBtn}
              disabled={saving}
            >
              <Text style={[styles.cancelText, { color: c.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  outer: { ...StyleSheet.absoluteFillObject },
  backdrop: { ...StyleSheet.absoluteFillObject },
  kav: { flex: 1, justifyContent: 'flex-end' },

  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    // paddingBottom se aplica inline porque incluye la altura del teclado
    gap: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700' },
  desc: { fontSize: 12, marginTop: 2 },

  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginLeft: 4,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '600',
  },
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 6,
    marginBottom: 6,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: { color: '#EF4444', fontSize: 13, flex: 1 },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  cancelBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 2 },
  cancelText: { fontSize: 14, fontWeight: '500' },
});
