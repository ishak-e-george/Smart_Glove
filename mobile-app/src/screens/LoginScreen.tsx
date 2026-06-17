import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../styles/theme';
import { sessionService } from '../services/sessionService';

const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('user@glove.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!email || !password) {
      return;
    }

    setErrorMessage('');
    setLoading(true);
    try {
      sessionService.setEmail(trimmedEmail);
      navigation.replace('ModeSelection', { email: trimmedEmail });
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || 'Unable to start a local user session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.brandBlock}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>SG</Text>
        </View>
        <Text style={styles.title}>Smart Glove</Text>
        <Text style={styles.subtitle}>Personal communication profile</Text>
      </View>

      <View style={styles.formPanel}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="user@glove.com"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {!!errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading || !email.trim() || !password}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  formPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    ...shadow,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
    minHeight: 52,
    justifyContent: 'center',
  },
  errorBox: {
    backgroundColor: '#FEE4E2',
    borderColor: '#FDA29B',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
});

export default LoginScreen;
