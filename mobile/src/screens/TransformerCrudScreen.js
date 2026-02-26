import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import CrudScreen from '../components/CrudScreen';
import LogoutButton from '../components/LogoutButton';
import transformerService from '../services/transformer';
import infrastructureService from '../services/infrastructure';
import sensorService from '../services/sensor';

const TransformerCrudScreen = () => {
    const navigation = useNavigation();
    const [viewLevel, setViewLevel] = useState('regions'); // 'regions', 'districts', 'depots', 'transformers', 'sensors'
    const [selectedRegion, setSelectedRegion] = useState(null);
    const [selectedDistrict, setSelectedDistrict] = useState(null);
    const [selectedDepot, setSelectedDepot] = useState(null);
    const [selectedTransformer, setSelectedTransformer] = useState(null);
    const [selectedSensor, setSelectedSensor] = useState(null);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: 'Transformers',
            headerRight: () => <LogoutButton />,
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

    const handleSelectTransformer = (transformer) => {
        setSelectedTransformer(transformer);
        setViewLevel('sensors');
    };

    const handleSelectSensor = (sensor) => {
        setSelectedSensor(sensor);
        setViewLevel('sensor_readings');
    };

    const handleBack = () => {
        if (viewLevel === 'sensor_readings') setViewLevel('sensors');
        else if (viewLevel === 'sensors') setViewLevel('transformers');
        else if (viewLevel === 'transformers') setViewLevel('depots');
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

    const getSensorIcon = (type) => {
        const lowerType = type ? type.toLowerCase() : '';
        if (lowerType.includes('temp')) return { name: 'thermometer', colors: ['#ff7043', '#d84315'] };
        if (lowerType.includes('contact')) return { name: 'radio-button-on', colors: ['#5c6bc0', '#3949ab'] };
        if (lowerType.includes('motion')) return { name: 'walk', colors: ['#ffa726', '#ef6c00'] };
        if (lowerType.includes('tilt')) return { name: 'navigate', colors: ['#26c6da', '#0097a7'] };
        if (lowerType.includes('oil')) return { name: 'water', colors: ['#42a5f5', '#1565c0'] };
        if (lowerType.includes('vib')) return { name: 'pulse', colors: ['#ab47bc', '#7b1fa2'] };
        if (lowerType.includes('sound') || lowerType.includes('noise')) return { name: 'volume-high', colors: ['#26a69a', '#00695c'] };
        if (lowerType.includes('camera') || lowerType.includes('vision')) return { name: 'camera', colors: ['#7e57c2', '#512da8'] };
        if (lowerType.includes('volt')) return { name: 'flash', colors: ['#fdd835', '#fbc02d'] };
        return { name: 'hardware-chip', colors: ['#78909c', '#455a64'] };
    };

    // Render custom item for Sensors
    const renderSensorItem = (item, onEdit, onDelete) => {
        const { name, colors } = getSensorIcon(item.type);
        return (
            <TouchableOpacity onPress={() => handleSelectSensor(item)} style={[styles.card, { flexDirection: 'row', alignItems: 'center' }]}>
                <LinearGradient colors={colors} style={styles.iconContainer}>
                    <Ionicons name={name} size={16} color="#fff" />
                </LinearGradient>
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.type}</Text>
                </View>
                 <Ionicons name="chevron-forward" size={18} color="#bdbdbd" />
            </TouchableOpacity>
        );
    };

    // Render custom item for Sensor Readings
    const renderReadingItem = (item) => {
        let dateStr = 'N/A';
        try {
            if (item.timestamp) {
                const d = new Date(item.timestamp);
                if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleString();
                } else {
                    dateStr = item.timestamp; // Show raw string if parsing fails but exists
                }
            }
        } catch (e) {}

        return (
            <View style={[styles.card, { flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 12 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 4 }}>
                    <Text style={styles.readingValue}>{String(item.value)}</Text>
                    <Text style={styles.readingTime}>{dateStr}</Text>
                </View>
            </View>
        );
    };

    // Render custom item for Transformers
    const renderTransformerItem = (item, onEdit, onDelete) => (
        <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={{ marginBottom: 4 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <LinearGradient 
                        colors={item.isActive ? ['#66bb6a', '#2e7d32'] : ['#ef5350', '#c62828']} 
                        style={styles.iconContainer}
                    >
                        <Ionicons name="flash" size={16} color="#fff" />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardSubtitle}>{item.capacity} KVA • {item.depotName}</Text>
                        <View style={styles.statusBadge}>
                             <View style={[styles.statusDot, { backgroundColor: item.isActive ? '#4CAF50' : '#F44336' }]} />
                             <Text style={[styles.statusText, { color: item.isActive ? '#4CAF50' : '#F44336' }]}>
                                {item.isActive ? 'Active' : 'Maintenance'}
                             </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.cardActions}>
                    <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
                        <Ionicons name="create-outline" size={20} color="#4CAF50" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity 
                style={styles.viewSensorsButton}
                onPress={() => handleSelectTransformer(item)}
            >
                <Text style={styles.viewSensorsText}>View Sensors</Text>
                <Ionicons name="chevron-forward" size={12} color="#fff" />
            </TouchableOpacity>
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
        case 'sensors':
            screenProps = {
                title: 'Sensors',
                subtitle: selectedTransformer?.name,
                fetchData: async (page, size, search) => {
                     // Sensor service typically returns a list, not a Page object, so we wrap it
                     try {
                        const data = await sensorService.getSensorsByTransformer(selectedTransformer.id);
                        let result = data;
                        if (search) {
                            result = data.filter(s => s.type.toLowerCase().includes(search.toLowerCase()) || s.id.toString().includes(search));
                        }

                        // Sort order: Temperature -> Contact -> Motion -> Tilt -> Others
                        const priority = ['temp', 'contact', 'motion', 'tilt'];
                        return result.sort((a, b) => {
                            const typeA = a.type ? a.type.toLowerCase() : '';
                            const typeB = b.type ? b.type.toLowerCase() : '';
                            
                            const getPriority = (t) => {
                                const index = priority.findIndex(p => t.includes(p));
                                return index === -1 ? 999 : index;
                            };
                            
                            const pA = getPriority(typeA);
                            const pB = getPriority(typeB);
                            
                            if (pA !== pB) return pA - pB;
                            return typeA.localeCompare(typeB);
                        });
                     } catch (error) {
                         console.error("Error fetching sensors", error);
                         return [];
                     }
                },
                fields: [{ name: 'type', label: 'Sensor Type' }], // Basic field for now
                renderCustomItem: (item) => renderSensorItem(item),
                createItem: null, // Read-only for now as per request "open all sensors"
                onBack: handleBack
            };
            break;
        case 'sensor_readings':
            screenProps = {
                title: 'Readings',
                subtitle: selectedSensor?.type,
                filterType: 'date_range',
                fetchData: async (page, size, filters) => {
                     try {
                        let startDate = null;
                        let endDate = null;

                        if (filters && typeof filters === 'object') {
                             if (filters.startDate && filters.startDate.length === 10) startDate = `${filters.startDate}T00:00:00`;
                             if (filters.endDate && filters.endDate.length === 10) endDate = `${filters.endDate}T23:59:59`;
                        }

                        const data = await sensorService.getReadingsBySensor(selectedSensor.id, startDate, endDate);
                        // Sort by timestamp desc
                        const sorted = data.sort((a, b) => {
                            const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                            const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                            return (tB || 0) - (tA || 0);
                        });

                        // If filtered, return all. If not, return top 10.
                        if (startDate && endDate) {
                            return sorted;
                        }
                        return sorted.slice(0, 10);
                     } catch (error) {
                         console.error("Error fetching readings", error);
                         return [];
                     }
                },
                fields: [{ name: 'value', label: 'Value' }], // Not really used for list
                renderCustomItem: (item) => renderReadingItem(item),
                createItem: null,
                onBack: handleBack,
                keyExtractor: (item, index) => item.id ? `${item.id}-${index}` : `reading-${index}`
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
        padding: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.95)', // Slightly transparent
        marginHorizontal: 16,
        marginVertical: 2,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        borderWidth: 0, // Removed border for cleaner look
    },
    iconContainer: {
        width: 30,
        height: 30,
        borderRadius: 8, // Squircle
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 1,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'Inter_600SemiBold',
        color: '#1a1a1a',
        marginBottom: 2,
    },
    cardSubtitle: {
        fontSize: 11,
        color: '#757575',
        fontFamily: 'Inter_400Regular',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    statusDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginRight: 4,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '500',
        fontFamily: 'Inter_500Medium',
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        padding: 4,
        marginLeft: 2,
    },
    viewSensorsButton: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0067A5',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignSelf: 'center', // Center align the button
    },
    viewSensorsText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
        fontFamily: 'Inter_600SemiBold',
        marginRight: 4,
    },
    readingValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    readingTime: {
        fontSize: 12,
        color: '#666',
    },
});

export default TransformerCrudScreen;
