import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CrudScreen from '../components/CrudScreen';
import transformerService from '../services/transformer';
import infrastructureService from '../services/infrastructure';

const TransformerCrudScreen = () => {
    const [viewLevel, setViewLevel] = useState('regions'); // 'regions', 'districts', 'depots', 'transformers'
    const [selectedRegion, setSelectedRegion] = useState(null);
    const [selectedDistrict, setSelectedDistrict] = useState(null);
    const [selectedDepot, setSelectedDepot] = useState(null);

    // Transformer fields
    const transformerFields = [
        { name: 'name', label: 'Transformer Name', placeholder: 'Enter transformer name', required: true },
        // Depot is pre-selected
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
        if (!selectedDepot) return { content: [] };
        // Fetch by depot
        try {
            const data = await transformerService.getTransformersByDepot(selectedDepot.id);
            // Client-side search filtering
            let filteredData = data;
            if (search) {
                const query = search.toLowerCase();
                filteredData = data.filter(t => t.name.toLowerCase().includes(query));
            }
            
            // Map status for display
            return filteredData.map(t => ({
                ...t,
                status: t.isActive ? 'active' : 'maintenance',
                statusLabel: t.isActive ? 'Active' : 'Maintenance'
            }));
        } catch (error) {
            console.error('Error fetching transformers:', error);
            return [];
        }
    };

    const transformDataBeforeSubmit = (data, editingItem, selectorLabels) => {
        return {
            name: data.name,
            depotId: selectedDepot.id, // Use selected depot ID
            depotName: selectedDepot.name, // Use selected depot name
            capacity: parseInt(data.capacity, 10) || 0,
            isActive: data.status === 'active',
            lat: parseFloat(data.lat) || 0.0,
            lng: parseFloat(data.lng) || 0.0
        };
    };

    // Navigation handlers
    const handleSelectRegion = (region) => {
        setSelectedRegion(region);
        setViewLevel('districts');
    };

    const handleSelectDistrict = (district) => {
        setSelectedDistrict(district);
        setViewLevel('depots');
    };

    const handleSelectDepot = (depot) => {
        setSelectedDepot(depot);
        setViewLevel('transformers');
    };

    const handleBack = () => {
        if (viewLevel === 'transformers') setViewLevel('depots');
        else if (viewLevel === 'depots') setViewLevel('districts');
        else if (viewLevel === 'districts') setViewLevel('regions');
    };

    // Render custom item for selection lists
    const renderSelectionItem = (item, onSelect) => (
        <TouchableOpacity onPress={() => onSelect(item)} style={styles.itemContainer}>
            <View>
                <Text style={styles.itemTitle}>{item.name}</Text>
                {item.code && <Text style={styles.itemSubtitle}>{item.code}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={24} color="#ccc" />
        </TouchableOpacity>
    );

    // Dynamic props for CrudScreen
    let screenProps = {};

    switch (viewLevel) {
        case 'regions':
            screenProps = {
                title: 'Select Region',
                fetchData: infrastructureService.getAllRegions, // Returns Page object
                fields: [{ name: 'name', label: 'Name' }], // Minimal fields for search
                renderCustomItem: (item) => renderSelectionItem(item, handleSelectRegion),
                createItem: null, // Read-only
                onBack: null // Root level
            };
            break;
        case 'districts':
            screenProps = {
                title: `Select District (${selectedRegion?.name})`,
                fetchData: async (page, size, search) => {
                    const data = await infrastructureService.getDistrictsByRegion(selectedRegion.id);
                    if (search) return data.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
                    return data;
                },
                fields: [{ name: 'name', label: 'Name' }],
                renderCustomItem: (item) => renderSelectionItem(item, handleSelectDistrict),
                createItem: null,
                onBack: handleBack
            };
            break;
        case 'depots':
            screenProps = {
                title: `Select Depot (${selectedDistrict?.name})`,
                fetchData: async (page, size, search) => {
                    const data = await infrastructureService.getDepotsByDistrict(selectedDistrict.id);
                    if (search) return data.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
                    return data;
                },
                fields: [{ name: 'name', label: 'Name' }],
                renderCustomItem: (item) => renderSelectionItem(item, handleSelectDepot),
                createItem: null,
                onBack: handleBack
            };
            break;
        case 'transformers':
            screenProps = {
                title: `Transformers (${selectedDepot?.name})`,
                fetchData: fetchTransformers,
                fields: transformerFields,
                createItem: transformerService.createTransformer,
                updateItem: transformerService.updateTransformer,
                deleteItem: transformerService.deleteTransformer,
                transformDataBeforeSubmit: transformDataBeforeSubmit,
                entityName: 'Transformer',
                onBack: handleBack,
                addButtonLabel: 'Add Transformer'
            };
            break;
    }

    // Force re-mount of CrudScreen when viewLevel changes to reset state
    return (
        <CrudScreen
            key={viewLevel} 
            {...screenProps}
        />
    );
};

const styles = StyleSheet.create({
    itemContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        marginHorizontal: 10,
        marginVertical: 5,
        borderRadius: 8,
        elevation: 2
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333'
    },
    itemSubtitle: {
        fontSize: 12,
        color: '#666',
        marginTop: 2
    }
});

export default TransformerCrudScreen;
