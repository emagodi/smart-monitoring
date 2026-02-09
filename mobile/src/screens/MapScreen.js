import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import transformerService from '../services/transformer';

const MapScreen = ({ navigation }) => {
  const [transformers, setTransformers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTransformers = async () => {
    try {
      const data = await transformerService.getAllTransformers();
      setTransformers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransformers();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
            latitude: transformers.length > 0 ? parseFloat(transformers[0].lat || -17.82) : -17.82,
            longitude: transformers.length > 0 ? parseFloat(transformers[0].lng || 31.05) : 31.05,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
        }}
      >
        {transformers.map(t => (
            <Marker
                key={t.id}
                coordinate={{
                    latitude: parseFloat(t.lat || -17.82),
                    longitude: parseFloat(t.lng || 31.05)
                }}
                title={t.name || t.code || `Transformer #${t.id}`}
                description={t.depotName}
                pinColor={(t.active || t.isActive) ? 'green' : 'red'}
                onCalloutPress={() => navigation.navigate('TransformerDetails', { transformerId: t.id })}
            />
        ))}
      </MapView>
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
});

export default MapScreen;
