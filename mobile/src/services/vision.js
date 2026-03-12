import axios from 'axios';
import config from '../config';

const analyzeImage = async (imageUri) => {
    // Create form data
    const formData = new FormData();
    formData.append('file', {
        uri: imageUri,
        name: 'photo.jpg',
        type: 'image/jpeg',
    });
    formData.append('modelType', 'security');

    const response = await axios.post(`${config.VISION_AI_URL}/analyze/upload`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            'Bypass-Tunnel-Reminder': 'true',
        },
    });
    return response.data;
};

export default {
    analyzeImage
};
