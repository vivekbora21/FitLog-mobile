import React from 'react';
import { View, Text, Modal, StyleSheet, Pressable } from 'react-native';
import { Button } from './Button';
import { radius, spacing, makeStyles } from '../../theme';

export interface ConfirmModalAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
}

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  /** Rendered as the cancel/dismiss action, leftmost. Defaults to closing the modal. */
  cancelLabel?: string;
  onCancel: () => void;
  /** Additional action(s) besides cancel, rendered in order after it. */
  actions: ConfirmModalAction[];
}

export function ConfirmModal({ visible, title, message, cancelLabel = 'Cancel', onCancel, actions }: ConfirmModalProps) {
  const styles = useStyles();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.actions}>
            <Button title={cancelLabel} variant="secondary" onPress={onCancel} style={styles.actionBtn} />
            {actions.map((action) => (
              <Button
                key={action.label}
                title={action.label}
                variant={action.variant ?? 'primary'}
                onPress={action.onPress}
                style={styles.actionBtn}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actionBtn: {
    width: '100%',
  },
}));
