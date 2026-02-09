import React, { useState, useEffect } from 'react';
import CrudScreen from '../components/CrudScreen';
import infrastructureService from '../services/infrastructure';

const DistrictListScreen = () => {
    // We need to fetch regions to allow selecting a region when creating/updating a district
    // But for simplicity in this iteration, we'll ask for Region ID
    // Ideally, this should be a dropdown selector.
    // To implement a dropdown, we would need to pass options to CrudScreen or customize it.
    // For now, let's keep it simple with Region ID input, but maybe we can fetch regions to validate or show list.
    
    // NOTE: In a real app, 'regionId' field should use a Picker/Dropdown populated by getAllRegions
    
    const fields = [
        { name: 'name', label: 'District Name', placeholder: 'Enter district name', required: true },
        { 
            name: 'regionId', 
            label: 'Region', 
            placeholder: 'Select Region', 
            required: true, 
            type: 'selector',
            fetchOptions: infrastructureService.getAllRegions,
            displayKey: 'name',
            valueKey: 'id',
            labelKey: 'regionName'
        }
    ];

    const transformDataBeforeSubmit = (data, editingItem) => {
        return {
            name: data.name,
            regionId: parseInt(data.regionId, 10)
        };
    };

    return (
        <CrudScreen
            title="Districts"
            addButtonLabel="Add District"
            fetchData={infrastructureService.getAllDistricts}
            createItem={infrastructureService.createDistrict}
            updateItem={infrastructureService.updateDistrict}
            deleteItem={infrastructureService.deleteDistrict}
            fields={fields}
            itemTitleKey="name"
            transformDataBeforeSubmit={transformDataBeforeSubmit}
            entityName="District"
        />
    );
};

export default DistrictListScreen;
