import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './src/screens/LoginScreen';
import DevicesScreen from './src/screens/DevicesScreen';
import MockCaptureScreen from './src/screens/MockCaptureScreen';
import HardwareCaptureScreen from './src/screens/HardwareCaptureScreen';
import PhraseOutputScreen from './src/screens/PhraseOutputScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ModelStatusScreen from './src/screens/ModelStatusScreen';
import RecordingsScreen from './src/screens/RecordingsScreen';
import SpeechDemoScreen from './src/screens/SpeechDemoScreen';
import SerialGloveDemoScreen from './src/screens/SerialGloveDemoScreen';
import BleLabelScreen from './src/screens/BleLabelScreen';
import WebSocketLabelScreen from './src/screens/WebSocketLabelScreen';
import ModeSelectionScreen from './src/screens/ModeSelectionScreen';
import AslProfilesScreen from './src/screens/AslProfilesScreen';
import PhraseEditorScreen from './src/screens/PhraseEditorScreen';
import AslHistoryScreen from './src/screens/AslHistoryScreen';
import AslSettingsScreen from './src/screens/AslSettingsScreen';
import AslTrainingScreen from './src/screens/AslTrainingScreen';
import { colors } from './src/styles/theme';

const Stack = createStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName="Login"
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.primary,
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            headerShown: false,
            cardStyle: {
              backgroundColor: colors.background,
            },
          }}
        >
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ModeSelection"
            component={ModeSelectionScreen}
            options={{ title: 'Choose Mode' }}
          />
          <Stack.Screen 
            name="Main" 
            component={DevicesScreen} 
            options={{ title: 'Smart Glove' }}
          />
          <Stack.Screen 
            name="MockCapture" 
            component={MockCaptureScreen} 
            options={{ title: 'Mock Capture' }}
          />
          <Stack.Screen 
            name="HardwareCapture" 
            component={HardwareCaptureScreen} 
            options={{ title: 'Live Capture' }}
          />
          <Stack.Screen 
            name="PhraseOutput" 
            component={PhraseOutputScreen} 
            options={{ title: 'Translation' }}
          />
          <Stack.Screen 
            name="History" 
            component={HistoryScreen} 
            options={{ title: 'Prediction History' }}
          />
          <Stack.Screen
            name="ModelStatus"
            component={ModelStatusScreen}
            options={{ title: 'Model Status' }}
          />
          <Stack.Screen
            name="Recordings"
            component={RecordingsScreen}
            options={{ title: 'Recordings' }}
          />
          <Stack.Screen
            name="SpeechDemo"
            component={SpeechDemoScreen}
            options={{ title: '3D Speech Demo' }}
          />
          <Stack.Screen
            name="SerialGloveDemo"
            component={SerialGloveDemoScreen}
            options={{ title: 'Live USB Demo' }}
          />
          <Stack.Screen
            name="BleLabel"
            component={BleLabelScreen}
            options={{ title: 'BLE Label Mode' }}
          />
          <Stack.Screen
            name="WebSocketLabel"
            component={WebSocketLabelScreen}
            options={{ title: 'WebSocket Demo' }}
          />
          <Stack.Screen
            name="AslProfiles"
            component={AslProfilesScreen}
            options={{ title: 'Profiles' }}
          />
          <Stack.Screen
            name="PhraseEditor"
            component={PhraseEditorScreen}
            options={{ title: 'Phrase Editor' }}
          />
          <Stack.Screen
            name="AslHistory"
            component={AslHistoryScreen}
            options={{ title: 'ASL History' }}
          />
          <Stack.Screen
            name="AslSettings"
            component={AslSettingsScreen}
            options={{ title: 'ASL Settings' }}
          />
          <Stack.Screen
            name="AslTraining"
            component={AslTrainingScreen}
            options={{ title: 'Custom Training' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
