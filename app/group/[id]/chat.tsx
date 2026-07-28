import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useUser } from '@/hooks/use-user';
import { useGroupPresence } from '@/hooks/use-group-presence';
import { supabase } from '@/utils/supabase';
import { chatService } from '@/services/chatService';
import { getGroup, getGroupMembers, Group, GroupMember } from '@/services/groupsService';
import dayjs from 'dayjs';

interface Message {
  id: string;
  group_id: string;
  user_id: string;
  message: string;
  created_at: string;
  is_edited?: boolean;
  status?: 'sending' | 'sent' | 'error';
  profiles?: {
    name: string | null;
    lastname: string | null;
    nickname: string | null;
    avatar_url: string | null;
  };
}

// Colores pastel para los nombres de usuario
const PASTEL_COLORS = [
  '#FF7096', // Rosado
  '#4EA8DE', // Azul claro
  '#70E000', // Verde
  '#FF9F1C', // Naranja
  '#9B5DE5', // Púrpura
  '#F15BB5', // Magenta
  '#00F5D4', // Turquesa
  '#F3C68F', // Arena/Amarillo
];

const getUserColor = (userId: string) => {
  let sum = 0;
  for (let i = 0; i < userId.length; i++) {
    sum += userId.charCodeAt(i);
  }
  return PASTEL_COLORS[sum % PASTEL_COLORS.length];
};

export default function GroupChatScreen() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const currentUser = useUser();
  const { id: groupId } = useLocalSearchParams<{ id: string }>();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({}); // user_id -> nickname
  const [validationError, setValidationError] = useState('');
  const [optionsVisible, setOptionsVisible] = useState(false);

  // Estados para Edición, Borrado y Mensajes Fijados
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [messageActionsVisible, setMessageActionsVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);

  // Estados para Búsqueda
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const presence = useGroupPresence({ groupId: groupId ?? null });
  const studyingCount = useMemo(() => {
    return Object.values(presence).filter((p) => p.is_studying).length;
  }, [presence]);

  const myRole = useMemo(() => {
    const myMembership = members.find((m) => m.user_id === currentUser?.id);
    return myMembership?.role ?? 'member';
  }, [members, currentUser]);

  const typingTimeoutRef = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const isTypingRef = useRef(false);

  const myNickname = useMemo(() => {
    if (!currentUser) return 'Tú';
    return currentUser.user_metadata?.nickname || currentUser.email?.split('@')[0] || 'Tú';
  }, [currentUser]);

  // Carga inicial
  useEffect(() => {
    if (!groupId) return;

    const init = async () => {
      try {
        setLoading(true);

        const [g, m] = await Promise.all([
          getGroup(groupId),
          getGroupMembers(groupId),
        ]);
        setGroup(g);
        setMembers(m);

        const profileMap = new Map<string, any>();
        m.forEach((member) => {
          profileMap.set(member.user_id, {
            name: member.name,
            nickname: member.nickname,
            avatar_url: member.avatar_url,
          });
        });

        // Cargar historial de mensajes de Supabase
        const { data: dbMessages, error: msgError } = await supabase
          .from('group_messages')
          .select('id, group_id, user_id, message, created_at, is_edited')
          .eq('group_id', groupId)
          .order('created_at', { ascending: true });

        if (msgError) throw msgError;

        const formatted: Message[] = (dbMessages || []).map((msg) => ({
          ...msg,
          status: 'sent',
          profiles: profileMap.get(msg.user_id) || {
            nickname: 'Usuario',
            name: '',
            lastname: '',
            avatar_url: null,
          },
        }));

        setMessages(formatted);

        // Cargar mensaje fijado inicial
        const pinned = await chatService.getPinnedMessage(groupId);
        setPinnedMessage(pinned);
      } catch (err) {
        console.error('Error al inicializar chat:', err);
      } finally {
        setLoading(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
      }
    };

    init();
  }, [groupId]);

  // Conectar a Supabase Realtime Channels
  useEffect(() => {
    if (!groupId || !currentUser) return;

    chatService.connect(groupId, currentUser);

    const unsubStatus = chatService.onConnectionStatusChange((connected) => {
      setIsConnected(connected);
    });

    const unsubMessage = chatService.onMessageReceived((msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;

        const senderProfile = msg.profiles || { nickname: 'Usuario' };

        const newMsg: Message = {
          ...msg,
          status: 'sent',
          profiles: senderProfile,
        };
        return [...prev, newMsg];
      });

      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[msg.user_id];
        return next;
      });

      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    const unsubUpdate = chatService.onMessageUpdated((updatedMsg) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === updatedMsg.id
            ? { ...m, message: updatedMsg.message, is_edited: updatedMsg.is_edited }
            : m
        )
      );

      // Si el mensaje editado era el mensaje fijado, actualizar el banner
      setPinnedMessage((prev) => {
        if (prev && prev.id === updatedMsg.id) {
          return { ...prev, message: updatedMsg.message, is_edited: updatedMsg.is_edited };
        }
        return prev;
      });
    });

    const unsubDelete = chatService.onMessageDeleted((deletedId) => {
      setMessages((prev) => prev.filter((m) => m.id !== deletedId));

      // Si el mensaje borrado era el mensaje fijado, limpiar el banner
      setPinnedMessage((prev) => {
        if (prev && prev.id === deletedId) return null;
        return prev;
      });
    });

    const unsubPinned = chatService.onPinnedMessageChanged((pinnedMsg) => {
      setPinnedMessage(pinnedMsg);
    });

    const unsubTyping = chatService.onUserTyping((typingData) => {
      if (typingData.user_id === currentUser.id) return;

      setTypingUsers((prev) => {
        const next = { ...prev };
        if (typingData.isTyping) {
          next[typingData.user_id] = typingData.nickname;
        } else {
          delete next[typingData.user_id];
        }
        return next;
      });
    });

    return () => {
      unsubStatus();
      unsubMessage();
      unsubUpdate();
      unsubDelete();
      unsubPinned();
      unsubTyping();
      chatService.disconnect();
    };
  }, [groupId, currentUser]);

  // Manejo de escritura (typing status)
  const handleTextChange = (text: string) => {
    setInputText(text);
    if (validationError) setValidationError('');

    if (!groupId || !currentUser) return;

    if (!isTypingRef.current && text.trim().length > 0) {
      isTypingRef.current = true;
      chatService.sendTyping(groupId, currentUser.id, myNickname, true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      chatService.sendTyping(groupId, currentUser.id, myNickname, false);
    }, 2000);
  };

  // Enviar o editar mensaje
  const handleSend = (textToSend = inputText) => {
    if (!groupId || !currentUser) return;

    const trimmed = textToSend.trim();
    if (trimmed.length === 0) {
      setValidationError('Necesitas escribir algo');
      return;
    }

    if (editingMessage) {
      const originalMessageId = editingMessage.id;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === originalMessageId ? { ...m, message: trimmed, is_edited: true } : m
        )
      );
      setEditingMessage(null);
      setInputText('');

      chatService.updateMessage(originalMessageId, trimmed)
        .catch((err) => {
          console.error('Error al editar mensaje:', err);
          Alert.alert('Error', 'No se pudo editar el mensaje.');
        });
      return;
    }

    const tempId = `temp_${Date.now()}`;
    const newMsg: Message = {
      id: tempId,
      group_id: groupId,
      user_id: currentUser.id,
      message: trimmed,
      created_at: new Date().toISOString(),
      status: 'sending',
      profiles: {
        name: currentUser.user_metadata?.name || '',
        lastname: currentUser.user_metadata?.lastname || '',
        nickname: myNickname,
        avatar_url: currentUser.user_metadata?.avatar_url || null,
      },
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
    setValidationError('');
    isTypingRef.current = false;
    chatService.sendTyping(groupId, currentUser.id, myNickname, false);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    chatService.sendMessage(groupId, currentUser.id, trimmed)
      .then((savedMsg) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, id: savedMsg.id, status: 'sent' } : m
          )
        );
      })
      .catch((err) => {
        console.error('Error al enviar mensaje:', err);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m))
        );
      });
  };

  // Reintentar envío fallido
  const handleRetry = (msg: Message) => {
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    handleSend(msg.message);
  };

  // Eliminar mensaje
  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;
    const targetId = selectedMessage.id;
    setConfirmDeleteVisible(false);

    setMessages((prev) => prev.filter((m) => m.id !== targetId));

    try {
      await chatService.deleteMessage(targetId);
    } catch (err) {
      console.error('Error al eliminar mensaje:', err);
      Alert.alert('Error', 'No se pudo eliminar el mensaje.');
    }
  };

  // Activar modo edición
  const handleStartEdit = () => {
    if (!selectedMessage) return;
    setEditingMessage(selectedMessage);
    setInputText(selectedMessage.message);
    setMessageActionsVisible(false);
  };

  // Cancelar edición
  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  // Fijar Mensaje
  const handlePinMessage = async () => {
    if (!selectedMessage || !groupId || !currentUser) return;
    setMessageActionsVisible(false);
    try {
      await chatService.pinMessage(groupId, selectedMessage.id, currentUser.id);
      setPinnedMessage(selectedMessage);
    } catch (err) {
      console.error('Error al fijar mensaje:', err);
      Alert.alert('Error', 'No se pudo fijar el mensaje.');
    }
  };

  // Desfijar Mensaje
  const handleUnpinMessage = async () => {
    if (!groupId) return;
    setMessageActionsVisible(false);
    try {
      await chatService.unpinMessage(groupId);
      setPinnedMessage(null);
    } catch (err) {
      console.error('Error al desfijar mensaje:', err);
      Alert.alert('Error', 'No se pudo desfijar el mensaje.');
    }
  };

  // Mostrar menú de opciones al mantener presionado
  const handleLongPressMessage = (msg: Message) => {
    if (msg.status === 'sending') return;
    setSelectedMessage(msg);
    setMessageActionsVisible(true);
  };

  // Texto del subheader
  const subheaderText = useMemo(() => {
    if (!isConnected) {
      return 'Sin conexión';
    }

    const typers = Object.values(typingUsers);
    if (typers.length > 0) {
      if (typers.length === 1) return `${typers[0]} está escribiendo...`;
      if (typers.length === 2) return `${typers[0]} y ${typers[1]} están escribiendo...`;
      return 'Varios están escribiendo...';
    }

    const count = members.length;
    let text = `${count} ${count === 1 ? 'miembro' : 'miembros'}`;
    if (studyingCount > 0) {
      text += ` · ${studyingCount} estudiando`;
    }
    return text;
  }, [isConnected, typingUsers, members, studyingCount]);

  // Filtrado de mensajes por búsqueda
  const filteredMessages = useMemo(() => {
    if (!isSearching || !searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase().trim();
    return messages.filter((m) => m.message.toLowerCase().includes(q));
  }, [messages, isSearching, searchQuery]);

  // Agrupar mensajes por fecha
  const groupedMessages = useMemo(() => {
    const groups: { title: string; data: Message[] }[] = [];
    const source = isSearching ? filteredMessages : messages;

    source.forEach((msg) => {
      let title = dayjs(msg.created_at).format('DD/MM/YYYY');

      if (dayjs().isSame(dayjs(msg.created_at), 'day')) {
        title = 'HOY';
      } else if (dayjs().subtract(1, 'day').isSame(dayjs(msg.created_at), 'day')) {
        title = 'AYER';
      }

      const existingGroup = groups.find((g) => g.title === title);
      if (existingGroup) {
        existingGroup.data.push(msg);
      } else {
        groups.push({ title, data: [msg] });
      }
    });

    return groups;
  }, [messages, filteredMessages, isSearching]);

  // Renderizar mensaje
  const renderMessageItem = ({ item }: { item: Message }) => {
    const isMe = item.user_id === currentUser?.id;
    const time = dayjs(item.created_at).format('HH:mm');
    const senderName = item.profiles?.nickname || 'Usuario';

    return (
      <View style={[styles.messageRow, isMe ? styles.rowMe : styles.rowOther]}>
        {!isMe && (
          <Text style={[styles.senderName, { color: getUserColor(item.user_id) }]}>
            {senderName}
          </Text>
        )}
        <TouchableOpacity
          onLongPress={() => handleLongPressMessage(item)}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.bubble,
              isMe
                ? [styles.bubbleMe, { backgroundColor: item.status === 'error' ? '#EF4444' : c.accent }]
                : [
                    styles.bubbleOther,
                    {
                      backgroundColor: item.status === 'error' ? '#EF4444' : c.surface,
                      borderColor: item.status === 'error' ? '#EF4444' : c.border,
                      borderWidth: 1,
                    },
                  ],
            ]}
          >
            <Text style={[styles.messageText, { color: (isMe || item.status === 'error') ? '#FFFFFF' : c.textPrimary }]}>
              {item.message}
            </Text>
            <View style={styles.bubbleFooter}>
              {item.is_edited && (
                <Text style={[styles.editedLabel, { color: (isMe || item.status === 'error') ? 'rgba(255,255,255,0.7)' : c.textSecondary }]}>
                  (editado) •{' '}
                </Text>
              )}
              <Text style={[styles.timeText, { color: (isMe || item.status === 'error') ? 'rgba(255,255,255,0.7)' : c.textSecondary }]}>
                {time}
              </Text>
              {isMe && (
                <View style={styles.statusIconContainer}>
                  {item.status === 'sending' && (
                    <View style={[styles.dotLoader, { backgroundColor: '#FFFFFF' }]} />
                  )}
                  {item.status === 'sent' && (
                    <Ionicons name="checkmark-done" size={14} color="#FFFFFF" />
                  )}
                  {item.status === 'error' && (
                    <Ionicons name="alert-circle-outline" size={12} color="#FFFFFF" />
                  )}
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {isMe && item.status === 'error' && (
          <TouchableOpacity onPress={() => handleRetry(item)} style={styles.retryButton}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <View style={[styles.dotLoader, { backgroundColor: '#EF4444', marginRight: 6 }]} />
              <Text style={styles.retryText}>No se pudo enviar - Reintentar</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.surface,
    },
    backButton: {
      padding: 4,
      marginRight: 8,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    avatarText: {
      color: '#FFFFFF',
      fontWeight: 'bold',
      fontSize: 14,
    },
    headerInfo: {
      flex: 1,
    },
    groupName: {
      fontSize: 16,
      fontWeight: '600',
      color: c.textPrimary,
    },
    statusText: {
      fontSize: 12,
      color: isConnected ? c.textSecondary : '#EF4444',
      marginTop: 2,
    },
    moreButton: {
      padding: 6,
    },
    // ---- Estilos Búsqueda ----
    searchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      backgroundColor: c.background,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 4,
      marginRight: 8,
      height: 38,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      padding: 0,
    },
    // ---- Estilos Pinned Banner ----
    pinnedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
    },
    pinnedLabel: {
      fontSize: 11,
      fontWeight: '700',
    },
    pinnedText: {
      fontSize: 12,
      marginTop: 1,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 10,
    },
    dateSeparator: {
      alignSelf: 'center',
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginVertical: 14,
    },
    dateText: {
      fontSize: 11,
      fontWeight: '600',
      color: c.textSecondary,
    },
    messageRow: {
      marginVertical: 4,
      maxWidth: '80%',
    },
    rowMe: {
      alignSelf: 'flex-end',
      alignItems: 'flex-end',
    },
    rowOther: {
      alignSelf: 'flex-start',
      alignItems: 'flex-start',
    },
    senderName: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 3,
      marginLeft: 4,
    },
    bubble: {
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    bubbleMe: {
      borderBottomRightRadius: 4,
    },
    bubbleOther: {
      borderBottomLeftRadius: 4,
    },
    messageText: {
      fontSize: 14,
      lineHeight: 20,
    },
    bubbleFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: 4,
    },
    editedLabel: {
      fontSize: 9,
      fontStyle: 'italic',
    },
    timeText: {
      fontSize: 9,
    },
    statusIconContainer: {
      marginLeft: 4,
    },
    dotLoader: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    retryButton: {
      marginTop: 2,
      paddingVertical: 2,
    },
    retryText: {
      color: '#EF4444',
      fontSize: 11,
      fontWeight: '600',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    emptyIconContainer: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyDesc: {
      fontSize: 13,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    footer: {
      padding: 10,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    editBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: 'rgba(165,148,249,0.1)',
      borderRadius: 12,
      marginBottom: 8,
    },
    editBarText: {
      fontSize: 12,
      fontWeight: '600',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    inputContainer: {
      flex: 1,
      backgroundColor: c.background,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginRight: 8,
      minHeight: 40,
      maxHeight: 100,
      justifyContent: 'center',
    },
    textInput: {
      color: c.textPrimary,
      fontSize: 14,
      padding: 0,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    errorText: {
      color: '#EF4444',
      fontSize: 12,
      marginTop: 4,
      marginLeft: 16,
    },
    // ---- Bottom sheet de opciones ----
    sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 40,
      gap: 10,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
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
    sheetDot: { width: 12, height: 12, borderRadius: 6 },
    sheetTitle: { fontSize: 17, fontWeight: '700' },
    sheetSub: { fontSize: 13, marginTop: 1 },
    sheetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderRadius: 18,
      padding: 16,
    },
    sheetBtnIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetBtnText: { flex: 1, fontSize: 15, fontWeight: '600' },
    sheetCancel: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
    sheetCancelText: { fontSize: 15, fontWeight: '500' },
    // ---- Modal de Confirmación de Eliminación ----
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    confirmCard: {
      width: '100%',
      padding: 24,
      borderRadius: 24,
      alignItems: 'center',
    },
    confirmIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      backgroundColor: 'rgba(239, 68, 68, 0.14)',
    },
    confirmTitle: {
      fontSize: 20,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: 8,
    },
    confirmDesc: {
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 20,
    },
    confirmDeleteBtn: {
      width: '100%',
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#EF4444',
      marginBottom: 12,
    },
    confirmDeleteText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    confirmCancelBtn: {
      width: '100%',
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmCancelText: {
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        {isSearching ? (
          <View style={styles.searchHeader}>
            <Ionicons name="search" size={18} color={c.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: c.textPrimary }]}
              placeholder="Buscar mensaje..."
              placeholderTextColor={c.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setIsSearching(false); setSearchQuery(''); }}>
              <Ionicons name="close" size={20} color={c.textPrimary} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
            </TouchableOpacity>

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {group?.name ? group.name.substring(0, 2).toUpperCase() : 'GP'}
              </Text>
            </View>

            <View style={styles.headerInfo}>
              <Text style={styles.groupName} numberOfLines={1}>
                {group?.name || 'Cargando grupo...'}
              </Text>
              <Text style={[styles.statusText, !isConnected && { color: '#EF4444' }]} numberOfLines={1}>
                <Text style={{ color: isConnected ? '#10B981' : '#EF4444' }}>• </Text>
                {subheaderText}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => setOptionsVisible(true)}
            >
              <Ionicons name="ellipsis-vertical" size={20} color={c.textPrimary} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Banner Mensaje Fijado */}
      {pinnedMessage && !isSearching && (
        <View style={[styles.pinnedBanner, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <Ionicons name="pin" size={16} color={c.accent} style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.pinnedLabel, { color: c.accent }]}>Mensaje Fijado</Text>
            <Text style={[styles.pinnedText, { color: c.textPrimary }]} numberOfLines={1}>
              {pinnedMessage.message}
            </Text>
          </View>
          <TouchableOpacity onPress={handleUnpinMessage} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={18} color={c.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Keyboard Avoiding Container for Body + Footer */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Body */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={c.accent} />
          </View>
        ) : filteredMessages.length === 0 && isSearching ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="search-outline" size={32} color={c.accent} />
            </View>
            <Text style={styles.emptyTitle}>Sin resultados</Text>
            <Text style={styles.emptyDesc}>
              No encontramos ningún mensaje que coincida con tu búsqueda.
            </Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={32} color={c.accent} />
            </View>
            <Text style={styles.emptyTitle}>Iniciá la conversación</Text>
            <Text style={styles.emptyDesc}>
              Todavía no hay mensajes en este grupo. Escribí el primero para empezar.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={groupedMessages}
            keyExtractor={(item) => item.title}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <View>
                {/* Separador de Fecha */}
                <View style={styles.dateSeparator}>
                  <Text style={styles.dateText}>{item.title}</Text>
                </View>
                <FlatList
                  data={item.data}
                  keyExtractor={(msg) => msg.id}
                  renderItem={renderMessageItem}
                  scrollEnabled={false}
                />
              </View>
            )}
          />
        )}

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {/* Barra indicadora de Edición */}
          {editingMessage && (
            <View style={styles.editBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="create-outline" size={16} color={c.accent} />
                <Text style={[styles.editBarText, { color: c.accent }]}>Editando mensaje...</Text>
              </View>
              <TouchableOpacity onPress={handleCancelEdit}>
                <Ionicons name="close-circle" size={18} color={c.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Mensaje"
                placeholderTextColor={c.textSecondary}
                value={inputText}
                onChangeText={handleTextChange}
                multiline
                maxLength={500}
              />
            </View>
            <TouchableOpacity
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={() => handleSend()}
            >
              <Ionicons
                name={editingMessage ? 'checkmark' : 'send'}
                size={18}
                color="#FFFFFF"
                style={!editingMessage && { marginLeft: 2 }}
              />
            </TouchableOpacity>
          </View>

          {validationError ? (
            <Text style={styles.errorText}>• {validationError}</Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      {/* Bottom sheet de opciones del grupo (kebab ⋮) */}
      <Modal
        transparent
        visible={optionsVisible}
        animationType="slide"
        onRequestClose={() => setOptionsVisible(false)}
      >
        <TouchableOpacity
          style={[styles.sheetOverlay, { backgroundColor: c.modalOverlay }]}
          activeOpacity={1}
          onPress={() => setOptionsVisible(false)}
        >
          <View style={[styles.sheet, { backgroundColor: c.modalBg }]}>
            <View style={[styles.sheetHandle, { backgroundColor: c.handle }]} />

            <View style={styles.sheetHeader}>
              <View style={[styles.sheetDot, { backgroundColor: c.accent }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: c.textPrimary }]}>{group?.name || 'Chat'}</Text>
                <Text style={[styles.sheetSub, { color: c.textSecondary }]}>¿Qué deseas hacer?</Text>
              </View>
            </View>

            {/* Buscar en el Chat */}
            <TouchableOpacity
              style={[styles.sheetBtn, { backgroundColor: c.background }]}
              onPress={() => {
                setOptionsVisible(false);
                setIsSearching(true);
              }}
            >
              <View style={[styles.sheetBtnIcon, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="search" size={20} color="#0284C7" />
              </View>
              <Text style={[styles.sheetBtnText, { color: c.textPrimary }]}>Buscar en el Chat</Text>
              <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
            </TouchableOpacity>

            {/* Ver Info del Grupo */}
            <TouchableOpacity
              style={[styles.sheetBtn, { backgroundColor: c.background }]}
              onPress={() => {
                setOptionsVisible(false);
                router.push(`/group/${groupId}/info`);
              }}
            >
              <View style={[styles.sheetBtnIcon, { backgroundColor: '#E0E7FF' }]}>
                <Ionicons name="information-circle" size={20} color={c.accentStrong} />
              </View>
              <Text style={[styles.sheetBtnText, { color: c.textPrimary }]}>Ver Info del Grupo</Text>
              <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => setOptionsVisible(false)}
            >
              <Text style={[styles.sheetCancelText, { color: c.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Bottom sheet de opciones de mensaje (Long Press) */}
      <Modal
        transparent
        visible={messageActionsVisible}
        animationType="slide"
        onRequestClose={() => setMessageActionsVisible(false)}
      >
        <TouchableOpacity
          style={[styles.sheetOverlay, { backgroundColor: c.modalOverlay }]}
          activeOpacity={1}
          onPress={() => setMessageActionsVisible(false)}
        >
          <View style={[styles.sheet, { backgroundColor: c.modalBg }]}>
            <View style={[styles.sheetHandle, { backgroundColor: c.handle }]} />

            <View style={styles.sheetHeader}>
              <View style={[styles.sheetDot, { backgroundColor: c.accent }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: c.textPrimary }]}>Opciones de Mensaje</Text>
                <Text style={[styles.sheetSub, { color: c.textSecondary }]} numberOfLines={1}>
                  "{selectedMessage?.message}"
                </Text>
              </View>
            </View>

            {/* Fijar / Desfijar Mensaje (Cualquier usuario puede hacerlo) */}
            {pinnedMessage?.id === selectedMessage?.id ? (
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: c.background }]}
                onPress={handleUnpinMessage}
              >
                <View style={[styles.sheetBtnIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="pin-outline" size={20} color="#D97706" />
                </View>
                <Text style={[styles.sheetBtnText, { color: c.textPrimary }]}>Desfijar Mensaje</Text>
                <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: c.background }]}
                onPress={handlePinMessage}
              >
                <View style={[styles.sheetBtnIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="pin" size={20} color="#D97706" />
                </View>
                <Text style={[styles.sheetBtnText, { color: c.textPrimary }]}>Fijar Mensaje</Text>
                <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
              </TouchableOpacity>
            )}

            {/* Editar (Solo si es mi mensaje) */}
            {selectedMessage?.user_id === currentUser?.id && (
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: c.background }]}
                onPress={handleStartEdit}
              >
                <View style={[styles.sheetBtnIcon, { backgroundColor: '#E0E7FF' }]}>
                  <Ionicons name="create" size={20} color={c.accentStrong} />
                </View>
                <Text style={[styles.sheetBtnText, { color: c.textPrimary }]}>Editar Mensaje</Text>
                <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
              </TouchableOpacity>
            )}

            {/* Eliminar (Si es mi mensaje o soy owner/admin) */}
            {(selectedMessage?.user_id === currentUser?.id || myRole === 'owner' || myRole === 'admin') && (
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: '#FEE2E2' }]}
                onPress={() => {
                  setMessageActionsVisible(false);
                  setConfirmDeleteVisible(true);
                }}
              >
                <View style={[styles.sheetBtnIcon, { backgroundColor: '#FCA5A5' }]}>
                  <Ionicons name="trash" size={20} color="#DC2626" />
                </View>
                <Text style={[styles.sheetBtnText, { color: '#DC2626' }]}>Eliminar Mensaje</Text>
                <Ionicons name="chevron-forward" size={18} color="#DC2626" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => setMessageActionsVisible(false)}
            >
              <Text style={[styles.sheetCancelText, { color: c.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal de Confirmación de Eliminación de Mensaje (Estilo Premium) */}
      <Modal transparent visible={confirmDeleteVisible} animationType="fade" onRequestClose={() => setConfirmDeleteVisible(false)}>
        <TouchableOpacity 
          style={[styles.modalOverlay, { backgroundColor: c.modalOverlay }]} 
          activeOpacity={1}
          onPress={() => setConfirmDeleteVisible(false)}
        >
          <TouchableOpacity 
            style={[styles.confirmCard, { backgroundColor: c.surface }]} 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.confirmIconContainer}>
              <Ionicons name="trash-outline" size={26} color="#EF4444" />
            </View>
            <Text style={[styles.confirmTitle, { color: c.textPrimary }]}>Eliminar Mensaje</Text>
            <Text style={[styles.confirmDesc, { color: c.textSecondary }]}>
              ¿Estás seguro de que quieres eliminar este mensaje? Esta acción no se puede deshacer.
            </Text>
            <TouchableOpacity
              style={styles.confirmDeleteBtn}
              onPress={handleDeleteMessage}
            >
              <Text style={styles.confirmDeleteText}>Eliminar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmCancelBtn, { backgroundColor: c.background }]}
              onPress={() => setConfirmDeleteVisible(false)}
            >
              <Text style={[styles.confirmCancelText, { color: c.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
