import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import CrudScreen from '../components/CrudScreen';
import transformerService from '../services/transformer';
import infrastructureService from '../services/infrastructure';

const TransformerCrudScreen = () => {
    const navigation = useNavigation();
    const [viewLevel, setViewLevel] = useState('regions'); // 'regions', 'districts', 'depots', 'transformers'
    const [selectedRegion, setSelectedRegion] = useState(null);
    const [selectedDistrict, setSelectedDistrict] = useState(null);
    const [selectedDepot, setSelectedDepot] = useState(null);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: 'Transformer Management',
            headerRight: () => (
                <Image
                    source={require('../../assets/images/powertel_logo.jpg')}
                    style={{ width: 40, height: 40, marginRight: 15, borderRadius: 8 }}
                    resizeMode="contain"
                />
            ),
        });
    }, [navigation]);

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

    // Render custom item for Regions
    const renderRegionItem = (item, onSelect) => (
        <TouchableOpacity onPress={() => onSelect(item)} style={[styles.card, styles.regionCard]}>
            <LinearGradient colors={['#4fc3f7', '#0288d1']} style={styles.iconContainer}>
                <Ionicons name="map" size={20} color="#fff" />
            </LinearGradient>
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.name}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#bdbdbd" />
        </TouchableOpacity>
    );

    // Render custom item for Districts
    const renderDistrictItem = (item, onSelect) => (
        <TouchableOpacity onPress={() => onSelect(item)} style={[styles.card, styles.districtCard]}>
             <LinearGradient colors={['#66bb6a', '#388e3c']} style={styles.iconContainer}>
                <Ionicons name="business" size={20} color="#fff" />
            </LinearGradient>
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.name}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#bdbdbd" />
        </TouchableOpacity>
    );

    // Render custom item for Depots
    const renderDepotItem = (item, onSelect) => (
        <TouchableOpacity onPress={() => onSelect(item)} style={[styles.card, styles.depotCard]}>
             <LinearGradient colors={['#ffca28', '#f57c00']} style={styles.iconContainer}>
                <Ionicons name="home" size={20} color="#fff" />
            </LinearGradient>
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.name}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#bdbdbd" />
        </TouchableOpacity>
    );

    // Render custom item for Transformers
    const renderTransformerItem = (item, onEdit, onDelete) => (
        <View style={[styles.card, styles.transformerCard]}>
             <LinearGradient 
                colors={item.isActive ? ['#66bb6a', '#2e7d32'] : ['#ef5350', '#c62828']} 
                style={styles.iconContainer}
             >
                <Ionicons name="flash" size={20} color="#fff" />
            </LinearGradient>
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSubtitle}>{item.capacity} KVA • {item.depotName}</Text>
                <View style={styles.statusBadge}>
                     <View style={[styles.statusDot, { backgroundColor: item.isActive ? '#4CAF50' : '#F44336' }]} />
                     <Text style={[styles.statusText, { color: item.isActive ? '#4CAF50' : '#F44336' }]}>
                        {item.isActive ? 'Active' : 'Maintenance'}
                     </Text>
                </View>
            </View>
            <View style={styles.cardActions}>
                <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
                    <Ionicons name="create-outline" size={24} color="#0067A5" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
                    <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                </TouchableOpacity>
            </View>
        </View>
    );

    // Dynamic props for CrudScreen
    let screenProps = {};

    switch (viewLevel) {
        case 'regions':
            screenProps = {
                title: '',
                fetchData: infrastructureService.getAllRegions, // Returns Page object
                fields: [{ name: 'name', label: 'Name' }], // Minimal fields for search
                renderCustomItem: (item) => renderRegionItem(item, handleSelectRegion),
                createItem: null, // Read-only
                onBack: null // Root level
            };
            break;
        case 'districts':
            screenProps = {
                title: '',
                subtitle: selectedRegion?.name,
                fetchData: async (page, size, search) => {
                    const data = await infrastructureService.getDistrictsByRegion(selectedRegion.id);
                    if (search) return data.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
                    return data;
                },
                fields: [{ name: 'name', label: 'Name' }],
                renderCustomItem: (item) => renderDistrictItem(item, handleSelectDistrict),
                createItem: null,
                onBack: handleBack
            };
            break;
        case 'depots':
            screenProps = {
                title: '',
                subtitle: selectedDistrict?.name,
                fetchData: async (page, size, search) => {
                    const data = await infrastructureService.getDepotsByDistrict(selectedDistrict.id);
                    if (search) return data.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
                    return data;
                },
                fields: [{ name: 'name', label: 'Name' }],
                renderCustomItem: (item) => renderDepotItem(item, handleSelectDepot),
                createItem: null,
                onBack: handleBack
            };
            break;
        case 'transformers':
            screenProps = {
                title: `Transformers`,
                subtitle: selectedDepot?.name,
                fetchData: fetchTransformers,
                fields: transformerFields,
                createItem: transformerService.createTransformer,
                updateItem: transformerService.updateTransformer,
                deleteItem: transformerService.deleteTransformer,
                transformDataBeforeSubmit: transformDataBeforeSubmit,
                entityName: 'Transformer',
                onBack: handleBack,
                addButtonLabel: 'Add Transformer',
                renderCustomItem: renderTransformerItem // Override default render to show nice card
            };
            break;
    }

    // Force re-mount of CrudScreen when viewLevel changes to reset state
    return (
        <CrudScreen
            key={viewLevel} 
            {...screenProps}
            showLogo={false}
            showTitle={false}
        />
    );
};

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.95)', // Slightly transparent
        marginHorizontal: 16,
        marginVertical: 4,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 0, // Removed border for cleaner look
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10, // Squircle
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'Inter_600SemiBold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 13,
        color: '#757575',
        fontFamily: 'Inter_400Regular',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
        fontFamily: 'Inter_500Medium',
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        padding: 8,
        marginLeft: 4,
    },
});

export default TransformerCrudScreen;
