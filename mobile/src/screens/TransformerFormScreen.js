import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TextInput, 
    TouchableOpacity, 
    ScrollView, 
    ActivityIndicator, 
    Alert,
    KeyboardAvoidingView,
    Platform,
    Modal,
    Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import transformerService from '../services/transformer';

const SuccessModal = ({ visible, message, onClose }) => (
    <Modal
        animationType="fade"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
    >
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.successIconContainer}>
                    <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                </View>
                <Text style={styles.modalTitle}>Success!</Text>
                <Text style={styles.modalMessage}>{message}</Text>
                <TouchableOpacity style={styles.modalButton} onPress={onClose}>
                    <Text style={styles.modalButtonText}>Done</Text>
                </TouchableOpacity>
            </View>
        </View>
    </Modal>
);

const TransformerFormScreen = ({ route, navigation }) => {
    const { transformer, depotId, depotName } = route.params || {};
    const isEditing = !!transformer;
    
    const [formData, setFormData] = useState({
        name: '',
        capacity: '',
        lat: '',
        lng: '',
        isActive: true,
        depotId: depotId || '',
        depotName: depotName || '',
        type: 'POLE_MOUNTED'
    });
    const [submitting, setSubmitting] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        if (isEditing && transformer) {
            setFormData({
                name: transformer.name || '',
                capacity: String(transformer.capacity || ''),
                lat: String(transformer.lat || ''),
                lng: String(transformer.lng || ''),
                isActive: transformer.isActive ?? true,
                depotId: transformer.depotId || depotId || '',
                depotName: transformer.depotName || depotName || '',
                type: transformer.type || 'POLE_MOUNTED'
            });
            navigation.setOptions({ title: 'Edit Transformer' });
        } else {
            navigation.setOptions({ title: 'Add Transformer' });
        }
    }, [transformer, isEditing, navigation, depotId, depotName]);

    const handleSubmit = async () => {
        if (!formData.name) {
            Alert.alert('Validation Error', 'Transformer Name is required');
            return;
        }
        if (!formData.depotId) {
            Alert.alert('Validation Error', 'Depot ID is missing');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                capacity: parseInt(formData.capacity, 10) || 0,
                lat: parseFloat(formData.lat) || 0.0,
                lng: parseFloat(formData.lng) || 0.0
            };

            if (isEditing) {
                await transformerService.updateTransformer(transformer.id, payload);
                setSuccessMessage('Transformer updated successfully');
            } else {
                await transformerService.createTransformer(payload);
                setSuccessMessage('Transformer added successfully');
            }
            setShowSuccessModal(true);
        } catch (error) {
            console.error('Error saving transformer:', error);
            Alert.alert('Error', 'Failed to save transformer. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <SuccessModal 
                visible={showSuccessModal} 
                message={successMessage} 
                onClose={() => {
                    setShowSuccessModal(false);
                    navigation.goBack();
                }} 
            />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.formCard}>
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="flash" size={32} color="#0067A5" />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Transformer Name *</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.name}
                            onChangeText={(text) => setFormData({...formData, name: text})}
                            placeholder="e.g. TR-1234"
                            placeholderTextColor="#999"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Capacity (KVA)</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.capacity}
                            onChangeText={(text) => setFormData({...formData, capacity: text})}
                            placeholder="e.g. 100"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Transformer Type</Text>
                        <View style={styles.typeSelectorContainer}>
                            <TouchableOpacity 
                                style={[styles.typeOption, formData.type === 'POLE_MOUNTED' && styles.typeOptionSelected]}
                                onPress={() => setFormData({...formData, type: 'POLE_MOUNTED'})}
                            >
                                <Ionicons name="flash-outline" size={20} color={formData.type === 'POLE_MOUNTED' ? '#fff' : '#666'} />
                                <Text style={[styles.typeOptionText, formData.type === 'POLE_MOUNTED' && styles.typeOptionTextSelected]}>Pole Mounted</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.typeOption, formData.type === 'GROUND_MOUNTED' && styles.typeOptionSelected]}
                                onPress={() => setFormData({...formData, type: 'GROUND_MOUNTED'})}
                            >
                                <Ionicons name="home-outline" size={20} color={formData.type === 'GROUND_MOUNTED' ? '#fff' : '#666'} />
                                <Text style={[styles.typeOptionText, formData.type === 'GROUND_MOUNTED' && styles.typeOptionTextSelected]}>Ground Mounted</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>Latitude</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.lat}
                                onChangeText={(text) => setFormData({...formData, lat: text})}
                                placeholder="-17.82"
                                placeholderTextColor="#999"
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Longitude</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.lng}
                                onChangeText={(text) => setFormData({...formData, lng: text})}
                                placeholder="31.05"
                                placeholderTextColor="#999"
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <View style={styles.switchContainer}>
                            <Text style={styles.label}>Active Status</Text>
                            <Switch
                                trackColor={{ false: "#767577", true: "#81b0ff" }}
                                thumbColor={formData.isActive ? "#0067A5" : "#f4f3f4"}
                                ios_backgroundColor="#3e3e3e"
                                onValueChange={(value) => setFormData({...formData, isActive: value})}
                                value={formData.isActive}
                            />
                        </View>
                        <Text style={styles.helperText}>{formData.isActive ? 'Transformer is currently active' : 'Transformer is under maintenance/inactive'}</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.submitButton, submitting && styles.disabledButton]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <Ionicons name={isEditing ? "save-outline" : "add-circle-outline"} size={20} color="#fff" />
                                <Text style={styles.submitButtonText}>
                                    {isEditing ? 'Update Transformer' : 'Add Transformer'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    scrollContent: {
        padding: 16,
    },
    formCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    header: {
        alignItems: 'center',
        marginBottom: 16,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#E1F5FE',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    inputGroup: {
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 8,
        fontSize: 15,
        color: '#1F2937',
    },
    typeSelectorContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    typeOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
        gap: 8,
    },
    typeOptionSelected: {
        backgroundColor: '#0067A5',
        borderColor: '#0067A5',
    },
    typeOptionText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666',
    },
    typeOptionTextSelected: {
        color: '#fff',
    },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    helperText: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 4,
    },
    submitButton: {
        flexDirection: 'row',
        backgroundColor: '#0067A5',
        paddingVertical: 12,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#0067A5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    disabledButton: {
        opacity: 0.7,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
        width: '100%',
        maxWidth: 340,
    },
    successIconContainer: {
        marginBottom: 16,
        transform: [{ scale: 1.1 }],
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    modalButton: {
        backgroundColor: '#0067A5',
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#0067A5',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    modalButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default TransformerFormScreen;
