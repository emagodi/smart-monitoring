import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Switch, Button, Alert } from 'react-native';
import transformerService from '../services/transformer';
import sensorService from '../services/sensor';
import alertService from '../services/alert';

const TransformerDetailsScreen = ({ route, navigation }) => {
  const { transformerId } = route.params;
  const [transformer, setTransformer] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchData = async () => {
    try {
      const [tData, sData] = await Promise.all([
        transformerService.getTransformerById(transformerId),
        sensorService.getSensorsByTransformer(transformerId)
      ]);
      setTransformer(tData);
      setSensors(sData);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load transformer details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [transformerId]);

  const toggleStatus = async () => {
    if (!transformer) return;
    setUpdating(true);
    try {
        // Toggle active status
        const newStatus = !transformer.active;
        // Need to send full object or specific fields depending on API
        // Assuming update takes the request body with fields to update
        const updated = await transformerService.updateTransformer(transformerId, {
            ...transformer,
            active: newStatus
        });
        setTransformer(updated);
        Alert.alert('Success', `Transformer is now ${newStatus ? 'Active' : 'in Maintenance'}`);
    } catch (error) {
        console.error(error);
        Alert.alert('Error', 'Failed to update status');
    } finally {
        setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!transformer) {
    return (
      <View style={styles.center}>
        <Text>Transformer not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{transformer.code || `Transformer #${transformer.id}`}</Text>
        <Text>Address: {transformer.address}</Text>
        <Text>Region: {transformer.region?.name}</Text>
        <Text>District: {transformer.district?.name}</Text>
        
        <View style={styles.row}>
            <Text style={styles.label}>Status: {transformer.active ? 'Active' : 'Maintenance'}</Text>
            <Switch
                value={transformer.active}
                onValueChange={toggleStatus}
                disabled={updating}
            />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Sensors</Text>
      {sensors.length === 0 ? (
          <Text style={styles.emptyText}>No sensors installed</Text>
      ) : (
          sensors.map(sensor => (
              <View key={sensor.id} style={styles.sensorCard}>
                  <Text style={styles.sensorName}>{sensor.sensorType} Sensor</Text>
                  <Text>ID: {sensor.id}</Text>
                  {sensor.readings && sensor.readings.length > 0 && (
                      <Text>Latest Reading: {sensor.readings[sensor.readings.length-1].value}</Text>
                  )}
              </View>
          ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 10,
  },
  sensorCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  sensorName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  emptyText: {
    fontStyle: 'italic',
    color: 'gray',
  },
});

export default TransformerDetailsScreen;
