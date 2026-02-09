import React from 'react';
import CrudScreen from '../components/CrudScreen';
import infrastructureService from '../services/infrastructure';

const DepotListScreen = () => {
    const fields = [
        { name: 'name', label: 'Depot Name', placeholder: 'Enter depot name', required: true },
        { name: 'districtId', label: 'District ID', placeholder: 'Enter District ID', required: true, keyboardType: 'numeric' }
    ];

    const transformDataBeforeSubmit = (data, editingItem) => {
        return {
            name: data.name,
            districtId: parseInt(data.districtId, 10)
        };
    };

    return (
        <CrudScreen
            title="Depots"
            addButtonLabel="Add Depot"
            fetchData={infrastructureService.getAllDepots}
            createItem={infrastructureService.createDepot}
            updateItem={infrastructureService.updateDepot}
            deleteItem={infrastructureService.deleteDepot}
            fields={fields}
            itemTitleKey="name"
            transformDataBeforeSubmit={transformDataBeforeSubmit}
        />
    );
};

export default DepotListScreen;
