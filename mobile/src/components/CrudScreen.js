import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

const GOOGLE_API_KEY = 'AIzaSyBJOkU9Iv88i6h8-hxjSN1wLUYCITmkOQQ';

const CrudScreen = ({
    title,
    subtitle,
    fetchData,
    createItem,
    updateItem,
    deleteItem,
    fields, // Array of { name, label, type, placeholder, required }
    itemTitleKey = 'name', // Key to display as main title in list
    itemSubtitleKey = 'id', // Key to display as subtitle
    renderCustomItem = null,
    transformDataBeforeSubmit = null, // Function to transform data before create/update
    addButtonLabel, // Label for the add button
    entityName = 'Item', // Name of the entity being managed (e.g., 'Region', 'District')
    onBack = null // Optional back handler
}) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isPagination, setIsPagination] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Selector Modal State
    const [selectorVisible, setSelectorVisible] = useState(false);
    const [currentSelectorField, setCurrentSelectorField] = useState(null);
    const [selectorOptions, setSelectorOptions] = useState([]);
    const [selectorSearchQuery, setSelectorSearchQuery] = useState('');
    const [selectorLoading, setSelectorLoading] = useState(false);

    // Success Modal State
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [successType, setSuccessType] = useState('create'); // 'create', 'update', 'delete'
    
    // Delete Modal State
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);


    // Map Modal State
    const [mapModalVisible, setMapModalVisible] = useState(false);
    const [mapLocation, setMapLocation] = useState({ latitude: -17.82, longitude: 31.05 });
    const [currentMapField, setCurrentMapField] = useState(null);
    const mapRef = useRef(null);

    const handleOpenMap = (field) => {
        setCurrentMapField(field);
        let lat = -17.82;
        let lng = 31.05;

        if (field.latField && field.lngField) {
            lat = parseFloat(formData[field.latField]) || -17.82;
            lng = parseFloat(formData[field.lngField]) || 31.05;
        }

        setMapLocation({ latitude: lat, longitude: lng });
        setMapModalVisible(true);
    };

    const handleConfirmLocation = () => {
        if (currentMapField) {
            const updates = {};
            if (currentMapField.latField) updates[currentMapField.latField] = String(mapLocation.latitude);
            if (currentMapField.lngField) updates[currentMapField.lngField] = String(mapLocation.longitude);
            
            updates[currentMapField.name] = `${mapLocation.latitude.toFixed(6)}, ${mapLocation.longitude.toFixed(6)}`;

            setFormData({ ...formData, ...updates });
            setMapModalVisible(false);
        }
    };

    const loadData = async (nextPage = 0, shouldAppend = false) => {
        if (!shouldAppend) setLoading(true);
        else setLoadingMore(true);

        try {
            const result = await fetchData(nextPage, 10, searchQuery);
            
            let newItems = [];
            let isPaged = false;
            let moreAvailable = false;

            if (result && result.content && Array.isArray(result.content)) {
                // Paginated response
                isPaged = true;
                newItems = result.content;
                moreAvailable = !result.last;
            } else if (Array.isArray(result)) {
                // Regular array response
                newItems = result;
                moreAvailable = false;
            }

            if (shouldAppend) {
                setData(prev => [...prev, ...newItems]);
            } else {
                setData(newItems);
            }

            setIsPagination(isPaged);
            setHasMore(moreAvailable);
            setPage(nextPage);

        } catch (error) {
            console.error('Error fetching data:', error);
            Alert.alert('Error', 'Failed to load data');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            loadData(0, false);
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);
    
    // Selector Logic
    const handleOpenSelector = async (field) => {
        setCurrentSelectorField(field);
        setSelectorSearchQuery('');
        setSelectorVisible(true);
        setSelectorLoading(true);
        try {
            // Initial fetch for selector
            if (field.fetchOptions) {
                const result = await field.fetchOptions(0, 20, '');
                let options = [];
                if (result && result.content) options = result.content;
                else if (Array.isArray(result)) options = result;
                setSelectorOptions(options);
            }
        } catch (error) {
            console.error('Error loading selector options:', error);
            Alert.alert('Error', 'Failed to load options');
        } finally {
            setSelectorLoading(false);
        }
    };
    
    const handleSelectorSearchDebounced = async (text) => {
         if (!currentSelectorField || !currentSelectorField.fetchOptions) return;
         setSelectorLoading(true);
         try {
             const result = await currentSelectorField.fetchOptions(0, 20, text);
             let options = [];
             if (result && result.content) options = result.content;
             else if (Array.isArray(result)) options = result;
             setSelectorOptions(options);
         } catch (error) {
             console.error('Error searching options:', error);
         } finally {
             setSelectorLoading(false);
         }
    };

    useEffect(() => {
        if (selectorVisible) {
            const delay = setTimeout(() => {
                handleSelectorSearchDebounced(selectorSearchQuery);
            }, 500);
            return () => clearTimeout(delay);
        }
    }, [selectorSearchQuery, selectorVisible]);

    const handleSelectOption = (option) => {
        if (currentSelectorField) {
            setFormData({
                ...formData,
                [currentSelectorField.name]: option[currentSelectorField.valueKey || 'id']
            });
            // Update label map if we want to show name instead of ID
            // For now, we rely on the option being in the list if we re-open, 
            // but for the main form input display, we need to handle it.
            // We can store a separate "labels" state or just use the formData.
            // Let's store it in a special labels object in formData? No, cleaner to use separate state.
            setSelectorLabels(prev => ({
                ...prev,
                [currentSelectorField.name]: option[currentSelectorField.displayKey || 'name']
            }));
            setSelectorVisible(false);
        }
    };
    
    const [selectorLabels, setSelectorLabels] = useState({});

    const handleLoadMore = () => {
        if (hasMore && !loadingMore && isPagination) {
            loadData(page + 1, true);
        }
    };

    const handleOpenCreate = () => {
        setEditingItem(null);
        const initialData = {};
        fields.forEach(field => initialData[field.name] = '');
        setFormData(initialData);
        setModalVisible(true);
    };

    const handleOpenEdit = (item) => {
        setEditingItem(item);
        const initialData = {};
        const initialLabels = {};
        fields.forEach(field => {
            // Handle nested objects if needed (e.g., region.id)
            if (field.name.includes('.')) {
                const parts = field.name.split('.');
                initialData[field.name] = item[parts[0]]?.[parts[1]] || '';
            } else {
                initialData[field.name] = String(item[field.name] || '');
            }

            if (field.type === 'selector' && field.labelKey) {
                initialLabels[field.name] = item[field.labelKey] || '';
            }

            if (field.type === 'location') {
                if (field.latField) initialData[field.latField] = String(item[field.latField] || '');
                if (field.lngField) initialData[field.lngField] = String(item[field.lngField] || '');
                
                if (item[field.latField] && item[field.lngField]) {
                     initialData[field.name] = `${item[field.latField]}, ${item[field.lngField]}`;
                }
            }
        });
        setFormData(initialData);
        setSelectorLabels(initialLabels);
        setModalVisible(true);
    };

    const handleSubmit = async () => {
        // Validation
        for (const field of fields) {
            if (field.required && !formData[field.name]) {
                Alert.alert('Validation', `${field.label} is required`);
                return;
            }
        }

        setSubmitting(true);
        try {
            let dataToSubmit = { ...formData };
            if (transformDataBeforeSubmit) {
                dataToSubmit = transformDataBeforeSubmit(dataToSubmit, editingItem, selectorLabels);
            }

            if (editingItem) {
                await updateItem(editingItem.id, dataToSubmit);
                setSuccessMessage(`${entityName} updated successfully`);
                setSuccessType('update');
            } else {
                await createItem(dataToSubmit);
                setSuccessMessage(`${entityName} created successfully`);
                setSuccessType('create');
            }
            setModalVisible(false);
            setSuccessModalVisible(true); // Show success modal
            loadData(0, false); // Reload from scratch
        } catch (error) {
            console.error('Error saving item:', error);
            Alert.alert('Error', 'Failed to save item');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (item) => {
        setItemToDelete(item);
        setDeleteModalVisible(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        
        setDeleting(true);
        try {
            await deleteItem(itemToDelete.id);
            setDeleteModalVisible(false);
            setSuccessMessage(`${entityName} deleted successfully`);
            setSuccessType('delete');
            setSuccessModalVisible(true);
            loadData(0, false);
        } catch (error) {
            console.error('Error deleting item:', error);
            Alert.alert('Error', 'Failed to delete item');
        } finally {
            setDeleting(false);
            setItemToDelete(null);
        }
    };

    const renderItem = ({ item }) => {
        if (renderCustomItem) {
            return renderCustomItem(item, () => handleOpenEdit(item), () => handleDelete(item));
        }

        return (
            <View style={styles.card}>
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item[itemTitleKey]}</Text>
                    {/* Render other fields as details */}
                    {fields.map(field => {
                        if (field.name !== itemTitleKey && field.name !== 'id' && !field.hiddenInList) {
                            // Handle nested values for display
                            let value = item[field.name];
                            if (field.name.includes('.')) {
                                const parts = field.name.split('.');
                                value = item[parts[0]]?.[parts[1]];
                            }
                            return (
                                <Text key={field.name} style={styles.cardDetail}>
                                    {field.label}: {value}
                                </Text>
                            );
                        }
                        return null;
                    })}
                </View>
                <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => handleOpenEdit(item)} style={styles.actionButton}>
                        <Ionicons name="create-outline" size={24} color="#0067A5" />
                    </TouchableOpacity>
                    {deleteItem && (
                    <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}>
                        <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                    </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.contentContainer}>
                <View style={styles.topBar}>
                    {onBack && (
                        <TouchableOpacity onPress={onBack} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#0067A5" />
                        </TouchableOpacity>
                    )}
                     <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={`Search ${title}...`}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                     </View>
                     {createItem && (
                        <TouchableOpacity onPress={handleOpenCreate} style={styles.addButtonSmall}>
                            <Ionicons name="add" size={24} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.headerContainer}>
                    {title ? <Text style={styles.headerTitle}>{title}</Text> : null}
                    {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
                </View>

                {loading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color="#0067A5" />
                    </View>
                ) : (
                    <FlatList
                        data={data}
                        renderItem={renderItem}
                        keyExtractor={item => String(item.id)}
                        contentContainerStyle={styles.listContent}
                        refreshing={loading}
                        onRefresh={() => loadData(0, false)}
                        ListEmptyComponent={
                            <View style={styles.centered}>
                                <Text style={styles.emptyText}>No items found</Text>
                            </View>
                        }
                        ListFooterComponent={() => (
                            <View style={styles.footer}>
                                {loadingMore && <ActivityIndicator size="small" color="#0067A5" />}
                                {hasMore && !loadingMore && isPagination && (
                                    <TouchableOpacity onPress={handleLoadMore} style={styles.loadMoreButton}>
                                        <Text style={styles.loadMoreText}>Load More</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    />
                )}
            </View>

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#EF6C00" />
                            </TouchableOpacity>
                        </View>

                        {fields.map(field => (
                            <View key={field.name} style={styles.inputContainer}>
                                <Text style={styles.label}>{field.label}</Text>
                                {field.type === 'selector' ? (
                                    <TouchableOpacity 
                                        style={styles.selectorInput} 
                                        onPress={() => handleOpenSelector(field)}
                                    >
                                        <Text style={[styles.selectorInputText, !formData[field.name] && styles.placeholderText]}>
                                            {formData[field.name] 
                                                ? (selectorLabels[field.name] || formData[field.name]) 
                                                : field.placeholder}
                                        </Text>
                                        <Ionicons name="chevron-down" size={20} color="#666" />
                                    </TouchableOpacity>
                                ) : field.type === 'location' ? (
                                    <TouchableOpacity 
                                        style={styles.selectorInput} 
                                        onPress={() => handleOpenMap(field)}
                                    >
                                        <Text style={[styles.selectorInputText, !formData[field.name] && styles.placeholderText]}>
                                            {formData[field.name] || 'Select Location on Map'}
                                        </Text>
                                        <Ionicons name="map-outline" size={20} color="#666" />
                                    </TouchableOpacity>
                                ) : (
                                    <TextInput
                                        style={styles.input}
                                        value={formData[field.name]}
                                        onChangeText={text => setFormData({ ...formData, [field.name]: text })}
                                        placeholder={field.placeholder}
                                        keyboardType={field.keyboardType || 'default'}
                                    />
                                )}
                            </View>
                        ))}

                        <TouchableOpacity
                            style={[styles.submitButton, submitting && styles.disabledButton]}
                            onPress={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name={editingItem ? "save-outline" : "add-circle-outline"} size={24} color="#fff" />
                                    <Text style={styles.submitButtonText}>
                                        {editingItem ? 'Update' : 'Create'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={selectorVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setSelectorVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select {currentSelectorField?.label}</Text>
                            <TouchableOpacity onPress={() => setSelectorVisible(false)} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#EF6C00" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search..."
                                value={selectorSearchQuery}
                                onChangeText={setSelectorSearchQuery}
                            />
                        </View>

                        {selectorLoading ? (
                            <ActivityIndicator size="large" color="#0067A5" style={{margin: 20}} />
                        ) : (
                            <FlatList
                                data={selectorOptions}
                                keyExtractor={item => String(item[currentSelectorField?.valueKey || 'id'])}
                                renderItem={({ item }) => (
                                    <TouchableOpacity 
                                        style={styles.selectorItem}
                                        onPress={() => handleSelectOption(item)}
                                    >
                                        <Text style={styles.selectorItemText}>
                                            {item[currentSelectorField?.displayKey || 'name']}
                                        </Text>
                                        {formData[currentSelectorField?.name] === item[currentSelectorField?.valueKey || 'id'] && (
                                            <Ionicons name="checkmark" size={20} color="#0067A5" />
                                        )}
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    <Text style={styles.emptyText}>No options found</Text>
                                }
                                style={{ maxHeight: 300 }}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* Map Picker Modal */}
            <Modal
                visible={mapModalVisible}
                animationType="slide"
                onRequestClose={() => setMapModalVisible(false)}
            >
                <View style={styles.mapContainer}>
                    <View style={styles.placesAutocompleteContainer}>
                        <GooglePlacesAutocomplete
                            placeholder='Search location...'
                            onPress={(data, details = null) => {
                                if (details) {
                                    const { lat, lng } = details.geometry.location;
                                    const newLocation = { latitude: lat, longitude: lng };
                                    setMapLocation(newLocation);
                                    mapRef.current?.animateToRegion({
                                        ...newLocation,
                                        latitudeDelta: 0.005,
                                        longitudeDelta: 0.005,
                                    }, 1000);
                                }
                            }}
                            query={{
                                key: GOOGLE_API_KEY,
                                language: 'en',
                            }}
                            fetchDetails={true}
                            styles={{
                                container: {
                                    flex: 0,
                                },
                                textInput: {
                                    height: 44,
                                    borderRadius: 5,
                                    backgroundColor: '#fff',
                                    paddingHorizontal: 10,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 2,
                                    elevation: 2,
                                },
                                listView: {
                                    position: 'absolute',
                                    top: 45,
                                    left: 0,
                                    right: 0,
                                    backgroundColor: '#fff',
                                    borderRadius: 5,
                                    zIndex: 1000,
                                    elevation: 1000,
                                }
                            }}
                            enablePoweredByContainer={false}
                        />
                    </View>

                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        initialRegion={{
                            latitude: mapLocation.latitude,
                            longitude: mapLocation.longitude,
                            latitudeDelta: 0.0922,
                            longitudeDelta: 0.0421,
                        }}
                        onPress={(e) => setMapLocation(e.nativeEvent.coordinate)}
                    >
                        <Marker coordinate={mapLocation} draggable onDragEnd={(e) => setMapLocation(e.nativeEvent.coordinate)} />
                    </MapView>
                    
                    <View style={styles.mapActions}>
                        <TouchableOpacity style={styles.mapCancelButton} onPress={() => setMapModalVisible(false)}>
                            <Text style={styles.mapCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.mapConfirmButton} onPress={handleConfirmLocation}>
                            <Text style={styles.mapConfirmText}>Confirm Location</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Success Modal */}
            <Modal
                visible={successModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setSuccessModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.successModalContent}>
                        <View style={[
                            styles.successIconContainer, 
                            successType === 'update' && { backgroundColor: '#E1F5FE' },
                            successType === 'delete' && { backgroundColor: '#FFEBEE' }
                        ]}>
                            <Ionicons 
                                name={successType === 'delete' ? "trash-outline" : "checkmark-circle"} 
                                size={64} 
                                color={
                                    successType === 'update' ? '#0288D1' : 
                                    (successType === 'delete' ? '#D32F2F' : '#4CAF50')
                                } 
                            />
                        </View>
                        <Text style={styles.successTitle}>
                            {successType === 'update' ? 'Updated!' : (successType === 'delete' ? 'Deleted!' : 'Success!')}
                        </Text>
                        <Text style={styles.successMessage}>{successMessage}</Text>
                        <TouchableOpacity
                            style={[
                                styles.successButton,
                                successType === 'update' && { backgroundColor: '#0288D1' },
                                successType === 'delete' && { backgroundColor: '#D32F2F' }
                            ]}
                            onPress={() => setSuccessModalVisible(false)}
                        >
                            <Text style={styles.successButtonText}>
                                {successType === 'delete' ? 'Close' : 'Great!'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                visible={deleteModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setDeleteModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.deleteModalContent}>
                        <View style={styles.deleteIconContainer}>
                            <Ionicons name="trash-outline" size={48} color="#D32F2F" />
                        </View>
                        <Text style={styles.deleteTitle}>Delete Item?</Text>
                        <Text style={styles.deleteMessage}>
                            Are you sure you want to delete this item? This action cannot be undone.
                        </Text>
                        <View style={styles.deleteActions}>
                            <TouchableOpacity
                                style={styles.cancelDeleteButton}
                                onPress={() => setDeleteModalVisible(false)}
                            >
                                <Text style={styles.cancelDeleteText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.confirmDeleteButton}
                                onPress={confirmDelete}
                                disabled={deleting}
                            >
                                {deleting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.confirmDeleteText}>Delete</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    addButton: {
        backgroundColor: '#0067A5',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentContainer: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    addRegionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0067A5',
        margin: 16,
        paddingVertical: 12,
        borderRadius: 8,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    mapContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    placesAutocompleteContainer: {
        position: 'absolute',
        top: 10,
        left: 10,
        right: 10,
        zIndex: 100,
    },
    map: {
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height - 100,
    },
    mapActions: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.9)',
        padding: 15,
        borderRadius: 10,
    },
    mapCancelButton: {
        padding: 10,
    },
    mapCancelText: {
        color: '#FF3B30',
        fontWeight: 'bold',
        fontSize: 16,
    },
    mapConfirmButton: {
        backgroundColor: '#0067A5',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
    },
    mapConfirmText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    addRegionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 12,
        color: '#666',
        marginBottom: 2,
    },
    cardDetail: {
        fontSize: 14,
        color: '#444',
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        padding: 8,
        marginLeft: 8,
    },
    headerContainer: {
        paddingHorizontal: 20,
        paddingBottom: 15,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#666',
        marginTop: 4,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 50,
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginBottom: 24,
        backgroundColor: '#FFF3E0', // Light Orange
        padding: 16,
        marginTop: -24,
        marginHorizontal: -24,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    closeButton: {
        backgroundColor: 'rgba(239, 108, 0, 0.1)', // Subtle orange tint
        padding: 8,
        borderRadius: 20,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1a1a1a',
        letterSpacing: 0.5,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        color: '#444',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1.5,
        borderColor: '#e1e1e1',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        backgroundColor: '#fff',
        color: '#333',
    },
    submitButton: {
        backgroundColor: '#0067A5',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 12,
        elevation: 4,
        shadowColor: '#0067A5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    topBar: {
        flexDirection: 'row',
        padding: 16,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        padding: 10,
        marginRight: 5,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingHorizontal: 12,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        height: 48,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        height: '100%',
    },
    addButtonSmall: {
        width: 48,
        height: 48,
        backgroundColor: '#0067A5',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    selectorInput: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#e1e1e1',
        borderRadius: 12,
        padding: 14,
        backgroundColor: '#fff',
    },
    selectorInputText: {
        fontSize: 16,
        color: '#333',
    },
    placeholderText: {
        color: '#999',
    },
    selectorItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    selectorItemText: {
        fontSize: 16,
        color: '#333',
    },
    disabledButton: {
        opacity: 0.7,
        backgroundColor: '#88aacc',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 10,
        letterSpacing: 0.5,
    },
    footer: {
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadMoreButton: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#0067A5',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    loadMoreText: {
        color: '#0067A5',
        fontSize: 14,
        fontWeight: '600',
    },
    // Success Modal Styles
    successModalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        width: '80%',
        maxWidth: 340,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    successIconContainer: {
        marginBottom: 16,
        backgroundColor: '#E8F5E9',
        padding: 16,
        borderRadius: 50,
    },
    successTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    successMessage: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
    },
    successButton: {
        backgroundColor: '#4CAF50',
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 25,
        elevation: 2,
    },
    successButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    // Delete Modal Styles
    deleteModalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        width: '80%',
        maxWidth: 340,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    deleteIconContainer: {
        marginBottom: 16,
        backgroundColor: '#FFEBEE',
        padding: 16,
        borderRadius: 50,
    },
    deleteTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#D32F2F',
        marginBottom: 8,
    },
    deleteMessage: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
    },
    deleteActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    cancelDeleteButton: {
        flex: 1,
        paddingVertical: 12,
        marginRight: 8,
        borderRadius: 12,
        backgroundColor: '#f5f5f5',
        alignItems: 'center',
    },
    cancelDeleteText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    confirmDeleteButton: {
        flex: 1,
        paddingVertical: 12,
        marginLeft: 8,
        borderRadius: 12,
        backgroundColor: '#D32F2F',
        alignItems: 'center',
    },
    confirmDeleteText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});

export default CrudScreen;
