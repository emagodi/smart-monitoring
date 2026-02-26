import React, { useContext } from 'react';
import { Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { AuthContext } from '../contexts/AuthContext';

const HeaderLogo = () => {
    const { signOut } = useContext(AuthContext);

    const handleLogout = () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                { 
                    text: "Logout", 
                    onPress: () => signOut(),
                    style: "destructive"
                }
            ]
        );
    };

    return (
        <TouchableOpacity onPress={handleLogout} style={styles.container}>
            <Image 
                source={require('../../assets/images/powertel_logo.jpg')} 
                style={styles.logo}
                resizeMode="contain"
            />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        marginRight: 10,
    },
    logo: {
        width: 100,
        height: 35,
    },
});

export default HeaderLogo;