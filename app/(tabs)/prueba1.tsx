import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/use-theme-colors';
import { supabase } from '@/utils/supabase';

type Task = {
  id: string;
  title: string;
  completed: boolean;
};

type Subject = {
  id: string;
  name: string;
  tasks: Task[];
};

export default function TasksScreen() {
  const c = useThemeColors();

  const [loadingSession, setLoadingSession] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsLoggedIn(!!session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkSession = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    setIsLoggedIn(!!session);
    setLoadingSession(false);
  };

  const [subjects, setSubjects] = useState<Subject[]>([
    {
      id: '1',
      name: 'Matemática',
      tasks: [
        { id: '1', title: 'Resolver TP 1', completed: true },
        { id: '2', title: 'Leer capítulo 4', completed: false },
        { id: '3', title: 'Practicar integrales', completed: false },
        { id: '4', title: 'Entregar ejercicios', completed: true },
      ],
    },
    {
      id: '2',
      name: 'Programación',
      tasks: [
        { id: '1', title: 'Crear API FastAPI', completed: true },
        { id: '2', title: 'Configurar Docker Compose', completed: false },
        { id: '3', title: 'Escribir tests', completed: false },
      ],
    },
    {
      id: '3',
      name: 'Base de Datos',
      tasks: [
        {
          id: '1',
          title: 'Modelo entidad relación',
          completed: false,
        },
        {
          id: '2',
          title: 'Normalización',
          completed: false,
        },
      ],
    },
  ]);

  const toggleTask = (
    subjectId: string,
    taskId: string
  ) => {
    setSubjects((prev) =>
      prev.map((subject) => {
        if (subject.id !== subjectId) return subject;

        return {
          ...subject,
          tasks: subject.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  completed: !task.completed,
                }
              : task
          ),
        };
      })
    );
  };

  const totalTasks = subjects.reduce(
    (acc, subject) => acc + subject.tasks.length,
    0
  );

  const completedTasks = subjects.reduce(
    (acc, subject) =>
      acc +
      subject.tasks.filter((t) => t.completed).length,
    0
  );

  if (loadingSession) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: c.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            color: c.textPrimary,
            fontSize: 16,
          }}
        >
          Cargando...
        </Text>
      </SafeAreaView>
    );
  }

  if (!isLoggedIn) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: c.background,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            width: '100%',
            backgroundColor: c.surface,
            borderRadius: 24,
            padding: 28,
            alignItems: 'center',
            borderWidth: 1,
            borderColor:
              c.border ?? 'rgba(0,0,0,0.08)',
          }}
        >
          <Ionicons
            name="lock-closed"
            size={64}
            color={c.accent}
          />

          <Text
            style={{
              color: c.textPrimary,
              fontSize: 24,
              fontWeight: '700',
              marginTop: 16,
              textAlign: 'center',
            }}
          >
            Debes iniciar sesión
          </Text>

          <Text
            style={{
              color: c.textSecondary,
              fontSize: 15,
              textAlign: 'center',
              marginTop: 8,
              lineHeight: 22,
            }}
          >
            Iniciá sesión para acceder a tus
            dashboards, materias y tareas
            pendientes.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: c.background,
      }}
      edges={['top']}
    >
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 100,
        }}
      >
        <View
          style={[
            styles.header,
            {
              backgroundColor: c.accent,
            },
          ]}
        >
          <Text style={styles.headerDate}>
            Dashboard académico
          </Text>

          <Text style={styles.headerTitle}>
            Mis tareas
          </Text>

          <Text style={styles.headerSub}>
            {completedTasks} de {totalTasks}{' '}
            completadas
          </Text>
        </View>

        <View style={styles.mainContent}>
          {subjects.map((subject) => {
            const pending =
              subject.tasks.filter(
                (t) => !t.completed
              ).length;

            return (
              <View
                key={subject.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: c.surface,
                    borderWidth: 1,
                    borderColor:
                      c.border ??
                      'rgba(0,0,0,0.08)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.subjectTitle,
                    {
                      color: c.textPrimary,
                    },
                  ]}
                >
                  {subject.name}
                </Text>

                <Text
                  style={[
                    styles.subjectSubtitle,
                    {
                      color: c.textSecondary,
                    },
                  ]}
                >
                  {pending} pendientes
                </Text>

                {subject.tasks.map((task) => (
                  <TouchableOpacity
                    key={task.id}
                    style={styles.taskRow}
                    onPress={() =>
                      toggleTask(
                        subject.id,
                        task.id
                      )
                    }
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor:
                            c.accent,
                        },
                        task.completed && {
                          backgroundColor:
                            c.accent,
                        },
                      ]}
                    >
                      {task.completed && (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color="#FFF"
                        />
                      )}
                    </View>

                    <Text
                      style={[
                        styles.taskText,
                        {
                          color: task.completed
                            ? c.textSecondary
                            : c.textPrimary,
                        },
                        task.completed &&
                          styles.taskCompleted,
                      ]}
                    >
                      {task.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>
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
    marginBottom: 6,
  },

  headerTitle: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 8,
  },

  headerSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },

  mainContent: {
    padding: 16,
    gap: 16,
  },

  card: {
    borderRadius: 24,
    padding: 20,
  },

  subjectTitle: {
    fontSize: 22,
    fontWeight: '700',
  },

  subjectSubtitle: {
    marginTop: 4,
    marginBottom: 16,
  },

  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },

  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  taskText: {
    fontSize: 15,
    flex: 1,
  },

  taskCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
});