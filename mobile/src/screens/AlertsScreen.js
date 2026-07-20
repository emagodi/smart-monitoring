import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import alertService from '../services/alert';

const AlertsScreen = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const data = await alertService.getAllAlerts();
      // Sort by latest (assuming ID or timestamp, but API might not sort)
      // If there's a timestamp field, use it. Else reverse id.
      const sorted = data.sort((a, b) => b.id - a.id); 
      setAlerts(sorted);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <View style={styles.header}>
        <Text style={styles.severity}>{item.severity || 'ALERT'}</Text>
        <Text style={styles.date}>{item.timestamp || `ID: ${item.id}`}</Text>
      </View>
      <Text style={styles.message}>{item.message}</Text>
      <Text style={styles.details}>Sensor: {item.sensor?.sensorType || 'Unknown'} (ID: {item.sensor?.id})</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={alerts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={fetchAlerts}
          ListEmptyComponent={<Text style={styles.empty}>No alerts found</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f5f5f5',
  },
  list: {
    paddingBottom: 20,
  },
  item: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
    borderLeftWidth: 5,
    borderLeftColor: 'red',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  severity: {
    fontWeight: 'bold',
    color: 'red',
    fontSize: 16,
  },
  date: {
    color: 'gray',
    fontSize: 12,
  },
  message: {
    fontSize: 14,
    marginBottom: 5,
  },
  details: {
    fontSize: 12,
    color: '#666',
  },
  empty: {
    textAlign: 'center',
    marginTop: 20,
    color: 'gray',
  },
});

export default AlertsScreen;
