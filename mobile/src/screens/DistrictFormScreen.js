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

const DistrictFormScreen = ({ route, navigation }) => {
    const { district, regionId } = route.params || {};
    const isEditing = !!district;
    
    const [formData, setFormData] = useState({
        name: '',
        regionId: regionId || ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        if (isEditing && district) {
            setFormData({
                name: district.name || '',
                regionId: district.regionId || regionId || ''
            });
            navigation.setOptions({ title: 'Edit District' });
        } else {
            navigation.setOptions({ title: 'Add District' });
        }
    }, [district, isEditing, navigation, regionId]);

    const handleSubmit = async () => {
        if (!formData.name) {
            Alert.alert('Validation Error', 'District Name is required');
            return;
        }
        if (!formData.regionId) {
            Alert.alert('Validation Error', 'Region ID is missing');
            return;
        }

        setSubmitting(true);
        try {
            if (isEditing) {
                await infrastructureService.updateDistrict(district.id, formData);
                setSuccessMessage('District updated successfully');
            } else {
                await infrastructureService.createDistrict(formData);
                setSuccessMessage('District added successfully');
            }
            setShowSuccessModal(true);
        } catch (error) {
            console.error('Error saving district:', error);
            Alert.alert('Error', 'Failed to save district. Please try again.');
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
                            <Ionicons name="business" size={32} color="#0067A5" />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>District Name *</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.name}
                            onChangeText={(text) => setFormData({...formData, name: text})}
                            placeholder="e.g. Central District"
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
                                    {isEditing ? 'Update District' : 'Add District'}
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
    label: {
        fontSize: 13,
        fontFamily: 'Inter_600SemiBold',
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
        fontFamily: 'Inter_400Regular',
        color: '#1F2937',
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
        fontFamily: 'Inter_600SemiBold',
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
        fontFamily: 'Inter_700Bold',
        color: '#111827',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 15,
        fontFamily: 'Inter_400Regular',
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
        fontFamily: 'Inter_600SemiBold',
    },
});

export default DistrictFormScreen;
