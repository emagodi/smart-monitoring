import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const CrudScreen = ({
    title,
    fetchData,
    createItem,
    updateItem,
    deleteItem,
    fields, // Array of { name, label, type, placeholder, required }
    itemTitleKey = 'name', // Key to display as main title in list
    itemSubtitleKey = 'id', // Key to display as subtitle
    renderCustomItem = null,
    transformDataBeforeSubmit = null, // Function to transform data before create/update
    addButtonLabel // Label for the add button
}) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [submitting, setSubmitting] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await fetchData();
            setData(result);
        } catch (error) {
            console.error('Error fetching data:', error);
            Alert.alert('Error', 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

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
        fields.forEach(field => {
            // Handle nested objects if needed (e.g., region.id)
            if (field.name.includes('.')) {
                const parts = field.name.split('.');
                initialData[field.name] = item[parts[0]]?.[parts[1]] || '';
            } else {
                initialData[field.name] = String(item[field.name] || '');
            }
        });
        setFormData(initialData);
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
                dataToSubmit = transformDataBeforeSubmit(dataToSubmit, editingItem);
            }

            if (editingItem) {
                await updateItem(editingItem.id, dataToSubmit);
                Alert.alert('Success', 'Item updated successfully');
            } else {
                await createItem(dataToSubmit);
                Alert.alert('Success', 'Item created successfully');
            }
            setModalVisible(false);
            loadData();
        } catch (error) {
            console.error('Error saving item:', error);
            Alert.alert('Error', 'Failed to save item');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (item) => {
        Alert.alert(
            'Confirm Delete',
            `Are you sure you want to delete this item?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteItem(item.id);
                            loadData();
                        } catch (error) {
                            console.error('Error deleting item:', error);
                            Alert.alert('Error', 'Failed to delete item');
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }) => {
        if (renderCustomItem) {
            return renderCustomItem(item, () => handleOpenEdit(item), () => handleDelete(item));
        }

        return (
            <View style={styles.card}>
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item[itemTitleKey]}</Text>
                    <Text style={styles.cardSubtitle}>ID: {item[itemSubtitleKey]}</Text>
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
                    <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}>
                        <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{title}</Text>
            </View>

            <View style={styles.contentContainer}>
                <TouchableOpacity onPress={handleOpenCreate} style={styles.addRegionButton}>
                    <Ionicons name="add-circle-outline" size={24} color="#fff" />
                    <Text style={styles.addRegionButtonText}>{addButtonLabel || `Add ${title.slice(0, -1)}`}</Text>
                </TouchableOpacity>

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
                        onRefresh={loadData}
                        ListEmptyComponent={
                            <View style={styles.centered}>
                                <Text style={styles.emptyText}>No items found</Text>
                            </View>
                        }
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
                            <Text style={styles.modalTitle}>
                                {editingItem ? 'Edit Item' : 'New Item'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        {fields.map(field => (
                            <View key={field.name} style={styles.inputContainer}>
                                <Text style={styles.label}>{field.label}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={formData[field.name]}
                                    onChangeText={text => setFormData({ ...formData, [field.name]: text })}
                                    placeholder={field.placeholder}
                                    keyboardType={field.keyboardType || 'default'}
                                />
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
                                <Text style={styles.submitButtonText}>
                                    {editingItem ? 'Update' : 'Create'}
                                </Text>
                            )}
                        </TouchableOpacity>
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    inputContainer: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#f9f9f9',
    },
    submitButton: {
        backgroundColor: '#0067A5',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    disabledButton: {
        opacity: 0.7,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default CrudScreen;
