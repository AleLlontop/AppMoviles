import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, AppState } from 'react-native';
import { TaskCard } from '@/components/TaskCard';
import { EditNameSheet } from '@/components/EditNameSheet';
import { ConfirmModal } from '@/components/ConfirmModal';
import LabelPickerSheet from '@/components/LabelPickerSheet';
import PostSessionSaveModal from '@/components/PostSessionSaveModal';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/utils/supabase';
import { useUser } from '@/hooks/use-user';
import { useAppStore } from '@/store/useAppStore';
import { checkAchievementConditions } from '@/services/achievementsService';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useNetworkSync } from '@/hooks/use-network-sync';
import { isNetworkError } from '@/utils/network';

export default function HomeScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Timer');
  const user = useUser();
  const userId = user?.id ?? null;
  const c = useThemeColors();

  const [subjects, setSubjects] = useState<any[]>([]);
  const [showConnected, setShowConnected] = useState(false);
  const [editingSubject, setEditingSubject] = useState<{ id: string; name: string } | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<{ id: string; name: string } | null>(null);

  const {
    activeSubjectId,
    activeTagId,
    timerSeconds,
    sessionStartTime,
    startTimer,
    stopTimer,
    tick,
    recoverTimer,
    addPendingSession,
    cachedSubjects,
    setCachedSubjects,
    isOnline,
    setOnlineStatus,
    pendingQueue,
  } = useAppStore();

  // Etiquetas de sesión (RF-XX)
  const [labelPickerSubject, setLabelPickerSubject] = useState<{ id: string; name: string } | null>(null);
  const [saveModalData, setSaveModalData] = useState<{
    subjectId: string;
    startTime: Date;
    duration: number;
    tagId: string | null;
  } | null>(null);

  // Activa el sync en background (RNF-03)
  useNetworkSync();

  // Suscripción directa al store para detectar false→true en isOnline,
  // independiente del ciclo de renders del tick del cronómetro
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const unsub = useAppStore.subscribe((state, prev) => {
      if (!prev.isOnline && state.isOnline) {
        setShowConnected(true);
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => setShowConnected(false), 2500);
      }
    });
    return () => {
      unsub();
      clearTimeout(timeoutId);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSubjects();
    }, [userId])
  );

  const fetchSubjects = async () => {
    let query = supabase.from('subjects').select('*');
    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (data) {
      setSubjects(data);
      setCachedSubjects(data);
      setOnlineStatus(true);
    } else if (error) {
      if (isNetworkError(error)) {
        // Error de red: usa el caché silenciosamente, el banner offline lo indica
        if (cachedSubjects.length > 0) setSubjects(cachedSubjects);
        setOnlineStatus(false);
      } else {
        console.error('Error fetching subjects:', error);
      }
    }
  };

  // Inicia el interval y sincroniza el tiempo real desde sessionStartTime (RNF-04)
  // Además: al volver de background recalculamos el tiempo real (setInterval
  // se suspende mientras la app no está activa).
  useEffect(() => {
    if (!activeSubjectId) return;
    recoverTimer();
    const interval = setInterval(tick, 1000);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') recoverTimer();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [activeSubjectId]);

  const saveSession = async (
    subjectId: string,
    start: Date,
    durationSeconds: number,
    tagId: string | null = null,
  ) => {
    // Cada stop del timer = una sesión nueva. Nada de coalescing por día:
    // mantiene fidelidad del historial (rango real == duración) y el adapter
    // de estadísticas igual agrupa por día/materia al render.
    const endTime = new Date();

    try {
      const { error: insertError } = await supabase.from('study_sessions').insert({
        subject_id: subjectId,
        start_time: start.toISOString(),
        end_time: endTime.toISOString(),
        duration: durationSeconds,
        status: 'completed',
        ...(userId ? { user_id: userId } : {}),
        ...(tagId ? { tag_id: tagId } : {}),
      });
      if (insertError) throw insertError;

      setOnlineStatus(true);

      // Verificar si se desbloquearon logros
      if (userId) {
        try {
          const newlyUnlocked = await checkAchievementConditions(userId);
          if (newlyUnlocked.length > 0) {
            // Mostrar el primer logro desbloqueado
            const store = useAppStore.getState();
            store.showAchievementUnlocked(newlyUnlocked[0]);
          }
        } catch (error) {
          console.error('Error checking achievements:', error);
        }
      }
    } catch (e) {
      if (isNetworkError(e)) {
        // Encola la sesión para sincronizar cuando vuelva la conexión (RNF-03)
        addPendingSession({
          id: `${subjectId}-${Date.now()}`,
          subjectId,
          userId,
          startTime: start.toISOString(),
          endTime: endTime.toISOString(),
          duration: durationSeconds,
          tagId,
        });
        setOnlineStatus(false);
      }
    }
  };

  // Si el usuario activó "Avisos de concentración" y la sesión duró >= 60s,
  // mostramos el resumen post-sesión con la cantidad de interrupciones (RF-02 refinado).
  const SUMMARY_MIN_SECONDS = 60;
  const maybeShowSummary = (subjId: string, duration: number) => {
    const s = useAppStore.getState();
    if (!s.focusGuardEnabled || duration < SUMMARY_MIN_SECONDS) return;
    const subjectName = subjects.find((x) => x.id === subjId)?.name ?? 'Sesión';
    s.showSessionSummary({
      subjectName,
      durationSeconds: duration,
      interruptions: s.interruptions,
    });
  };

  const toggleTimer = (subjectId: string) => {
    if (activeSubjectId === subjectId) {
      // STOP: mostrar modal de confirmación con etiqueta pre-seleccionada
      if (sessionStartTime) {
        const duration = Math.floor(
          (new Date().getTime() - new Date(sessionStartTime).getTime()) / 1000
        );
        setSaveModalData({
          subjectId,
          startTime: new Date(sessionStartTime),
          duration,
          tagId: activeTagId,
        });
      } else {
        stopTimer();
      }
    } else {
      // START: si ya hay una sesión activa, pedirle también su confirmación
      if (activeSubjectId && sessionStartTime) {
        const duration = Math.floor(
          (new Date().getTime() - new Date(sessionStartTime).getTime()) / 1000
        );
        setSaveModalData({
          subjectId: activeSubjectId,
          startTime: new Date(sessionStartTime),
          duration,
          tagId: activeTagId,
        });
      }
      // Abrir picker de etiquetas para arrancar nueva sesión
      const subj = subjects.find((s) => s.id === subjectId);
      setLabelPickerSubject({ id: subjectId, name: subj?.name ?? '' });
    }
  };

  const handleLabelPicked = (tagId: string) => {
    if (!labelPickerSubject) return;
    startTimer(labelPickerSubject.id, tagId);
    setLabelPickerSubject(null);
  };

  const handlePostSessionSave = async (tagId: string | null) => {
    if (!saveModalData) return;
    const { subjectId, startTime, duration } = saveModalData;
    setSaveModalData(null);
    if (activeSubjectId === subjectId) stopTimer();
    await saveSession(subjectId, startTime, duration, tagId);
    maybeShowSummary(subjectId, duration);
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  })();
  const displayName =
    user?.user_metadata?.full_name?.split(' ')[0] ??
    user?.user_metadata?.name?.split(' ')[0] ??
    null;

  return (
    <View className="flex-1" style={{ backgroundColor: c.background }}>
      {/* Timer header */}
      <View
        className="h-[300px] items-center justify-center relative overflow-hidden"
        style={{ backgroundColor: c.timerHeader }}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.12)', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {displayName && (
          <Text
            style={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: 15,
              fontWeight: '500',
              marginBottom: 4,
              zIndex: 10,
            }}
          >
            {greeting}, {displayName} 👋
          </Text>
        )}
        <Text className="text-white text-[72px] font-bold tracking-widest z-10">
          {formatTime(timerSeconds)}
        </Text>
        {activeSubjectId && (
          <Text
            style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6, zIndex: 10 }}
          >
            {subjects.find((s) => s.id === activeSubjectId)?.name ?? ''}
          </Text>
        )}
      </View>

      {/* Banner offline (RNF-03) */}
      {!isOnline && (
        <View
          style={{
            backgroundColor: '#F59E0B',
            paddingVertical: 6,
            paddingHorizontal: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
            Sin conexión
            {pendingQueue.length > 0
              ? ` · ${pendingQueue.length} sesión${pendingQueue.length !== 1 ? 'es' : ''} por sincronizar`
              : ''}
          </Text>
        </View>
      )}

      {/* Banner conectado — visible 2.5s al recuperar la conexión */}
      {showConnected && (
        <View
          style={{
            backgroundColor: '#22C55E',
            paddingVertical: 6,
            paddingHorizontal: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
            Conectado · Sesiones sincronizadas
          </Text>
        </View>
      )}

      {/* Tab nav */}
      <View
        className="flex-row py-4 justify-center items-center shadow-sm z-20"
        style={{ backgroundColor: c.surface, elevation: 2 }}
      >
        {(['Timer', 'Estadísticas'] as const).map((tab) => (
          <View key={tab} className="mx-2">
            <TouchableOpacity
              className={
                activeTab === tab
                  ? 'bg-brand-accent px-6 py-2.5 rounded-full items-center justify-center min-w-[120px]'
                  : 'px-6 py-2.5 items-center justify-center min-w-[120px]'
              }
              style={
                activeTab === tab
                  ? {
                      shadowColor: '#826BF0',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.39,
                      shadowRadius: 14,
                      elevation: 8,
                    }
                  : {}
              }
              onPress={() => {
                setActiveTab(tab);
                if (tab === 'Estadísticas') router.push('/(tabs)/estadisticas');
              }}
            >
              <Text
                className={
                  activeTab === tab
                    ? 'text-white text-sm font-semibold'
                    : 'text-brand-accent text-sm font-medium'
                }
              >
                {tab}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Subject list */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Section header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: c.textSecondary,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            Materias · {subjects.length}
          </Text>
        </View>

        {subjects.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
            <Text style={{ fontSize: 32 }}>📚</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: c.textPrimary }}>
              Sin materias aún
            </Text>
            <Text style={{ fontSize: 13, color: c.textSecondary, textAlign: 'center' }}>
              Agregá tu primera materia para empezar a estudiar
            </Text>
          </View>
        ) : (
          subjects.map((subject) => {
            const isActive = activeSubjectId === subject.id;
            return (
              <TaskCard
                key={subject.id}
                name={subject.name}
                time={isActive ? formatTime(timerSeconds) : '00:00:00'}
                active={isActive}
                color={subject.color}
                onPress={() => toggleTimer(subject.id)}
                onEdit={() => setEditingSubject({ id: subject.id, name: subject.name })}
                onDelete={() => setDeletingSubject({ id: subject.id, name: subject.name })}
              />
            );
          })
        )}

        {/* Action button */}
        <TouchableOpacity
          style={{
            paddingVertical: 14,
            paddingHorizontal: 24,
            borderWidth: 1.5,
            borderColor: 'rgba(130,107,240,0.2)',
            backgroundColor: 'rgba(255,255,255,0.6)',
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
          onPress={() => router.push('/add-subject')}
        >
          <Text style={{ fontSize: 20, color: '#826BF0', lineHeight: 22 }}>+</Text>
          <Text style={{ fontSize: 15, color: '#826BF0', fontWeight: '600' }}>Nueva materia</Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmModal
        visible={!!deletingSubject}
        title="Eliminar materia"
        description={
          deletingSubject
            ? `Se va a eliminar "${deletingSubject.name}" junto con todo su historial. Esta acción no se puede deshacer.`
            : ''
        }
        icon="trash-outline"
        confirmLabel="Eliminar"
        destructive
        onConfirm={async () => {
          if (!deletingSubject) return;
          const { error } = await supabase
            .from('subjects')
            .delete()
            .eq('id', deletingSubject.id);
          if (!error) {
            setSubjects((s) => s.filter((x) => x.id !== deletingSubject.id));
            if (activeSubjectId === deletingSubject.id) stopTimer();
          }
          setDeletingSubject(null);
        }}
        onCancel={() => setDeletingSubject(null)}
      />

      <LabelPickerSheet
        visible={!!labelPickerSubject}
        subjectName={labelPickerSubject?.name}
        onClose={() => setLabelPickerSubject(null)}
        onConfirm={handleLabelPicked}
      />

      <PostSessionSaveModal
        visible={!!saveModalData}
        durationSeconds={saveModalData?.duration ?? 0}
        initialTagId={saveModalData?.tagId ?? null}
        onSave={handlePostSessionSave}
        onClose={() => {
          // Cerrar sin guardar = descartar la sesión (equivalente a stop sin guardar)
          if (saveModalData && activeSubjectId === saveModalData.subjectId) stopTimer();
          setSaveModalData(null);
        }}
      />

      <EditNameSheet
        visible={!!editingSubject}
        title="Editar materia"
        description="Cambiá el nombre de la materia. El color lo podés editar desde 'Nueva materia'."
        icon="book-outline"
        initialValue={editingSubject?.name ?? ''}
        placeholder="Ej: Matemáticas"
        minLength={2}
        maxLength={60}
        onClose={() => setEditingSubject(null)}
        onSave={async (newName) => {
          if (!editingSubject || !userId) return;
          const { error } = await supabase
            .from('subjects')
            .update({ name: newName })
            .eq('id', editingSubject.id)
            .eq('user_id', userId);
          if (error) throw error;
          setSubjects((prev) =>
            prev.map((s) => (s.id === editingSubject.id ? { ...s, name: newName } : s))
          );
        }}
      />
    </View>
  );
}
