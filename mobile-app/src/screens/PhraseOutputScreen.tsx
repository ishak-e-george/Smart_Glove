import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { phraseApi, Phrase } from '../api/phraseApi';

const PhraseOutputScreen = ({ route, navigation }: any) => {
  const { gestureId, modelLabel, confidence } = route.params;
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPhrases = async () => {
      try {
        // Fetch phrases for all common languages or just default
        // For now, let's just fetch the default 'en' and maybe others if API supports
        const data = await phraseApi.getPhrasesByGesture(gestureId);
        setPhrases(data);
      } catch (error) {
        Alert.alert('Error', 'Failed to fetch translated phrases');
      } finally {
        setLoading(false);
      }
    };

    fetchPhrases();
  }, [gestureId]);

  const renderItem = ({ item }: { item: Phrase }) => (
    <View style={styles.phraseItem}>
      <View style={styles.langBadge}>
        <Text style={styles.langText}>{item.language_code.toUpperCase()}</Text>
      </View>
      <Text style={styles.phraseText}>{item.text_value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Translation Result</Text>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#2ecc71" style={{ marginTop: 50 }} />
        ) : (
          <>
            <View style={styles.gestureInfo}>
              <Text style={styles.gestureLabel}>Predicted Gesture ID:</Text>
              <Text style={styles.gestureValue}>{gestureId}</Text>
            </View>
            {modelLabel && (
              <View style={styles.predictionInfo}>
                <Text style={styles.predictionText}>{modelLabel}</Text>
                {typeof confidence === 'number' && (
                  <Text style={styles.confidenceText}>{Math.round(confidence * 100)}% confidence</Text>
                )}
              </View>
            )}

            <FlatList
              data={phrases}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No translations found for this gesture.</Text>
              }
            />
          </>
        )}
      </View>

      <TouchableOpacity 
        style={styles.doneButton}
        onPress={() => navigation.navigate('Main')}
      >
        <Text style={styles.doneButtonText}>Return to Home</Text>
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
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  gestureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f6ef',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#d1eade',
  },
  gestureLabel: {
    fontSize: 16,
    color: '#27ae60',
    marginRight: 10,
  },
  gestureValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  predictionInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  predictionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34495e',
  },
  confidenceText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 20,
  },
  phraseItem: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  langBadge: {
    backgroundColor: '#3498db',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 15,
    width: 45,
    alignItems: 'center',
  },
  langText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  phraseText: {
    fontSize: 18,
    color: '#34495e',
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: '#7f8c8d',
    marginTop: 50,
    fontSize: 16,
  },
  doneButton: {
    margin: 20,
    padding: 18,
    backgroundColor: '#2ecc71',
    borderRadius: 10,
    alignItems: 'center',
  },
  doneButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
});

export default PhraseOutputScreen;
