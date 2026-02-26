import React from 'react';
import { Image, View, StyleSheet } from 'react-native';

const HeaderLogo = () => {
    return (
        <View style={styles.container}>
            <Image 
                source={require('../../assets/images/powertel_logo.jpg')} 
                style={styles.logo}
                resizeMode="contain"
            />
        </View>
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