import React, { useState, useEffect } from 'react';
import { View, Text, Button, Image, StyleSheet, ScrollView, Alert, ActivityIndicator, TextInput, TouchableOpacity, Modal, FlatList } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import visionService from '../services/vision';
import transformerService from '../services/transformer';
import sensorService from '../services/sensor';
import sensorReadingService from '../services/sensorReading';

const SimulationScreen = () => {
  // Vision AI State
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [visionLoading, setVisionLoading] = useState(false);

  // Sensor Simulation State
  const [transformers, setTransformers] = useState([]);
  const [selectedTransformer, setSelectedTransformer] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [sensorValue, setSensorValue] = useState('');
  const [sensorLoading, setSensorLoading] = useState(false);
  const [submittingSensor, setSubmittingSensor] = useState(false);
  
  // Modals for selection
  const [showTransformerModal, setShowTransformerModal] = useState(false);
  const [showSensorModal, setShowSensorModal] = useState(false);

  // Initial Load
  useEffect(() => {
    fetchTransformers();
  }, []);

  // Fetch Transformers
  const fetchTransformers = async () => {
    setSensorLoading(true);
    try {
      const data = await transformerService.getAllTransformers();
      setTransformers(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load transformers');
    } finally {
      setSensorLoading(false);
    }
  };

  // Fetch Sensors when Transformer selected
  const handleTransformerSelect = async (transformer) => {
    setSelectedTransformer(transformer);
    setShowTransformerModal(false);
    setSelectedSensor(null);
    setSensors([]);
    
    setSensorLoading(true);
    try {
      const data = await sensorService.getSensorsByTransformer(transformer.id);
      setSensors(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load sensors');
    } finally {
      setSensorLoading(false);
    }
  };

  const handleSensorSelect = (sensor) => {
    setSelectedSensor(sensor);
    setShowSensorModal(false);
  };

  const submitSensorReading = async () => {
    if (!selectedSensor || !sensorValue) {
      Alert.alert('Error', 'Please select a sensor and enter a value');
      return;
    }

    setSubmittingSensor(true);
    try {
      // Construct JSON payload expected by backend
      // Backend expects: { "data": { "<type>": <value> } }
      let key = selectedSensor.sensorType.toLowerCase();
      if (key.includes('temp')) key = 'temperature';
      else if (key.includes('contact')) key = 'contact';
      else if (key.includes('suspicious')) key = 'suspicious_till';

      // Parse value if numeric
      let value = sensorValue;
      if (!isNaN(sensorValue)) {
        value = parseFloat(sensorValue);
      }

      const payload = {
        data: {
          [key]: value
        }
      };

      await sensorReadingService.createReading({
        sensorId: selectedSensor.id,
        decoded: JSON.stringify(payload), // Sending JSON string
        rawPayload: '' 
      });
      Alert.alert('Success', 'Sensor reading submitted successfully');
      setSensorValue('');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to submit sensor reading');
    } finally {
      setSubmittingSensor(false);
    }
  };

  // Vision AI Logic
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setResult(null);
    }
  };

  const analyzeImage = async () => {
    if (!image) return;
    setVisionLoading(true);
    try {
      const data = await visionService.analyzeImage(image);
      setResult(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to analyze image');
    } finally {
      setVisionLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Sensor Simulation Section */}
      <Text style={styles.sectionHeader}>Sensor Simulation</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Select Transformer:</Text>
        <TouchableOpacity 
            style={styles.dropdown}
            onPress={() => setShowTransformerModal(true)}
        >
            <Text>{selectedTransformer ? (selectedTransformer.code || `ID: ${selectedTransformer.id}`) : 'Select Transformer...'}</Text>
        </TouchableOpacity>

        {selectedTransformer && (
            <>
                <Text style={styles.label}>Select Sensor:</Text>
                <TouchableOpacity 
                    style={styles.dropdown}
                    onPress={() => setShowSensorModal(true)}
                >
                    <Text>{selectedSensor ? `${selectedSensor.sensorType} (ID: ${selectedSensor.id})` : 'Select Sensor...'}</Text>
                </TouchableOpacity>
            </>
        )}

        {selectedSensor && (
            <>
                <Text style={styles.label}>Sensor Value:</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter value (e.g. 45.5)"
                    value={sensorValue}
                    onChangeText={setSensorValue}
                    keyboardType="numeric"
                />
                <Button 
                    title={submittingSensor ? "Sending..." : "Send Reading"} 
                    onPress={submitSensorReading} 
                    disabled={submittingSensor} 
                />
            </>
        )}
      </View>

      <View style={styles.divider} />

      {/* Vision AI Section */}
      <Text style={styles.sectionHeader}>Vision AI Simulation</Text>
      <View style={styles.card}>
        <View style={styles.imageContainer}>
            {image ? (
                <Image source={{ uri: image }} style={styles.image} />
            ) : (
                <View style={styles.placeholder}>
                    <Text>No image selected</Text>
                </View>
            )}
        </View>

        <View style={styles.buttonRow}>
            <Button title="Pick Image" onPress={pickImage} />
            <View style={{ width: 20 }} />
            <Button title="Analyze" onPress={analyzeImage} disabled={!image || visionLoading} />
        </View>

        {visionLoading && <ActivityIndicator size="large" />}

        {result && (
            <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>Prediction Result:</Text>
            <Text style={styles.resultText}>Class: {result.prediction.class}</Text>
            <Text style={styles.resultText}>Confidence: {(result.prediction.confidence * 100).toFixed(2)}%</Text>
            </View>
        )}
      </View>

      {/* Modals */}
      <Modal visible={showTransformerModal} animationType="slide">
          <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Select Transformer</Text>
              <FlatList
                  data={transformers}
                  keyExtractor={item => item.id.toString()}
                  renderItem={({ item }) => (
                      <TouchableOpacity 
                        style={styles.modalItem}
                        onPress={() => handleTransformerSelect(item)}
                      >
                          <Text style={styles.modalItemText}>{item.code || `Transformer #${item.id}`}</Text>
                          <Text>{item.region?.name}</Text>
                      </TouchableOpacity>
                  )}
              />
              <Button title="Cancel" onPress={() => setShowTransformerModal(false)} color="red" />
          </View>
      </Modal>

      <Modal visible={showSensorModal} animationType="slide">
          <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Select Sensor</Text>
              <FlatList
                  data={sensors}
                  keyExtractor={item => item.id.toString()}
                  renderItem={({ item }) => (
                      <TouchableOpacity 
                        style={styles.modalItem}
                        onPress={() => handleSensorSelect(item)}
                      >
                          <Text style={styles.modalItemText}>{item.sensorType} Sensor</Text>
                          <Text>ID: {item.id}</Text>
                      </TouchableOpacity>
                  )}
              />
              <Button title="Cancel" onPress={() => setShowSensorModal(false)} color="red" />
          </View>
      </Modal>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 50,
  },
  sectionHeader: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  card: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    fontWeight: '500',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 12,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: 10,
  },
  imageContainer: {
    width: '100%',
    height: 250,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eee',
    borderRadius: 5,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  resultContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#e6f7ff',
    borderRadius: 5,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  resultText: {
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalItemText: {
    fontSize: 18,
    fontWeight: '500',
  },
});

export default SimulationScreen;
