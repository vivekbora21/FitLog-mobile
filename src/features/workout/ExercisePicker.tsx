import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Search, Sparkles, X } from 'lucide-react-native';
import { api, extractErrorMessage } from '../../api/client';
import { Button, Input, PressableScale } from '../../components/ui';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { formatRelativeDay } from '../../lib/format';
import { haptics } from '../../lib/haptics';

export interface PickedExercise {
  id: string;
  name: string;
  muscle?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (exercise: PickedExercise) => void;
  /** Already in the workout — shown as added. */
  selectedIds: string[];
}

interface Row {
  id: string;
  name: string;
  muscle?: string;
  meta?: string;
  custom?: boolean;
}

export function ExercisePicker({ visible, onClose, onPick, selectedIds }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const term = search.trim();
  const browsing = term.length === 0 && !muscle;

  const muscles = useQuery({ queryKey: ['muscleGroups'], queryFn: () => api.getMuscleGroups(), enabled: visible, staleTime: Infinity });
  const recent = useQuery({ queryKey: ['recentExercises'], queryFn: () => api.getRecentExercises(), enabled: visible });
  const results = useQuery({
    queryKey: ['exerciseSearch', term, muscle],
    queryFn: () => api.searchExercises(term, muscle ?? undefined),
    enabled: visible && !browsing,
  });

  const reset = () => {
    setSearch('');
    setMuscle(null);
    setCreating(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const pick = (row: PickedExercise) => {
    haptics.light();
    onPick(row);
    reset();
  };

  const rows: Row[] = browsing
    ? (recent.data ?? []).map((r) => ({ id: r.id, name: r.name, muscle: r.primary_muscle_name, meta: `${r.primary_muscle_name} · ${formatRelativeDay(r.last_date)}` }))
    : (results.data ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        muscle: e.primary_muscle_name,
        meta: [e.primary_muscle_name, e.equipment_name].filter(Boolean).join(' · '),
        custom: e.is_custom,
      }));
  const loading = browsing ? recent.isLoading : results.isFetching;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {creating ? 'New exercise' : 'Add exercise'}
          </Text>
          <PressableScale haptic="selection" onPress={creating ? () => setCreating(false) : close} style={styles.closeBtn} accessibilityLabel="Close">
            <X size={20} color={colors.textPrimary} />
          </PressableScale>
        </View>

        {creating ? (
          <CreateExerciseForm
            initialName={term}
            onCreated={(e) => pick(e)}
          />
        ) : (
          <>
            <View style={styles.searchWrap}>
              <Input
                placeholder="Search exercises"
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                returnKeyType="search"
                leftIcon={<Search size={18} color={colors.textMuted} />}
                containerStyle={styles.searchInput}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsScroll}>
              <Chip label="All" selected={!muscle} onPress={() => setMuscle(null)} />
              {(muscles.data ?? []).map((m) => (
                <Chip key={m.id} label={m.name} selected={muscle === m.slug} onPress={() => setMuscle(muscle === m.slug ? null : m.slug)} />
              ))}
            </ScrollView>

            <FlatList
              data={rows}
              keyExtractor={(r) => r.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.list}
              ListHeaderComponent={
                browsing && rows.length > 0 ? (
                  <View style={styles.sectionRow}>
                    <Clock size={14} color={colors.textMuted} />
                    <Text style={styles.section}>Recently used</Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                loading ? (
                  <ActivityIndicator color={colors.primaryLight} style={styles.loading} />
                ) : (
                  <Text style={styles.hint}>
                    {browsing
                      ? 'Search the library or pick a muscle group to browse.'
                      : `No exercises match${term ? ` "${term}"` : ''}.`}
                  </Text>
                )
              }
              renderItem={({ item }) => {
                const added = selectedIds.includes(item.id);
                return (
                  <PressableScale
                    haptic="none"
                    onPress={() => pick({ id: item.id, name: item.name, muscle: item.muscle })}
                    style={styles.row}
                    accessibilityLabel={`Add ${item.name}${added ? ', already in workout' : ''}`}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.rowName}>
                        {item.name}
                        {item.custom ? <Text style={styles.customTag}>  Custom</Text> : null}
                      </Text>
                      {item.meta ? <Text style={styles.rowMeta}>{item.meta}</Text> : null}
                    </View>
                    {added ? <Text style={styles.addedText}>Added</Text> : <Plus size={20} color={colors.primaryLight} />}
                  </PressableScale>
                );
              }}
              ListFooterComponent={
                <Button
                  title={term ? `Create "${term}"` : 'Create custom exercise'}
                  variant="outline"
                  icon={<Sparkles size={16} color={colors.primaryLight} />}
                  iconPosition="left"
                  onPress={() => setCreating(true)}
                  style={styles.createBtn}
                />
              }
            />
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <PressableScale
      haptic="selection"
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </PressableScale>
  );
}

function CreateExerciseForm({ initialName, onCreated }: { initialName: string; onCreated: (e: PickedExercise) => void }) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [muscleId, setMuscleId] = useState<string | null>(null);
  const [equipmentId, setEquipmentId] = useState<string | null>(null);

  const muscles = useQuery({ queryKey: ['muscleGroups'], queryFn: () => api.getMuscleGroups(), staleTime: Infinity });
  const equipment = useQuery({ queryKey: ['equipmentTypes'], queryFn: () => api.getEquipmentTypes(), staleTime: Infinity });

  const mutation = useMutation({
    mutationFn: () => api.createExercise({ name: name.trim(), primary_muscle: muscleId!, equipment: equipmentId! }),
    onSuccess: (e) => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['exerciseSearch'] });
      onCreated({ id: e.id, name: e.name, muscle: e.primary_muscle_name });
    },
    onError: () => haptics.error(),
  });

  const ready = name.trim().length >= 2 && !!muscleId && !!equipmentId;

  return (
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Input label="Name" placeholder="e.g. Meadows row" value={name} onChangeText={setName} autoFocus />
      <Text style={styles.formLabel}>Main muscle</Text>
      <View style={styles.wrapChips}>
        {(muscles.data ?? []).map((m) => (
          <Chip key={m.id} label={m.name} selected={muscleId === m.id} onPress={() => setMuscleId(m.id)} />
        ))}
      </View>
      <Text style={styles.formLabel}>Equipment</Text>
      <View style={styles.wrapChips}>
        {(equipment.data ?? []).map((e) => (
          <Chip key={e.id} label={e.name} selected={equipmentId === e.id} onPress={() => setEquipmentId(e.id)} />
        ))}
      </View>
      {mutation.error ? <Text style={styles.error}>{extractErrorMessage(mutation.error)}</Text> : null}
      <Button title="Create & add" size="lg" disabled={!ready} loading={mutation.isPending} onPress={() => mutation.mutate()} style={styles.createBtn} />
      <Text style={styles.hint}>Custom exercises are private to you and track PRs like any other.</Text>
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
  },
  searchInput: {
    marginBottom: spacing.sm,
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chips: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  wrapChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.primarySurface,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.primaryLight,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  section: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  customTag: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.violet,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  addedText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  loading: {
    marginVertical: spacing.xl,
  },
  createBtn: {
    marginTop: spacing.lg,
  },
  form: {
    padding: spacing.lg,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
  },
}));
