import React from 'react';
import CrudScreen from '../components/CrudScreen';
import transformerService from '../services/transformer';

const TransformerCrudScreen = () => {
    const fields = [
        { name: 'name', label: 'Transformer Name', placeholder: 'Enter transformer name', required: true },
        { name: 'depotId', label: 'Depot ID', placeholder: 'Enter Depot ID', required: true, keyboardType: 'numeric' },
        // Add other transformer fields as needed based on TransformerRequest
        // For now, assuming name and depotId are primary required fields
    ];

    const transformDataBeforeSubmit = (data, editingItem) => {
        return {
            name: data.name,
            depotId: parseInt(data.depotId, 10)
            // Add other default values if needed
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
