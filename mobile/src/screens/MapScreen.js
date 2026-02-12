import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, Text } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import transformerService from '../services/transformer';

const MapScreen = ({ navigation }) => {
  const [transformers, setTransformers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTransformers = async () => {
    try {
      setLoading(true);
      // Fetch a large page to show many transformers on the map
      const data = await transformerService.getAllTransformers(0, 100);
      if (data && data.content) {
          setTransformers(data.content);
      } else if (Array.isArray(data)) {
          setTransformers(data);
      } else {
          setTransformers([]);
      }
    } catch (error) {
      console.error(error);
      setTransformers([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTransformers();
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0067A5" />
      </View>
    );
  }

  // Filter for valid coordinates only
  const validTransformers = transformers.filter(t => 
    t.lat && t.lng && 
    !isNaN(parseFloat(t.lat)) && !isNaN(parseFloat(t.lng)) &&
    parseFloat(t.lat) !== 0 && parseFloat(t.lng) !== 0
  );

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
            latitude: validTransformers.length > 0 ? parseFloat(validTransformers[0].lat) : -17.82,
            longitude: validTransformers.length > 0 ? parseFloat(validTransformers[0].lng) : 31.05,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
        }}
      >
        {validTransformers.map(t => (
            <Marker
                key={t.id}
                coordinate={{
                    latitude: parseFloat(t.lat),
                    longitude: parseFloat(t.lng)
                }}
                title={t.name || `Transformer #${t.id}`}
                description={`${t.depotName || 'Unknown Depot'} - ${t.isActive ? 'Active' : 'Maintenance'}`}
                pinColor={t.isActive ? 'green' : 'red'}
                onCalloutPress={() => navigation.navigate('TransformerDetails', { transformerId: t.id })}
            />
        ))}
      </MapView>
      {validTransformers.length === 0 && !loading && (
        <View style={styles.noDataOverlay}>
            <Text style={styles.noDataText}>No transformers with location data found.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  noDataOverlay: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 8,
    elevation: 5,
  },
  noDataText: {
    color: '#333',
    fontWeight: 'bold',
  }
});

export default MapScreen;
