import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { supabase } from '../utils/supabase';
import { useUser } from '../hooks/supabase';

export function UserAvatar() {
  const user = useUser();
  const [open, setOpen] = useState(false);

  const logout = async () => {
    await supabase.auth.signOut();
    setOpen(false);
  };

  if (!user) return null;

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} style={styles.avatar}>
        <Text style={styles.text}>
          {user.email?.charAt(0).toUpperCase()}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <View style={styles.bg}>
          <View style={styles.card}>
            <Text style={{ fontWeight: '600' }}>
              {user.email}
            </Text>

            <TouchableOpacity onPress={logout} style={styles.btn}>
              <Text style={{ color: 'white' }}>Logout</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#A594F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  text: { color: 'white', fontWeight: '700' },
  bg: {
    flex: 1,
    backgroundColor: '#A594F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 260,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    gap: 12,
  },
  btn: {
    backgroundColor: 'black',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
});