import React, { useState, useEffect } from 'react';
import { View, Text, Button, Image, StyleSheet, ScrollView, Alert, ActivityIndicator, TextInput, TouchableOpacity, Modal, FlatList } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import config from '../config';
import transformerService from '../services/transformer';
import sensorService from '../services/sensor';
import { Ionicons } from '@expo/vector-icons';

const SimulationScreen = () => {
  // Vision AI State
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('general');

  // Sensor Simulation State
  const [transformers, setTransformers] = useState([]);
  const [selectedTransformer, setSelectedTransformer] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [sensorValue, setSensorValue] = useState('');
  const [sensorLoading, setSensorLoading] = useState(false);
  const [submittingSensor, setSubmittingSensor] = useState(false);
  const [sensorResult, setSensorResult] = useState(null);
  const [fusionStatus, setFusionStatus] = useState(null);
  
  // Modals for selection
  const [showTransformerModal, setShowTransformerModal] = useState(false);
  const [showSensorModal, setShowSensorModal] = useState(false);

  const models = [
    { id: 'general', name: 'Standard Security', icon: 'shield-checkmark' },
    { id: 'fire', name: 'Fire Safety', icon: 'flame' },
    { id: 'defect', name: 'Equipment Inspection', icon: 'construct' },
    { id: 'door', name: 'Door Monitoring', icon: 'log-in-outline' },
  ];

  const codedValues = [
    { label: 'Normal', value: 'NORMAL', color: '#4CAF50' },
    { label: 'Warning', value: 'WARNING', color: '#FF9800' },
    { label: 'Critical', value: 'CRITICAL', color: '#F44336' },
    { label: 'Low', value: 'LOW', color: '#2196F3' },
  ];

  // Initial Load
  useEffect(() => {
    fetchTransformers();
  }, []);

  // Fusion Logic
  useEffect(() => {
    if (result || sensorResult) {
        determineFusionStatus();
    }
  }, [result, sensorResult]);

  const determineFusionStatus = () => {
    const visionAlert = result?.alertLevel || 'SAFE';
    const sensorAlert = sensorResult?.alertLevel || 'SAFE';

    let status = { level: 'SAFE', message: 'System Normal', color: '#4CAF50' };

    if (result?.visionResult?.modelType === 'door') {
         const isDoorOpen = result.visionResult.detectedClass === 'door_open';
         const isSensorOpen = sensorResult?.alertLevel === 'CRITICAL'; // Contact sensor critical = open

         if (isDoorOpen && isSensorOpen) {
             status = { level: 'CRITICAL', message: 'CONFIRMED: Door Open (Unauthorized)', color: '#D32F2F' };
         } else if (isDoorOpen && !isSensorOpen) {
             status = { level: 'CRITICAL', message: 'WARNING: Door Forced / Sensor Fault', color: '#F44336' };
         } else if (!isDoorOpen && isSensorOpen) {
             status = { level: 'WARNING', message: 'WARNING: Sensor Fault (False Positive)', color: '#FF9800' };
         } else {
             status = { level: 'SAFE', message: 'SECURE: Door Closed', color: '#4CAF50' };
         }
         setFusionStatus(status);
         return;
    }

    if (visionAlert === 'CRITICAL' && sensorAlert === 'CRITICAL') {
        status = { level: 'CRITICAL', message: 'EMERGENCY: CONFIRMED THREAT (Sensor + Vision)', color: '#D32F2F' };
    } else if (visionAlert === 'CRITICAL') {
        status = { level: 'CRITICAL', message: 'CRITICAL: Visual Threat Detected', color: '#F44336' };
    } else if (sensorAlert === 'CRITICAL') {
        status = { level: 'CRITICAL', message: 'CRITICAL: Sensor Anomaly Detected', color: '#F44336' };
    } else if (visionAlert === 'WARNING' || sensorAlert === 'WARNING') {
        status = { level: 'WARNING', message: 'WARNING: Potential Issue Detected', color: '#FF9800' };
    }

    setFusionStatus(status);
  };

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
    setSensorResult(null);
    
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
    setSensorResult(null);
  };

  const submitSensorReading = async (valueToSubmit) => {
    if (!selectedSensor) {
      Alert.alert('Error', 'Please select a sensor first');
      return;
    }

    const val = valueToSubmit !== undefined ? valueToSubmit : sensorValue;
    if (!val) {
        Alert.alert('Error', 'Please enter or select a value');
        return;
    }

    setSubmittingSensor(true);
    setSensorResult(null);

    try {
      const payload = {
        sensorId: selectedSensor.id,
        sensorType: selectedSensor.sensorType
      };

      // Check if it's a coded value or raw numeric
      const isCoded = codedValues.some(cv => cv.value === val);
      if (isCoded) {
          payload.codedValue = val;
      } else {
          payload.rawValue = parseFloat(val);
      }

      const response = await api.post('/api/v1/simulation/sensor', payload);
      setSensorResult(response.data);
      setSensorValue(''); // Clear input if successful
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
    setResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: image,
        name: 'photo.jpg',
        type: 'image/jpeg',
      });
      // Append modelType as query param or formData. Backend expects RequestParam.
      // Axios with FormData: params are separate.

      const response = await api.post('/api/v1/simulation/analyze', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        params: {
            modelType: selectedModel
        }
      });
      setResult(response.data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to analyze image');
    } finally {
      setVisionLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      
      {/* System Status Dashboard */}
      {fusionStatus && (
        <View style={[styles.dashboardCard, { backgroundColor: fusionStatus.color }]}>
            <View style={styles.dashboardHeader}>
                <Ionicons name={fusionStatus.level === 'SAFE' ? 'checkmark-circle' : 'warning'} size={32} color="white" />
                <Text style={styles.dashboardTitle}>{fusionStatus.level}</Text>
            </View>
            <Text style={styles.dashboardMessage}>{fusionStatus.message}</Text>
        </View>
      )}

      {/* Vision AI Section */}
      <Text style={styles.sectionHeader}>Enterprise AI Simulation</Text>
      
      <View style={styles.card}>
        <Text style={styles.subHeader}>Select AI Model</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modelSelector}>
            {models.map(model => (
                <TouchableOpacity 
                    key={model.id} 
                    style={[styles.modelChip, selectedModel === model.id && styles.selectedModelChip]}
                    onPress={() => setSelectedModel(model.id)}
                >
                    <Ionicons name={model.icon} size={20} color={selectedModel === model.id ? '#fff' : '#666'} />
                    <Text style={[styles.modelChipText, selectedModel === model.id && styles.selectedModelChipText]}>{model.name}</Text>
                </TouchableOpacity>
            ))}
        </ScrollView>

        <View style={styles.imageContainer}>
            {image ? (
                <Image source={{ uri: image }} style={styles.image} />
            ) : (
                <View style={styles.placeholder}>
                    <Ionicons name="image-outline" size={48} color="#ccc" />
                    <Text style={{color: '#999', marginTop: 10}}>Select Image for Analysis</Text>
                </View>
            )}
        </View>

        <View style={styles.buttonRow}>
            <Button title="Pick Image" onPress={pickImage} />
            <View style={{ width: 20 }} />
            <Button title="Analyze Image" onPress={analyzeImage} disabled={!image || visionLoading} />
        </View>

        {visionLoading && <ActivityIndicator size="large" style={{marginTop: 20}} />}

        {result && (
            <View style={[styles.resultContainer, { 
                borderColor: result.alertLevel === 'CRITICAL' ? '#F44336' : result.alertLevel === 'WARNING' ? '#FF9800' : '#4CAF50',
                backgroundColor: result.alertLevel === 'CRITICAL' ? '#FFEBEE' : result.alertLevel === 'WARNING' ? '#FFF3E0' : '#E8F5E9'
            }]}>
                <View style={styles.resultHeader}>
                    <Text style={styles.resultTitle}>Analysis Result</Text>
                    <View style={[styles.badge, { backgroundColor: result.alertLevel === 'CRITICAL' ? '#F44336' : result.alertLevel === 'WARNING' ? '#FF9800' : '#4CAF50' }]}>
                        <Text style={styles.badgeText}>{result.alertLevel}</Text>
                    </View>
                </View>
                
                <Text style={styles.resultText}>Detected: <Text style={{fontWeight: 'bold'}}>{result.visionResult?.detectedClass.toUpperCase()}</Text></Text>
                <Text style={styles.resultText}>Confidence: <Text style={{fontWeight: 'bold'}}>{(result.visionResult?.confidence * 100).toFixed(1)}%</Text></Text>
                <Text style={styles.resultText}>Model: {result.visionResult?.modelType}</Text>
                
                {result.visionResult?.boundingBoxes && result.visionResult.boundingBoxes.length > 0 && (
                    <View style={{marginTop: 10}}>
                        <Text style={[styles.resultText, {fontWeight: 'bold', marginBottom: 5}]}>Detected Objects:</Text>
                        {result.visionResult.boundingBoxes.map((boxStr, index) => {
                            try {
                                const box = JSON.parse(boxStr); // Expecting [x, y, w, h, label]
                                return (
                                    <View key={index} style={styles.boxItem}>
                                        <Ionicons name="scan-outline" size={16} color="#555" />
                                        <Text style={styles.boxText}>
                                            {box[4]} at ({box[0]}, {box[1]}) - {box[2]}x{box[3]}
                                        </Text>
                                    </View>
                                );
                            } catch (e) {
                                return <Text key={index} style={styles.boxText}>{boxStr}</Text>;
                            }
                        })}
                    </View>
                )}
            </View>
        )}
      </View>

      <View style={styles.divider} />

      {/* Sensor Simulation Section */}
      <Text style={styles.sectionHeader}>IoT Sensor Simulation</Text>
      <View style={styles.card}>
        <Text style={styles.label}>1. Select Infrastructure</Text>
        <TouchableOpacity 
            style={styles.dropdown}
            onPress={() => setShowTransformerModal(true)}
        >
            <Text>{selectedTransformer ? (selectedTransformer.code || `ID: ${selectedTransformer.id}`) : 'Select Transformer...'}</Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>

        {selectedTransformer && (
            <>
                <Text style={styles.label}>2. Select Sensor</Text>
                <TouchableOpacity 
                    style={styles.dropdown}
                    onPress={() => setShowSensorModal(true)}
                >
                    <Text>{selectedSensor ? `${selectedSensor.sensorType} (ID: ${selectedSensor.id})` : 'Select Sensor...'}</Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
            </>
        )}

        {selectedSensor && (
            <>
                <Text style={styles.label}>3. Simulate Value</Text>
                
                {/* Coded Values */}
                {(selectedSensor.type || selectedSensor.sensorType || '').toLowerCase().includes('contact') ? (
                    <View style={styles.codedValuesContainer}>
                        <TouchableOpacity 
                            style={[styles.codedChip, { borderColor: '#4CAF50', backgroundColor: '#E8F5E9', flex: 1, marginHorizontal: 5 }]}
                            onPress={() => submitSensorReading('CLOSED')}
                            disabled={submittingSensor}
                        >
                            <Text style={{ color: '#2E7D32', fontWeight: 'bold', textAlign: 'center' }}>CLOSED (SAFE)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.codedChip, { borderColor: '#F44336', backgroundColor: '#FFEBEE', flex: 1, marginHorizontal: 5 }]}
                            onPress={() => submitSensorReading('OPEN')}
                            disabled={submittingSensor}
                        >
                            <Text style={{ color: '#C62828', fontWeight: 'bold', textAlign: 'center' }}>OPEN (CRITICAL)</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.codedValuesContainer}>
                        {codedValues.map(cv => (
                            <TouchableOpacity 
                                key={cv.value}
                                style={[styles.codedChip, { borderColor: cv.color }]}
                                onPress={() => submitSensorReading(cv.value)}
                                disabled={submittingSensor}
                            >
                                <Text style={{ color: cv.color, fontWeight: 'bold' }}>{cv.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <Text style={{textAlign: 'center', marginVertical: 10, color: '#999'}}>- OR -</Text>

                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <TextInput
                        style={[styles.input, {flex: 1, marginBottom: 0}]}
                        placeholder="Raw Value (e.g. 45.5)"
                        value={sensorValue}
                        onChangeText={setSensorValue}
                        keyboardType="numeric"
                    />
                    <TouchableOpacity 
                        style={[styles.sendButton, { opacity: submittingSensor ? 0.7 : 1 }]}
                        onPress={() => submitSensorReading()}
                        disabled={submittingSensor}
                    >
                        <Ionicons name="send" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>

                {submittingSensor && <ActivityIndicator style={{marginTop: 10}} />}

                {sensorResult && (
                    <View style={[styles.resultContainer, { marginTop: 20 }]}>
                         <View style={styles.resultHeader}>
                            <Text style={styles.resultTitle}>Simulation Status</Text>
                            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                        </View>
                        <Text style={styles.resultText}>{sensorResult.message}</Text>
                        <Text style={styles.resultText}>Alert Level: {sensorResult.alertLevel}</Text>
                    </View>
                )}
            </>
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
                          <View>
                            <Text style={styles.modalItemText}>{item.code || `Transformer #${item.id}`}</Text>
                            <Text style={styles.modalItemSub}>{item.region?.name} • {item.districts?.name}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color="#ccc" />
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
                           <View>
                            <Text style={styles.modalItemText}>{item.sensorType} Sensor</Text>
                            <Text style={styles.modalItemSub}>Device ID: {item.deviceId}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color="#ccc" />
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
    backgroundColor: '#f5f5f5',
  },
  dashboardCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  dashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dashboardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 10,
    fontFamily: 'Inter_700Bold',
  },
  dashboardMessage: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    fontFamily: 'Inter_700Bold',
  },
  subHeader: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#555',
    fontFamily: 'Inter_600SemiBold',
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
    color: '#666',
    fontFamily: 'Inter_500Medium',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  boxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    padding: 4,
    borderRadius: 4,
  },
  boxText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#444',
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 10,
  },
  imageContainer: {
    width: '100%',
    height: 220,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    overflow: 'hidden',
    borderStyle: 'dashed',
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
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  resultContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  resultText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#444',
  },
  modalContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    marginTop: 20,
  },
  modalItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalItemSub: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  modelSelector: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  modelChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedModelChip: {
    backgroundColor: '#0067A5',
    borderColor: '#005080',
  },
  modelChipText: {
    marginLeft: 6,
    fontWeight: '500',
    color: '#666',
  },
  selectedModelChipText: {
    color: '#fff',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  codedValuesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  codedChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  sendButton: {
    backgroundColor: '#0067A5',
    padding: 12,
    borderRadius: 8,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SimulationScreen;
