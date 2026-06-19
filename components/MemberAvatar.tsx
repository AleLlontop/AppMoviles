import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { avatarColorFromId, avatarInitial } from '@/utils/avatarColor';

interface MemberAvatarProps {
  userId: string | null | undefined;
  nickname?: string | null;
  fallbackText?: string | null;
  avatarUrl?: string | null;
  size?: number;
  ring?: boolean;
  ringColor?: string;
  style?: ViewStyle;
}

export function MemberAvatar({
  userId,
  nickname,
  fallbackText,
  avatarUrl,
  size = 44,
  ring = false,
  ringColor = '#3FD0A8',
  style,
}: MemberAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!avatarUrl && !imgFailed;

  const bg = avatarColorFromId(userId);
  const initial = avatarInitial(nickname, fallbackText);

  const ringStyle: ViewStyle | undefined = ring
    ? {
        borderWidth: 2.5,
        borderColor: ringColor,
      }
    : undefined;

  const base: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: showImage ? 'transparent' : bg,
    overflow: 'hidden',
  };

  return (
    <View style={[base, ringStyle, style]}>
      {showImage ? (
        <Image
          source={{ uri: avatarUrl! }}
          style={{ width: size, height: size }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  initial: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
