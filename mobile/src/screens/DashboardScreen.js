import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import transformerService from '../services/transformer';

const DashboardScreen = ({ navigation }) => {
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
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={transformers}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={fetchTransformers}
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
});

export default DashboardScreen;
