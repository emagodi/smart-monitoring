import React from 'react';
import CrudScreen from '../components/CrudScreen';
import sensorService from '../services/sensor';
import transformerService from '../services/transformer';

const NewSensorsScreen = () => {
    const fields = [
        { name: 'name', label: 'Device Name', placeholder: 'Enter device name', required: true },
        { 
            name: 'type', 
            label: 'Sensor Type', 
            type: 'selector', 
            fetchOptions: async () => [
                { id: 'motion', name: 'Motion' },
                { id: 'contact', name: 'Contact' },
                { id: 'temperature', name: 'Temperature' },
                { id: 'tilt', name: 'Tilt' }
            ],
            labelKey: 'name',
            valueKey: 'id',
            required: true
        },
        { 
            name: 'transformerId', 
            label: 'Transformer', 
            type: 'selector', 
            fetchOptions: transformerService.getAllTransformers, 
            labelKey: 'name',
            valueKey: 'id',
            required: true
        }
    ];

    const fetchSensors = async (page, size, search) => {
        // search/page ignored for now as endpoint returns all unassigned
        return await sensorService.getUnassignedSensors();
    };

    const transformDataBeforeSubmit = (data, editingItem, selectorLabels) => {
        return {
            deviceId: editingItem.deviceId, // Preserve original deviceId
            devEui: editingItem.devEui,     // Preserve original devEui
            name: data.name,
            type: data.type,
            transformerId: parseInt(data.transformerId, 10)
        };
    };

    return (
        <CrudScreen
            title="New Sensors"
            fetchData={fetchSensors}
            updateItem={sensorService.updateSensor}
            fields={fields}
            itemTitleKey="deviceId"
            itemSubtitleKey="devEui"
            transformDataBeforeSubmit={transformDataBeforeSubmit}
            entityName="Sensor"
        />
    );
};

export default NewSensorsScreen;
