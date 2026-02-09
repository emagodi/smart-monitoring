import React from 'react';
import CrudScreen from '../components/CrudScreen';
import infrastructureService from '../services/infrastructure';

const RegionListScreen = () => {
    const fields = [
        { name: 'name', label: 'Region Name', placeholder: 'Enter region name', required: true }
    ];

    return (
        <CrudScreen
            title="Regions"
            addButtonLabel="Add Region"
            fetchData={infrastructureService.getAllRegions}
            createItem={infrastructureService.createRegion}
            updateItem={infrastructureService.updateRegion}
            deleteItem={infrastructureService.deleteRegion}
            fields={fields}
            itemTitleKey="name"
        />
    );
};

export default RegionListScreen;
