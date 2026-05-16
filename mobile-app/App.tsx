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
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
