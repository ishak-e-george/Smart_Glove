import React, { ReactNode } from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureLabel } from '../types/gesture';
import { colors, layout, radius, shadow, spacing, typography } from '../styles/theme';

type AppScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function AppScreen({ children, scroll = true, contentStyle }: AppScreenProps) {
  if (!scroll) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={[styles.content, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function AppHeader({ title, subtitle, actionLabel, onAction }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {!!actionLabel && !!onAction && (
        <TouchableOpacity style={styles.headerButton} onPress={onAction} activeOpacity={0.82}>
          <Text style={styles.headerButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

type InfoCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
};

export function InfoCard({ children, style, tone = 'default' }: InfoCardProps) {
  return <View style={[styles.card, toneStyles[tone], style]}>{children}</View>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ label, onPress, disabled, style }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.primaryButton, disabled && styles.disabledButton, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.82}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress, disabled, style }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.secondaryButton, disabled && styles.disabledSecondaryButton, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.82}
    >
      <Text style={[styles.secondaryButtonText, disabled && styles.disabledSecondaryText]}>{label}</Text>
    </TouchableOpacity>
  );
}

type StatusBadgeProps = {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
};

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <View style={[styles.badge, badgeStyles[tone]]}>
      <Text style={[styles.badgeText, badgeTextStyles[tone]]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <InfoCard style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </InfoCard>
  );
}

export function LanguageBadge({ label }: { label: string }) {
  return <StatusBadge label={label} tone="info" />;
}

export function GestureBadge({ label }: { label: GestureLabel }) {
  const tone = label === 'REST' ? 'neutral' : 'success';
  return <StatusBadge label={label} tone={tone} />;
}

const toneStyles = StyleSheet.create({
  default: {},
  primary: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  success: { borderColor: colors.success, backgroundColor: colors.successSoft },
  warning: { borderColor: colors.warning, backgroundColor: colors.warningSoft },
  danger: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  info: { borderColor: colors.info, backgroundColor: colors.infoSoft },
});

const badgeStyles = StyleSheet.create({
  neutral: { backgroundColor: colors.surfaceMuted },
  success: { backgroundColor: colors.successSoft },
  warning: { backgroundColor: colors.warningSoft },
  danger: { backgroundColor: colors.dangerSoft },
  info: { backgroundColor: colors.infoSoft },
});

const badgeTextStyles = StyleSheet.create({
  neutral: { color: colors.textMuted },
  success: { color: colors.success },
  warning: { color: colors.warning },
  danger: { color: colors.danger },
  info: { color: colors.info },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: spacing.xxs,
  },
  headerButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerButtonText: {
    color: colors.primary,
    fontWeight: '900',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow,
  },
  primaryButton: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '900',
  },
  disabledButton: {
    backgroundColor: colors.textMuted,
  },
  disabledSecondaryButton: {
    backgroundColor: colors.surfaceMuted,
  },
  disabledSecondaryText: {
    color: colors.textMuted,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontSize: typography.caption,
    fontWeight: '900',
  },
  sectionTitle: {
    gap: spacing.xxs,
  },
  sectionTitleText: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 21,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 21,
    fontWeight: '700',
  },
});
