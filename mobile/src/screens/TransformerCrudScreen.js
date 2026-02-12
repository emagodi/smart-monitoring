import React from 'react';
import CrudScreen from '../components/CrudScreen';
import transformerService from '../services/transformer';
import infrastructureService from '../services/infrastructure';

const TransformerCrudScreen = () => {
    const fields = [
        { name: 'name', label: 'Transformer Name', placeholder: 'Enter transformer name', required: true },
        { name: 'depotId', label: 'Depot', type: 'selector', fetchOptions: infrastructureService.getAllDepots, labelKey: 'depotName' },
        { name: 'capacity', label: 'Capacity (KVA)', placeholder: 'Enter capacity', keyboardType: 'numeric' },
        { 
            name: 'location', 
            label: 'Location', 
            type: 'location', 
            latField: 'lat', 
            lngField: 'lng',
            placeholder: 'Tap to select location' 
        },
        { 
            name: 'status', 
            label: 'Status', 
            type: 'selector', 
            fetchOptions: async () => [
                { id: 'active', name: 'Active' }, 
                { id: 'maintenance', name: 'Maintenance' }
            ],
            labelKey: 'statusLabel',
            valueKey: 'id'
        }
    ];

    const fetchTransformers = async (page, size, search) => {
        const result = await transformerService.getAllTransformers(page, size, search);
        if (result && result.content) {
            result.content = result.content.map(t => ({
                ...t,
                status: t.isActive ? 'active' : 'maintenance',
                statusLabel: t.isActive ? 'Active' : 'Maintenance'
            }));
        }
        return result;
    };

    const transformDataBeforeSubmit = (data, editingItem, selectorLabels) => {
        return {
            name: data.name,
            depotId: parseInt(data.depotId, 10),
            depotName: selectorLabels?.depotId,
            capacity: parseInt(data.capacity, 10) || 0,
            isActive: data.status === 'active',
            lat: parseFloat(data.lat) || 0.0,
            lng: parseFloat(data.lng) || 0.0
        };
    };

    return (
        <CrudScreen
            title="Transformers Management"
            addButtonLabel="Add Transformer"
            fetchData={fetchTransformers}
            createItem={transformerService.createTransformer}
            updateItem={transformerService.updateTransformer}
            deleteItem={transformerService.deleteTransformer}
            fields={fields}
            itemTitleKey="name"
            transformDataBeforeSubmit={transformDataBeforeSubmit}
            entityName="Transformer"
        />
    );
};

export default TransformerCrudScreen;
