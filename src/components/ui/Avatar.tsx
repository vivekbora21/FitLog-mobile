import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '../../theme';
import { getInitials } from '../../lib/format';

interface AvatarProps {
  name?: string | null;
  imageUrl?: string | null;
  size?: number;
  ring?: boolean;
}

export function Avatar({ name, imageUrl, size = 44, ring = false }: AvatarProps) {
  const inner = ring ? size - 6 : size;

  return (
    <View
      style={[
        styles.outer,
        { width: size, height: size, borderRadius: size / 2 },
        ring && styles.ring,
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: inner, height: inner, borderRadius: inner / 2 }}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.initialsBox, { width: inner, height: inner, borderRadius: inner / 2 }]}>
          <Text style={[styles.initials, { fontSize: inner * 0.38 }]}>{getInitials(name)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },
  initialsBox: {
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.primaryLight,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
