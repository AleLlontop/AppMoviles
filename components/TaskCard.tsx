import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface TaskCardProps {
  name: string;
  time: string;
  active?: boolean;
  color?: string;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function TaskCard({ name, time, active, color, onPress, onEdit, onDelete }: TaskCardProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const initial = name.trim()[0]?.toUpperCase() ?? '?';
  const subjectColor = color || '#826BF0';

  return (
    <>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.82}
        style={[styles.card, active && styles.cardActive]}
      >
        {active ? (
          <LinearGradient
            colors={['#A799E7', '#826BF0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconActive}
          >
            <Text style={styles.iconTextActive}>{initial}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.iconInactive, { borderColor: `${subjectColor}55` }]}>
            <Text style={[styles.iconTextInactive, { color: subjectColor }]}>{initial}</Text>
          </View>
        )}

        <Text style={[styles.name, active && styles.nameActive]} numberOfLines={1}>
          {name}
        </Text>

        <Text style={[styles.time, active && styles.timeActive]}>{time}</Text>

        {(onEdit || onDelete) && (
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginLeft: 8 }}
          >
            <Ionicons name="ellipsis-vertical" size={16} color={active ? '#9CA3AF' : '#C4BED4'} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <Modal transparent visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={[styles.sheetDot, { backgroundColor: subjectColor }]} />
              <View>
                <Text style={styles.sheetTitle}>{name}</Text>
                <Text style={styles.sheetSub}>¿Qué deseas hacer?</Text>
              </View>
            </View>

            {onEdit && (
              <TouchableOpacity style={styles.sheetBtn} onPress={() => { setModalVisible(false); onEdit(); }}>
                <View style={styles.sheetBtnIcon}>
                  <Ionicons name="pencil" size={18} color="#826BF0" />
                </View>
                <Text style={styles.sheetBtnText}>Editar materia</Text>
                <Ionicons name="chevron-forward" size={16} color="#7B7486" />
              </TouchableOpacity>
            )}

            {onDelete && (
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnRed]} onPress={() => { setModalVisible(false); onDelete(); }}>
                <View style={[styles.sheetBtnIcon, { backgroundColor: '#FEF2F2' }]}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </View>
                <Text style={[styles.sheetBtnText, { color: '#EF4444' }]}>Eliminar materia</Text>
                <Ionicons name="chevron-forward" size={16} color="#EF4444" />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.sheetCancel} onPress={() => setModalVisible(false)}>
              <Text style={styles.sheetCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  cardActive: {
    borderWidth: 1.5,
    borderColor: '#826BF0',
    shadowColor: '#826BF0',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 4,
  },
  iconInactive: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconActive: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#826BF0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  iconTextActive: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  iconTextInactive: {
    fontSize: 17,
    fontWeight: '700',
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  nameActive: {
    fontWeight: '700',
    color: '#191C1E',
  },
  time: {
    fontSize: 12,
    color: '#C4BED4',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginLeft: 8,
  },
  timeActive: {
    color: '#826BF0',
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(25,28,30,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    gap: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  sheetDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#191C1E',
  },
  sheetSub: {
    fontSize: 13,
    color: '#7B7486',
    marginTop: 1,
  },
  sheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#F8F9FE',
    borderRadius: 18,
    padding: 16,
  },
  sheetBtnRed: { backgroundColor: '#FEF2F2' },
  sheetBtnIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#191C1E',
  },
  sheetCancel: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 2,
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#7B7486',
  },
});
