/**
 * ProgressPhotoGallery
 *
 * Full-featured progress photo gallery featuring:
 * - Chronological date-grouped photo feed with angle categorization
 * - Interactive Side-by-side Before/After comparison slider (Split-wipe & Side-by-Side modes)
 * - Camera guide overlay with posture silhouette wireframes to match angles & posture
 * - Full privacy controls (trainer sharing permissions)
 * - Lightbox modal with photo details & quick compare actions
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  TextInput,
  Switch,
  Platform,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Line,
  Ellipse,
  Rect,
  Circle,
  Path,
} from 'react-native-svg';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Lock,
  Plus,
  Trash2,
  X,
  Layers,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Sparkles,
  Calendar,
  Scale,
  Check,
  RotateCcw,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { radius, spacing, useTheme } from '../../theme';
import { useStyles, THUMB_SIZE } from './ProgressPhotoGallery.styles';
import { Badge, Button, Card, PressableScale } from '../ui';
import { api, extractErrorMessage } from '../../api/client';
import { toDateKey } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import type { ProgressPhoto } from '@fitlog/shared';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// THUMB_SIZE imported from ./ProgressPhotoGallery.styles

interface DateGroup {
  date: string;
  photos: ProgressPhoto[];
}

interface Props {
  groups: DateGroup[];
  isLoading?: boolean;
  onRefresh?: () => void;
  currentWeight?: number | null;
  /** Opens the upload studio as soon as this component mounts (e.g. deep-linked from Quick Add). */
  autoOpenUpload?: boolean;
}

export const ANGLE_LABELS: Record<string, string> = {
  FRONT: 'Front',
  BACK: 'Back',
  SIDE_LEFT: 'Left Side',
  SIDE_RIGHT: 'Right Side',
  CUSTOM: 'Custom',
};

const ANGLE_OPTIONS = [
  { value: 'FRONT', label: 'Front' },
  { value: 'SIDE_LEFT', label: 'Left Side' },
  { value: 'SIDE_RIGHT', label: 'Right Side' },
  { value: 'BACK', label: 'Back' },
  { value: 'CUSTOM', label: 'Custom' },
];

const POSTURE_TIPS: Record<string, string> = {
  FRONT: 'Stand tall with feet shoulder-width apart, arms relaxed at ~15° from sides. Keep camera at chest level, ~2m away.',
  SIDE_LEFT: 'Turn 90° to your right (left side facing camera). Keep shoulders rolled back, posture neutral, arms slightly forward.',
  SIDE_RIGHT: 'Turn 90° to your left (right side facing camera). Keep chin level, core braced naturally, posture upright.',
  BACK: 'Facing directly away from camera, feet hip-width. Engage upper back naturally with arms relaxed at sides.',
  CUSTOM: 'Maintain consistent lighting, distance, and height across all progress sessions for reliable comparisons.',
};

export function ProgressPhotoGallery({
  groups,
  isLoading,
  onRefresh,
  currentWeight,
  autoOpenUpload,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();

  // Filters & State
  const [angleFilter, setAngleFilter] = useState<string>('ALL');
  const [lightboxPhoto, setLightboxPhoto] = useState<ProgressPhoto | null>(null);

  // Studio / Upload State
  const [isStudioOpen, setIsStudioOpen] = useState(() => !!autoOpenUpload);
  const [selectedAngle, setSelectedAngle] = useState<string>('FRONT');
  const [showPostureGuide, setShowPostureGuide] = useState(true);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [uploadDate, setUploadDate] = useState(() => toDateKey(new Date()));
  const [uploadWeight, setUploadWeight] = useState(
    currentWeight ? String(currentWeight) : ''
  );
  const [uploadNotes, setUploadNotes] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Comparison State
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareMode, setCompareMode] = useState<'slider' | 'side-by-side'>('slider');
  const [compareAngleFilter, setCompareAngleFilter] = useState<string>('ALL');
  const [compareA, setCompareA] = useState<ProgressPhoto | null>(null); // Before
  const [compareB, setCompareB] = useState<ProgressPhoto | null>(null); // After

  // Flatten all photos
  const allPhotos = useMemo(() => {
    return groups.flatMap((g) => g.photos);
  }, [groups]);

  // Filtered photos for gallery view
  const filteredGroups = useMemo(() => {
    if (angleFilter === 'ALL') return groups;
    return groups
      .map((g) => ({
        ...g,
        photos: g.photos.filter((p) => p.angle === angleFilter),
      }))
      .filter((g) => g.photos.length > 0);
  }, [groups, angleFilter]);

  // Filtered photos for comparison
  const photosForCompare = useMemo(() => {
    if (compareAngleFilter === 'ALL') return allPhotos;
    return allPhotos.filter((p) => p.angle === compareAngleFilter);
  }, [allPhotos, compareAngleFilter]);

  // Open comparison modal with intelligent defaults (oldest = Before, newest = After)
  const openComparisonModal = useCallback(
    (initialA?: ProgressPhoto, initialB?: ProgressPhoto) => {
      haptics.selection();
      if (initialA && initialB) {
        setCompareA(initialA);
        setCompareB(initialB);
      } else {
        const sorted = [...allPhotos].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        if (sorted.length >= 2) {
          setCompareA(sorted[0]);
          setCompareB(sorted[sorted.length - 1]);
        } else if (sorted.length === 1) {
          setCompareA(sorted[0]);
          setCompareB(sorted[0]);
        }
      }
      setIsCompareOpen(true);
    },
    [allPhotos]
  );

  // Media pickers
  const handleLaunchCamera = async () => {
    haptics.selection();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera permission needed',
        'Please grant camera permissions to capture progress photos directly.'
      );
      return;
    }

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.88,
    });

    if (!res.canceled && res.assets?.[0]?.uri) {
      setCapturedUri(res.assets[0].uri);
    }
  };

  const handleLaunchLibrary = async () => {
    haptics.selection();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo library permission needed',
        'Please grant access to your photo library to select progress photos.'
      );
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.88,
    });

    if (!res.canceled && res.assets?.[0]?.uri) {
      setCapturedUri(res.assets[0].uri);
    }
  };

  const handleSavePhoto = async () => {
    if (!capturedUri) {
      Alert.alert('No photo selected', 'Please take a photo or select one from your library.');
      return;
    }

    setIsUploading(true);
    haptics.selection();

    try {
      const form = new FormData();
      form.append('photo', {
        uri: capturedUri,
        name: `progress_${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);
      form.append('date', uploadDate);
      form.append('angle', selectedAngle);
      form.append('is_private', String(isPrivate));
      if (uploadWeight.trim()) {
        form.append('weight_kg', uploadWeight.trim());
      }
      if (uploadNotes.trim()) {
        form.append('notes', uploadNotes.trim());
      }

      await api.uploadProgressPhoto(form);
      haptics.success();
      setIsStudioOpen(false);
      setCapturedUri(null);
      setUploadNotes('');
      onRefresh?.();
    } catch (err: any) {
      haptics.error();
      Alert.alert('Upload Failed', extractErrorMessage(err));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhoto = (photo: ProgressPhoto) => {
    haptics.warning();
    Alert.alert('Delete Photo', 'Are you sure you want to delete this progress photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteProgressPhoto(photo.id);
            haptics.success();
            setLightboxPhoto(null);
            onRefresh?.();
          } catch (err: any) {
            haptics.error();
            Alert.alert('Error', extractErrorMessage(err));
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primaryLight} />
        <Text style={styles.loadingText}>Loading progress photos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Action Header: Angle Filters, Compare Button & Studio CTA */}
      <View style={styles.topBar}>
        <View style={styles.actionsRow}>
          <PressableScale
            haptic="medium"
            onPress={() => setIsStudioOpen(true)}
            style={styles.addPhotoBtn}
            accessibilityLabel="Open camera guide studio"
          >
            <Camera size={16} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.addPhotoBtnText}>Add Photo</Text>
          </PressableScale>

          {allPhotos.length >= 2 && (
            <PressableScale
              haptic="selection"
              onPress={() => openComparisonModal()}
              style={styles.compareTriggerBtn}
              accessibilityLabel="Compare before and after"
            >
              <SlidersHorizontal size={15} color={colors.primaryLight} strokeWidth={2.2} />
              <Text style={styles.compareTriggerText}>Compare</Text>
            </PressableScale>
          )}
        </View>

        {/* Angle Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipRow}
        >
          <PressableScale
            haptic="selection"
            onPress={() => setAngleFilter('ALL')}
            style={[styles.filterChip, angleFilter === 'ALL' && styles.filterChipActive]}
          >
            <Text
              style={[
                styles.filterChipText,
                angleFilter === 'ALL' && styles.filterChipTextActive,
              ]}
            >
              All Angles ({allPhotos.length})
            </Text>
          </PressableScale>

          {ANGLE_OPTIONS.map((opt) => {
            const count = allPhotos.filter((p) => p.angle === opt.value).length;
            const active = angleFilter === opt.value;
            return (
              <PressableScale
                key={opt.value}
                haptic="selection"
                onPress={() => setAngleFilter(opt.value)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text
                  style={[styles.filterChipText, active && styles.filterChipTextActive]}
                >
                  {opt.label} ({count})
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>

      {/* Gallery Groups Feed */}
      {filteredGroups.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconCircle}>
            <Camera size={34} color={colors.primaryLight} strokeWidth={2} />
          </View>
          <Text style={styles.emptyTitle}>
            {allPhotos.length === 0
              ? 'No progress photos yet'
              : `No ${ANGLE_LABELS[angleFilter] || ''} photos recorded`}
          </Text>
          <Text style={styles.emptyDesc}>
            Take progress photos every 2 to 4 weeks using our camera posture guide overlay to
            accurately track physique changes over time.
          </Text>
          <Button
            title="Open Camera Studio"
            icon={<Camera size={16} color="#FFFFFF" />}
            iconPosition="left"
            onPress={() => setIsStudioOpen(true)}
            style={styles.emptyCta}
          />
        </View>
      ) : (
        filteredGroups.map((group) => (
          <View key={group.date} style={styles.groupCard}>
            <View style={styles.groupHeader}>
              <View style={styles.groupDateRow}>
                <Calendar size={14} color={colors.primaryLight} />
                <Text style={styles.groupDateText}>
                  {new Date(group.date + 'T12:00:00').toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>

              {group.photos[0]?.weight_kg ? (
                <View style={styles.weightBadge}>
                  <Scale size={11} color={colors.primaryLight} />
                  <Text style={styles.weightBadgeText}>
                    {group.photos[0].weight_kg} kg
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.thumbsGrid}>
              {group.photos.map((photo) => (
                <PressableScale
                  key={photo.id}
                  haptic="selection"
                  onPress={() => setLightboxPhoto(photo)}
                  style={styles.thumbWrapper}
                  accessibilityLabel={`${ANGLE_LABELS[photo.angle]} photo from ${group.date}`}
                >
                  {photo.url ? (
                    <Image
                      source={{ uri: photo.url }}
                      style={styles.thumbImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.thumbPlaceholder}>
                      <Camera size={22} color={colors.textMuted} />
                    </View>
                  )}

                  <View style={styles.thumbOverlayGradient}>
                    <Text style={styles.thumbAngleLabel}>
                      {ANGLE_LABELS[photo.angle] ?? photo.angle}
                    </Text>
                    {photo.is_private && (
                      <View style={styles.lockBadge}>
                        <Lock size={10} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                </PressableScale>
              ))}
            </View>
          </View>
        ))
      )}

      {/* ======================================================== */}
      {/* 1. CAMERA GUIDE STUDIO & UPLOAD MODAL                    */}
      {/* ======================================================== */}
      <Modal
        visible={isStudioOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsStudioOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.studioSheet}>
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Transformation Studio</Text>
                <Text style={styles.modalTitle}>Capture Progress Photo</Text>
              </View>
              <PressableScale
                onPress={() => {
                  setIsStudioOpen(false);
                  setCapturedUri(null);
                }}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={colors.textMuted} />
              </PressableScale>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.studioScrollContent}
            >
              {/* Angle Selector Chips */}
              <Text style={styles.inputSectionLabel}>Target Pose Angle</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.angleSelectRow}
              >
                {ANGLE_OPTIONS.map((opt) => {
                  const active = selectedAngle === opt.value;
                  return (
                    <PressableScale
                      key={opt.value}
                      haptic="selection"
                      onPress={() => setSelectedAngle(opt.value)}
                      style={[
                        styles.angleSelectChip,
                        active && styles.angleSelectChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.angleSelectChipText,
                          active && styles.angleSelectChipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </ScrollView>

              {/* Angle Posture Coaching Card */}
              <View style={styles.tipsBox}>
                <View style={styles.tipsHeaderRow}>
                  <Sparkles size={14} color="#F59E0B" />
                  <Text style={styles.tipsTitle}>
                    {ANGLE_LABELS[selectedAngle]} Alignment Coach
                  </Text>
                </View>
                <Text style={styles.tipsText}>
                  {POSTURE_TIPS[selectedAngle] ?? POSTURE_TIPS.CUSTOM}
                </Text>
              </View>

              {/* Viewport Frame with Posture Overlay Wireframe */}
              <View style={styles.cameraFrameWrapper}>
                {capturedUri ? (
                  <Image
                    source={{ uri: capturedUri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.emptyPreviewBackdrop}>
                    <Camera size={44} color={colors.textMuted} />
                    <Text style={styles.emptyPreviewText}>
                      No photo captured yet. Use the camera or upload from gallery.
                    </Text>
                  </View>
                )}

                {/* SVG Silhouette Posture Guide Overlay */}
                {showPostureGuide && (
                  <View style={styles.postureOverlayContainer} pointerEvents="none">
                    <PostureSilhouetteGuide angle={selectedAngle} />
                  </View>
                )}

                {/* Guide overlay toggle chip */}
                <PressableScale
                  haptic="selection"
                  onPress={() => setShowPostureGuide((v) => !v)}
                  style={styles.guideToggleChip}
                >
                  {showPostureGuide ? (
                    <>
                      <Eye size={13} color="#FFFFFF" />
                      <Text style={styles.guideToggleText}>Posture Guide On</Text>
                    </>
                  ) : (
                    <>
                      <EyeOff size={13} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.guideToggleText}>Guide Off</Text>
                    </>
                  )}
                </PressableScale>
              </View>

              {/* Camera / Library Buttons */}
              <View style={styles.captureButtonsRow}>
                <PressableScale
                  haptic="medium"
                  onPress={handleLaunchCamera}
                  style={styles.primaryCaptureBtn}
                >
                  <Camera size={18} color="#FFFFFF" strokeWidth={2.4} />
                  <Text style={styles.primaryCaptureBtnText}>
                    {capturedUri ? 'Retake Photo' : 'Open Camera'}
                  </Text>
                </PressableScale>

                <PressableScale
                  haptic="selection"
                  onPress={handleLaunchLibrary}
                  style={styles.secondaryCaptureBtn}
                >
                  <Text style={styles.secondaryCaptureBtnText}>Pick from Gallery</Text>
                </PressableScale>
              </View>

              {/* Form Metadata Fields */}
              <View style={styles.formSection}>
                <View style={styles.formInputsRow}>
                  <View style={styles.flex1}>
                    <Text style={styles.fieldLabel}>Date</Text>
                    <TextInput
                      value={uploadDate}
                      onChangeText={setUploadDate}
                      style={styles.textInput}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>

                  <View style={styles.flex1}>
                    <Text style={styles.fieldLabel}>Weight (kg)</Text>
                    <TextInput
                      value={uploadWeight}
                      onChangeText={setUploadWeight}
                      style={styles.textInput}
                      placeholder="e.g. 74.5"
                      keyboardType="decimal-pad"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Session Notes</Text>
                <TextInput
                  value={uploadNotes}
                  onChangeText={setUploadNotes}
                  style={[styles.textInput, styles.textArea]}
                  placeholder="e.g. Morning fasted, post-cutting week 4"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={2}
                />

                {/* Privacy Switch */}
                <View style={styles.privacyRow}>
                  <View style={styles.privacyInfo}>
                    <View style={styles.privacyTitleRow}>
                      <Lock size={14} color={colors.textSecondary} />
                      <Text style={styles.privacyTitle}>Keep Private</Text>
                    </View>
                    <Text style={styles.privacySubtitle}>
                      Private photos are never shared with assigned personal trainers.
                    </Text>
                  </View>
                  <Switch
                    value={isPrivate}
                    onValueChange={setIsPrivate}
                    trackColor={{ false: colors.borderSubtle, true: colors.primaryLight }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Upload Button */}
                <Button
                  title={isUploading ? 'Uploading...' : 'Save Progress Photo'}
                  loading={isUploading}
                  disabled={!capturedUri}
                  onPress={handleSavePhoto}
                  size="lg"
                  style={styles.saveSubmitBtn}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* 2. SIDE-BY-SIDE BEFORE / AFTER COMPARISON SLIDER MODAL   */}
      {/* ======================================================== */}
      <Modal
        visible={isCompareOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsCompareOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.compareSheet}>
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Physique Transformation</Text>
                <Text style={styles.modalTitle}>Before vs After</Text>
              </View>
              <PressableScale
                onPress={() => setIsCompareOpen(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={colors.textMuted} />
              </PressableScale>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.compareScrollContent}
            >
              {/* Mode Switcher & Angle Filters */}
              <View style={styles.compareControlsBar}>
                <View style={styles.modeToggleGroup}>
                  <PressableScale
                    onPress={() => setCompareMode('slider')}
                    style={[
                      styles.modeToggleBtn,
                      compareMode === 'slider' && styles.modeToggleBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeToggleBtnText,
                        compareMode === 'slider' && styles.modeToggleBtnTextActive,
                      ]}
                    >
                      Split Slider
                    </Text>
                  </PressableScale>

                  <PressableScale
                    onPress={() => setCompareMode('side-by-side')}
                    style={[
                      styles.modeToggleBtn,
                      compareMode === 'side-by-side' && styles.modeToggleBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeToggleBtnText,
                        compareMode === 'side-by-side' && styles.modeToggleBtnTextActive,
                      ]}
                    >
                      Dual View
                    </Text>
                  </PressableScale>
                </View>

                {/* Angle Filter for comparison */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.compareAngleScroll}
                >
                  <PressableScale
                    onPress={() => setCompareAngleFilter('ALL')}
                    style={[
                      styles.compareAngleChip,
                      compareAngleFilter === 'ALL' && styles.compareAngleChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.compareAngleChipText,
                        compareAngleFilter === 'ALL' && styles.compareAngleChipTextActive,
                      ]}
                    >
                      All
                    </Text>
                  </PressableScale>
                  {ANGLE_OPTIONS.map((opt) => (
                    <PressableScale
                      key={opt.value}
                      onPress={() => setCompareAngleFilter(opt.value)}
                      style={[
                        styles.compareAngleChip,
                        compareAngleFilter === opt.value && styles.compareAngleChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.compareAngleChipText,
                          compareAngleFilter === opt.value && styles.compareAngleChipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </PressableScale>
                  ))}
                </ScrollView>
              </View>

              {/* Transformation Delta Summary Banner */}
              {compareA && compareB && (
                <ComparisonMetricsBanner photoA={compareA} photoB={compareB} />
              )}

              {/* Render Comparison Views */}
              {compareA && compareB ? (
                compareMode === 'slider' ? (
                  <BeforeAfterSplitSlider photoA={compareA} photoB={compareB} />
                ) : (
                  <BeforeAfterDualView photoA={compareA} photoB={compareB} />
                )
              ) : (
                <View style={styles.notEnoughPhotos}>
                  <Text style={styles.notEnoughPhotosText}>
                    Please select at least two photos to compare.
                  </Text>
                </View>
              )}

              {/* Photo Selectors for Before (A) and After (B) */}
              <View style={styles.photoPickerSection}>
                <Text style={styles.pickerHeading}>Select Comparison Photos</Text>

                <Text style={styles.pickerLabel}>BEFORE PHOTO (Baseline)</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pickerThumbRow}
                >
                  {photosForCompare.map((photo) => {
                    const isSelected = compareA?.id === photo.id;
                    return (
                      <PressableScale
                        key={`picker-a-${photo.id}`}
                        onPress={() => setCompareA(photo)}
                        style={[
                          styles.pickerThumbItem,
                          isSelected && styles.pickerThumbItemSelected,
                        ]}
                      >
                        <Image
                          source={{ uri: photo.url || '' }}
                          style={styles.pickerThumbImg}
                          resizeMode="cover"
                        />
                        <Text style={styles.pickerThumbDate}>{photo.date.slice(5)}</Text>
                        <Text style={styles.pickerThumbAngle}>
                          {ANGLE_LABELS[photo.angle] ?? photo.angle}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </ScrollView>

                <Text style={styles.pickerLabel}>AFTER PHOTO (Progress)</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pickerThumbRow}
                >
                  {photosForCompare.map((photo) => {
                    const isSelected = compareB?.id === photo.id;
                    return (
                      <PressableScale
                        key={`picker-b-${photo.id}`}
                        onPress={() => setCompareB(photo)}
                        style={[
                          styles.pickerThumbItem,
                          isSelected && styles.pickerThumbItemSelectedB,
                        ]}
                      >
                        <Image
                          source={{ uri: photo.url || '' }}
                          style={styles.pickerThumbImg}
                          resizeMode="cover"
                        />
                        <Text style={styles.pickerThumbDate}>{photo.date.slice(5)}</Text>
                        <Text style={styles.pickerThumbAngle}>
                          {ANGLE_LABELS[photo.angle] ?? photo.angle}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* 3. LIGHTBOX MODAL                                        */}
      {/* ======================================================== */}
      <Modal
        visible={!!lightboxPhoto}
        animationType="fade"
        transparent
        onRequestClose={() => setLightboxPhoto(null)}
      >
        <View style={styles.lightboxBackdrop}>
          {lightboxPhoto && (
            <>
              {/* Close Button */}
              <TouchableOpacity
                style={styles.lightboxCloseBtn}
                onPress={() => setLightboxPhoto(null)}
              >
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Fullscreen Image */}
              <View style={styles.lightboxImageContainer}>
                {lightboxPhoto.url ? (
                  <Image
                    source={{ uri: lightboxPhoto.url }}
                    style={styles.lightboxImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.lightboxPlaceholder}>
                    <Camera size={54} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.lightboxPlaceholderText}>Image not found</Text>
                  </View>
                )}
              </View>

              {/* Bottom Meta & Actions */}
              <View style={styles.lightboxMetaCard}>
                <View style={styles.lightboxMetaHeader}>
                  <View>
                    <Text style={styles.lightboxAngleText}>
                      {ANGLE_LABELS[lightboxPhoto.angle] ?? lightboxPhoto.angle} View
                    </Text>
                    <Text style={styles.lightboxDateText}>
                      {new Date(lightboxPhoto.date + 'T12:00:00').toLocaleDateString(
                        'en-GB',
                        {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        }
                      )}
                    </Text>
                  </View>

                  {lightboxPhoto.weight_kg ? (
                    <View style={styles.lightboxWeightBadge}>
                      <Text style={styles.lightboxWeightText}>
                        {lightboxPhoto.weight_kg} kg
                      </Text>
                    </View>
                  ) : null}
                </View>

                {lightboxPhoto.notes ? (
                  <Text style={styles.lightboxNotesText}>{lightboxPhoto.notes}</Text>
                ) : null}

                <View style={styles.lightboxActionRow}>
                  <PressableScale
                    haptic="selection"
                    onPress={() => {
                      const photo = lightboxPhoto;
                      setLightboxPhoto(null);
                      openComparisonModal(photo, allPhotos[0]);
                    }}
                    style={styles.lightboxCompareBtn}
                  >
                    <SlidersHorizontal size={15} color={colors.primaryLight} />
                    <Text style={styles.lightboxCompareBtnText}>Compare in Slider</Text>
                  </PressableScale>

                  <PressableScale
                    haptic="medium"
                    onPress={() => handleDeletePhoto(lightboxPhoto)}
                    style={styles.lightboxDeleteBtn}
                  >
                    <Trash2 size={16} color="#EF4444" />
                    <Text style={styles.lightboxDeleteBtnText}>Delete</Text>
                  </PressableScale>
                </View>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ========================================================
// SUB-COMPONENT: Before & After Split Wipe Reveal Slider
// ========================================================
function BeforeAfterSplitSlider({
  photoA,
  photoB,
}: {
  photoA: ProgressPhoto;
  photoB: ProgressPhoto;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH - spacing.xl * 2);
  const containerHeight = Math.round(containerWidth * 1.33);

  // Position of divider line in pixels
  const sliderPosition = useSharedValue(containerWidth * 0.5);

  const updatePosition = useCallback((x: number) => {
    'worklet';
    const clamped = Math.max(10, Math.min(containerWidth - 10, x));
    sliderPosition.value = clamped;
  }, [containerWidth, sliderPosition]);

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .onBegin((e) => {
        'worklet';
        updatePosition(e.x);
      })
      .onUpdate((e) => {
        'worklet';
        updatePosition(e.x);
      });
  }, [updatePosition]);

  const clipOverlayStyle = useAnimatedStyle(() => {
    return {
      width: sliderPosition.value,
      height: '100%',
      position: 'absolute',
      left: 0,
      top: 0,
      overflow: 'hidden',
    };
  });

  const dividerStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      left: sliderPosition.value - 16,
      top: 0,
      bottom: 0,
      width: 32,
      alignItems: 'center',
      justifyContent: 'center',
    };
  });

  return (
    <View
      style={styles.sliderContainer}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 50) {
          setContainerWidth(w);
          sliderPosition.value = w * 0.5;
        }
      }}
    >
      <GestureDetector gesture={panGesture}>
        <View style={[styles.sliderFrame, { height: containerHeight }]}>
          {/* Base Layer: Photo B (After) */}
          <Image
            source={{ uri: photoB.url || '' }}
            style={[styles.sliderFullImage, { width: containerWidth, height: containerHeight }]}
            resizeMode="cover"
          />

          {/* Reveal Layer: Photo A (Before) clipped to sliderPosition */}
          <Animated.View style={clipOverlayStyle}>
            <Image
              source={{ uri: photoA.url || '' }}
              style={[
                styles.sliderFullImage,
                { width: containerWidth, height: containerHeight },
              ]}
              resizeMode="cover"
            />
          </Animated.View>

          {/* Draggable Divider Bar */}
          <Animated.View style={dividerStyle}>
            <View style={styles.dividerVerticalLine} />
            <View style={styles.dividerPill}>
              <ChevronLeft size={12} color="#FFFFFF" />
              <ChevronRight size={12} color="#FFFFFF" />
            </View>
          </Animated.View>

          {/* Corner Tags */}
          <View style={styles.sliderTagLeft}>
            <Text style={styles.sliderTagTitle}>BEFORE</Text>
            <Text style={styles.sliderTagSub}>
              {photoA.date} {photoA.weight_kg ? `· ${photoA.weight_kg}kg` : ''}
            </Text>
          </View>

          <View style={styles.sliderTagRight}>
            <Text style={styles.sliderTagTitle}>AFTER</Text>
            <Text style={styles.sliderTagSub}>
              {photoB.date} {photoB.weight_kg ? `· ${photoB.weight_kg}kg` : ''}
            </Text>
          </View>
        </View>
      </GestureDetector>
      <Text style={styles.sliderHint}>Drag slider left and right to reveal transformation</Text>
    </View>
  );
}

// ========================================================
// SUB-COMPONENT: Before & After Dual Side-by-Side View
// ========================================================
function BeforeAfterDualView({
  photoA,
  photoB,
}: {
  photoA: ProgressPhoto;
  photoB: ProgressPhoto;
}) {
  const styles = useStyles();

  return (
    <View style={styles.dualViewRow}>
      <View style={styles.dualPanel}>
        <Image
          source={{ uri: photoA.url || '' }}
          style={styles.dualImage}
          resizeMode="cover"
        />
        <View style={styles.dualBadge}>
          <Text style={styles.dualBadgeTitle}>BEFORE</Text>
          <Text style={styles.dualBadgeSub}>{photoA.date}</Text>
          {photoA.weight_kg ? (
            <Text style={styles.dualBadgeWeight}>{photoA.weight_kg} kg</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.dualPanel}>
        <Image
          source={{ uri: photoB.url || '' }}
          style={styles.dualImage}
          resizeMode="cover"
        />
        <View style={[styles.dualBadge, styles.dualBadgeAfter]}>
          <Text style={styles.dualBadgeTitle}>AFTER</Text>
          <Text style={styles.dualBadgeSub}>{photoB.date}</Text>
          {photoB.weight_kg ? (
            <Text style={styles.dualBadgeWeight}>{photoB.weight_kg} kg</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ========================================================
// SUB-COMPONENT: Comparison Metrics Banner
// ========================================================
function ComparisonMetricsBanner({
  photoA,
  photoB,
}: {
  photoA: ProgressPhoto;
  photoB: ProgressPhoto;
}) {
  const styles = useStyles();
  const dA = new Date(photoA.date).getTime();
  const dB = new Date(photoB.date).getTime();
  const daysDiff = Math.abs(Math.round((dB - dA) / (1000 * 60 * 60 * 24)));

  const weightDelta =
    photoA.weight_kg && photoB.weight_kg
      ? Number((photoB.weight_kg - photoA.weight_kg).toFixed(1))
      : null;

  return (
    <View style={styles.metricsBanner}>
      <View style={styles.metricItem}>
        <Text style={styles.metricLabel}>TIMEFRAME</Text>
        <Text style={styles.metricValue}>
          {daysDiff} {daysDiff === 1 ? 'day' : 'days'} apart
        </Text>
      </View>

      <View style={styles.metricDivider} />

      <View style={styles.metricItem}>
        <Text style={styles.metricLabel}>NET WEIGHT CHANGE</Text>
        <Text
          style={[
            styles.metricValue,
            weightDelta != null && weightDelta < 0
              ? styles.textGreen
              : weightDelta != null && weightDelta > 0
              ? styles.textAmber
              : null,
          ]}
        >
          {weightDelta != null
            ? `${weightDelta > 0 ? '+' : ''}${weightDelta} kg`
            : 'Unrecorded'}
        </Text>
      </View>
    </View>
  );
}

// ========================================================
// SUB-COMPONENT: Camera Silhouette Posture Guide Wireframe
// ========================================================
function PostureSilhouetteGuide({ angle }: { angle: string }) {
  const isSide = angle === 'SIDE_LEFT' || angle === 'SIDE_RIGHT';
  return (
    <Svg width="100%" height="100%" viewBox="0 0 300 400">
      <Defs>
        <LinearGradient id="guideGlow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#06B6D4" stopOpacity="0.85" />
          <Stop offset="100" stopColor="#06B6D4" stopOpacity="0.25" />
        </LinearGradient>
      </Defs>

      {/* Central Plumb Line (Vertical symmetry axis) */}
      <Line
        x1="150"
        y1="20"
        x2="150"
        y2="380"
        stroke="#06B6D4"
        strokeWidth="1.2"
        strokeDasharray="4 4"
        opacity="0.65"
      />

      {/* Head Level Guide Oval */}
      <Ellipse
        cx="150"
        cy="65"
        rx={isSide ? 28 : 24}
        ry="32"
        fill="none"
        stroke="#06B6D4"
        strokeWidth="1.8"
        strokeDasharray="6 3"
        opacity="0.8"
      />

      {/* Eye Line & Chin Marker */}
      <Line
        x1="135"
        y1="60"
        x2="165"
        y2="60"
        stroke="#06B6D4"
        strokeWidth="1.5"
        opacity="0.75"
      />
      <Line
        x1="142"
        y1="90"
        x2="158"
        y2="90"
        stroke="#06B6D4"
        strokeWidth="1.5"
        opacity="0.75"
      />

      {/* Shoulder Alignment Line */}
      <Line
        x1={isSide ? 120 : 80}
        y1="115"
        x2={isSide ? 180 : 220}
        y2="115"
        stroke="#06B6D4"
        strokeWidth="2"
        opacity="0.85"
      />

      {/* Chest Level */}
      <Line
        x1={isSide ? 125 : 100}
        y1="155"
        x2={isSide ? 175 : 200}
        y2="155"
        stroke="#06B6D4"
        strokeWidth="1.2"
        strokeDasharray="3 3"
        opacity="0.6"
      />

      {/* Waist / Belt Alignment Line */}
      <Line
        x1={isSide ? 130 : 105}
        y1="205"
        x2={isSide ? 170 : 195}
        y2="205"
        stroke="#06B6D4"
        strokeWidth="1.6"
        strokeDasharray="5 3"
        opacity="0.8"
      />

      {/* Hip / Pelvis Line */}
      <Line
        x1={isSide ? 125 : 95}
        y1="245"
        x2={isSide ? 175 : 205}
        y2="245"
        stroke="#06B6D4"
        strokeWidth="1.6"
        opacity="0.7"
      />

      {/* Knees Guide */}
      <Line
        x1={isSide ? 135 : 110}
        y1="315"
        x2={isSide ? 165 : 190}
        y2="315"
        stroke="#06B6D4"
        strokeWidth="1.2"
        strokeDasharray="4 4"
        opacity="0.6"
      />

      {/* Feet Stance Markers */}
      {!isSide ? (
        <>
          <Circle cx="120" cy="375" r="7" stroke="#06B6D4" strokeWidth="1.8" fill="none" opacity="0.8" />
          <Circle cx="180" cy="375" r="7" stroke="#06B6D4" strokeWidth="1.8" fill="none" opacity="0.8" />
        </>
      ) : (
        <Circle cx="150" cy="375" r="9" stroke="#06B6D4" strokeWidth="1.8" fill="none" opacity="0.8" />
      )}
    </Svg>
  );
}

