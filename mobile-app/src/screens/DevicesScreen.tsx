import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deviceApi, DeviceCreate } from '../api/deviceApi';

const DevicesScreen = ({ navigation }: any) => {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const data = await deviceApi.getDevices();
      setDevices(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleAddDevice = async () => {
    const newDevice: DeviceCreate = {
      device_name: `Glove ${devices.length + 1}`,
      serial_number: `SN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      device_type: 'smart_glove',
    };

    try {
      await deviceApi.createDevice(newDevice);
      Alert.alert('Success', 'New device registered');
      fetchDevices();
    } catch (error) {
      Alert.alert('Error', 'Failed to add device');
    }
  };

  const handleDevicePress = (item: any) => {
    Alert.alert(
      'Select Capture Mode',
      `How would you like to capture data for ${item.device_name}?`,
      [
        {
          text: 'Mock (Simulation)',
          onPress: () => navigation.navigate('MockCapture', { deviceId: item.id }),
        },
        {
          text: 'Hardware (BLE)',
          onPress: () => navigation.navigate('HardwareCapture', { deviceId: item.id }),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.deviceItem}
      onPress={() => handleDevicePress(item)}
    >
      <View>
        <Text style={styles.deviceName}>{item.device_name}</Text>
        <Text style={styles.deviceSerial}>{item.serial_number}</Text>
      </View>
      <Text style={styles.chevron}>{'>'}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Devices</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddDevice}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3498db" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No devices registered yet.</Text>
          }
        />
      )}
      
      <TouchableOpacity 
        style={styles.historyButton}
        onPress={() => navigation.navigate('History')}
      >
        <Text style={styles.historyButtonText}>View History</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  addButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  listContent: {
    padding: 15,
  },
  deviceItem: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34495e',
  },
  deviceSerial: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  chevron: {
    fontSize: 20,
    color: '#bdc3c7',
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#7f8c8d',
    marginTop: 50,
    fontSize: 16,
  },
  historyButton: {
    margin: 20,
    padding: 15,
    backgroundColor: '#95a5a6',
    borderRadius: 10,
    alignItems: 'center',
  },
  historyButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default DevicesScreen;
