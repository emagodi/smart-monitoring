import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Switch, Button, Alert, Dimensions, TouchableOpacity } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
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
        const newStatus = !transformer.isActive;
        const updated = await transformerService.updateTransformer(transformerId, {
            ...transformer,
            isActive: newStatus
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
        <Text style={styles.title}>{transformer.name}</Text>
        <Text style={styles.detailText}>Depot: {transformer.depotName || transformer.depotId}</Text>
        <Text style={styles.detailText}>Capacity: {transformer.capacity} KVA</Text>
        
        <View style={styles.row}>
            <Text style={styles.label}>Status: {transformer.isActive ? 'Active' : 'Maintenance'}</Text>
            <Switch
                value={transformer.isActive}
                onValueChange={toggleStatus}
                disabled={updating}
            />
        </View>

        <View style={styles.actionButtonsContainer}>
            <TouchableOpacity 
                style={[styles.actionButton, styles.sensorButton]}
                onPress={() => navigation.navigate('TransformerCrud', { 
                    transformer: transformer,
                    viewLevel: 'sensors'
                })}
            >
                <Text style={styles.actionButtonText}>View Sensors</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={[styles.actionButton, styles.cameraButton]}
                onPress={() => navigation.navigate('TransformerCrud', { 
                    transformer: transformer,
                    viewLevel: 'cameras'
                })}
            >
                <Text style={styles.actionButtonText}>View Cameras</Text>
            </TouchableOpacity>
        </View>

        {transformer.lat && transformer.lng && (
            <View style={styles.mapContainer}>
                <Text style={styles.label}>Location</Text>
                <Text style={styles.coordinatesText}>
                    Lat: {transformer.lat}, Lng: {transformer.lng}
                </Text>
                <MapView
                    style={styles.map}
                    initialRegion={{
                        latitude: parseFloat(transformer.lat),
                        longitude: parseFloat(transformer.lng),
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                    }}
                >
                    <Marker
                        coordinate={{
                            latitude: parseFloat(transformer.lat),
                            longitude: parseFloat(transformer.lng),
                        }}
                        title={transformer.name}
                    />
                </MapView>
            </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Sensors</Text>
      {sensors.length === 0 ? (
          <Text style={styles.emptyText}>No sensors installed</Text>
      ) : (
          sensors.map(sensor => (
              <View key={sensor.id} style={styles.sensorCard}>
                  <Text style={styles.sensorName}>{sensor.type} Sensor</Text>
                  <Text>ID: {sensor.id}</Text>
                  <Text>Device EUI: {sensor.devEui}</Text>
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
    color: '#0067A5',
  },
  detailText: {
    fontSize: 16,
    marginBottom: 5,
    color: '#333',
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
    fontWeight: '600',
    marginBottom: 5,
  },
  mapContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  coordinatesText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  map: {
    width: '100%',
    height: 200,
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 10,
    color: '#333',
  },
  sensorCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 1,
  },
  sensorName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#0067A5',
  },
  emptyText: {
    fontStyle: 'italic',
    color: 'gray',
    textAlign: 'center',
    marginTop: 20,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  sensorButton: {
    backgroundColor: '#0067A5',
  },
  cameraButton: {
    backgroundColor: '#2E7D32', // Green for cameras
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default TransformerDetailsScreen;
