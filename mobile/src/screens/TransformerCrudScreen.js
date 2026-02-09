import React from 'react';
import CrudScreen from '../components/CrudScreen';
import transformerService from '../services/transformer';
import infrastructureService from '../services/infrastructure';

const TransformerCrudScreen = () => {
    const fields = [
        { name: 'name', label: 'Transformer Name', placeholder: 'Enter transformer name', required: true },
        { name: 'depotId', label: 'Depot', type: 'selector', selectorFunc: infrastructureService.getAllDepots, labelKey: 'depotName' },
        // Add other transformer fields as needed based on TransformerRequest
        // For now, assuming name and depotId are primary required fields
    ];

    const transformDataBeforeSubmit = (data, editingItem) => {
        return {
            name: data.name,
            depotId: parseInt(data.depotId, 10),
            capacity: 0, // Default value
            isActive: true, // Default value
            lat: 0.0, // Default value
            lng: 0.0 // Default value
        };
    };

    return (
        <CrudScreen
            title="Transformers Management"
            addButtonLabel="Add Transformer"
            fetchData={transformerService.getAllTransformers}
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
