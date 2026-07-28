import { supabase } from '@/utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

class ChatService {
  private channel: RealtimeChannel | null = null;
  private statusListeners: Array<(isConnected: boolean) => void> = [];
  private messageHandlers: Array<(message: any) => void> = [];
  private updateHandlers: Array<(message: any) => void> = [];
  private deleteHandlers: Array<(messageId: string) => void> = [];
  private typingHandlers: Array<(typingData: { user_id: string; nickname: string; isTyping: boolean }) => void> = [];
  private pinnedMessageHandlers: Array<(message: any | null) => void> = [];

  /**
   * Conecta al canal Realtime de Supabase
   */
  connect(groupId: string, currentUser: { id: string; email?: string; user_metadata?: any }) {
    if (this.channel) {
      this.disconnect();
    }

    // Crear un único canal para este grupo con capacidad de Broadcast
    this.channel = supabase.channel(`group-chat:${groupId}`, {
      config: {
        broadcast: { self: false }, // Evita recibir nuestros propios eventos de escritura
      },
    });

    // 1. Escuchar inserciones en la tabla group_messages
    this.channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      },
      async (payload) => {
        const newMsg = payload.new;

        const { data: profile } = await supabase
          .from('profiles')
          .select('name, lastname, nickname, avatar_url')
          .eq('user_id', newMsg.user_id)
          .single();

        const formattedMessage = {
          ...newMsg,
          profiles: profile || {
            nickname: 'Usuario',
            name: '',
            lastname: '',
            avatar_url: null,
          },
        };

        this.messageHandlers.forEach((handler) => handler(formattedMessage));
      }
    );

    // 2. Escuchar ediciones (UPDATE) en la tabla group_messages
    this.channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      },
      async (payload) => {
        const updatedMsg = payload.new;

        const { data: profile } = await supabase
          .from('profiles')
          .select('name, lastname, nickname, avatar_url')
          .eq('user_id', updatedMsg.user_id)
          .single();

        const formattedMessage = {
          ...updatedMsg,
          profiles: profile || {
            nickname: 'Usuario',
            name: '',
            lastname: '',
            avatar_url: null,
          },
        };

        this.updateHandlers.forEach((handler) => handler(formattedMessage));
      }
    );

    // 3. Escuchar eliminaciones (DELETE) en la tabla group_messages
    this.channel.on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      },
      (payload) => {
        const deletedId = payload.old.id;
        this.deleteHandlers.forEach((handler) => handler(deletedId));
      }
    );

    // 4. Escuchar cambios en la tabla de mensajes fijados (group_pinned_messages)
    this.channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'group_pinned_messages',
        filter: `group_id=eq.${groupId}`,
      },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          this.pinnedMessageHandlers.forEach((handler) => handler(null));
        } else {
          const pinnedRow = payload.new;
          const { data: msg } = await supabase
            .from('group_messages')
            .select('id, group_id, user_id, message, created_at, is_edited')
            .eq('id', pinnedRow.message_id)
            .single();

          if (msg) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name, lastname, nickname, avatar_url')
              .eq('user_id', msg.user_id)
              .single();

            const formatted = {
              ...msg,
              profiles: profile || {
                nickname: 'Usuario',
                name: '',
                lastname: '',
                avatar_url: null,
              },
            };
            this.pinnedMessageHandlers.forEach((handler) => handler(formatted));
          } else {
            this.pinnedMessageHandlers.forEach((handler) => handler(null));
          }
        }
      }
    );

    // 5. Escuchar el estado de "Escribiendo..." vía Broadcast
    this.channel.on('broadcast', { event: 'typing' }, (response) => {
      const { user_id, nickname, isTyping } = response.payload;
      this.typingHandlers.forEach((handler) => handler({ user_id, nickname, isTyping }));
    });

    // Suscribirse y monitorear el estado de la conexión
    this.channel.subscribe((status) => {
      const isConnected = status === 'SUBSCRIBED';
      this.notifyStatus(isConnected);
    });
  }

  /**
   * Inserta el mensaje directamente en Supabase
   */
  async sendMessage(groupId: string, userId: string, message: string) {
    const { data, error } = await supabase
      .from('group_messages')
      .insert({
        group_id: groupId,
        user_id: userId,
        message: message.trim(),
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Edita un mensaje existente en la base de datos
   */
  async updateMessage(messageId: string, newMessage: string) {
    const { data, error } = await supabase
      .from('group_messages')
      .update({
        message: newMessage.trim(),
        is_edited: true,
      })
      .eq('id', messageId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Elimina un mensaje de la base de datos
   */
  async deleteMessage(messageId: string) {
    const { error } = await supabase
      .from('group_messages')
      .delete()
      .eq('id', messageId);

    if (error) throw error;
  }

  /**
   * Fijar mensaje en el grupo
   */
  async pinMessage(groupId: string, messageId: string, userId: string) {
    const { error } = await supabase
      .from('group_pinned_messages')
      .upsert({
        group_id: groupId,
        message_id: messageId,
        pinned_by: userId,
      });

    if (error) throw error;
  }

  /**
   * Desfijar mensaje en el grupo
   */
  async unpinMessage(groupId: string) {
    const { error } = await supabase
      .from('group_pinned_messages')
      .delete()
      .eq('group_id', groupId);

    if (error) throw error;
  }

  /**
   * Obtener el mensaje actualmente fijado
   */
  async getPinnedMessage(groupId: string) {
    const { data: pinnedRow } = await supabase
      .from('group_pinned_messages')
      .select('message_id')
      .eq('group_id', groupId)
      .maybeSingle();

    if (!pinnedRow) return null;

    const { data: msg } = await supabase
      .from('group_messages')
      .select('id, group_id, user_id, message, created_at, is_edited')
      .eq('id', pinnedRow.message_id)
      .single();

    if (!msg) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, lastname, nickname, avatar_url')
      .eq('user_id', msg.user_id)
      .single();

    return {
      ...msg,
      profiles: profile || {
        nickname: 'Usuario',
        name: '',
        lastname: '',
        avatar_url: null,
      },
    };
  }

  /**
   * Envía un evento Broadcast indicando si el usuario actual está escribiendo
   */
  sendTyping(groupId: string, userId: string, nickname: string, isTyping: boolean) {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: userId, nickname, isTyping },
    });
  }

  onMessageReceived(handler: (message: any) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  onMessageUpdated(handler: (message: any) => void) {
    this.updateHandlers.push(handler);
    return () => {
      this.updateHandlers = this.updateHandlers.filter((h) => h !== handler);
    };
  }

  onMessageDeleted(handler: (messageId: string) => void) {
    this.deleteHandlers.push(handler);
    return () => {
      this.deleteHandlers = this.deleteHandlers.filter((h) => h !== handler);
    };
  }

  onPinnedMessageChanged(handler: (message: any | null) => void) {
    this.pinnedMessageHandlers.push(handler);
    return () => {
      this.pinnedMessageHandlers = this.pinnedMessageHandlers.filter((h) => h !== handler);
    };
  }

  onUserTyping(handler: (typingData: { user_id: string; nickname: string; isTyping: boolean }) => void) {
    this.typingHandlers.push(handler);
    return () => {
      this.typingHandlers = this.typingHandlers.filter((h) => h !== handler);
    };
  }

  onConnectionStatusChange(handler: (isConnected: boolean) => void) {
    this.statusListeners.push(handler);
    if (this.channel) {
      handler(this.channel.state === 'joined');
    }
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== handler);
    };
  }

  private notifyStatus(isConnected: boolean) {
    this.statusListeners.forEach((listener) => listener(isConnected));
  }

  /**
   * Desconecta el canal de Realtime y limpia listeners
   */
  disconnect() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.messageHandlers = [];
    this.updateHandlers = [];
    this.deleteHandlers = [];
    this.typingHandlers = [];
    this.pinnedMessageHandlers = [];
    this.statusListeners = [];
  }
}

export const chatService = new ChatService();
