import React, { useState, useEffect } from 'react';
import { View, Text, Button, Image, StyleSheet, ScrollView, Alert, ActivityIndicator, TextInput, TouchableOpacity, Modal, FlatList, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import config from '../config';
import transformerService from '../services/transformer';
import sensorService from '../services/sensor';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const SimulationScreen = () => {
  // State
  const [transformers, setTransformers] = useState([]);
  const [selectedTransformer, setSelectedTransformer] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showTransformerModal, setShowTransformerModal] = useState(false);
  
  // Sensor Options Modal State
  const [showSensorOptionModal, setShowSensorOptionModal] = useState(false);
  const [currentSensorOptions, setCurrentSensorOptions] = useState([]);
  const [currentSensorId, setCurrentSensorId] = useState(null);
  
  // Sensor Inputs State (Map: sensorId -> value)
  const [sensorValues, setSensorValues] = useState({});
  const [simulationResults, setSimulationResults] = useState({});

  // Vision AI State
  const [image, setImage] = useState(null);
  const [visionResult, setVisionResult] = useState(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('general');

  const models = [
    { id: 'general', name: 'General', icon: 'shield-checkmark' },
    { id: 'fire', name: 'Fire', icon: 'flame' },
    { id: 'defect', name: 'Defect', icon: 'construct' },
    { id: 'door', name: 'Door', icon: 'log-in-outline' },
  ];

  useEffect(() => {
    fetchTransformers();
  }, []);

  const fetchTransformers = async () => {
    setLoading(true);
    try {
      const data = await transformerService.getAllTransformers();
      // Limit to first 5 as requested
      setTransformers(data.slice(0, 5));
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load transformers');
    } finally {
      setLoading(false);
    }
  };

  const handleTransformerSelect = async (transformer) => {
    setSelectedTransformer(transformer);
    setShowTransformerModal(false);
    setSensors([]);
    setSensorValues({});
    setSimulationResults({});
    setImage(null);
    setVisionResult(null);
    
    setLoading(true);
    try {
      const data = await sensorService.getSensorsByTransformer(transformer.id);
      setSensors(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load sensors');
    } finally {
      setLoading(false);
    }
  };

  const handleSensorValueChange = (sensorId, value) => {
    setSensorValues(prev => ({ ...prev, [sensorId]: value }));
  };

  const openSensorModal = (sensorId, options) => {
    setCurrentSensorId(sensorId);
    setCurrentSensorOptions(options);
    setShowSensorOptionModal(true);
  };

  const handleSensorOptionSelect = (value) => {
    if (currentSensorId) {
        handleSensorValueChange(currentSensorId, value);
    }
    setShowSensorOptionModal(false);
  };

  const submitSensorSimulation = async (sensor) => {
    const value = sensorValues[sensor.id];
    if (value === undefined || value === null || value === '') {
      Alert.alert('Required', 'Please enter or select a value to simulate');
      return;
    }

    try {
      const payload = {
        sensorId: sensor.id,
        sensorType: sensor.sensorType
      };

      // Determine if coded or raw based on input type/sensor type
      // Simple heuristic: if value is string and uppercase (like OPEN, CLOSED), it's coded.
      // If numeric, raw.
      
      if (typeof value === 'string' && isNaN(value)) {
         payload.codedValue = value;
      } else {
         payload.rawValue = parseFloat(value);
      }

      const response = await api.post('/api/v1/simulation/sensor', payload);
      setSimulationResults(prev => ({ 
        ...prev, 
        [sensor.id]: { success: true, message: `Simulated: ${response.data.alertLevel}` } 
      }));
      
      // Auto-clear success message after 3s
      setTimeout(() => {
        setSimulationResults(prev => {
            const newState = { ...prev };
            delete newState[sensor.id];
            return newState;
        });
      }, 3000);

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Simulation failed');
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setVisionResult(null);
    }
  };

  const processCameraImage = async () => {
    if (!image || !selectedTransformer) return;
    setVisionLoading(true);
    setVisionResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: image,
        name: 'simulation.jpg',
        type: 'image/jpeg',
      });
      formData.append('transformerId', selectedTransformer.id);
      formData.append('modelType', selectedModel);

      // Use the new endpoint that triggers full pipeline
      const response = await api.post('/api/v1/simulation/camera-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setVisionResult(response.data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to process camera image');
    } finally {
      setVisionLoading(false);
    }
  };

  const renderSensorInput = (sensor) => {
    // Handle inconsistencies and normalize to uppercase for robust matching
    const rawType = sensor.sensorType || sensor.type || '';
    const type = rawType.toString().toUpperCase();
    const currentVal = sensorValues[sensor.id];

    // Check for Contact/Door types (including partial matches like "CONTACT", "DOOR_SENSOR", etc.)
    if (type.includes('CONTACT') || type.includes('DOOR')) {
        return (
            <TouchableOpacity 
                style={styles.dropdown}
                onPress={() => openSensorModal(sensor.id, ['closed', 'open'])}
            >
                <Text style={styles.dropdownText}>
                    {currentVal ? currentVal.toUpperCase() : 'Select Status'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
        );
    } else if (type.includes('MOTION')) {
        return (
            <TouchableOpacity 
                style={styles.dropdown}
                onPress={() => openSensorModal(sensor.id, ['vacant', 'occupied'])}
            >
                <Text style={styles.dropdownText}>
                    {currentVal ? currentVal.toUpperCase() : 'Select Status'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
        );
    } else {
        // Temperature, Oil Level, etc. -> Numeric Input
        return (
            <View style={styles.inputRow}>
                <TextInput 
                    style={styles.input}
                    placeholder={`Enter ${rawType} value`}
                    keyboardType="numeric"
                    value={currentVal}
                    onChangeText={(text) => handleSensorValueChange(sensor.id, text)}
                />
            </View>
        );
    }
  };

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: '#F5F7FA'}}>
      <ScrollView contentContainerStyle={styles.container}>
        
        <Text style={styles.headerTitle}>Enterprise Simulation</Text>
        
        {/* 1. Transformer Selection */}
        <View style={styles.card}>
            <Text style={styles.label}>Select Transformer</Text>
            <TouchableOpacity 
                style={styles.dropdown}
                onPress={() => setShowTransformerModal(true)}
            >
                <Text style={styles.dropdownText}>
                    {selectedTransformer ? selectedTransformer.name : 'Choose a Transformer...'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
        </View>

        {selectedTransformer && (
            <>
                {/* 2. Sensors List */}
                <Text style={styles.sectionHeader}>Sensor Simulation</Text>
                {loading ? <ActivityIndicator /> : sensors.length === 0 ? (
                    <Text style={styles.emptyText}>No sensors found for this transformer.</Text>
                ) : (
                    sensors.map(sensor => (
                        <View key={sensor.id} style={styles.sensorCard}>
                            <View style={styles.sensorHeader}>
                                <Ionicons name="hardware-chip-outline" size={20} color="#2196F3" />
                                <Text style={styles.sensorName}>{sensor.type} ({sensor.sensorId})</Text>
                            </View>
                            
                            {renderSensorInput(sensor)}
                            
                            <TouchableOpacity 
                                style={styles.simulateBtn}
                                onPress={() => submitSensorSimulation(sensor)}
                            >
                                <Text style={styles.simulateBtnText}>Simulate Reading</Text>
                            </TouchableOpacity>

                            {simulationResults[sensor.id] && (
                                <Text style={styles.successText}>
                                    <Ionicons name="checkmark-circle" /> {simulationResults[sensor.id].message}
                                </Text>
                            )}
                        </View>
                    ))
                )}

                {/* 3. Camera/AI Simulation */}
                <Text style={styles.sectionHeader}>Camera & AI Simulation</Text>
                <View style={styles.card}>
                    <Text style={styles.subHeader}>Simulate Camera Event</Text>
                    <Text style={styles.helperText}>
                        Upload an image to simulate a live feed from this transformer's camera. 
                        This will trigger the full AI analysis and alert pipeline.
                    </Text>

                    {/* Model Selector */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modelSelector}>
                        {models.map(model => (
                            <TouchableOpacity 
                                key={model.id} 
                                style={[styles.modelChip, selectedModel === model.id && styles.selectedModelChip]}
                                onPress={() => setSelectedModel(model.id)}
                            >
                                <Ionicons name={model.icon} size={16} color={selectedModel === model.id ? '#fff' : '#666'} />
                                <Text style={[styles.modelChipText, selectedModel === model.id && styles.selectedModelChipText]}>{model.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Image Picker */}
                    <TouchableOpacity onPress={pickImage} style={styles.imagePlaceholder}>
                        {image ? (
                            <Image source={{ uri: image }} style={styles.previewImage} />
                        ) : (
                            <View style={styles.uploadArea}>
                                <Ionicons name="cloud-upload-outline" size={40} color="#2196F3" />
                                <Text style={styles.uploadText}>Tap to Upload Image</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.processBtn, (!image || visionLoading) && styles.disabledBtn]}
                        onPress={processCameraImage}
                        disabled={!image || visionLoading}
                    >
                        {visionLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.processBtnText}>Process & Generate Alert</Text>
                        )}
                    </TouchableOpacity>

                    {/* Vision Result */}
                    {visionResult && (
                        <View style={[styles.resultBox, { 
                            borderColor: visionResult.alertLevel === 'CRITICAL' ? '#F44336' : '#4CAF50',
                            backgroundColor: visionResult.alertLevel === 'CRITICAL' ? '#FFEBEE' : '#E8F5E9'
                        }]}>
                            <Text style={styles.resultTitle}>
                                {visionResult.alertLevel === 'CRITICAL' ? '⚠️ THREAT DETECTED' : '✅ SYSTEM SECURE'}
                            </Text>
                            <Text style={styles.resultDetail}>
                                Detected: {visionResult.visionResult?.detectedClass?.toUpperCase()}
                            </Text>
                            <Text style={styles.resultDetail}>
                                Confidence: {(visionResult.visionResult?.confidence * 100).toFixed(1)}%
                            </Text>
                            <Text style={styles.resultNote}>Alert saved & Notifications trigger initiated.</Text>
                        </View>
                    )}
                </View>
            </>
        )}

        <View style={{height: 40}} />
      </ScrollView>

      {/* Sensor Option Selection Modal */}
      <Modal visible={showSensorOptionModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Value</Text>
                <FlatList
                    data={currentSensorOptions}
                    keyExtractor={item => item}
                    renderItem={({item}) => (
                        <TouchableOpacity 
                            style={styles.modalItem}
                            onPress={() => handleSensorOptionSelect(item)}
                        >
                            <Ionicons name="radio-button-on" size={20} color="#2196F3" />
                            <View style={{marginLeft: 10}}>
                                <Text style={styles.modalItemText}>{item.toUpperCase()}</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                />
                <Button title="Cancel" onPress={() => setShowSensorOptionModal(false)} color="#666" />
            </View>
        </View>
      </Modal>

      {/* Transformer Selection Modal */}
      <Modal visible={showTransformerModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Transformer</Text>
                <FlatList
                    data={transformers}
                    keyExtractor={item => item.id.toString()}
                    renderItem={({item}) => (
                        <TouchableOpacity 
                            style={styles.modalItem}
                            onPress={() => handleTransformerSelect(item)}
                        >
                            <Ionicons name="flash" size={20} color="#FF9800" />
                            <View style={{marginLeft: 10}}>
                                <Text style={styles.modalItemText}>{item.name}</Text>
                                <Text style={styles.modalItemSub}>{item.location || 'Unknown Location'}</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                />
                <Button title="Cancel" onPress={() => setShowTransformerModal(false)} color="#666" />
            </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#1a1a1a', fontFamily: 'Inter_700Bold' },
  sectionHeader: { fontSize: 16, fontWeight: '600', marginTop: 24, marginBottom: 12, color: '#333', fontFamily: 'Inter_600SemiBold' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  label: { fontSize: 12, color: '#666', marginBottom: 8, fontFamily: 'Inter_500Medium' },
  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, backgroundColor: '#F9FAFB' },
  dropdownText: { fontSize: 14, color: '#333', fontFamily: 'Inter_400Regular' },
  
  // Sensor Card
  sensorCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#2196F3', elevation: 1 },
  sensorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sensorName: { marginLeft: 8, fontSize: 14, fontWeight: '600', color: '#333' },
  inputRow: { marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#F9FAFB' },
  segmentBtn: { flex: 1, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ddd', marginHorizontal: 2, borderRadius: 6 },
  segmentBtnActive: { backgroundColor: '#E3F2FD', borderColor: '#2196F3' },
  segmentText: { fontSize: 12, color: '#666', fontWeight: '600' },
  segmentTextActive: { color: '#2196F3' },
  simulateBtn: { backgroundColor: '#2196F3', padding: 12, borderRadius: 8, alignItems: 'center' },
  simulateBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  successText: { color: '#4CAF50', marginTop: 8, fontSize: 11, fontWeight: '600' },

  // Camera Section
  subHeader: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },
  helperText: { fontSize: 11, color: '#666', marginBottom: 16, lineHeight: 18 },
  modelSelector: { flexDirection: 'row', marginBottom: 16 },
  modelChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#eee', marginRight: 8 },
  selectedModelChip: { backgroundColor: '#2196F3' },
  modelChipText: { marginLeft: 6, fontSize: 11, color: '#666', fontWeight: '500' },
  selectedModelChipText: { color: '#fff' },
  imagePlaceholder: { width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F0F0F0', marginBottom: 16, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed' },
  uploadArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  uploadText: { marginTop: 10, color: '#666', fontWeight: '500', fontSize: 12 },
  previewImage: { width: '100%', height: '100%' },
  processBtn: { backgroundColor: '#673AB7', padding: 16, borderRadius: 12, alignItems: 'center', elevation: 3 },
  disabledBtn: { backgroundColor: '#ccc', elevation: 0 },
  processBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  resultBox: { marginTop: 16, padding: 16, borderRadius: 8, borderWidth: 1 },
  resultTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#333' },
  resultDetail: { fontSize: 12, color: '#444', marginBottom: 4 },
  resultNote: { fontSize: 11, color: '#666', fontStyle: 'italic', marginTop: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  modalItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalItemText: { fontSize: 14, fontWeight: '600', color: '#333' },
  modalItemSub: { fontSize: 11, color: '#999' },
  emptyText: { textAlign: 'center', color: '#999', marginVertical: 20, fontStyle: 'italic' }
});

export default SimulationScreen;