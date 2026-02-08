import React, { useEffect, useState, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Button, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import transformerService from '../services/transformer';
import { AuthContext } from '../contexts/AuthContext';

const DashboardScreen = ({ navigation }) => {
  const [transformers, setTransformers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  const { signOut } = useContext(AuthContext);

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

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => navigation.navigate('TransformerDetails', { transformerId: item.id })}
    >
      <View>
        <Text style={styles.itemTitle}>{item.code || item.name || `Transformer #${item.id}`}</Text>
        <Text>Status: {item.active || item.isActive ? 'Active' : 'Maintenance'}</Text>
        <Text>Region: {item.region?.name || item.depotName || 'N/A'}</Text>
      </View>
      <View style={[styles.statusIndicator, { backgroundColor: (item.active || item.isActive) ? 'green' : 'red' }]} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transformers</Text>
        <View style={styles.headerButtons}>
            <Button title={viewMode === 'list' ? 'Map View' : 'List View'} onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')} />
            <View style={{ width: 10 }} />
            <Button title="Alerts" onPress={() => navigation.navigate('Alerts')} color="orange" />
            <View style={{ width: 10 }} />
            <Button title="Sim" onPress={() => navigation.navigate('Simulation')} />
        </View>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" />
      ) : viewMode === 'list' ? (
        <FlatList
          data={transformers}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={fetchTransformers}
        />
      ) : (
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
      )}
      
      <View style={styles.footer}>
        <Button title="Logout" onPress={signOut} color="red" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  list: {
    paddingBottom: 20,
  },
  map: {
    width: Dimensions.get('window').width - 20,
    height: Dimensions.get('window').height - 150,
    borderRadius: 10,
  },
  item: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusIndicator: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
  },
  footer: {
    marginTop: 10,
  },
});

export default DashboardScreen;
