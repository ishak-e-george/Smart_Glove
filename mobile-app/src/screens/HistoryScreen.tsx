import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { predictionApi } from '../api/predictionApi';
import { PredictionResponse } from '../types/recording';

const HistoryScreen = ({ navigation }: any) => {
  const [predictions, setPredictions] = useState<PredictionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await predictionApi.getPredictions();
      // Sort by date descending
      const sortedData = data.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setPredictions(sortedData);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch prediction history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const renderItem = ({ item }: { item: PredictionResponse }) => (
    <View style={styles.historyItem}>
      <View style={styles.itemHeader}>
        <Text style={styles.gestureId}>Gesture #{item.predicted_gesture_id}</Text>
        <View style={[styles.confidenceBadge, { backgroundColor: item.confidence > 0.8 ? '#2ecc71' : '#f39c12' }]}>
          <Text style={styles.confidenceText}>{(item.confidence * 100).toFixed(1)}%</Text>
        </View>
      </View>
      <View style={styles.itemFooter}>
        <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        <Text style={styles.sourceText}>Source: {item.source_type}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>History</Text>
        <TouchableOpacity onPress={fetchHistory} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3498db" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={predictions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No history found.</Text>
          }
        />
      )}
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    color: '#3498db',
    fontSize: 16,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 5,
  },
  refreshButtonText: {
    color: '#3498db',
    fontSize: 16,
  },
  listContent: {
    padding: 15,
  },
  historyItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  gestureId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34495e',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 14,
    color: '#95a5a6',
  },
  sourceText: {
    fontSize: 14,
    color: '#bdc3c7',
    fontStyle: 'italic',
  },
  emptyText: {
    textAlign: 'center',
    color: '#7f8c8d',
    marginTop: 50,
    fontSize: 16,
  },
});

export default HistoryScreen;
