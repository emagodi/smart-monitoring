import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Modal, ActivityIndicator, Alert, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import cameraService from '../services/camera';
import config from '../config';

const CameraImagesScreen = ({ route, navigation }) => {
    const { cameraId, cameraName } = route.params;
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState(null);

    // Filter state
    const [filterVisible, setFilterVisible] = useState(false);
    const [startDate, setStartDate] = useState(new Date(Date.now() - 24 * 60 * 60 * 1000)); // 24 hours ago
    const [endDate, setEndDate] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);
    const [pickerMode, setPickerMode] = useState('date');
    const [activeField, setActiveField] = useState(null); // 'start' or 'end'
    
    // Time input state
    const [startTimeText, setStartTimeText] = useState('');
    const [endTimeText, setEndTimeText] = useState('');

    useEffect(() => {
        fetchImages();
    }, []);

    // Sync text inputs with date state
    useEffect(() => {
        if (startDate) {
            setStartTimeText(startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
        }
    }, [startDate]);

    useEffect(() => {
        if (endDate) {
            setEndTimeText(endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
        }
    }, [endDate]);

    const handleTimeTextChange = (text, type) => {
        if (type === 'start') setStartTimeText(text);
        else setEndTimeText(text);

        // Try to parse HH:mm
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (timeRegex.test(text)) {
            const [hours, minutes] = text.split(':').map(Number);
            const dateToUpdate = type === 'start' ? new Date(startDate) : new Date(endDate);
            dateToUpdate.setHours(hours);
            dateToUpdate.setMinutes(minutes);
            
            if (type === 'start') setStartDate(dateToUpdate);
            else setEndDate(dateToUpdate);
        }
    };

    const handleTimeBlur = (type) => {
        const text = type === 'start' ? startTimeText : endTimeText;
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(text)) {
            const date = type === 'start' ? startDate : endDate;
            const validText = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            if (type === 'start') setStartTimeText(validText);
            else setEndTimeText(validText);
        }
    };

    const fetchImages = async () => {
        setLoading(true);
        try {
            const data = await cameraService.getLatestImages(cameraId);
            setImages(data);
        } catch (error) {
            if (error.response && error.response.status === 404) {
                setImages([]);
            } else {
                console.error('Error fetching images:', error);
                Alert.alert('Error', 'Failed to fetch images');
            }
        } finally {
            setLoading(false);
        }
    };

    const applyFilter = async () => {
        setLoading(true);
        try {
            // Convert to local ISO string for backend LocalDateTime
            const toLocalISOString = (date) => {
                const tzOffset = (date.getTimezoneOffset() * 60000);
                return (new Date(date - tzOffset)).toISOString().slice(0, -1);
            };

            const startStr = toLocalISOString(startDate);
            const endStr = toLocalISOString(endDate);

            console.log(`Filtering from ${startStr} to ${endStr}`);

            const data = await cameraService.getImagesByDateRange(cameraId, startStr, endStr);
            setImages(data);
            setFilterVisible(false); // Close filter after applying
        } catch (error) {
            if (error.response && error.response.status === 404) {
                setImages([]);
                setFilterVisible(false);
            } else {
                console.error('Error filtering images:', error);
                Alert.alert('Error', 'Failed to filter images');
            }
        } finally {
            setLoading(false);
        }
    };

    const resetFilter = () => {
        setStartDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
        setEndDate(new Date());
        setFilterVisible(false);
        fetchImages();
    };

    const onDateChange = (event, selectedDate) => {
        setShowPicker(Platform.OS === 'ios');
        if (selectedDate) {
            if (activeField === 'start') {
                setStartDate(selectedDate);
            } else {
                setEndDate(selectedDate);
            }
        } else {
             setShowPicker(false);
        }
    };

    const showMode = (currentMode, field) => {
        setShowPicker(true);
        setPickerMode(currentMode);
        setActiveField(field);
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardContent}>
                <View>
                    <Text style={styles.dateText}>
                        {new Date(item.capturedAt).toLocaleString()}
                    </Text>
                    <Text style={styles.subText}>{item.cameraModel}</Text>
                </View>
                <TouchableOpacity 
                    style={styles.viewButton}
                    onPress={() => setSelectedImage(item)}
                >
                    <Ionicons name="eye" size={20} color="#fff" />
                    <Text style={styles.viewButtonText}>View</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Images</Text>
                <TouchableOpacity 
                    onPress={() => setFilterVisible(!filterVisible)} 
                    style={[styles.filterButton, filterVisible && styles.filterButtonActive]}
                >
                    <Text style={[styles.filterButtonText, filterVisible && { color: '#0067A5' }]}>Filter</Text>
                    <Ionicons name={filterVisible ? "funnel" : "funnel-outline"} size={20} color={filterVisible ? "#0067A5" : "#666"} />
                </TouchableOpacity>
            </View>

            {filterVisible && (
                <View style={styles.filterContainer}>
                    <Text style={styles.filterTitle}>Filter by Date & Time</Text>
                    <View style={styles.dateRow}>
                        <View style={styles.dateCol}>
                            <Text style={styles.dateLabel}>Start</Text>
                            <TouchableOpacity onPress={() => showMode('date', 'start')} style={styles.dateButton}>
                                <Text style={styles.dateButtonText}>{startDate.toLocaleDateString()}</Text>
                                <Ionicons name="calendar-outline" size={16} color="#666" />
                            </TouchableOpacity>
                            <View style={styles.dateButton}>
                                <TextInput
                                    style={[styles.dateButtonText, { flex: 1, padding: 0 }]}
                                    value={startTimeText}
                                    onChangeText={(text) => handleTimeTextChange(text, 'start')}
                                    onBlur={() => handleTimeBlur('start')}
                                    placeholder="HH:mm"
                                    keyboardType="numbers-and-punctuation"
                                    maxLength={5}
                                />
                                <TouchableOpacity onPress={() => showMode('time', 'start')}>
                                    <Ionicons name="time-outline" size={16} color="#666" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.dateCol}>
                            <Text style={styles.dateLabel}>End</Text>
                            <TouchableOpacity onPress={() => showMode('date', 'end')} style={styles.dateButton}>
                                <Text style={styles.dateButtonText}>{endDate.toLocaleDateString()}</Text>
                                <Ionicons name="calendar-outline" size={16} color="#666" />
                            </TouchableOpacity>
                            <View style={styles.dateButton}>
                                <TextInput
                                    style={[styles.dateButtonText, { flex: 1, padding: 0 }]}
                                    value={endTimeText}
                                    onChangeText={(text) => handleTimeTextChange(text, 'end')}
                                    onBlur={() => handleTimeBlur('end')}
                                    placeholder="HH:mm"
                                    keyboardType="numbers-and-punctuation"
                                    maxLength={5}
                                />
                                <TouchableOpacity onPress={() => showMode('time', 'end')}>
                                    <Ionicons name="time-outline" size={16} color="#666" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                    <View style={styles.filterActions}>
                        <TouchableOpacity onPress={resetFilter} style={[styles.actionButton, styles.resetButton]}>
                            <Text style={styles.resetButtonText}>Reset</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={applyFilter} style={[styles.actionButton, styles.applyButton]}>
                            <Text style={styles.applyButtonText}>Apply</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {showPicker && (
                <DateTimePicker
                    testID="dateTimePicker"
                    value={activeField === 'start' ? startDate : endDate}
                    mode={pickerMode}
                    is24Hour={true}
                    display="default"
                    onChange={onDateChange}
                />
            )}

            {loading ? (
                <ActivityIndicator size="large" color="#0067A5" style={styles.loader} />
            ) : (
                <FlatList
                    data={images}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={[styles.listContent, images.length === 0 && { flex: 1, justifyContent: 'center' }]}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="images-outline" size={64} color="#ccc" />
                            <Text style={styles.emptyText}>No images found</Text>
                            <Text style={styles.emptySubText}>Try adjusting your date range or check back later.</Text>
                        </View>
                    }
                />
            )}

            <Modal visible={!!selectedImage} transparent={true} onRequestClose={() => setSelectedImage(null)}>
                <View style={styles.modalContainer}>
                    <TouchableOpacity 
                        style={styles.closeButton} 
                        onPress={() => setSelectedImage(null)}
                    >
                        <Ionicons name="close-circle" size={40} color="#fff" />
                    </TouchableOpacity>
                    {selectedImage && (
                        <View style={styles.imageWrapper}>
                            <Image
                                source={{ uri: `${config.API_URL}${selectedImage.imageUrl}` }}
                                style={styles.fullImage}
                                resizeMode="contain"
                            />
                            <View style={styles.imageInfo}>
                                <Text style={styles.infoText}>Date: {new Date(selectedImage.capturedAt).toLocaleString()}</Text>
                                <Text style={styles.infoText}>Model: {selectedImage.cameraModel}</Text>
                                <Text style={styles.infoText}>MAC: {selectedImage.cameraMacAddress}</Text>
                            </View>
                        </View>
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', elevation: 2 },
    backButton: { padding: 8 },
    headerTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#333', flex: 1, marginLeft: 8 },
    filterButton: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 8 },
    filterButtonActive: { backgroundColor: '#F0F9FF' },
    filterButtonText: { marginRight: 4, fontFamily: 'Inter_600SemiBold', color: '#666', fontSize: 12 },
    filterContainer: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', elevation: 1 },
    filterTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#333', marginBottom: 12 },
    dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    dateCol: { flex: 1, marginHorizontal: 4 },
    dateLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#666', marginBottom: 4 },
    dateButton: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderWidth: 1, 
        borderColor: '#ddd', 
        borderRadius: 6, 
        padding: 8, 
        marginBottom: 8,
        backgroundColor: '#fafafa'
    },
    dateButtonText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#333' },
    filterActions: { flexDirection: 'row', justifyContent: 'space-between' },
    actionButton: { flex: 1, padding: 10, borderRadius: 6, alignItems: 'center', marginHorizontal: 4 },
    resetButton: { backgroundColor: '#e0e0e0' },
    resetButtonText: { color: '#333', fontFamily: 'Inter_700Bold', fontSize: 12 },
    applyButton: { backgroundColor: '#0067A5' },
    applyButtonText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 12 },
    loader: { marginTop: 20 },
    listContent: { padding: 16 },
    card: { backgroundColor: '#fff', padding: 16, marginBottom: 12, borderRadius: 8, elevation: 2 },
    cardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dateText: { fontSize: 14, color: '#333', fontFamily: 'Inter_600SemiBold' },
    subText: { fontSize: 11, color: '#666', marginTop: 4, fontFamily: 'Inter_400Regular' },
    viewButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0067A5', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
    viewButtonText: { color: '#fff', marginLeft: 6, fontFamily: 'Inter_700Bold', fontSize: 12 },
    emptyContainer: { 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: 32,
        backgroundColor: '#fff',
        marginHorizontal: 24,
        borderRadius: 16,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    emptyText: { 
        textAlign: 'center', 
        marginTop: 16, 
        color: '#333', 
        fontSize: 16, 
        fontFamily: 'Inter_700Bold' 
    },
    emptySubText: { 
        textAlign: 'center', 
        marginTop: 8, 
        color: '#666', 
        fontSize: 12,
        fontFamily: 'Inter_400Regular'
    },
    modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    closeButton: { position: 'absolute', top: 40, right: 20, zIndex: 10 },
    imageWrapper: { width: '100%', height: '80%', justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: '100%', height: '80%' },
    imageInfo: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 8 },
    infoText: { color: '#fff', fontSize: 12, marginBottom: 4, fontFamily: 'Inter_400Regular' }
});

export default CameraImagesScreen;
