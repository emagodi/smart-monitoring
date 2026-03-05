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
    FlatList
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

const SelectorModal = ({ visible, title, options, onSelect, onClose, loading, onSearch }) => {
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (visible) setSearchQuery('');
    }, [visible]);

    const handleSearch = (text) => {
        setSearchQuery(text);
        if (onSearch) onSearch(text);
    };

    const filteredOptions = options.filter(opt => 
        opt.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.selectorModalOverlay}>
                <View style={styles.selectorModalContent}>
                    <View style={styles.selectorHeader}>
                        <Text style={styles.selectorTitle}>{title}</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="#9CA3AF" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search..."
                            value={searchQuery}
                            onChangeText={handleSearch}
                        />
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color="#0067A5" style={{ marginTop: 20 }} />
                    ) : (
                        <FlatList
                            data={filteredOptions}
                            keyExtractor={item => String(item.id)}
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    style={styles.optionItem}
                                    onPress={() => onSelect(item)}
                                >
                                    <Text style={styles.optionText}>{item.name}</Text>
                                    <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>No options found</Text>
                            }
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
};

const DistrictFormScreen = ({ route, navigation }) => {
    const { district, regionId } = route.params || {};
    const isEditing = !!district;
    
    const [formData, setFormData] = useState({
        name: '',
        regionId: regionId || ''
    });
    const [regionName, setRegionName] = useState('');
    
    const [submitting, setSubmitting] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Selector State
    const [regions, setRegions] = useState([]);
    const [loadingRegions, setLoadingRegions] = useState(false);
    const [showRegionSelector, setShowRegionSelector] = useState(false);

    useEffect(() => {
        if (isEditing && district) {
            setFormData({
                name: district.name || '',
                regionId: district.regionId || regionId || ''
            });
            // Try to set region name if available, otherwise we might need to fetch it
            // Assuming district object has regionName or we just show ID for now if name missing
            setRegionName(district.regionName || (district.region ? district.region.name : ''));
            
            navigation.setOptions({ title: 'Edit District' });
        } else {
            navigation.setOptions({ title: 'Add District' });
        }
        
        fetchRegions();
    }, [district, isEditing, navigation, regionId]);

    const fetchRegions = async () => {
        setLoadingRegions(true);
        try {
            const result = await infrastructureService.getAllRegions(0, 100, ''); // Fetch all/many
            if (result && result.content) {
                setRegions(result.content);
                // If editing and we have regionId but no name, try to find it
                if (isEditing && district && district.regionId && !regionName) {
                    const r = result.content.find(r => r.id === district.regionId);
                    if (r) setRegionName(r.name);
                }
            } else if (Array.isArray(result)) {
                setRegions(result);
                 if (isEditing && district && district.regionId && !regionName) {
                    const r = result.find(r => r.id === district.regionId);
                    if (r) setRegionName(r.name);
                }
            }
        } catch (error) {
            console.error('Error fetching regions:', error);
            Alert.alert('Error', 'Failed to load regions');
        } finally {
            setLoadingRegions(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.name) {
            Alert.alert('Validation Error', 'District Name is required');
            return;
        }
        if (!formData.regionId) {
            Alert.alert('Validation Error', 'Region is required');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                name: formData.name,
                regionId: parseInt(formData.regionId, 10)
            };

            if (isEditing) {
                await infrastructureService.updateDistrict(district.id, payload);
                setSuccessMessage('District updated successfully');
            } else {
                await infrastructureService.createDistrict(payload);
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
            
            <SelectorModal
                visible={showRegionSelector}
                title="Select Region"
                options={regions}
                loading={loadingRegions}
                onClose={() => setShowRegionSelector(false)}
                onSelect={(item) => {
                    setFormData({ ...formData, regionId: item.id });
                    setRegionName(item.name);
                    setShowRegionSelector(false);
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

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Region *</Text>
                        <TouchableOpacity 
                            style={styles.selectorButton}
                            onPress={() => setShowRegionSelector(true)}
                        >
                            <Text style={[styles.selectorText, !regionName && styles.placeholderText]}>
                                {regionName || 'Select Region'}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color="#6B7280" />
                        </TouchableOpacity>
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
        paddingVertical: 12, // Increased for better touch target
        fontSize: 15,
        color: '#1F2937',
    },
    selectorButton: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    selectorText: {
        fontSize: 15,
        color: '#1F2937',
    },
    placeholderText: {
        color: '#999',
    },
    submitButton: {
        flexDirection: 'row',
        backgroundColor: '#0067A5',
        paddingVertical: 14, // Increased
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '80%',
        alignItems: 'center',
        elevation: 5,
    },
    successIconContainer: {
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    modalMessage: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
    },
    modalButton: {
        backgroundColor: '#0067A5',
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 10,
    },
    modalButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    // Selector Modal Styles
    selectorModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end', // Bottom sheet style
    },
    selectorModalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '70%', // Take up 70% of screen
        padding: 20,
    },
    selectorHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    selectorTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 15,
        color: '#1F2937',
    },
    optionItem: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    optionText: {
        fontSize: 16,
        color: '#374151',
    },
    emptyText: {
        textAlign: 'center',
        color: '#6B7280',
        marginTop: 20,
    },
});

export default DistrictFormScreen;