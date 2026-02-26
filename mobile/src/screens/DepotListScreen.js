import React from 'react';
import CrudScreen from '../components/CrudScreen';
import infrastructureService from '../services/infrastructure';

const DepotListScreen = () => {
    const fields = [
        { name: 'name', label: 'Depot Name', placeholder: 'Enter depot name', required: true },
        { 
            name: 'districtId', 
            label: 'District', 
            placeholder: 'Select District', 
            required: true, 
            type: 'selector',
            fetchOptions: infrastructureService.getAllDistricts,
            displayKey: 'name',
            valueKey: 'id',
            labelKey: 'districtName'
        }
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
            entityName="Depot"
            showLogo={false}
        />
    );
};

export default DepotListScreen;
