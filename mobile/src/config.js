import { Platform } from 'react-native';

// 10.0.2.2 is the special alias to your host loopback interface (i.e., 127.0.0.1 on your development machine)
// Use your machine's local IP address if running on a physical device
const API_URL = Platform.OS === 'android' ? 'http://10.175.121.205:8080' : 'http://10.175.121.205:8080';
const VISION_AI_URL = Platform.OS === 'android' ? 'http://10.175.121.205:8000' : 'http://10.175.121.205:8000';

export default {
    API_URL,
    VISION_AI_URL
};
