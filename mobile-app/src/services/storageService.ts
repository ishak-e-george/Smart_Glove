/**
 * A simple storage service wrapper.
 * In a real app, this would use @react-native-async-storage/async-storage
 * or expo-secure-store for sensitive data.
 */

const storage: { [key: string]: string } = {};

export const storageService = {
  async getItem(key: string): Promise<string | null> {
    // Replace with: return await AsyncStorage.getItem(key);
    return storage[key] || null;
  },

  async setItem(key: string, value: string): Promise<void> {
    // Replace with: await AsyncStorage.setItem(key, value);
    storage[key] = value;
  },

  async removeItem(key: string): Promise<void> {
    // Replace with: await AsyncStorage.removeItem(key);
    delete storage[key];
  },

  async clear(): Promise<void> {
    // Replace with: await AsyncStorage.clear();
    Object.keys(storage).forEach(key => delete storage[key]);
  }
};
