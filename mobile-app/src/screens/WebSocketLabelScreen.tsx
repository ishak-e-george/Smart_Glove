/**
 * WebSocketLabelScreen.tsx
 *
 * WebSocket Demo Mode for Smart Glove.
 *
 * Flow:
 *   Arduino (sensors)
 *     → Python live_predict pipeline / mobile_ws_bridge.py
 *       → WebSocket  ws://10.0.2.2:8765
 *         → This screen (displays + speaks)
 *
 * Packet format (same as BLE Label Mode):
 *   "LABEL|Phrase|confidence|index,middle,ring,pinky,thumb"
 *   e.g.  "HELLO|Hello|0.93|100,0,0,0,0"
 *
 * Connection URLs:
 *   Android Emulator → ws://10.0.2.2:8765  (default)
 *   Physical Phone   → ws://192.168.x.x:8765  (change in settings)
 *
 * Run the bridge:
 *   python python/mobile_ws_bridge.py              (demo mode — no Arduino)
 *   python python/mobile_ws_bridge.py --mode live --port COM4  (real glove)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { parseLabelPacket, GloveLabel } from '../services/bleLabelService';
import { colors, radius, shadow, spacing } from '../styles/theme';

// ── Default WS URL ────────────────────────────────────────────────────────────
// 10.0.2.2 = your laptop from an Android emulator.
// Change to your PC's local IP for a physical phone (e.g. 192.168.1.5).
const DEFAULT_WS_URL = 'ws://10.0.2.2:8765';

type ConnState = 'disconnected' | 'connecting' | 'connected' | 'error';

// ── Helpers ───────────────────────────────────────────────────────────────────

function confidenceColor(c: number): string {
  if (c >= 0.85) return colors.success;
  if (c >= 0.65) return colors.warning;
  return colors.danger;
}

const FINGER_NAMES = ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb'];

function FingerBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={fingerStyles.row}>
      <Text style={fingerStyles.label}>{label}</Text>
      <View style={fingerStyles.track}>
        <View style={[fingerStyles.fill, { width: `${pct}%` as any }]} />
      </View>
      <Text style={fingerStyles.pct}>{value}%</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

const WebSocketLabelScreen = ({ navigation }: any) => {
  const [wsUrl, setWsUrl]                     = useState(DEFAULT_WS_URL);
  const [editingUrl, setEditingUrl]           = useState(false);
  const [connState, setConnState]             = useState<ConnState>('disconnected');
  const [errorMsg, setErrorMsg]               = useState('');
  const [currentLabel, setCurrentLabel]       = useState<GloveLabel | null>(null);
  const [history, setHistory]                 = useState<GloveLabel[]>([]);
  const [isSpeaking, setIsSpeaking]           = useState(false);
  const [packetsReceived, setPacketsReceived] = useState(0);

  const wsRef    = useRef<WebSocket | null>(null);
  const wordScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Speech control refs
  const armedRef      = useRef(false);
  const lastTimeRef   = useRef(0);
  const lastLabelRef  = useRef('');

  // Pulse animation when connected
  useEffect(() => {
    if (connState === 'connected') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [connState]);

  // Word-pop animation on new label
  const triggerWordPop = useCallback(() => {
    wordScale.setValue(0.75);
    Animated.spring(wordScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        try {
          wsRef.current.close();
        } catch (err) {}
        wsRef.current = null;
      }
      Speech.stop();
    };
  }, []);

  // ── WebSocket connection ──────────────────────────────────────────────────

  const connect = () => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      try {
        wsRef.current.close();
      } catch (err) {}
      wsRef.current = null;
      console.log('[WS] Closed');
    }

    setConnState('connecting');
    setErrorMsg('');
    setPacketsReceived(0);

    // Reset speech state
    armedRef.current = false;
    lastTimeRef.current = 0;
    lastLabelRef.current = '';

    try {
      const ws = new WebSocket(wsUrl.trim());

      ws.onopen = () => {
        setConnState('connected');
        console.log('[WS] Connected');
      };

      ws.onmessage = (event) => {
        const raw = String(event.data);
        const parsed = parseLabelPacket(raw);
        if (!parsed) return;

        setPacketsReceived((n) => n + 1);

        const isRest = parsed.label === 'REST';

        if (isRest) {
          if (!armedRef.current) {
            console.log('[SPEECH] REST received. System ARMED.');
            armedRef.current = true;
          }
          return;
        }

        // Update UI
        setCurrentLabel(parsed);
        setHistory((prev) => [parsed, ...prev].slice(0, 20));
        triggerWordPop();

        // ── Speech logic ──────────────────────────────────────────────────────
        const now = Date.now();
        const timeDiff = now - lastTimeRef.current;
        const cooldownMs = 2000;

        if (!armedRef.current) {
          console.log('[SPEECH] Waiting for REST');
          return;
        }

        if (parsed.label === lastLabelRef.current && timeDiff < cooldownMs) {
          console.log('[SPEECH] Ignored duplicate');
          return;
        }

        if (timeDiff < cooldownMs) {
          return;
        }

        // We speak!
        console.log(`[SPEECH] Speaking: ${parsed.phrase}`);
        speakPhrase(parsed.phrase);

        // Update tracking
        lastTimeRef.current = now;
        lastLabelRef.current = parsed.label;
        armedRef.current = false; // Disable until we see REST again
      };

      ws.onerror = (e) => {
        console.warn('[WS] Error', e);
        setErrorMsg('Connection error. Is mobile_ws_bridge.py running?');
        setConnState('error');
      };

      ws.onclose = () => {
        if (connState !== 'error') setConnState('disconnected');
        console.log('[WS] Closed');
        wsRef.current = null;
      };

      wsRef.current = ws;
    } catch (e: any) {
      setErrorMsg(e.message ?? 'WebSocket error');
      setConnState('error');
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
      console.log('[WS] Closed');
    }
    setConnState('disconnected');
    setCurrentLabel(null);
    Speech.stop();
  };

  // ── Speech ────────────────────────────────────────────────────────────────

  const speakPhrase = (phrase: string) => {
    Speech.stop();
    setIsSpeaking(true);
    Speech.speak(phrase, {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.9,
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  // ── Status indicators ─────────────────────────────────────────────────────

  const statusText: Record<ConnState, string> = {
    disconnected: 'Disconnected',
    connecting:   'Connecting…',
    connected:    'Live — receiving predictions',
    error:        'Connection failed',
  };

  const statusColor: Record<ConnState, string> = {
    disconnected: colors.textMuted,
    connecting:   colors.warning,
    connected:    colors.success,
    error:        colors.danger,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>WebSocket Mode</Text>
          <Text style={styles.title}>Live AI Demo</Text>
        </View>
        <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.navigate('Main')}>
          <Text style={styles.homeBtnText}>Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* URL editor */}
        <View style={styles.urlCard}>
          <Text style={styles.urlLabel}>Bridge URL</Text>
          {editingUrl ? (
            <View style={styles.urlRow}>
              <TextInput
                style={styles.urlInput}
                value={wsUrl}
                onChangeText={setWsUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="ws://10.0.2.2:8765"
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity style={styles.urlSaveBtn} onPress={() => setEditingUrl(false)}>
                <Text style={styles.urlSaveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingUrl(true)}>
              <Text style={styles.urlValue}>{wsUrl}</Text>
              <Text style={styles.urlHint}>Tap to edit · Physical phone: use your PC's IP</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Status row */}
        <View style={styles.statusCard}>
          <Animated.View style={[
            styles.statusDot,
            {
              backgroundColor: statusColor[connState],
              transform: [{ scale: connState === 'connected' ? pulseAnim : 1 }],
            },
          ]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusText, { color: statusColor[connState] }]}>
              {statusText[connState]}
            </Text>
            {connState === 'connected' && (
              <Text style={styles.packetCount}>{packetsReceived} packets received</Text>
            )}
          </View>
          {isSpeaking && (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: spacing.sm }} />
          )}
        </View>

        {/* Error */}
        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠ {errorMsg}</Text>
            <Text style={styles.errorHint}>
              Start the bridge:{'\n'}
              python python/mobile_ws_bridge.py
            </Text>
          </View>
        )}

        {/* Main prediction display */}
        {currentLabel ? (
          <Animated.View style={[styles.phraseCard, { transform: [{ scale: wordScale }] }]}>
            <Text style={styles.phraseEyebrow}>DETECTED GESTURE</Text>
            <Text style={styles.phraseWord}>{currentLabel.phrase}</Text>
            <Text style={styles.phraseCode}>{currentLabel.label}</Text>

            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>Confidence</Text>
              <Text style={[styles.confidenceValue, { color: confidenceColor(currentLabel.confidence) }]}>
                {(currentLabel.confidence * 100).toFixed(0)}%
              </Text>
            </View>

            {currentLabel.fingers.length > 0 && (
              <View style={styles.fingersSection}>
                <Text style={styles.fingersTitle}>Finger Bend</Text>
                {currentLabel.fingers.map((v, i) => (
                  <FingerBar key={i} value={v} label={FINGER_NAMES[i] ?? `F${i + 1}`} />
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.repeatBtn}
              onPress={() => speakPhrase(currentLabel.phrase)}
            >
              <Text style={styles.repeatBtnText}>🔊 Speak Again</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🖥️</Text>
            <Text style={styles.emptyTitle}>
              {connState === 'connected' ? 'Waiting for first gesture…' : 'Not connected'}
            </Text>
            <Text style={styles.emptyText}>
              {connState === 'connected'
                ? 'Bridge is running. Move your glove or wait for demo labels.'
                : 'Connect to the Python bridge to see live AI predictions.'}
            </Text>
          </View>
        )}

        {/* Connect / Disconnect */}
        <View style={styles.actions}>
          {connState !== 'connected' ? (
            <TouchableOpacity
              style={[styles.primaryBtn, connState === 'connecting' && styles.btnDisabled]}
              onPress={connect}
              disabled={connState === 'connecting'}
            >
              {connState === 'connecting'
                ? <ActivityIndicator color="white" />
                : <Text style={styles.primaryBtnText}>
                    {connState === 'error' ? '🔄 Retry Connection' : '🔌 Connect to Bridge'}
                  </Text>
              }
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.disconnectBtn} onPress={disconnect}>
              <Text style={styles.disconnectBtnText}>Disconnect</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Instructions */}
        {connState !== 'connected' && (
          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>How to start the bridge</Text>
            <Text style={styles.instructionCode}>
              {'# Demo mode (no Arduino needed):\n'}
              {'python python/mobile_ws_bridge.py\n\n'}
              {'# Real glove (replace COM4):\n'}
              {'python python/mobile_ws_bridge.py \\\n  --mode live --port COM4'}
            </Text>
            <Text style={styles.instructionHint}>
              📱 Physical phone? Change the URL above to your PC's IP address,
              e.g. ws://192.168.1.42:8765
            </Text>
          </View>
        )}

        {/* History */}
        {history.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>Recent Predictions</Text>
            {history.map((item, i) => (
              <View key={i} style={styles.historyRow}>
                <Text style={styles.historyPhrase}>{item.phrase}</Text>
                <Text style={[styles.historyConf, { color: confidenceColor(item.confidence) }]}>
                  {(item.confidence * 100).toFixed(0)}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Debug */}
        {currentLabel && (
          <View style={styles.debugCard}>
            <Text style={styles.debugTitle}>Last WS Packet</Text>
            <Text style={styles.debugText}>{currentLabel.raw}</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

// ── Finger bar styles ─────────────────────────────────────────────────────────

const fingerStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  label: { width: 52, fontSize: 12, fontWeight: '700', color: colors.textMuted },
  track: { flex: 1, height: 8, backgroundColor: colors.surfaceMuted, borderRadius: 4, overflow: 'hidden' },
  fill:  { height: 8, backgroundColor: colors.accent, borderRadius: 4 },
  pct:   { width: 38, textAlign: 'right', fontSize: 12, fontWeight: '700', color: colors.textMuted },
});

// ── Main styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  eyebrow: { color: colors.accent, fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  title:   { fontSize: 26, fontWeight: '900', color: colors.text },
  homeBtn: { backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
  homeBtnText: { color: colors.primary, fontWeight: '800' },
  scroll:  { padding: spacing.lg, paddingBottom: 60 },

  // URL card
  urlCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, ...shadow, marginBottom: spacing.md,
  },
  urlLabel:       { fontSize: 11, fontWeight: '900', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  urlValue:       { fontSize: 14, fontWeight: '700', color: colors.accent, fontFamily: 'monospace' },
  urlHint:        { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  urlRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  urlInput:       { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: spacing.sm, fontSize: 13, color: colors.text, fontFamily: 'monospace' },
  urlSaveBtn:     { backgroundColor: colors.accent, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
  urlSaveBtnText: { color: 'white', fontWeight: '800' },

  // Status
  statusCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, ...shadow, marginBottom: spacing.md,
  },
  statusDot:   { width: 12, height: 12, borderRadius: 6, marginRight: spacing.md },
  statusText:  { fontSize: 15, fontWeight: '800' },
  packetCount: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  // Error
  errorBox: {
    backgroundColor: '#FEE4E2', borderColor: '#FDA29B', borderWidth: 1,
    borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.md,
  },
  errorText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  errorHint: { color: colors.danger, fontSize: 12, marginTop: spacing.xs, fontFamily: 'monospace', lineHeight: 18 },

  // Phrase card
  phraseCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg,
    borderWidth: 2, borderColor: colors.accent, ...shadow, marginBottom: spacing.md, alignItems: 'center',
  },
  phraseEyebrow:    { fontSize: 11, fontWeight: '900', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: spacing.sm },
  phraseWord:       { fontSize: 56, fontWeight: '900', color: colors.text, textAlign: 'center', lineHeight: 64 },
  phraseCode:       { fontSize: 14, fontWeight: '700', color: colors.textMuted, marginTop: spacing.xs, textTransform: 'uppercase', letterSpacing: 2 },
  confidenceRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 99 },
  confidenceLabel:  { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  confidenceValue:  { fontSize: 15, fontWeight: '900' },
  fingersSection:   { width: '100%', marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  fingersTitle:     { fontSize: 12, fontWeight: '900', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  repeatBtn:        { marginTop: spacing.lg, backgroundColor: colors.accent, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 99 },
  repeatBtnText:    { color: 'white', fontWeight: '800', fontSize: 15 },

  // Empty state
  emptyCard:  { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  emptyIcon:  { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  emptyText:  { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, lineHeight: 20 },

  // Buttons
  actions:          { marginBottom: spacing.md },
  primaryBtn:       { backgroundColor: colors.accent, padding: spacing.md, borderRadius: radius.md, alignItems: 'center', minHeight: 54, justifyContent: 'center' },
  primaryBtnText:   { color: 'white', fontSize: 16, fontWeight: '800' },
  btnDisabled:      { opacity: 0.6 },
  disconnectBtn:    { backgroundColor: colors.textMuted, padding: spacing.md, borderRadius: radius.md, alignItems: 'center', minHeight: 54, justifyContent: 'center' },
  disconnectBtnText:{ color: 'white', fontSize: 16, fontWeight: '800' },

  // Instructions
  instructionCard: {
    backgroundColor: '#1E293B', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  instructionTitle: { color: '#94A3B8', fontSize: 13, fontWeight: '800', marginBottom: spacing.sm },
  instructionCode:  { color: '#7DD3FC', fontFamily: 'monospace', fontSize: 12, lineHeight: 20 },
  instructionHint:  { color: '#64748B', fontSize: 12, marginTop: spacing.sm, lineHeight: 18 },

  // History
  historyCard:  { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, ...shadow },
  historyTitle: { fontSize: 13, fontWeight: '900', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  historyRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyPhrase:{ fontSize: 15, fontWeight: '700', color: colors.text },
  historyConf:  { fontSize: 14, fontWeight: '800' },

  // Debug
  debugCard:  { backgroundColor: '#1E293B', borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.md },
  debugTitle: { color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  debugText:  { color: '#94A3B8', fontFamily: 'monospace', fontSize: 12 },
});

export default WebSocketLabelScreen;
