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
    Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import infrastructureService from '../services/infrastructure';

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

const RegionFormScreen = ({ route, navigation }) => {
    const { region } = route.params || {};
    const isEditing = !!region;
    
    const [formData, setFormData] = useState({
        name: ''
    });
    
    const [submitting, setSubmitting] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        if (isEditing && region) {
            setFormData({
                name: region.name || ''
            });
            navigation.setOptions({ title: 'Edit Region' });
        } else {
            navigation.setOptions({ title: 'Add Region' });
        }
    }, [region, isEditing, navigation]);

    const handleSubmit = async () => {
        if (!formData.name) {
            Alert.alert('Validation Error', 'Region Name is required');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                name: formData.name
            };

            if (isEditing) {
                await infrastructureService.updateRegion(region.id, payload);
                setSuccessMessage('Region updated successfully');
            } else {
                await infrastructureService.createRegion(payload);
                setSuccessMessage('Region added successfully');
            }
            setShowSuccessModal(true);
        } catch (error) {
            console.error('Error saving region:', error);
            Alert.alert('Error', 'Failed to save region. Please try again.');
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
                            <Ionicons name="map" size={32} color="#0067A5" />
                        </View>
                        <Text style={styles.headerTitle}>
                            {isEditing ? 'Edit Region Details' : 'New Region Details'}
                        </Text>
                        <Text style={styles.headerSubtitle}>
                            {isEditing ? 'Update the region information below' : 'Enter the details for the new region'}
                        </Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Region Name *</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.name}
                            onChangeText={(text) => setFormData({...formData, name: text})}
                            placeholder="e.g. Northern Region"
                            placeholderTextColor="#999"
                        />
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
                                    {isEditing ? 'Update Region' : 'Add Region'}
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
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#f0f9ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#111827',
    },
    submitButton: {
        backgroundColor: '#0067A5',
        borderRadius: 8,
        paddingVertical: 14,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    disabledButton: {
        backgroundColor: '#9CA3AF',
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
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '80%',
        maxWidth: 400
    },
    successIconContainer: {
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 10,
    },
    modalMessage: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
    },
    modalButton: {
        backgroundColor: '#0067A5',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 30,
        elevation: 2,
    },
    modalButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    }
});

export default RegionFormScreen;
