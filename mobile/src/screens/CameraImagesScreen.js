import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Modal, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import cameraService from '../services/camera';
import config from '../config';

const CameraImagesScreen = ({ route, navigation }) => {
    const { cameraId, cameraName } = route.params;
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState(null);

    useEffect(() => {
        fetchImages();
    }, []);

    const fetchImages = async () => {
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
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Images</Text>
            </View>

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
                            <Text style={styles.emptyText}>No images available</Text>
                            <Text style={styles.emptySubText}>Images captured by this camera will appear here.</Text>
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
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', elevation: 2, paddingTop: 40 },
    backButton: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 8, color: '#333' },
    loader: { marginTop: 20 },
    listContent: { padding: 16 },
    card: { backgroundColor: '#fff', padding: 16, marginBottom: 12, borderRadius: 8, elevation: 2 },
    cardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dateText: { fontSize: 16, color: '#333', fontWeight: '500' },
    subText: { fontSize: 12, color: '#666', marginTop: 4 },
    viewButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0067A5', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
    viewButtonText: { color: '#fff', marginLeft: 6, fontWeight: 'bold' },
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
        fontSize: 18, 
        fontWeight: 'bold' 
    },
    emptySubText: { 
        textAlign: 'center', 
        marginTop: 8, 
        color: '#666', 
        fontSize: 14 
    },
    modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    closeButton: { position: 'absolute', top: 40, right: 20, zIndex: 10 },
    imageWrapper: { width: '100%', height: '80%', justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: '100%', height: '80%' },
    imageInfo: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 8 },
    infoText: { color: '#fff', fontSize: 14, marginBottom: 4 }
});

export default CameraImagesScreen;
