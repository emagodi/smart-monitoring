import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

const LogoutButton = ({ color = '#374151' }) => {
    const { signOut } = useContext(AuthContext);
    const [modalVisible, setModalVisible] = useState(false);

    const handleLogout = () => {
        setModalVisible(false);
        // Small delay to allow modal to close smoothly before signing out
        setTimeout(() => {
            signOut();
        }, 300);
    };

    return (
        <>
            <TouchableOpacity 
                onPress={() => setModalVisible(true)} 
                style={styles.container}
                activeOpacity={0.7}
            >
                <View style={styles.iconContainer}>
                    <Ionicons name="log-out-outline" size={24} color={color} />
                </View>
            </TouchableOpacity>

            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.iconWrapper}>
                            <Ionicons name="log-out" size={32} color="#DC2626" />
                        </View>
                        
                        <Text style={styles.modalTitle}>Confirm Logout</Text>
                        <Text style={styles.modalMessage}>
                            Are you sure you want to log out of your account?
                        </Text>

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity 
                                style={[styles.button, styles.cancelButton]} 
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.button, styles.logoutButton]} 
                                onPress={handleLogout}
                            >
                                <Text style={styles.logoutButtonText}>Logout</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 8,
        borderRadius: 8,
    },
    iconContainer: {
        justifyContent: 'center',
        alignItems: 'center',
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
        borderRadius: 24,
        padding: 24,
        width: Math.min(width - 40, 340),
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    iconWrapper: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontWeight: '600',
        fontSize: 20,
        color: '#1F2937',
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
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#F3F4F6',
    },
    logoutButton: {
        backgroundColor: '#DC2626',
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    cancelButtonText: {
        fontWeight: '600',
        fontSize: 15,
        color: '#4B5563',
    },
    logoutButtonText: {
        fontWeight: '600',
        fontSize: 15,
        color: 'white',
    },
});

export default LogoutButton;
